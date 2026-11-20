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
    <header className="flex flex-wrap items-end gap-4 md:pt-2">
      <div className="min-w-0">
        <h1 className="font-display text-4xl leading-none font-extrabold">{title}</h1>
        {subtitle && <p className="text-muted mt-2 first-letter:uppercase">{subtitle}</p>}
      </div>
      {children && <div className="ml-auto">{children}</div>}
    </header>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-7 md:py-8">{children}</main>;
}

/**
 * Cabecera de sección: título grande, subsecciones como control segmentado y la acción
 * principal a la derecha (estructura «barra superior + cabecera + mosaico»).
 */
export function SectionHead({
  title,
  tabs,
  action,
}: {
  title: string;
  tabs?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-center gap-x-5 gap-y-3 md:pt-2">
      <h1 className="font-display text-4xl leading-none font-extrabold">{title}</h1>
      {tabs}
      {action && <div className="ml-auto">{action}</div>}
    </header>
  );
}
