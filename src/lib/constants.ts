// Event statuses (matches existing Supabase schema)
export const EVENT_STATUSES = [
  { value: 'draft', label: 'Draft', color: 'text-gray-400' },
  { value: 'sent', label: 'Quoted', color: 'text-info' },
  { value: 'signed', label: 'Signed', color: 'text-blue-400' },
  { value: 'deposit_paid', label: 'Deposit Paid', color: 'text-warning' },
  { value: 'completed', label: 'Completed', color: 'text-purple-400' },
  { value: 'paid_full', label: 'Paid in Full', color: 'text-success' },
  { value: 'cancelled', label: 'Cancelled', color: 'text-danger' },
] as const

export type EventStatus = typeof EVENT_STATUSES[number]['value']

// AR entry types
export const AR_ENTRY_TYPES = ['deposit', 'balance', 'full'] as const
export type AREntryType = typeof AR_ENTRY_TYPES[number]

// AR statuses
export const AR_STATUSES = ['pending', 'received', 'overdue'] as const
export type ARStatus = typeof AR_STATUSES[number]

// AP statuses
export const AP_STATUSES = ['pending', 'paid', 'overdue'] as const
export type APStatus = typeof AP_STATUSES[number]

// AP / Expense categories
export const EXPENSE_CATEGORIES = [
  { value: 'alcohol_mixers', label: 'Alcohol & Mixers', scheduleCLine: '27a' },
  { value: 'equipment_supplies', label: 'Equipment & Supplies', scheduleCLine: '22' },
  { value: 'travel_mileage', label: 'Travel / Mileage', scheduleCLine: '10' },
  { value: 'insurance_licenses', label: 'Insurance & Licenses', scheduleCLine: '15' },
  { value: 'marketing', label: 'Marketing / Advertising', scheduleCLine: '8' },
  { value: 'office', label: 'Office Expense', scheduleCLine: '18' },
  { value: 'professional', label: 'Legal / Professional', scheduleCLine: '17' },
  { value: 'employees', label: 'Employees / Contract Labor', scheduleCLine: '11' },
  { value: 'other', label: 'Other Expenses', scheduleCLine: '27a' },
] as const

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number]['value']

// Schedule C line items
export const SCHEDULE_C_LINES = {
  '8': 'Advertising',
  '10': 'Car and truck expenses',
  '11': 'Contract labor',
  '15': 'Insurance (other than health)',
  '17': 'Legal and professional services',
  '18': 'Office expense',
  '22': 'Supplies',
  '24a': 'Travel',
  '27a': 'Other expenses',
} as const

// Payment methods
export const PAYMENT_METHODS = [
  { value: 'check', label: 'Check' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'other', label: 'Other' },
] as const

// Event types
export const EVENT_TYPES = [
  'Wedding', 'Corporate', 'Birthday', 'Holiday', 'Private Party',
  'Fundraiser', 'Graduation', 'Other'
] as const

// IRS mileage rates
export const MILEAGE_RATES: Record<number, number> = {
  2024: 0.67,
  2025: 0.70,
  2026: 0.70,
}

// Self-employment tax constants
export const SE_TAX_RATE = 0.153 // 15.3%
export const SE_TAX_INCOME_FACTOR = 0.9235 // 92.35% of net profit
export const SE_TAX_DEDUCTION_FACTOR = 0.5 // Deduct 50% of SE tax from AGI
