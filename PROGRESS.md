# PROGRESS.md

Plan completo: informe "Plan: Dashboard personal" (Claude Docs). Este archivo es el punto de reanudación.

## Estado actual

- **Fase:** 0 — Cimientos
- **Última tarea hecha:** scaffold Next.js, diseño base, skills, CI
- **Siguiente tarea:** crear repo en GitHub y conectar Vercel

## Fase 0 — Cimientos

- [x] Proyecto Next.js + TypeScript + Tailwind
- [x] ESLint, Prettier, Vitest y Playwright configurados
- [x] Supabase (proyecto existente, eu-west-1) y variables de entorno locales
- [x] Skills de diseño en `.claude/skills/` fijadas a commit
- [x] `DESIGN.md` con tokens y lista de prohibidos
- [x] Workflow de CI (lint + typecheck + tests + build + e2e)
- [ ] Repo en GitHub y primer push
- [ ] Proyecto en Vercel enlazado al repo y primer despliegue
- [ ] Verificación: URL pública carga y CI en verde

## Decisiones

- Login solo con Google vía Supabase Auth (sin Clerk).
- Gimnasio por CSV exportado de Hevy (sin Hevy Pro).
- APK carga la web publicada (requiere conexión).
- Contenido: YouTube, Instagram y TikTok.
- Extractos bancarios: carpeta "Extractos" de Google Drive (PDF).
- Cuenta con acceso (lista blanca): rmolina2003.rm@gmail.com.
