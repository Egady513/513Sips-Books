export interface QuotePdfLead {
  name: string
  email?: string
  phone?: string
  event_date?: string
  event_type?: string
  guest_count?: number
  venue_name?: string
  venue_address?: string
  service_start_time?: string
  service_end_time?: string
  number_of_events?: number
}

export interface QuotePdfQuote {
  total: number
  deposit: number
  balance: number
  guest_count?: number
  hours?: number
  bartenders?: number
  breakdown?: unknown
  promo_code?: string | null
  addon_notes?: string | null
  valid_until?: string
}

interface BuildQuotePdfHtmlOptions {
  lead: QuotePdfLead
  quote: QuotePdfQuote
  today: Date
}

export function buildQuotePdfHtml({ lead, quote, today }: BuildQuotePdfHtmlOptions): string {
  const preparedDate = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const fmt = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const escapeHtml = (value: string) => value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
  const validUntilStr = quote.valid_until
    ? new Date(quote.valid_until + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null
  const dateSubtitle = `Prepared ${preparedDate}${validUntilStr ? ` · Valid until ${validUntilStr}` : ''}`

  // Shared helper: convert a breakdown object into HTML rows
  function buildBdRows(bd: Record<string, unknown> | null): string {
    if (!bd) return ''
    let rows = ''
    const base = typeof bd.base === 'number' ? bd.base : 650
    // hours/bartenders are carried on the breakdown so quote lines can show WHAT was
    // bought — "4 hrs × 1 bartender". Deliberately NOT the rate: printing "$15/hr"
    // invites the client to do arithmetic against the line. Same reasoning as the
    // glassware line, where we stopped printing the unit count (Decision-Log 2026-08-07).
    // Quotes saved before 2026-08-12 lack these fields — those lines degrade to a bare
    // label rather than guessing.
    const qHours = typeof bd.hours === 'number' ? bd.hours : null
    const qStaff = typeof bd.bartenders === 'number' ? bd.bartenders : null
    const qFullBarStaff = typeof bd.fullBarStaffCount === 'number' ? bd.fullBarStaffCount : qStaff
    const qBaseHours = bd.base === 395 ? 2 : 3
    const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`
    rows += `<div class="brow"><span>${bd.base === 395 ? 'Base: Small Group (1 bartender, first 2 hrs, ≤20 guests)' : 'Base Package (1 bartender, first 3 hrs, ≤50 guests)'}</span><span>${fmt(base)}</span></div>`
    if (typeof bd.staffing === 'number' && bd.staffing > 0) {
      const additionalStaff = qStaff !== null ? Math.max(0, qStaff - 1) : null
      const detail = additionalStaff !== null
        ? ` (${plural(additionalStaff, 'additional bartender')}, first ${qBaseHours} hrs)`
        : ''
      rows += `<div class="brow"><span>Additional Bartenders${detail}</span><span>+${fmt(bd.staffing)}</span></div>`
    }
    const extraHoursCharge = typeof bd.extraHours === 'number' && bd.extraHours > 0 ? bd.extraHours : 0
    const longEventCharge = typeof bd.longEventPremium === 'number' && bd.longEventPremium > 0 ? bd.longEventPremium : 0
    if (extraHoursCharge + longEventCharge > 0) {
      const extra = qHours !== null ? qHours - qBaseHours : 0
      const detail = qStaff !== null && extra > 0
        ? ` (+${plural(extra, 'hr')} × ${plural(qStaff, 'bartender')})`
        : ''
      const label = longEventCharge > 0
        ? 'Extended Service Hours, including long-event premium'
        : 'Extended Service Hours'
      rows += `<div class="brow"><span>${label}${detail}</span><span>+${fmt(extraHoursCharge + longEventCharge)}</span></div>`
    }
    if (typeof bd.twoHrReduction === 'number' && bd.twoHrReduction > 0)
      rows += `<div class="brow green"><span>2-Hour Service Reduction</span><span>-${fmt(bd.twoHrReduction)}</span></div>`
    if (typeof bd.package === 'number' && bd.package > 0) {
      const detail = qHours !== null && qFullBarStaff !== null && qHours > 0
        ? ` (${plural(qHours, 'hr')} × ${plural(qFullBarStaff, 'bartender')})`
        : ''
      rows += `<div class="brow"><span>Full Bar Service${detail}</span><span>+${fmt(bd.package)}</span></div>`
    }
    if (typeof bd.cocktails === 'number' && bd.cocktails > 0) {
      const count = typeof bd.signatureCocktailCount === 'number'
        ? bd.signatureCocktailCount
        : Math.round(bd.cocktails / 125)
      rows += `<div class="brow accent"><span>Signature Cocktails (${count})</span><span>+${fmt(bd.cocktails)}</span></div>`
    }
    if (typeof bd.houseCocktails === 'number' && bd.houseCocktails > 0) {
      const count = typeof bd.houseCocktailCount === 'number'
        ? bd.houseCocktailCount
        : Math.round(bd.houseCocktails / 50)
      rows += `<div class="brow accent"><span>House Featured Cocktails (${count})</span><span>+${fmt(bd.houseCocktails)}</span></div>`
    }
    if (typeof bd.cocktailProgram === 'number' && bd.cocktailProgram > 0) {
      const label = typeof bd.featuredCocktailCount === 'number' && bd.featuredCocktailCount >= 8
        ? 'Extensive Featured Cocktail Program'
        : 'Expanded Featured Cocktail Program'
      rows += `<div class="brow accent"><span>${label}</span><span>+${fmt(bd.cocktailProgram)}</span></div>`
    }
    if (typeof bd.volume === 'number' && bd.volume > 0)
      rows += `<div class="brow"><span>High-Volume Event Adjustment</span><span>+${fmt(bd.volume)}</span></div>`
    if (typeof bd.multiBarOperations === 'number' && bd.multiBarOperations > 0)
      rows += `<div class="brow"><span>Large Event &amp; Multi-Bar Operations</span><span>+${fmt(bd.multiBarOperations)}</span></div>`
    if (typeof bd.addons === 'number' && bd.addons > 0) {
      const addOnLabels = Array.isArray(bd.addonsList) ? bd.addonsList as string[] : []
      const label = addOnLabels.length === 1 ? escapeHtml(addOnLabels[0]) : 'Premium Add-Ons'
      const detail = addOnLabels.length > 1 ? ` (${addOnLabels.map(escapeHtml).join(', ')})` : ''
      rows += `<div class="brow accent"><span>${label}${detail}</span><span>+${fmt(bd.addons)}</span></div>`
    }
    if (typeof bd.glassware === 'number' && bd.glassware > 0)
      rows += `<div class="brow accent"><span>Premium Glassware</span><span>+${fmt(bd.glassware)}</span></div>`
    if (typeof bd.travel === 'number' && bd.travel > 0)
      rows += `<div class="brow"><span>Travel Fee</span><span>+${fmt(bd.travel)}</span></div>`
    const customItems = Array.isArray(bd.customItems)
      ? (bd.customItems as unknown[]).flatMap((item) => {
          if (!item || typeof item !== 'object') return []
          const candidate = item as Record<string, unknown>
          const price = typeof candidate.price === 'number' ? candidate.price : 0
          if (price <= 0) return []
          const name = typeof candidate.name === 'string' && candidate.name.trim()
            ? candidate.name.trim()
            : 'Custom Add-On'
          return [{ name, price }]
        })
      : []
    if (customItems.length > 0) {
      customItems.forEach((item) => {
        rows += `<div class="brow accent"><span>${escapeHtml(item.name)}</span><span>+${fmt(item.price)}</span></div>`
      })
    } else if (typeof bd.customItemsTotal === 'number' && bd.customItemsTotal > 0) {
      rows += `<div class="brow accent"><span>Custom Add-Ons</span><span>+${fmt(bd.customItemsTotal)}</span></div>`
    }
    return rows
  }

  function buildCreditBox(bd: Record<string, unknown> | null, promoCode?: string | null): string {
    if (!bd) return ''
    const credits: Array<{ label: string; amount: number }> = []
    if (typeof bd.discount === 'number' && bd.discount > 0) {
      credits.push({ label: promoCode ?? 'Promo Discount', amount: bd.discount })
    }
    if (typeof bd.customDiscount === 'number' && bd.customDiscount > 0) {
      credits.push({
        label: typeof bd.customDiscountLabel === 'string' && bd.customDiscountLabel.trim()
          ? bd.customDiscountLabel.trim()
          : 'Custom Discount',
        amount: bd.customDiscount,
      })
    }
    if (credits.length === 0) return ''
    const rows = credits.map(credit => `
      <div class="credit-row">
        <span><strong>${escapeHtml(credit.label)}</strong><small>Applied to this estimate</small></span>
        <span>-${fmt(credit.amount)}</span>
      </div>`).join('')
    return `<div class="credit-box">${rows}</div>`
  }

  // Multi-event with per-event breakdowns (saved after 2026-05-04)
  const isRichMultiEvent = Array.isArray(quote.breakdown) && (quote.breakdown as unknown[]).length > 1

  let bodyHTML = ''

  // 14-day payment logic (shared by both single and multi-event branches)
  const _eventDateObj = lead.event_date ? new Date(lead.event_date + 'T12:00:00') : null
  const _daysUntilEvent = _eventDateObj ? Math.round((_eventDateObj.getTime() - today.getTime()) / 86400000) : null
  const _within14Days = _daysUntilEvent !== null && _daysUntilEvent <= 14
  const _balanceDueDateStr = _eventDateObj
    ? new Date(_eventDateObj.getTime() - 14 * 24 * 60 * 60 * 1000)
        .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null

  if (isRichMultiEvent) {
    type EvtEntry = { name: string; total: number; guestCount?: number; hours?: number; bartenders?: number; bd: Record<string, unknown> | null }
    const events = quote.breakdown as unknown as EvtEntry[]
    const eventSections = events.map(evt => {
      const rows = buildBdRows(evt.bd)
      const creditBox = buildCreditBox(evt.bd)
      const stats = [
        evt.guestCount ? `${evt.guestCount} Guests` : null,
        evt.hours ? `${evt.hours} Hrs` : null,
        evt.bartenders ? `${evt.bartenders} Bartender${evt.bartenders > 1 ? 's' : ''}` : null,
      ].filter(Boolean).join(' · ')
      return `
      <div class="evt-block">
        <div class="evt-block-header">
          <span class="evt-block-name">${evt.name}</span>
          ${stats ? `<span class="evt-block-stats">${stats}</span>` : ''}
        </div>
        <div class="evt-block-total-label">ESTIMATED TOTAL</div>
        <div class="evt-block-total-amt">${fmt(evt.total)}</div>
        ${rows ? `<div class="breakdown" style="border-radius:0;border-left:none;border-right:none;border-bottom:none">${rows}</div>` : ''}
        ${creditBox}
      </div>`
    }).join('')

    bodyHTML = `
<div class="section">
<div class="section-title">Quote Summary</div>
${eventSections}
<div class="totals" style="margin-top:16px">
  ${_within14Days ? '' : `<div class="trow total"><span>Total Event Investment</span><span>${fmt(quote.total)}</span></div>`}
  ${_within14Days
    ? `<div class="trow total"><span>Full Balance Due to Secure Date</span><span>${fmt(quote.total)}</span></div>`
    : `<div class="trow"><span>Deposit Due Now (50%)</span><span>${fmt(quote.deposit)}</span></div>
  <div class="trow"><span>Balance Due${_balanceDueDateStr ? ' by ' + _balanceDueDateStr : ' (14 days prior to event)'}</span><span>${fmt(quote.balance)}</span></div>`
  }
</div>
</div>`

  } else {
    // Single event (or legacy multi-event without per-event breakdowns)
    const eventDate = lead.event_date
      ? new Date(lead.event_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : 'TBD'
    const numEvents = lead.number_of_events ?? 1

    // 14-day payment logic
    const eventDateObj = lead.event_date ? new Date(lead.event_date + 'T12:00:00') : null
    const daysUntilEvent = eventDateObj ? Math.round((eventDateObj.getTime() - today.getTime()) / 86400000) : null
    const within14Days = daysUntilEvent !== null && daysUntilEvent <= 14
    const balanceDueDateStr = eventDateObj
      ? new Date(eventDateObj.getTime() - 14 * 24 * 60 * 60 * 1000)
          .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : null
    const paymentRows = within14Days
      ? `<div class="trow total"><span>Full Balance Due to Secure Date</span><span>${fmt(quote.total)}</span></div>`
      : `<div class="trow"><span>Deposit (50% — due to secure date)</span><span>${fmt(quote.deposit)}</span></div>
  <div class="trow"><span>Balance Due${balanceDueDateStr ? ' by ' + balanceDueDateStr : ' (14 days prior to event)'}</span><span>${fmt(quote.balance)}</span></div>`

    // Legacy multi-event fallback (old addon_notes-only format)
    let eventPkgBlock = ''
    if (numEvents > 1 && quote.addon_notes) {
      const lines = quote.addon_notes.split('\n').filter((l: string) => l.trim())
      const eventRows = lines.map((line: string) => {
        const match = line.match(/^(.+?):\s*\$?([\d,]+(?:\.\d{0,2})?)$/)
        if (match) {
          const [, name, amount] = match
          return `<div class="evt-row"><span class="evt-name">${name.trim()}</span><span class="evt-amt">${fmt(parseFloat(amount.replace(/,/g, '')))}</span></div>`
        }
        return `<div class="evt-row"><span class="evt-name">${line}</span><span class="evt-amt"></span></div>`
      }).join('')
      eventPkgBlock = `
      <div class="evt-pkg">
        <div class="evt-pkg-header">📋 ${numEvents}-Event Package Breakdown</div>
        ${eventRows}
        <div class="evt-subtotal"><span>${numEvents} events included</span><span style="font-weight:700;color:#b87333">${fmt(quote.total)} combined</span></div>
      </div>`
    }

    const bd = (!Array.isArray(quote.breakdown) && quote.breakdown && typeof quote.breakdown === 'object')
      ? quote.breakdown as Record<string, unknown>
      : null
    const breakdownRows = buildBdRows(bd)
    const creditBox = buildCreditBox(bd, quote.promo_code)
    const clientNotes = bd && typeof bd.clientNotes === 'string'
      ? bd.clientNotes.split(/\r?\n/).map(note => note.trim()).filter(Boolean)
      : []
    const quoteContext = clientNotes.length > 0
      ? `<div class="quote-context">
          <div class="assumption-title">Service Plan &amp; Assumptions</div>
          <ul>${clientNotes.map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul>
        </div>`
      : ''

    bodyHTML = `
<div class="section">
<div class="section-title">Client Information</div>
<div class="grid">
  <div class="field"><span class="label">Client Name</span><span class="value">${lead.name}</span></div>
  <div class="field"><span class="label">Event Type</span><span class="value">${lead.event_type || '—'}</span></div>
  <div class="field"><span class="label">Email</span><span class="value">${lead.email || '—'}</span></div>
  <div class="field"><span class="label">Phone</span><span class="value">${lead.phone || '—'}</span></div>
</div>
</div>
<div class="section">
<div class="section-title">Event Details</div>
<div class="grid">
  <div class="field"><span class="label">Event Date</span><span class="value">${eventDate}</span></div>
  <div class="field"><span class="label">Venue</span><span class="value">${lead.venue_name || lead.venue_address || '—'}</span></div>
  <div class="field"><span class="label">Guest Count</span><span class="value">${lead.guest_count ?? quote.guest_count ?? '—'}</span></div>
  <div class="field"><span class="label">Service Hours</span><span class="value">${quote.hours ?? 3} hours</span></div>
  ${lead.service_start_time ? `<div class="field"><span class="label">Service Time</span><span class="value">${lead.service_start_time}${lead.service_end_time ? ' – ' + lead.service_end_time : ''}</span></div>` : ''}
  ${quote.bartenders ? `<div class="field"><span class="label">Bar Staff</span><span class="value">${quote.bartenders} bartender${(quote.bartenders as number) > 1 ? 's' : ''}</span></div>` : ''}
  ${numEvents > 1 ? `<div class="field" style="grid-column:1/-1"><span class="label">Package</span><span class="value">${numEvents}-Event Package</span></div>` : ''}
</div>
</div>
<div class="section">
<div class="section-title">Pricing</div>
${quoteContext}
${eventPkgBlock}
${breakdownRows ? `<div class="breakdown">${breakdownRows}</div>` : ''}
${creditBox}
<div class="totals" style="${breakdownRows || eventPkgBlock || creditBox ? 'margin-top:12px' : ''}">
  ${within14Days ? '' : `<div class="trow total"><span>Total Investment</span><span>${fmt(quote.total)}</span></div>`}
  ${paymentRows}
</div>
</div>`
  }

  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>513 Sips Quote — ${lead.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&amp;family=Montserrat:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Montserrat,Arial,sans-serif;color:#2d3748;background:#fff;padding:24px 40px;max-width:720px;margin:0 auto}
.header{text-align:center;border-bottom:3px solid #b87333;padding-bottom:10px;margin-bottom:4px}
.brand{font-family:'Cormorant Garamond',Georgia,serif;font-size:32px;color:#b87333;font-weight:700;letter-spacing:3px}
.doc-date{text-align:center;color:#6b7280;font-size:9px;margin-bottom:12px}
.section{margin:10px 0}
.section-title{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#b87333;border-bottom:1px solid #d4915a;padding-bottom:4px;margin-bottom:8px;font-weight:600}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 32px}
.field{display:flex;flex-direction:column}
.label{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;margin-bottom:2px}
.value{font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;font-weight:600;color:#1a1a2e}
.breakdown{border:1px solid #e0c2a8;border-radius:8px;overflow:hidden;margin-top:8px}
.quote-context{background:#f5f2eb;border:1px solid #e0c2a8;border-radius:8px;padding:10px 14px;margin-bottom:10px}
.assumption-title{font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:#b87333;font-weight:700;margin:0 0 4px}
.quote-context ul{margin:0 0 0 17px;padding:0;font-size:10px;line-height:1.45;color:#2d3748}
.brow{display:flex;justify-content:space-between;padding:5px 14px;border-bottom:1px solid #f0e8d0;font-size:12px}
.brow:last-child{border-bottom:none}
.brow.accent{color:#9a5728}
.brow.green{color:#2e7d32}
.credit-box{background:#f5f2eb;border:1px solid #b87333;border-radius:8px;margin-top:10px;overflow:hidden}
.credit-row{display:flex;justify-content:space-between;align-items:center;padding:9px 14px;color:#1a1a2e;font-size:12px}
.credit-row+ .credit-row{border-top:1px solid #e0c2a8}
.credit-row small{display:block;color:#6b7280;font-size:8px;text-transform:uppercase;letter-spacing:.8px;margin-top:2px}
.credit-row>span:last-child{font-family:'Cormorant Garamond',Georgia,serif;color:#2e7d32;font-size:18px;font-weight:700}
.evt-pkg{background:#f5f2eb;border:2px solid #b87333;border-radius:8px;overflow:hidden;margin-bottom:16px}
.evt-pkg-header{background:#b87333;color:#f5f2eb;font-size:11px;text-transform:uppercase;letter-spacing:2px;font-weight:700;padding:8px 16px}
.evt-row{display:flex;justify-content:space-between;align-items:center;padding:11px 16px;border-bottom:1px solid #e0c2a8;font-size:14px}
.evt-row:last-child{border-bottom:none}
.evt-row .evt-name{font-weight:600;color:#1a1a2e}
.evt-row .evt-amt{font-weight:700;color:#9a5728;font-size:15px}
.evt-subtotal{display:flex;justify-content:space-between;padding:10px 16px;background:#eee5dc;font-size:13px;color:#2d3748;border-top:1px solid #e0c2a8}
.evt-block{border:2px solid #b87333;border-radius:8px;overflow:hidden;margin-bottom:12px}
.evt-block-header{background:#b87333;display:flex;justify-content:space-between;align-items:center;padding:8px 14px}
.evt-block-name{color:#f5f2eb;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase}
.evt-block-stats{color:#f5f2eb;font-size:10px;font-weight:600;letter-spacing:0.5px}
.evt-block-total-label{text-align:center;font-size:9px;letter-spacing:2px;color:#6b7280;text-transform:uppercase;padding:6px 16px 0}
.evt-block-total-amt{text-align:center;font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;color:#1a1a2e;font-weight:700;padding-bottom:6px}
.totals{border:1px solid #e0c2a8;border-radius:8px;overflow:hidden}
.trow{display:flex;justify-content:space-between;align-items:center;padding:7px 14px;border-bottom:1px solid #f0e8d0;font-size:12px}
.trow:last-child{border-bottom:none}
.trow.total{background:#1a1a2e;color:#f5f2eb;font-weight:600}
.trow.total span:last-child{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;color:#d4915a;font-weight:700}
.footer{text-align:center;margin-top:16px;padding-top:10px;border-top:1px solid #eee;font-size:9px;color:#6b7280}
@media print{body{padding:16px 32px}}
</style></head>
<body>
<div class="header">
<div class="brand">513 SIPS</div>
</div>
<div class="doc-date">${dateSubtitle}</div>
${bodyHTML}
<div class="footer">513 Sips LLC · Cincinnati, OH · 513sips.com · instagram.com/513sips</div>
<script>window.onload=async()=>{if(document.fonts?.ready)await document.fonts.ready;window.print()}</script>
</body></html>`

  return html
}

