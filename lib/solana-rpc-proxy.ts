const ALLOWED_SOLANA_RPC_METHODS = new Set([
  "getAccountInfo",
  "getBlockHeight",
  "getLatestBlockhash",
  "getSignatureStatuses",
  "getTokenAccountBalance"
]);

export function isAllowedSolanaRpcRequest(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const request = input as { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown };
  if (request.jsonrpc !== "2.0" || typeof request.method !== "string" || !ALLOWED_SOLANA_RPC_METHODS.has(request.method)) return false;
  if (!(typeof request.id === "string" || typeof request.id === "number" || request.id === null)) return false;
  if (request.params !== undefined && !Array.isArray(request.params)) return false;
  return JSON.stringify(input).length <= 12_000;
}
