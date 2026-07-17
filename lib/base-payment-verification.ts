import { decodeEventLog, getAddress, keccak256, stringToHex, type Log } from "viem";

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

export function baseQuoteIdHash(quoteId: string) {
  return keccak256(stringToHex(quoteId));
}

type ExpectedBaseSplit = {
  quoteId: string;
  payer: string;
  creator: string;
  treasury: string;
  usdcAddress: string;
  splitterAddress: string;
  grossAmount: bigint;
  creatorAmount: bigint;
  platformAmount: bigint;
};

export function baseAtomicReceiptMatches(logs: readonly Log[], expected: ExpectedBaseSplit) {
  const payer = getAddress(expected.payer);
  const creator = getAddress(expected.creator);
  const treasury = getAddress(expected.treasury);
  const usdc = getAddress(expected.usdcAddress);
  const splitter = getAddress(expected.splitterAddress);
  const quoteId = baseQuoteIdHash(expected.quoteId);

  const transfers = logs.flatMap((log) => {
    if (getAddress(log.address) !== usdc) return [];
    try {
      const decoded = decodeEventLog({ abi: transferEvent, data: log.data, topics: log.topics });
      return decoded.eventName === "Transfer"
        ? [{ from: getAddress(decoded.args.from), to: getAddress(decoded.args.to), value: decoded.args.value }]
        : [];
    } catch {
      return [];
    }
  });

  const hasTransfer = (from: string, to: string, value: bigint) => transfers.some((transfer) => (
    transfer.from === getAddress(from) && transfer.to === getAddress(to) && transfer.value === value
  ));

  const hasExactSplitEvent = logs.some((log) => {
    if (getAddress(log.address) !== splitter) return false;
    try {
      const decoded = decodeEventLog({ abi: paymentSplitEvent, data: log.data, topics: log.topics });
      return decoded.eventName === "PaymentSplit"
        && decoded.args.quoteId === quoteId
        && getAddress(decoded.args.payer) === payer
        && getAddress(decoded.args.creator) === creator
        && decoded.args.grossAmount === expected.grossAmount
        && decoded.args.creatorAmount === expected.creatorAmount
        && decoded.args.platformAmount === expected.platformAmount;
    } catch {
      return false;
    }
  });

  return hasExactSplitEvent
    && hasTransfer(payer, splitter, expected.grossAmount)
    && hasTransfer(splitter, creator, expected.creatorAmount)
    && hasTransfer(splitter, treasury, expected.platformAmount);
}
