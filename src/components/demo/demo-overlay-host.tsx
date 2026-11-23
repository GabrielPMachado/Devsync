"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { closeDemoHref } from "./demo-href";
import { DemoOverlay } from "./demo-overlay";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mostra a <DemoOverlay> quando a página tem `?demo=<id>`. Assim o botão Voltar
 * fecha a camada e o link pode ser compartilhado. Vai dentro de <Suspense>.
 */
export function DemoOverlayHost() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const demoId = params.get("demo");
  // Se a camada abriu por um clique aqui dentro, fechar = voltar no histórico.
  const openedHere = useRef(false);
  const firstRender = useRef(true);

  useEffect(() => {
    if (!firstRender.current && demoId) openedHere.current = true;
    if (!demoId) openedHere.current = false;
    firstRender.current = false;
  }, [demoId]);

  const close = useCallback(() => {
    if (openedHere.current) router.back();
    else router.replace(closeDemoHref(pathname, params.toString()), { scroll: false });
  }, [router, pathname, params]);

  if (!demoId || !UUID.test(demoId)) return null;
  return <DemoOverlay key={demoId} demoId={demoId} onClose={close} />;
}
