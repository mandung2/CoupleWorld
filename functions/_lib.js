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

// Stable key for a couple pair regardless of which side calls in — used to
// share world-map visited-region data between both linked partners.
export function coupleKey(idA, idB) {
  return [idA, idB].sort().join('::');
}

// ---- 이미지 (R2) -----------------------------------------------------------
// 사진 파일은 R2(PHOTOS 바인딩)에 저장하고 D1에는 이미지 URL 문자열만 넣습니다.
// 화면은 지금처럼 data:image/... 로 보내고, 서버가 R2에 올린 뒤 URL로 바꿔 저장합니다.
// 파일 이름은 추측할 수 없는 무작위 UUID라 URL을 아는 사람만 볼 수 있습니다.
const IMG_PATH = '/api/img/';
const IMG_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

// data URL → R2 저장 → 절대 URL 반환 (관리자 사이트처럼 다른 도메인에서도 열리도록)
export async function saveImage(env, request, dataUrl, folder) {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/s.exec(dataUrl || '');
  if (!m) return null;
  const mime = m[1] === 'image/jpg' ? 'image/jpeg' : m[1];
  const ext = IMG_EXT[mime];
  if (!ext) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const key = `${folder}/${crypto.randomUUID()}.${ext}`;
  await env.PHOTOS.put(key, bytes, { httpMetadata: { contentType: mime } });
  return new URL(request.url).origin + IMG_PATH + key;
}

// 우리 R2 이미지 URL이면 삭제 (예전 data URL 등 다른 값은 무시)
export async function deleteImage(env, url) {
  const i = typeof url === 'string' ? url.indexOf(IMG_PATH) : -1;
  if (i < 0 || url.startsWith('data:')) return;
  try {
    await env.PHOTOS.delete(decodeURIComponent(url.slice(i + IMG_PATH.length)));
  } catch (e) {
    // 파일 삭제 실패는 사용자 동작을 막지 않음
  }
}
