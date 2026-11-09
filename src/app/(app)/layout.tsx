import { AppNav } from "@/components/app-nav";

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="md:flex">
      <a
        href="#contenido"
        className="bg-finance text-ink sr-only z-50 rounded-full px-4 py-2 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Saltar al contenido
      </a>
      <AppNav />
      <div id="contenido" tabIndex={-1} className="min-w-0 flex-1 pb-24 outline-none md:pb-0">
        {children}
      </div>
    </div>
  );
}
