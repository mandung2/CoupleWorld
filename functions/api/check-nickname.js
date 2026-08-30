import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const { nickname } = await readJson(request);
  const trimmed = (nickname || '').trim();
  if (!trimmed) return json({ ok: false, msg: '[시스템] 닉네임을 입력하세요.' });
  const row = await env.DB.prepare('SELECT id FROM users WHERE nickname = ?').bind(trimmed).first();
  if (row) return json({ ok: false, available: false, msg: '[시스템] 이미 사용 중인 닉네임입니다.' });
  return json({ ok: true, available: true, msg: '[시스템] 사용할 수 있는 닉네임입니다.' });
}
