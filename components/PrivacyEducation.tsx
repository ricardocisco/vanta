"use client";
import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Eye, Gift, Scissors, ShieldX, TriangleAlert, User } from "lucide-react";

interface PrivacyEducationProps {
  sender?: string;
  tempWallet?: string;
}

export const PrivacyEducation = ({ sender }: PrivacyEducationProps) => {
  const { connection } = useConnection();
  const [publicData, setPublicData] = useState({
    balance: "...",
    txCount: 0,
    riskLevel: "ANALISANDO..."
  });
  const [expanded, setExpanded] = useState(false);

  // Efeito "Creepy": Mostra que sabemos tudo sobre a carteira dele
  useEffect(() => {
    if (!sender) return;

    const fetchPublicData = async () => {
      try {
        // Valida se é um endereço base58 válido antes de tentar criar PublicKey
        // Verifica se tem o tamanho correto (32-44 chars) e não tem caracteres inválidos
        if (sender.length < 32 || sender.length > 44 || !/^[1-9A-HJ-NP-Za-km-z]+$/.test(sender)) {
          return; // Silenciosamente ignora se não for um endereço válido
        }

        const pubKey = new PublicKey(sender);

        // 1. Pega o saldo (Isso é público)
        const balance = await connection.getBalance(pubKey);

        // 2. Pega contagem de transações recentes (Isso é público)
        // Helius RPC é ótimo para isso
        const signatures = await connection.getSignaturesForAddress(pubKey, {
          limit: 10
        });

        setPublicData({
          balance: (balance / LAMPORTS_PER_SOL).toFixed(2),
          txCount: signatures.length,
          riskLevel: signatures.length > 0 ? "ALTA EXPOSIÇÃO" : "BAIXA EXPOSIÇÃO"
        });
      } catch (e) {
        // Silencia erros de endereço inválido
        console.debug("PrivacyEducation: endereço inválido ou erro de rede");
      }
    };

    fetchPublicData();
  }, [sender, connection]);

  return (
    <div className="mt-6 rounded-xl overflow-hidden border border-gray-800 bg-[#0a0a0a] transition-all">
      {/* HEADER: O "Susto" (Track 1 Requirement) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex justify-between items-center bg-gray-900/50 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3 text-left">
          <div className="w-8 h-8 rounded-full bg-red-900/20 flex items-center justify-center text-lg">
            <Eye />
          </div>
          <div>
            <h4 className="text-gray-200 font-bold text-xs uppercase tracking-wider">
              Encrypt.trade: Análise de Vigilância
            </h4>
            <p className="text-[10px] text-gray-500">Seus dados atuais estão visíveis publicamente.</p>
          </div>
        </div>
        <span className="text-gray-500 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* CONTEÚDO EXPANDIDO */}
      {expanded && (
        <div className="p-4 border-t border-gray-800 animate-fade-in">
          {/* PARTE 1: O PROBLEMA (Mostra os dados do usuário) */}
          <div className="mb-4 p-3 bg-red-900/10 border border-red-500/20 rounded-lg">
            <p className="text-[10px] text-red-400 font-bold uppercase mb-2 flex items-center gap-2">
              <span>
                <TriangleAlert size={18} />
              </span>
              O que a Blockchain vê agora (Sua Carteira):
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-300 font-mono">
              <div className="bg-black/30 p-2 rounded">
                <span className="text-gray-500 block text-[9px]">SALDO VISÍVEL</span>
                {publicData.balance} SOL
              </div>
              <div className="bg-black/30 p-2 rounded">
                <span className="text-gray-500 block text-[9px]">RÁSTRO DE ATIVIDADE</span>
                {publicData.txCount}+ Transações
              </div>
              <div className="col-span-2 bg-black/30 p-2 rounded flex justify-between items-center">
                <span className="text-gray-500 text-[9px]">NÍVEL DE VIGILÂNCIA</span>
                <span className="text-red-400 font-bold">{publicData.riskLevel}</span>
              </div>
            </div>
            <p className="text-[9px] text-gray-500 mt-2 italic">
              *Bots e rastreadores podem vincular esse endereço ao seu IP e perfil social.
            </p>
          </div>

          {/* PARTE 2: A SOLUÇÃO (Seu visual atual - Track 2) */}
          <div className="relative p-3 bg-green-900/10 border border-green-500/20 rounded-lg">
            <p className="text-[10px] text-green-400 font-bold uppercase mb-2 flex items-center gap-2">
              <span>
                <ShieldX size={18} />
              </span>
              Com Vanta Link:
            </p>

            <div className="space-y-3">
              {/* Visualização do Fluxo */}
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <div className="flex flex-col items-center">
                  <span className="mb-1 text-red-400">Você</span>
                  <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-xs">
                    <User />
                  </div>
                </div>

                {/* Linha Tracejada (Quebrada) */}
                <div className="flex-1 px-2 relative h-1">
                  <div className="absolute top-0 left-0 w-1/2 h-full bg-red-500/30"></div>
                  <div className="absolute -top-1.5 left-[45%] bg-[#0a0a0a] border border-green-500 text-green-500 rounded-full flex items-center justify-center z-10">
                    <Scissors size={18} />
                  </div>
                  <div className="absolute top-0 right-0 w-1/2 h-full bg-green-500/30"></div>
                </div>

                <div className="flex flex-col items-center">
                  <span className="mb-1 text-green-400">Destino</span>
                  <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center text-xs">
                    <Gift />
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-gray-300 leading-relaxed">
                O Vanta Link age como um &quot;Firewall Financeiro&quot;. O dinheiro sai do Pool, não da sua carteira.
                <span className="text-green-400 font-bold">
                  {" "}
                  O link entre remetente e recebedor é matematicamente quebrado (ZK).
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
