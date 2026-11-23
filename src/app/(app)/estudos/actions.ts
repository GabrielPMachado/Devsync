"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/viewer";
import { splitTags, validateAnswer, validateQuestion, type AnswerErrors, type QuestionErrors } from "@/lib/studies/rules";
import { createClient } from "@/lib/supabase/server";

/**
 * Escritas dos Estudos. Sempre com o cliente do usuário: a RLS confere quem pode
 * o quê (autor, usuário suspenso, voto na própria resposta...). Aqui só validamos
 * para dar mensagens boas antes de bater no banco.
 */

export type QuestionFormState = { errors?: QuestionErrors & { form?: "unknown" }; invalidTags?: string[] };
export type AnswerFormState = { errors?: AnswerErrors & { form?: "unknown" }; ok?: number };

const questionPath = (slug: string) => `/estudos/${slug}`;

async function requireMember(next: string) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/entrar?next=${encodeURIComponent(next)}`);
  if (!viewer.username) redirect("/boas-vindas");
  return viewer;
}

function readQuestion(formData: FormData) {
  const title = (formData.get("title")?.toString() ?? "").trim();
  const body = formData.get("body")?.toString() ?? "";
  const { slugs: tags, invalid: invalidTags } = splitTags(formData.get("tags")?.toString() ?? "");
  return { title, body, tags, invalidTags };
}

type Client = Awaited<ReturnType<typeof createClient>>;

/** ids das tags pelo slug, criando as que ainda não existem (sem corrida: ON CONFLICT DO NOTHING). */
async function tagIds(supabase: Client, slugs: string[]): Promise<Map<string, string> | null> {
  const { data: existing, error: readError } = await supabase.from("tags").select("id, slug").in("slug", slugs);
  if (readError) return null;
  const found = new Map((existing ?? []).map((t) => [t.slug as string, t.id as string]));
  const missing = slugs.filter((s) => !found.has(s));
  if (missing.length === 0) return found;
  const { error } = await supabase
    .from("tags")
    .upsert(missing.map((slug) => ({ slug, name: slug })), { onConflict: "slug", ignoreDuplicates: true });
  if (error) return null;
  const { data: created } = await supabase.from("tags").select("id, slug").in("slug", missing);
  for (const t of created ?? []) found.set(t.slug as string, t.id as string);
  return slugs.every((s) => found.has(s)) ? found : null;
}

/** Liga a pergunta às tags, criando as que ainda não existem. */
async function addQuestionTags(supabase: Client, questionId: string, slugs: string[]) {
  const ids = await tagIds(supabase, slugs);
  if (!ids) return false;
  const { error } = await supabase.from("question_tags").insert(slugs.map((s) => ({ question_id: questionId, tag_id: ids.get(s) })));
  return !error;
}

export async function askQuestion(_prev: QuestionFormState, formData: FormData): Promise<QuestionFormState> {
  await requireMember("/estudos/perguntar");
  const input = readQuestion(formData);
  const errors = validateQuestion(input);
  if (Object.keys(errors).length > 0) return { errors, invalidTags: input.invalidTags };

  const supabase = await createClient();
  const { data, error } = await supabase.from("questions").insert({ title: input.title, body_md: input.body }).select("id, slug").single();
  if (error || !data) return { errors: { form: "unknown" } };

  if (!(await addQuestionTags(supabase, data.id as string, input.tags))) {
    // Sem tags a pergunta não aparece direito nos filtros: desfaz.
    await supabase.from("questions").delete().eq("id", data.id as string);
    return { errors: { form: "unknown" } };
  }
  redirect(questionPath(data.slug as string));
}

export async function editQuestion(questionId: string, slug: string, _prev: QuestionFormState, formData: FormData): Promise<QuestionFormState> {
  await requireMember(`${questionPath(slug)}/editar`);
  const input = readQuestion(formData);
  const errors = validateQuestion(input);
  if (Object.keys(errors).length > 0) return { errors, invalidTags: input.invalidTags };

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase.from("question_tags").select("tag_id, tags(slug)").eq("question_id", questionId);
  if (readError) return { errors: { form: "unknown" } };
  const currentSlugs = new Map(
    (current ?? []).flatMap((row) => [row.tags].flat().flatMap((t) => (t ? [[(t as { slug: string }).slug, row.tag_id as string] as const] : []))),
  );
  const removed = [...currentSlugs.entries()].filter(([s]) => !input.tags.includes(s)).map(([, id]) => id);
  const added = input.tags.filter((s) => !currentSlugs.has(s));

  // Tags primeiro (tira as velhas para caber no limite de 5, põe as novas). Se algo
  // falhar, devolve as velhas e não mexe no texto: nada fica salvo pela metade.
  if (removed.length > 0) {
    const { error } = await supabase.from("question_tags").delete().eq("question_id", questionId).in("tag_id", removed);
    if (error) return { errors: { form: "unknown" } };
  }
  if (added.length > 0 && !(await addQuestionTags(supabase, questionId, added))) {
    if (removed.length > 0) await supabase.from("question_tags").insert(removed.map((tag_id) => ({ question_id: questionId, tag_id })));
    return { errors: { form: "unknown" } };
  }

  const { data, error } = await supabase.from("questions").update({ title: input.title, body_md: input.body }).eq("id", questionId).select("id");
  if (error || !data?.length) return { errors: { form: "unknown" } };

  redirect(questionPath(slug));
}

function readAnswer(formData: FormData) {
  return { body: formData.get("body")?.toString() ?? "", techVersion: (formData.get("techVersion")?.toString() ?? "").trim() };
}

export async function postAnswer(questionId: string, slug: string, prev: AnswerFormState, formData: FormData): Promise<AnswerFormState> {
  await requireMember(questionPath(slug));
  const input = readAnswer(formData);
  const errors = validateAnswer(input);
  if (Object.keys(errors).length > 0) return { errors };

  const supabase = await createClient();
  const { error } = await supabase
    .from("answers")
    .insert({ question_id: questionId, body_md: input.body, tech_version: input.techVersion || null });
  if (error) return { errors: { form: "unknown" } };
  refresh();
  // ok muda a cada envio para o formulário saber que deve limpar o texto.
  return { ok: (prev.ok ?? 0) + 1 };
}

export async function editAnswer(answerId: string, slug: string, _prev: AnswerFormState, formData: FormData): Promise<AnswerFormState> {
  await requireMember(questionPath(slug));
  const input = readAnswer(formData);
  const errors = validateAnswer(input);
  if (Object.keys(errors).length > 0) return { errors };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("answers")
    .update({ body_md: input.body, tech_version: input.techVersion || null })
    .eq("id", answerId)
    .select("id");
  if (error || !data?.length) return { errors: { form: "unknown" } };
  redirect(`${questionPath(slug)}#resposta-${answerId}`);
}

/** value 0 retira o voto. */
export async function voteAnswer(answerId: string, value: 1 | -1 | 0, slug: string): Promise<void> {
  const viewer = await requireMember(questionPath(slug));
  const supabase = await createClient();
  if (value === 0) {
    await supabase.from("answer_votes").delete().eq("answer_id", answerId).eq("profile_id", viewer.id);
  } else {
    // Sem upsert: o usuário só tem permissão de gravar answer_id e value (profile_id vem de auth.uid()).
    const { data } = await supabase.from("answer_votes").update({ value }).eq("answer_id", answerId).eq("profile_id", viewer.id).select("answer_id");
    if (!data?.length) await supabase.from("answer_votes").insert({ answer_id: answerId, value });
  }
  refresh();
}

/** answerId null desmarca a aceita. */
export async function acceptAnswer(questionId: string, answerId: string | null, slug: string): Promise<void> {
  await requireMember(questionPath(slug));
  const supabase = await createClient();
  await supabase.from("questions").update({ accepted_answer_id: answerId }).eq("id", questionId);
  refresh();
}

export async function toggleOutdated(answerId: string, on: boolean, slug: string): Promise<void> {
  const viewer = await requireMember(questionPath(slug));
  const supabase = await createClient();
  if (on) await supabase.from("outdated_flags").insert({ answer_id: answerId });
  else await supabase.from("outdated_flags").delete().eq("answer_id", answerId).eq("profile_id", viewer.id);
  refresh();
}

export async function toggleDetailRequest(questionId: string, on: boolean, slug: string): Promise<void> {
  const viewer = await requireMember(questionPath(slug));
  const supabase = await createClient();
  if (on) await supabase.from("detail_requests").insert({ question_id: questionId });
  else await supabase.from("detail_requests").delete().eq("question_id", questionId).eq("profile_id", viewer.id);
  refresh();
}
