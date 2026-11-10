import { describe, expect, it } from "vitest";
import {
  aiScriptSchema,
  cleanHashtags,
  composeSchema,
  estimateSeconds,
  formatDuration,
  sceneCount,
  scriptToText,
} from "./catalog";

describe("VoiceStudio · catálogo", () => {
  it("calcula escenas según formato y duración, con límites", () => {
    expect(sceneCount("short", 60)).toBe(12);
    expect(sceneCount("long", 420)).toBe(47);
    expect(sceneCount("short", 5)).toBe(3);
    expect(sceneCount("long", 5000)).toBe(80);
  });

  it("limpia hashtags", () => {
    expect(cleanHashtags(["gym", "#Gym", "##fit ness", "#", ""])).toEqual(["#gym", "#fitness"]);
  });

  it("estima la duración y junta el texto del guion", () => {
    const scenes = [{ text: "uno dos tres" }, { text: "cuatro cinco" }] as never;
    expect(estimateSeconds({ scenes })).toBe(2);
    expect(scriptToText({ scenes })).toBe("uno dos tres\n\ncuatro cinco");
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(420)).toBe("7:00 min");
  });

  it("valida el formulario: casilla de revisión y pieza vacía", () => {
    const parsed = composeSchema.parse({
      topic: "Rutina de pierna",
      format: "short",
      target_seconds: "60",
      voice_mode: "ai",
      voice: "es_male",
      piece_id: "",
      review: "on",
    });
    expect(parsed.review).toBe(true);
    expect(parsed.piece_id).toBeUndefined();
    expect(composeSchema.safeParse({ ...parsed, voice: "otra" }).success).toBe(false);
  });

  it("acepta el guion de la IA con valores por defecto", () => {
    const script = aiScriptSchema.parse({
      title: "Tres errores",
      scenes: [
        { text: "Hola", query: "gym" },
        { text: "Adiós", query: "sunset" },
      ],
    });
    expect(script.hashtags).toEqual([]);
    expect(script.description).toBe("");
  });
});
