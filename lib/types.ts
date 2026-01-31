export interface BlockScoutTx {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gasPrice: string;
  gasUsed: string;
  isError: string;
  functionName: string;
  input: string;
}

export interface BlockScoutTokenTx {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
}

export interface BlockScoutInternalTx {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  isError: string;
}

export interface Transfer {
  direction: "in" | "out";
  amount: string;
  currency: string;
  decimals: number;
}

export interface MergedTransaction {
  hash: string;
  timestamp: number;
  from: string;
  to: string;
  isError: boolean;
  gasPrice: string;
  gasUsed: string;
  functionName: string;
  input: string;
  transfers: Transfer[];
}

export interface CsvRow {
  date: string;
  receivedAmount: string;
  receivedCurrency: string;
  sentAmount: string;
  sentCurrency: string;
  feeAmount: string;
  feeCurrency: string;
  tag: string;
}
