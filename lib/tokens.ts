// utils/tokens.ts

export interface TokenOption {
  symbol: string;
  name: string;
  decimals: number;
  mintAddress: string; // Endereço do Contrato na Mainnet
  icon: string; // URL do logo
  fee: string; // Taxa do ShadowWire (Informativo)
}

export const SUPPORTED_TOKENS: TokenOption[] = [
  // --- Principais / Infraestrutura ---
  {
    symbol: "SOL",
    name: "Solana",
    decimals: 9,
    mintAddress: "So11111111111111111111111111111111111111112",
    icon: "/icons/sol-solana.svg",
    fee: "0.5%"
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    mintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    icon: "/icons/usdc.svg",
    fee: "1%"
  },
  {
    symbol: "USD1",
    name: "World Liberty Financial USD",
    decimals: 6,
    mintAddress: "USD1ttGY1N17NEEHLmELoaybftRBUSErhqYiQzvEmuB",
    icon: "/icons/usdc1.svg",
    fee: "1%"
  },
  {
    symbol: "ZEC",
    name: "ZCash (Portal/Wormhole)",
    decimals: 9,
    mintAddress: "A7bdiYdS5GjqGFtxf17ppRHtDKPkkRqbKtR27dxvQXaS",
    icon: "/icons/zec.svg",
    fee: "1%"
  },
  {
    symbol: "BONK",
    name: "Bonk",
    decimals: 5,
    mintAddress: "dezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    icon: "/icons/bonk.svg",
    fee: "1%"
  },
  {
    symbol: "ORE",
    name: "Ore",
    decimals: 11,
    mintAddress: "oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp",
    icon: "/icons/ore.svg",
    fee: "0.3%"
  },
  {
    symbol: "AOL",
    name: "America Online",
    decimals: 6,
    mintAddress: "2oQNkePakuPbHzrVVkQ875WHeewLHCd2cAwfwiLQbonk",
    icon: "/icons/aol.svg",
    fee: "1%"
  },
  {
    symbol: "ANON",
    name: "Anon",
    decimals: 9,
    mintAddress: "3GJD7p3HpSjpB4ZuhhnhThrA4AQG2nq6JcahMm56bonk",
    icon: "/icons/anon.svg",
    fee: "1%"
  },
  {
    symbol: "SANA",
    name: "Sana",
    decimals: 6,
    mintAddress: "CT5c8Y7B5FBdL88k6kz21pS3NDM5ojQ13Kzem7Srpump",
    icon: "/icons/sana.svg",
    fee: "1%"
  },
  {
    symbol: "POKI",
    name: "Poki",
    decimals: 9,
    mintAddress: "6vK6cL9C66Bsqw7SC2hcCdkgm1UKBDUE6DCYJ4kubonk",
    icon: "/icons/poki.svg",
    fee: "1%"
  },
  {
    symbol: "HOSICO",
    name: "Hosico Cat",
    decimals: 9,
    mintAddress: "9wk8yn6iz1ie5kejkvzctxyn1x5stdnfx8yemy8ebonk",
    icon: "/icons/hosico.svg",
    fee: "1%"
  },
  {
    symbol: "BLACKCOIN",
    name: "BlackCoin",
    decimals: 6,
    mintAddress: "8ojjccPE5wNH2wHHa7pgZ3tHFSx8SgmhZphTnHRPAdv9",
    icon: "/icons/blackcoin.svg",
    fee: "1%"
  },
  {
    symbol: "WLF",
    name: "World Liberty Financial",
    decimals: 6,
    mintAddress: "WLFinEv6ypjkczcS83FZqFpgFZYwQXutRbxGe7oC16g",
    icon: "/icons/wlf.svg",
    fee: "1%"
  },
  {
    symbol: "RADR",
    name: "Radar",
    decimals: 9,
    mintAddress: "CzFvsLdUazabdiu9TYXujj4EY495fG7VgJJ3vQs6bonk",
    icon: "/icons/radricon.svg",
    fee: "0.3%"
  },
  {
    symbol: "JIM",
    name: "Jim",
    decimals: 9,
    mintAddress: "H9muD33usLGYv1tHvxCVpFwwVSn27x67tBQYH1ANbonk",
    icon: "/icons/jim.svg",
    fee: "1%"
  },
  {
    symbol: "GODL",
    name: "GODL",
    decimals: 11,
    mintAddress: "GodL6KZ9uuUoQwELggtVzQkKmU1LfqmDokPibPeDKkhF",
    icon: "/icons/godl.svg",
    fee: "1%"
  },
  {
    symbol: "HUSTLE",
    name: "Hustle",
    decimals: 9,
    mintAddress: "HUSTLFV3U5Km8u66rMQExh4nLy7unfKHedEXVK1WgSAG",
    icon: "/icons/hustle.svg",
    fee: "0.3%"
  },
  {
    symbol: "CRT",
    name: "CRT",
    decimals: 9,
    mintAddress: "CRTx1JouZhzSU6XytsE42UQraoGqiHgxabocVfARTy2s",
    icon: "/icons/deficarrot.svg",
    fee: "1%"
  },
  {
    symbol: "GIL",
    name: "Gil",
    decimals: 6,
    mintAddress: "CyUgNnKPQLqFcheyGV8wmypnJqojA7NzsdJjTS4nUT2j",
    icon: "/icons/kithgil.svg",
    fee: "1%"
  },
  {
    symbol: "IQLABS",
    name: "IQ Labs",
    decimals: 9,
    mintAddress: "3uXACfojUrya7VH51jVC1DCHq3uzK4A7g469Q954LABS",
    icon: "/icons/iq.svg",
    fee: "0.5%"
  },
  {
    symbol: "RAIN",
    name: "Rain",
    decimals: 6,
    mintAddress: "3iC63FgnB7EhcPaiSaC51UkVweeBDkqu17SaRyy2pump",
    icon: "/icons/rainmaker.svg",
    fee: "2%"
  },
  {
    symbol: "SKR",
    name: "Seeker",
    decimals: 6,
    mintAddress: "5dpN5wMH8j8au29Rp91qn4WfNq6t6xJfcjQNcFeDJ8Ct",
    icon: "/icons/skr.svg",
    fee: "0.5%"
  }
];

/**
 * Função utilitária para buscar o token pelo símbolo (ex: getAddress('SOL'))
 */
export const getTokenBySymbol = (symbol: string): TokenOption | undefined => {
  return SUPPORTED_TOKENS.find((t) => t.symbol.toUpperCase() === symbol.toUpperCase());
};
