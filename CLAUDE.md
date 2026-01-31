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

Single-page Next.js 15 (App Router) application that fetches blockchain transaction history via BlockScout API and exports it as Awaken Tax-compatible CSV. Uses React 19, TypeScript (strict), and Tailwind CSS v4.

### Data Flow

User selects chain → enters wallet address → app fetches paginated transaction history directly from BlockScout API (client-side, no proxy needed) → merges normal/token/internal txs by hash via `lib/blockscout.ts` → transforms to CSV rows via `lib/csv.ts` → displays in table and offers download.

### Key Directories

- `app/` — Next.js App Router: root layout and main page
- `components/` — React components: ChainSelector, AddressInput, TransactionTable, DownloadButton
- `lib/` — Business logic: `types.ts` (BlockScout + merged transaction interfaces), `chains.ts` (dynamic chain list fetched from chainscout), `csv.ts` (Awaken Tax CSV formatting with BigInt fee calc), `blockscout.ts` (API client with page-based pagination and rate limiting)
- `docs/SPEC.md` — Full specification including bounty details and CSV format requirements

### Supported Chains

40+ EVM mainnet chains dynamically loaded from the [BlockScout chainscout registry](https://github.com/blockscout/chainscout). Chain list is fetched at runtime from `chains.json` and filtered to mainnets with blockscout-hosted explorers.

### CSV Export Format

Awaken Tax format with columns: date, receivedAmount, receivedCurrency, sentAmount, sentCurrency, feeAmount, feeCurrency, tag. Tags derived from transaction analysis (Transfer, Trade, Contract, Failed, Approval, Wrap) in `lib/csv.ts`.

## Style

Light warm-toned theme. Custom accent color #C85A3E. Path alias `@/*` maps to project root.
