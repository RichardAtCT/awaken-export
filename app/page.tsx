"use client";

import { useState, useCallback } from "react";
import { CHAINS } from "@/lib/chains";
import { fetchTransactions } from "@/lib/moralis";
import { transactionsToCsvRows } from "@/lib/csv";
import { Transaction, CsvRow } from "@/lib/types";
import ApiKeyInput from "@/components/ApiKeyInput";
import ChainSelector from "@/components/ChainSelector";
import AddressInput from "@/components/AddressInput";
import TransactionTable from "@/components/TransactionTable";
import DownloadButton from "@/components/DownloadButton";

export default function Home() {
  const [apiKey, setApiKey] = useState("");
  const [chainKey, setChainKey] = useState("chiliz");
  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  const chain = CHAINS[chainKey];

  const onKeyChange = useCallback((key: string) => setApiKey(key), []);

  function validateAddress(addr: string): boolean {
    if (!addr.startsWith("0x") || addr.length !== 42) {
      setAddressError("Address must start with 0x and be 42 characters");
      return false;
    }
    setAddressError("");
    return true;
  }

  async function handleFetch() {
    if (!apiKey) {
      setError("Please save your Moralis API key first");
      return;
    }
    if (!validateAddress(address)) return;

    setLoading(true);
    setError("");
    setTransactions([]);
    setCsvRows([]);
    setProgress(0);

    try {
      const txs = await fetchTransactions(address, chain.id, apiKey, (count) =>
        setProgress(count)
      );
      setTransactions(txs);
      setCsvRows(transactionsToCsvRows(txs, chain));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-bold">Awaken Tax CSV Exporter</h1>
      <p className="mb-8 text-sm text-gray-500">
        Export wallet transactions to Awaken Tax format for Chiliz, Cronos,
        Moonbeam, Moonriver, and Lisk.
      </p>

      <div className="space-y-6">
        <ApiKeyInput onKeyChange={onKeyChange} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ChainSelector value={chainKey} onChange={setChainKey} />
          <AddressInput
            value={address}
            onChange={setAddress}
            error={addressError}
          />
        </div>

        <button
          onClick={handleFetch}
          disabled={loading}
          className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? `Fetching... (${progress} found)` : "Fetch Transactions"}
        </button>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <DownloadButton
          transactions={transactions}
          chain={chain}
          address={address}
        />

        <TransactionTable rows={csvRows} />
      </div>
    </main>
  );
}
