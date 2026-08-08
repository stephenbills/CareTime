import { RRule } from 'rrule'
import type { SupabaseClient } from '@supabase/supabase-js'
import { dateOnlyToRRuleDate, localDateToRRuleDate, addDaysUTC, rruleDateToLocalDateStr, combineRRuleDateWithLocalTime } from './rruleDates'

const WINDOW_DAYS = 28 // 4 weeks

function localDateStr(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Extends each of a Provider's active recurring schedules so at least 4
// weeks of activities exist ahead of today, instead of relying on a manual
// "Generate" click — a Worker can then see and accept/reject a shift that
// far out (e.g. to flag a planned holiday) without a Provider having to
// remember to generate it first. Runs from app/provider/layout.tsx on every
// real session entry. Never throws — a failure here must not block the
// Provider from loading their app.
export async function ensureSchedulesGenerated(supabase: SupabaseClient, providerId: string) {
  try {
    const { data: schedules } = await supabase
      .from('recurring_schedules')
      .select('*')
      .eq('provider_id', providerId)
      .eq('active', true)

    if (!schedules || schedules.length === 0) return

    const scheduleIds = schedules.map(s => s.id)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    // Separate "rrule space" anchors (UTC-anchored, per rrule's floating-time
    // convention) from `now`/`furthest` above, which stay real local instants
    // for comparing against genuine stored timestamps.
    const nowRRule = localDateToRRuleDate(new Date())
    const windowEnd = addDaysUTC(nowRRule, WINDOW_DAYS)

    const { data: futureActivities } = await supabase
      .from('activities')
      .select('recurring_schedule_id, start_time')
      .in('recurring_schedule_id', scheduleIds)
      .gte('start_time', now.toISOString())

    for (const schedule of schedules) {
      // Legacy days_of_week-only schedules (no rrule) aren't handled here —
      // rrule is the current, superseding representation.
      if (!schedule.rrule) continue
      if (schedule.valid_until && new Date(schedule.valid_until) < now) continue

      const ownFutureRows = (futureActivities || []).filter(a => a.recurring_schedule_id === schedule.id)
      const furthest = ownFutureRows.reduce<Date | null>((max, a) => {
        const d = new Date(a.start_time)
        return !max || d > max ? d : max
      }, null)

      const validFromDate = schedule.valid_from ? dateOnlyToRRuleDate(schedule.valid_from) : nowRRule
      const furthestRRule = furthest ? localDateToRRuleDate(furthest) : null
      const searchStart = furthestRRule && furthestRRule > nowRRule ? furthestRRule : (validFromDate > nowRRule ? validFromDate : nowRRule)

      if (searchStart >= windowEnd) continue // already generated far enough ahead

      const until = schedule.valid_until && dateOnlyToRRuleDate(schedule.valid_until) < windowEnd
        ? dateOnlyToRRuleDate(schedule.valid_until)
        : windowEnd

      const rule = RRule.fromString(schedule.rrule)
      const occurrences = rule.between(searchStart, until, true)
      if (occurrences.length === 0) continue

      const existingDates = new Set(ownFutureRows.map(a => localDateStr(new Date(a.start_time))))
      const [sh, sm] = (schedule.start_time || '09:00').slice(0, 5).split(':').map(Number)
      const durationMins = schedule.duration_minutes || 120

      const newRows = occurrences
        .filter(occ => !existingDates.has(rruleDateToLocalDateStr(occ)))
        .map(occ => {
          const start = combineRRuleDateWithLocalTime(occ, sh, sm)
          const end = new Date(start); end.setMinutes(end.getMinutes() + durationMins)
          return {
            recurring_schedule_id: schedule.id,
            provider_id: schedule.provider_id,
            client_id: schedule.client_id,
            carer_id: schedule.carer_id || null,
            ndis_line_item_id: schedule.ndis_line_item_id || null,
            title: schedule.title,
            description: schedule.description || null,
            status: 'awaiting_acceptance',
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            pickup_address: schedule.pickup_address || null,
            dropoff_address: schedule.dropoff_address || null,
            venue_address: schedule.venue_address || null,
          }
        })

      if (newRows.length > 0) {
        await supabase.from('activities').insert(newRows)
      }
    }
  } catch (err) {
    console.error('[ensureSchedulesGenerated] Error:', err)
  }
}
