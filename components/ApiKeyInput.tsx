"use client";

import { useState, useEffect } from "react";
import { getApiKey, setApiKey, clearApiKey } from "@/lib/storage";

export default function ApiKeyInput({
  onKeyChange,
}: {
  onKeyChange: (key: string) => void;
}) {
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const stored = getApiKey();
    if (stored) {
      setKey(stored);
      setSaved(true);
      onKeyChange(stored);
    }
  }, [onKeyChange]);

  async function handleSave() {
    const trimmed = key.trim();
    if (!trimmed) return;

    setValidating(true);
    setError("");

    try {
      const res = await fetch("/api/health", {
        headers: { "x-moralis-key": trimmed },
      });
      const data = await res.json();

      if (data.valid) {
        setApiKey(trimmed);
        setSaved(true);
        onKeyChange(trimmed);
      } else {
        setError(data.error || "Invalid API key");
      }
    } catch {
      setError("Could not validate key");
    } finally {
      setValidating(false);
    }
  }

  function handleClear() {
    clearApiKey();
    setKey("");
    setSaved(false);
    setError("");
    onKeyChange("");
  }

  return (
    <div className="space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#78716C]">
        Moralis API Key
      </label>
      <div className="flex gap-2">
        <input
          type="password"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setSaved(false);
            setError("");
          }}
          placeholder="Paste your Moralis API key"
          className="flex-1 rounded-md border border-[#E7E5E4] bg-white px-3 py-2 text-sm text-[#1C1917] placeholder-[#A8A29E] transition-[border] duration-150 focus:border-[#C85A3E] focus:outline-none focus:ring-1 focus:ring-[#C85A3E]/10"
        />
        {saved ? (
          <button
            onClick={handleClear}
            className="rounded-md border border-[#E7E5E4] px-4 py-2 text-sm font-medium text-[#78716C] hover:border-[#D6D3D1]"
          >
            Clear
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={validating}
            className="rounded-md bg-[#C85A3E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E07855] active:bg-[#A84A32] disabled:opacity-50"
          >
            {validating ? "Checking..." : "Save"}
          </button>
        )}
      </div>
      {saved && (
        <span className="text-xs font-medium text-[#15803D]">Key saved</span>
      )}
      {error && (
        <span className="text-xs font-medium text-[#BE123C]">{error}</span>
      )}
    </div>
  );
}
