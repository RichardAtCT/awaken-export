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
      <label className="block text-sm font-medium text-gray-700">
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
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {saved ? (
          <button
            onClick={handleClear}
            className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
          >
            Clear
          </button>
        ) : (
          <button
            onClick={handleSave}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Save
          </button>
        )}
      </div>
      {saved && (
        <p className="text-xs text-green-600">Key saved to localStorage</p>
      )}
    </div>
  );
}
