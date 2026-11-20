# DESIGN.md — Personal Dashboard

Dirección elegida (refactor de noviembre de 2026): **Contraste claro** (propuesta C). Modo oscuro siempre, pensado para leerse bien con daltonismo, en el móvil y al sol.

## Principios

1. **El color nunca informa solo.** Todo lo que se distingue por color lleva también texto, signo o forma. Subidas y bajadas llevan siempre signo (+/−) y flecha ▲▼ (`trendClass` de `src/lib/trend.ts`). Los colores de las prendas se dicen con palabras.
2. **Paleta Okabe-Ito.** Ocho colores pensados para distinguirse con cualquier tipo de daltonismo. No se inventan colores nuevos fuera de ella.
3. **Un color por módulo.** El color dice "de qué va esto", no decora. Como mucho 3 bloques de color por pantalla.
4. **Contraste alto.** Texto principal blanco; secundario ≥ 7:1 sobre los bloques. Nada de gris sobre gris.
5. **Las cifras mandan.** Números grandes, en negrita y siempre tabulares.
6. **Movimiento con intención.** Transiciones cortas (150–200 ms) y respeto a `prefers-reduced-motion`.

## Tokens (fuente de verdad: `src/app/globals.css`)

| Token             | Valor             | Uso                                                            |
| ----------------- | ----------------- | -------------------------------------------------------------- |
| `--bg`            | `#101418`         | Fondo de la app (pizarra)                                      |
| `--surface`       | `#182027`         | Bloques                                                        |
| `--surface-2`     | `#22303A`         | Elementos dentro de un bloque                                  |
| `--border`        | `#33424E`         | Borde de bloques                                               |
| `--border-strong` | `#4A5D6C`         | Inputs, separadores                                            |
| `--text`          | `#FFFFFF`         | Texto principal                                                |
| `--text-muted`    | `#C3CDD5`         | Texto secundario (10:1 sobre surface)                          |
| `--ink-on-color`  | `#0B1116`         | Texto sobre bloques de color                                   |
| `--finance`       | `#56B4E9`         | Finanzas y acento principal (celeste)                          |
| `--nutrition`     | `#009E73`         | Nutrición (verde azulado)                                      |
| `--wardrobe`      | `#CC79A7`         | Armario (púrpura rojizo)                                       |
| `--content`       | `#E8EEF3`         | Cerebro, Tareas y agenda (hueso)                               |
| `--attention`     | `#F0E442`         | Algo espera tu acción (amarillo)                               |
| `--expense`       | `#E69F00`         | Gastos y lo que baja (naranja)                                 |
| `--extra`         | `#D55E00`         | Series y categorías extra en gráficas (bermellón)              |
| `--up` / `--down` | celeste / naranja | Subidas y bajadas, siempre con ▲▼ (`.trend-up`, `.trend-down`) |

Contraste de cada color sobre `--surface`: celeste 7,1 · naranja 7,3 · verde azulado 4,8 · púrpura 5,4 · amarillo 12,5 · bermellón 4,3 (solo para marcas y rellenos, no para texto pequeño). Texto `--ink-on-color` sobre cualquier color de módulo ≥ 4,9.

Radios: bloques `20px`, elementos internos `12px`, píldoras `999px`.

## Tipografía

- **Atkinson Hyperlegible Next** en todo (variable, 200–800), creada para que ningún carácter se confunda (0/O, 1/l/I). Autoalojada con `@fontsource-variable/atkinson-hyperlegible-next`.
- Cifras: 800, tabulares (`tnum`, activado en `body`). Títulos: 700. Texto: 400–600.
- Sin tracking negativo: la legibilidad manda.

## Componentes base

- **Bloque:** `rounded-tile border border-border bg-surface p-6`.
- **Bloque de color:** `rounded-tile bg-<modulo> text-ink`.
- **Píldora:** `rounded-full bg-surface-2 px-3 py-1 text-sm`.
- **Subida / bajada:** `className={trendClass(valor)}` y el número con signo.
- **Gráficas:** línea de 3 px con extremo redondeado y punto en el último valor; barras ≤ 24 px; rejilla de 1 px recesiva; leyenda si hay ≥ 2 series; textos en tokens de texto (nunca del color de la serie); tooltip y tabla de datos accesible. Ingresos = `--finance`, gastos = `--expense`. Validar las parejas nuevas con la skill `dataviz`.

## Prohibido (señales de "hecho con IA")

- Inter, Geist o Arial como tipografía principal.
- Rojo frente a verde para distinguir algo, o cualquier dato que solo se entienda por el color.
- Degradados morados/azules de fondo, glows de neón, glassmorphism.
- Tres tarjetas iguales en fila como recurso por defecto.
- Emojis como iconos.
- Tema por defecto de shadcn/ui sin re-estilizar.
- Texto en degradado en titulares.
- Cifras o nombres inventados en producción: si falta un dato, se muestra vacío o "—".

## Skills de apoyo

Ver `.claude/skills/SOURCES.md`. `dataviz` para colores de gráficas (con validador de daltonismo) y `web-design-guidelines` antes de cerrar una fase con UI nueva.
