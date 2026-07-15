import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Safety — Crypto Sugar Babes",
  description: "Safety expectations and reporting information for Crypto Sugar Babes."
};

export default function SafetyPage() {
  return <LegalPage
    eyebrow="SAFETY IS THE PRODUCT"
    title="Adults only. Consent always."
    intro="Private discovery works only when boundaries, honesty, and personal safety come first."
    updated="15 July 2026"
    sections={[
      {
        title: "1. Adults only and account attestation",
        paragraphs: [
          "Crypto Sugar Babes is strictly for people aged 18 or older who have reached the legal age of majority where they live. By opening an account, connecting a wallet, creating a profile, or using the platform, you confirm that you meet those requirements and that your use is lawful in your location.",
          "We do not routinely require government identification solely to open a wallet-based account. We may request age or identity evidence when required by law, when a profile is reported, when risk indicators appear, or when a moderator reasonably questions a user's age or identity. Refusing a permitted verification request may result in restricted access or account removal."
        ]
      },
      {
        title: "2. Profile review is not identity verification",
        paragraphs: [
          "Public creator profiles are reviewed for completeness, apparent adult status, prohibited content, and obvious safety concerns before discovery. This is a content and risk review—not a guarantee of a person's legal identity, age, character, intentions, location, photographs, or conduct.",
          "A reviewed profile must not be described or relied on as government-ID verified unless Crypto Sugar Babes has completed and expressly labelled that separate check. Always use your own judgment."
        ]
      },
      {
        title: "3. Our non-negotiables",
        items: [
          "Consent must be informed, voluntary, specific, and reversible at any time.",
          "Minors, trafficking, coercion, exploitation, non-consensual content, and attempts to arrange unlawful activity are prohibited.",
          "Threats, targeted abuse, harassment, blackmail, extortion, impersonation, scams, doxxing, and deceptive financial requests are prohibited.",
          "No user may pressure another person to meet, communicate, pay, disclose private information, or engage in conduct they do not freely choose."
        ]
      },
      {
        title: "4. Protect yourself",
        items: [
          "Keep early conversations on the platform and avoid sharing your home address, workplace, legal documents, or recovery phrase.",
          "Never send cryptocurrency because someone pressures you, claims an emergency, or promises guaranteed returns.",
          "For an in-person meeting, use a public place, arrange your own transport, and tell someone you trust where you will be.",
          "Leave immediately if boundaries are ignored or circumstances do not match what you were told."
        ]
      },
      {
        title: "5. Reporting and moderation",
        paragraphs: [
          "Send reports with the profile name or URL, wallet address if known, relevant dates, transaction hash, and any screenshots you already have. Never share a recovery phrase or private key. Do not put yourself at risk to collect evidence.",
          "We may hide or remove content, restrict messaging or payments, suspend or remove profiles, preserve relevant records, and cooperate with lawful authorities. Profiles associated with abuse, repeated rudeness directed at others, threats, extortion, fraud, coercion, or other inappropriate or unlawful conduct may be removed."
        ],
        action: { label: "Email the safety team", href: "mailto:email@cryptosugarbabes.com?subject=Safety%20report" }
      },
      {
        title: "6. Transactions and disputes",
        paragraphs: ["Confirmed blockchain transactions are normally irreversible. Crypto Sugar Babes cannot cancel, charge back, or retrieve a transfer from a recipient's wallet. We can still review the related profile and platform activity and take moderation action where appropriate."],
        action: { label: "Read the disputes process", href: "/disputes" }
      },
      {
        title: "7. Immediate danger",
        paragraphs: ["If you or someone else may be in immediate danger, contact local emergency services. If you suspect human trafficking or child exploitation, contact the appropriate national reporting authority in your location as well as notifying us."]
      }
    ]}
  />;
}
