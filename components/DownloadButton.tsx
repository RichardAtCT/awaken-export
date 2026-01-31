"use client";

import { Transaction } from "@/lib/types";
import { ChainConfig } from "@/lib/chains";
import { toAwakenCSV } from "@/lib/csv";

export default function DownloadButton({
  transactions,
  chain,
  address,
}: {
  transactions: Transaction[];
  chain: ChainConfig;
  address: string;
}) {
  if (transactions.length === 0) return null;

  function handleDownload() {
    const csv = toAwakenCSV(transactions, chain);
    const now = new Date().toISOString().slice(0, 10);
    const filename = `${chain.name}_${address.slice(0, 8)}_${now}.csv`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleDownload}
      className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700"
    >
      Download CSV ({transactions.length} transactions)
    </button>
  );
}
