import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TaskBoard } from "@/components/task-board";
import { getTask } from "@/lib/tasks/server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const task = await getTask((await params).slug);
  return { title: task ? `${task.name} · Tareas` : "Tareas" };
}

export default async function TaskPage({ params }: { params: Promise<{ slug: string }> }) {
  const task = await getTask((await params).slug);
  if (!task) notFound();
  // Las tareas con vista propia tienen su ruta (p. ej. /tareas/inmuebles)
  if (task.specialView) redirect(`/tareas/${task.specialView}`);
  return <TaskBoard task={task} />;
}
