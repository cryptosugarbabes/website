export const SITE_NAME = "Crypto Sugar Babes";
export const SITE_DESCRIPTION =
  "An adults-only, crypto-native social discovery community for private connections, free messaging, and optional USDC support.";

const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");

export const SITE_URL = configuredSiteUrl || "https://cryptosugarbabes.com";
export const SITE_LOGO_URL = `${SITE_URL}/csb-coin-logo.png`;
export const INSTAGRAM_URL = "https://www.instagram.com/cryptosugarbabes/";
export const X_URL = "https://x.com/cryptosugarking";

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}
