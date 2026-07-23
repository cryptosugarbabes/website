import { getAddress, isAddress } from "viem";

import { isSolanaAddress } from "@/lib/base58";

const DEFAULT_BASE_TREASURY_ADDRESS = "0x6E0178828F5C2EEEaaE8E9cdea05D62067D54883";
const DEFAULT_SOLANA_TREASURY_ADDRESS = "EjkzchC98rxfQzHgmXD5cCbBQmhp1csqbPHkpXEA9shL";

const configuredBaseTreasury =
  process.env.NEXT_PUBLIC_BASE_TREASURY_ADDRESS || DEFAULT_BASE_TREASURY_ADDRESS;
const configuredSolanaTreasury =
  process.env.NEXT_PUBLIC_SOLANA_TREASURY_ADDRESS || DEFAULT_SOLANA_TREASURY_ADDRESS;
const configuredBaseSplitter = process.env.BASE_SPLITTER_ADDRESS || "";

if (!isAddress(configuredBaseTreasury, { strict: false })) {
  throw new Error("NEXT_PUBLIC_BASE_TREASURY_ADDRESS is not a valid EVM address.");
}

if (!isSolanaAddress(configuredSolanaTreasury)) {
  throw new Error("NEXT_PUBLIC_SOLANA_TREASURY_ADDRESS is not a valid Solana address.");
}

if (configuredBaseSplitter && !isAddress(configuredBaseSplitter, { strict: false })) {
  throw new Error("BASE_SPLITTER_ADDRESS is not a valid EVM address.");
}

export const PAYMENT_CONFIG = {
  settlementEnabled: true,
  platformShareBps: 1_000,
  creatorShareBps: 9_000,
  base: {
    chainId: 8_453,
    treasuryAddress: getAddress(configuredBaseTreasury),
    usdcContractAddress: getAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
    splitterAddress: configuredBaseSplitter ? getAddress(configuredBaseSplitter) : null,
    atomicSettlementEnabled: Boolean(configuredBaseSplitter)
  },
  solana: {
    cluster: "mainnet-beta",
    treasuryAddress: configuredSolanaTreasury,
    usdcMintAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
  }
} as const;
