"use client";

export default function AddressInput({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (addr: string) => void;
  error?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#78716C]">
        Wallet Address
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0x..."
        className={`w-full rounded-md border bg-white px-3 py-2 font-mono text-sm text-[#1C1917] placeholder-[#A8A29E] transition-[border] duration-150 focus:outline-none focus:ring-1 ${
          error
            ? "border-[#BE123C] focus:border-[#BE123C] focus:ring-[#BE123C]/10"
            : "border-[#E7E5E4] focus:border-[#C85A3E] focus:ring-[#C85A3E]/10"
        }`}
      />
      {error && <p className="text-xs text-[#BE123C]">{error}</p>}
    </div>
  );
}
