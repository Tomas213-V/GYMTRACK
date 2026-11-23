# GYMTRACK — Estado de Pruebas del Esquema Consolidado Limpio

**Fecha de verificación:** `2026-11-23`

> **Transparencia obligatoria:** En el entorno local **no están instalados `psql` ni `docker`** y existe prohibición expresa de operar contra Supabase remoto. Por ello **ninguna prueba SQL ha sido ejecutada todavía contra un motor PostgreSQL real**. Las comprobaciones realizadas en esta sesión corresponden exclusivamente a **análisis y verificación estática**.

---

## 1. Clasificación de pruebas y estado real

| Nivel de prueba | Archivo | Estado real | Alcance cubierto |
| :--- | :--- | :--- | :--- |
| **Pruebas estáticas (inspección + sintaxis de bloques y contratos)** | [gymtrack_instalacion_definitiva.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/gymtrack_instalacion_definitiva.sql), [gymtrack_seed_pruebas.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/gymtrack_seed_pruebas.sql), [test_rls_rpc_seguridad.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/tests/test_rls_rpc_seguridad.sql) | **Ejecutadas (estáticas)** | Verificación de las 20 tablas definitivas, ausencia de `progreso`, `empleado.id_gimnasio` y objetos legacy, firmas RPC, triggers, `search_path`, ownership `postgres`, privilegios ACL y paridad `BEGIN`/`COMMIT`/`ROLLBACK`. |
| **Pruebas locales en PostgreSQL (`psql` / `docker`)** | [test_rls_rpc_seguridad.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/tests/test_rls_rpc_seguridad.sql) | **NO EJECUTADAS** | No existe motor PostgreSQL ni Docker en el host local. |
| **Pruebas ejecutadas en PostgreSQL / Supabase Staging** | Instalación limpia + [test_rls_rpc_seguridad.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/tests/test_rls_rpc_seguridad.sql) + [gymtrack_seed_pruebas.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/gymtrack_seed_pruebas.sql) | **NO EJECUTADAS** | Prohibición expresa de ejecutar scripts sobre Supabase remoto en esta etapa. |

---

## 2. Cobertura implementada en [test_rls_rpc_seguridad.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/tests/test_rls_rpc_seguridad.sql)

1. **Identidad y `fn_es_service_role()`:** bloqueo de `anon`, rechazo de JSON malformado/no-objeto/contradictorio en `request.jwt.claims` sin lanzar excepción, `rpc_vincular_identidad_perfil` con correo verificado obligatorio y soporte multi-perfil, `rpc_registrar_administrador_gimnasio`, y protección por columna (`gimnasio.id_dueno`, `empleado.auth_user_id`).
2. **Aislamiento multi-tenant:** rechazo de auto-asociación en `socio_gimnasio`, `rpc_cambiar_estado_socio_gimnasio` y separación estricta entre gimnasios y sucursales.
3. **Membresías y pagos:** contratación inicial, renovación anticipada (`+ 1`), renovación post-vencimiento, pago parcial no activador, sobrepago bloqueado, comprobante duplicado por gimnasio bloqueado incluso bajo `service_role` (`trg_validar_comprobante_unico_gimnasio`) y permitido en otro gimnasio, múltiples pagos aprobados con anulación y preservación de `'vencida'`.
4. **Asistencias (Decisión 1.A):** ingreso vigente, rechazo de doble asistencia abierta en el mismo gimnasio (incluso en otra sucursal del mismo gimnasio) permitiendo asistencia simultánea independiente en otro gimnasio, **límite máximo de 3 asistencias por día y por gimnasio sumando todas sus sucursales** (bloqueando la 4ta por RPC y por trigger incluso bajo `service_role`, sin borrar las 3 cerradas del historial y permitiendo asistir a otro gimnasio el mismo día), y anulación auditada (`anulada_por`, `anulada_en`, `motivo_anulacion`) que no consume cupo diario.
5. **Empleados reutilizables y responsable de rutinas (Decisiones 1.C y 1.D):**
   - un empleado sin asignación activa en otra sucursal no puede acceder a ella;
   - `rpc_registrar_empleado_sucursal` reutiliza el mismo `id_empleado` al incorporarse a otro gimnasio sin duplicar identidad;
   - un dueño no puede desactivar globalmente `empleado.estado = false` si el empleado trabaja activamente en otro gimnasio;
   - al dejar un gimnasio se desactiva su `empleado_sucursal` (`estado = false`), perdiendo permisos en ese gimnasio y conservando acceso en el otro;
   - un empleado desactivado no puede recibir nuevas asignaciones ni autorizar cambios/cierres;
   - `rpc_finalizar_rutina_asignada` permite cerrar una rutina cuyo responsable fue desactivado, conservando `id_empleado_responsable` histórico;
   - `rpc_reasignar_responsable_rutina_asignada` permite reasignar una rutina activa a un entrenador activo y autorizado del gimnasio y rechaza recepcionistas o entrenadores inactivos.
6. **Catálogo PostgreSQL y ACL (directo vs heredado):** RLS activo en las 20 tablas, cero políticas `USING (true)`/`WITH CHECK (true)`, helpers `pg_temp.acl_tiene_privilegio_directo` y `pg_temp.acl_tiene_privilegio_heredado` sobre `aclexplode(coalesce(..., acldefault(...)))` para `PUBLIC`, `anon`, `authenticated` y `service_role` en funciones y secuencias, vistas `vw_catalogo_*` con `security_barrier=true, security_invoker=false`, propietario `postgres`, y ausencia total de `public.progreso`, `empleado.id_gimnasio` y objetos legacy.
