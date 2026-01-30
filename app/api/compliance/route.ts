import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { address } = await req.json();

  try {
    const response = await fetch(`https://api.range.org/v1/compliance/screen`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.RANGE_API_KEY || ""
      },
      body: JSON.stringify({
        address: address,
        chain: "solana"
      })
    });

    const data = await response.json();

    if (data.risk_level === "HIGH" || data.risk_level === "CRITICAL") {
      return NextResponse.json(
        { allowed: false, reason: "High Risk" },
        { status: 403 }
      );
    }

    return NextResponse.json({ allowed: true });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { allowed: false, error: "Check failed" },
      { status: 500 }
    );
  }
}
