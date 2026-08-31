import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const date = (b.date || '').trim();
  const place = (b.place || '').trim();
  const title = (b.title || '').trim();
  const body = (b.body || '').trim();
  const photo = typeof b.photo === 'string' && b.photo.startsWith('data:image/') ? b.photo : null;

  if (!date && !place && !title && !body && !photo) return json({ ok: false, msg: '[시스템] 내용을 입력하세요.' });
  if (photo && photo.length > 2_000_000) return json({ ok: false, msg: '[시스템] 사진 용량이 너무 큽니다.' });

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  const memId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(
      'INSERT INTO memories (id, author_id, date, place, title, body, photo) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(memId, id, date, place, title, body, photo),
    env.DB.prepare('UPDATE users SET points = points + 50 WHERE id = ?').bind(id),
  ]);

  const row = await env.DB.prepare('SELECT * FROM memories WHERE id = ?').bind(memId).first();
  const updated = await env.DB.prepare('SELECT points FROM users WHERE id = ?').bind(id).first();
  return json({ ok: true, item: row, points: updated.points });
}
