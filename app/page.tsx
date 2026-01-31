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
    <main className="relative z-10 mx-auto max-w-4xl px-4 py-12">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mb-4 inline-flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Awaken Tax CSV Exporter
          </h1>
        </div>
        <p className="text-sm text-gray-400">
          Export wallet transactions to Awaken Tax format for Chiliz, Cronos,
          Moonbeam, Moonriver, and Lisk.
        </p>
      </div>

      {/* Glass Card */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm sm:p-8">
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
            className={`relative rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-2.5 text-sm font-medium text-white transition-all duration-200 hover:from-indigo-400 hover:to-violet-400 disabled:opacity-50 ${loading ? "animate-progress-pulse" : "hover:shadow-lg hover:shadow-indigo-500/25"}`}
          >
            {loading ? `Fetching... (${progress} found)` : "Fetch Transactions"}
          </button>

          {loading && progress > 0 && (
            <div className="h-1 overflow-hidden rounded-full bg-white/5">
              <div className="animate-progress-pulse h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-300" style={{ width: "100%" }} />
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
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
      </div>

      {/* Footer */}
      <div className="mt-6 text-center text-xs text-gray-600">
        Powered by Moralis API &middot; Data exported in Awaken Tax format
      </div>
    </main>
  );
}
