"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChainConfig, fetchChains } from "@/lib/chains";
import { fetchAllTransactions, AbortedWithData } from "@/lib/blockscout";
import { transactionsToCsvRows } from "@/lib/csv";
import { MergedTransaction, CsvRow } from "@/lib/types";
import ChainSelector from "@/components/ChainSelector";
import AddressInput from "@/components/AddressInput";
import TransactionTable from "@/components/TransactionTable";
import DownloadButton from "@/components/DownloadButton";
import AiMode from "@/components/AiMode";

export default function Home() {
  const [chains, setChains] = useState<ChainConfig[]>([]);
  const [chainId, setChainId] = useState("");
  const [address, setAddress] = useState("");
  const [addressError, setAddressError] = useState("");
  const [transactions, setTransactions] = useState<MergedTransaction[]>([]);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetchChains()
      .then((c) => {
        setChains(c);
        if (c.length > 0 && !chainId) {
          const eth = c.find((ch) => ch.name === "Ethereum");
          setChainId(eth ? eth.chainId : c[0].chainId);
        }
      })
      .catch((e) => setError(`Failed to load chains: ${e.message}`));
  }, []);

  const chain = chains.find((c) => c.chainId === chainId);

  function validateAddress(addr: string): boolean {
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      setAddressError("Address must be a valid 42-character hex address (0x...)");
      return false;
    }
    setAddressError("");
    return true;
  }

  async function handleFetch() {
    if (!chain) return;
    if (!validateAddress(address)) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");
    setTransactions([]);
    setCsvRows([]);
    setProgressMsg("Starting...");

    try {
      const txs = await fetchAllTransactions(
        chain,
        address,
        (msg) => setProgressMsg(msg),
        controller.signal
      );
      setTransactions(txs);
      setCsvRows(transactionsToCsvRows(txs, chain, address));
      setProgressMsg(`Done — ${txs.length} transactions`);
    } catch (e) {
      if (e instanceof AbortedWithData) {
        setTransactions(e.transactions);
        setCsvRows(transactionsToCsvRows(e.transactions, chain, address));
        setProgressMsg(`Stopped — ${e.transactions.length} transactions`);
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

  const aiActions = useMemo(() => ({
    setAddress,
    setChainId,
    setTransactions,
    setCsvRows,
  }), []);

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
          Export wallet transactions to Awaken Tax format for {chains.length} EVM
          chains via BlockScout.
        </p>
      </div>

      {/* Card */}
      <div className="rounded-md border border-[#E7E5E4] bg-white p-6 sm:p-8">
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ChainSelector
              chains={chains}
              value={chainId}
              onChange={setChainId}
            />
            <AddressInput
              value={address}
              onChange={setAddress}
              error={addressError}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleFetch}
              disabled={loading || !chain}
              className={`rounded-md px-6 py-2.5 text-sm font-semibold text-white ${
                loading || !chain
                  ? "bg-[#C85A3E]/70"
                  : "bg-[#C85A3E] hover:bg-[#E07855] active:bg-[#A84A32]"
              }`}
            >
              {loading ? "Fetching..." : "Fetch Transactions"}
            </button>
            {loading && (
              <button
                onClick={handleCancel}
                className="rounded-md border border-[#E7E5E4] px-4 py-2.5 text-sm font-medium text-[#78716C] hover:border-[#D6D3D1]"
              >
                Stop
              </button>
            )}
            {progressMsg && (
              <span className="text-sm text-[#78716C]">{progressMsg}</span>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          {chain && (
            <DownloadButton
              transactions={transactions}
              chain={chain}
              address={address}
            />
          )}

          <AiMode
            chains={chains}
            chain={chain}
            address={address}
            transactions={transactions}
            csvRows={csvRows}
            actions={aiActions}
          />

          <TransactionTable rows={csvRows} />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-6 text-xs text-[#A8A29E]">
        Powered by BlockScout API | Data exported in Awaken Tax format |{" "}
        <a
          href="https://github.com/RichardAtCT/awaken-export"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-[#78716C]"
        >
          Open source
        </a>{" "}
        — contributions welcome
      </div>
    </main>
  );
}
