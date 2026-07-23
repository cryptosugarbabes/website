import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Anti-Slavery Statement — Crypto Sugar Babes",
  description: "Crypto Sugar Babes' commitment to preventing modern slavery, forced labour, coercion, and exploitation.",
  alternates: { canonical: "/anti-slavery" },
};

export default function AntiSlaveryPage() {
  return <LegalPage
    eyebrow="HUMAN DIGNITY & FREEDOM"
    title="Anti-slavery statement"
    intro="Modern slavery has no place in our platform, our relationships, or the services that support Crypto Sugar Babes."
    updated="23 July 2026"
    sections={[
      {
        title: "1. Our commitment",
        paragraphs: [
          "Crypto Sugar Babes opposes slavery, servitude, forced or compulsory labour, debt bondage, human trafficking, sexual exploitation, and every form of coercion. We do not knowingly permit our platform, business relationships, or services to be used to recruit, control, transport, harbour, advertise, or profit from an exploited person.",
          "This is a voluntary public statement of our principles and current approach. We will review and strengthen it as the platform, its team, and its supply relationships develop."
        ]
      },
      {
        title: "2. A platform intended to empower adults",
        paragraphs: [
          "Crypto Sugar Babes is intended to help consenting adults communicate directly, retain control of their identity and wallet, set their own boundaries, and decide whether to interact. It is not a marketplace for buying or selling sexual services and must never be used to pressure, control, deceive, or exploit another person.",
          "Our mission is to reduce the opportunity for people to be taken advantage of. A profile, conversation, gift, Sugar, or wallet transaction never creates an entitlement to another person's time, attention, images, personal information, meeting, relationship, or sexual activity."
        ]
      },
      {
        title: "3. Prevention on the platform",
        items: [
          "The platform is restricted to people aged 18 or older who have reached the age of majority where they live.",
          "Profiles and photographs may publish after submission, are reviewed regularly, and remain subject to reporting, restriction, suspension, and removal.",
          "Trafficking, coercion, threats, blackmail, extortion, forced labour, sexual exploitation, deceptive recruitment, and control of another person's account or earnings are prohibited.",
          "Users can report profiles and conduct to the safety team. We may preserve relevant records and cooperate with lawful authorities.",
          "No member, contractor, supplier, or partner is authorised to retaliate against a person who raises a concern in good faith."
        ]
      },
      {
        title: "4. Suppliers and business relationships",
        paragraphs: [
          "We expect contractors, hosting and technology providers, advisers, and other suppliers to comply with applicable labour, trafficking, child-protection, and human-rights laws. Where a credible concern arises, we may seek information, require corrective action, suspend work, end a relationship, preserve evidence, or refer the matter to an appropriate authority.",
          "Our current operations do not eliminate risk. We therefore use proportionate checks and will expand documented supplier review, team guidance, and escalation procedures as the business grows."
        ]
      },
      {
        title: "5. Raising a concern",
        paragraphs: [
          "Report suspected slavery, forced labour, coercion, trafficking, exploitation, or retaliation as soon as it is safe to do so. Include the profile or page, dates, public wallet address or transaction hash if relevant, and any evidence you already possess. Never obtain evidence in a way that puts you or another person at risk, and never send a private key or recovery phrase.",
          "If anyone may be in immediate danger, contact local emergency services first. A report to Crypto Sugar Babes does not replace a report to police, a national trafficking authority, or another competent agency."
        ],
        action: { label: "Email the safety team", href: "mailto:email@cryptosugarbabes.com?subject=Modern%20slavery%20concern" }
      },
      {
        title: "6. Related safeguards",
        paragraphs: ["Our Safety and Anti-Trafficking pages explain platform rules, warning signs, reporting routes, and official international resources."],
        action: { label: "Read the Anti-Trafficking policy", href: "/anti-trafficking" }
      }
    ]}
  />;
}
