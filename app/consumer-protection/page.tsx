import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Consumer Protection — Crypto Sugar Babes",
  description: "Wallet, transaction, counterparty, reporting, and consumer-protection guidance for Crypto Sugar Babes users.",
  alternates: { canonical: "/consumer-protection" },
};

export default function ConsumerProtectionPage() {
  return <LegalPage
    eyebrow="CHECK · CONTROL · REPORT"
    title="Consumer protection"
    intro="We design for informed choices, transparent wallet approvals, proportionate risk, and action against illegitimate activity."
    updated="23 July 2026"
    sections={[
      {
        title: "1. Our approach",
        paragraphs: [
          "Crypto Sugar Babes aims to protect website users, consumers, patrons, and Sugar Babes through clear transaction information, account and reporting controls, payment records, safety review, and investigation of credible reports. We may restrict features, suspend or remove accounts, preserve relevant records, and cooperate with lawful authorities.",
          "No online platform can eliminate fraud, impersonation, market, wallet, counterparty, or personal-safety risk. A published profile, message, rank, review, or transaction record is not a guarantee of identity, character, intentions, solvency, or future conduct."
        ]
      },
      {
        title: "2. Start small with crypto",
        paragraphs: [
          "If you are new to cryptocurrency, keep only a small amount in the wallet you use with the site—no more than you are prepared to use and potentially lose. Consider keeping long-term holdings in a separate wallet. Learn how your chosen wallet, network, token, fees, approvals, and recovery process work before making a payment.",
          "Never share a recovery phrase, private key, wallet password, one-time email code, or remote access to your device. Crypto Sugar Babes will never need those secrets to investigate a transaction."
        ]
      },
      {
        title: "3. Before approving a transaction",
        items: [
          "Confirm that you are using the intended network and the correct token.",
          "Check the gross amount, recipient allocation, platform allocation, destination addresses, and estimated network fee shown by your wallet.",
          "Do not approve a request that is unexpected, unclear, rushed, or different from what the site displayed.",
          "Reject pressure, emergency stories, guaranteed-return claims, recovery-fee demands, and requests to send funds outside the displayed flow.",
          "Keep the public transaction hash and any relevant messages or screenshots."
        ]
      },
      {
        title: "4. Transaction and counterparty responsibility",
        paragraphs: [
          "Users choose their counterparties and independently authorise transactions from their own wallets. Each counterparty remains responsible for their own statements, promises, conduct, legal obligations, taxes, and use of funds. Crypto Sugar Babes is not a bank, wallet custodian, escrow service, insurer, fiduciary, or party to private arrangements between users.",
          "Blockchain transfers are normally irreversible. To the extent permitted by applicable law, users accept the risks of the counterparties and wallet transactions they choose. Nothing in this statement excludes or limits a responsibility or liability that cannot lawfully be excluded or limited, or removes any statutory consumer right that applies."
        ]
      },
      {
        title: "5. What the platform can investigate",
        paragraphs: [
          "We investigate credible reports of scams, impersonation, coercion, trafficking, unauthorised account use, deceptive payment activity, threats, exploitation, non-consensual content, and other illegitimate or unlawful use of the website. We can review relevant platform records and public blockchain information, but we cannot access private keys, reverse a confirmed blockchain transfer, or guarantee recovery.",
          "Moderation action can protect users from future platform activity even when funds cannot be recovered. Depending on the evidence and applicable law, we may warn or restrict a user, remove content, suspend or remove an account, preserve records, or cooperate with authorities."
        ]
      },
      {
        title: "6. Report a concern",
        paragraphs: [
          "Send the profile name or URL, network, public wallet address, transaction hash, date, amount, a concise explanation, and screenshots already in your possession. Do not put yourself at risk to obtain evidence. If your wallet may be compromised, stop using it, follow trusted guidance from your wallet provider, and contact the appropriate cybercrime or law-enforcement authority.",
          "If someone is in immediate danger or you suspect trafficking or child exploitation, contact emergency services or the relevant official authority first."
        ],
        action: { label: "Email a consumer-protection report", href: "mailto:email@cryptosugarbabes.com?subject=Consumer%20protection%20report" }
      },
      {
        title: "7. Related information",
        paragraphs: ["Read the transaction dispute process for what information to provide and what outcomes the platform can and cannot offer."],
        action: { label: "Read disputes and transaction reports", href: "/disputes" }
      }
    ]}
  />;
}
