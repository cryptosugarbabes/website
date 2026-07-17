import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOT_FALLBACK,
  DEFAULT_BOT_LIBRARY,
  selectBotResponse
} from "../lib/bot-response-library";

describe("preset creator assistant replies", () => {
  it("matches a greeting deterministically", () => {
    const result = selectBotResponse("Hello there", DEFAULT_BOT_LIBRARY);
    expect(result.matched).toBe(true);
    expect(result.label).toBe("Greeting");
    expect(result.response).toContain("automated assistant");
  });

  it("prioritises wallet safety when more than one rule could match", () => {
    const result = selectBotResponse(
      "Hey, can I send you my private key as a gift?",
      DEFAULT_BOT_LIBRARY
    );
    expect(result.matched).toBe(true);
    expect(result.label).toBe("Wallet safety");
    expect(result.response).toContain("Never share");
  });

  it("uses the review fallback for an unknown request", () => {
    const result = selectBotResponse("What is your favourite novel?", DEFAULT_BOT_LIBRARY);
    expect(result.matched).toBe(false);
    expect(result.label).toBe("Needs creator review");
    expect(result.response).toBe(DEFAULT_BOT_FALLBACK);
  });

  it("does not match partial words", () => {
    const result = selectBotResponse("This is a giftable idea", DEFAULT_BOT_LIBRARY);
    expect(result.matched).toBe(false);
  });
});
