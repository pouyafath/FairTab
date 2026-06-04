const KEY = 'fairtab:budgets'

export type BudgetMap = Record<string, number> // category → amount in cents

export function readBudgets(): BudgetMap {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function saveBudgets(budgets: BudgetMap): void {
  localStorage.setItem(KEY, JSON.stringify(budgets))
}
