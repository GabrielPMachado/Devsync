import { CircleHelp } from "lucide-react";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { followingSet, suggestedPeople, unansweredQuestions } from "@/lib/social/queries";
import { PersonRow } from "./person-row";

const PANEL = "flex flex-col gap-4 rounded-xl border border-border-default bg-bg-surface p-4";

/** "Quem seguir": sugestões do banco (tecnologias em comum, depois mais seguidos). */
export async function WhoToFollow({ viewerId, path, limit = 3, showBio = false, title }: { viewerId: string | null; path: string; limit?: number; showBio?: boolean; title?: string }) {
  const people = await suggestedPeople(limit);
  if (people.length === 0) return null;
  const follows = await followingSet(viewerId, people.map((p) => p.id));
  const t = await getTranslations("Discover");
  return (
    <section className={PANEL} aria-labelledby="quem-seguir">
      <div className="flex items-center justify-between">
        <h2 id="quem-seguir" className="font-display text-base font-bold text-text-primary">
          {title ?? t("whoToFollow")}
        </h2>
        <Link href="/explorar" className="text-sm font-semibold text-text-link hover:underline">
          {t("seeMore")}
        </Link>
      </div>
      {people.map((p) => (
        <PersonRow key={p.id} person={p} following={follows.has(p.id)} viewerId={viewerId} path={path} showBio={showBio} />
      ))}
    </section>
  );
}

/** "Sem resposta": perguntas mais novas ainda sem resposta. */
export async function Unanswered({ limit = 3 }: { limit?: number }) {
  const questions = await unansweredQuestions(limit);
  if (questions.length === 0) return null;
  const t = await getTranslations("Discover");
  return (
    <section className={PANEL} aria-labelledby="sem-resposta">
      <h2 id="sem-resposta" className="flex items-center gap-2 font-display text-base font-bold text-text-primary">
        <CircleHelp className="size-4 text-brand-accent" aria-hidden="true" />
        {t("unanswered")}
      </h2>
      <ul className="flex flex-col gap-3">
        {questions.map((q) => (
          <li key={q.id} className="flex flex-col gap-1">
            <Link href={`/estudos/${q.slug}`} className="line-clamp-2 text-sm font-semibold text-text-link hover:underline">
              {q.title}
            </Link>
            {q.tags.length ? <span className="font-mono text-xs text-text-muted">{q.tags.slice(0, 2).join(" · ")}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
