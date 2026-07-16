export const FREE_UNANSWERED_MESSAGES = 3;
export const MESSAGE_UNLOCK_USDC_MICROS = BigInt(10_000_000);
export const MESSAGE_UNLOCK_DAYS = 7;

export type UnansweredMessageState = "OPEN" | "WARNING" | "REPLY_REQUIRED" | "PAID_UNLOCK_READY";

export function unansweredMessageState(consecutiveMessages: number, hasUnusedPaidUnlock = false): UnansweredMessageState {
  if (consecutiveMessages < FREE_UNANSWERED_MESSAGES - 1) return "OPEN";
  if (consecutiveMessages === FREE_UNANSWERED_MESSAGES - 1) return "WARNING";
  return hasUnusedPaidUnlock ? "PAID_UNLOCK_READY" : "REPLY_REQUIRED";
}

