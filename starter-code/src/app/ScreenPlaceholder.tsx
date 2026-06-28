/**
 * ScreenPlaceholder — temporary scaffold for routes whose screen isn't built yet.
 * Replace each route's element with the real screen as you build it.
 */
export interface ScreenPlaceholderProps {
  title: string;
  note?: string;
}

export function ScreenPlaceholder({ title, note }: ScreenPlaceholderProps) {
  return (
    <section className="px-4 pt-5">
      <h1 className="font-heading text-2xl font-bold text-foreground">{title}</h1>
      {note && <p className="mt-1 text-sm text-muted-foreground">{note}</p>}
      <div className="mt-6 rounded-lg border border-dashed border-border-strong bg-surface-raised p-6 text-center text-sm text-ink-faint">
        Screen scaffold — wire to data next.
      </div>
    </section>
  );
}
