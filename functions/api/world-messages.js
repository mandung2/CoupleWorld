import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  const { results } = await env.DB.prepare(
    `SELECT w.id, w.from_id, COALESCE(u.nickname, w.from_nickname) AS from_nickname, w.body, w.created_at
     FROM world_messages w LEFT JOIN users u ON u.id = w.from_id
     ORDER BY w.created_at DESC LIMIT 50`
  ).all();

  return json({ ok: true, items: results.reverse() });
}
