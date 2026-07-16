export const CURRENT_TERMS_VERSION = "2026-07-16";
export const CURRENT_PRIVACY_VERSION = "2026-07-16";

export type AcceptanceRecord = {
  adult_attested_at: Date | null;
  terms_accepted_at: Date | null;
  terms_version: string | null;
  privacy_accepted_at: Date | null;
  privacy_version: string | null;
};

export function acceptanceComplete(record: AcceptanceRecord) {
  return Boolean(
    record.adult_attested_at
      && record.terms_accepted_at
      && record.privacy_accepted_at
      && record.terms_version === CURRENT_TERMS_VERSION
      && record.privacy_version === CURRENT_PRIVACY_VERSION
  );
}
