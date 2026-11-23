# GYMTRACK — Guía Paso a Paso de Reconstrucción Limpia en Supabase

Esta guía documenta el procedimiento definitivo para reconstruir desde cero el esquema PostgreSQL/Supabase de **GymTrack** (20 tablas definitivas, sin `progreso`, sin `cadena_gimnasios`, `empleado` reutilizable sin `id_gimnasio`, límite de 3 asistencias diarias por gimnasio, RLS y RPCs hardened), **sin tocar los esquemas internos de Supabase** (`auth`, `storage`, `realtime`, `extensions`, `vault`) ni objetos ajenos de `public`.

> **Estado de validación:** Los scripts se verificaron únicamente mediante **validación estática local** (en el equipo de desarrollo no hay `psql` ni `docker` instalados y no se ejecutó SQL contra Supabase remoto). La compilación y ejecución real en PostgreSQL ocurren al correr los pasos 3 a 7 en **Supabase SQL Editor**.

---

## Inventario de scripts (en orden exacto de ejecución)

| Orden | Archivo | Transacción | Propósito |
| :---: | :--- | :---: | :--- |
| **1** | `supabase/00_reset_gymtrack.sql` | `BEGIN ... COMMIT` | Limpieza quirúrgica e idempotente **sin `CASCADE`** (`RESTRICT` + pre-chequeo de dependencias externas en `pg_depend`). |
| **2** | `supabase/01_instalacion_definitiva.sql` | `BEGIN ... COMMIT` | Instalación limpia desde cero de las 20 tablas, constraints, índices, 52 funciones/RPCs, 17 triggers, 43 políticas RLS, 2 vistas seguras y privilegios mínimos. |
| **3** | `supabase/02_verificacion_instalacion.sql` | Solo lectura | Verificación post-instalación estrictamente acotada a objetos de GymTrack (cero dependencia de conteos globales de `public`). |
| **4** | `supabase/tests/test_rls_rpc_seguridad.sql` *(alias: `supabase/04_tests_rls_rpc.sql`)* | `BEGIN ... ROLLBACK` | Suite transaccional de seguridad RLS, ACLs directos vs heredados, vistas y reglas de negocio RPC (no persiste datos). |
| **5** | `supabase/gymtrack_seed_pruebas.sql` *(alias: `supabase/03_seed_pruebas.sql`)* | `BEGIN ... COMMIT` | Datos reproducibles de prueba (solo desarrollo/staging) para las 20 tablas definitivas. |

---

## Paso 1 — Inspeccionar el estado actual en Supabase

En **Supabase Dashboard → SQL Editor**, ejecuta esta consulta de solo lectura para registrar qué objetos existen hoy en `public`:

```sql
select 'tabla' as tipo, tablename as nombre
from pg_catalog.pg_tables
where schemaname = 'public'
union all
select 'vista', viewname
from pg_catalog.pg_views
where schemaname = 'public'
union all
select 'funcion', p.proname || '(' || pg_catalog.pg_get_function_identity_arguments(p.oid) || ')'
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
order by tipo, nombre;
```

---

## Paso 2 — Respaldo preventivo (aunque no existan datos reales)

1. **Snapshot / Backup del proyecto**: desde **Database → Backups** (o guardar la salida del Paso 1).
2. **Usuarios en `auth.users`**: revisar **Authentication → Users** (el reset **no** borra `auth.users`).
3. **Configuración del proyecto**:
   - **Project Settings → API**: `Project URL`, `anon / publishable key`, `service_role / secret key`.
   - **Authentication → URL Configuration**: `Site URL` y `Redirect URLs` (ej. `http://localhost:5173`).
4. **Copia local de `.env`** de `gymtrack-backend-python` y `frontend/` (nunca commitear secretos).

---

## Paso 3 — Ejecutar `supabase/00_reset_gymtrack.sql`

1. Abre **Supabase SQL Editor → New Query**.
2. Pega el contenido completo de `supabase/00_reset_gymtrack.sql` y pulsa **Run**.

**Garantías de aislamiento real:**
- **Cero `DROP ... CASCADE`**: todos los `DROP` usan `RESTRICT`.
- **Pre-chequeo en `pg_catalog.pg_depend`**: antes de borrar nada, detecta si cualquier objeto externo (vista, tabla con FK, función, trigger, política, valor por defecto o tipo ajeno a la lista explícita de GymTrack) depende de un objeto GymTrack. Si existe alguna dependencia ajena, **aborta la transacción sin borrar nada** y lista cada dependencia exacta.
- Elimina en orden topológico (`vistas → políticas y triggers GymTrack → 58 funciones históricas/definitivas → FKs internas GymTrack → 9 tablas legacy + 20 tablas definitivas → secuencias huérfanas GymTrack`), funcionando de forma idempotente sobre esquema legacy, instalaciones parciales, esquema definitivo o base ya limpia.
- **No toca** `auth`, `storage`, `realtime`, `extensions`, `vault`, extensiones administradas ni objetos ajenos en `public`.

**Resultado esperado en SQL Editor:**
- `Success. No rows returned`
- Mensajes `NOTICE` en el panel de mensajes:
  - `Pre-chequeo de dependencias externas OK: 0 dependencias ajenas detectadas.` (o `no existen objetos previos de GymTrack en public`).
  - `RESET GYMTRACK COMPLETADO OK (SIN CASCADE): 0 tablas, 0 vistas y 0 funciones propias restantes en public. auth/storage/realtime y objetos ajenos intactos.`

---

## Paso 4 — Ejecutar `supabase/01_instalacion_definitiva.sql`

1. En **Supabase SQL Editor → New Query**, pega `supabase/01_instalacion_definitiva.sql` y pulsa **Run**.
2. Instala dentro de una única transacción (`BEGIN ... COMMIT`):
   - **20 tablas definitivas** (sin `progreso`, sin `cadena_gimnasios`, sin `empleado.id_gimnasio`).
   - **8 FKs compuestas anti-cruce**, **33 índices** (7 únicos/parciales clave), **52 funciones** con `search_path = pg_catalog, public` y `OWNER TO postgres`, **17 triggers**, **43 políticas RLS** (0 permisivas), privilegios mínimos acotados estrictamente a las **20 tablas y 20 secuencias** de GymTrack, y las **2 vistas de catálogo**.

**Resultado esperado en SQL Editor:**
- `Success. No rows returned` sin errores.

### Evaluación de seguridad de las vistas `vw_catalogo_gimnasios` y `vw_catalogo_planes`

- **Por qué `security_invoker = false` (propiedad `postgres`)**: las tablas base `public.gimnasio` y `public.membresia_gimnasio` tienen RLS multi-tenant estricto que solo permite leer gimnasios donde el usuario ya es staff o ya está asociado. Un usuario `authenticated` (por ejemplo, un socio buscando un nuevo gimnasio para asociarse vía `rpc_asociar_socio_gimnasio` o contratar vía `rpc_contratar_membresia`) recibiría 0 filas si la vista corriera con `security_invoker = true`.
- **Por qué `security_barrier = true` por sí solo no basta y qué capas protegen las vistas**:
  1. **`anon` bloqueado totalmente**: `REVOKE ALL ... FROM PUBLIC, anon` — un visitante anónimo recibe `permission denied` (cero scraping directo vía PostgREST).
  2. **`authenticated` solo lectura**: `GRANT SELECT` (sin `INSERT`/`UPDATE`/`DELETE`), exclusivamente sobre filas activas (`g.estado = true` y `p.estado = true`).
  3. **Proyección estricta sin datos personales ni privados**:
     - `vw_catalogo_gimnasios`: solo `(id_gimnasio, nombre, telefono, estado)` — excluye `email`, `id_dueno`, `fecha_registro` y cualquier PII.
     - `vw_catalogo_planes`: solo `(id_membresia_gimnasio, id_gimnasio, nombre, descripcion, precio, duracion_dias, limite_asistencias_semanales, limite_asistencias_totales, estado)`.
  4. **`security_barrier = true`**: impide ataques de canal lateral (predicate pushdown) para inferir filas inactivas filtradas por el `WHERE`.
  5. **Alcance multi-gimnasio intencional**: ambas vistas funcionan exclusivamente como directorio comercial de gimnasios y planes **activos** para usuarios autenticados; las tablas base (`gimnasio`, `sucursal`, `membresia_gimnasio`, `socio`, `membresia_socio`, `pago`, `asistencia_socio`, `empleado*`, `administrador*`, `rutina*`, `ejercicio*`) mantienen aislamiento estricto por gimnasio vía RLS.
  - *Nota sobre Supabase Database Linter:* si el linter de Supabase marca un aviso `security_definer_view` sobre estas 2 vistas, es un comportamiento esperado y controlado por las 5 capas anteriores.

---

## Paso 5 — Ejecutar `supabase/02_verificacion_instalacion.sql`

1. En **Supabase SQL Editor → New Query**, pega `supabase/02_verificacion_instalacion.sql` y pulsa **Run**.
2. Todas las validaciones están **estrictamente acotadas a objetos de GymTrack** (no dependen de conteos globales de objetos ajenos en `public`). Si algún control falla, acumula y reporta todos los errores en un único mensaje detallado.

**Resultado esperado en SQL Editor:**
- Sin excepciones, con `NOTICE`: `VERIFICACIÓN GYMTRACK OK (0 ERRORES, ACOTADO A OBJETOS GYMTRACK)`.
- Tabla de resultados devuelta (todas las filas con `estado = 'OK'`):

| `categoria` | `obtenido` | `esperado` | `estado` |
| :--- | :---: | :---: | :---: |
| `tablas_gymtrack` | 20 | 20 | `OK` |
| `tablas_gymtrack_con_rls` | 20 | 20 | `OK` |
| `tablas_legacy_presentes` | 0 | 0 | `OK` |
| `vistas_catalogo_gymtrack` | 2 | 2 | `OK` |
| `funciones_gymtrack` | 52 | 52 | `OK` |
| `triggers_gymtrack` | 17 | 17 | `OK` |
| `politicas_rls_gymtrack` | 43 | 43 | `OK` |

---

## Paso 6 — Ejecutar la suite de pruebas RLS y RPC (`supabase/tests/test_rls_rpc_seguridad.sql`)

1. En **Supabase SQL Editor → New Query**, pega `supabase/tests/test_rls_rpc_seguridad.sql` (o su copia equivalente `supabase/04_tests_rls_rpc.sql`) y pulsa **Run**.
2. Corre completamente dentro de `BEGIN ... ROLLBACK`: crea usuarios/datos sintéticos en transacción, valida todos los escenarios del modelo y seguridad, y revierte todo sin dejar residuos.

**Resultado esperado en SQL Editor:**
- Ejecución limpia sin excepciones y `NOTICE`:
  `OK — Suite completa de seguridad RLS/RPC GymTrack ejecutada sin fallos.`

---

## Paso 7 — Crear usuarios de prueba en Supabase Auth y ejecutar `supabase/gymtrack_seed_pruebas.sql`

### 7.1. Paso A (Supabase Auth — fuera del SQL)

En **Supabase Dashboard → Authentication → Users → Add user** (con **Auto Confirm User** activo y contraseñas locales ficticias), crea los usuarios que necesites probar:

| Perfil | Correo ficticio |
| :--- | :--- |
| Dueño 1 (Norte Fit) | `seed_dueno_norte@gymtrack.test` |
| Dueño 2 (Sur Power) | `seed_dueno_sur@gymtrack.test` |
| Administrador Organizacional | `seed_admin_org@gymtrack.test` |
| Empleado Admin Sucursal (Norte Fit) | `seed_admin_suc_norte@gymtrack.test` |
| Empleado Recepcionista (Norte Fit) | `seed_recep_norte@gymtrack.test` |
| Empleado Entrenador (Norte Fit + Sur Power) | `seed_trainer_norte@gymtrack.test` |
| Empleado Recepcionista (Sur Power) | `seed_recep_sur@gymtrack.test` |
| Empleado Entrenador (Sur Power) | `seed_trainer_sur@gymtrack.test` |
| Socio Multi-Gimnasio | `seed_socio_multi@gymtrack.test` |
| Socio Solo Norte Fit | `seed_socio_norte@gymtrack.test` |
| Socio Solo Sur Power | `seed_socio_sur@gymtrack.test` |
| Socio Asociación Inactiva | `seed_socio_baja@gymtrack.test` |

### 7.2. Paso B (SQL de seed)

1. En **Supabase SQL Editor → New Query**, pega `supabase/gymtrack_seed_pruebas.sql` (o su copia equivalente `supabase/03_seed_pruebas.sql`) y pulsa **Run**.
2. **Resultado esperado:** `COMMIT` exitoso y `NOTICE`: `OK — Seed de pruebas GymTrack insertado correctamente.` (enlazando automáticamente `auth_user_id` para los correos que ya existan en `auth.users`).

---

## Paso 8 — Variables de entorno necesarias

### Backend FastAPI (`gymtrack-backend-python/.env`)

```env
HOST=0.0.0.0
PORT=3000
FRONTEND_URL=http://localhost:5173

# Supabase (Project Settings -> API)
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_ANON_KEY=<tu-clave-publica-anon-o-publishable>

# OPCIONAL: SOLO para administración de Supabase Auth (crear/invitar usuarios).
# NUNCA usar para consultas de negocio ni para saltarse RLS.
SUPABASE_SERVICE_ROLE_KEY=<tu-clave-service-role-o-sb_secret>

# Verificación criptográfica JWT (por defecto derivadas de SUPABASE_URL)
SUPABASE_JWT_ISSUER=https://<tu-proyecto>.supabase.co/auth/v1
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_JWKS_URL=https://<tu-proyecto>.supabase.co/auth/v1/.well-known/jwks.json
SUPABASE_JWT_ALGORITHMS=ES256,RS256,HS256
```

### Frontend React (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<tu-clave-publica-anon-o-publishable>
```

> **Regla crítica:** **NUNCA** colocar `SUPABASE_SERVICE_ROLE_KEY` ni `sb_secret_*` en `frontend/.env`, en ninguna variable `VITE_*` ni en `SUPABASE_ANON_KEY`.

---

## Paso 9 — Qué pruebas requieren ejecución manual en PostgreSQL/Supabase

Dado que no existe PostgreSQL/Docker local en este entorno y no se ejecutó SQL contra Supabase remoto, las siguientes verificaciones deben confirmarse manualmente al ejecutar los scripts en **Supabase SQL Editor**:

1. **Compilación real y DDL/PLpgSQL** de `00_reset_gymtrack.sql` y `01_instalacion_definitiva.sql` en el motor PostgreSQL de Supabase.
2. **Prueba de idempotencia del reset**: confirmar que ejecutar `00_reset_gymtrack.sql` sobre el esquema actual (y opcionalmente una segunda vez en limpio) finaliza sin errores y sin tocar `auth.users`.
3. **Verificación de catálogo y ACLs reales**: ejecutar `02_verificacion_instalacion.sql` y confirmar las 7 filas en estado `OK`.
4. **Ejecución en vivo de la suite RLS/RPC**: ejecutar `supabase/tests/test_rls_rpc_seguridad.sql` (`BEGIN ... ROLLBACK`) para probar en runtime todas las políticas RLS, triggers, bloqueos advisory de concurrencia, vistas `vw_catalogo_*`, límite de 3 asistencias/día/gimnasio, pagos/anulaciones, empleados reutilizables y responsables históricos de rutinas.
5. **Carga del seed y prueba de login real**: crear al menos un usuario `seed_*@gymtrack.test` en Supabase Auth, ejecutar `supabase/gymtrack_seed_pruebas.sql` y confirmar vinculación de `auth_user_id`.
6. **Prueba de concurrencia real (dos sesiones paralelas)** si se desea estrés adicional sobre `rpc_registrar_ingreso_asistencia` y `rpc_registrar_pago` (en un único bloque SQL transaccional solo se valida la lógica secuencial y la presencia de `pg_advisory_xact_lock` / `FOR UPDATE`).
