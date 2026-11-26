# GYMTRACK — Token de Inicio de Sesión y Manejo de Permisos

Este documento explica el ciclo de vida completo del **token de sesión** (emisión, almacenamiento, envío, renovación y verificación criptográfica) y el **modelo de autorización, roles y permisos multi-gimnasio** implementado entre el Frontend y el Backend FastAPI + Supabase.

---

## 1. Arquitectura de Autenticación basada en Supabase Auth

GymTrack **no almacena contraseñas en tablas de negocio** (`dueno`, `administrador`, `empleado`, `socio`) ni emite tokens JWT locales firmados manualmente. Toda la identidad reside en **Supabase Auth** (`auth.users`) y los perfiles de negocio se vinculan mediante la columna `auth_user_id` (UUID).

### 1.1 Inicio de sesión y emisión del token

Los endpoints de login en [auth.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/app/routers/auth.py) son:
- `POST /api/auth/login` (staff: dueño, administrador o empleado)
- `POST /api/auth/login-dueno`
- `POST /api/auth/login-administrador`
- `POST /api/auth/login-empleado`
- `POST /api/auth/login-socio`

El flujo de login en el backend sigue estos pasos:
1. Llama a `anon_client.auth.sign_in_with_password({ email, password })` usando un cliente Supabase público **aislado por operación** (`create_supabase_anon_client()` en [config.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/app/config.py)) para evitar contaminación de cabeceras entre requests concurrentes.
2. Si Supabase Auth valida las credenciales, devuelve una sesión con:
   - `access_token`: JWT firmado por Supabase Auth (`sub` = `auth.users.id`, `role` = `"authenticated"`, `aud` = `"authenticated"`, `iss`, `iat`, `exp`).
   - `refresh_token`: token de renovación.
   - `expires_at`: marca temporal de expiración.
3. Con ese `access_token`, el backend crea un cliente acotado al usuario (`create_supabase_client_for_token(access_token)`), resuelve sus perfiles reales en base de datos mediante `resolver_contexto_negocio(...)` y verifica estrictamente que posea el rol correspondiente al formulario desde el cual intentó ingresar (si no lo tiene, responde `403 Forbidden`).
4. Si la cuenta de correo está verificada en Supabase Auth (`email_verified == True`) y existía una ficha presencial sin `auth_user_id`, intenta vincularla automáticamente mediante `rpc_vincular_identidad_perfil`.
5. Devuelve al frontend el `token`, `refresh_token`, `expires_at`, datos seguros del `usuario`, sus `gimnasios`, `sucursales` y `contextos_disponibles` (indicando `requiere_seleccion_gimnasio` si el usuario tiene más de un contexto).

---

## 2. Almacenamiento, Envío y Renovación en el Frontend

### 2.1 Persistencia de sesión (`GymContext.jsx`)

Al recibir una respuesta de login o registro exitoso, `setSession()` en [GymContext.jsx](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/context/GymContext.jsx):
1. Ejecuta `clearSessionStorage()` **antes** de escribir nada, eliminando cualquier rastro de sesiones anteriores (`token`, `refresh_token`, `usuario`, `socio`, `rol`, `gymtrack_active_gym_id`, `gymtrack_active_sucursal_id`, etc.) para evitar cruce de cuentas o gimnasios en el mismo navegador.
2. Guarda en `localStorage`:
   - `token` (`access_token` JWT)
   - `refresh_token`
   - `rol` normalizado (`dueño`, `administrador`, `empleado`, `socio`)
   - `usuario` (y `socio` si aplica)
   - `gymtrack_active_gym_id`, `gymtrack_active_sucursal_id`, `gymtrack_context_confirmed` y `gymtrack_contextos_disponibles`.

### 2.2 Inyección de cabeceras HTTP (`apiClient.js`)

En cada petición autenticada, `buildAuthHeaders()` en [apiClient.js](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/services/apiClient.js) adjunta:
- `Authorization: Bearer <token>`
- `X-Gimnasio-Id: <id_gimnasio>` (si hay gimnasio activo)
- `X-Sucursal-Id: <id_sucursal>` (si hay sucursal activa)
- `X-Active-Role: <rol>` (normalizado en ASCII: `dueno`, `administrador`, `empleado`, `socio`, para evitar problemas de encoding con la `ñ` en cabeceras HTTP).

### 2.3 Refresh automático ante expiración (`401`)

Si el backend responde `401 Unauthorized`:
1. `apiRequest()` invoca `tryRefreshAccessToken()`, reutilizando una única promesa en vuelo (`refreshPromise`) para que múltiples requests paralelos no disparen refreshes duplicados.
2. Envía `POST /api/auth/refresh` con el `refresh_token`.
3. **Defensa anti-cruce de sesión:** `extractJwtSubject()` decodifica el `sub` del nuevo JWT y comprueba que coincida con el `sub` del token anterior antes de guardarlo.
4. Si el refresh tiene éxito, actualiza `localStorage` y reintenta automáticamente la petición original.
5. Si el refresh falla o vuelve a dar `401`, ejecuta `notifySessionExpired()`, limpia el almacenamiento y emite el evento `gymtrack:session-expired` para que `GymContext` cierre la sesión en la interfaz.

---

## 3. Verificación Criptográfica del Token en el Backend

Cada endpoint protegido depende de `get_current_auth_user` ([dependencies.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/app/core/dependencies.py)), que llama a `verify_supabase_access_token(token)` en [security.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/app/core/security.py). Las validaciones son:

1. **Formato y rechazo de API keys:** descarta cadenas vacías, tokens sin 3 segmentos JWT y claves `sb_secret_*` / `sb_publishable_*` (`401`).
2. **Validación de algoritmo:** lee el header del JWT y rechaza `alg="none"` o algoritmos fuera de `SUPABASE_JWT_ALGORITHMS` (por defecto `ES256,RS256,HS256`).
3. **Resolución de clave y firma criptográfica:**
   - Para algoritmos asimétricos (`ES256`, `RS256`, `EdDSA`), usa `SUPABASE_JWT_PUBLIC_KEY` o descarga y cachea las claves públicas desde `SUPABASE_JWKS_URL` (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`) mediante `PyJWKClient` (TTL 1 hora).
   - Para `HS256`, usa `SUPABASE_JWT_SECRET`.
4. **Verificación de claims obligatorios:** exige `sub`, `exp`, `iat`, `iss`, `aud`, `role`, verificando firma, expiración (`exp`), emisor (`SUPABASE_JWT_ISSUER`) y audiencia (`authenticated`).
5. **Control de rol de sesión Supabase:** exige que `payload["role"] == "authenticated"` y rechaza cualquier token `service_role` o `anon` (`401`).
6. **Validación de `sub` y estado del usuario:** comprueba que `sub` sea un UUID válido y verifica con `is_auth_user_disabled()` que no tenga flags `disabled`/`banned` ni `banned_until` futuro ni `deleted_at` (`403 Forbidden`).

---

## 4. Construcción del Cliente RLS por Request

Una vez validado el JWT, la dependencia `get_user_supabase_client` llama a `create_supabase_client_for_token(access_token)`:
- Crea un cliente de Supabase con `SUPABASE_ANON_KEY` y el header `Authorization: Bearer <access_token>`.
- Rechaza explícitamente si alguien intentara pasar una clave `service_role`.
- De esta forma, **todas las consultas de negocio** ejecutan en PostgreSQL bajo el rol `authenticated` con `auth.uid()` igual al UUID del usuario real, haciendo cumplir las políticas **RLS** de la base de datos.

---

## 5. Manejo de Roles, Contexto Multi-Tenant y Permisos

### 5.1 Jerarquía de roles y tablas de negocio

`resolver_contexto_negocio()` en [dependencies.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/app/core/dependencies.py) consulta en paralelo (usando hilos y clientes aislados cuando es un cliente real de Supabase) los perfiles asociados a `auth_user_id`:

| Rol principal | Tabla raíz | Relación multi-gimnasio / sucursal | Alcance |
| :--- | :--- | :--- | :--- |
| **`dueño`** | `public.dueno` | `public.gimnasio` (`id_dueno`) y sus `public.sucursal` | Control total sobre todos sus gimnasios y sucursales. |
| **`administrador`** | `public.administrador` | `public.administrador_gimnasio` (N:M por gimnasio) | Administración organizacional de los gimnasios donde tiene asignación activa. |
| **`empleado`** | `public.empleado` | `public.empleado_sucursal` (N:M por sucursal con sub-rol) | Operación diaria en las sucursales asignadas. Sub-roles: `administrador`, `recepcionista`, `entrenador`. |
| **`socio`** | `public.socio` | `public.socio_gimnasio` (N:M por gimnasio) | Portal del alumno; acceso aislado a sus propios datos, membresías, pagos, asistencias y rutinas. |

Un mismo `auth_user_id` puede tener **múltiples perfiles** (por ejemplo, ser dueño de un gimnasio y socio en otro) o estar asociado a **múltiples gimnasios/sucursales**.

### 5.2 Matriz de permisos en el sistema

Definida en [dependencies.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/app/core/dependencies.py) (y espejada para la UX en [GymContext.jsx](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/context/GymContext.jsx)):

- **Dueño (`dueño`):** `permisos = ["*"]` (acceso total en sus gimnasios).
- **Administrador Organizacional (`administrador`):** `PERMISOS_ADMINISTRADOR_GIMNASIO`:
  `ver_dashboard`, `gestionar_sucursales`, `gestionar_empleados`, `gestionar_socios`, `gestionar_planes`, `gestionar_membresias`, `gestionar_pagos`, `gestionar_asistencias`, `gestionar_ejercicios`, `gestionar_rutinas`, `ver_empleados`, `ver_sucursales`.
- **Empleado Operativo (`empleado`):** `PERMISOS_OPERATIVOS_EMPLEADO` (restringido a los 6 módulos operativos: Socios, Rutinas, Ejercicios, Pagos, Asistencia y Perfil; sin Dashboard, Planes, Sucursales ni Empleados):
  `ver_socios`, `gestionar_socios`, `gestionar_membresias`, `gestionar_pagos`, `ver_asistencias`, `gestionar_asistencias`, `gestionar_ejercicios`, `gestionar_rutinas`.
- **Socio (`socio`):** `permisos = ["socio_self"]`.

Además, en endpoints sensibles los routers aplican validaciones específicas por sub-rol de empleado o rol organizacional:
- Por ejemplo, en pagos (`pagos.py`), administración de gimnasios/integraciones (`integraciones_pago.py` usa `verify_dueno_or_org_admin_of_gimnasio`), sucursales, empleados, etc., se verifica el sub-rol exacto en la sucursal o gimnasio activo.

### 5.3 Protección Anti-Spoofing y Anti-IDOR

El backend **nunca confía** en el rol ni en el `id_gimnasio` / `id_sucursal` enviado por el frontend sin contrastarlo contra la base de datos:
1. **`X-Active-Role`:** si el cliente solicita un rol que no figura en `perfiles_disponibles` o está inactivo, responde `403 Forbidden`. Si solicita `empleado:<subrol>`, verifica que posea ese sub-rol activo en la sucursal/gimnasio.
2. **`X-Gimnasio-Id` / query / path:** `require_gimnasio_context` y los helpers de cada router comparan el ID solicitado contra `allowed_gym_ids` del perfil activo. Si pertenece a otro gimnasio, responde `403 Forbidden`.
3. **`X-Sucursal-Id`:** `require_sucursal_context` comprueba que la sucursal exista dentro de `allowed_sucursal_ids`, pertenezca al gimnasio activo y, si el usuario es empleado con restricción de sub-rol, que tenga ese sub-rol en esa sucursal específica.
4. **Caché efímera de perfiles (solo `GET`):** para acelerar lecturas consecutivas sin re-consultar los 4 perfiles cada vez, `dependencies.py` mantiene `_PROFILE_RAW_CACHE` (TTL de 8 segundos, indexado por `auth_user_id + hash(access_token)`). En [main.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/main.py), un middleware HTTP invalida la caché automáticamente después de cualquier petición mutadora (`POST`, `PUT`, `PATCH`, `DELETE`), y `/api/auth/me` nunca lee de caché.

### 5.4 Guardas de permisos en el Frontend (`ProtectedRoute.jsx`)

En la capa de UI, [ProtectedRoute.jsx](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/components/ProtectedRoute.jsx) y `RoleAwareRoute` en [App.jsx](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/App.jsx) controlan la navegación:
1. Si no hay token (`!isAuthenticated`), redirige al login correspondiente.
2. Si el usuario tiene múltiples contextos y no confirmó uno (`requiereSeleccionContexto`), redirige a `/seleccionar-gimnasio`.
3. Si `bloquearEmpleado` está activo y el usuario es `empleado`, bloquea rutas administrativas/financieras (como Dashboard, Sucursales, Planes o Empleados) y lo redirige a `/socios-dueño`.
4. Valida `rolRequerido` (`dueño`, `administrador`, `empleado`, `staff`, `socio`) y `permisoRequerido` mediante `hasPermission()`.
5. Si es `dueño` sin gimnasio creado aún, fuerza el onboarding a `/crear-gimnasio-dueño`.

> Esta capa mejora la experiencia de usuario ocultando/redirigiendo vistas no autorizadas, mientras que el **control de seguridad efectivo** se ejecuta en el backend FastAPI y en las políticas RLS / RPCs de PostgreSQL.
