"use client";

import { CsvRow } from "@/lib/types";

const TAG_STYLES: Record<string, string> = {
  trade: "bg-amber-50 text-amber-800",
  transfer: "bg-indigo-50 text-indigo-800",
  contract_interaction: "bg-pink-50 text-pink-800",
  approval: "bg-emerald-50 text-emerald-800",
};

export default function TransactionTable({ rows }: { rows: CsvRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-md border border-[#E7E5E4] bg-white">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[#E7E5E4] bg-[#FAFAF9]">
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#78716C]">
              Date
            </th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#78716C]">
              Received
            </th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#78716C]">
              Sent
            </th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#78716C]">
              Fee
            </th>
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#78716C]">
              Tag
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F5F5F4]">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-[#FAFAF9]">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-[#1C1917]">
                {row.date}
              </td>
              <td className="px-3 py-2 font-mono text-[#1C1917]">
                {row.receivedAmount
                  ? `${row.receivedAmount} ${row.receivedCurrency}`
                  : ""}
              </td>
              <td className="px-3 py-2 font-mono text-[#1C1917]">
                {row.sentAmount
                  ? `${row.sentAmount} ${row.sentCurrency}`
                  : ""}
              </td>
              <td className="whitespace-nowrap px-3 py-2 font-mono text-[#1C1917]">
                {row.feeAmount} {row.feeCurrency}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex rounded-[4px] px-2 py-0.5 text-xs font-medium ${TAG_STYLES[row.tag?.toLowerCase()] ?? "bg-[#FAFAF9] text-[#78716C]"}`}
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
