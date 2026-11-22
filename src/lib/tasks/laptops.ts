// Ofertas de portátiles: cada resultado de la tarea «ofertas-portatiles» es un modelo candidato.
// Lógica pura (sin servidor).
import { lastChange, type HistoryPoint, type TaskField } from "./fields";

export const LAPTOP_SLUG = "ofertas-portatiles";

export const LAPTOP_FIELDS: TaskField[] = [
  { key: "modelo", label: "Modelo", type: "text" },
  { key: "cpu", label: "Procesador", type: "text" },
  { key: "ram", label: "RAM", type: "text" },
  { key: "disco", label: "Disco", type: "text" },
  { key: "precio", label: "Precio", type: "money" },
  { key: "tienda", label: "Tienda", type: "text" },
  { key: "enlace", label: "Enlace", type: "url" },
  { key: "pantalla", label: "Pantalla", type: "text" },
  { key: "peso", label: "Peso", type: "text" },
  { key: "grafica", label: "Gráfica", type: "text" },
  { key: "precio_ref", label: "Precio de referencia", type: "money" },
  { key: "oferta", label: "En oferta", type: "boolean" },
  { key: "hallazgo", label: "Nuevo hallazgo", type: "boolean" },
  { key: "imagen", label: "Foto", type: "image" },
  { key: "nota", label: "Por qué", type: "text" },
];

export interface Laptop {
  model: string;
  cpu: string | null;
  ram: string | null;
  disk: string | null;
  screen: string | null;
  weight: string | null;
  gpu: string | null;
  price: number | null;
  ref: number | null;
  store: string | null;
  link: string | null;
  image: string | null;
  flaggedOffer: boolean;
  discovery: boolean;
  note: string | null;
}

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function laptop(key: string, data: Record<string, unknown>): Laptop {
  return {
    model: str(data.modelo) ?? key,
    cpu: str(data.cpu),
    ram: str(data.ram),
    disk: str(data.disco),
    screen: str(data.pantalla),
    weight: str(data.peso),
    gpu: str(data.grafica),
    price: num(data.precio),
    ref: num(data.precio_ref),
    store: str(data.tienda),
    link: str(data.enlace),
    image: str(data.imagen),
    flaggedOffer: data.oferta === true,
    discovery: data.hallazgo === true,
    note: str(data.nota),
  };
}

/** Descuento frente al precio de referencia, en % (positivo = más barato). */
export function discount(l: Laptop): number | null {
  if (l.price == null || l.ref == null || l.ref <= 0 || l.price >= l.ref) return null;
  return (1 - l.price / l.ref) * 100;
}

const WEEK_MS = 7 * 86_400_000;

/**
 * En oferta si la tarea lo marca, si está por debajo de su precio de referencia o si ha bajado de
 * precio en la última semana.
 */
export function isOnSale(l: Laptop, history: HistoryPoint[], changedAt: string | null, now: number): boolean {
  if (l.flaggedOffer || discount(l) != null) return true;
  const change = lastChange("precio", l.price, history);
  return Boolean(change && change.delta < 0 && changedAt && now - Date.parse(changedAt) < WEEK_MS);
}

/** Especificaciones básicas en orden de lectura (las que existan). */
export const specs = (l: Laptop) =>
  [l.cpu, l.ram, l.disk, l.screen, l.gpu, l.weight].filter((s): s is string => Boolean(s));
