"use client";

import { useState, useCallback, useRef } from "react";
import { CHAINS } from "@/lib/chains";
import { fetchTransactions, AbortedWithData } from "@/lib/moralis";
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
  const [limit, setLimit] = useState<number>(0);
  const abortRef = useRef<AbortController | null>(null);

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

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");
    setTransactions([]);
    setCsvRows([]);
    setProgress(0);

    try {
      const txs = await fetchTransactions(
        address, chain.id, apiKey,
        (count) => setProgress(count),
        controller.signal,
        limit || undefined
      );
      setTransactions(txs);
      setCsvRows(transactionsToCsvRows(txs, chain));
    } catch (e) {
      if (e instanceof AbortedWithData) {
        setTransactions(e.transactions);
        setCsvRows(transactionsToCsvRows(e.transactions, chain));
      } else {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    } finally {
      abortRef.current = null;
      setLoading(false);
    }
  }

  function handleCancel() {
    abortRef.current?.abort();
  }

  return (
    <main className="relative mx-auto max-w-4xl px-4 py-12">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-2.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#C85A3E]" />
          <h1 className="text-[28px] font-bold tracking-tight text-[#1C1917]">
            Awaken Tax CSV Exporter
          </h1>
        </div>
        <p className="text-sm text-[#78716C]">
          Export wallet transactions to Awaken Tax format for Chiliz, Cronos,
          Moonbeam, Moonriver, and Lisk.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-md border border-[#E7E5E4] bg-white p-6 sm:p-8">
        <div className="space-y-6">
          <ApiKeyInput onKeyChange={onKeyChange} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ChainSelector value={chainKey} onChange={setChainKey} />
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#44403C]">
                Limit
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="w-full rounded-md border border-[#E7E5E4] bg-white px-3 py-2.5 text-sm text-[#1C1917] focus:border-[#C85A3E] focus:outline-none focus:ring-1 focus:ring-[#C85A3E]"
              >
                <option value={0}>All</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
                <option value={1000}>1,000</option>
                <option value={5000}>5,000</option>
              </select>
            </div>
            <AddressInput
              value={address}
              onChange={setAddress}
              error={addressError}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleFetch}
              disabled={loading}
              className={`rounded-md px-6 py-2.5 text-sm font-semibold text-white ${
                loading
                  ? "bg-[#C85A3E]/70"
                  : "bg-[#C85A3E] hover:bg-[#E07855] active:bg-[#A84A32]"
              }`}
            >
              {loading ? `Fetching... (${progress} found)` : "Fetch Transactions"}
            </button>
            {loading && (
              <button
                onClick={handleCancel}
                className="rounded-md border border-[#E7E5E4] px-4 py-2.5 text-sm font-medium text-[#78716C] hover:border-[#D6D3D1]"
              >
                Stop
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
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
      <div className="mt-6 text-xs text-[#A8A29E]">
        Powered by Moralis API | Data exported in Awaken Tax format
      </div>
    </main>
  );
}
