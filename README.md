# Awaken Export

Export DeFi wallet transaction history to [Awaken Tax](https://awaken.tax) CSV format.

**Live:** https://awaken-export.vercel.app/

## Supported Chains

| Chain | Native Token |
|-------|-------------|
| Chiliz | CHZ |
| Cronos | CRO |
| Moonbeam | GLMR |
| Moonriver | MOVR |
| Lisk | LSK |

## Setup

Requires Node.js 18+ and a [Moralis API key](https://moralis.io/).

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Usage

1. Enter your Moralis API key (stored in browser localStorage)
2. Select a chain
3. Enter a wallet address
4. Review transactions in the table
5. Download the CSV

The API key is sent to Moralis via a backend proxy route and is never stored server-side.

## Awaken CSV Format

The exported CSV uses the following columns:

```
Date, Received Amount, Received Currency, Received Value, Sent Amount, Sent Currency, Sent Value, Fee Amount, Fee Currency, Tag
```

- Dates are formatted as `MM/DD/YYYY HH:MM:SS` UTC
- Gas fees are calculated from `gasPrice × gasUsed` and denominated in the chain's native token
- Each transfer within a transaction produces a separate row
- Tags: Transfer, Trade, NFT, Airdrop, Mint, Burn, Deposit, Withdraw, Contract

## Tech Stack

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS 4
- Moralis API v2.2

## License

MIT
