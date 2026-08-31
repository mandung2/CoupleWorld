import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';

  const me = await env.DB.prepare('SELECT session_token, partner_id FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token || !me.partner_id) return json({ ok: true, items: [] });

  const { results } = await env.DB.prepare(
    `SELECT * FROM messages WHERE (from_id = ? AND to_id = ?) OR (from_id = ? AND to_id = ?) ORDER BY created_at ASC`
  ).bind(id, me.partner_id, me.partner_id, id).all();

  return json({ ok: true, items: results });
}
