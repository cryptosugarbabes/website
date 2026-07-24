const X_URL = "https://x.com/Cryptosugarbbs";

export function XLink({ className = "" }: { className?: string }) {
  return (
    <a
      className={`x-link ${className}`.trim()}
      href={X_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Follow Crypto Sugar Babes on X"
      title="Follow @Cryptosugarbbs on X"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18.9 2H22l-6.8 7.8L23.2 22H17l-4.9-6.4L6.5 22H3.4l7.2-8.3L.8 2h6.4l4.4 5.8L18.9 2Zm-1.1 17.8h1.7L6.3 4.1H4.5l13.3 15.7Z"/>
      </svg>
    </a>
  );
}
