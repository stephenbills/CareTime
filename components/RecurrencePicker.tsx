'use client'
import { useState, useEffect, useMemo } from 'react'
import { RRule } from 'rrule'

const FREQ_OPTIONS = [
  { label: 'Day', value: RRule.DAILY },
  { label: 'Week', value: RRule.WEEKLY },
  { label: 'Month', value: RRule.MONTHLY },
  { label: 'Year', value: RRule.YEARLY },
]

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const RRULE_DAYS = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA]

const MONTH_OPTIONS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface Props {
  /** The initial date the activity starts on (used for preset labels) */
  startDate?: Date
  /** Callback with the rrule string, or null for "does not repeat" */
  onChange: (rruleStr: string | null, description: string) => void
  /** Initial rrule string (for editing) */
  initialRRule?: string | null
}

export default function RecurrencePicker({ startDate, onChange, initialRRule }: Props) {
  const refDate = startDate || new Date()
  const dayOfWeek = refDate.getDay()
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayOfWeek]
  const dateNum = refDate.getDate()

  // Determine which week of the month (1st, 2nd, 3rd, 4th, last)
  const weekNum = Math.ceil(dateNum / 7)
  const ordinals = ['first', 'second', 'third', 'fourth', 'fifth']
  const ordinal = ordinals[weekNum - 1] || 'last'

  // Presets
  type PresetKey = 'none' | 'daily' | 'weekly' | 'monthly_date' | 'monthly_day' | 'yearly' | 'weekdays' | 'custom'
  const presets: { key: PresetKey; label: string }[] = [
    { key: 'none', label: 'Does not repeat' },
    { key: 'daily', label: 'Daily' },
    { key: 'weekly', label: `Weekly on ${dayName}` },
    { key: 'monthly_date', label: `Monthly on day ${dateNum}` },
    { key: 'monthly_day', label: `Monthly on the ${ordinal} ${dayName}` },
    { key: 'yearly', label: `Annually on ${refDate.toLocaleDateString('en-AU', { month: 'long', day: 'numeric' })}` },
    { key: 'weekdays', label: 'Every weekday (Mon–Fri)' },
    { key: 'custom', label: 'Custom…' },
  ]

  const [selected, setSelected] = useState<PresetKey>('none')
  const [showCustom, setShowCustom] = useState(false)

  // Custom options
  const [freq, setFreq] = useState(RRule.WEEKLY)
  const [interval, setInterval] = useState(1)
  const [byDay, setByDay] = useState<number[]>([dayOfWeek])
  const [endType, setEndType] = useState<'never' | 'until' | 'count'>('never')
  const [untilDate, setUntilDate] = useState('')
  const [count, setCount] = useState(12)

  // Parse initial rrule on mount
  useEffect(() => {
    if (!initialRRule) return
    try {
      const rule = RRule.fromString(initialRRule)
      const opts = rule.origOptions

      // Try to match a preset
      if (opts.freq === RRule.DAILY && (opts.interval || 1) === 1) {
        setSelected('daily')
      } else if (opts.freq === RRule.WEEKLY && (opts.interval || 1) === 1 &&
        opts.byweekday && (opts.byweekday as any[]).length === 5) {
        setSelected('weekdays')
      } else if (opts.freq === RRule.WEEKLY && (opts.interval || 1) === 1) {
        setSelected('weekly')
      } else {
        setSelected('custom')
        setShowCustom(true)
      }

      setFreq(opts.freq || RRule.WEEKLY)
      setInterval(opts.interval || 1)
      if (opts.byweekday) {
        const days = (opts.byweekday as any[]).map((d: any) => {
          if (typeof d === 'number') return d
          return d.weekday !== undefined ? d.weekday : d
        })
        setByDay(days)
      }
      if (opts.until) {
        setEndType('until')
        setUntilDate(opts.until.toISOString().slice(0, 10))
      } else if (opts.count) {
        setEndType('count')
        setCount(opts.count)
      }
    } catch {}
  }, [initialRRule])

  function toggleDay(d: number) {
    setByDay(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()
    )
  }

  // Build the rrule from current state
  function buildRule(preset: PresetKey): { str: string | null; desc: string } {
    let rule: RRule | null = null

    switch (preset) {
      case 'none':
        return { str: null, desc: 'Does not repeat' }
      case 'daily':
        rule = new RRule({ freq: RRule.DAILY, interval: 1 })
        break
      case 'weekly':
        rule = new RRule({ freq: RRule.WEEKLY, interval: 1, byweekday: [RRULE_DAYS[dayOfWeek]] })
        break
      case 'monthly_date':
        rule = new RRule({ freq: RRule.MONTHLY, interval: 1, bymonthday: [dateNum] })
        break
      case 'monthly_day':
        rule = new RRule({ freq: RRule.MONTHLY, interval: 1, byweekday: [RRULE_DAYS[dayOfWeek].nth(weekNum)] })
        break
      case 'yearly':
        rule = new RRule({ freq: RRule.YEARLY, interval: 1, bymonth: [refDate.getMonth() + 1], bymonthday: [dateNum] })
        break
      case 'weekdays':
        rule = new RRule({ freq: RRule.WEEKLY, interval: 1, byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR] })
        break
      case 'custom':
        const opts: any = { freq, interval }
        if (freq === RRule.WEEKLY && byDay.length > 0) {
          opts.byweekday = byDay.map(d => RRULE_DAYS[d])
        }
        if (endType === 'until' && untilDate) {
          opts.until = new Date(untilDate + 'T23:59:59')
        } else if (endType === 'count' && count > 0) {
          opts.count = count
        }
        rule = new RRule(opts)
        break
    }

    return {
      str: rule ? rule.toString() : null,
      desc: rule ? rule.toText() : 'Does not repeat',
    }
  }

  function handleSelect(key: PresetKey) {
    setSelected(key)
    if (key === 'custom') {
      setShowCustom(true)
      // Don't fire onChange yet — wait for custom panel save
      return
    }
    setShowCustom(false)
    const { str, desc } = buildRule(key)
    onChange(str, desc)
  }

  function handleCustomDone() {
    const { str, desc } = buildRule('custom')
    onChange(str, desc)
  }

  // Fire onChange when custom options change
  useEffect(() => {
    if (selected === 'custom' && showCustom) {
      handleCustomDone()
    }
  }, [freq, interval, byDay, endType, untilDate, count])

  const freqLabel = FREQ_OPTIONS.find(f => f.value === freq)?.label?.toLowerCase() || 'week'

  return (
    <div className="space-y-3">
      {/* Preset selector */}
      <select
        value={selected}
        onChange={e => handleSelect(e.target.value as PresetKey)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {presets.map(p => (
          <option key={p.key} value={p.key}>{p.label}</option>
        ))}
      </select>

      {/* Custom panel */}
      {showCustom && selected === 'custom' && (
        <div className="border border-blue-200 bg-blue-50/50 rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-blue-900">Custom Recurrence</p>

          {/* Repeat every N [days/weeks/months/years] */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">Repeat every</span>
            <input type="number" min={1} max={99} value={interval}
              onChange={e => setInterval(Math.max(1, Number(e.target.value)))}
              className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={freq} onChange={e => setFreq(Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              {FREQ_OPTIONS.map(f => (
                <option key={f.value} value={f.value}>
                  {f.label}{interval > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Day picker (for weekly) */}
          {freq === RRule.WEEKLY && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Repeat on</p>
              <div className="flex gap-1.5">
                {DAY_LABELS.map((label, i) => (
                  <button key={i} type="button" onClick={() => toggleDay(i)}
                    className={`w-9 h-9 rounded-full text-xs font-semibold transition-colors ${
                      byDay.includes(i)
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-400'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* End condition */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Ends</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="endType" checked={endType === 'never'}
                  onChange={() => setEndType('never')}
                  className="accent-blue-600" />
                <span className="text-sm text-gray-700">Never</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="endType" checked={endType === 'until'}
                  onChange={() => setEndType('until')}
                  className="accent-blue-600" />
                <span className="text-sm text-gray-700">On</span>
                {endType === 'until' && (
                  <input type="date" value={untilDate} onChange={e => setUntilDate(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                )}
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="endType" checked={endType === 'count'}
                  onChange={() => setEndType('count')}
                  className="accent-blue-600" />
                <span className="text-sm text-gray-700">After</span>
                {endType === 'count' && (
                  <div className="flex items-center gap-1">
                    <input type="number" min={1} max={999} value={count}
                      onChange={e => setCount(Math.max(1, Number(e.target.value)))}
                      className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <span className="text-sm text-gray-500">occurrences</span>
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
