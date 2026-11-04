export interface StoredLine {
  label: string
  amount: number
}

export interface StoredEventSection {
  name: string
  total: number
  lines: StoredLine[]
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function numberValue(source: Record<string, unknown>, key: string): number {
  return typeof source[key] === 'number' ? source[key] : 0
}

export function storedLines(breakdown: unknown): StoredLine[] {
  const bd = record(breakdown)
  if (!bd) return []
  const engine = record(bd.engine)
  const result = engine ? record(engine.result) : null
  if (result && Array.isArray(result.lines)) {
    return result.lines.flatMap((value) => {
      const line = record(value)
      return line && typeof line.label === 'string' && typeof line.amount === 'number'
        ? [{ label: line.label, amount: line.amount }]
        : []
    })
  }

  const lines: StoredLine[] = []
  const add = (label: string, key: string, negative = false) => {
    const amount = numberValue(bd, key)
    if (amount) lines.push({ label, amount: negative ? -amount : amount })
  }
  add('Base Package', 'base')
  add('Additional Bartenders', 'staffing')
  add('2-Hour Service Reduction', 'twoHrReduction', true)
  add('Extended Service Hours', 'extraHours')
  add('Long-Event Premium', 'longEventPremium')
  add('Full Bar Service', 'package')
  add('Signature Cocktails', 'cocktails')
  add('House Featured Cocktails', 'houseCocktails')
  add('Featured Cocktail Program', 'cocktailProgram')
  add('High-Volume Event Adjustment', 'volume')
  add('Large Event & Multi-Bar Operations', 'multiBarOperations')
  const addonItems = Array.isArray(bd.addonItems) ? bd.addonItems : []
  if (addonItems.length) {
    for (const value of addonItems) {
      const item = record(value)
      if (item && typeof item.name === 'string' && typeof item.amount === 'number') lines.push({ label: item.name, amount: item.amount })
    }
  } else add('Premium Add-Ons', 'addons')
  add('Premium Glassware', 'glassware')
  if (bd.glasswareAtCost === true) lines.push({ label: 'Plastic Serviceware (at cost, confirmed later)', amount: 0 })
  add('Travel Fee', 'travel')
  const customItems = Array.isArray(bd.customItems) ? bd.customItems : []
  if (customItems.length) {
    for (const value of customItems) {
      const item = record(value)
      if (item && typeof item.name === 'string' && typeof item.price === 'number') lines.push({ label: item.name, amount: item.price })
    }
  } else add('Custom Items', 'customItemsTotal')
  add('Promo Discount', 'discount', true)
  const customDiscountLabel = typeof bd.customDiscountLabel === 'string' && bd.customDiscountLabel ? bd.customDiscountLabel : 'Custom Discount'
  add(customDiscountLabel, 'customDiscount', true)
  return lines
}

export function storedEventSections(breakdown: unknown): StoredEventSection[] {
  if (!Array.isArray(breakdown)) return []
  return breakdown.flatMap((value, index) => {
    const event = record(value)
    if (!event) return []
    return [{
      name: typeof event.name === 'string' && event.name ? event.name : `Event ${index + 1}`,
      total: typeof event.total === 'number' ? event.total : 0,
      lines: storedLines(event.bd),
    }]
  })
}
