import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const nickname = (b.nickname || '').trim();
  const gender = b.gender;

  if (!nickname) return json({ ok: false, msg: '[시스템] 닉네임을 입력하세요.' });
  if (nickname.length > 12) return json({ ok: false, msg: '[시스템] 닉네임은 12자 이내로 입력하세요.' });
  if (gender !== 'F' && gender !== 'M') return json({ ok: false, msg: '[시스템] 성별을 선택하세요.' });

  const me = await env.DB.prepare('SELECT session_token, nickname FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  if (nickname !== me.nickname) {
    const taken = await env.DB.prepare('SELECT id FROM users WHERE nickname = ? AND id != ?').bind(nickname, id).first();
    if (taken) return json({ ok: false, msg: '[시스템] 이미 사용 중인 닉네임입니다.' });
  }

  await env.DB.prepare('UPDATE users SET nickname = ?, gender = ? WHERE id = ?').bind(nickname, gender, id).run();
  return json({ ok: true, nickname, gender });
}
