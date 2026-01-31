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
      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 px-6 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:from-emerald-400 hover:to-green-400 hover:shadow-lg hover:shadow-emerald-500/25"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Download CSV ({transactions.length} transactions)
    </button>
  );
}
