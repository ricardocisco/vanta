/**
 * Centralized Fee Management
 * Uses ShadowWire SDK for protocol fees and calculates blockchain costs dynamically
 */

import { Connection } from "@solana/web3.js";
import { getMinimumBalanceForRentExemptAccount } from "@solana/spl-token";
import { ShadowWireClient, SUPPORTED_TOKENS } from "@radr/shadowwire";

// Type for supported tokens from SDK
type SupportedTokenType = (typeof SUPPORTED_TOKENS)[number];

// Cache for rent values (doesn't change often)
let cachedAtaRent: number | null = null;
let cachedAtaRentTimestamp: number = 0;
const RENT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour

/**
 * Get the rent cost for creating an Associated Token Account
 * This is a blockchain cost, not a ShadowWire fee
 */
export async function getAtaRentCost(connection: Connection): Promise<number> {
  const now = Date.now();

  // Return cached value if still valid
  if (cachedAtaRent && now - cachedAtaRentTimestamp < RENT_CACHE_DURATION) {
    return cachedAtaRent;
  }

  try {
    // Get minimum rent for a token account (165 bytes)
    const rentLamports = await getMinimumBalanceForRentExemptAccount(connection);
    cachedAtaRent = rentLamports / 1e9; // Convert to SOL
    cachedAtaRentTimestamp = now;
    return cachedAtaRent;
  } catch (e) {
    console.error("[Fees] Error getting ATA rent:", e);
    // Fallback to known approximate value
    return 0.00203928;
  }
}

/**
 * Calculate the total gas needed for a Vanta Link
 * Includes: ATA rent (if needed) + transaction fees + buffer
 */
export async function calculateLinkGasFee(connection: Connection): Promise<number> {
  const ataRent = await getAtaRentCost(connection);
  const txFeeBuffer = 0.0005; // Transaction fees + small buffer
  return ataRent + txFeeBuffer;
}

/**
 * Get fee percentage for a token from ShadowWire SDK
 */
export function getTokenFeePercentage(tokenSymbol: string): number {
  try {
    const client = new ShadowWireClient();
    return client.getFeePercentage(tokenSymbol as SupportedTokenType) || 0.01; // Default 1%
  } catch (e) {
    console.error("[Fees] Error getting fee percentage:", e);
    return 0.01; // Default 1%
  }
}

/**
 * Get minimum amount for a token from ShadowWire SDK
 */
export function getTokenMinimumAmount(tokenSymbol: string): number {
  try {
    const client = new ShadowWireClient();
    return client.getMinimumAmount(tokenSymbol as SupportedTokenType) || 0.1;
  } catch (e) {
    console.error("[Fees] Error getting minimum amount:", e);
    return tokenSymbol === "SOL" ? 0.1 : 0; // Default minimum
  }
}

/**
 * Calculate fee breakdown for a transfer
 */
export function calculateTransferFee(
  amount: number,
  tokenSymbol: string
): {
  amount: number;
  fee: number;
  total: number;
  feePercentage: number;
} {
  try {
    const client = new ShadowWireClient();
    const breakdown = client.calculateFee(amount, tokenSymbol as SupportedTokenType);
    return {
      amount: amount,
      fee: breakdown?.fee || 0,
      total: amount + (breakdown?.fee || 0),
      feePercentage: breakdown?.feePercentage || getTokenFeePercentage(tokenSymbol)
    };
  } catch (e) {
    console.error("[Fees] Error calculating fee:", e);
    const feePercentage = getTokenFeePercentage(tokenSymbol);
    const fee = amount * feePercentage;
    return {
      amount,
      fee,
      total: amount + fee,
      feePercentage
    };
  }
}

/**
 * Check if an amount meets the minimum requirement
 */
export function meetsMinimumAmount(amount: number, tokenSymbol: string): boolean {
  const minimum = getTokenMinimumAmount(tokenSymbol);
  return amount >= minimum;
}

/**
 * Format fee display string
 */
export function formatFeePercentage(tokenSymbol: string): string {
  const fee = getTokenFeePercentage(tokenSymbol);
  return `${(fee * 100).toFixed(1)}%`;
}
