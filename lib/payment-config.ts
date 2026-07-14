import { getAddress, isAddress } from "viem";

import { isSolanaAddress } from "@/lib/base58";

const DEFAULT_BASE_TREASURY_ADDRESS = "0x7293F09B131B99D564c602538D0777b18075c9b4";
const DEFAULT_SOLANA_TREASURY_ADDRESS = "EjkzchC98rxfQzHgmXD5cCbBQmhp1csqbPHkpXEA9shL";

const configuredBaseTreasury =
  process.env.NEXT_PUBLIC_BASE_TREASURY_ADDRESS || DEFAULT_BASE_TREASURY_ADDRESS;
const configuredSolanaTreasury =
  process.env.NEXT_PUBLIC_SOLANA_TREASURY_ADDRESS || DEFAULT_SOLANA_TREASURY_ADDRESS;

if (!isAddress(configuredBaseTreasury, { strict: false })) {
  throw new Error("NEXT_PUBLIC_BASE_TREASURY_ADDRESS is not a valid EVM address.");
}

if (!isSolanaAddress(configuredSolanaTreasury)) {
  throw new Error("NEXT_PUBLIC_SOLANA_TREASURY_ADDRESS is not a valid Solana address.");
}

export const PAYMENT_CONFIG = {
  settlementEnabled: false,
  platformShareBps: 1_000,
  creatorShareBps: 9_000,
  base: {
    chainId: 8_453,
    treasuryAddress: getAddress(configuredBaseTreasury),
    usdcContractAddress: getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
  },
  solana: {
    cluster: "mainnet-beta",
    treasuryAddress: configuredSolanaTreasury
  }
} as const;
