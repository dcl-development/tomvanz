/** A drawn ×, so it sits exactly in the middle of its button (a text × sits slightly off). */
export function CloseIcon({className = 'h-4 w-4'}: {className?: string}) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
