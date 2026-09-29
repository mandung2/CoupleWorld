// 예전 방식(SHA-256 한 번) — 기존 계정 확인용으로만 남겨둡니다.
export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(salt + ':' + password));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// 새 방식: PBKDF2-SHA256 (Workers 최대 반복 횟수 100,000).
// 저장 형식은 "pbkdf2$반복횟수$salt$hash", 예전 형식은 "salt$hash".
const PBKDF2_ITER = 100000;

async function pbkdf2(password, salt, iter) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: iter }, key, 256
  );
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function makePasswordHash(password) {
  const salt = randomHex(16);
  return `pbkdf2$${PBKDF2_ITER}$${salt}$${await pbkdf2(password, salt, PBKDF2_ITER)}`;
}

// { ok, legacy } — legacy가 true면 로그인 성공 후 새 방식으로 다시 저장합니다.
export async function checkPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts[0] === 'pbkdf2' && parts.length === 4) {
    return { ok: (await pbkdf2(password, parts[2], parseInt(parts[1], 10))) === parts[3], legacy: false };
  }
  if (parts.length === 2) return { ok: (await hashPassword(password, parts[0])) === parts[1], legacy: true };
  return { ok: false, legacy: false };
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

// 영문·숫자·밑줄 3~20자
export function validId(id) {
  return /^[A-Za-z0-9_]{3,20}$/.test(String(id || ''));
}

// 글 길이 제한 — 초과하면 안내 문구, 괜찮으면 null
export const LIMITS = { date: 20, place: 50, title: 50, body: 2000 };
export function tooLong(fields) {
  for (const [key, value] of Object.entries(fields)) {
    if (String(value || '').length > LIMITS[key]) return `[시스템] 글자 수가 너무 많아요. (최대 ${LIMITS[key]}자)`;
  }
  return null;
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

// ---- 기록 사진 (최대 5장) ---------------------------------------------------
// memories.photos 에 사진 URL 배열(JSON)을 저장하고, memories.photo 에는 대표(첫 번째)
// 사진을 같이 넣어 둡니다. photos 가 없는 예전 기록은 photo 한 장짜리로 봅니다.
export const MAX_MEMORY_PHOTOS = 5;
const MAX_PHOTO_LEN = 2_000_000;

export function memoryPhotos(row) {
  try {
    const a = JSON.parse(row.photos || 'null');
    if (Array.isArray(a)) return a.filter((x) => typeof x === 'string');
  } catch (e) {}
  return row.photo ? [row.photo] : [];
}

export function memoryOut(row) {
  return row ? { ...row, photos: memoryPhotos(row) } : row;
}

// 화면이 보낸 사진 목록을 검사합니다. 각 항목은 새 사진(data URL)이거나,
// keep 목록(이미 저장된 이 기록의 사진 URL) 중 하나여야 합니다.
export function checkPhotoList(list, keep = []) {
  if (!Array.isArray(list)) return { msg: '[시스템] 사진 목록이 올바르지 않습니다.' };
  if (list.length > MAX_MEMORY_PHOTOS) return { msg: `[시스템] 사진은 최대 ${MAX_MEMORY_PHOTOS}장까지 올릴 수 있습니다.` };
  for (const p of list) {
    if (typeof p !== 'string') return { msg: '[시스템] 사진 목록이 올바르지 않습니다.' };
    if (p.startsWith('data:image/')) {
      if (p.length > MAX_PHOTO_LEN) return { msg: '[시스템] 사진 용량이 너무 큽니다.' };
    } else if (!keep.includes(p)) {
      return { msg: '[시스템] 사진 목록이 올바르지 않습니다.' };
    }
  }
  return { ok: true };
}

// 새 사진은 R2에 올려 URL로 바꾸고, 기존 URL은 그대로 둡니다 (순서 유지)
export async function uploadPhotoList(env, request, list) {
  const out = await Promise.all(
    list.map((p) => (p.startsWith('data:image/') ? saveImage(env, request, p, 'memories') : p))
  );
  if (!out.includes(null)) return out;
  // 한 장이라도 형식이 안 맞으면 이번에 새로 올린 파일은 지우고 실패 처리
  await Promise.all(out.map((u, i) => (u && u !== list[i] ? deleteImage(env, u) : null)));
  return null;
}

// ---- 시도 횟수 잠금 -------------------------------------------------------
// count/at 은 users 테이블의 *_fail_count / *_fail_at 값. D1 datetime('now')는 UTC.
export function isLockedOut(count, at, threshold, ms) {
  return (count || 0) >= threshold && withinMs(at, ms);
}

// D1 datetime(UTC 문자열) at 이 지금으로부터 ms 안인지
export function withinMs(at, ms) {
  if (!at) return false;
  return Date.now() - new Date(String(at).replace(' ', 'T') + 'Z').getTime() < ms;
}

// ---- 비밀번호 찾기 본인 확인 ----------------------------------------------
// verify-identity와 reset-password가 같은 잠금 카운트를 쓰도록 한곳에 둡니다.
// 닉네임은 월드 채팅에 공개되고 생년월일은 지인이 알 수 있어 약한 정보이므로,
// 여러 번 틀리면 한동안 막습니다.
const RESET_LOCK_THRESHOLD = 5;
const RESET_LOCK_MS = 15 * 60 * 1000;

export async function checkResetIdentity(env, id, nickname, birth) {
  const fail = { ok: false, msg: '[시스템] 일치하는 계정을 찾을 수 없습니다.' };
  const user = await env.DB.prepare('SELECT nickname, birth, email, reset_fail_count, reset_fail_at FROM users WHERE id = ?')
    .bind(id).first();
  if (!user) return fail;
  // 이메일이 등록된 계정은 이메일 인증으로만 찾을 수 있음 (닉네임·생일은 남도 알 수 있으니)
  if (user.email) return { ok: false, msg: '[시스템] 이메일이 등록된 계정이에요. 이메일 인증번호로 비밀번호를 찾아주세요.' };
  if (isLockedOut(user.reset_fail_count, user.reset_fail_at, RESET_LOCK_THRESHOLD, RESET_LOCK_MS)) {
    return { ok: false, msg: '[시스템] 본인 확인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' };
  }
  if (user.nickname !== nickname || user.birth !== birth) {
    await env.DB.prepare("UPDATE users SET reset_fail_count = ?, reset_fail_at = datetime('now') WHERE id = ?")
      .bind((user.reset_fail_count || 0) + 1, id).run();
    return fail;
  }
  return { ok: true };
}

// ---- 이메일 인증 (Resend) --------------------------------------------------
// RESEND_API_KEY는 Cloudflare Pages 시크릿. 로컬(localhost)에서 키가 없으면
// 실제로 보내지 않고 wrangler 로그에 내용을 찍습니다.
const MAIL_FROM = 'CoupleWorld <noreply@coupleworld.online>';

export function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}

export function validEmail(e) {
  return e.length <= 254 && /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/.test(e);
}

// abcdef@gmail.com → ab****@gmail.com
export function maskEmail(e) {
  const [u, d] = String(e || '').split('@');
  if (!d) return '';
  return u.slice(0, 2) + '*'.repeat(Math.max(1, u.length - 2)) + '@' + d;
}

export async function sendEmail(env, request, to, subject, html) {
  if (!env.RESEND_API_KEY) {
    if (new URL(request.url).hostname === 'localhost') {
      console.log('[DEV EMAIL]', to, subject, html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
      return true;
    }
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html })
  });
  if (!res.ok) console.log('resend error', res.status, await res.text());
  return res.ok;
}

const CODE_TTL_MIN = 10;
const CODE_COOLDOWN_S = 60;
const CODE_MAX_PER_HOUR = 5;
const CODE_MAX_TRIES = 5;

const CODE_TITLES = {
  signup: '회원가입 인증번호',
  change: '복구 이메일 등록 인증번호',
  reset: '비밀번호 찾기 인증번호'
};

// 6자리 인증번호를 만들어 메일로 보냄 — { ok, msg }
export async function issueCode(env, request, purpose, target, email) {
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS n, MAX(created_at) AS last FROM email_codes WHERE purpose = ? AND target = ? AND created_at > datetime('now', '-1 hour')"
  ).bind(purpose, target).first();
  if (recent && recent.n >= CODE_MAX_PER_HOUR) {
    return { ok: false, msg: '[시스템] 인증번호를 너무 많이 요청했어요. 1시간 후 다시 시도해주세요.' };
  }
  if (recent && withinMs(recent.last, CODE_COOLDOWN_S * 1000)) {
    return { ok: false, msg: '[시스템] 인증번호는 1분에 한 번만 받을 수 있어요. 잠시 후 다시 시도해주세요.' };
  }

  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  await env.DB.batch([
    // 새 번호를 보내면 이전 번호는 못 쓰게 함
    env.DB.prepare('UPDATE email_codes SET used = 1 WHERE purpose = ? AND target = ? AND used = 0').bind(purpose, target),
    env.DB.prepare('INSERT INTO email_codes (purpose, target, email, code_hash) VALUES (?, ?, ?, ?)')
      .bind(purpose, target, email, await hashPassword(code, purpose + ':' + target))
  ]);

  const title = CODE_TITLES[purpose];
  const sent = await sendEmail(env, request, email, `[커플월드] ${title}`,
    `<div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#333">
      <h2 style="margin:0 0 12px">커플월드 ${title}</h2>
      <p style="margin:0 0 16px">아래 인증번호를 ${CODE_TTL_MIN}분 안에 입력해주세요.</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:0 0 16px">${code}</p>
      <p style="font-size:12px;color:#888;margin:0">직접 요청하지 않았다면 이 메일은 무시하셔도 됩니다.</p>
    </div>`);
  if (!sent) {
    await env.DB.prepare('UPDATE email_codes SET used = 1 WHERE purpose = ? AND target = ? AND used = 0').bind(purpose, target).run();
    return { ok: false, msg: '[시스템] 메일을 보내지 못했어요. 잠시 후 다시 시도해주세요.' };
  }
  return { ok: true };
}

// 인증번호 확인 — 맞으면 사용 처리. email을 주면 그 주소로 보낸 번호인지도 확인. { ok, msg }
export async function consumeCode(env, purpose, target, code, email) {
  const row = await env.DB.prepare(
    'SELECT id, email, code_hash, attempts, created_at FROM email_codes WHERE purpose = ? AND target = ? AND used = 0 ORDER BY id DESC LIMIT 1'
  ).bind(purpose, target).first();
  const again = { ok: false, msg: '[시스템] 인증번호를 다시 받아주세요.' };
  if (!row || !withinMs(row.created_at, CODE_TTL_MIN * 60 * 1000)) return again;
  if (email !== undefined && row.email !== email) return again;
  if (row.attempts >= CODE_MAX_TRIES) return again;

  if ((await hashPassword(String(code || '').trim(), purpose + ':' + target)) !== row.code_hash) {
    const tries = row.attempts + 1;
    await env.DB.prepare('UPDATE email_codes SET attempts = ?, used = ? WHERE id = ?')
      .bind(tries, tries >= CODE_MAX_TRIES ? 1 : 0, row.id).run();
    return tries >= CODE_MAX_TRIES
      ? { ok: false, msg: '[시스템] 인증번호를 여러 번 틀렸어요. 인증번호를 다시 받아주세요.' }
      : { ok: false, msg: `[시스템] 인증번호가 맞지 않아요. (${tries}/${CODE_MAX_TRIES})` };
  }
  await env.DB.prepare('UPDATE email_codes SET used = 1 WHERE id = ?').bind(row.id).run();
  return { ok: true };
}
