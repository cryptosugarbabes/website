import type { Metadata } from "next";
import { DiscoveryApp } from "@/components/discovery-app";
import {
  INSTAGRAM_URL,
  SITE_DESCRIPTION,
  SITE_LOGO_URL,
  SITE_NAME,
  SITE_URL,
  X_URL,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "Crypto Sugar Babes | Crypto-Native Social Discovery",
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "Crypto Sugar Babes | Crypto-Native Social Discovery",
    description: SITE_DESCRIPTION,
    url: "/",
    images: [{ url: "/hero-collage.webp", alt: "Crypto Sugar Babes community" }],
  },
  twitter: {
    title: "Crypto Sugar Babes | Crypto-Native Social Discovery",
    description: SITE_DESCRIPTION,
    images: ["/hero-collage.webp"],
  },
};

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        inLanguage: "en",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: { "@type": "ImageObject", url: SITE_LOGO_URL },
        sameAs: [INSTAGRAM_URL, X_URL],
      },
    ],
  };

  return <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
    />
    <DiscoveryApp />
  </>;
}
