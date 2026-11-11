import { describe, expect, it } from "vitest";
import { localJobAction, localWorkerOnline } from "./local";

const NOW = Date.parse("2026-11-11T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("localWorkerOnline", () => {
  it("encendido si avisó hace menos de 90 s", () => {
    expect(localWorkerOnline(ago(30_000), NOW)).toBe(true);
    expect(localWorkerOnline(ago(89_000), NOW)).toBe(true);
  });
  it("apagado si avisó hace más o nunca", () => {
    expect(localWorkerOnline(ago(91_000), NOW)).toBe(false);
    expect(localWorkerOnline(null, NOW)).toBe(false);
    expect(localWorkerOnline("no es fecha", NOW)).toBe(false);
  });
});

describe("localJobAction", () => {
  const base = { status: "queued", worker: null, queued_at: ago(60_000), updated_at: ago(60_000) };

  it("deja esperar al PC unos minutos", () => {
    expect(localJobAction(base, NOW)).toBeNull();
  });
  it("pasa a GitHub si el PC no lo cogió", () => {
    expect(localJobAction({ ...base, queued_at: ago(4 * 60_000) }, NOW)).toBe("handoff");
  });
  it("no toca los reservados para GitHub", () => {
    expect(localJobAction({ ...base, worker: "github", queued_at: ago(60 * 60_000) }, NOW)).toBeNull();
  });
  it("da por perdido un montaje del PC sin noticias", () => {
    const job = { ...base, status: "rendering", worker: "local" };
    expect(localJobAction({ ...job, updated_at: ago(5 * 60_000) }, NOW)).toBeNull();
    expect(localJobAction({ ...job, updated_at: ago(25 * 60_000) }, NOW)).toBe("stalled");
  });
});
