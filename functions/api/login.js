import { json, readJson, hashPassword, randomHex } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const password = String(b.password || '');
  if (!id || !password) return json({ ok: false, msg: '[시스템] 아이디와 비밀번호를 입력하세요.' });

  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!row) return json({ ok: false, msg: '[시스템] 가입된 계정이 아닙니다. 회원가입을 먼저 해주세요.' });

  const [salt, expected] = String(row.password_hash).split('$');
  const hash = await hashPassword(password, salt);
  if (hash !== expected) return json({ ok: false, msg: '[시스템] 비밀번호가 맞지 않습니다.' });
  if (row.suspended) return json({ ok: false, msg: '[시스템] 정지된 계정입니다. 관리자에게 문의해주세요.' });

  const token = randomHex(24);
  await env.DB.prepare("UPDATE users SET session_token = ?, last_login = datetime('now') WHERE id = ?").bind(token, id).run();

  let partnerNickname = null;
  if (row.partner_id) {
    const p = await env.DB.prepare('SELECT nickname FROM users WHERE id = ?').bind(row.partner_id).first();
    partnerNickname = p ? p.nickname : null;
  }

  return json({
    ok: true, token,
    user: {
      id: row.id, nickname: row.nickname, gender: row.gender, birth: row.birth,
      partnerId: row.partner_id, partnerNickname, startDate: row.start_date, linked: !!row.linked
    }
  });
}
