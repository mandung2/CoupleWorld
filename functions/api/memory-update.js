import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const memoryId = b.memoryId;
  const date = (b.date || '').trim();
  const place = (b.place || '').trim();
  const title = (b.title || '').trim();
  const body = (b.body || '').trim();
  const photo = typeof b.photo === 'string' && b.photo.startsWith('data:image/') ? b.photo : null;

  if (photo && photo.length > 2_000_000) return json({ ok: false, msg: '[시스템] 사진 용량이 너무 큽니다.' });

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  const existing = await env.DB.prepare('SELECT id FROM memories WHERE id = ? AND author_id = ? AND deleted_at IS NULL')
    .bind(memoryId, id).first();
  if (!existing) return json({ ok: false, msg: '[시스템] 기록을 찾을 수 없습니다.' });

  await env.DB.prepare(
    'UPDATE memories SET date = ?, place = ?, title = ?, body = ?, photo = ? WHERE id = ?'
  ).bind(date, place, title, body, photo, memoryId).run();

  const row = await env.DB.prepare('SELECT * FROM memories WHERE id = ?').bind(memoryId).first();
  return json({ ok: true, item: row });
}
