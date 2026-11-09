// Grupo muscular de un ejercicio a partir de su nombre (Hevy en español o inglés).
// El CSV de Hevy no trae el grupo muscular; se deduce aquí y se puede corregir a mano.
import { normalizeText } from "@/lib/finance/text";

export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "quadriceps",
  "hamstrings",
  "glutes",
  "calves",
  "adductors",
  "abductors",
  "abs",
  "cardio",
  "full_body",
  "other",
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: "Pecho",
  back: "Espalda",
  shoulders: "Hombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearms: "Antebrazos",
  quadriceps: "Cuádriceps",
  hamstrings: "Femorales",
  glutes: "Glúteos",
  calves: "Gemelos",
  adductors: "Aductores",
  abductors: "Abductores",
  abs: "Abdomen",
  cardio: "Cardio",
  full_body: "Cuerpo entero",
  other: "Otros",
};

// Orden importante: lo más específico primero ("curl de pierna" antes que "curl";
// "jalón de tríceps" antes que "jalón"; "curl tras la espalda" antes que "espalda").
const RULES: [MuscleGroup, RegExp][] = [
  [
    "cardio",
    /\b(CORRER|CARRERA|CINTA|BICICLETA|BICI|ELIPTICA|RUNNING|RUN|CYCLING|TREADMILL|STAIR|ESCALERA|CARDIO|COMBA|JUMP ROPE|NATACION|SWIM|WALK|CAMINAR|ROWING MACHINE|ERGOMETRO|HIIT)\b/,
  ],
  [
    "abs",
    /\b(ABDOMINAL\w*|CRUNCH\w*|PLANCHA|PLANK|LEG RAISE\w*|ELEVACION(ES)? DE PIERNAS|ELEVACION(ES)? DE RODILLAS|KNEE RAISE|RUSSIAN TWIST|GIRO RUSO|OBLICU\w*|CORE|AB WHEEL|RUEDA ABDOMINAL|SIT UP|DEAD BUG|HOLLOW|V UP|WOODCHOP\w*|LENADOR)\b/,
  ],
  ["triceps", /\b(TRICEP\w*|FRANCES|SKULL\w*|PUSHDOWN|PRESS CERRADO|CLOSE GRIP|DIPS?|FONDOS?)\b/],
  ["calves", /\b(GEMELO\w*|PANTORRILLA\w*|CALF|CALVES|SOLEO)\b/],
  [
    "hamstrings",
    /\b(CURLS? (DE |FEMORAL)?PIERNA\w*|CURLS? FEMORAL\w*|LEG CURL|LYING LEG|SEATED LEG CURL|FEMORAL\w*|RUMANO|ROMANIAN|RDL|BUENOS DIAS|GOOD MORNING|NORDIC\w*|PIERNAS? RIGIDAS?|STIFF LEG)\b/,
  ],
  ["biceps", /\b(CURLS?|BICEP\w*|MARTILLO|HAMMER|PREDICADOR|PREACHER)\b/],
  ["forearms", /\b(MUNECA\w*|WRIST|ANTEBRAZO\w*|FOREARM\w*|FARMER\w*|GRANJERO)\b/],
  ["adductors", /\b(ADUCCION\w*|ADDUCTION|ADDUCTOR\w*|ADUCTOR\w*)\b/],
  ["abductors", /\b(ABDUCCION\w*|ABDUCTION|ABDUCTOR\w*)\b/],
  ["glutes", /\b(GLUTEO\w*|GLUTE\w*|HIP THRUST|EMPUJE DE CADERA|PUENTE|BRIDGE|PATADA|KICKBACK|CADERA)\b/],
  [
    "quadriceps",
    /\b(SENTADILLA\w*|SQUAT\w*|PRENSA|PRESS DE PIERNAS?|LEG PRESS|EXTENSION(ES)? DE PIERNA\w*|LEG EXTENSION|ZANCADA\w*|LUNGE\w*|HACK|BULGAR\w*|STEP UP|SISSY|CUADRICEP\w*|QUAD\w*)\b/,
  ],
  // "Jalón al pecho" es espalda aunque diga pecho
  ["back", /\b(JALON\w*|PULLDOWN|DOMINADA\w*|PULL ?UPS?|CHIN ?UPS?)\b/],
  [
    "shoulders",
    /\b(ELEVACION(ES)? LATERAL\w*|LATERAL RAISE|ELEVACION(ES)? FRONTAL\w*|FRONT RAISE|MILITAR|OVERHEAD PRESS|SHOULDER|HOMBRO\w*|VUELOS?|PAJARO|REAR DELT|DELTOID\w*|FACE PULL|ARNOLD|REMO AL MENTON|UPRIGHT ROW|POSTERIOR\w*)\b/,
  ],
  [
    "chest",
    /\b(PECHO|PECTORAL\w*|CHEST|BANCA|BENCH|APERTURA\w*|FLYE?S?|CRUZADO\w*|CROSSOVER|PEC DECK|FLEXION(ES)?|PUSH ?UPS?)\b/,
  ],
  [
    "back",
    /\b(REMO|ROW|JALON\w*|PULLDOWN|LAT|DOMINADA\w*|PULL ?UPS?|CHIN ?UPS?|PESO MUERTO|DEADLIFT|ESPALDA|BACK|LUMBAR\w*|HIPEREXTENSION\w*|HYPEREXTENSION|ENCOGIMIENTO\w*|SHRUG\w*|PULLOVER|TRAPECIO\w*)\b/,
  ],
  ["full_body", /\b(BURPEE\w*|CLEAN|SNATCH|THRUSTER\w*|ARRANCADA|CARGADA|KETTLEBELL SWING|SWING)\b/],
];

export function guessMuscleGroup(name: string): MuscleGroup {
  const text = normalizeText(name)
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ");
  for (const [group, re] of RULES) if (re.test(text)) return group;
  return "other";
}
