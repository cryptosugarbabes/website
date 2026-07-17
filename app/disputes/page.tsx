import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Disputes & Transaction Reports — Crypto Sugar Babes",
  description: "How to report a transaction, profile, safety, or conduct dispute to Crypto Sugar Babes.",
  alternates: { canonical: "/disputes" },
};

export default function DisputesPage() {
  return <LegalPage
    eyebrow="REPORTS & RESOLUTION"
    title="Disputes and transaction reports"
    intro="We can investigate activity on Crypto Sugar Babes and take action against unsafe profiles, but confirmed blockchain transfers cannot normally be reversed."
    updated="15 July 2026"
    sections={[
      {
        title: "1. Blockchain transactions are final",
        paragraphs: [
          "Base and Solana transactions are submitted from a user's own wallet and confirmed by independent blockchain networks. Once confirmed, a transfer is normally irreversible. Crypto Sugar Babes cannot cancel it, create a chargeback, or retrieve funds from a recipient-controlled wallet.",
          "Before signing, check the token, network, amount, creator address, platform address, and network fee shown by your wallet. A moderation decision or removed profile does not itself reverse a completed transaction."
        ]
      },
      {
        title: "2. What we can review",
        paragraphs: ["We can review relevant profiles, platform messages, account activity, payment quotes and records, and public transaction hashes. We may request information reasonably needed to understand the report. We will never ask for your recovery phrase or private key."],
        items: [
          "Whether the reported profile or conduct breached our Terms or Safety rules.",
          "Whether the on-chain transaction matches the quote recorded by the platform.",
          "Whether an account should be warned, restricted, suspended, or removed.",
          "Whether records should be preserved or provided in response to a valid legal request."
        ]
      },
      {
        title: "3. Conduct that may lead to removal",
        paragraphs: ["We review reports of abusive, repeatedly rude, threatening, extortionate, fraudulent, coercive, exploitative, deceptive, or otherwise inappropriate or unlawful conduct. We may also act on impersonation, scams, non-consensual content, suspected underage use, trafficking, doxxing, harassment, and attempts to manipulate payments or reputation."],
      },
      {
        title: "4. How to make a report",
        paragraphs: ["Email us from an address where we can reply. Include the profile name or URL, your public wallet address, the transaction hash and network if payment is involved, the date and time, a concise description, and any screenshots you already have. Do not endanger yourself to obtain evidence, and never send a recovery phrase, private key, or wallet password."],
        action: { label: "Email a dispute report", href: "mailto:email@cryptosugarbabes.com?subject=Dispute%20report" }
      },
      {
        title: "5. Possible outcomes",
        paragraphs: ["We aim to acknowledge complete reports and review them fairly, but do not guarantee a particular outcome, reimbursement, or response time. Depending on the evidence and applicable law, we may take no action, request more information, warn a user, restrict features, remove content, suspend or remove a profile, preserve records, or cooperate with lawful authorities."]
      },
      {
        title: "6. Compromised wallets and immediate danger",
        paragraphs: ["If you believe your wallet was compromised or a transaction was authorised without your consent, immediately contact your wallet provider, secure remaining assets using trusted wallet guidance, and contact the appropriate law-enforcement or cybercrime authority. Crypto Sugar Babes does not control private keys and cannot freeze a self-custody wallet. If anyone is in immediate danger, contact local emergency services first."]
      }
    ]}
  />;
}
