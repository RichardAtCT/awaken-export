import { ChainConfig } from "./chains";
import {
  BlockScoutTx,
  BlockScoutTokenTx,
  BlockScoutInternalTx,
  MergedTransaction,
  Transfer,
} from "./types";

const PAGE_SIZE = 10000;
const RATE_LIMIT_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

const SCAM_PATTERNS = /^\$|airdrop|\.com|\.io|\.org|\.net|claim|reward|visit/i;

function isScamToken(symbol: string, name: string): boolean {
  return SCAM_PATTERNS.test(symbol) || SCAM_PATTERNS.test(name);
}

async function fetchPaginated<T>(
  baseUrl: string,
  action: string,
  address: string,
  signal?: AbortSignal
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;

  while (true) {
    if (signal?.aborted) break;

    const url = `${baseUrl}?module=account&action=${action}&address=${address}&page=${page}&offset=${PAGE_SIZE}&sort=desc`;
    const res = await fetch(url, { signal });

    if (!res.ok) throw new Error(`BlockScout API error: ${res.status}`);

    const data = await res.json();
    if (data.status !== "1" || !Array.isArray(data.result)) break;

    results.push(...data.result);
    if (data.result.length < PAGE_SIZE) break;

    page++;
    await sleep(RATE_LIMIT_MS);
  }

  return results;
}

export class AbortedWithData extends Error {
  transactions: MergedTransaction[];
  constructor(transactions: MergedTransaction[]) {
    super("Fetch cancelled");
    this.name = "AbortedWithData";
    this.transactions = transactions;
  }
}

export async function fetchAllTransactions(
  chain: ChainConfig,
  address: string,
  onProgress?: (msg: string) => void,
  signal?: AbortSignal
): Promise<MergedTransaction[]> {
  const addr = address.toLowerCase();

  onProgress?.("Fetching normal transactions...");
  const [txList, tokenTxList, internalTxList] = await Promise.all([
    fetchPaginated<BlockScoutTx>(chain.apiUrl, "txlist", addr, signal),
    fetchPaginated<BlockScoutTokenTx>(chain.apiUrl, "tokentx", addr, signal),
    fetchPaginated<BlockScoutInternalTx>(
      chain.apiUrl,
      "txlistinternal",
      addr,
      signal
    ),
  ]);

  onProgress?.(
    `Fetched ${txList.length} txs, ${tokenTxList.length} token txs, ${internalTxList.length} internal txs. Merging...`
  );

  return mergeByHash(txList, tokenTxList, internalTxList, addr, chain);
}

function mergeByHash(
  txList: BlockScoutTx[],
  tokenTxList: BlockScoutTokenTx[],
  internalTxList: BlockScoutInternalTx[],
  address: string,
  chain: ChainConfig
): MergedTransaction[] {
  const map = new Map<string, MergedTransaction>();

  for (const tx of txList) {
    const merged: MergedTransaction = {
      hash: tx.hash,
      timestamp: parseInt(tx.timeStamp),
      from: tx.from.toLowerCase(),
      to: (tx.to || "").toLowerCase(),
      isError: tx.isError === "1",
      gasPrice: tx.gasPrice,
      gasUsed: tx.gasUsed,
      functionName: tx.functionName || "",
      input: tx.input || "0x",
      transfers: [],
    };

    // Native value transfer
    if (tx.value !== "0") {
      const direction = tx.from.toLowerCase() === address ? "out" : "in";
      merged.transfers.push({
        direction,
        amount: tx.value,
        currency: chain.symbol,
        decimals: chain.decimals,
      });
    }

    map.set(tx.hash, merged);
  }

  // Internal transactions (native value from contracts)
  for (const itx of internalTxList) {
    if (itx.isError === "1" || itx.value === "0") continue;

    let merged = map.get(itx.hash);
    if (!merged) {
      merged = {
        hash: itx.hash,
        timestamp: parseInt(itx.timeStamp),
        from: itx.from.toLowerCase(),
        to: (itx.to || "").toLowerCase(),
        isError: false,
        gasPrice: "0",
        gasUsed: "0",
        functionName: "",
        input: "0x",
        transfers: [],
      };
      map.set(itx.hash, merged);
    }

    const direction = itx.from.toLowerCase() === address ? "out" : "in";
    merged.transfers.push({
      direction,
      amount: itx.value,
      currency: chain.symbol,
      decimals: chain.decimals,
    });
  }

  // Token transfers
  for (const ttx of tokenTxList) {
    if (isScamToken(ttx.tokenSymbol, ttx.tokenName)) continue;

    let merged = map.get(ttx.hash);
    if (!merged) {
      merged = {
        hash: ttx.hash,
        timestamp: parseInt(ttx.timeStamp),
        from: ttx.from.toLowerCase(),
        to: (ttx.to || "").toLowerCase(),
        isError: false,
        gasPrice: "0",
        gasUsed: "0",
        functionName: "",
        input: "0x",
        transfers: [],
      };
      map.set(ttx.hash, merged);
    }

    const direction = ttx.from.toLowerCase() === address ? "out" : "in";
    merged.transfers.push({
      direction,
      amount: ttx.value,
      currency: ttx.tokenSymbol,
      decimals: parseInt(ttx.tokenDecimal) || 18,
    });
  }

  // Sort by timestamp descending
  return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
}
