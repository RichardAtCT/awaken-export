export interface ChainConfig {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
}

export const CHAINS: Record<string, ChainConfig> = {
  chiliz: {
    id: "0x15b38",
    name: "Chiliz",
    symbol: "CHZ",
    decimals: 18,
  },
  cronos: {
    id: "0x19",
    name: "Cronos",
    symbol: "CRO",
    decimals: 18,
  },
  moonbeam: {
    id: "0x504",
    name: "Moonbeam",
    symbol: "GLMR",
    decimals: 18,
  },
  moonriver: {
    id: "0x505",
    name: "Moonriver",
    symbol: "MOVR",
    decimals: 18,
  },
  lisk: {
    id: "0x46f",
    name: "Lisk",
    symbol: "LSK",
    decimals: 18,
  },
};
