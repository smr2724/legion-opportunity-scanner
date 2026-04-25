# Legion Opportunity Scanner

An internal tool for finding **Legion-like Amazon opportunities** — ignored, boring, industrial/commercial categories where real demand exists, competition is weak, no clear winner owns the category, and a genuinely superior product could win.

Built for Steve Rolle. Modeled after the Legion Chemicals concrete remover playbook.

## What it does

1. Enter a seed keyword (e.g. `concrete remover`)
2. Pulls Amazon keyword + SERP data (DataForSEO)
3. Enriches top ASINs (Keepa)
4. Calculates a **Legion Score / 100** weighted across Demand / Competition Weakness / Product Advantage / Visual Demo / Economics / Partner Availability
5. Generates a skeptical operator memo (OpenAI)
6. Forces a decision: **Reject / Watchlist / Deep Dive / Find Manufacturers / Outreach Ready / Active Deal**

## Stack

- Next.js 14 (App Router) + TypeScript + Tailwind
- Supabase (auth + Postgres with RLS)
- Vercel hosting
- DataForSEO + Keepa + OpenAI

## Local dev

```bash
cp .env.local.example .env.local
# fill in values
npm install
npm run dev
```

App works without DataForSEO/Keepa/OpenAI keys — it falls back to deterministic mock data so you can test the full workflow.

## Schema

See `supabase/migrations/0001_initial_schema.sql` and `0002_rls_policies.sql`.

## Scoring weights

| Component                  | Max |
|----------------------------|-----|
| Demand                     | 20  |
| Competition Weakness       | 20  |
| Product Advantage          | 20  |
| Visual Demo / Content      | 15  |
| Economics                  | 15  |
| Partner / Acquisition      | 10  |
| **Total**                  | 100 |

- 80–100: Deep Dive immediately
- 65–79: Review
- 50–64: Watchlist
- <50: Reject unless overridden

## Phase 2 (not built yet)

Manufacturer discovery, Apollo/Thomasnet enrichment, outreach email generation, TikTok/content scoring, review mining.
