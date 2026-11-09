# DESIGN.md — Personal Dashboard

Dirección elegida: **Bento nocturno** (mezcla de "Bento vivo" + "Nocturno con anillos"), siempre en modo oscuro y con colores suaves.

## Principios

1. **Lo importante, más grande.** Rejilla bento: el bloque con más peso (patrimonio, el día) ocupa más celdas.
2. **Un color por módulo y nada más.** El color dice "de qué va esto", no decora.
3. **Colores apagados.** Nunca neón ni saturados. Si dudas, baja la saturación.
4. **Las cifras mandan.** Números grandes en Bricolage, siempre tabulares.
5. **Movimiento con intención.** Entradas suaves y hover sutil (elevar 4 px, escala 1.02, 200 ms). Respetar `prefers-reduced-motion`.

## Tokens (fuente de verdad: `src/app/globals.css`)

| Token             | Valor     | Uso                                           |
| ----------------- | --------- | --------------------------------------------- |
| `--bg`            | `#0B0B0E` | Fondo de la app                               |
| `--surface`       | `#16161B` | Bloques                                       |
| `--surface-2`     | `#1E1E24` | Elementos dentro de un bloque                 |
| `--border`        | `#23232A` | Borde de bloques                              |
| `--border-strong` | `#2E2E36` | Inputs, separadores                           |
| `--text`          | `#F2F2F5` | Texto principal                               |
| `--text-muted`    | `#A3A3AE` | Texto secundario (≥ 4.5:1 sobre surface)      |
| `--ink-on-color`  | `#0B0B0E` | Texto sobre bloques de color                  |
| `--finance`       | `#B9CC8A` | Finanzas · acento principal (salvia)          |
| `--gym`           | `#DE9A82` | Gimnasio (terracota suave)                    |
| `--content`       | `#93A3D4` | Contenido, calendario, ahorro (azul grisáceo) |
| `--nutrition`     | `#86B8C4` | Nutrición (azul verdoso)                      |
| `--attention`     | `#D6C48E` | Algo espera tu acción (arena)                 |
| `--expense`       | `#C0745A` | Gastos en gráficas (pareja de `--finance`)    |

Radios: bloques `28px`, elementos internos `16px`, píldoras `999px`.

## Tipografía

- **Display / cifras:** Bricolage Grotesque Variable (800 para cifras, 700 para títulos). Tracking negativo (−0.03em).
- **Texto:** Onest Variable (400/500/600/700).
- Fuentes autoalojadas con `@fontsource-variable/*` (sin Google Fonts).

## Componentes base

- **Bloque:** `rounded-tile border border-border bg-surface p-6`.
- **Bloque de color:** `rounded-tile bg-<modulo> text-ink` — como mucho 3 por pantalla.
- **Píldora:** `rounded-full bg-surface-2 px-3 py-1 text-sm`.
- **Anillos:** SVG con pista al 16 % de opacidad del mismo color y trazo redondeado.
- **Gráficas de área:** línea de 2.5–3 px + degradado del mismo color del 30 % al 0 %.
- **Gráficas en general:** barras ≤ 24 px con extremo redondeado de 4 px, rejilla de 1 px recesiva, leyenda si hay ≥ 2 series, textos en tokens de texto (nunca del color de la serie), tooltip al pasar el ratón y tabla de datos accesible. Ingresos = `--finance`, gastos = `--expense` (pareja validada para daltonismo con el validador de la skill dataviz).

## Prohibido (señales de "hecho con IA")

- Inter, Geist o Arial como tipografía principal.
- Degradados morados/azules de fondo, glows de neón, glassmorphism.
- Tres tarjetas iguales en fila como recurso por defecto.
- Emojis como iconos.
- Tema por defecto de shadcn/ui sin re-estilizar.
- Texto en degradado en titulares.
- Cifras o nombres inventados en producción: si falta un dato, se muestra vacío o "—".

## Skills de apoyo

Ver `.claude/skills/SOURCES.md`. Antes de cerrar una fase con UI nueva se pasa `web-design-guidelines`.
