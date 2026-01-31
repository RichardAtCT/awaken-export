import { ChainConfig } from "./chains";
import { MergedTransaction, CsvRow } from "./types";

export function formatDate(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const yy = String(d.getUTCFullYear()).slice(-2);
  const h = d.getUTCHours();
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  return `${m}/${day}/${yy} ${h}:${min}`;
}

export function formatWei(wei: string, decimals: number): string {
  if (!wei || wei === "0") return "0";
  const raw = BigInt(wei);
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = raw / divisor;
  const remainder = raw % divisor;
  if (remainder === BigInt(0)) return whole.toString();
  const dec = remainder.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole}.${dec}`;
}

export function calculateFee(gasPrice: string, gasUsed: string): string {
  if (!gasPrice || !gasUsed) return "0";
  const feeWei = BigInt(gasPrice) * BigInt(gasUsed);
  return formatWei(feeWei.toString(), 18);
}

function escapeCSV(field: string): string {
  if (!field) return field;
  // Strip characters that can break CSV cell boundaries
  field = field.replace(/[\t\r]/g, " ");
  const first = field[0];
  if (first === "=" || first === "+" || first === "-" || first === "@") {
    field = "'" + field;
  }
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    field = '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

function determineTag(tx: MergedTransaction): string {
  if (tx.isError) return "Failed";

  const fn = tx.functionName.toLowerCase();
  const hasIn = tx.transfers.some((t) => t.direction === "in");
  const hasOut = tx.transfers.some((t) => t.direction === "out");

  if (fn.includes("approve")) return "Approval";
  if (fn.includes("wrap") || fn.includes("unwrap")) return "Wrap";
  if (fn.includes("swap") || (hasIn && hasOut)) return "Trade";

  if (tx.input === "0x" && tx.transfers.length > 0) return "Transfer";
  if (hasIn && !hasOut) return "Transfer";
  if (hasOut && !hasIn) return "Transfer";

  if (tx.transfers.length === 0 && tx.input !== "0x") return "Contract";

  return "Transfer";
}

function parseTransfers(tx: MergedTransaction, chain: ChainConfig, address: string): CsvRow[] {
  const rows: CsvRow[] = [];
  const date = formatDate(tx.timestamp);
  const tag = determineTag(tx);
  const isSender = tx.from === address;
  const fee = isSender ? calculateFee(tx.gasPrice, tx.gasUsed) : "0";

  if (tx.transfers.length === 0) {
    rows.push({
      date,
      receivedAmount: "",
      receivedCurrency: "",
      sentAmount: "",
      sentCurrency: "",
      feeAmount: fee,
      feeCurrency: isSender ? chain.symbol : "",
      tag,
    });
    return rows;
  }

  const ins = tx.transfers.filter((t) => t.direction === "in");
  const outs = tx.transfers.filter((t) => t.direction === "out");

  // Pair up ins and outs for swaps, or emit individual rows
  const maxLen = Math.max(ins.length, outs.length, 1);
  for (let i = 0; i < maxLen; i++) {
    const inT = ins[i];
    const outT = outs[i];
    rows.push({
      date,
      receivedAmount: inT ? formatWei(inT.amount, inT.decimals) : "",
      receivedCurrency: inT ? inT.currency : "",
      sentAmount: outT ? formatWei(outT.amount, outT.decimals) : "",
      sentCurrency: outT ? outT.currency : "",
      feeAmount: i === 0 ? fee : "0",
      feeCurrency: i === 0 && isSender ? chain.symbol : "",
      tag,
    });
  }

  return rows;
}

export function transactionsToCsvRows(
  transactions: MergedTransaction[],
  chain: ChainConfig,
  address: string
): CsvRow[] {
  const addr = address.toLowerCase();
  return transactions.flatMap((tx) => parseTransfers(tx, chain, addr));
}

export function toAwakenCSV(
  transactions: MergedTransaction[],
  chain: ChainConfig,
  address: string
): string {
  const header =
    "Date,Received Quantity,Received Currency,Sent Quantity,Sent Currency,Fee Amount,Fee Currency,Notes";

  const rows = transactionsToCsvRows(transactions, chain, address).map((r) =>
    [
      escapeCSV(r.date),
      escapeCSV(r.receivedAmount),
      escapeCSV(r.receivedCurrency),
      escapeCSV(r.sentAmount),
      escapeCSV(r.sentCurrency),
      escapeCSV(r.feeAmount),
      escapeCSV(r.feeCurrency),
      escapeCSV(r.tag),
    ].join(",")
  );

  return [header, ...rows].join("\n");
}
