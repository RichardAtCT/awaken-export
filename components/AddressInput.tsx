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
      <label className="block text-sm font-medium text-gray-300">
        Wallet Address
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0x..."
        className={`w-full rounded-lg border bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 transition-all duration-200 focus:outline-none focus:ring-1 ${
          error
            ? "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/50"
            : "border-white/10 focus:border-indigo-500/50 focus:ring-indigo-500/50"
        }`}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
