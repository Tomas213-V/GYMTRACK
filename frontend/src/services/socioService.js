const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

export async function fetchSocios({ page = 1, limit = 6, estado = '', search = '' }) {
  const params = new URLSearchParams();
  if (page) params.append('page', page);
  if (limit) params.append('limit', limit);
  if (estado && estado !== 'todos') params.append('estado', estado);
  if (search) params.append('search', search);

  const response = await fetch(`${API_URL}/socios?${params.toString()}`, {
    headers: getHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al obtener socios.');
  return data;
}

export async function createSocio(socioData) {
  const response = await fetch(`${API_URL}/socios`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(socioData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al crear socio.');
  return data;
}

export async function getSocioById(id) {
  const response = await fetch(`${API_URL}/socios/${id}`, {
    headers: getHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al obtener socio.');
  return data.socio;
}

export async function updateSocio(id, socioData) {
  const response = await fetch(`${API_URL}/socios/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(socioData)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al actualizar socio.');
  return data;
}

export async function deleteSocio(id) {
  const response = await fetch(`${API_URL}/socios/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al eliminar socio.');
  return data;
}

export async function changeEstadoSocio(id, estado) {
  const response = await fetch(`${API_URL}/socios/${id}/estado`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify({ estado })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Error al cambiar estado del socio.');
  return data;
}