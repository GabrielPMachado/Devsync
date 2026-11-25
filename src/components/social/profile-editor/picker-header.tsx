/**
 * Cabeçalho de uma escolha da aparência: título, o que está escolhido e a contagem.
 * O nome do grupo para leitores de tela vem da legenda (sr-only); aqui é só visual.
 */
export function PickerHeader({ title, selected, count }: { title: string; selected?: string; count: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <p className="flex min-w-0 items-baseline gap-2 text-sm">
        <span className="font-semibold text-text-primary">{title}</span>
        {selected ? <span className="truncate text-text-muted">{selected}</span> : null}
      </p>
      <span className="shrink-0 rounded-full border border-border-default bg-bg-base px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-text-muted">{count}</span>
    </div>
  );
}
