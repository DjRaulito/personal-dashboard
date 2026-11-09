import { modulesByPhase } from "@/lib/modules";

export default function Home() {
  const modules = modulesByPhase();

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 px-4 py-6 sm:px-7">
      <header className="flex items-center gap-4">
        <span className="font-display text-2xl font-extrabold tracking-tight">
          Personal<span className="text-finance">·</span>Dashboard
        </span>
        <span className="border-border bg-surface text-muted ml-auto rounded-full border px-3 py-1.5 text-sm">
          Fase 0 · cimientos
        </span>
      </header>

      <section className="grid gap-3.5 md:grid-cols-6">
        <div className="rounded-tile border-border bg-surface relative overflow-hidden border p-7 pb-28 md:col-span-4">
          <p className="text-muted text-sm">Estado</p>
          <h1 className="font-display mt-3 text-5xl leading-none font-extrabold tracking-tight sm:text-6xl">
            En construcción
          </h1>
          <p className="text-muted mt-4 max-w-md">
            La base está desplegada. Los módulos se irán activando fase a fase.
          </p>
          <svg
            aria-hidden="true"
            viewBox="0 0 560 120"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full"
          >
            <defs>
              <linearGradient id="hero" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--finance)" stopOpacity="0.25" />
                <stop offset="1" stopColor="var(--finance)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 100 C80 96 120 88 180 80 S300 70 340 56 S440 40 560 18 L560 120 L0 120 Z" fill="url(#hero)" />
            <path
              d="M0 100 C80 96 120 88 180 80 S300 70 340 56 S440 40 560 18"
              fill="none"
              stroke="var(--finance)"
              strokeWidth="2.5"
            />
          </svg>
        </div>
        <div className="rounded-tile bg-finance text-ink flex flex-col justify-between p-6 md:col-span-2">
          <p className="text-sm font-semibold">Siguiente paso</p>
          <p className="font-display mt-6 text-3xl leading-tight font-extrabold tracking-tight">
            Login con Google y calendario
          </p>
          <p className="mt-4 text-sm font-medium">Fase 1</p>
        </div>
      </section>

      <section aria-label="Módulos" className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <article key={m.key} className="rounded-tile border-border bg-surface flex items-center gap-4 border p-5">
            <span aria-hidden="true" className={`h-10 w-10 shrink-0 rounded-xl ${m.color}`} />
            <div className="min-w-0">
              <h2 className="font-semibold">{m.label}</h2>
              <p className="text-muted truncate text-sm">{m.description}</p>
            </div>
            <span className="bg-surface-2 text-muted ml-auto shrink-0 rounded-full px-2.5 py-1 text-xs">
              Fase {m.phase}
            </span>
          </article>
        ))}
      </section>
    </main>
  );
}
