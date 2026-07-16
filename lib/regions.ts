export const REGIONS = [
  "Europe",
  "Asia",
  "Middle East",
  "North America",
  "South America",
  "Africa",
  "Oceania"
] as const;

export type Region = (typeof REGIONS)[number];

export function isRegion(value: unknown): value is Region {
  return typeof value === "string" && REGIONS.includes(value as Region);
}
