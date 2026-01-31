"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AiConfig,
  ChatMessage,
  sendChatMessage,
  getModelsForProvider,
  SAFE_TOOLS,
} from "@/lib/ai";
import { ChainConfig, fetchChains } from "@/lib/chains";
import { MergedTransaction, CsvRow } from "@/lib/types";
import { fetchAllTransactions } from "@/lib/blockscout";
import { transactionsToCsvRows, toAwakenCSV } from "@/lib/csv";

function describeToolCall(
  name: string,
  args: Record<string, unknown>
): string {
  switch (name) {
    case "set_address":
      return `Set wallet address to ${args.address}`;
    case "scan_chains": {
      const names = args.chain_names as string[] | undefined;
      return names?.length
        ? `Scan ${names.length} chains for activity`
        : "Scan all chains for activity";
    }
    case "fetch_transactions":
      return `Fetch transactions on ${args.chain_name}`;
    case "download_csv":
      return `Download CSV for ${args.chain_name}`;
    default:
      return `Run ${name}`;
  }
}

const TOOL_ICONS: Record<string, string> = {
  set_address: "W",
  scan_chains: "S",
  fetch_transactions: "F",
  download_csv: "D",
  list_chains: "L",
  get_status: "?",
};

export default function AiPage() {
  // ── App state ──
  const [chains, setChains] = useState<ChainConfig[]>([]);
  const [chainId, setChainId] = useState("");
  const [address, setAddress] = useState("");
  const [transactions, setTransactions] = useState<MergedTransaction[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);

  // ── AI config ──
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o");

  // ── Chat state ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const [pendingTool, setPendingTool] = useState<{
    name: string;
    args: Record<string, unknown>;
    resolve: (approved: boolean) => void;
  } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 640 : true
  );

  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Refs for latest state inside tool executor
  const chainsRef = useRef(chains);
  const chainRef = useRef<ChainConfig | undefined>(undefined);
  const addressRef = useRef(address);
  const transactionsRef = useRef(transactions);
  const csvRowsRef = useRef(csvRows);

  useEffect(() => {
    chainsRef.current = chains;
  }, [chains]);
  useEffect(() => {
    chainRef.current = chains.find((c) => c.chainId === chainId);
  }, [chains, chainId]);
  useEffect(() => {
    addressRef.current = address;
  }, [address]);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);
  useEffect(() => {
    csvRowsRef.current = csvRows;
  }, [csvRows]);

  const models = getModelsForProvider(provider);

  useEffect(() => {
    setModel(models[0]);
  }, [provider]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, statusMsg]);

  // Load chains on mount
  useEffect(() => {
    fetchChains()
      .then((c) => {
        setChains(c);
        const eth = c.find((ch) => ch.name === "Ethereum");
        setChainId(eth ? eth.chainId : c[0]?.chainId ?? "");
      })
      .catch(() => {});
  }, []);

  const chain = chains.find((c) => c.chainId === chainId);

  // ── Tool executor ──

  const executeTool = useCallback(
    async (
      name: string,
      args: Record<string, unknown>
    ): Promise<string> => {
      const allChains = chainsRef.current;
      const currentAddress = addressRef.current;

      switch (name) {
        case "list_chains": {
          const list = allChains
            .map((c) => `${c.name} (${c.symbol})`)
            .join(", ");
          return `Available chains (${allChains.length}): ${list}`;
        }

        case "set_address": {
          const addr = args.address as string;
          if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
            return "Error: Invalid address format. Must be 0x followed by 40 hex characters.";
          }
          setAddress(addr);
          addressRef.current = addr;
          return `Address set to ${addr}`;
        }

        case "scan_chains": {
          const addr = currentAddress;
          if (!addr)
            return "Error: No wallet address set. Use set_address first.";

          const chainNames = args.chain_names as string[] | undefined;
          let toScan = allChains;
          if (chainNames && chainNames.length > 0) {
            toScan = allChains.filter((c) =>
              chainNames.some((n) =>
                c.name.toLowerCase().includes(n.toLowerCase())
              )
            );
            if (toScan.length === 0) {
              return `No matching chains found for: ${chainNames.join(", ")}. Use list_chains to see available chains.`;
            }
          }

          const active: {
            name: string;
            symbol: string;
            txCount: number;
          }[] = [];
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
                const count =
                  data.status === "1" && Array.isArray(data.result)
                    ? data.result.length
                    : 0;
                return { chain: c, count };
              })
            );

            for (const r of results) {
              if (r.status === "fulfilled" && r.value.count > 0) {
                active.push({
                  name: r.value.chain.name,
                  symbol: r.value.chain.symbol,
                  txCount: r.value.count,
                });
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
          if (!addr)
            return "Error: No wallet address set. Use set_address first.";

          const chainName = args.chain_name as string;
          const target = allChains.find(
            (c) => c.name.toLowerCase() === chainName.toLowerCase()
          );
          if (!target)
            return `Error: Chain "${chainName}" not found. Use list_chains to see available chains.`;

          setChainId(target.chainId);

          try {
            const txs = await fetchAllTransactions(target, addr);
            const rows = transactionsToCsvRows(txs, target, addr);
            setTransactions(txs);
            setCsvRows(rows);
            transactionsRef.current = txs;
            csvRowsRef.current = rows;

            if (txs.length === 0) {
              return `Fetched transactions on ${target.name}: 0 transactions found.`;
            }

            const tags: Record<string, number> = {};
            for (const r of rows) {
              tags[r.tag] = (tags[r.tag] || 0) + 1;
            }
            const tagSummary = Object.entries(tags)
              .map(([t, c]) => `${t}: ${c}`)
              .join(", ");

            return `Fetched ${txs.length} transactions (${rows.length} CSV rows) on ${target.name}.\nTag breakdown: ${tagSummary}`;
          } catch (e) {
            return `Error fetching transactions on ${target.name}: ${e instanceof Error ? e.message : "unknown"}`;
          }
        }

        case "download_csv": {
          const addr = currentAddress;
          if (!addr) return "Error: No wallet address set.";

          const chainName = args.chain_name as string;
          const target = allChains.find(
            (c) => c.name.toLowerCase() === chainName.toLowerCase()
          );
          if (!target) return `Error: Chain "${chainName}" not found.`;

          const txs = transactionsRef.current;
          if (txs.length === 0) {
            return "Error: No transactions loaded. Use fetch_transactions first.";
          }

          const csv = toAwakenCSV(txs, target, addr);
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          const dateStr = new Date()
            .toISOString()
            .slice(0, 10)
            .replace(/-/g, "");
          a.href = url;
          const safeName = target.name.replace(/[^a-zA-Z0-9_-]/g, "_");
          a.download = `${safeName}_${addr.slice(0, 8)}_${dateStr}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          return `CSV downloaded: ${safeName}_${addr.slice(0, 8)}_${dateStr}.csv (${txs.length} transactions)`;
        }

        case "get_status": {
          const c = chainRef.current;
          const txs = transactionsRef.current;
          const rows = csvRowsRef.current;
          return `Status:\n- Chain: ${c?.name ?? "none"} (${c?.symbol ?? ""})\n- Address: ${currentAddress || "none"}\n- Transactions loaded: ${txs.length}\n- CSV rows: ${rows.length}\n- Available chains: ${allChains.length}`;
        }

        case "search_transactions": {
          const rows = csvRowsRef.current;
          if (rows.length === 0) {
            return "No transactions loaded. Use fetch_transactions first.";
          }

          const query = (args.query as string | undefined)?.toLowerCase();
          const tag = (args.tag as string | undefined)?.toLowerCase();
          const currency = (args.currency as string | undefined)?.toLowerCase();
          const dateFrom = args.date_from as string | undefined;
          const dateTo = args.date_to as string | undefined;
          const minAmount = args.min_amount as number | undefined;
          const maxAmount = args.max_amount as number | undefined;
          const offset = (args.offset as number | undefined) ?? 0;
          const PAGE_SIZE = 50;

          const matched = rows.filter((r) => {
            if (tag && r.tag.toLowerCase() !== tag) return false;
            if (currency) {
              const rc = r.receivedCurrency.toLowerCase();
              const sc = r.sentCurrency.toLowerCase();
              if (rc !== currency && sc !== currency) return false;
            }
            if (dateFrom && r.date < dateFrom) return false;
            if (dateTo && r.date > dateTo + "T23:59:59") return false;
            if (minAmount != null || maxAmount != null) {
              const recv = Math.abs(parseFloat(r.receivedAmount) || 0);
              const sent = Math.abs(parseFloat(r.sentAmount) || 0);
              const amt = Math.max(recv, sent);
              if (minAmount != null && amt < minAmount) return false;
              if (maxAmount != null && amt > maxAmount) return false;
            }
            if (query) {
              const haystack = `${r.date} ${r.receivedAmount} ${r.receivedCurrency} ${r.sentAmount} ${r.sentCurrency} ${r.feeAmount} ${r.feeCurrency} ${r.tag}`.toLowerCase();
              if (!haystack.includes(query)) return false;
            }
            return true;
          });

          const page = matched.slice(offset, offset + PAGE_SIZE);
          if (page.length === 0) {
            return `No matching transactions found (searched ${rows.length} rows).`;
          }

          const header = `Found ${matched.length} matching rows (showing ${offset + 1}–${offset + page.length}):`;
          const lines = page.map(
            (r) =>
              `${r.date} | Recv: ${r.receivedAmount} ${r.receivedCurrency} | Sent: ${r.sentAmount} ${r.sentCurrency} | Fee: ${r.feeAmount} ${r.feeCurrency} | ${r.tag}`
          );
          const footer =
            offset + PAGE_SIZE < matched.length
              ? `\n... ${matched.length - offset - PAGE_SIZE} more rows. Use offset=${offset + PAGE_SIZE} to see next page.`
              : "";
          return `${header}\n${lines.join("\n")}${footer}`;
        }

        default:
          return `Unknown tool: ${name}`;
      }
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const executeToolWithConfirmation = useCallback(
    async (
      name: string,
      args: Record<string, unknown>
    ): Promise<string> => {
      if (SAFE_TOOLS.has(name)) {
        return executeTool(name, args);
      }
      const approved = await new Promise<boolean>((resolve) => {
        setPendingTool({ name, args, resolve });
      });
      setPendingTool(null);
      if (!approved) {
        return `Action "${name}" was denied by the user.`;
      }
      return executeTool(name, args);
    },
    [executeTool]
  );

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
        executeTool: executeToolWithConfirmation,
        onStatus: setStatusMsg,
        signal: controller.signal,
      });
      setMessages([
        ...updated,
        ...toolMessages,
        { role: "assistant", content: reply },
      ]);
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

  // ── Render ──

  return (
    <div className="flex h-screen bg-[#0F0F0F] text-[#E7E5E4]">
      {/* ── Sidebar overlay (mobile) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`flex flex-col border-r border-[#2A2A2A] bg-[#171717] transition-all duration-200 ${
          sidebarOpen
            ? "fixed inset-y-0 left-0 z-40 w-72 sm:relative sm:z-auto"
            : "w-0 overflow-hidden"
        }`}
      >
        {/* Brand / nav */}
        <div className="flex items-center gap-2.5 border-b border-[#2A2A2A] px-5 py-4">
          <span className="inline-block h-2 w-2 rounded-full bg-[#C85A3E]" />
          <span className="text-sm font-bold tracking-tight text-white">
            Awaken AI
          </span>
        </div>

        {/* Config */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          <Section label="Provider">
            <select
              value={provider}
              onChange={(e) =>
                setProvider(e.target.value as "openai" | "anthropic")
              }
              className="w-full rounded-md border border-[#333] bg-[#1E1E1E] px-3 py-2 text-sm text-[#E7E5E4] focus:border-[#C85A3E] focus:outline-none focus:ring-1 focus:ring-[#C85A3E]"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </Section>

          <Section label="Model">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-md border border-[#333] bg-[#1E1E1E] px-3 py-2 text-sm text-[#E7E5E4] focus:border-[#C85A3E] focus:outline-none focus:ring-1 focus:ring-[#C85A3E]"
            >
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Section>

          <Section label="API Key">
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  provider === "openai" ? "sk-..." : "sk-ant-..."
                }
                className="flex-1 rounded-md border border-[#333] bg-[#1E1E1E] px-3 py-2 font-mono text-sm text-[#E7E5E4] focus:border-[#C85A3E] focus:outline-none focus:ring-1 focus:ring-[#C85A3E]"
              />
              {apiKey && (
                <button
                  onClick={() => setApiKey("")}
                  className="rounded-md border border-[#333] bg-[#1E1E1E] px-2 py-2 text-sm text-[#A8A29E] hover:border-[#C85A3E] hover:text-[#E7E5E4]"
                >
                  ×
                </button>
              )}
            </div>
          </Section>

          <div className="h-px bg-[#2A2A2A]" />

          {/* Current state readout */}
          <Section label="Wallet">
            <div className="rounded-md border border-[#333] bg-[#1E1E1E] px-3 py-2 font-mono text-xs text-[#A8A29E] truncate">
              {address || "Not set — AI will set it from chat"}
            </div>
          </Section>

          <Section label="Chain">
            <div className="rounded-md border border-[#333] bg-[#1E1E1E] px-3 py-2 text-xs text-[#A8A29E]">
              {chain?.name ?? "None"}{" "}
              {chain && (
                <span className="text-[#78716C]">({chain.symbol})</span>
              )}
            </div>
          </Section>

          {transactions.length > 0 && (
            <Section label="Loaded">
              <div className="rounded-md border border-[#333] bg-[#1E1E1E] px-3 py-2 text-xs text-[#A8A29E]">
                {transactions.length} txs / {csvRows.length} CSV rows
              </div>
            </Section>
          )}

          <div className="h-px bg-[#2A2A2A]" />

          {/* Tools legend */}
          <Section label="Available Tools">
            <div className="space-y-1.5 text-xs text-[#78716C]">
              {[
                ["S", "Scan chains for activity"],
                ["F", "Fetch transactions"],
                ["D", "Download CSV"],
                ["W", "Set wallet address"],
                ["L", "List all chains"],
                ["?", "Get current status"],
              ].map(([icon, desc]) => (
                <div key={icon} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded bg-[#2A2A2A] text-[10px] font-bold text-[#C85A3E]">
                    {icon}
                  </span>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Back link */}
        <div className="border-t border-[#2A2A2A] px-5 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs text-[#78716C] hover:text-[#A8A29E] transition-colors"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to CSV Exporter
          </Link>
        </div>
      </aside>

      {/* ── Main chat area ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex items-center gap-2 sm:gap-3 border-b border-[#2A2A2A] bg-[#171717] px-3 sm:px-4 py-2.5 sm:py-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded p-1 text-[#78716C] hover:bg-[#2A2A2A] hover:text-white transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">AI Mode</span>
            <span className="rounded-full bg-[#C85A3E]/20 px-2 py-0.5 text-[10px] font-semibold text-[#C85A3E]">
              AGENT
            </span>
          </div>
          <div className="flex-1" />
          {messages.length > 0 && (
            <button
              onClick={() => {
                setMessages([]);
                setError("");
                setStatusMsg("");
              }}
              className="rounded-md px-3 py-1 text-xs text-[#78716C] hover:bg-[#2A2A2A] hover:text-white transition-colors"
            >
              Clear chat
            </button>
          )}
        </header>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-2 sm:px-4 py-4 sm:py-6 space-y-1">
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-12 sm:py-24 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#C85A3E] to-[#A84A32]">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 2a8 8 0 0 1 8 8v1a8 8 0 0 1-16 0v-1a8 8 0 0 1 8-8z" />
                    <path d="M9 11.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1zM15 11.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z" />
                    <path d="M9.5 15a3.5 3.5 0 0 0 5 0" />
                    <path d="M5 3L2 6M19 3l3 3" />
                  </svg>
                </div>
                <h2 className="mb-2 text-lg sm:text-xl font-semibold text-white">
                  Blockchain AI Assistant
                </h2>
                <p className="mb-6 sm:mb-8 max-w-md text-xs sm:text-sm text-[#78716C] leading-relaxed px-4 sm:px-0">
                  I can scan chains for your wallet activity, fetch transaction
                  histories, analyze your data, and download CSV exports. Just
                  tell me your wallet address to get started.
                </p>
                <div className="flex flex-col gap-2 w-full max-w-md px-2 sm:px-0">
                  {[
                    "Which chains do I have transactions on?",
                    "Fetch and download my Ethereum transactions",
                    "Scan all chains and download everything",
                    "How much have I spent on gas fees?",
                  ].map((example) => (
                    <button
                      key={example}
                      onClick={() => {
                        setInput(example);
                        inputRef.current?.focus();
                      }}
                      className="rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] px-3 sm:px-4 py-2.5 sm:py-3 text-left text-xs sm:text-sm text-[#A8A29E] hover:border-[#C85A3E]/40 hover:bg-[#1E1E1E] hover:text-white transition-all"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className="animate-in fade-in">
                {msg.role === "status" ? (
                  <div className="flex justify-center py-1.5">
                    <details className="w-full max-w-md group">
                      <summary className="flex items-center justify-center cursor-pointer list-none">
                        <span className="flex items-center gap-1.5 rounded-full bg-[#1E1E1E] border border-[#2A2A2A] px-3 py-1 text-[11px] text-[#78716C] hover:border-[#444] transition-colors">
                          <span className="flex h-4 w-4 items-center justify-center rounded bg-[#2A2A2A] text-[9px] font-bold text-[#C85A3E]">
                            {TOOL_ICONS[msg.toolName ?? ""] ?? "T"}
                          </span>
                          {msg.content}
                          {msg.toolResult && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1 transition-transform group-open:rotate-180">
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          )}
                        </span>
                      </summary>
                      {msg.toolResult && (
                        <div className="mt-1.5 mx-auto max-w-md rounded-lg border border-[#2A2A2A] bg-[#141414] p-3 text-xs text-[#A8A29E]">
                          {msg.toolArgs && Object.keys(msg.toolArgs).length > 0 && (
                            <div className="mb-2 font-mono text-[10px] text-[#555]">
                              {Object.entries(msg.toolArgs).map(([k, v]) => (
                                <span key={k} className="mr-2">{k}: <span className="text-[#78716C]">{JSON.stringify(v)}</span></span>
                              ))}
                            </div>
                          )}
                          <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed">
                            {msg.toolResult.length > 500 ? msg.toolResult.slice(0, 500) + "..." : msg.toolResult}
                          </pre>
                        </div>
                      )}
                    </details>
                  </div>
                ) : msg.role === "user" ? (
                  <div className="flex justify-end py-2">
                    <div className="max-w-[90%] sm:max-w-[80%] rounded-2xl rounded-br-md bg-[#C85A3E] px-3 sm:px-4 py-2.5 text-sm text-white whitespace-pre-wrap">
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start py-2">
                    <div className="max-w-[90%] sm:max-w-[80%] rounded-2xl rounded-bl-md bg-[#1E1E1E] border border-[#2A2A2A] px-3 sm:px-4 py-2.5 text-sm text-[#E7E5E4] leading-relaxed ai-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Tool confirmation */}
            {pendingTool && (
              <div className="flex justify-center py-3">
                <div className="w-full max-w-md rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 sm:p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/20 text-[10px] font-bold text-amber-400">
                      {TOOL_ICONS[pendingTool.name] ?? "T"}
                    </span>
                    <span className="text-xs font-semibold text-amber-400">
                      Action requested
                    </span>
                  </div>
                  <p className="mb-3 text-sm text-amber-200">
                    {describeToolCall(pendingTool.name, pendingTool.args)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => pendingTool.resolve(true)}
                      className="rounded-lg bg-[#C85A3E] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#E07855] transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => pendingTool.resolve(false)}
                      className="rounded-lg border border-[#333] px-4 py-1.5 text-xs font-semibold text-[#78716C] hover:border-[#555] hover:text-white transition-colors"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Loading */}
            {loading && !pendingTool && (
              <div className="flex justify-center py-3">
                <span className="flex items-center gap-2 rounded-full bg-[#1E1E1E] border border-[#2A2A2A] px-4 py-2 text-xs text-[#78716C]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#C85A3E] animate-pulse" />
                  {statusMsg || "Thinking..."}
                </span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Error bar */}
        {error && (
          <div className="border-t border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs text-rose-400">
            {error}
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-[#2A2A2A] bg-[#171717] px-2 sm:px-4 py-2 sm:py-4">
          <div className="mx-auto flex max-w-3xl items-end gap-2 sm:gap-3">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  apiKey
                    ? "Message the AI..."
                    : "Enter your API key in the sidebar first"
                }
                disabled={!apiKey || loading}
                rows={1}
                className="w-full resize-none rounded-xl border border-[#333] bg-[#1E1E1E] px-4 py-3 pr-12 text-sm text-white placeholder:text-[#555] focus:border-[#C85A3E] focus:outline-none focus:ring-1 focus:ring-[#C85A3E] disabled:opacity-40"
                style={{ minHeight: "44px", maxHeight: "120px" }}
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.style.height = "auto";
                  t.style.height = Math.min(t.scrollHeight, 120) + "px";
                }}
              />
            </div>
            <button
              onClick={
                loading ? () => abortRef.current?.abort() : handleSend
              }
              disabled={!apiKey || (!loading && !input.trim())}
              className={`flex h-[44px] items-center justify-center rounded-xl px-3 sm:px-5 text-sm font-semibold transition-all ${
                loading
                  ? "bg-[#333] text-[#A8A29E] hover:bg-[#444]"
                  : "bg-[#C85A3E] text-white hover:bg-[#E07855] active:bg-[#A84A32] disabled:opacity-40"
              }`}
            >
              {loading ? "Stop" : "Send"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small section helper ──
function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-[#555]">
        {label}
      </label>
      {children}
    </div>
  );
}
