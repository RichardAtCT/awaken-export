"use client";

import { useState, useRef, useEffect } from "react";
import { AiConfig, ChatMessage, sendChatMessage, getModelsForProvider } from "@/lib/ai";
import { ChainConfig } from "@/lib/chains";
import { MergedTransaction, CsvRow } from "@/lib/types";

interface AiModeProps {
  chain: ChainConfig | undefined;
  address: string;
  transactions: MergedTransaction[];
  csvRows: CsvRow[];
}

export default function AiMode({ chain, address, transactions, csvRows }: AiModeProps) {
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const models = getModelsForProvider(provider);

  useEffect(() => {
    setModel(models[0]);
  }, [provider]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || !apiKey) return;

    const config: AiConfig = { apiKey, model, provider };
    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setLoading(true);
    setError("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const reply = await sendChatMessage(
        config, updated, chain, address, transactions, csvRows, controller.signal
      );
      setMessages([...updated, { role: "assistant", content: reply }]);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!enabled) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-[#E7E5E4] bg-white px-4 py-3">
        <button
          onClick={() => setEnabled(true)}
          className="relative h-5 w-9 rounded-full bg-[#D6D3D1] transition-colors"
          aria-label="Enable AI Mode"
        >
          <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm" />
        </button>
        <span className="text-sm font-medium text-[#78716C]">AI Mode</span>
        <span className="text-xs text-[#A8A29E]">Ask questions about your transactions</span>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-[#C85A3E]/30 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E7E5E4] px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEnabled(false)}
            className="relative h-5 w-9 rounded-full bg-[#C85A3E] transition-colors"
            aria-label="Disable AI Mode"
          >
            <span className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm" />
          </button>
          <span className="text-sm font-semibold text-[#1C1917]">AI Mode</span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => { setMessages([]); setError(""); }}
            className="text-xs text-[#A8A29E] hover:text-[#78716C]"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Config row */}
      <div className="flex flex-wrap items-end gap-3 border-b border-[#E7E5E4] px-4 py-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#78716C]">Provider</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as "openai" | "anthropic")}
            className="rounded border border-[#E7E5E4] bg-white px-2.5 py-1.5 text-sm focus:border-[#C85A3E] focus:outline-none focus:ring-1 focus:ring-[#C85A3E]"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[#78716C]">Model</label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded border border-[#E7E5E4] bg-white px-2.5 py-1.5 text-sm focus:border-[#C85A3E] focus:outline-none focus:ring-1 focus:ring-[#C85A3E]"
          >
            {models.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label className="text-xs font-medium text-[#78716C]">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === "openai" ? "sk-..." : "sk-ant-..."}
            className="rounded border border-[#E7E5E4] bg-white px-2.5 py-1.5 font-mono text-sm focus:border-[#C85A3E] focus:outline-none focus:ring-1 focus:ring-[#C85A3E]"
          />
        </div>
      </div>

      {/* Chat messages */}
      <div className="max-h-96 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <p className="text-center text-sm text-[#A8A29E] py-6">
            {transactions.length > 0
              ? `${transactions.length} transactions loaded. Ask anything about your data.`
              : "Load some transactions first, then ask questions here."}
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 ${msg.role === "user" ? "text-right" : "text-left"}`}
          >
            <div
              className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-[#C85A3E] text-white"
                  : "bg-[#F5F5F4] text-[#1C1917]"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="mb-3 text-left">
            <div className="inline-block rounded-lg bg-[#F5F5F4] px-3 py-2 text-sm text-[#78716C]">
              Thinking...
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-3 rounded border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 border-t border-[#E7E5E4] px-4 py-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={apiKey ? "Ask about your transactions..." : "Enter API key above first"}
          disabled={!apiKey || loading}
          className="min-w-0 flex-1 rounded border border-[#E7E5E4] bg-white px-3 py-2 text-sm focus:border-[#C85A3E] focus:outline-none focus:ring-1 focus:ring-[#C85A3E] disabled:opacity-50"
        />
        <button
          onClick={loading ? () => abortRef.current?.abort() : handleSend}
          disabled={!apiKey || (!loading && !input.trim())}
          className={`rounded-md px-4 py-2 text-sm font-semibold text-white ${
            loading
              ? "bg-[#78716C] hover:bg-[#57534E]"
              : "bg-[#C85A3E] hover:bg-[#E07855] active:bg-[#A84A32] disabled:opacity-50"
          }`}
        >
          {loading ? "Stop" : "Send"}
        </button>
      </div>
    </div>
  );
}
