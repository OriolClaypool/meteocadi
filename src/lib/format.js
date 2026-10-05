// Escales de color i formats compartits (servidor i navegador).
// tempColor/windColor/precipColor: les mateixes escales que la web anterior (fons fosc).
// tempColorLight: versions fosques de la mateixa escala per a fons clar (contrast AA).

export function tempColor(t) {
  if (t == null || isNaN(t)) return '#93a3b8';
  if (t < -10) return '#a78bfa';
  if (t < -5) return '#818cf8';
  if (t < 0) return '#60a5fa';
  if (t < 5) return '#38bdf8';
  if (t < 10) return '#2dd4bf';
  if (t < 15) return '#4ade80';
  if (t < 20) return '#a3e635';
  if (t < 25) return '#fbbf24';
  if (t < 30) return '#fb923c';
  if (t < 35) return '#ef4444';
  return '#dc2626';
}

export function tempColorLight(t) {
  if (t == null || isNaN(t)) return '#5b6b7e';
  if (t < -5) return '#6d28d9';
  if (t < 0) return '#1d4ed8';
  if (t < 5) return '#0369a1';
  if (t < 10) return '#0f766e';
  if (t < 15) return '#15803d';
  if (t < 20) return '#4d7c0f';
  if (t < 25) return '#b45309';
  if (t < 30) return '#c2410c';
  if (t < 35) return '#b91c1c';
  return '#991b1b';
}

export function windColor(w) {
  if (w == null || isNaN(w)) return '#93a3b8';
  if (w < 10) return '#93a3b8';
  if (w < 20) return '#38bdf8';
  if (w < 30) return '#2dd4bf';
  if (w < 40) return '#a3e635';
  if (w < 55) return '#fbbf24';
  if (w < 70) return '#fb923c';
  if (w < 90) return '#ef4444';
  return '#dc2626';
}

export function precipColor(p) {
  if (p == null || isNaN(p) || p <= 0) return '#74879f';
  if (p < 1) return '#7dd3fc';
  if (p < 5) return '#38bdf8';
  if (p < 10) return '#2dd4bf';
  if (p < 15) return '#4ade80';
  if (p < 30) return '#fbbf24';
  if (p < 50) return '#fb923c';
  if (p < 80) return '#ef4444';
  return '#f472b6';
}

// 12,3 (coma decimal, signe menys tipogràfic)
export function num(v, dec = 1) {
  if (v == null || isNaN(v)) return '—';
  const s = Math.abs(Number(v)).toFixed(dec).replace('.', ',');
  return Number(v) < 0 && Number(s.replace(',', '.')) !== 0 ? `−${s}` : s;
}

export function temp(v, dec = 1) {
  return v == null || isNaN(v) ? '—' : `${num(v, dec)}°`;
}

const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
export function dirLabel(deg) {
  if (deg == null || isNaN(deg)) return '';
  return DIRS[Math.round(deg / 22.5) % 16];
}

const DIES = ['diumenge', 'dilluns', 'dimarts', 'dimecres', 'dijous', 'divendres', 'dissabte'];
const DIES_CURTS = ['dg', 'dl', 'dt', 'dc', 'dj', 'dv', 'ds'];
const MESOS = ['gener', 'febrer', 'març', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
const MESOS_CURTS = ['gen', 'febr', 'març', 'abr', 'maig', 'juny', 'jul', 'ag', 'set', 'oct', 'nov', 'des'];
// Castellà (pàgines /es/)
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "2026-09-25" → Date a migdia UTC (evita salts de zona horària)
export function parseDay(iso) {
  return new Date(`${iso}T12:00:00Z`);
}

export function dayName(iso, lang = 'ca') {
  return (lang === 'es' ? DIAS : DIES)[parseDay(iso).getUTCDay()];
}
export function dayShort(iso, lang = 'ca') {
  return (lang === 'es' ? DIAS_CORTOS : DIES_CURTS)[parseDay(iso).getUTCDay()];
}
export function monthName(m, lang = 'ca') {
  return (lang === 'es' ? MESES : MESOS)[m - 1];
}

// "de setembre" / "d'octubre"
export function deMonth(m) {
  const n = MESOS[m - 1];
  return /^[aeiouàèéíòóú]/i.test(n) ? `d'${n}` : `de ${n}`;
}

// "25 de setembre" / "3 d'octubre" (castellà: "25 de septiembre")
export function dayMonth(iso, lang = 'ca') {
  const d = parseDay(iso);
  return lang === 'es' ? `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}` : `${d.getUTCDate()} ${deMonth(d.getUTCMonth() + 1)}`;
}

export function dayMonthShort(iso) {
  const d = parseDay(iso);
  return `${d.getUTCDate()} ${MESOS_CURTS[d.getUTCMonth()]}`;
}

// "25 de setembre de 2025" / "25 de septiembre de 2025" (rècords de diversos anys)
export function fullDate(iso, lang = 'ca') {
  return `${dayMonth(iso, lang)} de ${iso.slice(0, 4)}`;
}

// "divendres 25 de setembre" / "viernes 25 de septiembre"
export function longDate(iso, lang = 'ca') {
  return `${dayName(iso, lang)} ${dayMonth(iso, lang)}`;
}

export function cap(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

// Data d'avui a Europe/Madrid com a "YYYY-MM-DD"
export function todayMadrid(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function hourMadrid(d = new Date()) {
  return new Intl.DateTimeFormat('ca-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit' }).format(d);
}

// "des del 20 de setembre" / "des de l'1 d'octubre" (castellà: "desde el 20 de septiembre")
export function desDe(iso, lang = 'ca') {
  if (lang === 'es') return `desde el ${dayMonth(iso, 'es')}`;
  const n = parseDay(iso).getUTCDate();
  return n === 1 || n === 11 ? `des de l'${dayMonth(iso)}` : `des del ${dayMonth(iso)}`;
}
