import { Transaction, MoralisResponse } from "./types";

export async function fetchTransactions(
  address: string,
  chainId: string,
  apiKey: string,
  onProgress?: (count: number) => void
): Promise<Transaction[]> {
  const transactions: Transaction[] = [];
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({
      chain: chainId,
      limit: "100",
      order: "DESC",
    });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`/api/transactions?address=${address}&${params}`, {
      headers: { "x-moralis-key": apiKey },
    });

    if (!res.ok) {
      if (res.status === 401) throw new Error("Invalid API key");
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `API error: ${res.status}`);
    }

    const data: MoralisResponse = await res.json();
    transactions.push(...data.result);
    cursor = data.cursor;
    onProgress?.(transactions.length);
  } while (cursor);

  return transactions;
}
