"use client";

import { ChainConfig } from "@/lib/chains";
import { useState, useRef, useEffect } from "react";

export default function ChainSelector({
  chains,
  value,
  onChange,
}: {
  chains: ChainConfig[];
  value: string;
  onChange: (chainId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = chains.find((c) => c.chainId === value);

  const filtered = chains.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.symbol.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#78716C]">
        Chain
      </label>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="flex w-full items-center gap-2 rounded-md border border-[#E7E5E4] bg-white px-3 py-2 text-left text-sm text-[#1C1917] transition-[border] duration-150 focus:border-[#C85A3E] focus:outline-none focus:ring-1 focus:ring-[#C85A3E]/10"
        >
          {selected?.logo && (
            <img
              src={selected.logo}
              alt=""
              width={16}
              height={16}
              className="shrink-0 rounded-full"
            />
          )}
          <span className="truncate">
            {selected ? `${selected.name} (${selected.symbol})` : "Select chain"}
          </span>
          <svg
            className="ml-auto h-4 w-4 shrink-0 text-[#78716C]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 max-h-72 w-full overflow-hidden rounded-md border border-[#E7E5E4] bg-white shadow-lg">
            <div className="border-b border-[#E7E5E4] p-2">
              <input
                ref={searchRef}
                type="text"
                placeholder="Search chains..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded border border-[#E7E5E4] px-2 py-1.5 text-sm text-[#1C1917] placeholder-[#A8A29E] focus:border-[#C85A3E] focus:outline-none"
              />
            </div>
            <ul className="max-h-56 overflow-y-auto">
              {filtered.length === 0 && (
                <li className="px-3 py-2 text-sm text-[#A8A29E]">No chains found</li>
              )}
              {filtered.map((chain) => (
                <li key={chain.chainId}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(chain.chainId);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F5F5F4] ${
                      chain.chainId === value ? "bg-[#FAFAF9] font-medium" : ""
                    }`}
                  >
                    {chain.logo ? (
                      <img
                        src={chain.logo}
                        alt=""
                        width={16}
                        height={16}
                        className="shrink-0 rounded-full"
                      />
                    ) : (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#E7E5E4] text-[8px] font-bold text-[#78716C]">
                        {chain.name[0]}
                      </span>
                    )}
                    <span className="truncate">{chain.name}</span>
                    <span className="ml-auto text-xs text-[#A8A29E]">{chain.symbol}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
