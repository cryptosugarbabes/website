import Link from "next/link";
import { InstagramLink } from "@/components/instagram-link";
import { XLink } from "@/components/x-link";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export type SeoContentSection = {
  title: string;
  paragraphs: string[];
  items?: string[];
};

export function SeoContentPage({
  eyebrow,
  title,
  intro,
  path,
  sections,
  cta,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  path: string;
  sections: SeoContentSection[];
  cta: { title: string; body: string; label: string; href: string };
}) {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${absoluteUrl(path)}#webpage`,
        url: absoluteUrl(path),
        name: title,
        description: intro,
        isPartOf: { "@type": "WebSite", name: SITE_NAME, url: absoluteUrl("/") },
        inLanguage: "en",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
          { "@type": "ListItem", position: 2, name: title, item: absoluteUrl(path) },
        ],
      },
    ],
  };

  return (
    <main className="seo-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}/>
      <header className="legal-header seo-header">
        <div className="brand-social">
          <Link className="brand" href="/" aria-label="Crypto Sugar Babes home">
            <img className="brand-logo-image" src="/csb-coin-logo.png" alt=""/>
            <span>Crypto Sugar Babes</span>
          </Link>
          <InstagramLink/>
          <XLink/>
        </div>
        <nav aria-label="Main navigation">
          <Link href="/how-it-works">How it works</Link>
          <Link href="/crypto-safety">Crypto safety</Link>
          <Link href="/forums">Forums</Link>
        </nav>
      </header>

      <article className="seo-document">
        <header className="seo-hero">
          <span className="section-kicker">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <div className="seo-hero-actions">
            <Link className="primary-button" href="/?signin=1">Join free</Link>
            <Link href="/forums">Visit the community</Link>
          </div>
        </header>

        <div className="seo-sections">
          {sections.map((section, index) => (
            <section key={section.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.items && <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
              </div>
            </section>
          ))}
        </div>

        <aside className="seo-cta">
          <div><span className="section-kicker">CRYPTO SUGAR BABES</span><h2>{cta.title}</h2><p>{cta.body}</p></div>
          <Link className="primary-button" href={cta.href}>{cta.label}</Link>
        </aside>

        <nav className="seo-related" aria-label="Related guides">
          <strong>Explore more</strong>
          <Link href="/how-it-works">How Crypto Sugar Babes works</Link>
          <Link href="/crypto-safety">Crypto and social safety</Link>
          <Link href="/crypto-payments">USDC payments on Base and Solana</Link>
          <Link href="/safety">Community safety rules</Link>
        </nav>
      </article>

      <footer className="legal-footer">
        <div className="legal-footer-brand"><span>© 2026 Crypto Sugar Babes. Safety First Always.</span><InstagramLink/><XLink/></div>
        <nav><Link href="/forums">Forums</Link><Link href="/safety">Safety</Link><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></nav>
      </footer>
    </main>
  );
}
