const INSTAGRAM_URL = "https://www.instagram.com/cryptosugarbabes/";

export function InstagramLink({ className = "" }: { className?: string }) {
  return (
    <a
      className={`instagram-link ${className}`.trim()}
      href={INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Follow Crypto Sugar Babes on Instagram"
      title="Follow @cryptosugarbabes on Instagram"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5"/>
        <circle cx="12" cy="12" r="4"/>
        <circle className="instagram-dot" cx="17.4" cy="6.6" r="1"/>
      </svg>
    </a>
  );
}
