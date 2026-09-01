interface TypingIndicatorProps {
  text: string;
}

export function TypingIndicator({ text }: TypingIndicatorProps) {
  if (!text) return null;

  return (
    <div className="shrink-0 px-4 py-1" aria-live="polite" aria-label={text}>
      <p className="text-caption text-text-muted motion-safe:animate-pulse">{text}</p>
    </div>
  );
}
