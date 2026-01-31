import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { address } = await req.json();

  if (!address) {
    return NextResponse.json({ allowed: false, error: "Address is required" }, { status: 400 });
  }

  try {
    const url = new URL("https://api.range.org/v1/risk/address");
    url.searchParams.set("network", "solana");
    url.searchParams.set("address", address);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.RANGE_API_KEY || ""
      }
    });

    if (!response.ok) {
      return NextResponse.json({ allowed: false, error: "Risk check failed" }, { status: response.status });
    }

    const data = await response.json();

    // New structure: riskScore (0-10) and riskLevel as descriptive string
    // Ex: "CRITICAL RISK (Directly malicious)", "HIGH RISK", etc.
    const isHighRisk =
      data.riskScore >= 7 ||
      data.riskLevel?.toUpperCase().includes("HIGH") ||
      data.riskLevel?.toUpperCase().includes("CRITICAL");

    if (isHighRisk) {
      return NextResponse.json(
        {
          allowed: false,
          reason: data.riskLevel || "High Risk",
          riskScore: data.riskScore,
          detail: data
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ allowed: true, riskScore: data.riskScore, detail: data });
  } catch (error) {
    console.error(error);

    return NextResponse.json({ allowed: false, error: "Check failed" }, { status: 500 });
  }
}
