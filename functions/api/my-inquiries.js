import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, items: [] });

  const { results } = await env.DB.prepare(
    'SELECT id, title, body, status, reply FROM inquiries WHERE user_id = ? ORDER BY created_at DESC'
  ).bind(id).all();

  return json({ ok: true, items: results });
}
