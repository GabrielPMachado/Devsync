/** sandbox da spec (5.2): sem allow-top-navigation. allow-same-origin é seguro porque a demo vem de outro domínio. */
export const DEMO_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups allow-modals";

/** O iframe isolado onde a demo roda. */
export function DemoFrame({ src, title, reloadKey = 0, className = "" }: { src: string; title: string; reloadKey?: number; className?: string }) {
  return (
    <iframe
      key={reloadKey}
      src={src}
      title={title}
      sandbox={DEMO_SANDBOX}
      referrerPolicy="strict-origin-when-cross-origin"
      className={`size-full border-0 bg-white ${className}`}
    />
  );
}
