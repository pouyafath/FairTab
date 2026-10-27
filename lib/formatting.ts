export function formatCurrency(
  cents: number,
  currency: string = 'CAD',
  locale: string = 'en-CA'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

export function formatDate(value: Date | number): string {
  const date = typeof value === 'number' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function dateInputToTimestamp(value: string): number {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12).getTime()
}

export function formatMonth(year: number, month: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(year, month - 1, 1))
}

export function generateInteracMessage(
  amount: number,
  recipientName: string,
  groupName: string,
  currency: string = 'CAD'
): string {
  const formatted = formatCurrency(amount, currency)
  return `Please send ${formatted} to ${recipientName} via Interac e-Transfer for ${groupName} expenses.`
}

export function centsFromDollars(dollars: number): number {
  return Math.round(dollars * 100)
}

export function dollarsToCentsString(value: string): number {
  const n = parseFloat(value)
  if (isNaN(n)) return 0
  return Math.round(n * 100)
}

export function centsToInputString(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function timestampToDateInput(value: number | Date): string {
  const d = typeof value === 'number' ? new Date(value) : value
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
