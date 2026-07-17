import { encodeAbiParameters, encodeEventTopics, type Log } from "viem";
import { describe, expect, it } from "vitest";

import { baseAtomicReceiptMatches, baseQuoteIdHash } from "../lib/base-payment-verification";

const payer = "0x1111111111111111111111111111111111111111";
const creator = "0x2222222222222222222222222222222222222222";
const treasury = "0x3333333333333333333333333333333333333333";
const usdc = "0x4444444444444444444444444444444444444444";
const splitter = "0x5555555555555555555555555555555555555555";
const quoteId = "payment-quote-123";
const grossAmount = BigInt(5_000_000);
const creatorAmount = BigInt(4_500_000);
const platformAmount = BigInt(500_000);
const logMetadata = {
  blockHash: null,
  blockNumber: null,
  logIndex: null,
  transactionHash: null,
  transactionIndex: null,
  removed: false
} as const;

const transferEvent = [{
  type: "event",
  name: "Transfer",
  inputs: [
    { indexed: true, name: "from", type: "address" },
    { indexed: true, name: "to", type: "address" },
    { indexed: false, name: "value", type: "uint256" }
  ]
}] as const;

const paymentSplitEvent = [{
  type: "event",
  name: "PaymentSplit",
  inputs: [
    { indexed: true, name: "quoteId", type: "bytes32" },
    { indexed: true, name: "payer", type: "address" },
    { indexed: true, name: "creator", type: "address" },
    { indexed: false, name: "grossAmount", type: "uint256" },
    { indexed: false, name: "creatorAmount", type: "uint256" },
    { indexed: false, name: "platformAmount", type: "uint256" }
  ]
}] as const;

function transferLog(from: `0x${string}`, to: `0x${string}`, value: bigint): Log {
  return {
    ...logMetadata,
    address: usdc,
    topics: encodeEventTopics({ abi: transferEvent, eventName: "Transfer", args: { from, to } }),
    data: encodeAbiParameters([{ type: "uint256" }], [value])
  } as Log;
}

function splitLog(overrides: { quoteId?: string; creatorAmount?: bigint } = {}): Log {
  return {
    ...logMetadata,
    address: splitter,
    topics: encodeEventTopics({
      abi: paymentSplitEvent,
      eventName: "PaymentSplit",
      args: { quoteId: baseQuoteIdHash(overrides.quoteId || quoteId), payer, creator }
    }),
    data: encodeAbiParameters(
      [{ type: "uint256" }, { type: "uint256" }, { type: "uint256" }],
      [grossAmount, overrides.creatorAmount ?? creatorAmount, platformAmount]
    )
  } as Log;
}

function expected() {
  return { quoteId, payer, creator, treasury, usdcAddress: usdc, splitterAddress: splitter, grossAmount, creatorAmount, platformAmount };
}

describe("Base atomic payment verification", () => {
  const validLogs = [
    transferLog(payer, splitter, grossAmount),
    transferLog(splitter, creator, creatorAmount),
    transferLog(splitter, treasury, platformAmount),
    splitLog()
  ];

  it("accepts the exact atomic 90/10 settlement", () => {
    expect(baseAtomicReceiptMatches(validLogs, expected())).toBe(true);
  });

  it("rejects a receipt from another quote", () => {
    expect(baseAtomicReceiptMatches([...validLogs.slice(0, 3), splitLog({ quoteId: "another-quote" })], expected())).toBe(false);
  });

  it("rejects a receipt with a mismatched creator payment", () => {
    const wrongCreatorAmount = creatorAmount - BigInt(1);
    const logs = [
      transferLog(payer, splitter, grossAmount),
      transferLog(splitter, creator, wrongCreatorAmount),
      transferLog(splitter, treasury, platformAmount),
      splitLog({ creatorAmount: wrongCreatorAmount })
    ];
    expect(baseAtomicReceiptMatches(logs, expected())).toBe(false);
  });
});
