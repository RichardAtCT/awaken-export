import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-moralis-key");
  if (!apiKey) {
    return NextResponse.json(
      { valid: false, error: "Missing API key" },
      { status: 400 },
    );
  }

  try {
    const res = await fetch("https://deep-index.moralis.io/api/v2.2/web3/version", {
      headers: { "X-API-Key": apiKey },
    });

    if (res.ok) {
      return NextResponse.json({ valid: true });
    }

    const body = await res.text();
    console.error("Moralis health check failed:", res.status, body);
    return NextResponse.json(
      { valid: false, error: `Moralis returned ${res.status}` },
      { status: 200 },
    );
  } catch (err) {
    return NextResponse.json(
      { valid: false, error: err instanceof Error ? err.message : "Network error" },
      { status: 200 },
    );
  }
}
