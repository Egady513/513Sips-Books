# 513Sips Books — Pre-Push Checklist

> **ALWAYS run this before pushing to main.** CI enforces `tsc -b` with `noUnusedLocals` — a local TypeScript check passes even when the build fails.

## Before Every Push

```bash
npm run build
```

That's it. If it passes, push. If it fails, fix first. Do not use `tsc --noEmit` alone — it misses build-time errors.

---

## Repo Structure

| Path | Purpose |
|------|---------|
| `src/pages/` | React pages (LeadsPage, EventsPage, Dashboard, etc.) |
| `src/hooks/` | React Query data hooks (Supabase queries/mutations) |
| `src/lib/types.ts` | Single source of truth for all TypeScript interfaces |
| `src/components/` | Shared UI components |
| `supabase-migration.sql` | All schema changes — run in Supabase SQL Editor |
| `.github/workflows/deploy.yml` | CI: builds + deploys to GitHub Pages on push to main |

## Key Rules

1. **Quote PDFs are generated from Books** (Leads page → Download PDF). The calculator at `513sips.com/tools/calculator.html` is a pricing estimator only — it does not own quote generation.
2. **Schema changes**: always append to `supabase-migration.sql` AND run in Supabase before pushing.
3. **Build before commit**: `npm run build` — not `tsc --noEmit`.
4. **Types**: update `src/lib/types.ts` first, then hooks, then pages.

## Common Errors

### `error TS2739: Type '{}' is missing properties`
A type interface was updated but the hook/page still returns the old shape. Fix the data layer to match the new interface.

### Build passes locally but CI fails
You likely have uncommitted changes in a hook or component that satisfy the type check locally but weren't staged. Stage everything and rebuild.

## Deployment

- Push to `main` → GitHub Actions auto-deploys to GitHub Pages
- URL: https://egady513.github.io/513Sips-Books/
- Supabase keys must be set as GitHub Secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **DO NOT edit** `513sips-tools/books/` — that is an archived copy. Books lives here only.
