import type { categoryOptions } from "@/lib/finance/categories";

/** <option>s de categorías agrupadas por tipo. */
export function CategoryOptions({ groups }: { groups: ReturnType<typeof categoryOptions> }) {
  return groups
    .filter((g) => g.options.length > 0)
    .map((g) => (
      <optgroup key={g.kind} label={g.label}>
        {g.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </optgroup>
    ));
}
