import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';

  const me = await env.DB.prepare('SELECT session_token, partner_id FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  await env.DB.batch([
    env.DB.prepare('DELETE FROM mail WHERE to_id = ? OR from_id = ?').bind(id, id),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id)
  ]);

  if (me.partner_id) {
    await env.DB.prepare('UPDATE users SET partner_id = NULL, start_date = NULL, linked = 0 WHERE id = ?').bind(me.partner_id).run();
  }

  return json({ ok: true });
}
