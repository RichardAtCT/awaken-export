import { ChainConfig } from "./chains";
import { Transaction, CsvRow } from "./types";

const TAG_MAP: Record<string, string> = {
  send: "Transfer",
  receive: "Transfer",
  "token send": "Transfer",
  "token receive": "Transfer",
  "token swap": "Trade",
  "nft send": "NFT",
  "nft receive": "NFT",
  airdrop: "Airdrop",
  mint: "Mint",
  burn: "Burn",
  deposit: "Deposit",
  withdraw: "Withdraw",
  "contract interaction": "Contract",
};

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${mm}/${dd}/${yyyy} ${hh}:${min}:${ss}`;
}

export function calculateFee(gasPrice: string, gasUsed: string): string {
  if (!gasPrice || !gasUsed) return "0";
  const feeWei = BigInt(gasPrice) * BigInt(gasUsed);
  // Convert from wei (10^18) to whole units
  const whole = feeWei / BigInt(10 ** 18);
  const remainder = feeWei % BigInt(10 ** 18);
  const decimal = remainder.toString().padStart(18, "0");
  return `${whole}.${decimal}`.replace(/0+$/, "").replace(/\.$/, "");
}

function parseTransfers(tx: Transaction): CsvRow[] {
  const rows: CsvRow[] = [];
  const fee = calculateFee(tx.gas_price, tx.receipt_gas_used);
  const date = formatDate(tx.block_timestamp);
  const tag = TAG_MAP[tx.category] || "";

  const natives = tx.native_transfers || [];
  const erc20s = tx.erc20_transfers || [];

  if (natives.length === 0 && erc20s.length === 0) {
    // Transaction with no transfers (e.g. contract interaction with only gas)
    rows.push({
      date,
      receivedAmount: "",
      receivedCurrency: "",
      sentAmount: "",
      sentCurrency: "",
      feeAmount: fee,
      feeCurrency: "",
      tag,
    });
    return rows;
  }

  for (const t of natives) {
    const row: CsvRow = {
      date,
      receivedAmount: "",
      receivedCurrency: "",
      sentAmount: "",
      sentCurrency: "",
      feeAmount: fee,
      feeCurrency: "",
      tag,
    };
    if (t.direction === "incoming") {
      row.receivedAmount = t.value_formatted;
      row.receivedCurrency = t.token_symbol;
    } else {
      row.sentAmount = t.value_formatted;
      row.sentCurrency = t.token_symbol;
    }
    rows.push(row);
  }

  for (const t of erc20s) {
    const row: CsvRow = {
      date,
      receivedAmount: "",
      receivedCurrency: "",
      sentAmount: "",
      sentCurrency: "",
      feeAmount: fee,
      feeCurrency: "",
      tag,
    };
    if (t.direction === "incoming") {
      row.receivedAmount = t.value_formatted;
      row.receivedCurrency = t.token_symbol;
    } else {
      row.sentAmount = t.value_formatted;
      row.sentCurrency = t.token_symbol;
    }
    rows.push(row);
  }

  return rows;
}

export function transactionsToCsvRows(
  transactions: Transaction[],
  chain: ChainConfig
): CsvRow[] {
  return transactions.flatMap((tx) => {
    const rows = parseTransfers(tx);
    return rows.map((r) => ({ ...r, feeCurrency: chain.symbol }));
  });
}

export function toAwakenCSV(
  transactions: Transaction[],
  chain: ChainConfig
): string {
  const header =
    "Date,Received Amount,Received Currency,Received Value,Sent Amount,Sent Currency,Sent Value,Fee Amount,Fee Currency,Tag";

  const rows = transactionsToCsvRows(transactions, chain).map((r) =>
    [
      r.date,
      r.receivedAmount,
      r.receivedCurrency,
      "", // received value
      r.sentAmount,
      r.sentCurrency,
      "", // sent value
      r.feeAmount,
      r.feeCurrency,
      r.tag,
    ].join(",")
  );

  return [header, ...rows].join("\n");
}
