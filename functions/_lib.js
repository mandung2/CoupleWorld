export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(salt + ':' + password));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function randomHex(len) {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

export async function readJson(request) {
  try { return await request.json(); } catch (e) { return {}; }
}

const PW_SPECIALS = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
export function validPassword(pw) {
  const s = String(pw || '');
  if (s.length < 8 || s.length > 16) return false;
  let specials = 0;
  for (const ch of s) {
    if (/[A-Za-z0-9]/.test(ch)) continue;
    if (PW_SPECIALS.indexOf(ch) === -1) return false;
    specials++;
  }
  return specials >= 2;
}

export function validDate(s) {
  const p = String(s || '').split('.').map(x => parseInt(x, 10));
  return p.length === 3 && p.every(n => !isNaN(n));
}
