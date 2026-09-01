import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';

  const me = await env.DB.prepare('SELECT session_token, partner_id FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: true, items: [] });

  const ids = me.partner_id ? [id, me.partner_id] : [id];
  const placeholders = ids.map(() => '?').join(', ');
  const { results } = await env.DB.prepare(
    `SELECT * FROM memories WHERE author_id IN (${placeholders}) AND deleted_at IS NULL ORDER BY created_at DESC`
  ).bind(...ids).all();

  return json({ ok: true, items: results });
}
