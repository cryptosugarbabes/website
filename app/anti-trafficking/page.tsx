import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Anti-Trafficking & Protection — Crypto Sugar Babes",
  description: "Crypto Sugar Babes' anti-trafficking mission, prohibited conduct, warning signs, and official reporting resources.",
  alternates: { canonical: "/anti-trafficking" },
};

export default function AntiTraffickingPage() {
  return <LegalPage
    eyebrow="PROTECT PEOPLE · REPORT EXPLOITATION"
    title="Anti-trafficking and protection"
    intro="We are committed to protecting people from trafficking, sexual exploitation, child abuse, coercion, and other illegal activity."
    updated="23 July 2026"
    sections={[
      {
        title: "1. Our mission and values",
        paragraphs: [
          "Crypto Sugar Babes exists to empower consenting adults—not to enable anyone to buy, sell, control, or exploit another person. We want people to retain control of their identity, boundaries, communication, wallet, and decisions, and to have clear ways to report conduct that places them or others at risk.",
          "We prohibit human trafficking, sex trafficking, labour trafficking, sexual activity or exploitation involving minors, child sexual abuse material, grooming, non-consensual intimate imagery, unlawful pornography, coercion, blackmail, extortion, and attempts to arrange or promote illegal activity."
        ]
      },
      {
        title: "2. No payment buys access to a person",
        paragraphs: [
          "Messages, gifts, and Sugars are voluntary forms of communication or support. They do not purchase sexual services and never create a right to a meeting, relationship, reply, image, personal information, physical contact, or any other act. Consent must be informed, voluntary, specific, and capable of being withdrawn at any time.",
          "No person may operate another member's account, seize or direct their earnings, withhold documents, threaten exposure, impose a debt, or use money, immigration status, housing, employment, addiction, or personal information to control them."
        ]
      },
      {
        title: "3. Warning signs",
        items: [
          "Someone else controls a person's phone, account, wallet, identity documents, travel, work, money, or communications.",
          "A person appears coached, fearful, monitored, unable to speak freely, or unable to leave a situation.",
          "A recruiter offers unrealistic work, travel, housing, romance, or financial promises and then demands secrecy, payment, documents, images, or obedience.",
          "A user pressures someone to move off-platform immediately, conceal their age, misrepresent a relationship, accept a debt, or participate in sexual or unlawful activity.",
          "Profiles, messages, photographs, or payment activity suggest that a minor or an exploited person may be involved."
        ]
      },
      {
        title: "4. Report to Crypto Sugar Babes",
        paragraphs: [
          "Use the profile reporting tools or email our safety team. Include only information you can provide safely, such as the profile URL, dates, public wallet address, transaction hash, messages, and screenshots already in your possession. Never confront a suspected trafficker, and never send us a private key, password, or recovery phrase.",
          "We may restrict or remove content and accounts, preserve relevant records, investigate platform activity, and cooperate with lawful authorities. Reporting to us does not replace contacting emergency services or an official reporting agency."
        ],
        action: { label: "Send a safety report", href: "mailto:email@cryptosugarbabes.com?subject=Trafficking%20or%20exploitation%20report" }
      },
      {
        title: "5. Immediate danger and worldwide police contacts",
        paragraphs: [
          "If someone is in immediate danger, contact the local emergency number now. INTERPOL does not accept crime reports directly from members of the public; contact local or national police, who can work through their country's INTERPOL National Central Bureau when international coordination is needed.",
          "INTERPOL's directory lists National Central Bureaus for its member countries."
        ],
        action: { label: "Find an INTERPOL National Central Bureau", href: "https://www.interpol.int/en/Who-we-are/Member-countries/National-Central-Bureaus-NCBs" }
      },
      {
        title: "6. United States",
        paragraphs: [
          "For suspected trafficking, the U.S. Department of Homeland Security directs reports to federal law enforcement at 1-866-347-2423. The National Human Trafficking Hotline is available at 1-888-373-7888 or by texting BEFREE to 233733. Call 911 for immediate danger."
        ],
        action: { label: "U.S. DHS Blue Campaign reporting information", href: "https://www.dhs.gov/blue-campaign" }
      },
      {
        title: "7. United Kingdom",
        paragraphs: [
          "Call 999 if there is immediate danger. The UK Government's modern slavery service provides online reporting and the Modern Slavery Helpline at 0800 0121 700."
        ],
        action: { label: "UK modern slavery reporting service", href: "https://www.modernslavery.gov.uk/start" }
      },
      {
        title: "8. European Union",
        paragraphs: [
          "The European Commission maintains a list of national anti-trafficking hotlines across EU countries. The EU emergency number is 112."
        ],
        action: { label: "EU national anti-trafficking hotlines", href: "https://home-affairs.ec.europa.eu/policies/internal-security/organised-crime/together-against-trafficking-human-beings/national-hotlines_en" }
      },
      {
        title: "9. Canada",
        paragraphs: [
          "Call 911 for immediate danger. Public Safety Canada directs victims, survivors, and witnesses to the confidential Canadian Human Trafficking Hotline at 1-833-900-1010, available 24 hours a day."
        ],
        action: { label: "Government of Canada help and reporting", href: "https://www.canada.ca/en/public-safety-canada/campaigns/human-trafficking/how-get-help.html" }
      },
      {
        title: "10. Australia",
        paragraphs: [
          "Call 000 for immediate danger. The Australian Federal Police provides a dedicated online form for reports involving human trafficking, slavery, and slavery-like practices."
        ],
        action: { label: "Report to the Australian Federal Police", href: "https://forms.afp.gov.au/online_forms/human_trafficking_form" }
      },
      {
        title: "11. Elsewhere",
        paragraphs: [
          "Contact your local emergency service or national police. If you are unsure which international body is relevant, use the INTERPOL member-country directory above to identify the appropriate National Central Bureau. A victim-support organisation can also help you make a safety plan without confronting a suspected trafficker."
        ],
        action: { label: "Read INTERPOL's trafficking guidance", href: "https://www.interpol.int/en/Crimes/Human-trafficking-and-migrant-smuggling" }
      }
    ]}
  />;
}
