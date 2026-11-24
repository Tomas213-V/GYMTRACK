# Migraciones SQL para Supabase — GymTrack

> **IMPORTANTE:** No ejecutar scripts automáticamente en Supabase remoto sin ventana controlada y respaldo previo.

## Escenarios de ejecución

### Escenario A — Base de datos nueva o descartable
1. Ejecutar [schema_definitivo.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/schema_definitivo.sql) (tablas, restricciones compuestas, índices, triggers de integridad y RLS habilitado).
2. Ejecutar [07_rls_y_rpc_modelo_definitivo.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/07_rls_y_rpc_modelo_definitivo.sql) (helpers `SECURITY DEFINER`, vistas `vw_catalogo_*`, RPCs transaccionales, privilegios mínimos y todas las políticas RLS).

*(Alternativamente en base vacía también puede ejecutarse `GymTrack_Supabase_PostgreSQL.sql` seguido de `01` → `07` en estricto orden.)*

### Escenario B — Base existente con esquema inicial (13 tablas) y datos a conservar
**NO volver a ejecutar `GymTrack_Supabase_PostgreSQL.sql` ni `schema_definitivo.sql`.**  
Ejecutar las migraciones incrementales en estricto orden:

1. [01_migracion_empleados_y_asistencias.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/01_migracion_empleados_y_asistencias.sql)
2. [02_funciones_rpc_y_validaciones.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/02_funciones_rpc_y_validaciones.sql)
3. [03_politicas_rls.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/03_politicas_rls.sql)
4. [04_simplificar_asistencia_socio.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/04_simplificar_asistencia_socio.sql)
5. [05_socio_gimnasio_y_administradores.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/05_socio_gimnasio_y_administradores.sql)
6. [06_separacion_ejercicios_y_rutinas.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/06_separacion_ejercicios_y_rutinas.sql)
7. [07_rls_y_rpc_modelo_definitivo.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/07_rls_y_rpc_modelo_definitivo.sql)

Consulta el detalle completo de precondiciones, backups, verificaciones y rollback en [GYMTRACK_GUIA_MIGRACIONES_SUPABASE.md](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/GYMTRACK_GUIA_MIGRACIONES_SUPABASE.md).

## Variables de entorno requeridas

### Backend (`backend/.env`)
```env
PORT=3000
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_ANON_KEY=<tu-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<tu-service-role-key>
FRONTEND_URL=http://localhost:5173
```
> **Importante**: `SUPABASE_SERVICE_ROLE_KEY` solo debe configurarse en el backend (nunca con prefijo `VITE_` ni en el frontend).

### Frontend (`frontend/.env`)
```env
VITE_API_URL=http://localhost:3000/api
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<tu-anon-key>
```
