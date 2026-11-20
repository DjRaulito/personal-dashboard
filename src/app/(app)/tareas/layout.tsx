import { PageShell } from "@/components/page-header";
import { TasksNav } from "@/components/tasks-nav";
import { getTasks } from "@/lib/tasks/server";

export default async function TasksLayout({ children }: { children: React.ReactNode }) {
  const tasks = await getTasks();
  return (
    <PageShell>
      <h1 className="sr-only">Tareas</h1>
      <TasksNav tasks={tasks.filter((t) => !t.archived)} />
      {children}
    </PageShell>
  );
}
