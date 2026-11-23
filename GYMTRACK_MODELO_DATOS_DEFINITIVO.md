# GYMTRACK — Modelo de Datos Definitivo

**Fuentes normativas:** [schema_definitivo.sql](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/schema_definitivo.sql) y migraciones incrementales [01](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/01_migracion_empleados_y_asistencias.sql) → [07](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/supabase/migrations/07_rls_y_rpc_modelo_definitivo.sql).  
**Estado remoto:** Modelo definido localmente; **no ejecutado en Supabase remoto**.

---

## 1. Modelo de identidad y arquitectura Auth

- **Estrategia elegida:** Perfiles separados por función (`dueno`, `administrador`, `empleado`, `socio`) vinculados opcionalmente a **una única identidad en Supabase Auth (`auth.users.id`)** mediante `auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL`.
- **Justificación:** Conserva intactas las tablas y flujos existentes del proyecto, evita contraseñas propias en base de datos, impide duplicar cuentas en `auth.users` cuando una persona cumple más de un rol (ej. socio en Gym B y administrador en Gym A) y permite resolver el perfil activo en cada solicitud mediante `X-Active-Role` + `X-Gimnasio-Id`.
- **Vinculación segura (sin confiar ciegamente en email):** Cualquier vinculación de perfil pendiente (`auth_user_id IS NULL`) desde sesión existente exige `email_confirmed_at IS NOT NULL` en `auth.users` (`rpc_vincular_identidad_perfil`) o flujo de invitación/alta administrativa desde servidor (`supabaseAdmin`).

---

## 2. Entidades, atributos, PK, FK y cardinalidades

### 2.1. Organización y sedes
1. **`public.dueno`**
   - **PK:** `id_dueno`
   - **FK / Auth:** `auth_user_id -> auth.users(id)` (`UNIQUE`)
   - **Atributos:** `nombre`, `apellido`, `email` (`UNIQUE`), `fecha_creacion`.
   - **Cardinalidad:** `dueno (1) -> (N) gimnasio`.

2. **`public.gimnasio`** *(representa la organización completa; sin tabla cadena)*
   - **PK:** `id_gimnasio`
   - **FK:** `id_dueno -> dueno(id_dueno)` (`ON DELETE RESTRICT`)
   - **Atributos:** `nombre`, `telefono`, `email`, `fecha_registro`, `estado`.
   - **Cardinalidad:** `gimnasio (1) -> (N) sucursal`, `(1) -> (N) administrador_gimnasio`, `(1) -> (N) socio_gimnasio`, `(1) -> (N) membresia_gimnasio`, `(1) -> (N) ejercicio_gimnasio`, `(1) -> (N) rutina_gimnasio`.

3. **`public.sucursal`**
   - **PK:** `id_sucursal`
   - **FK:** `id_gimnasio -> gimnasio(id_gimnasio)` (`ON DELETE CASCADE`)
   - **UNIQUE:** `(id_sucursal, id_gimnasio)`
   - **Atributos:** `direccion`, `telefono`, `descripcion`, `fecha_registro`, `estado`.

### 2.2. Administradores de gimnasio y Empleados de sucursal
4. **`public.administrador`** *(alcance organizacional sobre todas las sucursales de sus gimnasios)*
   - **PK:** `id_administrador`
   - **FK / Auth:** `auth_user_id -> auth.users(id)` (`UNIQUE`)
   - **Atributos:** `nombre`, `apellido`, `dni` (`UNIQUE`), `email` (`UNIQUE`), `telefono`, `estado`, `fecha_creacion`.

5. **`public.administrador_gimnasio`**
   - **PK:** `id_administrador_gimnasio`
   - **FK:** `id_administrador -> administrador(id_administrador)` (`RESTRICT`), `id_gimnasio -> gimnasio(id_gimnasio)` (`RESTRICT`)
   - **UNIQUE:** `(id_administrador, id_gimnasio)`
   - **Atributos:** `fecha_asignacion`, `estado`.
   - **Cardinalidad:** `administrador (N) <-> (M) gimnasio`.

6. **`public.empleado`** y **`public.empleado_sucursal`** *(alcance operativo estrictamente por sucursal)*
   - **`empleado` PK:** `id_empleado`; **FK:** `id_gimnasio -> gimnasio(id_gimnasio)`, `auth_user_id -> auth.users(id)` (`UNIQUE`); **UNIQUE:** `(id_empleado, id_gimnasio)`; **Atributos:** `nombre`, `apellido`, `dni`, `email`, `telefono`, `estado`, `fecha_creacion`.
   - **`empleado_sucursal` PK:** `id_empleado_sucursal`; **FK:** `id_empleado -> empleado(id_empleado)`, `id_sucursal -> sucursal(id_sucursal)`; **UNIQUE:** `(id_empleado, id_sucursal)`; **CHECK:** `lower(rol) IN ('administrador', 'recepcionista', 'entrenador')`; **Atributos:** `rol`, `estado`, `fecha_asignacion`.
   - **Regla anti-cruce:** Trigger `trg_validar_empleado_sucursal_gimnasio` impide vincular empleado y sucursal de distintos gimnasios. No existe tabla N:M `empleado_gimnasio`.

### 2.3. Socios, Asociaciones, Membresías, Pagos y Asistencias
7. **`public.socio`**
   - **PK:** `id_socio`
   - **FK / Auth:** `auth_user_id -> auth.users(id)` (`UNIQUE`)
   - **Atributos:** `dni` (`UNIQUE`), `telefono`, `fecha_alta`, `estado`, `nombre`, `apellido`, `email` (`UNIQUE`).

8. **`public.socio_gimnasio`**
   - **PK:** `id_socio_gimnasio`
   - **FK:** `id_socio -> socio(id_socio)` (`RESTRICT`), `id_gimnasio -> gimnasio(id_gimnasio)` (`RESTRICT`)
   - **UNIQUE:** `(id_socio, id_gimnasio)` y `(id_socio_gimnasio, id_gimnasio)`
   - **Atributos:** `fecha_alta`, `estado`, `creado_en`.
   - **Reglas:** Asociación independiente de vigencia de membresías; desactivar no elimina historial.

9. **`public.membresia_gimnasio`** *(planes del gimnasio, no de una sucursal)*
   - **PK:** `id_membresia_gimnasio`
   - **FK:** `id_gimnasio -> gimnasio(id_gimnasio)` (`CASCADE`)
   - **UNIQUE:** `(id_gimnasio, nombre)` y `(id_membresia_gimnasio, id_gimnasio)`
   - **Atributos:** `nombre`, `descripcion`, `precio >= 0`, `duracion_dias > 0`, `limite_asistencias_semanales`, `limite_asistencias_totales`, `estado`.

10. **`public.membresia_socio`** *(cada renovación inserta nueva fila histórica)*
    - **PK:** `id_membresia_socio`
    - **FK compuestas:** `(id_socio_gimnasio, id_gimnasio) -> socio_gimnasio(id_socio_gimnasio, id_gimnasio)` (`RESTRICT`), `(id_membresia_gimnasio, id_gimnasio) -> membresia_gimnasio(id_membresia_gimnasio, id_gimnasio)` (`RESTRICT`).
    - **Atributos históricos copiados del plan:** `precio`, `duracion_dias_contratados`, `limite_asistencias_semanales`, `limite_asistencias_totales`, `fecha_inicio`, `fecha_vencimiento`, `estado` (`pendiente | activa | vencida | cancelada`), `creado_en`.
    - **Renovación anticipada:** `rpc_contratar_membresia` encadena automáticamente `fecha_inicio = max(fecha_vencimiento) + 1` cuando hay contrato activo vigente, conservando los días restantes.

11. **`public.pago`**
    - **PK:** `id_pago`
    - **FK:** `id_membresia_socio -> membresia_socio(id_membresia_socio)` (`RESTRICT`)
    - **Atributos:** `fecha_pago`, `monto >= 0`, `metodo_pago`, `estado` (`pendiente | aprobado | rechazado | anulado`), `comprobante`.
    - **Índice único parcial:** `uq_pago_contrato_comprobante_activo` impide duplicar comprobante no anulado en el mismo contrato. Sin `DELETE` físico.

12. **`public.asistencia_socio`** *(modelo simplificado aprobado)*
    - **PK:** `id_asistencia_socio`
    - **FK directas:** `id_socio -> socio(id_socio)` (`RESTRICT`), `id_sucursal -> sucursal(id_sucursal)` (`RESTRICT`). *(Sin `id_membresia_socio` ni `id_gimnasio`.)*
    - **Atributos:** `hora_ingreso`, `hora_salida`, `estado` (`presente | finalizada | anulada`), `CHECK (hora_salida IS NULL OR hora_salida >= hora_ingreso)`.
    - **Índice único parcial:** `uq_asistencia_abierta_socio` sobre `(id_socio) WHERE estado = 'presente' AND hora_salida IS NULL`.

### 2.4. Ejercicios, Rutinas y Asignaciones (separación estricta)
13. **`public.ejercicio_socio`**: PK `id_ejercicio_socio`, FK `id_socio -> socio(id_socio)` (`CASCADE`), UNIQUE `(id_ejercicio_socio, id_socio)`.
14. **`public.ejercicio_gimnasio`**: PK `id_ejercicio_gimnasio`, FK `id_gimnasio -> gimnasio(id_gimnasio)` (`CASCADE`), UNIQUE `(id_ejercicio_gimnasio, id_gimnasio)`.
15. **`public.rutina_socio`**: PK `id_rutina_socio`, FK `id_socio -> socio(id_socio)` (`CASCADE`), UNIQUE `(id_rutina_socio, id_socio)`.
16. **`public.rutina_gimnasio`**: PK `id_rutina_gimnasio`, FK `id_gimnasio -> gimnasio(id_gimnasio)` (`CASCADE`), UNIQUE `(id_rutina_gimnasio, id_gimnasio)`.
17. **`public.rutina_ejercicio_socio`**: PK `id_rutina_ejercicio_socio`, FKs compuestas `(id_rutina_socio, id_socio) -> rutina_socio` (`CASCADE`) y `(id_ejercicio_socio, id_socio) -> ejercicio_socio` (`RESTRICT`), UNIQUE `(id_rutina_socio, id_ejercicio_socio)` y `(id_rutina_socio, orden)`.
18. **`public.rutina_ejercicio_gimnasio`**: PK `id_rutina_ejercicio_gimnasio`, FKs compuestas `(id_rutina_gimnasio, id_gimnasio) -> rutina_gimnasio` (`CASCADE`) y `(id_ejercicio_gimnasio, id_gimnasio) -> ejercicio_gimnasio` (`RESTRICT`), UNIQUE `(id_rutina_gimnasio, id_ejercicio_gimnasio)` y `(id_rutina_gimnasio, orden)`.
19. **`public.rutinas_asignadas_socio_gimnasio`**: PK `id_rutina_asignada`, FKs compuestas `(id_rutina_gimnasio, id_gimnasio) -> rutina_gimnasio` (`RESTRICT`) y `(id_socio_gimnasio, id_gimnasio) -> socio_gimnasio` (`RESTRICT`), FK opcional `id_empleado_responsable -> empleado(id_empleado)` (`SET NULL`), índice único parcial `uq_rutina_asignada_activa` (`where estado = true`).

### 2.5. Tabla aditiva opcional y tablas legacy en transición
- **`public.progreso`** (definida opcionalmente en `01` para el dashboard actual del socio; no incluida en el esquema inicial de 13 tablas y verificada condicionalmente en RLS con `to_regclass('public.progreso')`).
- **Tablas legacy congeladas en Escenario B (`06`/`07`):** `ejercicio`, `rutina`, `rutina_ejercicio` se conservan sin `DROP TABLE` ni pérdida de datos durante la transición de backend; sus escrituras directas quedan revocadas.

---

## 3. Reglas y definiciones confirmadas vs pendientes de implementación posterior

- **Confirmado en diseño:**
  1. Separación estricta de ejercicios y rutinas (`rutina_ejercicio_socio` ↔ `ejercicio_socio`; `rutina_gimnasio` asignada vía `rutinas_asignadas_socio_gimnasio`).
  2. `membresia_socio` enlazada a `(id_socio_gimnasio, id_gimnasio)` mediante FK compuesta y renovación anticipada encadenada (`fecha_vencimiento + 1`).
  3. Adaptación de backend Express/frontend diferida a una segunda etapa documentada en [GYMTRACK_COMPATIBILIDAD_BACKEND.md](file:///c:/Users/lutra/Documents/GitHub/GYMTRACK/GYMTRACK_COMPATIBILIDAD_BACKEND.md).
- **Pendiente para etapa posterior de código de aplicación:**
  1. Actualización de `authMiddleware.js`, controladores Express y pantallas React para operar con `administrador`, `socio_gimnasio`, `ejercicio_socio`/`ejercicio_gimnasio`, `rutina_socio`/`rutina_gimnasio` y `rutinas_asignadas_socio_gimnasio`.
  2. Migración o clonado manual controlado si existieran registros previos de `rutina_ejercicio` en producción donde una rutina de socio incluyera un ejercicio de gimnasio (la migración `06` los preserva en las tablas legacy y emite `NOTICE` informativo).
