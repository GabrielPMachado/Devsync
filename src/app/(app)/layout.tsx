import { Suspense } from "react";
import { Gate } from "@/components/auth/gate";
import { AppShell } from "@/components/shell/app-shell";
import { DemoOverlayHost } from "@/components/demo/demo-overlay-host";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell>
      {/* Quem entrou e ainda não escolheu o @usuário vai para /boas-vindas. */}
      <Suspense fallback={null}>
        <Gate area="app" />
      </Suspense>
      {children}
      {/* Camada de demo (?demo=<id>) por cima de qualquer página do app. */}
      <Suspense fallback={null}>
        <DemoOverlayHost />
      </Suspense>
    </AppShell>
  );
}
