import { useTranslations } from "next-intl";
import { Suspense } from "react";
import { Gate } from "@/components/auth/gate";
import { ComingSoon } from "@/components/shell/coming-soon";

export default function Page() {
  const nav = useTranslations("Nav");
  const t = useTranslations("ComingSoon");
  return (
    <>
      <Suspense fallback={null}>
        <Gate area="private" next="/notificacoes" />
      </Suspense>
      <ComingSoon title={nav("notifications")} text={t("notifications")} />
    </>
  );
}
