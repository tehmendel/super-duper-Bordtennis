// Monday-start calendar week boundary (matches Norwegian/ISO week convention),
// as opposed to a rolling "last 7 days" window.
export function startOfWeek(d: Date = new Date()): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}
