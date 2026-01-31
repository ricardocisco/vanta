import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { address } = await req.json();

  // Removido: endereço hardcoded para testes
  // address = "TVacWx7F5wgMgn49L5frDf9KLgdYy8nPHL";

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
      console.error(">>>> RANGE API Error:", response.status, response.statusText);
      return NextResponse.json({ allowed: false, error: "Risk check failed" }, { status: response.status });
    }

    const data = await response.json();

    console.log(">>>> RESPOSTA DA RANGE API:", data);

    // Nova estrutura: riskScore (0-10) e riskLevel como string descritiva
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
