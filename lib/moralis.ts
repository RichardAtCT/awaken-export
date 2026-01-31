import { Transaction, MoralisResponse } from "./types";

export class AbortedWithData extends Error {
  transactions: Transaction[];
  constructor(transactions: Transaction[]) {
    super("Fetch cancelled");
    this.name = "AbortedWithData";
    this.transactions = transactions;
  }
}

export async function fetchTransactions(
  address: string,
  chainId: string,
  apiKey: string,
  onProgress?: (count: number) => void,
  signal?: AbortSignal,
  maxTransactions?: number
): Promise<Transaction[]> {
  const transactions: Transaction[] = [];
  let cursor: string | null = null;

  do {
    if (signal?.aborted) throw new AbortedWithData(transactions);

    const params = new URLSearchParams({
      chain: chainId,
      limit: "100",
      order: "DESC",
    });
    if (cursor) params.set("cursor", cursor);

    let res: Response;
    try {
      res = await fetch(`/api/transactions?address=${address}&${params}`, {
        headers: { "x-moralis-key": apiKey },
        signal,
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        throw new AbortedWithData(transactions);
      }
      throw e;
    }

    if (!res.ok) {
      if (res.status === 401) throw new Error("Invalid API key");
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `API error: ${res.status}`);
    }

    const data: MoralisResponse = await res.json();
    transactions.push(...data.result);
    cursor = data.cursor;
    onProgress?.(transactions.length);

    if (maxTransactions && transactions.length >= maxTransactions) break;
  } while (cursor);

  if (maxTransactions) return transactions.slice(0, maxTransactions);
  return transactions;
}
