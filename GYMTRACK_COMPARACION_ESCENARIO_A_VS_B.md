# GYMTRACK — Informe Comparativo: Escenario A vs Escenario B

> **Propósito:** Verificar y documentar las diferencias estructurales, funcionales, de privilegios y de objetos residuales entre el **Escenario A** (base nueva/limpia) y el **Escenario B** (migración incremental de base existente de 13 tablas). Véase también [GYMTRACK_GUIA_MIGRACIONES_SUPABASE.md](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/GYMTRACK_GUIA_MIGRACIONES_SUPABASE.md).

---

## 1. Definición de cada escenario

- **Escenario A (Creación limpia sobre PostgreSQL/Supabase vacío):**
  1. [schema_definitivo.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/schema_definitivo.sql)
  2. [07_rls_y_rpc_modelo_definitivo.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/07_rls_y_rpc_modelo_definitivo.sql)
- **Escenario B (Base existente creada originalmente con `GymTrack_Supabase_PostgreSQL.sql`):**
  1. [01_migracion_empleados_y_asistencias.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/01_migracion_empleados_y_asistencias.sql)
  2. [02_funciones_rpc_y_validaciones.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/02_funciones_rpc_y_validaciones.sql)
  3. [03_politicas_rls.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/03_politicas_rls.sql)
  4. [04_simplificar_asistencia_socio.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/04_simplificar_asistencia_socio.sql)
  5. [05_socio_gimnasio_y_administradores.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/05_socio_gimnasio_y_administradores.sql)
  6. [06_separacion_ejercicios_y_rutinas.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/06_separacion_ejercicios_y_rutinas.sql)
  7. [07_rls_y_rpc_modelo_definitivo.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/07_rls_y_rpc_modelo_definitivo.sql)

---

## 2. Tabla comparativa de diferencias verificadas tras aplicar `07`

| Aspecto | Escenario A (`schema_definitivo.sql` + `07`) | Escenario B (`01`..`07` sobre base inicial 13 tablas) | Impacto y equivalencia |
| :--- | :--- | :--- | :--- |
| **20 tablas principales del modelo definitivo** (`dueno`, `gimnasio`, `sucursal`, `administrador`, `administrador_gimnasio`, `empleado`, `empleado_sucursal`, `socio`, `socio_gimnasio`, `membresia_gimnasio`, `membresia_socio`, `pago`, `asistencia_socio`, `ejercicio_socio`, `ejercicio_gimnasio`, `rutina_socio`, `rutina_gimnasio`, `rutina_ejercicio_socio`, `rutina_ejercicio_gimnasio`, `rutinas_asignadas_socio_gimnasio`) | Creadas desde cero en `schema_definitivo.sql` ya con columnas `anulada_por`, `anulada_en`, `motivo_anulacion` en `asistencia_socio`. | Evolucionadas en `01`, `04`, `05`, `06` y extendidas no destructivamente en `07` con `anulada_*` en `asistencia_socio`. | **Equivalentes** en columnas, tipos, FKs compuestas e índices críticos tras ejecutar `07`. |
| **Tabla `public.progreso`** | **NO se crea** en `schema_definitivo.sql`. `07` detecta `to_regclass('public.progreso') IS NULL` y omite sus políticas sin error (`RAISE NOTICE`). | **SÍ existe**, creada aditivamente en `01` con `idx_progreso_socio_fecha` y `trg_proteger_progreso`; `07` le aplica RLS, `GRANT`s, políticas y privilegios de secuencia. | **Diferencia real:** el backend FastAPI ([dashboard_socio.py](file:///C:/Users/lutra/Documents/GitHub/gymtrack-backend-python/app/routers/dashboard_socio.py)) consulta e inserta en `public.progreso`. Si se adopta Escenario A para una app que use seguimiento de peso corporal, debe ejecutarse adicionalmente el DDL de `public.progreso` de `01` (antes de `07`). |
| **Tablas legacy (`public.ejercicio`, `public.rutina`, `public.rutina_ejercicio`)** | **No existen.** | **Se conservan** para no eliminar historial; `06` copia sus datos válidos a las nuevas tablas separadas y `07` revoca `INSERT/UPDATE/DELETE` dejando solo `SELECT` RLS. | Equivalente para el modelo nuevo; `authenticated` no puede escribir en legacy tras `07`. |
| **Funciones/triggers legacy (`rpc_reordenar_rutina_ejercicios`, `trg_fn_validar_ejercicio_en_rutina`, `trg_fn_proteger_propietario_ejercicio`, `trg_fn_proteger_propietario_rutina`)** | **No existen.** | **Permanecen** de `01`/`02`. `07` revoca triggers y asigna `OWNER TO postgres` a `rpc_reordenar_rutina_ejercicios`. | **Advertencia en Escenario B:** `trg_fn_validar_ejercicio_en_rutina` (creado en `02`) aún referencia `membresia_socio.id_socio` (columna eliminada en `05`). Como `07` congela `rutina_ejercicio` a solo lectura para `authenticated`, el trigger no se activa en operación normal, pero un `INSERT` manual con `service_role` sobre `rutina_ejercicio` fallaría si no se elimina ese trigger legacy. |
| **Nombres de constraints en `empleado_sucursal.rol` y FKs de `asistencia_socio`** | CHECK anónimo inline en `empleado_sucursal.rol`; FKs de `asistencia_socio` con nombres auto-generados (`asistencia_socio_id_*_fkey`). | CHECK nombrado `ck_empleado_sucursal_rol` en `01`; FKs de `asistencia_socio` verificadas en `04` (si faltaban se crean como `fk_asistencia_socio` y `fk_asistencia_sucursal`). | Funcionalmente idénticos; solo difiere el identificador de constraint en catálogo si alguna migración posterior hiciera referencia por nombre exacto. |
| **Política `ON DELETE` en `empleado_sucursal`** | `ON DELETE RESTRICT` hacia `empleado` y `sucursal`. | Conserva la FK de `GymTrack_Supabase_PostgreSQL.sql` (también `ON DELETE RESTRICT`). | **Idénticas.** |
| **Triggers intermedios antes de aplicar `07`** | `schema_definitivo.sql` incluye 6 triggers con detección temporal `current_user` que son reemplazados al ejecutar `07`. | `01` y `05` incluyen triggers reemplazados en `07`. Además `07` añade `trg_fn_proteger_campos_empleado` sobre `public.empleado` en ambos escenarios. | Tras ejecutar `07` como paso final, ambos escenarios quedan con exactamente los mismos triggers hardened sin `current_user` y propiedad `postgres`. |
| **Privilegios de tablas, columnas, secuencias, vistas y políticas RLS** | Aplicados íntegramente por `07`. | Aplicados íntegramente por `07` (incluyendo tablas condicionales `progreso` y legacy). | **Idénticos** para todas las entidades activas, vistas `vw_catalogo_*`, secuencias y RPCs. |

---

## 3. Reglas de no-re-ejecución e idempotencia
- **Escenario A:** Nunca ejecutar `schema_definitivo.sql` sobre una base con tablas previas (fallará al crear tablas existentes); tampoco mezclar `01`–`06` después de `schema_definitivo.sql`.
- **Escenario B:** Cada script `01`..`07` está envuelto en `BEGIN; ... COMMIT;` y es obligatorio respetarlo en orden estricto **una sola vez por paso**, sin volver a ejecutar `GymTrack_Supabase_PostgreSQL.sql` ni `schema_definitivo.sql`.
- **`07_rls_y_rpc_modelo_definitivo.sql`:** Es re-ejecutable (idempotente mediante `CREATE OR REPLACE`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS` y reasignación completa de `REVOKE/GRANT` y `OWNER`) sobre cualquiera de los dos escenarios una vez alcanzado el estado de esquema definitivo (`schema_definitivo.sql` o `06`).
