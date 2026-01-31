import { NextRequest, NextResponse } from "next/server";
import { CHAINS } from "@/lib/chains";

const VALID_CHAIN_IDS = new Set(Object.values(CHAINS).map((c) => c.id));
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const CURSOR_RE = /^[a-zA-Z0-9_\-:.]{1,512}$/;

export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-moralis-key");
  const address = request.nextUrl.searchParams.get("address");
  const chain = request.nextUrl.searchParams.get("chain");
  const cursor = request.nextUrl.searchParams.get("cursor");

  if (!apiKey) {
    return NextResponse.json({ error: "API key required" }, { status: 401 });
  }
  if (!address || !chain) {
    return NextResponse.json(
      { error: "address and chain required" },
      { status: 400 }
    );
  }
  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json({ error: "Invalid address format" }, { status: 400 });
  }
  if (!VALID_CHAIN_IDS.has(chain)) {
    return NextResponse.json({ error: "Unsupported chain" }, { status: 400 });
  }
  if (cursor && !CURSOR_RE.test(cursor)) {
    return NextResponse.json({ error: "Invalid cursor format" }, { status: 400 });
  }

  const url = new URL(
    `https://deep-index.moralis.io/api/v2.2/wallets/${encodeURIComponent(address)}/history`
  );
  url.searchParams.set("chain", chain);
  url.searchParams.set("limit", "100");
  url.searchParams.set("order", "DESC");
  if (cursor) url.searchParams.set("cursor", cursor);

  const res = await fetch(url.toString(), {
    headers: { "X-API-Key": apiKey },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
