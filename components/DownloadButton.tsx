"use client";

import { MergedTransaction } from "@/lib/types";
import { ChainConfig } from "@/lib/chains";
import { toAwakenCSV } from "@/lib/csv";

export default function DownloadButton({
  transactions,
  chain,
  address,
}: {
  transactions: MergedTransaction[];
  chain: ChainConfig;
  address: string;
}) {
  if (transactions.length === 0) return null;

  function handleDownload() {
    const csv = toAwakenCSV(transactions, chain, address);
    const now = new Date().toISOString().slice(0, 10);
    const safeAddr = address.slice(0, 8).replace(/[^0-9a-fA-Fx]/g, "");
    const filename = `${chain.name}_${safeAddr}_${now}.csv`;
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
      className="w-full rounded-md bg-emerald-700 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 active:bg-emerald-800"
    >
      Download CSV — {transactions.length} transactions
    </button>
  );
}
