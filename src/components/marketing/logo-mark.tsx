/**
 * Memo mark. Light themes: black tile with white M and dots. Dark theme: the colours invert,
 * white tile with black M and dots.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden className={className}>
      <rect width="32" height="32" rx="7.11111" className="fill-black dark:fill-white" />
      <circle cx="15.8889" cy="22.6667" r="1.77778" className="fill-white dark:fill-black" />
      <circle cx="7.00002" cy="22.6667" r="1.77778" className="fill-white dark:fill-black" />
      <circle cx="11.4445" cy="9.33344" r="1.77778" className="fill-white dark:fill-black" />
      <circle cx="20.3334" cy="9.33344" r="1.77778" className="fill-white dark:fill-black" />
      <circle cx="24.7778" cy="22.6667" r="1.77778" className="fill-white dark:fill-black" />
      <path d="M7 22.6666L11.4444 9.33325L15.8889 22.6666L20.3333 9.33325L24.7778 22.6666" strokeWidth="0.888889" className="stroke-white dark:stroke-black" />
    </svg>
  );
}
