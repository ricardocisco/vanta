// utils/tokens.ts

export interface TokenOption {
  symbol: string;
  name: string;
  decimals: number;
  mintAddress: string; // Endereço do Contrato na Mainnet
  icon: string; // URL do logo
  fee: string; // Taxa do ShadowWire (Informativo)
}

// Base URLs para logos (usando serviços confiáveis como GitHub do Solana Labs, Jup.ag ou CoinGecko)
// Para tokens novos, muitas vezes o ícone vem direto do metadata do IPFS, aqui usamos uma referência segura.
const LOGO_BASE_SOLANA =
  "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet";
const JUPITER_CDN = "https://static.jup.ag/tokens";

export const SUPPORTED_TOKENS: TokenOption[] = [
  // --- Principais / Infraestrutura ---
  {
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    mintAddress: "So11111111111111111111111111111111111111112",
    icon: "https://cryptologos.cc/logos/solana-sol-logo.png?v=029",
    fee: "0.5%"
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    mintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    icon: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png?v=029",
    fee: "1%"
  },
  {
    symbol: "USD1",
    name: "World Liberty Financial USD",
    decimals: 6,
    mintAddress: "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB",
    icon: `${JUPITER_CDN}/USD1.png`, // Placeholder genérico
    fee: "1%"
  },
  {
    symbol: "ZEC",
    name: "ZCash (Portal/Wormhole)",
    decimals: 9,
    mintAddress: "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs", // Portal Wrapped ZEC mais comum
    icon: "https://cryptologos.cc/logos/zcash-zec-logo.png?v=029",
    fee: "1%"
  },

  // --- Memes & Comunidade (Identificados) ---
  {
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
    mintAddress: "dezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    icon: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I",
    fee: "1%"
  },
  {
    symbol: "ORE",
    name: "Ore",
    decimals: 11,
    mintAddress: "oreV2ZymfyeXgNgBdqMkumTqqDIBeQnZAue3wFL1",
    icon: `${LOGO_BASE_SOLANA}/oreV2ZymfyeXgNgBdqMkumTqqDIBeQnZAue3wFL1/logo.png`,
    fee: "0.3%"
  },
  {
    symbol: "AOL",
    name: "America Online",
    decimals: 6,
    mintAddress: "2oQNkePakuPbHzrVVkQ875WHeewLHCd2cAwfwiLQbonk",
    icon: "https://cf-ipfs.com/ipfs/QmZp...PLACEHOLDER_AOL",
    fee: "1%"
  },
  {
    symbol: "ANON",
    name: "Anon",
    decimals: 9,
    mintAddress: "3GJD7p3HpSjpB4ZuhhnhThrA4AQG2nq6JcahMm56bonk",
    icon: `${JUPITER_CDN}/ANON.png`,
    fee: "1%"
  },
  {
    symbol: "SANA",
    name: "Sana",
    decimals: 6,
    mintAddress: "CT5c8Y7B5FBdL88k6kz21pS3NDM5ojQ13Kzem7Srpump",
    icon: `${JUPITER_CDN}/SANA.png`,
    fee: "1%"
  },
  {
    symbol: "POKI",
    name: "Poki",
    decimals: 9,
    mintAddress: "6vK6cL9C66Bsqw7SC2hcCdkgm1UKBDUE6DCYJ4kubonk",
    icon: `${JUPITER_CDN}/POKI.png`,
    fee: "1%"
  },
  {
    symbol: "HOSICO",
    name: "Hosico Cat",
    decimals: 9,
    mintAddress: "9wk8yn6iz1ie5kejkvzctxyn1x5stdnfx8yemy8ebonk",
    icon: `${JUPITER_CDN}/HOSICO.png`,
    fee: "1%"
  },
  {
    symbol: "BLACKCOIN",
    name: "BlackCoin",
    decimals: 6,
    mintAddress: "8ojjccPE5wNH2wHHa7pgZ3tHFSx8SgmhZphTnHRPAdv9",
    icon: `${JUPITER_CDN}/BLACKCOIN.png`,
    fee: "1%"
  }

  // // --- Tokens que necessitam de verificação manual (Múltiplos CAs existentes ou Lançamentos Recentes) ---
  // {
  //   symbol: "RADR",
  //   name: "Radar",
  //   decimals: 9,
  //   mintAddress: "VERIFICAR_CA_RADR", // Atenção: Verificar se é o Radar Protocol oficial
  //   icon: `${JUPITER_CDN}/RADR.png`,
  //   fee: "0.3%"
  // },
  // {
  //   symbol: "JIM",
  //   name: "Jim",
  //   decimals: 9,
  //   mintAddress: "VERIFICAR_CA_JIM", // Ex: 7dHbWXm... (Jim AI?)
  //   icon: `${JUPITER_CDN}/JIM.png`,
  //   fee: "1%"
  // },
  // {
  //   symbol: "GODL",
  //   name: "GODL",
  //   decimals: 11,
  //   mintAddress: "VERIFICAR_CA_GODL", // Roaring Kitty GODL? Verificar decimais
  //   icon: `${JUPITER_CDN}/GODL.png`,
  //   fee: "1%"
  // },
  // {
  //   symbol: "HUSTLE",
  //   name: "Hustle",
  //   decimals: 9,
  //   mintAddress: "VERIFICAR_CA_HUSTLE",
  //   icon: `${JUPITER_CDN}/HUSTLE.png`,
  //   fee: "0.3%"
  // },
  // {
  //   symbol: "CRT",
  //   name: "CRT",
  //   decimals: 9,
  //   mintAddress: "VERIFICAR_CA_CRT",
  //   icon: `${JUPITER_CDN}/CRT.png`,
  //   fee: "1%"
  // },
  // {
  //   symbol: "GIL",
  //   name: "Gil",
  //   decimals: 6,
  //   mintAddress: "VERIFICAR_CA_GIL", // Kith Gil?
  //   icon: `${JUPITER_CDN}/GIL.png`,
  //   fee: "1%"
  // },
  // {
  //   symbol: "WLFI",
  //   name: "World Liberty Financial",
  //   decimals: 6,
  //   mintAddress: "VERIFICAR_CA_WLFI", // Cuidado: O oficial é ETH. Verificar wrapper SOL correto.
  //   icon: `${JUPITER_CDN}/WLFI.png`,
  //   fee: "1%"
  // },
  // {
  //   symbol: "IQLABS",
  //   name: "IQ Labs",
  //   decimals: 9,
  //   mintAddress: "VERIFICAR_CA_IQLABS",
  //   icon: `${JUPITER_CDN}/IQLABS.png`,
  //   fee: "0.5%"
  // },
  // {
  //   symbol: "RAIN",
  //   name: "Rain",
  //   decimals: 6,
  //   mintAddress: "VERIFICAR_CA_RAIN",
  //   icon: `${JUPITER_CDN}/RAIN.png`,
  //   fee: "2%"
  // },
  // {
  //   symbol: "SKR",
  //   name: "Seeker",
  //   decimals: 6,
  //   mintAddress: "VERIFICAR_CA_SKR", // Seeker Mobile token (Recém lançado)
  //   icon: `${JUPITER_CDN}/SKR.png`,
  //   fee: "0.5%"
  // }
];

/**
 * Função utilitária para buscar o token pelo símbolo (ex: getAddress('SOL'))
 */
export const getTokenBySymbol = (symbol: string): TokenOption | undefined => {
  return SUPPORTED_TOKENS.find(
    (t) => t.symbol.toUpperCase() === symbol.toUpperCase()
  );
};
