import type { Metadata } from "next";
import { SeoContentPage } from "@/components/seo-content-page";

const title = "Crypto and Social Discovery Safety";
const description = "Practical wallet, USDC, privacy, messaging, and meeting safety guidance for the Crypto Sugar Babes community.";

export const metadata: Metadata = {
  title: `${title} | Crypto Sugar Babes`,
  description,
  alternates: { canonical: "/crypto-safety" },
  openGraph: { title, description, url: "/crypto-safety" },
};

export default function CryptoSafetyPage() {
  return <SeoContentPage
    eyebrow="WALLET & CONNECTION SAFETY"
    title="Protect the person and the wallet."
    intro="Good crypto safety and good social safety share the same principle: slow down when someone creates pressure, secrecy, urgency, or fear."
    path="/crypto-safety"
    sections={[
      {
        title: "A wallet signature is not a transfer",
        paragraphs: [
          "Signing in proves that you control a wallet address. Read every wallet prompt before signing. A normal sign-in must not ask you to reveal a recovery phrase or private key.",
          "Crypto Sugar Babes never needs your recovery phrase. Anyone asking for it is attempting to take control of your wallet.",
        ],
      },
      {
        title: "Treat every transfer as final",
        paragraphs: [
          "Blockchain transfers are normally irreversible. Confirm the network, token, amount, recipient address, and estimated network fee before approval.",
          "Ignore unexpected links, fake support messages, investment guarantees, and requests to send a small amount before receiving a larger one. Do not allow urgency to replace verification.",
        ],
      },
      {
        title: "Protect identity and location",
        paragraphs: [
          "Share only what you are comfortable making public. Keep legal documents, home addresses, workplace details, travel documents, and financial account information private.",
          "Images can reveal locations through backgrounds or embedded information. Review photographs carefully before publishing them.",
        ],
      },
      {
        title: "Recognize social pressure",
        paragraphs: [
          "Consent must be informed, voluntary, specific, and reversible. Gifts or payments never purchase control over another person and never remove anyone's right to stop communicating.",
        ],
        items: [
          "Leave a conversation that becomes threatening, manipulative, or coercive.",
          "Meet in public, arrange your own transport, and tell a trusted person your plan.",
          "Report suspected minors, trafficking, extortion, impersonation, or scams immediately.",
        ],
      },
    ]}
    cta={{
      title: "Something does not feel right?",
      body: "Stop the interaction, preserve the information you already have, and contact the safety team. Never put yourself at risk to gather evidence.",
      label: "Read safety and reporting",
      href: "/safety",
    }}
  />;
}
