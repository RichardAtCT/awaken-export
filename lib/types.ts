export interface NativeTransfer {
  from_address: string;
  to_address: string;
  value: string;
  value_formatted: string;
  token_symbol: string;
  direction: "incoming" | "outgoing";
}

export interface ERC20Transfer {
  from_address: string;
  to_address: string;
  value: string;
  value_formatted: string;
  token_symbol: string;
  token_name: string;
  token_decimals: string;
  direction: "incoming" | "outgoing";
  address: string;
}

export interface Transaction {
  hash: string;
  block_timestamp: string;
  from_address: string;
  to_address: string;
  value: string;
  gas_price: string;
  receipt_gas_used: string;
  category: string;
  summary: string;
  native_transfers: NativeTransfer[];
  erc20_transfers: ERC20Transfer[];
}

export interface MoralisResponse {
  cursor: string | null;
  result: Transaction[];
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
