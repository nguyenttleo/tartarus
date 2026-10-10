export function GlitchText({
  children,
  className = "",
  as: Tag = "span",
}: {
  children: string;
  className?: string;
  as?: "span" | "h1" | "h2";
}) {
  return (
    <Tag className={`glitch font-display glow ${className}`} data-text={children}>
      {children}
    </Tag>
  );
}
