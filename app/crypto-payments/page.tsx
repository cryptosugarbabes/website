import type { Metadata } from "next";
import { SeoContentPage } from "@/components/seo-content-page";

const title = "USDC Payments on Base and Solana";
const description = "Understand optional USDC likes, gifts, boosts, wallet connections, settlement, and blockchain transaction safety on Crypto Sugar Babes.";

export const metadata: Metadata = {
  title: `${title} | Crypto Sugar Babes`,
  description,
  alternates: { canonical: "/crypto-payments" },
  openGraph: { title, description, url: "/crypto-payments" },
};

export default function CryptoPaymentsPage() {
  return <SeoContentPage
    eyebrow="OPTIONAL CRYPTO FEATURES"
    title="Clear USDC support, approved in your wallet."
    intro="Crypto Sugar Babes uses wallet-based features to support optional digital likes, gifts, and boosted messages. A wallet is not required for basic membership or free messaging."
    path="/crypto-payments"
    sections={[
      {
        title: "Why USDC",
        paragraphs: [
          "USDC is a digital token designed to track the value of the US dollar. Supported actions use the canonical USDC token for the selected network rather than an imitation token with a similar name.",
          "Availability can differ by network and feature. The live interface shows which actions are enabled before you connect or approve anything.",
        ],
      },
      {
        title: "Base and Solana wallet support",
        paragraphs: [
          "Members can connect supported wallets on Base or Solana. The wallet remains self-custodied: Crypto Sugar Babes does not receive the recovery phrase and cannot approve transactions on a member's behalf.",
          "Network fees are paid to the blockchain network and are separate from the USDC amount shown for the platform action.",
        ],
      },
      {
        title: "Review before approving",
        paragraphs: [
          "A payment quote identifies the amount, network, token, and relevant settlement details before approval. Review those details in both the website and wallet prompt.",
        ],
        items: [
          "Confirm that the wallet is on the intended network.",
          "Confirm that the asset is USDC and that the amount is correct.",
          "Reject an unexpected approval, contract, recipient, or spending request.",
          "Keep enough of the network's native asset available for any required transaction fee.",
        ],
      },
      {
        title: "Finality, records, and disputes",
        paragraphs: [
          "A confirmed blockchain transfer normally cannot be cancelled or charged back. Transaction hashes provide a public record that can help identify what happened, but they do not make a transfer reversible.",
          "If a payment is connected to a scam, coercion, or unsafe profile, report the platform activity and include the transaction hash. Moderators can review accounts and content even when the underlying blockchain transfer cannot be undone.",
        ],
      },
    ]}
    cta={{
      title: "Crypto is optional. Clarity is not.",
      body: "Start with free membership and messaging. Connect a supported wallet only when you understand and want the available feature.",
      label: "See how the platform works",
      href: "/how-it-works",
    }}
  />;
}
