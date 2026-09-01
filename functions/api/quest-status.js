import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, done: [] });

  const { results } = await env.DB.prepare('SELECT quest_id FROM quest_completions WHERE user_id = ?').bind(id).all();
  return json({ ok: true, done: results.map(r => r.quest_id) });
}
