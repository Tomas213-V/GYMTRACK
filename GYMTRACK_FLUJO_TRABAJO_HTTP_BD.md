# GYMTRACK — Flujo de Trabajo de la Aplicación (Frontend → HTTP → Backend → Base de Datos)

Este documento describe paso a paso cómo viaja una operación desde la interfaz en React hasta PostgreSQL (Supabase) y regresa al navegador, utilizando ejemplos reales extraídos del código actual de GymTrack.

---

## 1. Visión General de Capas

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario (Navegador)
    participant UI as React Page / Modal
    participant Svc as Service (frontend/src/services)
    participant API as apiClient.js (fetch + headers)
    participant BE as FastAPI Router + Dependencies
    participant DB as Supabase PostgREST / PostgreSQL (RLS + RPC)

    U->>UI: Interactúa (clic / submit formulario)
    UI->>Svc: Llama función del servicio (ej. createSocio)
    Svc->>API: apiRequest(path, { method, body })
    API->>BE: HTTP Request + Bearer JWT + X-Gimnasio-Id + X-Active-Role
    BE->>BE: verify_supabase_access_token() + resolver_contexto_negocio()
    BE->>BE: Valida schema Pydantic + permisos de rol/gimnasio
    BE->>DB: Consulta/RPC con cliente acotado al JWT (auth.uid())
    DB->>DB: Evalúa políticas RLS / ejecuta RPC transaccional
    DB-->>BE: Filas o JSONB resultante
    BE-->>API: Respuesta HTTP (JSON 200/201 o error 4xx/5xx)
    API-->>Svc: Devuelve JSON o lanza Error normalizado
    Svc-->>UI: Actualiza estado React y renderiza respuesta
```

---

## 2. Ejemplo 1 (Escritura Transaccional): Alta o Incorporación de un Socio

Veamos el flujo completo cuando un Dueño, Administrador o Recepcionista registra o incorpora un socio desde el modal **Registrar o Incorporar Socio** (`POST /api/socios`).

### Paso 1: Interfaz de usuario (`modal.jsx`)
En [frontend/src/components/socios-dueno/socio-modal/modal.jsx](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/components/socios-dueno/socio-modal/modal.jsx), al enviar el formulario (`handleSubmit`), la UI:
1. Ejecuta una verificación previa de identidad (`consultarIdentidad`) por DNI/email contra `POST /api/auth/identidades/verificar` para detectar si la persona ya existe en GymTrack o ya está asociada al gimnasio.
2. Arma el payload y llama a `createSocio(...)` importado desde [socioService.js](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/services/socioService.js).

### Paso 2: Capa de Servicio y Cliente HTTP (`socioService.js` + `apiClient.js`)
En [socioService.js](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/services/socioService.js):
```js
export async function createSocio(socioData) {
  const payload = { ... };
  return apiRequest('/socios', {
    method: 'POST',
    body: payload
  });
}
```
Luego `apiRequest()` en [apiClient.js](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/services/apiClient.js):
1. Construye la URL final: `${API_URL}/socios` (por defecto `http://127.0.0.1:3000/api/socios`).
2. Lee de `localStorage` la sesión y contexto activo mediante `buildAuthHeaders()`, enviando:
   ```http
   POST /api/socios HTTP/1.1
   Host: 127.0.0.1:3000
   Content-Type: application/json
   Authorization: Bearer eyJhbGciOiJFUzI1NiIs...
   X-Gimnasio-Id: 12
   X-Active-Role: dueno
   ```
   ```json
   {
     "id_gimnasio": 12,
     "nombre": "Juan",
     "apellido": "Pérez",
     "dni": "39123456",
     "telefono": "11 2345 6789",
     "email": "juan@email.com",
     "contrasena_inicial": "secreta123"
   }
   ```

### Paso 3: Recepción, Validación y Seguridad en FastAPI (`main.py`, `dependencies.py`, `socios.py`)
Cuando la petición llega al servidor Python ([main.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/main.py)):
1. **Validación de esquema Pydantic:** FastAPI valida el JSON con el modelo `SocioCreate`. Si falta un campo obligatorio o viene un campo no permitido, el `validation_exception_handler` responde automáticamente `422`.
2. **Autenticación y contexto (`Depends(get_current_user)`):**
   - `get_current_auth_user` valida criptográficamente el JWT en [security.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/app/core/security.py).
   - `get_user_supabase_client` crea un cliente `supabase-py` configurado con ese `Bearer <token>`.
   - `resolver_contexto_negocio` verifica en la base de datos que ese `auth_user_id` sea efectivamente dueño/staff del gimnasio `12`.
3. **Autorización y reglas de negocio en `create_socio`** ([socios.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/app/routers/socios.py)):
   - Rechaza con `403` si el cliente intentó enviar `auth_user_id` manualmente.
   - `_verify_staff_can_manage_socios(current_user, id_gimnasio=req.id_gimnasio)` verifica rol activo y evita cruce de gimnasios.
   - Comprueba que no exista ya una asociación activa por DNI o email en el gimnasio (`409 Conflict` si ya está asociado).
   - Valida política de contraseña inicial (`validate_initial_password_policy`) y detección de identidad (`detectar_identidad_para_incorporacion`).

### Paso 4: Ejecución en Base de Datos (Supabase PostgREST → PostgreSQL RPC)
El backend invoca la función almacenada en PostgreSQL usando el cliente autenticado del usuario (`db`):
```python
res_rpc = db.rpc("rpc_registrar_socio_gimnasio", rpc_params).execute()
```
En PostgreSQL ([01_instalacion_definitiva.sql](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/supabase/01_instalacion_definitiva.sql)):
1. `rpc_registrar_socio_gimnasio` obtiene `v_uid := auth.uid()` desde el JWT propagado por PostgREST.
2. Verifica en SQL que `v_uid` sea dueño (`public.dueno`), administrador organizacional (`public.administrador_gimnasio`) o empleado (`administrador`/`recepcionista` en `public.empleado_sucursal`) del gimnasio `p_id_gimnasio`.
3. Busca en `public.socio` por `dni` y `email`:
   - Si no existe, inserta una única identidad global en `public.socio`.
   - Si ya existe en otro gimnasio, reutiliza su `id_socio` sin duplicarlo.
   - Si DNI y email apuntan a personas distintas, lanza una excepción SQL de conflicto.
4. Crea la asociación en `public.socio_gimnasio` y retorna un objeto `jsonb` con `creado`, `socio` y `socio_gimnasio`.
5. De vuelta en Python, si `creado == True` y se envió `contrasena_inicial`, `aprovisionar_o_vincular_cuenta_auth()` crea la cuenta en Supabase Auth y la vincula al socio.

### Paso 5: Respuesta HTTP y Actualización de la UI
1. Al finalizar la petición `POST`, el middleware global `invalidate_profile_cache_on_mutation` en [main.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/main.py) limpia la caché efímera de perfiles.
2. FastAPI responde `201 Created` con el JSON del socio creado/asociado.
3. `apiClient.js` parsea la respuesta; `modal.jsx` ejecuta `onSuccess()`, lo que dispara `loadSocios()` en [content.jsx](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/components/socios-dueno/socio-content/content.jsx) para refrescar la grilla paginada.

---

## 3. Ejemplo 2 (Lectura con RLS y Paralelismo): Listado Paginado de Socios

Cuando el usuario abre la pantalla de Socios, [content.jsx](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/components/socios-dueno/socio-content/content.jsx) ejecuta `fetchSocios({ page: 1, limit: 6, estado: 'todos', search: '', id_gimnasio })`:

1. **Petición HTTP:**
   `GET /api/socios?page=1&limit=6&id_gimnasio=12` con `Authorization: Bearer <token>` y `X-Gimnasio-Id: 12`.
2. **Backend (`get_socios` en [socios.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/app/routers/socios.py)):**
   - Como es un `GET` distinto de `/auth/me`, `get_current_user` puede reutilizar la caché efímera de perfil (`_PROFILE_RAW_CACHE`, TTL 8s) si el mismo token realizó una consulta reciente.
   - `_verify_staff_can_view_socios` confirma permiso de lectura sobre `id_gimnasio=12`.
   - `run_db_parallel` consulta `public.socio_gimnasio` (join con `socio` y `gimnasio`) en un hilo dedicado (`asyncio.to_thread`) para no bloquear el event loop de FastAPI.
   - Filtra por estado y término de búsqueda, pagina los resultados y consulta en paralelo las membresías (`public.membresia_socio`) solo de los `id_socio_gimnasio` de esa página.
3. **Base de datos (RLS):**
   - PostgreSQL evalúa las políticas RLS de `socio_gimnasio`, `socio` y `membresia_socio` usando `auth.uid()`, garantizando que incluso si hubiera algún error en filtros de aplicación, el motor jamás devolvería filas de otro gimnasio.
4. **Respuesta al Frontend:**
   - Devuelve `{ id_gimnasio, total, page, totalPages, limit, socios, asociaciones }` con estado `200 OK`, y React actualiza `socios`, `totalPages` y `totalSocios`.

---

## 4. Manejo Unificado de Errores en el Flujo

Si ocurre cualquier fallo en cualquiera de las capas:
- **Error de validación Pydantic (`422`):** `validation_exception_handler` normaliza `{ detail: [...], error: "..." }`.
- **Error de PostgreSQL / PostgREST (`APIError`):** `postgrest_api_error_handler` y `map_postgrest_error` traducen códigos SQL (`23505` duplicado → `409`, `42501` RLS/permiso → `403`, `23503` FK → `400/409`, `P0001` excepción de negocio en RPC → `400/403/409`) a JSON `{ detail, error, code }`.
- **Token vencido (`401`):** `apiClient.js` intenta `POST /api/auth/refresh` una vez; si falla, limpia sesión y redirige al login.
- **Error HTTP en UI:** `extractApiErrorMessage()` en `apiClient.js` extrae `data.error` o `data.detail` para mostrar un mensaje claro en pantalla.
