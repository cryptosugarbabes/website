import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Use — Crypto Sugar Babes",
  description: "Terms governing access to and use of Crypto Sugar Babes."
};

export default function TermsPage() {
  return <LegalPage
    eyebrow="CLEAR EXPECTATIONS"
    title="Terms of Use"
    intro="By accessing Crypto Sugar Babes, you agree to these terms and to use the platform lawfully, honestly, and respectfully."
    updated="15 July 2026"
    sections={[
      {
        title: "1. Eligibility",
        paragraphs: ["You must be at least 18 years old and legally able to enter a binding agreement. You may not use the platform where doing so is prohibited by law. We may require age or identity evidence and may refuse or remove access where verification is incomplete or unreliable."]
      },
      {
        title: "2. Purpose of the platform",
        paragraphs: ["Crypto Sugar Babes is a social-discovery and companionship platform. It is not an escort agency, employment agency, or venue for buying or selling sexual services. Any arrangement between users must be lawful, voluntary, consensual, and independent of the platform."]
      },
      {
        title: "3. Wallet access and account responsibility",
        paragraphs: ["A wallet signature may be used to authenticate you. You are responsible for securing your wallet, device, recovery phrase, and private keys. We will never request your recovery phrase or private key. You are responsible for activity authorised by your connected wallet unless you promptly report suspected compromise."]
      },
      {
        title: "4. Profiles and user content",
        items: [
          "Information and photographs must be accurate, lawful, and yours to use.",
          "You must not impersonate another person or upload private, intimate, or copyrighted material without permission.",
          "You grant us a limited licence to host, process, moderate, display, and distribute your content as needed to operate the platform.",
          "We may reject, restrict, or remove content or profiles that breach these terms or create safety or legal risk."
        ]
      },
      {
        title: "5. Prohibited conduct",
        items: [
          "Underage use or content, trafficking, coercion, exploitation, solicitation, or non-consensual conduct.",
          "Threats, harassment, hate, stalking, blackmail, doxxing, fraud, scams, or deceptive financial requests.",
          "Malware, scraping, account interference, evasion of moderation, or attempts to access another user’s information.",
          "Money laundering, sanctions evasion, illegal transactions, or use of proceeds connected to unlawful activity."
        ]
      },
      {
        title: "6. Paid features and creator earnings",
        paragraphs: ["When paid interactions become available, the price and applicable platform fee will be shown before confirmation. Blockchain fees, exchange rates, refunds, payout timing, minimum withdrawal amounts, and eligibility may vary. Transactions recorded on a public blockchain may be irreversible. Test-mode features do not transfer funds and do not create creator earnings."],
      },
      {
        title: "7. Moderation, suspension, and termination",
        paragraphs: ["We may investigate reports, preserve evidence, restrict features, withhold disputed or unlawful payouts, suspend access, or terminate accounts to protect users, comply with law, or enforce these terms. You may stop using the service at any time and request deletion of eligible personal information."]
      },
      {
        title: "8. Disclaimers and responsibility between users",
        paragraphs: ["Users are responsible for their own communications, meetings, decisions, and arrangements. Profile review reduces some risks but is not a guarantee of identity, character, intentions, safety, or compatibility. Use caution, protect your personal information, and meet in public where appropriate."]
      },
      {
        title: "9. Changes and contact",
        paragraphs: ["We may update these terms as the service develops. Continued use after an update means you accept the revised terms. Legal questions and urgent safety reports can be sent to cryptosugarbabes@gmail.com."]
      }
    ]}
  />;
}
