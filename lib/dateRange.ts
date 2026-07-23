// Shared date-range rule used by every date-range picker (Reports, Invoice
// Generate/Reissue, Client Reports): the "to" date must be after "from", and
// "to" defaults to "from" + 7 days.

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Call when the "from" date changes — keeps "to" defaulted/valid.
export function nextToOnFromChange(newFrom: string, currentTo: string): string {
  if (!currentTo || new Date(currentTo) <= new Date(newFrom)) {
    return addDays(newFrom, 7)
  }
  return currentTo
}

// Call when the "to" date changes directly — clamps a "to" that isn't after "from".
export function clampToOnToChange(newTo: string, from: string): string {
  if (from && new Date(newTo) <= new Date(from)) {
    return addDays(from, 1)
  }
  return newTo
}
