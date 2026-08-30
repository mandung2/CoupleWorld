import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';

  const me = await env.DB.prepare('SELECT id, session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, items: [] });

  const { results } = await env.DB.prepare('SELECT * FROM mail WHERE to_id = ? ORDER BY created_at').bind(id).all();
  return json({
    ok: true,
    items: results.map(r => ({ id: r.id, fromId: r.from_id, fromNickname: r.from_nickname, startDate: r.start_date }))
  });
}
