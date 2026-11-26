# GYMTRACK — Justificación de Herramientas, Stack y Librerías

Este documento describe y justifica la elección tecnológica de **GymTrack** tanto en su **Frontend** ([frontend/package.json](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/package.json)) como en su **Backend en Python** ([gymtrack-backend-python/requirements.txt](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/requirements.txt)), así como su capa de datos sobre **Supabase / PostgreSQL**.

> **Nota arquitectónica sobre el repositorio:** En `GYMTRACK/backend` existe una implementación previa en Node.js/Express que quedó como referencia de compatibilidad, mientras que el backend activo consumido por el frontend es el proyecto hermano **`gymtrack-backend-python`** (Python + FastAPI), tal como se documenta en [GYMTRACK_INFORME_COMPATIBILIDAD_BACKEND.md](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/GYMTRACK_INFORME_COMPATIBILIDAD_BACKEND.md) y en [frontend/src/services/apiClient.js](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/services/apiClient.js).

---

## 1. Arquitectura General del Stack

```
[ React 19 + Vite (SPA) ]
          │  HTTP/REST (fetch + JWT Bearer + headers de contexto)
          ▼
[ FastAPI + Uvicorn (Python) ]
          │  supabase-py + httpx (con JWT del usuario o service_role aislado)
          ▼
[ Supabase (Auth + PostgREST + PostgreSQL con RLS y RPCs PL/pgSQL) ]
```

La separación en tres capas responde a tres objetivos principales:
1. **Desacoplamiento:** el frontend se enfoca en la experiencia multi-rol y multi-gimnasio sin contener lógica sensible ni secretos.
2. **Seguridad en profundidad:** FastAPI valida contratos, tokens y permisos de negocio, y PostgreSQL vuelve a validar identidad y pertenencia mediante **Row Level Security (RLS)** y funciones **RPC** (`SECURITY DEFINER` / `SECURITY INVOKER`).
3. **Productividad y mantenibilidad:** tipado estático con Pydantic en Python y componentes modulares en React.

---

## 2. Frontend (`frontend/package.json`)

### 2.1 Núcleo de Interfaz y Construcción

| Herramienta / Librería | Versión (`package.json`) | Justificación técnica en GymTrack |
| :--- | :--- | :--- |
| **React (`react`, `react-dom`)** | `^19.2.8` | Permite construir una SPA modular orientada a componentes reutilizables por rol (Dueño, Administrador, Empleado, Socio) y gestionar el estado global de sesión y gimnasio activo mediante Context API (`GymContext` en [GymContext.jsx](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/context/GymContext.jsx)). |
| **Vite (`vite`, `@vitejs/plugin-react`)** | `^8.2.2` / `^6.1.0` | Bundler moderno basado en ES Modules nativos (`"type": "module"`). Ofrece arranque instantáneo y *Hot Module Replacement* (HMR) rápido durante el desarrollo, además de *builds* optimizados para producción en `frontend/dist`. |
| **React Router (`react-router-dom`)** | `^7.18.3` | Gestiona el enrutamiento declarativo de las tres áreas de la app (Landing pública, Panel de Staff y Portal del Socio) en [App.jsx](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/App.jsx) y habilita el componente guarda [ProtectedRoute.jsx](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/components/ProtectedRoute.jsx). |

### 2.2 Comunicación, Datos y Visualización

| Herramienta / Librería | Versión (`package.json`) | Justificación técnica en GymTrack |
| :--- | :--- | :--- |
| **`fetch` nativo (en `apiClient.js`)** | Nativo del navegador | Todas las llamadas REST al backend se centralizan en `apiRequest()` dentro de [apiClient.js](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/services/apiClient.js), evitando dependencias extras en tiempo de ejecución para inyectar cabeceras (`Authorization`, `X-Gimnasio-Id`, `X-Sucursal-Id`, `X-Active-Role`), reintentar lecturas `GET` ante fallos transitorios (`502`/`503`/`504`) y ejecutar el refresh automático de sesión ante `401`. |
| **`@supabase/supabase-js`** | `^2.109.0` | Cliente oficial de Supabase en navegador ([supabaseClient.js](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/lib/supabaseClient.js)), inicializado **exclusivamente** con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` para soporte de sesión pública sin exponer jamás claves privilegiadas. |
| **Recharts (`recharts`)** | `^3.10.1` | Librería de gráficos componible para React basada en SVG, elegida para representar métricas de ingresos, asistencias y actividad en los dashboards administrativos sin manipular el DOM manualmente. |
| **React Icons (`react-icons`)** | `^5.7.0` | Provee iconografía consistente (FontAwesome, etc.) importada bajo demanda mediante *tree-shaking* en páginas, sidebars y modales. |

### 2.3 Calidad de Código y Dependencias Declaradas no Usadas Directamente

| Herramienta / Librería | Versión (`package.json`) | Estado / Justificación |
| :--- | :--- | :--- |
| **ESLint (`eslint`, `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`)** | `^10.9.0` | Asegura buenas prácticas en hooks de React, compatibilidad con Fast Refresh y detección temprana de errores estáticos (`npm run lint`). |
| **`@types/react`, `@types/react-dom`** | `^19.2.18` / `^19.2.4` | Mejoran el autocompletado y análisis de tipos en el editor (IDE) aunque el código fuente esté escrito en `.jsx`. |
| **`axios`, `sonner`** | `^1.20.0` / `^2.0.8` | Figuran en `dependencies` de [package.json](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/package.json), aunque en el código actual de `frontend/src` el cliente HTTP utiliza `fetch` nativo ([apiClient.js](file:///c:/Users/lutra/OneDrive/Documentos/GitHub/GYMTRACK/frontend/src/services/apiClient.js)) y los avisos de interfaz se muestran con banners/estados propios de cada componente. |

---

## 3. Backend en Python (`gymtrack-backend-python/requirements.txt`)

### 3.1 Framework Web y Servidor ASGI

| Librería | Versión (`requirements.txt`) | Justificación técnica en GymTrack |
| :--- | :--- | :--- |
| **FastAPI (`fastapi`)** | `>=0.110.0` | Elegido por su arquitectura ASGI asíncrona, su sistema declarativo de inyección de dependencias (`Depends`) —clave para encadenar verificación JWT, cliente RLS y permisos en [dependencies.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/app/core/dependencies.py)—, manejo global de excepciones (`APIError`, `RequestValidationError`, `StarletteHTTPException` en [main.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/main.py)) y generación automática de documentación interactiva (`/docs` y `/redoc`). |
| **Uvicorn (`uvicorn`)** | `>=0.28.0` | Servidor ASGI ligero y de alto rendimiento que ejecuta la aplicación FastAPI en desarrollo (con `reload=True`) y producción. |
| **Watchfiles (`watchfiles`)** | `>=0.20.0` | Detector de cambios de archivos escrito en Rust utilizado por Uvicorn para recarga automática rápida durante el desarrollo. |
| **Httptools (`httptools`)** | `>=0.6.0` | Parser HTTP de alto rendimiento basado en C (`llhttp`) que acelera la lectura de peticiones en Uvicorn frente a parsers puros de Python. |

### 3.2 Validación de Contratos y Configuración

| Librería | Versión (`requirements.txt`) | Justificación técnica en GymTrack |
| :--- | :--- | :--- |
| **Pydantic (`pydantic`)** | `>=2.6.0` | Valida estrictamente todos los payloads de entrada en `app/models/*.py`. Con `ConfigDict(extra="forbid")` rechaza campos inesperados o protegidos (como intentos de inyectar `auth_user_id` o alterar precios), devolviendo errores HTTP `422` estructurados. |
| **Pydantic Settings (`pydantic-settings`)** | `>=2.2.0` | Complementa el ecosistema Pydantic para validación tipada de configuraciones y variables de entorno. |
| **Email Validator (`email-validator`)** | `>=2.0.0` | Requerido por `EmailStr` de Pydantic para validar sintaxis de correos electrónicos en registros, altas de socios/empleados y actualizaciones de perfil. |
| **Python Dotenv (`python-dotenv`)** | `>=1.0.1` | Carga las variables privadas desde `.env` al inicializar [app/config.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/app/config.py) (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, credenciales de Mercado Pago, etc.). |
| **Python Multipart (`python-multipart`)** | `>=0.0.9` | Habilita el parseo de `form-data` en FastAPI cuando un endpoint requiere formularios o carga de archivos. |

### 3.3 Integración con Base de Datos y Servicios Externos

| Librería | Versión (`requirements.txt`) | Justificación técnica en GymTrack |
| :--- | :--- | :--- |
| **Supabase (`supabase`)** | `>=2.3.0` | SDK oficial `supabase-py` para interactuar con Supabase Auth (`/auth/v1`), PostgREST (tablas y vistas) y funciones RPC de PostgreSQL. Permite instanciar clientes acotados al JWT del usuario (`create_supabase_client_for_token`) para que PostgreSQL aplique RLS en cada consulta. |
| **HTTPX (`httpx`)** | `>=0.27.0` | Cumple un rol doble en [app/config.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/app/config.py) y servicios externos:<br>1. Provee un **pool compartido de conexiones TCP/TLS** (`httpx.Limits(max_connections=100, max_keepalive_connections=30, keepalive_expiry=60.0)`) reutilizado por `supabase-py` para evitar handshakes TLS repetidos.<br>2. Ejecuta peticiones **asíncronas** (`httpx.AsyncClient`) hacia Supabase Auth (`PUT /auth/v1/user`), Mercado Pago (`/oauth/token`, `/checkout/preferences`) y Ualá Bis. |

### 3.4 Seguridad, Criptografía y Tokens

| Librería | Versión (`requirements.txt`) | Justificación técnica en GymTrack |
| :--- | :--- | :--- |
| **PyJWT (`pyjwt`)** | `>=2.8.0` | Verifica criptográficamente en [app/core/security.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/app/core/security.py) los JWT emitidos por Supabase Auth. Usa `PyJWKClient` (con caché de claves públicas de 1 hora) para algoritmos asimétricos (`ES256`, `RS256`, `EdDSA`) vía JWKS y soporta `HS256` cuando corresponde, validando firma, expiración, `issuer`, `audience` y `role`. También inspecciona tokens en [app/config.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/app/config.py) para impedir que una clave `service_role` se configure por error como clave pública. |
| **Cryptography (`cryptography`)** | `>=42.0.0` | Provee primitivas criptográficas de bajo nivel usadas por PyJWT (curvas elípticas / RSA) y, fundamentalmente, **Fernet** (`AES-128-CBC` + `HMAC-SHA256`) en [app/services/mercadopago_oauth.py](file:///C:/Users/lutra/OneDrive/Documentos/GitHub/gymtrack-backend-python/app/services/mercadopago_oauth.py) para cifrar en reposo los `access_token` y `refresh_token` OAuth de Mercado Pago antes de almacenarlos en `public.integracion_pago_gimnasio`. |
| **Bcrypt (`bcrypt`)** | `>=4.1.2` | Declarada en `requirements.txt` como librería estándar de hashing de contraseñas. En la arquitectura actual de GymTrack las contraseñas no se almacenan ni hashean en tablas propias: se delegan íntegramente a **Supabase Auth** (`auth.users`). |

---

## 4. Base de Datos y Autenticación (Supabase / PostgreSQL)

Aunque no es una librería dentro de `package.json` ni `requirements.txt`, **Supabase** actúa como plataforma de datos y autenticación:
- **Supabase Auth:** gestiona usuarios, hashing de contraseñas, verificación de correo y emisión de `access_token` (JWT) + `refresh_token`.
- **PostgreSQL + RLS:** aísla los datos por gimnasio (`id_gimnasio`), sucursal (`id_sucursal`) e identidad (`auth.uid()`), bloqueando el acceso directo del rol `anon`.
- **RPCs (`PL/pgSQL`):** encapsulan operaciones críticas y atómicas (ej. `rpc_registrar_socio_gimnasio`, `rpc_contratar_membresia`, `rpc_registrar_pago`, `rpc_registrar_ingreso_asistencia`) garantizando consistencia transaccional y reglas de negocio en la base de datos.
