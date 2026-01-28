export const PrivacyEducation = ({
  sender,
  tempWallet
}: {
  sender: string;
  tempWallet: string;
}) => {
  return (
    <div className="mt-6 border border-indigo-500/30 bg-indigo-900/10 rounded-xl p-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 bg-indigo-600 text-xs px-2 py-1 rounded-bl text-white font-bold">
        Encrypt.trade Insight
      </div>

      <h3 className="font-bold text-indigo-300 mb-2 flex items-center gap-2">
        👁️ Como você está sendo vigiado agora?
      </h3>

      <div className="grid grid-cols-2 gap-4 text-xs mb-3">
        <div className="bg-red-900/20 p-2 rounded border border-red-500/20">
          <strong className="text-red-400 block mb-1">
            Transferência Comum:
          </strong>
          <div className="flex flex-col gap-1 text-gray-400">
            <span>
              Sua Carteira: {sender.slice(0, 4)}...{sender.slice(-4)}
            </span>
            <span className="text-center text-red-500">
              ⬇ (Link Permanente)
            </span>
            <span>
              Destino: {tempWallet.slice(0, 4)}...{tempWallet.slice(-4)}
            </span>
          </div>
        </div>

        <div className="bg-green-900/20 p-2 rounded border border-green-500/20">
          <strong className="text-green-400 block mb-1">Shadow Link:</strong>
          <div className="flex flex-col gap-1 text-gray-400">
            <span>Pool Radr (Anônimo)</span>
            <span className="text-center text-green-500">
              ⬇ (Zero Knowledge)
            </span>
            <span>
              Destino: {tempWallet.slice(0, 4)}...{tempWallet.slice(-4)}
            </span>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-300 italic">
        Ao usar ShadowWire, quebramos o link on-chain. Ferramentas de vigilância
        veem apenas que o protocolo pagou alguém, mas não sabem que veio de
        você.
      </p>
    </div>
  );
};
