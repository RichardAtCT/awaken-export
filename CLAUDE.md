# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Dev server at localhost:3000
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

No test framework is configured.

## Architecture

Single-page Next.js 15 (App Router) application that fetches blockchain transaction history via Moralis API and exports it as Awaken Tax-compatible CSV. Uses React 19, TypeScript (strict), and Tailwind CSS v4.

### Data Flow

User enters Moralis API key (stored in localStorage) → selects chain → enters wallet address → app fetches paginated transaction history through `/app/api/transactions/route.ts` (server-side proxy to avoid CORS) → transforms to CSV rows via `lib/csv.ts` → displays in table and offers download.

### Key Directories

- `app/` — Next.js App Router: root layout, main page, and `/api/transactions` proxy route
- `components/` — React components: ApiKeyInput, ChainSelector, AddressInput, TransactionTable, DownloadButton
- `lib/` — Business logic: `types.ts` (transaction/transfer interfaces), `chains.ts` (5 chain configs), `csv.ts` (Awaken Tax CSV formatting with BigInt fee calc), `moralis.ts` (API client with cursor pagination), `storage.ts` (localStorage helpers)
- `docs/SPEC.md` — Full specification including bounty details and CSV format requirements

### Supported Chains

Chiliz, Cronos, Moonbeam, Moonriver, Lisk — EVM chains not natively supported by Awaken Tax. Each defined in `lib/chains.ts` with chain ID, symbol, and decimals.

### CSV Export Format

Awaken Tax format with columns: date, receivedAmount, receivedCurrency, sentAmount, sentCurrency, feeAmount, feeCurrency, tag. Transaction categories from Moralis map to tags (send/receive→Transfer, swap→Trade, etc.) in `lib/csv.ts`.

## Style

Dark theme with glass-morphism UI. Custom CSS variables (`--color-glass`, `--color-glass-border`, `--color-glass-hover`) defined in `app/globals.css`. Indigo-to-violet gradient accents. Path alias `@/*` maps to project root.
