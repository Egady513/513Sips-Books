import { SE_TAX_RATE, SE_TAX_INCOME_FACTOR, SE_TAX_DEDUCTION_FACTOR } from '../lib/constants'

export interface TaxEstimate {
  grossIncome: number
  totalExpenses: number
  netProfit: number
  seTaxableIncome: number
  seTax: number
  seTaxDeduction: number
  estimatedQuarterlyPayment: number
}

export function calculateTaxEstimate(
  grossIncome: number,
  totalExpenses: number,
  quarterMultiplier: number = 4 // how many quarters to spread over
): TaxEstimate {
  const netProfit = grossIncome - totalExpenses
  const seTaxableIncome = Math.max(0, netProfit * SE_TAX_INCOME_FACTOR)
  const seTax = seTaxableIncome * SE_TAX_RATE
  const seTaxDeduction = seTax * SE_TAX_DEDUCTION_FACTOR

  // Rough estimated income tax (using ~22% effective rate for simplicity)
  const estimatedIncomeTax = Math.max(0, (netProfit - seTaxDeduction) * 0.22)
  const totalEstimatedTax = seTax + estimatedIncomeTax
  const estimatedQuarterlyPayment = totalEstimatedTax / quarterMultiplier

  return {
    grossIncome,
    totalExpenses,
    netProfit,
    seTaxableIncome,
    seTax,
    seTaxDeduction,
    estimatedQuarterlyPayment,
  }
}

export function getScheduleCLine(category: string): string {
  const map: Record<string, string> = {
    marketing: '8',
    travel_mileage: '10',
    employees: '11',
    insurance_licenses: '15',
    professional: '17',
    office: '18',
    equipment_supplies: '22',
    travel: '24a',
    alcohol_mixers: '27a',
    other: '27a',
  }
  return map[category] || '27a'
}
