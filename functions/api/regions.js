import { json, readJson, coupleKey } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';

  const me = await env.DB.prepare('SELECT session_token, partner_id FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token || !me.partner_id) return json({ ok: true, items: [] });

  const key = coupleKey(id, me.partner_id);
  const { results } = await env.DB.prepare(
    'SELECT unit, last_date, title, text FROM visited_regions WHERE couple_key = ?'
  ).bind(key).all();

  return json({ ok: true, items: results });
}
