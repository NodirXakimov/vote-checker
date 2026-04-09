export function formatDateTime(value?: string): string {
  if (!value) return '—'

  const date = new Date(value)

  if (isNaN(date.getTime())) return 'Invalid date'

  return date.toLocaleString('uz-UZ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
