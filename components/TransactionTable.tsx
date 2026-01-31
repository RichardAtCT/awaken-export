"use client";

import { CsvRow } from "@/lib/types";

const TAG_COLORS: Record<string, string> = {
  trade: "bg-blue-500/10 text-blue-400",
  transfer: "bg-violet-500/10 text-violet-400",
  contract_interaction: "bg-amber-500/10 text-amber-400",
  approval: "bg-cyan-500/10 text-cyan-400",
};

export default function TransactionTable({ rows }: { rows: CsvRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
              Date
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
              Received
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
              Sent
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
              Fee
            </th>
            <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
              Tag
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((row, i) => (
            <tr
              key={i}
              className={`transition-colors duration-150 hover:bg-white/5 ${i % 2 === 1 ? "bg-white/[0.02]" : ""}`}
            >
              <td className="whitespace-nowrap px-3 py-2 text-gray-300">
                {row.date}
              </td>
              <td className="px-3 py-2 text-gray-300">
                {row.receivedAmount
                  ? `${row.receivedAmount} ${row.receivedCurrency}`
                  : ""}
              </td>
              <td className="px-3 py-2 text-gray-300">
                {row.sentAmount
                  ? `${row.sentAmount} ${row.sentCurrency}`
                  : ""}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-gray-300">
                {row.feeAmount} {row.feeCurrency}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TAG_COLORS[row.tag?.toLowerCase()] ?? "bg-white/5 text-gray-400"}`}
                >
                  {row.tag}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
