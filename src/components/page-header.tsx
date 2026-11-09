export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight sm:text-5xl">{title}</h1>
        {subtitle && <p className="text-muted mt-2 first-letter:uppercase">{subtitle}</p>}
      </div>
      {children && <div className="ml-auto">{children}</div>}
    </header>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-7 md:py-8">{children}</main>;
}
