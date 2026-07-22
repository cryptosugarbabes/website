import { describe, expect, it } from "vitest";
import { isAllowedSolanaRpcRequest } from "../lib/solana-rpc-proxy";

describe("Solana payment RPC proxy", () => {
  it("allows only the read methods required to assemble and confirm a payment", () => {
    for (const method of ["getAccountInfo", "getBlockHeight", "getLatestBlockhash", "getSignatureStatuses"]) {
      expect(isAllowedSolanaRpcRequest({ jsonrpc: "2.0", id: 1, method, params: [] })).toBe(true);
    }
  });

  it("rejects transaction submission, batch requests, and malformed payloads", () => {
    expect(isAllowedSolanaRpcRequest({ jsonrpc: "2.0", id: 1, method: "sendTransaction", params: [] })).toBe(false);
    expect(isAllowedSolanaRpcRequest([{ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [] }])).toBe(false);
    expect(isAllowedSolanaRpcRequest({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: {} })).toBe(false);
  });
});
