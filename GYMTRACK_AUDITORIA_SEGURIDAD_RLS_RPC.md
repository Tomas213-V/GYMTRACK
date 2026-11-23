# GYMTRACK — Auditoría Final de Seguridad de la Instalación Definitiva

> **Alcance y restricciones cumplidas:** Auditoría sobre [gymtrack_instalacion_definitiva.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/gymtrack_instalacion_definitiva.sql), [gymtrack_seed_pruebas.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/gymtrack_seed_pruebas.sql) y [test_rls_rpc_seguridad.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/tests/test_rls_rpc_seguridad.sql). **No se ejecutó SQL contra Supabase remoto ni se modificó el backend FastAPI ni el frontend React.**

---

## 1. Decisiones definitivas de negocio y seguridad implementadas

### A. Asistencias: límite de 3 por día y por gimnasio y alcance por gimnasio
- **Regla implementada:**
  - Cada socio puede registrar **hasta 3 asistencias por día y por gimnasio**, sumando todas las sucursales (`sucursal`) que pertenecen al mismo `id_gimnasio`.
  - Un socio multi-gimnasio puede asistir a distintos gimnasios durante el mismo día con un cupo diario independiente (hasta 3/día) en cada gimnasio.
  - Las asistencias cerradas (`estado = 'finalizada'`) se conservan como historial contable/operativo; las anuladas (`estado = 'anulada'`) conservan trazabilidad (`anulada_por`, `anulada_en`, `motivo_anulacion`) y no consumen el cupo diario.
  - El índice parcial `uq_asistencia_abierta_socio_sucursal` en `public.asistencia_socio (id_socio, id_sucursal) WHERE (estado = 'presente' AND hora_salida IS NULL)` evita restricciones globales indebidas entre gimnasios distintos.
  - Tanto `rpc_registrar_ingreso_asistencia` como el trigger `trg_validar_asistencia_socio_gimnasio` (`trg_fn_validar_asistencia_socio_gimnasio()`, `SECURITY DEFINER`) serializan por `(id_socio, id_gimnasio)` mediante `pg_advisory_xact_lock(hashtext('asistencia_socio_gym'), hashtext(id_socio || ':' || id_gimnasio))` y `SELECT ... FROM public.socio_gimnasio ... FOR UPDATE`, impidiendo tanto dos asistencias abiertas simultáneas en el mismo gimnasio como superar las 3 asistencias diarias en solicitudes concurrentes.

### B. Eliminación completa de `progreso`
- **Corrección aplicada:** La entidad `progreso` no forma parte del modelo aprobado y fue eliminada por completo de [gymtrack_instalacion_definitiva.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/gymtrack_instalacion_definitiva.sql) (**20 tablas definitivas**), de sus políticas RLS, triggers (`trg_fn_proteger_progreso`), grants/secuencias, de [gymtrack_seed_pruebas.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/gymtrack_seed_pruebas.sql) y de [test_rls_rpc_seguridad.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/tests/test_rls_rpc_seguridad.sql) (donde la sección 6.7 verifica `to_regclass('public.progreso') IS NULL`).

### C. Empleados reutilizables entre gimnasios
- **Regla implementada:**
  - `public.empleado` almacena únicamente la identidad personal reutilizable (`id_empleado`, `auth_user_id`, `nombre`, `apellido`, `dni`, `email`, `telefono`, `estado`, `fecha_creacion`), eliminando `empleado.id_gimnasio`.
  - `public.empleado_sucursal` (`rol`, `id_empleado`, `id_sucursal`, `estado`, `fecha_asignacion`, `UNIQUE (id_empleado, id_sucursal)`) modela la relación laboral con cada sucursal (y su gimnasio a través de `sucursal.id_gimnasio`, protegido por `trg_proteger_sucursal_gimnasio_cambio`).
  - `rpc_registrar_empleado_sucursal(...)` permite dar de alta o incorporar un empleado existente (por `id_empleado`, `dni` o `email`) en una sucursal de otro gimnasio reutilizando el mismo `id_empleado` y `auth_user_id` sin duplicar identidades.
  - Al dejar un gimnasio se desactiva la asignación en `empleado_sucursal` (`estado = false`) sin eliminar el empleado (`DELETE` sobre `public.empleado` no se concede a `authenticated`), y `trg_fn_proteger_campos_empleado` impide que el dueño/admin de un gimnasio desactive globalmente `empleado.estado = false` si el empleado mantiene asignaciones activas en otro gimnasio.
  - Ningún empleado accede a otra sucursal por solo existir en `public.empleado`: todas las funciones RLS/RPC (`fn_empleado_en_gimnasio`, `fn_empleado_en_sucursal`) exigen `empleado.estado = true`, `empleado_sucursal.estado = true` y un rol autorizado en esa sucursal/gimnasio.

### D. Responsable histórico y reasignación de rutinas (`rutinas_asignadas_socio_gimnasio`)
- **Regla implementada:**
  - `trg_fn_validar_rutina_asignada` exige que `id_empleado_responsable` esté activo y tenga asignación activa como `entrenador` o `administrador` en el gimnasio al crear una asignación (`INSERT`), al cambiar `id_empleado_responsable` o mientras la asignación permanezca activa (`new.estado = true`).
  - Al finalizar una rutina ya asignada (`old.estado = true -> new.estado = false` mediante `rpc_finalizar_rutina_asignada`) sin alterar `id_empleado_responsable`, se permite el cierre aunque el responsable original haya sido desactivado posteriormente, conservando el responsable histórico.
  - Nueva RPC `rpc_reasignar_responsable_rutina_asignada(p_id_rutina_asignada, p_id_empleado_responsable, p_observaciones)` para reasignar una rutina activa a un entrenador/administrador activo y autorizado del gimnasio, bloqueando tanto a empleados desactivados que intenten ejecutar la operación como la reasignación hacia empleados inactivos o recepcionistas.

---

## 2. Controles adicionales verificados en `gymtrack_instalacion_definitiva.sql`

| Control | Implementación verificada |
| :--- | :--- |
| **`fn_es_service_role()` resiliente** | Usa `coalesce(...)` sin calificador inválido `pg_catalog.coalesce`; captura cualquier JSON malformado o no-objeto en `request.jwt.claims` y cualquier fallo de `auth.uid()`/`auth.role()` en bloques `EXCEPTION WHEN others THEN RETURN false;`. |
| **Unicidad de comprobantes por gimnasio** | `uq_pago_contrato_comprobante_activo` + trigger `trg_validar_comprobante_unico_gimnasio` (`pg_advisory_xact_lock`, `SECURITY DEFINER`, propietario `postgres`), activo incluso bajo `service_role`. |
| **Bloqueos y máquina de estados en pagos** | Orden canónico `membresia_socio FOR UPDATE -> pago FOR UPDATE`; prohibido sobrepago y reactivación de anulados; reversión a `pendiente`/`vencida` sin borrar historial. |
| **Privilegios ACL, secuencias y vistas** | `REVOKE ALL` de funciones, tablas, vistas y secuencias a `PUBLIC` y `anon`; `USAGE, SELECT` en secuencias solo para las 15 tablas con `INSERT` directo; `vw_catalogo_*` con `security_barrier = true, security_invoker = false`; `OWNER TO postgres`. |

---

## 3. Riesgos y validaciones pendientes

1. **Ejecución real en PostgreSQL / Supabase Staging pendiente:** En este entorno local no están instalados `psql` ni `docker` y está prohibido ejecutar SQL en Supabase remoto. Todo el código fue validado estáticamente y debe ejecutarse contra una instancia PostgreSQL real antes de iniciar la adaptación de FastAPI.
2. **Activación administrativa directa sin pago (`rpc_contratar_membresia`):** El staff autorizado puede crear contrataciones con `p_estado = 'activa'` y `p_registrar_pago = false` para becas/cortesías; los socios solo pueden crear solicitudes `'pendiente'`.
