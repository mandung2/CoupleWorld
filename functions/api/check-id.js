import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const { id } = await readJson(request);
  const trimmed = (id || '').trim();
  if (!trimmed) return json({ ok: false, msg: '[시스템] 아이디를 입력하세요.' });
  const row = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(trimmed).first();
  if (row) return json({ ok: false, available: false, msg: '[시스템] 이미 사용 중인 아이디입니다.' });
  return json({ ok: true, available: true, msg: '[시스템] 사용할 수 있는 아이디입니다.' });
}
