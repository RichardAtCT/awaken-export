"use client";

import { CsvRow } from "@/lib/types";

export default function TransactionTable({ rows }: { rows: CsvRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-md border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-gray-600">
              Date
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">
              Received
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">
              Sent
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">
              Fee
            </th>
            <th className="px-3 py-2 text-left font-medium text-gray-600">
              Tag
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="whitespace-nowrap px-3 py-2">{row.date}</td>
              <td className="px-3 py-2">
                {row.receivedAmount
                  ? `${row.receivedAmount} ${row.receivedCurrency}`
                  : ""}
              </td>
              <td className="px-3 py-2">
                {row.sentAmount
                  ? `${row.sentAmount} ${row.sentCurrency}`
                  : ""}
              </td>
              <td className="whitespace-nowrap px-3 py-2">
                {row.feeAmount} {row.feeCurrency}
              </td>
              <td className="px-3 py-2">{row.tag}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
