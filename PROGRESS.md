# PROGRESS.md

Plan completo: informe "Plan: Dashboard personal" (Claude Docs). Este archivo es el punto de reanudación.

## Estado actual

- **Fase:** 6 — IA, cruces y extras
- **Última tarea hecha:** fase 6: asistente IA con herramientas, fotos (ticket → movimiento, plato → kcal), resumen semanal en portada y cruces
- **Siguiente tarea:** registro de comidas más rápido en Nutrición → Hoy (pedido el 10 nov 2026)

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
- [x] Pasar `web-design-guidelines` antes de cerrar la fase (hecho junto con la fase 3)
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
- [x] Pasar `web-design-guidelines` a Finanzas antes de cerrar la fase

## Fase 4 — Gimnasio (Hevy)

- [x] Migración `gym`: gym_exercises (grupo muscular editable), gym_workouts (origen csv/api), gym_sets y body_measurements, con RLS (aplicada)
- [x] Lector del CSV de Hevy (fechas en hora local, kg/lb, km/millas, tipos de serie, ejercicios repetidos) y reimportación sin duplicados
- [x] Grupo muscular deducido del nombre (español e inglés), probado con los nombres reales de Raúl
- [x] Resumen: entrenos del mes, racha de semanas, calendario de 20 semanas, entrenos por semana, series por grupo muscular
- [x] Detalle de entreno, lista de ejercicios con récords (1RM estimado, peso máximo, mejor serie) y ficha con gráfico de progreso
- [x] Medidas corporales y peso con gráfico
- [x] Portada: widget "Último entreno"
- [x] Verificación: CSV real importado (642 entrenos, 13 549 series, 160 ejercicios); Raúl confirma que funciona
- [ ] Con Hevy Pro (opcional): API key cifrada, sincronización inicial y diaria

## Fase 5 — Nutrición

- [x] Migraciones `nutrition` y `nutrition_cooked_factor`: alimentos (macros/100 g, unidades, versión cocida con factor), plan → comidas → grupos → opciones, registro diario, checklist de comidas, cheat meals y revisiones; perímetros nuevos en body_measurements. Todo con RLS (aplicadas)
- [x] Calculadora de raciones: equivalencias del plan, mezcla de alimentos, cocidos convertidos a crudo (arroz ÷ 2,5, pasta ÷ 2…), comparación por macro principal para alimentos fuera de la lista; lo que falta en cada opción
- [x] Hoy: checklist por comida (hecha, comí menos, comí más, saltada, cheat), calculadora en directo y resumen del día
- [x] IA gratuita (Gemini, respaldo Groq): propuestas de comida que cuadran lo que falta (la IA elige alimentos y reparto; los gramos los calcula la app), estimación de cheat meals y de macros de alimentos nuevos
- [x] Cheat meals por periodo entre revisiones; revisiones con peso, perímetros, valoración, notas, % de comidas según el plan
- [x] Plan editable (comidas, grupos, opciones) y alimentos editables; catálogo básico de alimentos
- [x] Pantalla Plan simplificada: se lee como el documento de la nutricionista (opciones en chips, totales del día) y la edición va aparte en «Editar plan»; los grupos se crean por tipo, sin nombres ni tipos que editar
- [x] Carga inicial (solo en la BD, no en el repo): plan de sept. 2026 de la nutricionista y hoja de control desde dic. 2024 (42 revisiones)
- [x] Portada: widget "Nutrición de hoy"
- [x] Configurar `GEMINI_API_KEY` en Vercel (lo hace Raúl)
- [ ] Verificación: unos días usando Hoy con el plan real

## Fase 6 — IA, cruces y extras

- [x] Asistente (`/ia`): chat con Gemini (respaldo Groq) que consulta tus datos con herramientas de solo lectura (finanzas, patrimonio, presupuestos, gimnasio, ejercicios, nutrición, cuerpo y revisiones, agenda); historial solo en la pestaña
- [x] Navegación: «IA» en el menú; Contenido se oculta en móvil hasta la fase 8
- [x] Fotos: leer un ticket rellena un movimiento nuevo (comercio, fecha, total, categoría); foto del plato estima kcal y macros del cheat meal. La foto se reduce en el navegador
- [x] Portada: «Tu semana» (gasto, entrenos y series, % dieta, peso) con comentario de la IA guardado en `ai_weekly_summaries` (migración aplicada, con RLS)
- [x] Cruces (`/ia/cruces`): peso frente a series semanales, días de entreno frente a descanso (dieta y kcal) y gasto en comida frente a la dieta
- [ ] Verificación: Raúl usa el asistente y las fotos con datos reales

## Decisiones

- Login solo con Google vía Supabase Auth (sin Clerk).
- Gimnasio por CSV exportado de Hevy (sin Hevy Pro).
- Inversiones: fondos MyInvestor, acciones/ETFs (MyInvestor y MEXEM) y plan de pensiones en Caser (valor a mano). Historial desde 2024.
- APK carga la web publicada (requiere conexión).
- Icono de la app (favicon, icono de Apple y manifiesto) a partir de la imagen de Raúl: recortada a cuadrado sobre negro; `public/icon-512.png` servirá también para la APK.
- Contenido: YouTube, Instagram y TikTok.
- Extractos bancarios: carpeta "Extractos" de Google Drive (PDF).
- Cuenta con acceso (lista blanca): rmolina2003.rm@gmail.com. La lista vive en `private.allowed_emails` (no expuesta por la API); un trigger sobre `auth.users` rechaza cualquier otro email.
- Calendario: se lee el calendario principal directamente de Google (sin tablas). El refresh token de Google se guarda cifrado por la app; la BD nunca ve el valor en claro.
