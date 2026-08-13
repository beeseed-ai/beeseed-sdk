export interface SkillMenuOrderItem {
  name: string
  display_name?: string
}

export function normalizeSkillMenuOrder(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') continue
    const name = item.trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    result.push(name)
  }
  return result
}

export function orderSkillMenuItems<T extends SkillMenuOrderItem>(items: T[], configuredOrder: unknown): T[] {
  const order = normalizeSkillMenuOrder(configuredOrder)
  const rank = new Map(order.map((name, index) => [name, index]))
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftRank = rank.get(left.item.name)
      const rightRank = rank.get(right.item.name)
      if (leftRank !== undefined || rightRank !== undefined) {
        if (leftRank === undefined) return 1
        if (rightRank === undefined) return -1
        if (leftRank !== rightRank) return leftRank - rightRank
      }
      const displayOrder = (left.item.display_name || left.item.name)
        .localeCompare(right.item.display_name || right.item.name, 'zh-CN')
      if (displayOrder !== 0) return displayOrder
      const nameOrder = left.item.name.localeCompare(right.item.name)
      return nameOrder !== 0 ? nameOrder : left.index - right.index
    })
    .map(({ item }) => item)
}
