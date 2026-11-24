"use client";

import { useMemo } from "react";
import { publishProject } from "@/app/(app)/projetos/actions";
import { completeUpload, createUpload, embedCheck, putZip, startBuild, verifyDemo, type BuildRow, type DemoRow } from "@/lib/demos/client";
import { demosBaseUrl } from "@/lib/demos/url";
import { listRepos, repoDetails } from "@/lib/projects/github";
import { buildDemoZip, findSiteSource } from "@/lib/projects/github-demo";
import { createClient } from "@/lib/supabase/client";
import { PublishForm, type PublishServices } from "./publish-form";

/** O formulário ligado ao Supabase do navegador, ao serviço de demos e à ação de publicar. */
export function ConnectedPublishForm({ tags, githubUser }: { tags: { slug: string; name: string }[]; githubUser: string | null }) {
  const services = useMemo<PublishServices>(() => {
    const supabase = createClient();
    return {
      base: demosBaseUrl(),
      token: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
      createUpload,
      putZip: (url, file) => putZip(url, file),
      completeUpload,
      embedCheck,
      verifyDemo,
      readDemo: async (id) => {
        const { data } = await supabase.from("demos").select("status, rejection_reason").eq("id", id).maybeSingle();
        return data as DemoRow | null;
      },
      createLinkDemo: async (url) => {
        const { data, error } = await supabase.from("demos").insert({ kind: "web_link", url }).select("id").single();
        // Recusas do banco (moderação): viram motivos conhecidos de DemoReasons.
        if (error?.message === "Domínio bloqueado") throw new Error("blocked_domain");
        if (error?.message === "URL inválida") throw new Error("invalid_url");
        if (error || !data) throw new Error(error?.message ?? "demo");
        return data.id as string;
      },
      // Build automático: ligado com NEXT_PUBLIC_DEMO_BUILDS=1 (depois de configurar o repositório de builds).
      ...(process.env.NEXT_PUBLIC_DEMO_BUILDS === "1"
        ? {
            startBuild: (o, repo, ref) => startBuild(o, repo, ref),
            readBuild: async (id) => {
              const { data } = await supabase.from("demo_builds").select("stage, error, log, framework").eq("id", id).maybeSingle();
              return data as BuildRow | null;
            },
          }
        : {}),
      publish: publishProject,
      github: { user: githubUser, listRepos: (u) => listRepos(u), repoDetails: (r) => repoDetails(r),
        findSiteSource: (r) => findSiteSource(r),
        buildDemoZip: (r, s) => buildDemoZip(r, s),
      },
    };
  }, [githubUser]);
  return <PublishForm tags={tags} services={services} />;
}
