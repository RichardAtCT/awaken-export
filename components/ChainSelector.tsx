"use client";

import { CHAINS } from "@/lib/chains";

export default function ChainSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (chain: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">Chain</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {Object.entries(CHAINS).map(([key, chain]) => (
          <option key={key} value={key}>
            {chain.name} ({chain.symbol})
          </option>
        ))}
      </select>
    </div>
  );
}
