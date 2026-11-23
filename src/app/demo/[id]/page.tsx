import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { DemoStandalone } from "@/components/demo/demo-standalone";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Demo");
  return { title: t("metaTitle"), robots: { index: false } };
}

/**
 * Destino do serviço de demos quando alguém abre a URL da demo direto no
 * navegador: a demo continua dentro da Devsync, com o aviso de conteúdo de usuário.
 */
export default function DemoPage({ params }: PageProps<"/demo/[id]">) {
  return (
    <Suspense fallback={null}>
      <Standalone params={params} />
    </Suspense>
  );
}

async function Standalone({ params }: { params: PageProps<"/demo/[id]">["params"] }) {
  const { id } = await params;
  return <DemoStandalone demoId={id} />;
}
