/**
 * Utilidades para manejo consistente de fechas y horas en la zona horaria de Argentina (GMT-3).
 *
 * El backend / Supabase almacena los timestamps en UTC (y en columnas `timestamp` sin zona horaria,
 * Postgres los devuelve sin la 'Z' final). Sin la 'Z', JavaScript interpreta la cadena como hora local,
 * provocando un desfase de +3 horas en Argentina.
 */

export const TIMEZONE_ARGENTINA = 'America/Argentina/Buenos_Aires';

/**
 * Parsea una fecha o timestamp garantizando que las cadenas ISO sin sufijo de zona horaria
 * se interpreten como UTC.
 */
export function parseFechaUTC(fecha) {
  if (!fecha) return new Date();
  if (fecha instanceof Date) return fecha;

  const str = String(fecha).trim();

  // Si es solo fecha (YYYY-MM-DD), interpretar como inicio del día en Argentina (-03:00)
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return new Date(`${str}T00:00:00-03:00`);
  }

  const normalized = str.includes(' ') && !str.includes('T') ? str.replace(' ', 'T') : str;
  const tieneZona = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);

  return new Date(tieneZona ? normalized : `${normalized}Z`);
}

/**
 * Devuelve la fecha en formato YYYY-MM-DD correspondiente a Argentina (GMT-3).
 */
export function getFechaArgentinaISO(fecha = new Date()) {
  const d = parseFechaUTC(fecha);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_ARGENTINA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

/**
 * Formatea una fecha a texto legible en español de Argentina.
 */
export function formatFechaArgentina(
  fecha,
  options = { day: '2-digit', month: '2-digit', year: 'numeric' }
) {
  const d = parseFechaUTC(fecha);
  if (isNaN(d.getTime())) return String(fecha || '');
  return d.toLocaleDateString('es-AR', {
    timeZone: TIMEZONE_ARGENTINA,
    ...options
  });
}

/**
 * Formatea una hora en formato HH:MM (24hs) de Argentina.
 */
export function formatHoraArgentina(
  fecha,
  options = { hour: '2-digit', minute: '2-digit', hour12: false }
) {
  const d = parseFechaUTC(fecha);
  if (isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('es-AR', {
    timeZone: TIMEZONE_ARGENTINA,
    ...options
  });
}
