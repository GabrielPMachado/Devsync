import { ProjectCard } from "@/components/projects/project-card";
import { QuestionCard } from "@/components/studies/question-card";
import type { FeedItem } from "@/lib/social/queries";

/** Projetos e perguntas misturados, na ordem recebida. Projetos lado a lado em pares, como no Figma. */
export function FeedList({ items, basePath, label }: { items: FeedItem[]; basePath: string; label: string }) {
  const now = new Date();
  const blocks: (FeedItem | FeedItem[])[] = [];
  for (const item of items) {
    const last = blocks[blocks.length - 1];
    if (item.kind === "project" && Array.isArray(last) && last.length < 2) last.push(item);
    else blocks.push(item.kind === "project" ? [item] : item);
  }
  return (
    <section aria-label={label} className="flex flex-col gap-5">
      {blocks.map((b) =>
        Array.isArray(b) ? (
          <div key={b.map((x) => (x.kind === "project" ? x.project.id : "")).join("-")} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {b.map((x) => (x.kind === "project" ? <ProjectCard key={x.project.id} project={x.project} basePath={basePath} /> : null))}
          </div>
        ) : b.kind === "question" ? (
          <QuestionCard key={b.question.id} question={b.question} now={now} />
        ) : null,
      )}
    </section>
  );
}
