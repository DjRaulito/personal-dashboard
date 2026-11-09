# PROGRESS.md

Plan completo: informe "Plan: Dashboard personal" (Claude Docs). Este archivo es el punto de reanudación.

## Estado actual

- **Fase:** 2 — Finanzas: núcleo
- **Última tarea hecha:** pantallas de finanzas (resumen con gráficas, cuentas, movimientos, importador, categorías y reglas)
- **Siguiente tarea:** Raúl importa un extracto real (verificación de la fase 2); ajustar reglas según lo que quede sin categorizar. Después, fase 3

## Fase 0 — Cimientos

- [x] Proyecto Next.js + TypeScript + Tailwind
- [x] ESLint, Prettier, Vitest y Playwright configurados
- [x] Supabase (proyecto existente, eu-west-1) y variables de entorno locales
- [x] Skills de diseño en `.claude/skills/` fijadas a commit
- [x] `DESIGN.md` con tokens y lista de prohibidos
- [x] Workflow de CI (lint + typecheck + tests + build + e2e)
- [x] Repo en GitHub (DjRaulito/personal-dashboard) y primer push
- [x] Proyecto en Vercel enlazado al repo y primer despliegue
- [x] Verificación: URL pública carga y CI en verde

## Fase 1 — Acceso, estructura y calendario

- [x] Migración `core_profiles_integrations`: `profiles` e `integrations` con RLS, lista blanca en `private.allowed_emails` y trigger de alta (aplicada en Supabase)
- [x] Migración `revoke_rls_auto_enable` (aviso de seguridad del linter)
- [x] Email autorizado insertado en `private.allowed_emails` (por SQL, no en el repo)
- [x] Login solo con Google (`/login`, `/auth/callback`, `/auth/signout`) y middleware que protege todas las rutas
- [x] Layout con menú lateral (escritorio) e inferior (móvil): Inicio, Finanzas, Calendario, Contenido, Gimnasio, Nutrición, Ajustes
- [x] Pantalla de Ajustes (nombre, moneda, estado de conexiones, cerrar sesión)
- [x] Google Calendar: vistas hoy / semana / mes (refresh token cifrado con AES-256-GCM en `integrations`)
- [x] Portada con widget de agenda (hoy y mañana) y widgets vacíos de cada módulo
- [x] Configurar Google OAuth: cliente en Google Cloud, proveedor Google en Supabase, URLs de redirección y variables en Vercel
- [ ] Desactivar el registro público en Supabase Auth después del primer login
- [ ] ~~Capacitor + APK de prueba~~ → movido a la fase 9 (la APK va al final)
- [ ] Verificación: entras con Google en web y APK y ves tu agenda real (web hecha el 9 nov 2026: perfil e integración de Google creados; falta APK)

### Pasos manuales pendientes (los hace Raúl)

1. Google Cloud → nuevo proyecto → activar **Google Calendar API** → pantalla de consentimiento (externa, publicada en "Producción") con el permiso `calendar.readonly`.
2. Crear un **cliente OAuth (aplicación web)** con URI de redirección `https://dejqzehannvboctoflxp.supabase.co/auth/v1/callback`.
3. Supabase → Authentication → Providers → Google: pegar Client ID y Secret.
4. Supabase → Authentication → URL Configuration: Site URL = URL de Vercel; Redirect URLs = `https://<url-vercel>/auth/callback` y `http://localhost:3000/auth/callback`.
5. Vercel (y `.env.local`): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY` (`openssl rand -base64 32`). Redesplegar.
6. Tras el primer login correcto: Supabase → Authentication → Sign In / Providers → desactivar "Allow new users to sign up".

## Orden de fases (revisado el 9 nov 2026)

0 Cimientos · 1 Acceso y calendario · 2 Finanzas: núcleo · 3 Finanzas: control y ahorro · 4 Gimnasio · 5 Nutrición · 6 IA, cruces y extras · 7 Agentes · 8 Contenido · 9 APK final y pulido.
Contenido y la APK pasan al final porque ahora mismo no se van a usar.

## Fase 2 — Finanzas: núcleo

- [x] Migración `finance_core`: accounts, categories (set inicial en español), transactions (anti-duplicados), rules (54 reglas iniciales) e import_profiles, con RLS (aplicada)
- [x] Funciones SQL de resumen: saldos, cashflow mensual, gasto por categoría y patrimonio por mes
- [x] Lógica pura: importes en céntimos, parser de extractos, mapeo por banco, huella anti-duplicados, motor de reglas
- [x] Pantallas: resumen con gráficas, cuentas, movimientos (filtros, búsqueda, edición masiva), importador, categorías y reglas
- [x] Portada: patrimonio neto y gasto del mes con datos reales
- [ ] Pasar `web-design-guidelines` antes de cerrar la fase
- [ ] Verificación: importas un extracto real y el 80 % queda categorizado solo

## Decisiones

- Login solo con Google vía Supabase Auth (sin Clerk).
- Gimnasio por CSV exportado de Hevy (sin Hevy Pro).
- APK carga la web publicada (requiere conexión).
- Contenido: YouTube, Instagram y TikTok.
- Extractos bancarios: carpeta "Extractos" de Google Drive (PDF).
- Cuenta con acceso (lista blanca): rmolina2003.rm@gmail.com. La lista vive en `private.allowed_emails` (no expuesta por la API); un trigger sobre `auth.users` rechaza cualquier otro email.
- Calendario: se lee el calendario principal directamente de Google (sin tablas). El refresh token de Google se guarda cifrado por la app; la BD nunca ve el valor en claro.
