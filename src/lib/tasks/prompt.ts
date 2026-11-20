// Párrafo que se añade al final de cualquier tarea programada para que guarde sus resultados en
// el dashboard. Con él, la tarea se registra sola y aparece su apartado en Tareas.

export function taskParagraph(slug = "identificador-de-la-tarea"): string {
  return [
    "Dashboard: guarda los resultados en mi dashboard con el conector del Cerebro.",
    `- Si es la primera vez, regístrala con register_task (task: «${slug}»), con su nombre, cuándo corre y ` +
      "los campos de cada resultado [{key, label, type}]; type puede ser text, number, money (euros), " +
      "area (m²), percent (%), boolean (sí/no), url o date. El primer campo text es el título.",
    "- En cada ejecución, empieza con get_task_context: trae los criterios y los resultados que ya conozco.",
    "- Guarda cada resultado con save_item (key estable, por ejemplo la URL); si un dato cambia, el dashboard " +
      "guarda el valor anterior y enseña la bajada o el cambio.",
    "- Marca con mark_items_removed lo que ya no exista y termina con save_task_summary (si fue bien, " +
      "cuántos nuevos y retirados, y un resumen de una o dos frases).",
    "- Solo datos reales y comprobados; si un dato no se sabe, no lo pongas.",
  ].join("\n");
}
