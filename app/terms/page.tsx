import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Use — Crypto Sugar Babes",
  description: "Terms governing access to and use of Crypto Sugar Babes.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return <LegalPage
    eyebrow="CLEAR EXPECTATIONS"
    title="Terms of Use"
    intro="By accessing Crypto Sugar Babes, you agree to these terms and to use the platform lawfully, honestly, and respectfully."
    updated="17 July 2026"
    sections={[
      {
        title: "1. Eligibility and adult attestation",
        paragraphs: [
          "You must be at least 18 years old, have reached the legal age of majority where you live, and be legally able to enter a binding agreement. You may not access or use the platform where doing so is prohibited by law.",
          "By accessing the platform, connecting a wallet, or creating an account, you attest that you meet these requirements. Crypto Sugar Babes does not routinely require government identification solely to open a wallet-based account, but may request age or identity evidence when required by law, prompted by a report or risk signal, or reasonably necessary for safety. We may restrict or remove access if a permitted request is refused or the evidence is unreliable."
        ]
      },
      {
        title: "2. Platform role and no agency relationship",
        paragraphs: [
          "Crypto Sugar Babes provides online social discovery, profiles, messaging, and optional digital support features. It is not an escort agency, employment agency, broker, representative, or party to private arrangements between users. The platform does not arrange meetings or buy, sell, direct, guarantee, sponsor, or endorse personal services.",
          "Users communicate and make decisions independently and at their own risk. Any communication, meeting, gift, or arrangement must be lawful, voluntary, consensual, and permitted in every relevant location."
        ]
      },
      {
        title: "3. Wallet access and account responsibility",
        paragraphs: ["A wallet signature may be used to authenticate you. You are responsible for securing your wallet, device, recovery phrase, and private keys. We will never request your recovery phrase or private key. You are responsible for activity authorised by your connected wallet unless you promptly report suspected compromise."]
      },
      {
        title: "4. Account roles and visibility",
        paragraphs: ["Creator accounts may submit a public profile for review. Customer accounts remain private and are not shown in public creator discovery. Account roles do not change these terms or permit unlawful conduct."]
      },
      {
        title: "5. Profiles, review, and user content",
        items: [
          "Information and photographs must be accurate, lawful, and yours to use.",
          "You must not impersonate another person or upload private, intimate, or copyrighted material without permission.",
          "You grant us a limited licence to host, process, moderate, display, and distribute your content as needed to operate the platform.",
          "We may reject, restrict, or remove content or profiles that breach these terms or create safety or legal risk."
        ],
        paragraphs: ["Profile review checks submitted content for completeness, apparent adult status, prohibited material, and obvious safety concerns. It does not guarantee a user's legal identity, age, character, location, photographs, intentions, or conduct. A profile is not government-ID verified unless we expressly label it that way after completing that separate process."]
      },
      {
        title: "6. Prohibited conduct",
        items: [
          "Underage use or content, trafficking, coercion, exploitation, non-consensual conduct, or attempts to facilitate unlawful activity.",
          "Threats, targeted abuse, repeated rudeness toward others, harassment, hate, stalking, blackmail, extortion, doxxing, fraud, scams, or deceptive financial requests.",
          "Malware, scraping, account interference, evasion of moderation, or attempts to access another user’s information.",
          "Money laundering, sanctions evasion, illegal transactions, or use of proceeds connected to unlawful activity.",
          "Spam, unauthorized advertising, manipulation of likes or reputation, false reports, and attempts to interfere with platform pricing or transaction records."
        ]
      },
      {
        title: "7. Paid features, gifts, and platform fees",
        paragraphs: [
          "Where paid likes, gifts, or boosted messages are offered, the payment quote identifies the amount, network, token, creator share, and platform share before you approve the wallet transaction. Unless the quote expressly says otherwise, eligible creator-support payments are allocated 90% to the creator and 10% to Crypto Sugar Babes. Network gas fees are separate and are paid to the blockchain network, not to the creator or platform.",
          "A gift or paid interaction is voluntary digital support. It does not purchase a meeting, response, relationship, service, or particular outcome. Displayed reputation or visibility points are platform features, have no cash value, and may be adjusted or removed to address abuse or technical errors."
        ]
      },
      {
        title: "8. Blockchain finality and refunds",
        paragraphs: [
          "You control and authorize transactions through your wallet. Review the token, network, recipient addresses, amount, and fees before signing. Once confirmed by the relevant blockchain, a transfer is normally final and irreversible. Crypto Sugar Babes cannot cancel it, initiate a card-style chargeback, or retrieve funds from a recipient-controlled wallet.",
          "Except where required by applicable law or expressly agreed by the relevant recipient, confirmed on-chain transactions are non-refundable. Moderation of a profile does not itself reverse a transaction or guarantee reimbursement. Test-mode actions do not transfer funds or create earnings."
        ],
        action: { label: "Read the disputes process", href: "/disputes" }
      },
      {
        title: "9. Reports, disputes, and moderation",
        paragraphs: [
          "Platform messages are encrypted in storage but are not end-to-end encrypted. We may permit specifically authorised administrators to review relevant messages, profiles, payment records, transaction hashes, and other information to investigate a report, provide support, protect users, enforce these terms, resolve disputes, or comply with law. Opening message content requires a stated reason and is recorded with the administrator identity and access time.",
          "We may warn users, remove content, restrict features, preserve evidence, suspend or remove accounts, and cooperate with lawful authorities. Profiles associated with abusive, rude, threatening, extortionate, fraudulent, coercive, or otherwise inappropriate or unlawful conduct may be removed."
        ]
      },
      {
        title: "10. Suspension and termination",
        paragraphs: ["We may restrict features, withhold processing of suspected unlawful activity where technically and legally possible, suspend access, or terminate accounts to protect users, comply with law, investigate risk, or enforce these terms. You may stop using the service at any time and request deletion of eligible personal information."]
      },
      {
        title: "11. Disclaimers and responsibility between users",
        paragraphs: ["To the maximum extent permitted by law, the platform is provided without guarantees of continuous availability or that users, profiles, communications, or outcomes will be accurate, safe, lawful, or suitable. Users remain responsible for their own communications, meetings, payments, decisions, and arrangements. Nothing in these terms excludes rights or liability that cannot lawfully be excluded."]
      },
      {
        title: "12. Changes and contact",
        paragraphs: ["We may update these terms as the service develops. Material changes will be posted with a revised date. Continued use after an update takes effect means you accept the revised terms, to the extent permitted by law."],
        action: { label: "Email legal and safety", href: "mailto:email@cryptosugarbabes.com?subject=Terms%20or%20safety%20question" }
      }
    ]}
  />;
}
