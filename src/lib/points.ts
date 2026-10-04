export function formatActualCostPoints(value?: number | null): string | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined
  return value.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1')
}
