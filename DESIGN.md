# DESIGN.md — Personal Dashboard

Dirección elegida (noviembre de 2026): **Cristal tipo visionOS** sobre la paleta **Contraste claro**. Fondo oscuro con luces de color difuminadas, paneles de cristal esmerilado flotando encima y un acabado como el de las webs de las grandes tecnológicas. Los colores siguen pensados para leerse con daltonismo.

## Principios

0. **Cristal con mesura.** El cristal (translúcido + desenfoque + reflejo fino arriba) va en bloques, navegación, menús y diálogos; dentro de un bloque, los elementos solo son translúcidos. Esquinas muy redondeadas, nada de cajas pesadas.
1. **El color nunca informa solo.** Todo lo que se distingue por color lleva también texto, signo o forma. Subidas y bajadas llevan siempre signo (+/−) y flecha ▲▼ (`trendClass` de `src/lib/trend.ts`). Los colores de las prendas se dicen con palabras.
2. **Paleta Okabe-Ito.** Ocho colores pensados para distinguirse con cualquier tipo de daltonismo. No se inventan colores nuevos fuera de ella.
3. **Un color por módulo.** El color dice "de qué va esto", no decora. Como mucho 3 bloques de color por pantalla.
4. **Contraste alto.** Texto principal blanco; secundario ≥ 7:1 sobre los bloques. Nada de gris sobre gris.
5. **Las cifras mandan.** Números grandes, en negrita y siempre tabulares.
6. **Movimiento con intención.** Transiciones cortas (150–200 ms) y respeto a `prefers-reduced-motion`.

## Tokens (fuente de verdad: `src/app/globals.css`)

| Token                          | Valor                 | Uso                                                           |
| ------------------------------ | --------------------- | ------------------------------------------------------------- |
| `--bg`                         | `#0A0E1A` + luces     | Fondo: tres luces difuminadas (celeste, púrpura, verde) fijas |
| `--surface`                    | blanco al 8 %         | Bloques de cristal (con desenfoque)                           |
| `--surface-2`                  | blanco al 10 %        | Elementos dentro de un bloque (sin desenfoque propio)         |
| `--surface-solid`              | `rgb(22 27 40 / .86)` | Menús desplegables y diálogos (cristal denso)                 |
| `--border`                     | blanco al 14 %        | Borde de cristal                                              |
| `--border-strong`              | blanco al 24 %        | Inputs, separadores, hover                                    |
| `--text`                       | `#FFFFFF`             | Texto principal                                               |
| `--text-muted`                 | `#C9D1DB`             | Texto secundario                                              |
| `--selected` / `--on-selected` | blanco / `#0A0E1A`    | Botón principal y pestaña activa: cápsula blanca              |
| `--finance`                    | `#56B4E9`             | Finanzas, acento y subidas (celeste)                          |
| `--nutrition`                  | `#009E73`             | Nutrición (verde azulado)                                     |
| `--wardrobe`                   | `#CC79A7`             | Armario (púrpura rojizo)                                      |
| `--content`                    | `#E8EEF3`             | Cerebro, Tareas y agenda (hueso)                              |
| `--attention`                  | `#F0E442`             | Algo espera tu acción (amarillo, siempre con «!»)             |
| `--expense`                    | `#E69F00`             | Gastos y bajadas (naranja)                                    |
| `--extra`                      | `#D55E00`             | Series y categorías extra (bermellón)                         |

Radios: bloques `26px`, elementos internos `16px`, botones y pestañas en cápsula (`999px`). Clases: `.glass` para cristal suelto; `bg-surface` ya es cristal.

## Tipografía

- **Inter** (variable) en todo, la más cercana a la letra de Apple. Autoalojada con `@fontsource-variable/inter`.
- Cifras: 700–800, tabulares (`tnum`) y con tracking ligeramente negativo. Títulos: 700. Texto: 400–500.

## Componentes base

- **Bloque:** `rounded-tile border border-border bg-surface p-6` (cristal).
- **Botón principal / pestaña activa:** cápsula `bg-selected text-on-selected`. Secundario: cápsula de cristal.
- **Navegación:** barra superior de cristal flotante (escritorio) con las secciones en el centro y Ajustes como icono a la derecha; cápsula flotante abajo (móvil) con Hoy, Finanzas, Inversiones, Nutrición y «Más».
- **Estructura de cada sección:** cabecera con el título grande, las subsecciones como control segmentado (`SectionHead` + `SectionTabs`) y la acción principal a la derecha; debajo, mosaico (bento) con bloques de distinto tamaño: la cifra importante en un bloque grande y los datos de apoyo en bloques pequeños con el contenido centrado.
- **Píldora:** `rounded-full bg-surface-2 px-3 py-1 text-sm`.
- **Subida / bajada:** `className={trendClass(valor)}` y el número con signo.
- **Gráficas:** línea de 3 px con extremo redondeado y punto en el último valor; barras ≤ 24 px; rejilla de 1 px recesiva; leyenda si hay ≥ 2 series; textos en tokens de texto (nunca del color de la serie); tooltip y tabla de datos accesible. Ingresos = `--finance`, gastos = `--expense`. Validar las parejas nuevas con la skill `dataviz`.

## Prohibido (señales de "hecho con IA")

- Rojo frente a verde para distinguir algo, o cualquier dato que solo se entienda por el color.
- Glows de neón y degradados saturados de fondo (las luces van difuminadas y detrás del cristal).
- Tres tarjetas iguales en fila como recurso por defecto.
- Emojis como iconos.
- Tema por defecto de shadcn/ui sin re-estilizar.
- Texto en degradado en titulares.
- Cifras o nombres inventados en producción: si falta un dato, se muestra vacío o "—".

## Skills de apoyo

Ver `.claude/skills/SOURCES.md`. `dataviz` para colores de gráficas (con validador de daltonismo) y `web-design-guidelines` antes de cerrar una fase con UI nueva.
