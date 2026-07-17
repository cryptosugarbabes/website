import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy — Crypto Sugar Babes",
  description: "How Crypto Sugar Babes collects, uses, protects, and retains personal information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return <LegalPage
    eyebrow="YOUR PRIVACY"
    title="Privacy Policy"
    intro="This policy explains what information Crypto Sugar Babes handles, why we use it, and the choices available to you."
    updated="18 July 2026"
    sections={[
      {
        title: "1. Information we collect",
        paragraphs: ["We collect information you choose to provide when creating or managing a profile, contacting us, making a safety report, or communicating through the platform."],
        items: [
          "Wallet addresses, wallet network, and signed authentication messages.",
          "Profile details such as display name, age, location, biography, interests, and uploaded photographs.",
          "Publication, moderation, support, safety-report, and account-status records.",
          "Technical information such as IP address, browser type, device information, timestamps, and basic security logs.",
          "Anonymous visitor-chat messages, the page where chat was opened, a hashed network identifier used for rate limiting, and administrator or Telegram replies.",
          "When paid features launch, transaction identifiers, amounts, ledger entries, creator balances, and payout records."
        ]
      },
      {
        title: "2. How we use information",
        items: [
          "Authenticate users and protect accounts without collecting wallet private keys or recovery phrases.",
          "Create, review, publish, and manage profiles and photographs.",
          "Operate conversations, favorites, paid interactions, creator earnings, and platform fees when those features are available.",
          "Notify administrators that an anonymous visitor is on the website and deliver visitor support conversations through the administrator dashboard, email, and the configured private Telegram bot.",
          "Prevent fraud, abuse, coercion, trafficking, underage access, and other prohibited conduct.",
          "Respond to support requests, enforce our terms, and comply with lawful obligations."
        ]
      },
      {
        title: "3. Public information and blockchains",
        paragraphs: [
          "Approved profile information is visible to other visitors. Do not publish details you want to keep private.",
          "Public blockchains are controlled by independent networks. Wallet addresses and on-chain transactions may be publicly visible and cannot normally be altered or deleted by Crypto Sugar Babes. Connecting a wallet does not give us access to your private key or permission to move funds."
        ]
      },
      {
        title: "4. How information is shared",
        paragraphs: ["We do not sell personal information. We may share the minimum information needed with hosting, storage, security, identity-review, analytics, communications, blockchain, and payment-service providers; with professional advisers; or where required to protect users, enforce our rules, or comply with law."]
      },
      {
        title: "5. Retention and security",
        paragraphs: [
          "We retain information for as long as reasonably needed to provide the service, protect users, resolve disputes, meet accounting or legal obligations, and prevent repeat abuse. We use access controls, encrypted transport, administrator moderation tools, and operational backups, but no internet service can guarantee absolute security.",
          "Platform messages are encrypted in storage but are not end-to-end encrypted. The service must be able to decrypt messages for delivery and may permit specifically authorised administrators to open a conversation for safety, support, dispute handling, moderation, or legal compliance. Administrators must state a reason, and the identity, reason, conversation, and access time are recorded in an audit log."
        ]
      },
      {
        title: "6. Your choices and rights",
        paragraphs: ["Depending on your location, you may have rights to access, correct, delete, restrict, or obtain a copy of personal information, or object to certain uses. Some records may be retained where legally required or necessary for safety and fraud prevention. Public blockchain data is outside our control."],
      },
      {
        title: "7. Adults only",
        paragraphs: ["The platform is intended only for adults aged 18 or older who have reached the legal age of majority where they live. We do not knowingly permit minors to use the service. Report suspected underage use immediately."],
        action: { label: "Report suspected underage use", href: "mailto:email@cryptosugarbabes.com?subject=Urgent%20underage%20use%20report" }
      },
      {
        title: "8. International use and updates",
        paragraphs: ["Your information may be processed in countries other than your own. We may update this policy as the platform develops and will post the revised date on this page."],
      },
      {
        title: "9. Contact",
        paragraphs: ["Contact us with privacy questions, rights requests, or safety concerns."],
        action: { label: "Email Crypto Sugar Babes", href: "mailto:email@cryptosugarbabes.com?subject=Privacy%20request" }
      }
    ]}
  />;
}
