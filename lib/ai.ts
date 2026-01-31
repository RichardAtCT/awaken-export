import { ChainConfig } from "./chains";
import { MergedTransaction, CsvRow } from "./types";

export interface AiConfig {
  apiKey: string;
  model: string;
  provider: "openai" | "anthropic";
}

export interface ChatMessage {
  role: "user" | "assistant" | "status";
  content: string;
}

const OPENAI_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
];

const ANTHROPIC_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-haiku-4-20250414",
  "claude-opus-4-20250514",
];

export function getModelsForProvider(provider: "openai" | "anthropic"): string[] {
  return provider === "openai" ? OPENAI_MODELS : ANTHROPIC_MODELS;
}

// ── Tool definitions ──

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  content: string;
}

const TOOLS_DESCRIPTION = [
  {
    name: "list_chains",
    description: "List all available blockchain chains the user can query. Returns chain names, symbols, and IDs.",
    parameters: { type: "object" as const, properties: {}, required: [] as string[] },
  },
  {
    name: "set_address",
    description: "Set the wallet address to query. Must be a valid 0x Ethereum-style address (42 hex chars).",
    parameters: {
      type: "object" as const,
      properties: { address: { type: "string", description: "The 0x wallet address" } },
      required: ["address"],
    },
  },
  {
    name: "scan_chains",
    description: "Scan multiple chains to find which ones have transaction activity for the current wallet address. This checks each chain's BlockScout API for any transactions. Returns a list of chains with activity.",
    parameters: {
      type: "object" as const,
      properties: {
        chain_names: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of chain names to scan. If empty, scans all chains.",
        },
      },
      required: [] as string[],
    },
  },
  {
    name: "fetch_transactions",
    description: "Fetch all transactions for the current wallet address on a specific chain. This loads the full transaction history and prepares CSV export data.",
    parameters: {
      type: "object" as const,
      properties: {
        chain_name: { type: "string", description: "The name of the chain to fetch transactions from (e.g. 'Ethereum', 'Polygon')" },
      },
      required: ["chain_name"],
    },
  },
  {
    name: "download_csv",
    description: "Trigger a CSV download of the currently loaded transactions for a specific chain.",
    parameters: {
      type: "object" as const,
      properties: {
        chain_name: { type: "string", description: "The chain name for the download" },
      },
      required: ["chain_name"],
    },
  },
  {
    name: "get_status",
    description: "Get the current status: which chain is selected, what address is entered, how many transactions are loaded, and a summary of the data.",
    parameters: { type: "object" as const, properties: {}, required: [] as string[] },
  },
];

// ── OpenAI format tools ──

function openAiTools() {
  return TOOLS_DESCRIPTION.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

// ── Anthropic format tools ──

function anthropicTools() {
  return TOOLS_DESCRIPTION.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

// ── System prompt ──

function buildSystemPrompt(
  chain: ChainConfig | undefined,
  address: string,
  transactions: MergedTransaction[],
  csvRows: CsvRow[],
  chains: ChainConfig[]
): string {
  const txSummary = transactions.length > 0
    ? `Currently ${transactions.length} transactions loaded on ${chain?.name ?? "unknown"} for address ${address}.

CSV data summary (first 30 rows):
${csvRows.slice(0, 30).map((r) =>
  `${r.date} | Recv: ${r.receivedAmount} ${r.receivedCurrency} | Sent: ${r.sentAmount} ${r.sentCurrency} | Fee: ${r.feeAmount} ${r.feeCurrency} | Tag: ${r.tag}`
).join("\n")}
${csvRows.length > 30 ? `\n... and ${csvRows.length - 30} more rows.` : ""}`
    : "No transactions currently loaded.";

  return `You are an AI assistant for the Awaken Tax CSV Exporter. You help users explore their blockchain transaction history across ${chains.length} EVM chains via BlockScout.

Current state:
- Selected chain: ${chain?.name ?? "none"} (${chain?.symbol ?? ""})
- Wallet address: ${address || "none"}
- ${txSummary}

You have tools to:
1. list_chains — see all available chains
2. set_address — set the wallet address
3. scan_chains — scan chains to find which ones have activity for the wallet
4. fetch_transactions — fetch full transaction history on a chain
5. download_csv — download the CSV for a chain
6. get_status — check current state

IMPORTANT BEHAVIOR:
- When a user provides a wallet address, use set_address first.
- When asked "which chains do I have transactions on", use scan_chains to check. You can pass specific chain names or scan all.
- When asked to download or fetch transactions, use fetch_transactions then download_csv.
- When asked to download from ALL chains with activity, scan first, then fetch+download each chain sequentially.
- Always confirm actions before doing large operations (scanning all 40+ chains).
- Be concise. Use markdown for structure.`;
}

// ── Main entry: agentic loop ──

export type ToolExecutor = (name: string, args: Record<string, unknown>) => Promise<string>;

export interface SendOptions {
  config: AiConfig;
  messages: ChatMessage[];
  chain: ChainConfig | undefined;
  address: string;
  transactions: MergedTransaction[];
  csvRows: CsvRow[];
  chains: ChainConfig[];
  executeTool: ToolExecutor;
  onStatus: (msg: string) => void;
  signal?: AbortSignal;
}

export async function sendChatMessage(opts: SendOptions): Promise<{ reply: string; toolMessages: ChatMessage[] }> {
  const systemPrompt = buildSystemPrompt(opts.chain, opts.address, opts.transactions, opts.csvRows, opts.chains);
  const toolMessages: ChatMessage[] = [];

  if (opts.config.provider === "anthropic") {
    return anthropicLoop(opts, systemPrompt, toolMessages);
  }
  return openAiLoop(opts, systemPrompt, toolMessages);
}

// ── OpenAI agentic loop ──

async function openAiLoop(
  opts: SendOptions,
  systemPrompt: string,
  toolMessages: ChatMessage[]
): Promise<{ reply: string; toolMessages: ChatMessage[] }> {
  // Build initial messages array for the API
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiMessages: any[] = [
    { role: "system", content: systemPrompt },
    ...opts.messages.filter((m) => m.role !== "status").map((m) => ({ role: m.role, content: m.content })),
  ];

  const MAX_TURNS = 15;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.config.apiKey}` },
      body: JSON.stringify({
        model: opts.config.model,
        messages: apiMessages,
        tools: openAiTools(),
        max_tokens: 2048,
      }),
      signal: opts.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI API error ${res.status}: ${body}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice) throw new Error("No response from OpenAI");

    const msg = choice.message;
    apiMessages.push(msg);

    // If no tool calls, return the text
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { reply: msg.content ?? "Done.", toolMessages };
    }

    // Execute tool calls
    for (const tc of msg.tool_calls) {
      const name = tc.function.name;
      const args = JSON.parse(tc.function.arguments || "{}");
      opts.onStatus(`Running ${name}...`);
      toolMessages.push({ role: "status", content: `Running ${name}...` });

      const result = await opts.executeTool(name, args);

      apiMessages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }
  }

  return { reply: "Reached maximum tool call iterations.", toolMessages };
}

// ── Anthropic agentic loop ──

async function anthropicLoop(
  opts: SendOptions,
  systemPrompt: string,
  toolMessages: ChatMessage[]
): Promise<{ reply: string; toolMessages: ChatMessage[] }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const apiMessages: any[] = opts.messages
    .filter((m) => m.role !== "status")
    .map((m) => ({ role: m.role, content: m.content }));

  const MAX_TURNS = 15;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": opts.config.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: opts.config.model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: apiMessages,
        tools: anthropicTools(),
      }),
      signal: opts.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${body}`);
    }

    const data = await res.json();

    // Collect text and tool_use blocks
    const textParts: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolUseBlocks: any[] = [];

    for (const block of data.content) {
      if (block.type === "text") textParts.push(block.text);
      if (block.type === "tool_use") toolUseBlocks.push(block);
    }

    // Add the assistant message to conversation
    apiMessages.push({ role: "assistant", content: data.content });

    // If no tool use, return
    if (toolUseBlocks.length === 0 || data.stop_reason === "end_turn") {
      return { reply: textParts.join("\n") || "Done.", toolMessages };
    }

    // Execute tool calls and build tool_result content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolResults: any[] = [];
    for (const block of toolUseBlocks) {
      opts.onStatus(`Running ${block.name}...`);
      toolMessages.push({ role: "status", content: `Running ${block.name}...` });

      const result = await opts.executeTool(block.name, block.input ?? {});
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }

    apiMessages.push({ role: "user", content: toolResults });
  }

  return { reply: "Reached maximum tool call iterations.", toolMessages };
}
