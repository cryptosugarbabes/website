import Link from "next/link";
import { InstagramLink } from "@/components/instagram-link";
import { XLink } from "@/components/x-link";

type LegalSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
  action?: {
    label: string;
    href: string;
  };
};

export function LegalPage({ eyebrow, title, intro, updated, sections }: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}) {
  return (
    <main className="legal-shell">
      <header className="legal-header">
        <div className="brand-social">
          <Link className="brand" href="/" aria-label="Crypto Sugar home">
            <img className="brand-logo-image" src="/csb-coin-logo.png" alt=""/>
            <span>Crypto Sugar Babes</span>
          </Link>
          <InstagramLink/>
          <XLink/>
        </div>
        <Link className="legal-back" href="/">Back to the site</Link>
      </header>
      <article className="legal-document">
        <div className="legal-title">
          <span className="section-kicker">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <small>Last updated: {updated}</small>
        </div>
        <div className="legal-sections">
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
              {section.action && <a className="legal-action" href={section.action.href}>{section.action.label}</a>}
            </section>
          ))}
        </div>
      </article>
      <footer className="legal-footer">
        <div className="legal-footer-brand"><span>© 2026 Crypto Sugar Babes. Safety First Always.</span><InstagramLink/><XLink/></div>
        <nav><Link href="/safety">Safety</Link><Link href="/disputes">Disputes</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></nav>
      </footer>
    </main>
  );
}
