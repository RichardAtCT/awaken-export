"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { AiConfig, ChatMessage, sendChatMessage, getModelsForProvider } from "@/lib/ai";
import { ChainConfig } from "@/lib/chains";
import { MergedTransaction, CsvRow } from "@/lib/types";
import { fetchAllTransactions } from "@/lib/blockscout";
import { transactionsToCsvRows, toAwakenCSV } from "@/lib/csv";

export interface AiActions {
  setAddress: (addr: string) => void;
  setChainId: (id: string) => void;
  setTransactions: (txs: MergedTransaction[]) => void;
  setCsvRows: (rows: CsvRow[]) => void;
}

interface AiModeProps {
  chains: ChainConfig[];
  chain: ChainConfig | undefined;
  address: string;
  transactions: MergedTransaction[];
  csvRows: CsvRow[];
  actions: AiActions;
}

export default function AiMode({ chains, chain, address, transactions, csvRows, actions }: AiModeProps) {
  const [enabled, setEnabled] = useState(false);
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Keep refs to latest props so tool executor always has current state
  const chainsRef = useRef(chains);
  const chainRef = useRef(chain);
  const addressRef = useRef(address);
  const transactionsRef = useRef(transactions);
  const csvRowsRef = useRef(csvRows);
  useEffect(() => { chainsRef.current = chains; }, [chains]);
  useEffect(() => { chainRef.current = chain; }, [chain]);
  useEffect(() => { addressRef.current = address; }, [address]);
  useEffect(() => { transactionsRef.current = transactions; }, [transactions]);
  useEffect(() => { csvRowsRef.current = csvRows; }, [csvRows]);

  const models = getModelsForProvider(provider);

  useEffect(() => {
    setModel(models[0]);
  }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusMsg]);

  // ── Tool executor ──

  const executeTool = useCallback(async (name: string, args: Record<string, unknown>): Promise<string> => {
    const allChains = chainsRef.current;
    const currentAddress = addressRef.current;

    switch (name) {
      case "list_chains": {
        const list = allChains.map((c) => `${c.name} (${c.symbol})`).join(", ");
        return `Available chains (${allChains.length}): ${list}`;
      }

      case "set_address": {
        const addr = args.address as string;
        if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
          return "Error: Invalid address format. Must be 0x followed by 40 hex characters.";
        }
        actions.setAddress(addr);
        addressRef.current = addr;
        return `Address set to ${addr}`;
      }

      case "scan_chains": {
        const addr = currentAddress;
        if (!addr) return "Error: No wallet address set. Use set_address first.";

        const chainNames = args.chain_names as string[] | undefined;
        let toScan = allChains;
        if (chainNames && chainNames.length > 0) {
          toScan = allChains.filter((c) =>
            chainNames.some((n) => c.name.toLowerCase().includes(n.toLowerCase()))
          );
          if (toScan.length === 0) {
            return `No matching chains found for: ${chainNames.join(", ")}. Use list_chains to see available chains.`;
          }
        }

        const active: { name: string; symbol: string; txCount: number }[] = [];
        const errors: string[] = [];
        const BATCH_SIZE = 5;
        const SCAN_DELAY = 300;

        for (let i = 0; i < toScan.length; i += BATCH_SIZE) {
          const batch = toScan.slice(i, i + BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map(async (c) => {
              const url = `${c.apiUrl}?module=account&action=txlist&address=${addr.toLowerCase()}&page=1&offset=1&sort=desc`;
              const res = await fetch(url);
              if (!res.ok) throw new Error(`${c.name}: HTTP ${res.status}`);
              const data = await res.json();
              const count = data.status === "1" && Array.isArray(data.result) ? data.result.length : 0;
              return { chain: c, count };
            })
          );

          for (const r of results) {
            if (r.status === "fulfilled" && r.value.count > 0) {
              active.push({ name: r.value.chain.name, symbol: r.value.chain.symbol, txCount: r.value.count });
            } else if (r.status === "rejected") {
              errors.push(r.reason?.message ?? "unknown");
            }
          }

          if (i + BATCH_SIZE < toScan.length) {
            await new Promise((r) => setTimeout(r, SCAN_DELAY));
          }
        }

        if (active.length === 0) {
          return `Scanned ${toScan.length} chains. No transaction activity found for ${addr}.${errors.length > 0 ? ` (${errors.length} chains had errors)` : ""}`;
        }

        return `Found activity on ${active.length} of ${toScan.length} chains scanned:\n${active.map((a) => `- ${a.name} (${a.symbol})`).join("\n")}${errors.length > 0 ? `\n(${errors.length} chains had scan errors)` : ""}`;
      }

      case "fetch_transactions": {
        const addr = currentAddress;
        if (!addr) return "Error: No wallet address set. Use set_address first.";

        const chainName = args.chain_name as string;
        const target = allChains.find((c) => c.name.toLowerCase() === chainName.toLowerCase());
        if (!target) return `Error: Chain "${chainName}" not found. Use list_chains to see available chains.`;

        // Switch the app to this chain
        actions.setChainId(target.chainId);

        try {
          const txs = await fetchAllTransactions(target, addr);
          const rows = transactionsToCsvRows(txs, target, addr);
          actions.setTransactions(txs);
          actions.setCsvRows(rows);
          transactionsRef.current = txs;
          csvRowsRef.current = rows;

          if (txs.length === 0) {
            return `Fetched transactions on ${target.name}: 0 transactions found.`;
          }

          const tags: Record<string, number> = {};
          for (const r of rows) {
            tags[r.tag] = (tags[r.tag] || 0) + 1;
          }
          const tagSummary = Object.entries(tags).map(([t, c]) => `${t}: ${c}`).join(", ");

          return `Fetched ${txs.length} transactions (${rows.length} CSV rows) on ${target.name}.\nTag breakdown: ${tagSummary}`;
        } catch (e) {
          return `Error fetching transactions on ${target.name}: ${e instanceof Error ? e.message : "unknown"}`;
        }
      }

      case "download_csv": {
        const addr = currentAddress;
        if (!addr) return "Error: No wallet address set.";

        const chainName = args.chain_name as string;
        const target = allChains.find((c) => c.name.toLowerCase() === chainName.toLowerCase());
        if (!target) return `Error: Chain "${chainName}" not found.`;

        const txs = transactionsRef.current;
        if (txs.length === 0) {
          return "Error: No transactions loaded. Use fetch_transactions first.";
        }

        const csv = toAwakenCSV(txs, target, addr);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        a.href = url;
        a.download = `${target.name}_${addr.slice(0, 8)}_${dateStr}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        return `CSV downloaded: ${target.name}_${addr.slice(0, 8)}_${dateStr}.csv (${txs.length} transactions)`;
      }

      case "get_status": {
        const c = chainRef.current;
        const txs = transactionsRef.current;
        const rows = csvRowsRef.current;
        return `Status:\n- Chain: ${c?.name ?? "none"} (${c?.symbol ?? ""})\n- Address: ${currentAddress || "none"}\n- Transactions loaded: ${txs.length}\n- CSV rows: ${rows.length}\n- Available chains: ${allChains.length}`;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  }, [actions]);

  // ── Send message ──

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
    setStatusMsg("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { reply, toolMessages } = await sendChatMessage({
        config,
        messages: updated,
        chain: chainRef.current,
        address: addressRef.current,
        transactions: transactionsRef.current,
        csvRows: csvRowsRef.current,
        chains: chainsRef.current,
        executeTool,
        onStatus: setStatusMsg,
        signal: controller.signal,
      });
      setMessages([...updated, ...toolMessages, { role: "assistant", content: reply }]);
      setStatusMsg("");
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
        <span className="text-xs text-[#A8A29E]">Ask AI to scan chains, fetch &amp; download transactions</span>
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
            onClick={() => { setMessages([]); setError(""); setStatusMsg(""); }}
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
          <div className="py-6 text-center text-sm text-[#A8A29E]">
            <p className="mb-2">Ask the AI to help with your transactions. Examples:</p>
            <div className="space-y-1 text-xs">
              <p>&quot;My address is 0x... — which chains do I have transactions on?&quot;</p>
              <p>&quot;Fetch my transactions on Ethereum and download the CSV&quot;</p>
              <p>&quot;Scan all chains and download everything&quot;</p>
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`mb-3 ${msg.role === "user" ? "text-right" : msg.role === "status" ? "text-center" : "text-left"}`}
          >
            {msg.role === "status" ? (
              <span className="inline-block rounded-full bg-[#F5F5F4] px-3 py-1 text-xs text-[#78716C]">
                {msg.content}
              </span>
            ) : (
              <div
                className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-[#C85A3E] text-white"
                    : "bg-[#F5F5F4] text-[#1C1917]"
                }`}
              >
                {msg.content}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="mb-3 text-center">
            <span className="inline-block rounded-full bg-[#F5F5F4] px-3 py-1 text-xs text-[#78716C]">
              {statusMsg || "Thinking..."}
            </span>
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
          placeholder={apiKey ? "e.g. Which chains does 0x... have activity on?" : "Enter API key above first"}
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
