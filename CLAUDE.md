# CLAUDE.md — Personal Dashboard

App personal de Raúl: finanzas, calendario, contenido, gimnasio, nutrición y agentes. Un solo usuario.

## Reglas del proyecto

- **Coste 0 €.** Solo planes gratuitos (Vercel Hobby, Supabase Free, GitHub Actions en repo público, Gemini free tier).
- **Repo público.** Nunca subir datos personales, extractos, CSV, backups ni claves. Secretos solo en variables de entorno / GitHub Secrets.
- **Idioma:** interfaz y textos en español (es-ES). Código e identificadores en inglés, comentarios en español.
- **Diseño:** seguir `DESIGN.md` siempre. Modo oscuro, colores suaves.
- **Estado del trabajo:** `PROGRESS.md` dice en qué fase y tarea estamos. Actualízalo al terminar cada tarea.

## Stack

Next.js 15 (App Router) · TypeScript estricto · Tailwind CSS 4 · Supabase (Postgres + Auth + RLS) · Zod · Vitest · Playwright · Capacitor (APK, fase 9).

## Comandos

```bash
npm run dev          # desarrollo
npm run lint         # ESLint
npm run typecheck    # tsc
npm test             # Vitest
npm run test:e2e     # Playwright (levanta `npm run start`)
npm run build
```

## Convenciones

- Importes de dinero en céntimos (enteros). Fechas en UTC en BD, se muestran en Europe/Madrid.
- Toda tabla nueva lleva `user_id` y RLS. Migraciones en `supabase/migrations`.
- Variables de entorno validadas en `src/lib/env.ts`.
- Clientes de Supabase: `src/lib/supabase/{client,server}.ts`.
