import { json, readJson, saveImage, deleteImage } from '../_lib.js';

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

  const existing = await env.DB.prepare('SELECT id, photo FROM memories WHERE id = ? AND author_id = ? AND deleted_at IS NULL')
    .bind(memoryId, id).first();
  if (!existing) return json({ ok: false, msg: '[시스템] 기록을 찾을 수 없습니다.' });

  // 새 사진(data URL)이면 R2에 올리고, 화면이 기존 사진 URL을 그대로 보냈으면 유지,
  // 비어 있으면 사진 삭제로 봅니다.
  let photoUrl = null;
  if (photo) photoUrl = await saveImage(env, request, photo, 'memories');
  else if (existing.photo && b.photo === existing.photo) photoUrl = existing.photo;

  await env.DB.prepare(
    'UPDATE memories SET date = ?, place = ?, title = ?, body = ?, photo = ? WHERE id = ?'
  ).bind(date, place, title, body, photoUrl, memoryId).run();

  // 바뀌었거나 지운 예전 사진 파일 정리
  if (existing.photo && existing.photo !== photoUrl) await deleteImage(env, existing.photo);

  const row = await env.DB.prepare('SELECT * FROM memories WHERE id = ?').bind(memoryId).first();
  return json({ ok: true, item: row });
}
