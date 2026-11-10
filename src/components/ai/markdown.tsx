import { parseMarkdown, type Inline } from "@/lib/ai/assistant";

function Line({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.bold ? (
          <strong key={i} className="font-semibold">
            {p.text}
          </strong>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

/** Texto de la IA con párrafos, viñetas y negrita, sin HTML. */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 leading-relaxed">
      {parseMarkdown(text).map((b, i) =>
        b.kind === "ul" ? (
          <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
            {b.items.map((item, j) => (
              <li key={j}>
                <Line parts={item} />
              </li>
            ))}
          </ul>
        ) : (
          <p key={i}>
            {b.lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <Line parts={l} />
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  );
}
