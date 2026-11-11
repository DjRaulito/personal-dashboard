import { describe, expect, it } from "vitest";
import {
  aiScriptSchema,
  cleanEmoji,
  cleanHashtags,
  composeSchema,
  estimateSeconds,
  formatDuration,
  sceneCount,
  scriptToText,
} from "./catalog";

describe("Estudio de vídeo · catálogo", () => {
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

  it("acepta rótulos y emojis, y descarta lo que no encaja sin fallar", () => {
    const parsed = aiScriptSchema.parse({
      title: "Tres errores",
      hook: "  ¿Sin resultados?  ",
      mood: "trance",
      scenes: [
        { text: "Hola a todos", query: "gym", emphasis: "Error 1", emoji: "💪🏽 fuerza" },
        { text: "Adiós", query: "sunset", emphasis: "x".repeat(80), emoji: "nada" },
      ],
    });
    expect(parsed.hook).toBe("¿Sin resultados?");
    expect(parsed.mood).toBe("energetic");
    expect(parsed.scenes[0]).toMatchObject({ emphasis: "Error 1", emoji: "💪🏽" });
    expect(parsed.scenes[1].emphasis).toBeUndefined();
    expect(parsed.scenes[1].emoji).toBeUndefined();
  });

  it("limpia emojis", () => {
    expect(cleanEmoji("👨‍💻")).toBe("👨‍💻");
    expect(cleanEmoji("❤️")).toBe("❤️");
    expect(cleanEmoji("")).toBeUndefined();
    expect(cleanEmoji(3)).toBeUndefined();
  });
});
