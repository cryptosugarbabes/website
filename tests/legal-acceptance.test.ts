import { describe, expect, it } from "vitest";
import {
  acceptanceComplete,
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION
} from "../lib/legal-acceptance";

const acceptedAt = new Date("2026-07-16T00:00:00.000Z");

describe("membership acceptance", () => {
  it("requires all three recorded confirmations at the current policy versions", () => {
    expect(acceptanceComplete({
      adult_attested_at: acceptedAt,
      terms_accepted_at: acceptedAt,
      terms_version: CURRENT_TERMS_VERSION,
      privacy_accepted_at: acceptedAt,
      privacy_version: CURRENT_PRIVACY_VERSION
    })).toBe(true);
  });

  it("requires renewed acceptance after a policy version changes", () => {
    expect(acceptanceComplete({
      adult_attested_at: acceptedAt,
      terms_accepted_at: acceptedAt,
      terms_version: "older-terms",
      privacy_accepted_at: acceptedAt,
      privacy_version: CURRENT_PRIVACY_VERSION
    })).toBe(false);
  });

  it("does not treat an incomplete record as accepted", () => {
    expect(acceptanceComplete({
      adult_attested_at: acceptedAt,
      terms_accepted_at: acceptedAt,
      terms_version: CURRENT_TERMS_VERSION,
      privacy_accepted_at: null,
      privacy_version: null
    })).toBe(false);
  });
});
