const API_URL = 'http://localhost:3000/api'

export async function register(userData) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',

    headers: {
      'Content-Type': 'application/json',
    },

    body: JSON.stringify(userData),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(
      data.error || 'No se pudo completar el registro.'
    )
  }

  return data
}
export function isAuthenticated() {
  return localStorage.getItem('token') !== null
}