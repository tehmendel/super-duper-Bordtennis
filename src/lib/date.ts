// Norwegian numeric date format (dd.mm.åååå) for standalone dates — tables,
// cards, timestamps. Deliberately not used for dates embedded in prose
// sentences (e.g. "Den 3. juli 2026 tapte du mot X"), which keep their
// readable weekday/long-month form.
export function formatDate(date: string | number | Date): string {
  return new Date(date).toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTime(date: string | number | Date): string {
  const d = new Date(date)
  const time = d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' })
  return `${formatDate(d)} ${time}`
}
