import { describe, expect, it } from "vitest";
import { paymentErrorMessage } from "../lib/payment-errors";

describe("payment error messages", () => {
  it("replaces verbose ERC20 balance errors with a short notice", () => {
    const raw = new Error(
      'The contract function "payAndSplit" reverted: ERC20: transfer amount exceeds balance Contract Call: address: 0x1234'
    );

    expect(paymentErrorMessage(raw)).toBe("This wallet does not have enough USDC for this payment.");
  });

  it("explains Base gas shortages without exposing wallet diagnostics", () => {
    expect(paymentErrorMessage(new Error("insufficient funds for intrinsic gas"))).toBe(
      "This wallet does not have enough ETH on Base for the network fee."
    );
  });

  it("does not expose unexpected provider details", () => {
    expect(paymentErrorMessage(new Error("provider payload with private diagnostic details"))).toBe(
      "The payment could not be completed. Check your wallet balance and network, then try again."
    );
  });

  it("warns a payer not to duplicate a sent transaction while confirmation is pending", () => {
    expect(paymentErrorMessage(new Error("PAYMENT_SENT_CONFIRMATION_PENDING: Block temporarily unavailable"))).toBe(
      "Your payment was sent on-chain, but the website is still confirming it. Do not pay again. Check your dashboard shortly or contact support."
    );
  });
});
