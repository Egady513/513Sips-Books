// Types matching Supabase schema

export interface Event {
  id: string
  client_name: string
  client_email?: string
  client_phone?: string
  event_name?: string
  event_date: string
  location?: string
  event_type?: string
  guest_count?: number
  service_hours?: number
  services_description?: string
  description?: string
  total_amount: number
  deposit_amount: number
  balance_amount: number
  status: string
  signed_contract_url?: string
  notes?: string
  created_at: string
  updated_at: string
  // Joined
  ar_entries?: AREntry[]
}

export interface AREntry {
  id: string
  event_id: string
  entry_type: 'deposit' | 'balance' | 'full'
  amount: number
  status: 'pending' | 'received' | 'overdue'
  due_date?: string
  received_at?: string
  payment_method?: string
  notes?: string
  created_at: string
  // Joined
  events?: Event
}

export interface Vendor {
  id: string
  name: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  payment_terms?: string
  default_category?: string
  notes?: string
  created_at: string
}

export interface APEntry {
  id: string
  vendor_id?: string
  event_id?: string
  description: string
  amount: number
  due_date: string
  status: 'pending' | 'paid' | 'overdue'
  paid_at?: string
  payment_method?: string
  category?: string
  is_owner_draw?: boolean
  schedule_c_line?: string
  notes?: string
  created_at: string
  // Joined
  vendors?: Vendor
  events?: Event
}

export interface Transaction {
  id: string
  description: string
  type: 'income' | 'expense'
  category: string
  amount: number
  transaction_date: string
  notes?: string
  created_at: string
}

export interface Expense {
  id: string
  event_id?: string
  description: string
  category: string
  amount: number
  expense_date: string
  vendor?: string
  is_tax_deductible: boolean
  schedule_c_line?: string
  receipt_url?: string
  notes?: string
  created_at: string
  // Joined
  events?: Event
}

export interface MileageEntry {
  id: string
  event_id?: string
  trip_date: string
  from_location?: string
  to_location?: string
  miles: number
  purpose?: string
  rate_per_mile: number
  deduction_amount: number
  created_at: string
  // Joined
  events?: Event
}

export interface BankTransaction {
  id: string
  import_batch: string
  transaction_date: string
  description?: string
  amount: number
  matched_ar_entry_id?: string
  matched_ap_entry_id?: string
  matched_expense_id?: string
  status: 'unmatched' | 'matched' | 'ignored'
  notes?: string
  imported_at: string
}

export interface Setting {
  key: string
  value: string
  updated_at: string
}

// Dashboard KPIs
export interface DashboardKPIs {
  totalRevenue: number
  outstandingAR: number
  outstandingAP: number
  netProfit: number
  activeEvents: number
  totalExpenses: number
}
