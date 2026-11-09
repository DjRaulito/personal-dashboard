# PROGRESS.md

Plan completo: informe "Plan: Dashboard personal" (Claude Docs). Este archivo es el punto de reanudación.

## Estado actual

- **Fase:** 3 — Finanzas: patrimonio, inversiones y métricas (rediseño)
- **Última tarea hecha:** pestaña Plan: presupuestos mensuales, huchas y pagos recurrentes (con detección automática) y widget "Próximos pagos" en la portada
- **Siguiente tarea:** Raúl crea sus presupuestos, huchas y pagos recurrentes en Finanzas → Plan; pasar `web-design-guidelines` a Finanzas y cerrar la fase 3. Después: fase 4 (Gimnasio)

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

0 Cimientos · 1 Acceso y calendario · 2 Finanzas: núcleo · 3 Finanzas: patrimonio, inversiones y métricas · 4 Gimnasio · 5 Nutrición · 6 IA, cruces y extras · 7 Agentes · 8 Contenido · 9 APK final y pulido.
Contenido y la APK pasan al final porque ahora mismo no se van a usar.

## Fase 2 — Finanzas: núcleo

- [x] Migración `finance_core`: accounts, categories (set inicial en español), transactions (anti-duplicados), rules (54 reglas iniciales) e import_profiles, con RLS (aplicada)
- [x] Funciones SQL de resumen: saldos, cashflow mensual, gasto por categoría y patrimonio por mes
- [x] Lógica pura: importes en céntimos, parser de extractos, mapeo por banco, huella anti-duplicados, motor de reglas
- [x] Pantallas: resumen con gráficas, cuentas, movimientos (filtros, búsqueda, edición masiva), importador, categorías y reglas
- [x] Portada: patrimonio neto y gasto del mes con datos reales
- [ ] Pasar `web-design-guidelines` antes de cerrar la fase
- [ ] Verificación: importas un extracto real y el 80 % queda categorizado solo

## Fase 3 — Finanzas: patrimonio, inversiones y métricas (rediseño pedido el 9 nov 2026)

Estructura nueva de Finanzas:

- **Patrimonio:** total (cuentas + inversiones + planes), evolución y reparto.
- **Inversiones:** posiciones, valor, coste, plusvalías latentes y realizadas; rentabilidad 1D, 1S, 1M, 3M, YTD, 1A, 3A, 5A y desde el inicio (en % y en €); ganancias/pérdidas diarias; operaciones; exportar a Investing.
- **Gastos:** vista mes a mes (total, por categoría, lista con añadir/editar/borrar) e importación de extractos.
- **Métricas:** tasa de ahorro, gasto medio, aportaciones vs. rentabilidad, etc.
- **Ajustes:** cuentas, categorías y reglas.

Fuentes: carga inicial con la exportación de la cartera de Investing + operaciones de MyInvestor y MEXEM desde 2024. Después la app lleva el seguimiento y exporta a Investing. Los precios se actualizan al abrir Inversiones (sin cron ni clave de servicio).

- [x] Recibir exportaciones (Investing, órdenes de fondos y operaciones de valores de MyInvestor, información fiscal); no se suben al repo
- [x] Migración `investments`: assets, investment_operations, asset_prices, fx_rates con RLS (aplicada)
- [x] Importadores: Investing (lotes), MyInvestor fondos (sentido deducido) y valores; conciliación probada con los datos reales (16/16 posiciones cuadran)
- [x] Importador de MEXEM (historial de transacciones CSV de IBKR)
- [x] Corrección: contrasplits con precios ajustados de Yahoo (Amper inflaba 2025) y búsqueda de símbolos que sí tengan precios
- [x] Alta manual de activos (plan de pensiones Caser con valor liquidativo a mano)
- [x] Precios (Yahoo) y tipos de cambio (BCE) al abrir Inversiones, con relleno histórico; verificado desde Vercel
- [x] Motor: FIFO, plusvalías, serie diaria, TWR 1D/1S/1M/3M/YTD/1A/3A/5A/Total, P/G diario
- [x] Pantallas: Patrimonio, Inversiones (+ operaciones, ficha de activo, importar), Gastos mes a mes, Métricas, Ajustes
- [x] Exportar a Investing (CSV de lotes abiertos)
- [x] Verificación con la cartera real en producción (precios al día en todas las posiciones abiertas el 9 nov 2026)
- [x] Migración `budgets_goals_recurring`: budgets, savings_goals y recurring_payments con RLS (aplicada)
- [x] Pestaña Plan: presupuestos por categoría con aviso de ritmo, huchas (saldo de cuenta o a mano, aportación mensual necesaria) y pagos recurrentes (vencimientos, se dan por pagados al aparecer el cargo, detección en los movimientos)
- [x] Portada: widget "Próximos pagos" (14 días)
- [ ] Pasar `web-design-guidelines` a Finanzas antes de cerrar la fase

## Decisiones

- Login solo con Google vía Supabase Auth (sin Clerk).
- Gimnasio por CSV exportado de Hevy (sin Hevy Pro).
- Inversiones: fondos MyInvestor, acciones/ETFs (MyInvestor y MEXEM) y plan de pensiones en Caser (valor a mano). Historial desde 2024.
- APK carga la web publicada (requiere conexión).
- Contenido: YouTube, Instagram y TikTok.
- Extractos bancarios: carpeta "Extractos" de Google Drive (PDF).
- Cuenta con acceso (lista blanca): rmolina2003.rm@gmail.com. La lista vive en `private.allowed_emails` (no expuesta por la API); un trigger sobre `auth.users` rechaza cualquier otro email.
- Calendario: se lee el calendario principal directamente de Google (sin tablas). El refresh token de Google se guarda cifrado por la app; la BD nunca ve el valor en claro.
