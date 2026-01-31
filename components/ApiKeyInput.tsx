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

  useEffect(() => {
    const stored = getApiKey();
    if (stored) {
      setKey(stored);
      setSaved(true);
      onKeyChange(stored);
    }
  }, [onKeyChange]);

  function handleSave() {
    if (!key.trim()) return;
    setApiKey(key.trim());
    setSaved(true);
    onKeyChange(key.trim());
  }

  function handleClear() {
    clearApiKey();
    setKey("");
    setSaved(false);
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
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-medium text-white transition-all duration-200 hover:from-indigo-400 hover:to-violet-400"
          >
            Save
          </button>
        )}
      </div>
      {saved && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Key saved
        </span>
      )}
    </div>
  );
}
