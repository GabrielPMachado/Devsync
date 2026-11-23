import { useTranslations } from "next-intl";
import { useId } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

/**
 * Markdown de perguntas e respostas. HTML cru nunca é renderizado (sem rehype-raw);
 * o react-markdown já limpa URLs perigosas (javascript:). Imagens viram link para
 * não carregar arquivos de terceiros na página (rastreamento, imagens enormes).
 */
const external = (href: unknown): href is string => typeof href === "string" && /^https?:\/\//i.test(href);

const components: Components = {
  a: ({ href, children, node, ...rest }) => {
    void node;
    // URL perigosa (javascript:...) chega vazia: vira texto. Âncoras internas (notas) ficam na mesma aba.
    if (!href) return <span>{children}</span>;
    return external(href) ? (
      <a href={href} target="_blank" rel="nofollow ugc noopener noreferrer" className="text-text-link underline-offset-2 hover:underline">
        {children}
      </a>
    ) : (
      <a href={href} {...rest} className="text-text-link underline-offset-2 hover:underline">
        {children}
      </a>
    );
  },
  // O título da página é o único h1: os títulos do texto descem de nível.
  h1: ({ children }) => <h3>{children}</h3>,
  h2: ({ children }) => <h3>{children}</h3>,
  h3: ({ children }) => <h4>{children}</h4>,
  h4: ({ children }) => <h5>{children}</h5>,
  h5: ({ children }) => <h6>{children}</h6>,
  img: ({ src, alt }) =>
    external(src) ? (
      <a href={src} target="_blank" rel="nofollow ugc noopener noreferrer" className="text-text-link underline">
        {alt || src}
      </a>
    ) : (
      <span>{alt}</span>
    ),
};

export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  // Prefixo próprio por bloco: notas [^1] da pergunta e das respostas não colidem.
  const prefix = `md${useId().replace(/[^a-zA-Z0-9]/g, "")}-`;
  const t = useTranslations("Studies");
  return (
    <div className={`devsync-markdown ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        remarkRehypeOptions={{ clobberPrefix: prefix, footnoteLabel: t("footnotes"), footnoteBackLabel: t("footnoteBack") }}
        rehypePlugins={[[rehypeHighlight, { detect: false }]]}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
