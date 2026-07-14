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
        title: "Our non-negotiables",
        items: [
          "All users must be 18 or older.",
          "Consent must be informed, voluntary, specific, and reversible at any time.",
          "Trafficking, coercion, exploitation, solicitation, and non-consensual content are prohibited.",
          "Threats, harassment, blackmail, impersonation, scams, and attempts to expose private information are prohibited."
        ]
      },
      {
        title: "Protect yourself",
        items: [
          "Keep early conversations on the platform and avoid sharing your home address, workplace, legal documents, or recovery phrase.",
          "Never send cryptocurrency because someone pressures you, claims an emergency, or promises guaranteed returns.",
          "For an in-person meeting, use a public place, arrange your own transport, and tell someone you trust where you will be.",
          "Leave immediately if boundaries are ignored or circumstances do not match what you were told."
        ]
      },
      {
        title: "Reporting",
        paragraphs: ["Send reports to cryptosugarbabes@gmail.com with the profile name, wallet address if known, relevant dates, and screenshots or transaction identifiers. Do not put yourself at risk to collect evidence. We may restrict accounts and preserve records while a report is reviewed."]
      },
      {
        title: "Immediate danger",
        paragraphs: ["If you or someone else may be in immediate danger, contact local emergency services. If you suspect human trafficking or child exploitation, contact the appropriate national reporting authority in your location as well as notifying us."]
      }
    ]}
  />;
}
