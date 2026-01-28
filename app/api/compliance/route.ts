import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { address } = await req.json();

  try {
    // Exemplo de chamada à Range (ajuste conforme a doc oficial da API deles)
    const response = await fetch(`https://api.range.org/v1/compliance/screen`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": process.env.RANGE_API_KEY || "" // Coloque no .env.local
      },
      body: JSON.stringify({
        address: address,
        chain: "solana"
      })
    });

    const data = await response.json();

    // Lógica simplificada: Se risco for alto, bloqueia
    if (data.risk_level === "HIGH" || data.risk_level === "CRITICAL") {
      return NextResponse.json(
        { allowed: false, reason: "High Risk" },
        { status: 403 }
      );
    }

    return NextResponse.json({ allowed: true });
  } catch (error) {
    console.error(error);
    // Em hackathon, se a API falhar, geralmente deixamos passar ou travamos.
    // Aqui vou travar por segurança.
    return NextResponse.json(
      { allowed: false, error: "Check failed" },
      { status: 500 }
    );
  }
}
