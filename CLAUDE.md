# 513Sips Books — CLAUDE.md

> ## 👉 READ `AGENTS.md` IN THIS REPO FIRST
> It is the shared contract for **all** AI tools (Claude Code, Codex, ChatGPT).
> It carries Rule 0 (review recent commits before any new work), the commit
> tagging convention, branch rules, the QA gate rule, writing conventions and
> the 513Sips color palette. This file holds Claude-specific notes only and
> defers to `AGENTS.md` on anything shared.

> Vault path & global context: `~/.claude/CLAUDE.md`
> Project-wide 513Sips context: `../CLAUDE.md`

## This Repo
- **Repo:** `Egady513/513sips-books-deploy`
- **Stack:** React + TypeScript + Vite + Supabase (PostgreSQL)
- **Purpose:** Finance/CRM app — invoicing, expenses, client leads, AP tracking

## ⚠️ Critical Build Rule
`npm run build` before EVERY commit. Not `tsc --noEmit`. CI enforces `noUnusedLocals` — build failures = broken deploy.

## Supabase Data
Client CRM, income/expenses, AP bills, mileage, contracts, quotes, vendor contacts.

## Accounting Model
Accrual-basis (locked 2026-04-24). Expense + AP = two sides of same transaction, not double-counting.

## Stale Copy Warning
`513sips-tools/books/` is stale — ignore it. This repo only.

## Skill: `513sips-books`
