// ==============================================================================
// CONFIGURACIÓN DE CLIENTES SUPABASE (BACKEND - GYMTRACK)
// ==============================================================================
// Arquitectura de seguridad:
// 1. supabaseAnon: cliente público con ANON KEY para operaciones de Auth
//    (signInWithPassword, signUp, getUser, refreshSession).
// 2. createSupabaseClientForToken(accessToken): cliente por petición autenticado
//    con el JWT de Supabase Auth del usuario. Todas las consultas de negocio
//    ejecutan con este cliente para respetar estrictamente las políticas RLS.
// 3. supabaseAdmin: cliente privilegiado con SUPABASE_SERVICE_ROLE_KEY
//    EXCLUSIVAMENTE en el backend para tareas administrativas de Auth
//    (invitar/crear usuarios de empleados/socios) y webhooks verificados.
//    NUNCA exponer SUPABASE_SERVICE_ROLE_KEY al frontend.
// ==============================================================================

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Compatibilidad con Node.js 20.x donde globalThis.WebSocket puede no estar disponible
if (typeof globalThis.WebSocket === 'undefined') {
  try {
    globalThis.WebSocket = require('ws');
  } catch {
    // Si ws no está disponible, usar runtime nativo (Node 22+)
  }
}

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ Error: Faltan variables de entorno de Supabase (SUPABASE_URL y SUPABASE_ANON_KEY en backend/.env).'
  );
}

const commonAuthOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
};

const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, commonAuthOptions);

const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, commonAuthOptions)
  : null;

/**
 * Crea un cliente Supabase acotado a la sesión del usuario autenticado (JWT de Supabase Auth).
 * Permite que PostgreSQL aplique RLS en todas las consultas y RPCs SECURITY INVOKER.
 */
function createSupabaseClientForToken(accessToken) {
  if (!accessToken) {
    throw new Error('Se requiere un access token de Supabase Auth para crear el cliente de sesión.');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    ...commonAuthOptions,
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

function hasServiceRole() {
  return Boolean(supabaseAdmin);
}

// Exportamos supabaseAnon como exportación base por compatibilidad y las funciones/clientes nombrados
supabaseAnon.supabaseAnon = supabaseAnon;
supabaseAnon.supabaseAdmin = supabaseAdmin;
supabaseAnon.createSupabaseClientForToken = createSupabaseClientForToken;
supabaseAnon.hasServiceRole = hasServiceRole;
supabaseAnon.supabaseUrl = supabaseUrl;

module.exports = supabaseAnon;
