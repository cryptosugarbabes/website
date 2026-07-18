import type { Metadata } from "next";
import { SeoContentPage } from "@/components/seo-content-page";

const title = "How Crypto Sugar Babes Works";
const description = "Learn how to join Crypto Sugar Babes, discover adult members, message privately, and use optional crypto wallet and USDC features.";

export const metadata: Metadata = {
  title: `${title} | Crypto Sugar Babes`,
  description,
  alternates: { canonical: "/how-it-works" },
  openGraph: { title, description, url: "/how-it-works" },
};

export default function HowItWorksPage() {
  return <SeoContentPage
    eyebrow="PRIVATE SOCIAL DISCOVERY"
    title="Connection first. Crypto when you choose."
    intro="Crypto Sugar Babes is an adults-only social discovery community. Membership, profiles, and conversation are designed to be approachable even if you have never used a crypto wallet."
    path="/how-it-works"
    sections={[
      {
        title: "Create an adult member account",
        paragraphs: [
          "Join with an email address or supported wallet. Every member must be at least 18 and must have reached the legal age of majority where they live.",
          "Creators can prepare and submit a profile with a display name, location, biography, interests, and photographs. Profiles and photos are reviewed regularly and remain subject to reports, suspension, and removal.",
        ],
      },
      {
        title: "Discover and start a conversation",
        paragraphs: [
          "Browse published profiles and use the available filters to find people with shared interests or destinations. Messaging can begin without a wallet, so conversation is not tied to making a payment.",
          "Respectful communication is required. Boundaries can change at any time, and no one is entitled to attention, a meeting, personal information, or payment.",
        ],
      },
      {
        title: "Connect a wallet only when useful",
        paragraphs: [
          "A wallet can be connected for supported Base or Solana features. Connecting requests a signature that proves control of the address; it does not reveal a recovery phrase or give Crypto Sugar Babes permission to move funds.",
          "Optional paid interactions use USDC where available. The network, amount, recipients, and fees are displayed before a member approves a transaction in their own wallet.",
        ],
      },
      {
        title: "Keep safety part of every interaction",
        paragraphs: [
          "Use the platform's reporting tools or contact the safety team if a profile, message, or request appears deceptive, coercive, threatening, underage, or otherwise unsafe.",
        ],
        items: [
          "Never share a recovery phrase, private key, wallet password, or authentication code.",
          "Do not send crypto because of pressure, urgency, or promises of guaranteed returns.",
          "For an in-person meeting, choose a public place and tell someone you trust.",
        ],
      },
    ]}
    cta={{
      title: "Make an introduction.",
      body: "Join free, explore the community, and connect a wallet only if you choose to use supported crypto features.",
      label: "Join Crypto Sugar Babes",
      href: "/?signin=1",
    }}
  />;
}
