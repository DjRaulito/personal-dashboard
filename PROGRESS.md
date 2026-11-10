# PROGRESS.md

Plan completo: informe "Plan: Dashboard personal" (Claude Docs). Este archivo es el punto de reanudación.

## Estado actual

- **Fase:** 8 — Contenido
- **Última tarea hecha:** centro de agentes (`/ia/agentes`): fichas, tareas a varios agentes a la vez, tablero en directo, motores Gemini y Claude Code, aprobaciones
- **Cerebro (12 nov 2026):** hecho, ver «Cerebro» al final. Falta crear un token en `/ia/cerebro` y conectar la primera IA.
- **Siguiente tarea:** verificar la fase 8 con los pasos manuales hechos (primer vídeo real del VoiceStudio). Después fase 9 (seguridad, rendimiento, copias, APK). Pendientes sueltos: verificación de la fase 7 (3 tareas a la vez) y del cerebro.

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
- [x] Registro de comidas rápido (pedido el 10 nov 2026): chips de un toque por grupo con las opciones del plan (apunta lo que falta; la comida se marca hecha sola al completarse), «Igual que ayer» por comida, «Copiar ayer» y «Las que faltan, según el plan» para el día, «Describir o foto» (la IA lo pasa a alimentos y gramos y se confirma con un toque); la calculadora de gramos queda plegada en «Ajustar gramos»

## Fase 7 — Agentes

- [x] Migración `agents`: agents, agent_tasks, agent_runs, agent_logs y agent_actions con RLS y Realtime (aplicada)
- [x] Pantalla de agentes (`/ia/agentes`): crear y editar (nombre, rol, instrucciones, motor, herramientas permitidas, pasos máximos, activo) y cinco agentes de partida (analista financiero, coach de gym y nutrición, guionista, desarrollador, investigador)
- [x] Motor Gemini: corre en la app (después de responder, con `after`) con las herramientas de solo lectura del asistente y dos herramientas de propuesta (presupuesto y aportación a hucha)
- [x] Motor Claude Code: la app lanza el workflow `agent.yml` (GitHub Actions) con la suscripción de Raúl, consulta su estado y descarga el resultado; si cambia código, deja una rama y propone abrir el PR
- [x] Una tarea a varios agentes a la vez, cola con límite de 3 en marcha, tablero en directo (Supabase Realtime) con registro y resultado de cada agente; cancelar ejecuciones
- [x] Aprobación humana: las acciones con efecto (presupuesto, hucha, abrir PR) esperan a que Raúl las apruebe
- [ ] Verificación: lanzas 3 tareas a 3 agentes a la vez y las tres terminan con su resultado visible

### Pasos manuales pendientes para Claude Code (los hace Raúl)

1. En tu ordenador: `claude setup-token` y guardar el token como secreto `CLAUDE_CODE_OAUTH_TOKEN` en GitHub (Settings → Secrets and variables → Actions).
2. GitHub → Settings → Developer settings → token fine-grained solo para este repo con permisos **Actions**, **Contents** y **Pull requests** en lectura y escritura.
3. Vercel: variable `GITHUB_AGENT_TOKEN` con ese token (y `GITHUB_AGENT_REPO=DjRaulito/personal-dashboard` si no se detecta solo). Redesplegar.
4. Ojo: el repo es público, así que las tareas de Claude Code y sus registros se ven en GitHub. Nada de datos personales en ellas.

### Ideas apuntadas

- [x] Investigar un VPS gratuito para un agente «cerebro» (hecho el 10 nov 2026). Conclusiones:
  - Hermes Agent (Nous Research, MIT) corre en Linux ARM64 con 1-2 GB de RAM si el modelo es externo (Gemini por endpoint compatible con OpenAI, OpenRouter gratis…). Su memoria es suya (MEMORY.md ~2.200 caracteres, USER.md, historial en SQLite) y `hermes mcp-serve` expone mensajería, no memoria (petición abierta en el repo). No sirve tal cual como memoria compartida para otras IAs.
  - Oracle Always Free: Ampere A1 recortado a 2 OCPU y 12 GB (desde el 18 ago 2026); pide tarjeta, a veces no hay capacidad y reclama instancias ociosas (<20 % de CPU, red y memoria en el percentil 95 durante 7 días). Google Cloud e2-micro: 1 GB, solo regiones de EE. UU., gratis para siempre. AWS: solo 12 meses (descartado).
  - Propuesta: el «cerebro» como servidor MCP remoto dentro de este dashboard (tabla en Supabase con RLS + endpoint MCP en Vercel con token; herramientas recordar / buscar / olvidar / olvidar todo; pantalla para ver y borrar al momento). Coste 0 €, sin VPS. Hermes en Oracle queda como extra opcional: agente 24/7 por Telegram que usa ese mismo cerebro como cliente MCP

## Fase 8 — Contenido (+ VoiceStudio, pedido el 10 nov 2026)

- [x] Migraciones `content` (content_pieces, content_metrics, content_piece_transactions) y `studio` (studio_settings, video_jobs, `studio_worker`, bucket privado `studio`) con RLS (aplicadas)
- [x] Banco de ideas (`/contenido/ideas`) con formato, prioridad, etiquetas y plataformas
- [x] Tablero kanban (`/contenido`): Idea → Guion → Grabación → Edición → Programado → Publicado, arrastrar y soltar y botones ← → (móvil y teclado)
- [x] Ficha de pieza: guion (con botón «Escribir con IA»), notas, enlaces, fecha y enlace de publicación
- [x] Calendario editorial (`/contenido/calendario`) y envío de la fecha a Google Calendar (crea, mueve y borra el evento)
- [x] Métricas manuales por plataforma (última foto acumulada) e ingresos de Finanzas enlazados a cada pieza (`/contenido/metricas`)
- [x] VoiceStudio (`/contenido/estudio`): idea o tema → guion (Gemini, escenas con búsqueda de plano) → clips de Pexels → voz IA (Kokoro) o tu voz clonada (Chatterbox) → subtítulos palabra a palabra (faster-whisper) → montaje con ffmpeg en GitHub Actions (`studio.yml`) → vídeo y miniatura en tu Google Drive (carpeta VoiceStudio) → aprobar (la pieza pasa a «Programado») o descartar. Shorts 9:16 y largos 16:9, progreso en directo, revisión opcional del guion
- [x] VoiceStudio «editor viral»: la IA escribe gancho, rótulo y emoji por escena y el tono de la música; plano de cada escena = clip de Pexels → imagen IA (Pollinations, gratis, animada con zoom) → fondo animado generado (luces y partículas); golpe de zoom y destello en cada corte, etalonaje y viñeta; rótulos que saltan con emojis (Twemoji), subtítulos con la palabra activa en color y con salto, barra de progreso, música generada (agachada bajo la voz) y efectos de sonido (whoosh y pop); miniatura con el gancho. Editable al revisar el guion. Pruebas: `studio/test_fx.py`.
- [x] Piloto automático: `studio-autopilot.yml` avisa cada mañana a `/api/studio/autopilot`; los días elegidos convierte la idea de más prioridad en vídeo (sin sesión, con la clave del estudio)
- [x] Demo del montaje probada en GitHub Actions (10 nov 2026): voz IA 23 s de vídeo en 47 s; voz clonada ~4 min para 15 s (7 GB de RAM; cabe en el runner gratuito). Se relanza con «Run workflow» → job_id `demo`
- [ ] Verificación: creas una idea y la llevas hasta «Publicado» con su fecha en el calendario
- [ ] Verificación VoiceStudio: un vídeo generado de principio a fin sin tocar nada

### Pasos manuales pendientes para Contenido (los hace Raúl)

1. Google Cloud (proyecto del login) → **APIs y servicios → Biblioteca**: activar **Google Drive API** (Calendar ya está).
2. **Pantalla de consentimiento → Acceso a datos**: añadir los permisos `calendar.events` y `drive.file`.
3. En el dashboard: cerrar sesión y volver a entrar con Google, y aceptar los permisos nuevos (escribir en el calendario y guardar los vídeos en tu Drive; la app solo ve los archivos que crea ella).
4. VoiceStudio: el token `GITHUB_AGENT_TOKEN` (paso 2 de los agentes de Claude Code) con un permiso más: **Secrets** de lectura y escritura. Después, en Ajustes del estudio, «Crear la clave» (se guarda sola en GitHub).
5. Opcional: cuenta gratuita en pexels.com/api y `PEXELS_API_KEY` en Vercel (sin ella, los vídeos usan fondos lisos).
6. Ojo: GitHub desactiva los workflows programados de repos públicos tras 60 días sin actividad; si el piloto deja de funcionar, reactívalo en la pestaña Actions.

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

## Notas de operación

- Gemini (10 nov 2026): `gemini-2.5-flash` ya no está disponible para cuentas nuevas (404). Modelo por defecto: `gemini-3.8-flash` (variable `GEMINI_MODEL` para cambiarlo). Cada vuelta tarda ~45 s, así que las páginas de agentes tienen `maxDuration = 300`. Si un modelo da 404/503/429 o no responde en 40 s, `llm.ts` prueba hasta 3 modelos Flash que liste Google.

## Cerebro (memoria para otras IAs)

- [x] Migración `brain` (aplicada): `brain_memories`, `brain_links`, `brain_tokens` con RLS, y la función `brain_call` (SECURITY DEFINER) que comprueba el hash del token y es el único acceso sin sesión. `brain_keep_tags` y `brain_realtime` también aplicadas.
- [x] Endpoint MCP `POST /api/brain/mcp` (JSON-RPC sin estado, Bearer token): remember, search, list, get, link, forget, forget_all. Ruta pública en `paths.ts`; sin claves nuevas en Vercel.
- [x] Pantalla `/ia/cerebro`: red de recuerdos (nodos arrastrables, conexiones directas y por etiquetas, búsqueda), detalle, editar, conectar, olvidar, borrar todo, tokens (se ven una vez) y cómo conectar. Se actualiza en directo.
- [x] Tests: red, colocación, servidor MCP, formulario y tokens (237 en total).
- Tipos de `database.types.ts` ampliados a mano con las tres tablas y `brain_call` (regenerar con el MCP de Supabase cuando convenga).
- [ ] Verificación: crear un token, conectar Claude Code (`claude mcp add --transport http cerebro <url> --header "Authorization: Bearer <token>"`), guardar un recuerdo desde la IA y verlo aparecer en la red.
