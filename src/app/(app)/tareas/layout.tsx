import { PageShell, SectionHead } from "@/components/page-header";
import { SectionTabs } from "@/components/section-tabs";
import { getTasks } from "@/lib/tasks/server";

export default async function TasksLayout({ children }: { children: React.ReactNode }) {
  const tasks = (await getTasks()).filter((t) => !t.archived);
  // Cada tarea registrada tiene su pestaña: aparecen solas al registrarse
  const tabs = [{ href: "/tareas", label: "Todas", exact: true, count: 0 }].concat(
    tasks.map((t) => ({ href: `/tareas/${t.slug}`, label: t.name, exact: false, count: t.newItems })),
  );
  return (
    <PageShell>
      <SectionHead title="Tareas" tabs={<SectionTabs label="Tareas" tabs={tabs} />} />
      {children}
    </PageShell>
  );
}
