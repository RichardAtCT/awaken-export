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
      <label className="block text-sm font-medium text-gray-300">
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
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 transition-all duration-200 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        />
        {saved ? (
          <button
            onClick={handleClear}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-gray-400 transition-all duration-200 hover:border-white/20 hover:text-gray-300"
          >
            Clear
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={validating}
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-50"
          >
            {validating ? "Validating…" : "Save"}
          </button>
        )}
      </div>
      {saved && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Key saved
        </span>
      )}
      {error && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}
