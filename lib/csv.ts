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
  "nft trade": "NFT",
  approve: "Approval",
};

function cleanAmount(
  formatted: string | undefined,
  raw: string | undefined,
  decimals: number
): string {
  let num: number;
  if (formatted) {
    num = parseFloat(formatted);
  } else if (raw) {
    num = Number(BigInt(raw)) / 10 ** decimals;
  } else {
    return "";
  }
  if (isNaN(num) || num === 0) return "0";
  return parseFloat(num.toFixed(8)).toString();
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const yy = String(d.getUTCFullYear()).slice(-2);
  const h = d.getUTCHours();
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${m}/${day}/${yy} ${h}:${min}`;
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

function parseTransfers(tx: Transaction, chain: ChainConfig): CsvRow[] {
  const rows: CsvRow[] = [];
  const fee = calculateFee(tx.gas_price, tx.receipt_gas_used);
  const date = formatDate(tx.block_timestamp);
  const tag = TAG_MAP[tx.category?.toLowerCase()] || "";

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
    const amount = cleanAmount(t.value_formatted, t.value, chain.decimals);
    if (t.direction === "incoming") {
      row.receivedAmount = amount;
      row.receivedCurrency = t.token_symbol;
    } else {
      row.sentAmount = amount;
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
    const amount = cleanAmount(t.value_formatted, t.value, parseInt(t.token_decimals));
    if (t.direction === "incoming") {
      row.receivedAmount = amount;
      row.receivedCurrency = t.token_symbol;
    } else {
      row.sentAmount = amount;
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
    const rows = parseTransfers(tx, chain);
    return rows.map((r) => ({ ...r, feeCurrency: chain.symbol }));
  });
}

export function toAwakenCSV(
  transactions: Transaction[],
  chain: ChainConfig
): string {
  const header =
    "Date,Received Quantity,Received Currency,Sent Quantity,Sent Currency,Fee Amount,Fee Currency,Notes";

  const rows = transactionsToCsvRows(transactions, chain).map((r) =>
    [
      r.date,
      r.receivedAmount,
      r.receivedCurrency,
      r.sentAmount,
      r.sentCurrency,
      r.feeAmount,
      r.feeCurrency,
      r.tag,
    ].join(",")
  );

  return [header, ...rows].join("\n");
}
