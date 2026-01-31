# Multi-Chain Awaken Tax CSV Exporter

## Overview

A simple web app that exports wallet transaction history to Awaken Tax CSV format for chains not natively supported by Awaken.

**Target Chains:**
| Chain | Chain ID | Moralis ID | Users |
|-------|----------|------------|-------|
| Chiliz | 88888 | 0x15b38 | Sports/fan token holders |
| Cronos | 25 | 0x19 | Crypto.com users |
| Moonbeam | 1284 | 0x504 | Polkadot ecosystem |
| Moonriver | 1285 | 0x505 | Kusama ecosystem |
| Lisk | 1135 | 0x46f | Lisk ecosystem |

**Bounty:** $1,000 USDC per chain = $5,000 potential

---

## User Flow

```
1. User enters their Moralis API key (stored in localStorage)
2. User selects chain from dropdown
3. User pastes wallet address
4. Click "Fetch Transactions"
5. View transactions in table
6. Click "Download CSV" 
7. Upload CSV to Awaken Tax
```

**BYOK (Bring Your Own Key):** Users provide their own free Moralis API key. This avoids rate limits and keeps the app free to host.

---

## Tech Stack

```
Framework:    Next.js 14 (App Router)
Styling:      Tailwind CSS
API:          Moralis Web3 Data API
Hosting:      Vercel (free tier)
```

---

## Project Structure

```
/app
  page.tsx                 # Main UI
/lib
  chains.ts                # Chain config
  moralis.ts               # API client (client-side, uses user's key)
  csv.ts                   # Awaken CSV formatter
  storage.ts               # localStorage for API key
/components
  ApiKeyInput.tsx          # Moralis API key input
  ChainSelector.tsx        # Dropdown
  AddressInput.tsx         # Wallet input
  TransactionTable.tsx     # Results table
  DownloadButton.tsx       # CSV export
```

---

## API

### Moralis Wallet History Endpoint

```
GET https://deep-index.moralis.io/api/v2.2/wallets/{address}/history
```

**Headers:**
```
X-API-Key: {USER_PROVIDED_API_KEY}
```

**Note:** API calls are made client-side using the user's own Moralis API key. No backend required.

### ⚠️ CORS Risk & Fallback Plan

Moralis documentation warns against client-side API key usage. CORS may block browser requests.

**Test first:**
```javascript
fetch('https://deep-index.moralis.io/api/v2.2/wallets/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045/history?chain=0x1&limit=1', {
  headers: { 'X-API-Key': 'YOUR_TEST_KEY' }
}).then(r => console.log('CORS OK:', r.status)).catch(e => console.log('CORS BLOCKED:', e))
```

**If CORS blocks, implement backend proxy:**

```typescript
// app/api/transactions/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get('x-moralis-key')
  const address = request.nextUrl.searchParams.get('address')
  const chain = request.nextUrl.searchParams.get('chain')
  const cursor = request.nextUrl.searchParams.get('cursor')
  
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required' }, { status: 401 })
  }
  
  const url = new URL(`https://deep-index.moralis.io/api/v2.2/wallets/${address}/history`)
  url.searchParams.set('chain', chain!)
  url.searchParams.set('limit', '100')
  if (cursor) url.searchParams.set('cursor', cursor)
  
  const res = await fetch(url.toString(), {
    headers: { 'X-API-Key': apiKey }
  })
  
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
```

Key is passed per-request, never stored.

**Query Params:**
```
chain:          0x15b38 | 0x19 | 0x504 | 0x505 | 0x46f
limit:          100 (max per request)
cursor:         {pagination_cursor}
order:          DESC | ASC
from_date:      ISO 8601 or unix timestamp (optional)
to_date:        ISO 8601 or unix timestamp (optional)
include_internal_transactions: true/false (optional)
nft_metadata:   true/false (optional)
```

**MVP uses:** `chain`, `limit`, `cursor`, `order=DESC`

**Response (simplified):**
```json
{
  "cursor": "...",
  "result": [
    {
      "hash": "0x...",
      "block_timestamp": "2024-01-15T10:30:00.000Z",
      "from_address": "0x...",
      "to_address": "0x...",
      "value": "1000000000000000000",
      "gas_price": "5000000000",
      "receipt_gas_used": "21000",
      "category": "token send",
      "summary": "Sent 1 CRO",
      "erc20_transfers": [...],
      "native_transfers": [
        {
          "from_address": "0x...",
          "to_address": "0x...",
          "value": "1000000000000000000",
          "value_formatted": "1",
          "token_symbol": "CRO",
          "direction": "outgoing"
        }
      ]
    }
  ]
}
```

---

## Awaken CSV Format

**Filename:** `{chain}_{address}_{date}.csv`

**Headers (exact order required):**
```
Date,Received Amount,Received Currency,Received Value,Sent Amount,Sent Currency,Sent Value,Fee Amount,Fee Currency,Tag
```

**Rules:**
- Date format: `MM/DD/YYYY HH:MM:SS` (UTC)
- No negative numbers
- Empty string for null values
- No quotes unless value contains comma

**Example Row:**
```
01/15/2024 10:30:00,,,1,CRO,,0.000105,CRO,Transfer
```

---

## Data Mapping

| Awaken Field | Source | Transform |
|--------------|--------|-----------|
| Date | `block_timestamp` | Format to `MM/DD/YYYY HH:MM:SS` |
| Received Amount | `native_transfers` or `erc20_transfers` | Where `direction === "incoming"` |
| Received Currency | `token_symbol` | As-is |
| Received Value | - | Leave empty (user fills in Awaken) |
| Sent Amount | `native_transfers` or `erc20_transfers` | Where `direction === "outgoing"` |
| Sent Currency | `token_symbol` | As-is |
| Sent Value | - | Leave empty |
| Fee Amount | `gas_price * receipt_gas_used / 10^18` | Calculate |
| Fee Currency | Chain native token | From chain config |
| Tag | `category` | Map to Awaken tags |

**Category Mapping:**
```typescript
const TAG_MAP = {
  "send": "Transfer",
  "receive": "Transfer", 
  "token send": "Transfer",
  "token receive": "Transfer",
  "token swap": "Trade",
  "nft send": "NFT",
  "nft receive": "NFT",
  "airdrop": "Airdrop",
  "mint": "Mint",
  "burn": "Burn",
  "deposit": "Deposit",
  "withdraw": "Withdraw",
  "contract interaction": "Contract"
}
```

---

## Chain Config

```typescript
// lib/chains.ts
export const CHAINS = {
  chiliz: {
    id: "0x15b38",
    name: "Chiliz",
    symbol: "CHZ",
    decimals: 18
  },
  cronos: {
    id: "0x19", 
    name: "Cronos",
    symbol: "CRO",
    decimals: 18
  },
  moonbeam: {
    id: "0x504",
    name: "Moonbeam", 
    symbol: "GLMR",
    decimals: 18
  },
  moonriver: {
    id: "0x505",
    name: "Moonriver",
    symbol: "MOVR", 
    decimals: 18
  },
  lisk: {
    id: "0x46f",
    name: "Lisk",
    symbol: "LSK",
    decimals: 18
  }
}
```

---

## Core Functions

### Fetch Transactions

```typescript
// lib/moralis.ts
async function fetchTransactions(
  address: string, 
  chainId: string,
  apiKey: string
): Promise<Transaction[]> {
  const transactions = []
  let cursor = null
  
  do {
    const res = await fetch(
      `https://deep-index.moralis.io/api/v2.2/wallets/${address}/history?chain=${chainId}&limit=100${cursor ? `&cursor=${cursor}` : ''}`,
      { headers: { 'X-API-Key': apiKey } }
    )
    
    if (!res.ok) {
      if (res.status === 401) throw new Error('Invalid API key')
      throw new Error(`API error: ${res.status}`)
    }
    
    const data = await res.json()
    transactions.push(...data.result)
    cursor = data.cursor
  } while (cursor)
  
  return transactions
}
```

### Store API Key

```typescript
// lib/storage.ts
const API_KEY_STORAGE = 'moralis_api_key'

export function getApiKey(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(API_KEY_STORAGE)
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE, key)
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE)
}
```

### Generate CSV

```typescript
// lib/csv.ts
function toAwakenCSV(
  transactions: Transaction[], 
  chain: ChainConfig
): string {
  const header = "Date,Received Amount,Received Currency,Received Value,Sent Amount,Sent Currency,Sent Value,Fee Amount,Fee Currency,Tag"
  
  const rows = transactions.map(tx => {
    const date = formatDate(tx.block_timestamp)
    const fee = calculateFee(tx.gas_price, tx.receipt_gas_used)
    const { received, sent } = parseTransfers(tx, chain)
    const tag = TAG_MAP[tx.category] || ""
    
    return [
      date,
      received.amount || "",
      received.currency || "",
      "", // received value - user fills in
      sent.amount || "",
      sent.currency || "",
      "", // sent value - user fills in  
      fee,
      chain.symbol,
      tag
    ].join(",")
  })
  
  return [header, ...rows].join("\n")
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`
}

function calculateFee(gasPrice: string, gasUsed: string): string {
  const fee = (BigInt(gasPrice) * BigInt(gasUsed)) / BigInt(10 ** 18)
  return (Number(fee) / 10 ** 18).toFixed(8)
}
```

---

## Environment Variables

None required. Users provide their own Moralis API key via the UI.

---

## Deployment

1. Push to GitHub
2. Connect to Vercel
3. Deploy (no env vars needed!)

**Estimated domains:**
- `awaken-export.vercel.app` or
- Custom domain if desired

---

## MVP Scope

### In Scope
- [x] API key input (stored in localStorage)
- [x] Chain selector (5 chains)
- [x] Wallet address input with validation
- [x] Fetch all transactions (with pagination)
- [x] Display in sortable table
- [x] Download as Awaken-formatted CSV
- [x] Loading states
- [x] Error handling (including invalid API key)

### Out of Scope (v1)
- Historical USD prices
- Date range filtering
- Multiple wallet support
- Transaction type filtering
- Dark mode

---

## Estimated Timeline

| Task | Hours |
|------|-------|
| Project setup (Next.js, Tailwind) | 0.5 |
| Chain config | 0.5 |
| Moralis API integration | 1 |
| CSV formatter | 1 |
| UI components | 2 |
| Testing all 5 chains | 1 |
| Deploy to Vercel | 0.5 |
| **Total** | **~6 hours** |

---

## Success Criteria

1. User can export transactions for all 5 chains
2. CSV imports successfully into Awaken Tax
3. No manual CSV formatting required by user
4. Handles wallets with 1000+ transactions
5. Open source on GitHub

---

## Submission

After deployment:
1. Open source the repo on GitHub
2. Tweet/DM @big_duca with:
   - Live link
   - GitHub repo
   - List of supported chains
   - Demo video (optional)
