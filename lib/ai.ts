import { ChainConfig } from "./chains";
import { MergedTransaction, CsvRow } from "./types";

export interface AiConfig {
  apiKey: string;
  model: string;
  provider: "openai" | "anthropic";
}

export interface ChatMessage {
  role: "user" | "assistant";
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

function buildSystemPrompt(
  chain: ChainConfig | undefined,
  address: string,
  transactions: MergedTransaction[],
  csvRows: CsvRow[]
): string {
  const txSummary = transactions.length > 0
    ? `The user has ${transactions.length} transactions loaded on ${chain?.name ?? "unknown chain"} for address ${address}.

Here is a summary of the CSV data (first 50 rows):
${csvRows.slice(0, 50).map((r) =>
  `${r.date} | Recv: ${r.receivedAmount} ${r.receivedCurrency} | Sent: ${r.sentAmount} ${r.sentCurrency} | Fee: ${r.feeAmount} ${r.feeCurrency} | Tag: ${r.tag}`
).join("\n")}
${csvRows.length > 50 ? `\n... and ${csvRows.length - 50} more rows.` : ""}

Transaction hashes available: ${transactions.slice(0, 20).map((t) => t.hash).join(", ")}${transactions.length > 20 ? ` ... and ${transactions.length - 20} more` : ""}`
    : "No transactions are currently loaded.";

  return `You are an AI assistant for the Awaken Tax CSV Exporter tool. You help users understand their blockchain transaction data.

Current context:
- Chain: ${chain?.name ?? "none selected"} (${chain?.symbol ?? ""})
- Chain API URL: ${chain?.apiUrl ?? "none"}
- Wallet address: ${address || "none entered"}
- ${txSummary}

You can help users:
1. Analyze their transaction history (fees paid, tokens traded, etc.)
2. Explain specific transactions
3. Summarize their activity (total sent/received, most interacted tokens, etc.)
4. Answer questions about the CSV export data
5. Provide general blockchain knowledge

Keep responses concise and useful. Format numbers clearly. Use markdown for structure when helpful.`;
}

export async function sendChatMessage(
  config: AiConfig,
  messages: ChatMessage[],
  chain: ChainConfig | undefined,
  address: string,
  transactions: MergedTransaction[],
  csvRows: CsvRow[],
  signal?: AbortSignal
): Promise<string> {
  const systemPrompt = buildSystemPrompt(chain, address, transactions, csvRows);

  if (config.provider === "anthropic") {
    return sendAnthropic(config, systemPrompt, messages, signal);
  }
  return sendOpenAI(config, systemPrompt, messages, signal);
}

async function sendOpenAI(
  config: AiConfig,
  systemPrompt: string,
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      max_tokens: 2048,
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "No response generated.";
}

async function sendAnthropic(
  config: AiConfig,
  systemPrompt: string,
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
    signal,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? "No response generated.";
}
