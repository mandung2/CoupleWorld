import { json } from '../_lib.js';

// Public — the couple-world app shows these to every visitor on first
// load, logged in or not, so this intentionally has no session check.
export async function onRequestPost({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT id, title, body, created_at FROM notices WHERE active = 1 ORDER BY created_at DESC'
  ).all();

  return json({ ok: true, items: results });
}
