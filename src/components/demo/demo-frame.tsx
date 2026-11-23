/** sandbox da spec (5.2): sem allow-top-navigation. allow-same-origin é seguro porque a demo vem de outro domínio. */
export const DEMO_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-modals";

/** O iframe isolado onde a demo roda. */
/** `preview`: miniatura que não recebe foco nem clique (a demo de verdade abre na camada). */
export function DemoFrame({ src, title, reloadKey = 0, className = "", preview = false }: { src: string; title: string; reloadKey?: number; className?: string; preview?: boolean }) {
  return (
    <iframe
      key={reloadKey}
      src={src}
      title={title}
      sandbox={DEMO_SANDBOX}
      referrerPolicy="strict-origin-when-cross-origin"
      loading={preview ? "lazy" : undefined}
      tabIndex={preview ? -1 : undefined}
      aria-hidden={preview || undefined}
      className={`size-full border-0 bg-white ${preview ? "pointer-events-none" : ""} ${className}`}
    />
  );
}
