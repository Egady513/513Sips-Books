import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEvents } from '../hooks/useEvents'
import { formatCurrency } from '../utils/formatters'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import type { Event } from '../lib/types'

const STATUS_COLORS: Record<string, string> = {
  draft:        'bg-gray-500/30 text-gray-300 border-gray-500/40',
  sent:         'bg-blue-500/30 text-blue-200 border-blue-500/40',
  signed:       'bg-blue-600/30 text-blue-200 border-blue-600/40',
  deposit_paid: 'bg-yellow-500/30 text-yellow-200 border-yellow-500/40',
  completed:    'bg-purple-500/30 text-purple-200 border-purple-500/40',
  paid_full:    'bg-green-500/30 text-green-200 border-green-500/40',
  cancelled:    'bg-red-500/20 text-red-300/60 border-red-500/20 line-through opacity-50',
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CalendarPage() {
  const navigate = useNavigate()
  const now = new Date()
  const [viewDate, setViewDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1))

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  const { data: allEvents = [] } = useEvents()

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay() // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days: (number | null)[] = []

    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let d = 1; d <= daysInMonth; d++) days.push(d)
    while (days.length % 7 !== 0) days.push(null)

    return days
  }, [year, month])

  // Group events by YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map: Record<string, Event[]> = {}
    for (const ev of allEvents) {
      const key = ev.event_date.split('T')[0]
      if (!map[key]) map[key] = []
      map[key].push(ev)
    }
    return map
  }, [allEvents])

  // Upcoming events in the next 60 days for the sidebar
  const upcomingEvents = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() + 60)
    return allEvents
      .filter(ev => {
        if (ev.status === 'cancelled') return false
        const d = new Date(ev.event_date)
        return d >= today && d <= cutoff
      })
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .slice(0, 8)
  }, [allEvents])

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const monthLabel = viewDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  function prev() { setViewDate(new Date(year, month - 1, 1)) }
  function next() { setViewDate(new Date(year, month + 1, 1)) }
  function goToday() { setViewDate(new Date(now.getFullYear(), now.getMonth(), 1)) }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gold">Calendar</h1>
        <div className="flex items-center gap-2">
          <button onClick={prev}
            className="p-2 rounded-lg bg-navy-lighter text-cream/60 hover:text-gold transition-colors">
            <ChevronLeft size={18} />
          </button>
          <span className="text-cream font-semibold min-w-[160px] text-center">{monthLabel}</span>
          <button onClick={next}
            className="p-2 rounded-lg bg-navy-lighter text-cream/60 hover:text-gold transition-colors">
            <ChevronRight size={18} />
          </button>
          <button onClick={goToday}
            className="px-3 py-1.5 rounded-lg text-sm bg-navy-lighter text-cream/60 hover:text-gold transition-colors">
            Today
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar grid — 3/4 width */}
        <div className="lg:col-span-3">
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_LABELS.map(d => (
              <div key={d} className="text-center text-xs text-cream/30 uppercase tracking-wider py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} className="min-h-[90px] rounded-lg" />
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEvents = eventsByDate[dateStr] || []
              const isToday = dateStr === todayStr
              const isPast = dateStr < todayStr

              return (
                <div
                  key={dateStr}
                  className={`min-h-[90px] p-1.5 rounded-lg border transition-colors ${
                    isToday
                      ? 'border-gold/60 bg-gold/5'
                      : 'border-transparent bg-navy-light/40 hover:border-white/10'
                  }`}
                >
                  <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-gold text-navy font-bold'
                      : isPast
                      ? 'text-cream/30'
                      : 'text-cream/60'
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map(ev => (
                      <button
                        key={ev.id}
                        onClick={() => navigate(`/events/${ev.id}`)}
                        className={`w-full text-left text-xs px-1.5 py-0.5 rounded border truncate transition-colors hover:opacity-80 ${
                          STATUS_COLORS[ev.status] || STATUS_COLORS.draft
                        }`}
                        title={`${ev.event_name || ev.client_name} — ${ev.status}`}
                      >
                        {ev.event_name || ev.client_name}
                      </button>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-cream/30 px-1">+{dayEvents.length - 2}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-cream/40">
            {[
              { status: 'draft', label: 'Draft' },
              { status: 'signed', label: 'Signed' },
              { status: 'deposit_paid', label: 'Deposit Paid' },
              { status: 'paid_full', label: 'Paid in Full' },
              { status: 'cancelled', label: 'Cancelled' },
            ].map(({ status, label }) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded border ${STATUS_COLORS[status]}`} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming sidebar — 1/4 width */}
        <div className="space-y-4">
          <div>
            <h3 className="text-xs text-cream/40 uppercase tracking-wider mb-3 flex items-center gap-2">
              <CalendarDays size={13} /> Next 60 Days
            </h3>
            {upcomingEvents.length === 0 ? (
              <p className="text-cream/30 text-sm">No upcoming events</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(ev => {
                  const d = new Date(ev.event_date)
                  const dayOfWeek = d.toLocaleString('en-US', { weekday: 'short' })
                  const dayMonth = d.toLocaleString('en-US', { month: 'short', day: 'numeric' })
                  return (
                    <button
                      key={ev.id}
                      onClick={() => navigate(`/events/${ev.id}`)}
                      className="w-full text-left p-3 rounded-lg bg-navy-lighter hover:border-gold/30 border border-transparent transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <div className="text-center min-w-[36px]">
                          <div className="text-xs text-cream/40">{dayOfWeek}</div>
                          <div className="text-sm font-bold text-gold">{dayMonth.split(' ')[1]}</div>
                          <div className="text-xs text-cream/40">{dayMonth.split(' ')[0]}</div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-cream truncate">
                            {ev.event_name || ev.client_name}
                          </p>
                          <p className="text-xs text-cream/40 truncate">{ev.client_name}</p>
                          <p className="text-xs text-gold/60 mt-0.5">{formatCurrency(ev.total_amount)}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
