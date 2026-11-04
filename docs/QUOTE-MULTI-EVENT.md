# Multi-event quotes

Books can build, save, view and edit a quote with several events. The quote screen uses one event form with tabs for switching, adding and removing events. It shows each event price plus the combined total, deposit and balance. The combined payment timing uses the earliest event date that is filled in.

The saved `breakdown` is the array the website calculator already reads. Each event stores `name`, `total`, `guestCount`, `hours`, `bartenders`, `bd` and `_config`. The first array entry also stores the Books `engine` snapshot. The website reader ignores that extra field. Top-level guest, hour and bartender values come from the first event. `promo_code` is `null`, and `addon_notes` contains one event summary per line.

Opening a saved quote only reads stored numbers. Detail-only edits keep every stored price and history entry. A price input change, an added or removed event or an explicit re-quote shows the existing confirmation before replacing the combined price and adding one history entry.

This slice does not test a live database. It does not change PDF generation or add multi-event contract coverage beyond the existing offline PDF branch checks.
