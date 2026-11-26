# Editing a saved quote

A saved or sent quote keeps its stored price until Eddie chooses to replace it. Opening the edit screen, changing names or notes and using **Save details** do not change the total, deposit, balance, validity date or version history.

The edit screen has three actions:

- **Save details** saves event name, quote option name and client notes when no price-relevant input changed. It keeps the saved price and pricing breakdown.
- **Save new price** appears after a price-relevant input changes. It shows a confirmation with the old total, new total, difference and deposit change before writing.
- **Re-quote with current prices** applies today’s pricing rules to unchanged inputs. It uses the same confirmation and only writes after Eddie confirms.

Every confirmed new price preserves the quote status, refreshes the three-calendar-month validity date and appends one version history entry. The updated calculator `_config` remains compatible with the website calculator.

This slice does not include multi-event editing or PDF changes.
