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
      <label className="block text-sm font-medium text-gray-300">Chain</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition-all duration-200 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
      >
        {Object.entries(CHAINS).map(([key, chain]) => (
          <option key={key} value={key} className="bg-slate-900 text-white">
            {chain.name} ({chain.symbol})
          </option>
        ))}
      </select>
    </div>
  );
}
