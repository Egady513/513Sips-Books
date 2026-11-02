# Books quote screen

Books now has a single-event quote builder at `/quotes/new`. It accepts the same pricing inputs as the website calculator, shows a live typed-engine breakdown and inserts a draft quote linked to a lead. `/quotes/:id` is a read-only view of the stored price, line items, validity and version history.

The saved record includes the legacy calculator breakdown and a `_config` snapshot. The website calculator can open that record by `quote_id`, restore `_config` and continue its existing workflow. Quotes created by the website also open in the Books saved view because it can read the legacy breakdown without an engine snapshot.

Saved prices are authoritative. Opening a saved quote never recalculates it and never writes to it. The $7,131 saved Evers HIGH quote therefore remains $7,131 even though current pricing rules would calculate $7,206.

This slice does not add editing, re-quoting with current prices, multi-event quote building or PDF changes. The existing website calculator remains available beside the Books entry points.
