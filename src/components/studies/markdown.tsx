import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

/**
 * Markdown de perguntas e respostas. HTML cru nunca é renderizado (sem rehype-raw);
 * o react-markdown já limpa URLs perigosas (javascript:). Imagens viram link para
 * não carregar arquivos de terceiros na página (rastreamento, imagens enormes).
 */
const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="nofollow ugc noopener noreferrer" className="text-text-link underline-offset-2 hover:underline">
      {children}
    </a>
  ),
  img: ({ src, alt }) => (
    <a href={typeof src === "string" ? src : undefined} target="_blank" rel="nofollow ugc noopener noreferrer" className="text-text-link underline">
      {alt || (typeof src === "string" ? src : "")}
    </a>
  ),
};

export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  return (
    <div className={`devsync-markdown ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[[rehypeHighlight, { detect: false }]]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
