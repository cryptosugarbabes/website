import type { Metadata } from "next";

import { DiscoveryApp } from "@/components/discovery-app";

const title = "Discover All Sugar Babes";
const description = "Browse every published Crypto Sugar Babe profile by destination and interest.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/sugar-babes" },
  openGraph: {
    title,
    description,
    url: "/sugar-babes",
    images: [{ url: "/hero-collage.webp", alt: "Discover Crypto Sugar Babes" }],
  },
  twitter: {
    title,
    description,
    images: ["/hero-collage.webp"],
  },
};

export default function SugarBabesPage() {
  return <DiscoveryApp directoryMode/>;
}
