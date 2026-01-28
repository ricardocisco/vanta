export const SurveillanceCam = ({ isActive }: { isActive: boolean }) => {
  if (!isActive) return null;
  return (
    <div className="mt-4 p-3 bg-gray-900 rounded border border-gray-700">
      <h4 className="text-[10px] uppercase text-gray-500 font-bold mb-2 flex items-center gap-1">
        👁️ Encrypt.trade: Visão do Observador
      </h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="opacity-50">
          <p className="text-red-400 font-mono">Blockchain Pública:</p>
          <div className="h-1 w-full bg-red-900/30 mt-1 rounded overflow-hidden">
            <div className="h-full bg-red-500/50 w-full animate-pulse"></div>
          </div>
          <p className="mt-1 text-[9px] text-gray-400">
            Rastreado: Origem &rarr; Destino
          </p>
        </div>
        <div>
          <p className="text-green-400 font-bold font-mono">
            Shadow Mode (Ativo):
          </p>
          <div className="h-1 w-full bg-green-900/30 mt-1 rounded overflow-hidden">
            <div className="h-full bg-green-500 w-full"></div>
          </div>
          <p className="mt-1 text-[9px] text-gray-300">
            Link Quebrado: Pool &rarr; Destino
          </p>
        </div>
      </div>
    </div>
  );
};
