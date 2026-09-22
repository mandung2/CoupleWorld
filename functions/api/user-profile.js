import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const targetId = (b.targetId || '').trim();

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });
  if (!targetId) return json({ ok: false, msg: '[시스템] 대상을 찾을 수 없습니다.' });

  const target = await env.DB.prepare('SELECT id, nickname, gender, avatar FROM users WHERE id = ?').bind(targetId).first();
  if (!target) return json({ ok: false, msg: '[시스템] 존재하지 않는 사용자입니다.' });

  return json({ ok: true, profile: target });
}
