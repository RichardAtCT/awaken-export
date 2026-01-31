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
      <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#78716C]">
        Chain
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-md border border-[#E7E5E4] bg-white px-3 py-2 text-sm text-[#1C1917] transition-[border] duration-150 focus:border-[#C85A3E] focus:outline-none focus:ring-1 focus:ring-[#C85A3E]/10"
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
