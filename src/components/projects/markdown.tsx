import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

/** Markdown do autor, sem HTML cru. Links ficam na mesma guia e não passam reputação. */
export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`markdown flex flex-col gap-3 text-[15px] leading-relaxed text-text-secondary ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        urlTransform={(url) => {
          const safe = defaultUrlTransform(url);
          return /^(https?:|mailto:|\/|#)/i.test(safe) ? safe : "";
        }}
        components={{
          a: ({ href, children }) => (href ? <a href={href} rel="nofollow ugc noopener" className="text-text-link underline-offset-2 hover:underline">{children}</a> : <span>{children}</span>),
          h1: ({ children }) => <h2 className="font-display text-xl font-bold text-text-primary">{children}</h2>,
          h2: ({ children }) => <h3 className="font-display text-lg font-bold text-text-primary">{children}</h3>,
          h3: ({ children }) => <h4 className="font-display text-base font-bold text-text-primary">{children}</h4>,
          ul: ({ children }) => <ul className="ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1">{children}</ol>,
          pre: ({ children }) => <pre className="overflow-x-auto rounded-lg border border-border-default bg-bg-base p-4 font-mono text-[13px] text-text-primary">{children}</pre>,
          code: ({ children, className: c }) => (c ? <code className={c}>{children}</code> : <code className="rounded-sm bg-bg-muted px-1 py-0.5 font-mono text-[13px] text-text-primary">{children}</code>),
          img: () => null,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
