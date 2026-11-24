# GYMTRACK — Guía de Instalación Limpia desde Cero y Orden de Ejecución

> **PROHIBICIÓN CUMPLIDA:** No se ejecutó ningún script ni modificación sobre el proyecto Supabase remoto. Esta guía detalla el procedimiento manual exacto para reconstruir desde cero el proyecto Supabase limpio y verificarlo antes de adaptar FastAPI.

---

## 1. Archivos definitivos para la reconstrucción desde cero

| Orden | Archivo | Propósito | Persistencia de datos |
| :---: | :--- | :--- | :--- |
| **1** | [gymtrack_instalacion_definitiva.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/gymtrack_instalacion_definitiva.sql) | Crea las **20 tablas definitivas** (sin tablas legacy ni `progreso`), índices, triggers, vistas `vw_catalogo_*`, helpers, RPCs (incluyendo empleados reutilizables, límite de 3 asistencias/día/gimnasio y reasignación de responsable de rutinas), privilegios de tablas/columnas/secuencias, políticas RLS y ownership `postgres`. | Crea estructura vacía (`BEGIN; ... COMMIT;`). |
| **2** | [test_rls_rpc_seguridad.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/tests/test_rls_rpc_seguridad.sql) | Ejecuta la suite transaccional completa de identidad, empleados reutilizables entre gimnasios, aislamiento multi-tenant, pagos/sobrepagos, comprobantes por gimnasio bajo `service_role`, límite de 3 asistencias diarias por gimnasio, preservación/reasignación de responsable de rutinas y verificación ACL directa vs heredada. | **Transaccional (`BEGIN; ... ROLLBACK;`)** — no deja datos residuales. |
| **3** | *(Opcional — Paso A Auth)* Supabase Auth (Dashboard / Admin API) | Crear los usuarios ficticios listados en la cabecera de `gymtrack_seed_pruebas.sql` con `email_confirm = true` para pruebas de login real desde FastAPI/React. | Solo usuarios en `auth.users`. |
| **4** | [gymtrack_seed_pruebas.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/gymtrack_seed_pruebas.sql) | Pobla el escenario reproducible (2 gimnasios, 3 sucursales, dueños, administradores, empleados reutilizables por sucursal/rol, socios simples y multi-gimnasio, planes, contrataciones, pagos, asistencias y rutinas separadas). | Inserta datos de prueba ficticios (`BEGIN; ... COMMIT;`). |

> **Importante:** Al reconstruirse la base desde cero, **NO ejecutar** `GymTrack_Supabase_PostgreSQL.sql`, `schema_definitivo.sql` ni las migraciones antiguas `01`..`07`.

---

## 2. Procedimiento recomendado de reinicio y ejecución

1. **Preparar base limpia en el proyecto Supabase objetivo (ventana controlada):**
   - Asegurar que el esquema `public` esté limpio (en un proyecto vacío o tras reset controlado de desarrollo/staging).
2. **Paso 1 — Instalar esquema consolidado (20 tablas):**
   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/gymtrack_instalacion_definitiva.sql
   ```
3. **Paso 2 — Validar seguridad, RLS, triggers, ACL y RPCs (sin ensuciar la base):**
   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/test_rls_rpc_seguridad.sql
   ```
   - Confirmar que finaliza con `NOTICE: OK — Suite completa de seguridad RLS/RPC GymTrack ejecutada sin fallos.` y `ROLLBACK`.
4. **Paso 3 (opcional para probar login real) — Crear usuarios Auth de prueba:**
   - Crear en **Supabase Auth** (con `email_confirm = true`) los correos ficticios listados en `gymtrack_seed_pruebas.sql`.
5. **Paso 4 — Poblar datos de prueba reproducibles:**
   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/gymtrack_seed_pruebas.sql
   ```

---

## 3. Verificaciones SQL rápidas post-instalación (sin usar `'public'` como rol ordinario)

```sql
-- 1. Confirmar exactamente las 20 tablas definitivas y RLS activo en todas
select tablename, rowsecurity
from pg_catalog.pg_tables
where schemaname = 'public'
order by tablename;

-- 2. Confirmar ausencia de progreso, empleado.id_gimnasio y objetos legacy
select
  to_regclass('public.progreso') as tabla_progreso,
  to_regclass('public.ejercicio') as legacy_ejercicio,
  to_regclass('public.rutina') as legacy_rutina,
  to_regclass('public.rutina_ejercicio') as legacy_rutina_ejercicio,
  to_regprocedure('public.trg_fn_validar_ejercicio_en_rutina()') as legacy_trg;

-- 3. Verificar ACL de funciones distinguiendo PUBLIC (grantee = 0) de anon, authenticated y service_role
select
  p.proname as funcion,
  pg_catalog.pg_get_userbyid(p.proowner) as propietario,
  p.prosecdef as security_definer,
  p.proconfig as config,
  exists (
    select 1
    from pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f'::"char", p.proowner))) a
    where a.grantee = 0::oid and a.privilege_type = 'EXECUTE'
  ) as public_direct_exec,
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon_effective_exec,
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_effective_exec,
  pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') as service_role_effective_exec
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (p.proname like 'fn\_%' or p.proname like 'rpc\_%' or p.proname like 'trg\_fn\_%')
order by p.proname;

-- 4. Verificar ACL de secuencias distinguiendo PUBLIC (grantee = 0) de anon, authenticated y service_role
select
  c.relname as secuencia,
  exists (
    select 1
    from pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('s'::"char", c.relowner))) a
    where a.grantee = 0::oid
  ) as public_direct_any,
  pg_catalog.has_sequence_privilege('anon', c.oid, 'USAGE') as anon_usage,
  pg_catalog.has_sequence_privilege('authenticated', c.oid, 'USAGE') as auth_usage,
  pg_catalog.has_sequence_privilege('authenticated', c.oid, 'UPDATE') as auth_update,
  pg_catalog.has_sequence_privilege('service_role', c.oid, 'USAGE') as service_role_usage
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'S'
order by c.relname;
```
