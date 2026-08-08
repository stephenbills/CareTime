// rrule works in "floating time": it reads a Date's UTC calendar fields and
// treats them as the intended wall-clock date. Building dates via local-time
// parsing (e.g. `new Date(dateStr + 'T00:00:00')`) makes those UTC fields
// drift by the timezone offset, which is what caused recurring occurrences
// to land on the wrong weekday in AEST/AEDT. These helpers keep every call
// site consistent with rrule's convention.

export function dateOnlyToRRuleDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function localDateToRRuleDate(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

export function addDaysUTC(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86400000)
}

export function rruleDateToLocalDateStr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

// Combine an rrule-expanded occurrence's UTC calendar date with a real local
// wall-clock time, producing the correct local instant for storage.
export function combineRRuleDateWithLocalTime(occ: Date, hh: number, mm: number): Date {
  return new Date(occ.getUTCFullYear(), occ.getUTCMonth(), occ.getUTCDate(), hh, mm, 0, 0)
}
