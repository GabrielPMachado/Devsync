"use client";

import { useMemo } from "react";
import { publishProject } from "@/app/(app)/projetos/actions";
import { completeUpload, createUpload, embedCheck, putZip, verifyDemo, type DemoRow } from "@/lib/demos/client";
import { demosBaseUrl } from "@/lib/demos/url";
import { createClient } from "@/lib/supabase/client";
import { PublishForm, type PublishServices } from "./publish-form";

/** O formulário ligado ao Supabase do navegador, ao serviço de demos e à ação de publicar. */
export function ConnectedPublishForm({ tags }: { tags: { slug: string; name: string }[] }) {
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
      publish: publishProject,
    };
  }, []);
  return <PublishForm tags={tags} services={services} />;
}
