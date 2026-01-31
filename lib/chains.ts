export interface ChainConfig {
  chainId: string;
  name: string;
  symbol: string;
  decimals: number;
  apiUrl: string;
  logo: string;
}

interface ChainScoutEntry {
  name: string;
  isTestnet: boolean;
  native_currency: string;
  logo: string;
  explorers: { url: string; hostedBy: string }[];
}

const CHAINSCOUT_URL =
  "https://raw.githubusercontent.com/blockscout/chainscout/main/data/chains.json";

let cachedChains: ChainConfig[] | null = null;

export async function fetchChains(): Promise<ChainConfig[]> {
  if (cachedChains) return cachedChains;

  const res = await fetch(CHAINSCOUT_URL);
  if (!res.ok) throw new Error("Failed to fetch chain list");

  const data: Record<string, ChainScoutEntry> = await res.json();
  const chains: ChainConfig[] = [];

  for (const [chainId, entry] of Object.entries(data)) {
    const hosted = entry.explorers?.find((e) => e.hostedBy === "blockscout");
    if (!hosted) continue;

    const apiUrl = hosted.url.replace(/\/$/, "") + "/api";

    chains.push({
      chainId,
      name: entry.name,
      symbol: entry.native_currency || "ETH",
      decimals: 18,
      apiUrl,
      logo: entry.logo || "",
    });
  }

  chains.sort((a, b) => a.name.localeCompare(b.name));
  cachedChains = chains;
  return chains;
}
