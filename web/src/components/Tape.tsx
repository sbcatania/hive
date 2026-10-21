/** A strip of masking tape holding a card to the page. Put inside a positioned card. */
export function Tape({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={`tape-strip ${className ?? ""}`} style={style} aria-hidden />;
}
