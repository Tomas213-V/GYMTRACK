const API_URL = 'http://localhost:3000/api'

// =========================================================
// REGISTRO
// =========================================================

export async function register(userData) {

  const response = await fetch(
    `${API_URL}/auth/register`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(userData),
    }
  )

  const data = await response.json()

  if (!response.ok) {

    throw new Error(
      data.error || 'No se pudo completar el registro.'
    )

  }

  return data
}

// =========================================================
// LOGIN
// =========================================================

export async function login(userData) {

  const response = await fetch(
    `${API_URL}/auth/login`,
    {
      method: 'POST',

      headers: {
        'Content-Type': 'application/json',
      },

      body: JSON.stringify(userData),
    }
  )

  const data = await response.json()

  if (!response.ok) {

    throw new Error(
      data.error || 'No se pudo iniciar sesión.'
    )

  }

  return data
}

// =========================================================
// COMPROBAR AUTENTICACIÓN
// =========================================================

export function isAuthenticated() {

  return localStorage.getItem('token') !== null

}