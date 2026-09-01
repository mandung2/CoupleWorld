import { json, readJson, coupleKey } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const unit = (b.unit || '').trim();
  const date = (b.date || '').trim();
  const title = (b.title || '').trim();
  const text = (b.text || '').trim();

  if (!unit) return json({ ok: false, msg: '[시스템] 지역 정보가 없습니다.' });

  const me = await env.DB.prepare('SELECT session_token, partner_id FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });
  if (!me.partner_id) return json({ ok: true, items: [] });

  const key = coupleKey(id, me.partner_id);
  await env.DB.prepare(
    `INSERT INTO visited_regions (couple_key, unit, last_date, title, text, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT (couple_key, unit) DO UPDATE SET last_date = excluded.last_date, title = excluded.title, text = excluded.text, updated_at = datetime('now')`
  ).bind(key, unit, date, title, text).run();

  const { results } = await env.DB.prepare(
    'SELECT unit, last_date, title, text FROM visited_regions WHERE couple_key = ?'
  ).bind(key).all();

  return json({ ok: true, items: results });
}
