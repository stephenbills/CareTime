'use client'
import { useState, useEffect } from 'react'
import { RRule } from 'rrule'

const FREQ_OPTIONS = [
  { label: 'day', value: RRule.DAILY },
  { label: 'week', value: RRule.WEEKLY },
  { label: 'month', value: RRule.MONTHLY },
  { label: 'year', value: RRule.YEARLY },
]

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const RRULE_DAYS = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA]

interface Props {
  startDate?: Date
  onChange: (rruleStr: string | null, description: string) => void
  initialRRule?: string | null
}

export default function RecurrencePicker({ startDate, onChange, initialRRule }: Props) {
  const refDate = startDate || new Date()
  const dayOfWeek = refDate.getDay()
  const dayName = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayOfWeek]
  const dateNum = refDate.getDate()
  const weekNum = Math.ceil(dateNum / 7)
  const ordinals = ['first', 'second', 'third', 'fourth', 'fifth']
  const ordinal = ordinals[weekNum - 1] || 'last'

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
  const [showModal, setShowModal] = useState(false)
  const [description, setDescription] = useState('Does not repeat')

  // Custom options
  const [freq, setFreq] = useState(RRule.WEEKLY)
  const [interval, setInterval] = useState(1)
  const [byDay, setByDay] = useState<number[]>([dayOfWeek])
  const [endType, setEndType] = useState<'never' | 'until' | 'count'>('never')
  const [untilDate, setUntilDate] = useState('')
  const [count, setCount] = useState(13)

  // Parse initial rrule
  useEffect(() => {
    if (!initialRRule) return
    try {
      const rule = RRule.fromString(initialRRule)
      const opts = rule.origOptions
      if (opts.freq === RRule.DAILY && (opts.interval || 1) === 1) {
        setSelected('daily')
      } else if (opts.freq === RRule.WEEKLY && (opts.interval || 1) === 1 &&
        opts.byweekday && (opts.byweekday as any[]).length === 5) {
        setSelected('weekdays')
      } else if (opts.freq === RRule.WEEKLY && (opts.interval || 1) === 1) {
        setSelected('weekly')
      } else {
        setSelected('custom')
      }
      setFreq(opts.freq || RRule.WEEKLY)
      setInterval(opts.interval || 1)
      if (opts.byweekday) {
        setByDay((opts.byweekday as any[]).map((d: any) =>
          typeof d === 'number' ? d : (d.weekday ?? d)
        ))
      }
      if (opts.until) { setEndType('until'); setUntilDate(opts.until.toISOString().slice(0, 10)) }
      else if (opts.count) { setEndType('count'); setCount(opts.count) }
      setDescription(rule.toText())
    } catch {}
  }, [initialRRule])

  function toggleDay(d: number) {
    setByDay(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
  }

  function buildRule(preset: PresetKey): { str: string | null; desc: string } {
    let rule: RRule | null = null
    switch (preset) {
      case 'none': return { str: null, desc: 'Does not repeat' }
      case 'daily': rule = new RRule({ freq: RRule.DAILY, interval: 1 }); break
      case 'weekly': rule = new RRule({ freq: RRule.WEEKLY, interval: 1, byweekday: [RRULE_DAYS[dayOfWeek]] }); break
      case 'monthly_date': rule = new RRule({ freq: RRule.MONTHLY, interval: 1, bymonthday: [dateNum] }); break
      case 'monthly_day': rule = new RRule({ freq: RRule.MONTHLY, interval: 1, byweekday: [RRULE_DAYS[dayOfWeek].nth(weekNum)] }); break
      case 'yearly': rule = new RRule({ freq: RRule.YEARLY, interval: 1, bymonth: [refDate.getMonth() + 1], bymonthday: [dateNum] }); break
      case 'weekdays': rule = new RRule({ freq: RRule.WEEKLY, interval: 1, byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR] }); break
      case 'custom': {
        const opts: any = { freq, interval }
        if (freq === RRule.WEEKLY && byDay.length > 0) opts.byweekday = byDay.map(d => RRULE_DAYS[d])
        if (endType === 'until' && untilDate) opts.until = new Date(untilDate + 'T23:59:59')
        else if (endType === 'count' && count > 0) opts.count = count
        rule = new RRule(opts)
        break
      }
    }
    return { str: rule ? rule.toString() : null, desc: rule ? rule.toText() : 'Does not repeat' }
  }

  function handleSelect(key: PresetKey) {
    setSelected(key)
    if (key === 'custom') {
      setShowModal(true)
      return
    }
    setShowModal(false)
    const { str, desc } = buildRule(key)
    setDescription(desc)
    onChange(str, desc)
  }

  function handleCustomDone() {
    const { str, desc } = buildRule('custom')
    setDescription(desc)
    onChange(str, desc)
    setShowModal(false)
  }

  function handleCustomCancel() {
    setSelected('none')
    setShowModal(false)
    setDescription('Does not repeat')
    onChange(null, 'Does not repeat')
  }

  const freqLabel = FREQ_OPTIONS.find(f => f.value === freq)?.label || 'week'

  return (
    <div>
      {/* Preset dropdown */}
      <select
        value={selected}
        onChange={e => handleSelect(e.target.value as PresetKey)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {presets.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>

      {/* Summary of the current recurrence */}
      {selected !== 'none' && !showModal && (
        <div className="bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-700 mt-2">
          {description}
        </div>
      )}

      {/* Custom recurrence description when custom is selected and modal closed */}
      {selected === 'custom' && !showModal && (
        <button type="button" onClick={() => setShowModal(true)}
          className="mt-2 text-xs text-blue-600 hover:underline">
          Edit custom recurrence
        </button>
      )}

      {/* Modal overlay */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 space-y-5">
              <h2 className="text-xl font-bold text-gray-900">Custom recurrence</h2>

              {/* Repeat every N [frequency] */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600">Repeat every</span>
                <input type="number" min={1} max={99} value={interval}
                  onChange={e => setInterval(Math.max(1, Number(e.target.value)))}
                  className="w-14 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <select value={freq} onChange={e => setFreq(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {FREQ_OPTIONS.map(f => (
                    <option key={f.value} value={f.value}>
                      {f.label}{interval > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Day picker (weekly only) */}
              {freq === RRule.WEEKLY && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Repeat on</p>
                  <div className="flex gap-2 justify-center">
                    {DAY_LABELS.map((label, i) => (
                      <button key={i} type="button" onClick={() => toggleDay(i)}
                        className={`w-10 h-10 rounded-full text-sm font-semibold transition-all ${
                          byDay.includes(i)
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ends */}
              <div>
                <p className="text-sm text-gray-600 mb-3">Ends</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="radio" name="recEndType" checked={endType === 'never'}
                      onChange={() => setEndType('never')}
                      className="w-4 h-4 accent-blue-600" />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">Never</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="radio" name="recEndType" checked={endType === 'until'}
                      onChange={() => setEndType('until')}
                      className="w-4 h-4 accent-blue-600" />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">On</span>
                    <input type="date" value={untilDate}
                      onChange={e => { setUntilDate(e.target.value); setEndType('until') }}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ml-auto" />
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input type="radio" name="recEndType" checked={endType === 'count'}
                      onChange={() => setEndType('count')}
                      className="w-4 h-4 accent-blue-600" />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">After</span>
                    <div className="flex items-center gap-2 ml-auto">
                      <input type="number" min={1} max={999} value={count}
                        onChange={e => { setCount(Math.max(1, Number(e.target.value))); setEndType('count') }}
                        className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <span className="text-sm text-gray-500">occurrences</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
              <button type="button" onClick={handleCustomCancel}
                className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                Cancel
              </button>
              <button type="button" onClick={handleCustomDone}
                className="px-5 py-2 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
