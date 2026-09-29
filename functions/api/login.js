import { json, readJson, checkPassword, makePasswordHash, randomHex, isLockedOut } from '../_lib.js';

// 비밀번호를 계속 대입해보지 못하도록, 연속으로 틀리면 한동안 로그인을 막습니다.
const LOGIN_LOCK_THRESHOLD = 10;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const password = String(b.password || '');
  if (!id || !password) return json({ ok: false, msg: '[시스템] 아이디와 비밀번호를 입력하세요.' });

  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!row) return json({ ok: false, msg: '[시스템] 가입된 계정이 아닙니다. 회원가입을 먼저 해주세요.' });

  if (isLockedOut(row.login_fail_count, row.login_fail_at, LOGIN_LOCK_THRESHOLD, LOGIN_LOCK_MS)) {
    return json({ ok: false, msg: '[시스템] 비밀번호를 여러 번 틀렸습니다. 15분 후 다시 시도해주세요.' });
  }

  const pw = await checkPassword(password, row.password_hash);
  if (!pw.ok) {
    await env.DB.prepare("UPDATE users SET login_fail_count = ?, login_fail_at = datetime('now') WHERE id = ?")
      .bind((row.login_fail_count || 0) + 1, id).run();
    return json({ ok: false, msg: '[시스템] 비밀번호가 맞지 않습니다.' });
  }
  if (row.suspended) return json({ ok: false, msg: '[시스템] 정지된 계정입니다. 관리자에게 문의해주세요.' });

  const token = randomHex(24);
  await env.DB.prepare("UPDATE users SET session_token = ?, last_login = datetime('now'), login_fail_count = 0, login_fail_at = NULL WHERE id = ?").bind(token, id).run();
  // 예전 방식(SHA-256 한 번)으로 저장된 비밀번호는 맞춘 김에 새 방식으로 바꿔 저장
  if (pw.legacy) {
    await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(await makePasswordHash(password), id).run();
  }

  let partnerNickname = null;
  let partnerAvatar = null;
  if (row.partner_id) {
    const p = await env.DB.prepare('SELECT nickname, avatar FROM users WHERE id = ?').bind(row.partner_id).first();
    partnerNickname = p ? p.nickname : null;
    partnerAvatar = p ? p.avatar : null;
  }

  return json({
    ok: true, token,
    user: {
      id: row.id, nickname: row.nickname, gender: row.gender, birth: row.birth,
      partnerId: row.partner_id, partnerNickname, startDate: row.start_date, linked: !!row.linked,
      points: row.points || 0, avatar: row.avatar || null, partnerAvatar,
      costumeCode: row.costume_code || null,
      email: row.email || null
    }
  });
}
