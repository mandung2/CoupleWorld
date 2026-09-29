import { json, readJson, saveImage, deleteImage, tooLong, checkPhotoList, uploadPhotoList, memoryPhotos, memoryOut } from '../_lib.js';

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

  const over = tooLong({ date, place, title, body });
  if (over) return json({ ok: false, msg: over });
  if (photo && photo.length > 2_000_000) return json({ ok: false, msg: '[시스템] 사진 용량이 너무 큽니다.' });

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  const existing = await env.DB.prepare('SELECT id, photo, photos FROM memories WHERE id = ? AND author_id = ? AND deleted_at IS NULL')
    .bind(memoryId, id).first();
  if (!existing) return json({ ok: false, msg: '[시스템] 내가 쓴 기록만 수정할 수 있습니다.' });
  const oldPhotos = memoryPhotos(existing);

  let newPhotos;
  if (Array.isArray(b.photos)) {
    // 사진 여러 장: 각 항목은 새 사진(data URL)이거나 이 기록에 이미 있던 사진 URL
    const bad = checkPhotoList(b.photos, oldPhotos);
    if (bad.msg) return json({ ok: false, msg: bad.msg });
    newPhotos = await uploadPhotoList(env, request, b.photos);
    if (!newPhotos) return json({ ok: false, msg: '[시스템] 지원하지 않는 사진 형식입니다.' });
  } else {
    // 예전 화면(사진 한 장): 새 사진(data URL)이면 R2에 올리고, 기존 사진 URL을 그대로
    // 보냈으면 유지, 비어 있으면 사진 삭제로 봅니다.
    let photoUrl = null;
    if (photo) photoUrl = await saveImage(env, request, photo, 'memories');
    else if (existing.photo && b.photo === existing.photo) photoUrl = existing.photo;
    newPhotos = photoUrl ? [photoUrl] : [];
  }

  await env.DB.prepare(
    'UPDATE memories SET date = ?, place = ?, title = ?, body = ?, photo = ?, photos = ? WHERE id = ?'
  ).bind(date, place, title, body, newPhotos[0] || null, JSON.stringify(newPhotos), memoryId).run();

  // 바뀌었거나 지운 예전 사진 파일 정리
  await Promise.all(oldPhotos.filter((u) => !newPhotos.includes(u)).map((u) => deleteImage(env, u)));

  const row = await env.DB.prepare('SELECT * FROM memories WHERE id = ?').bind(memoryId).first();
  return json({ ok: true, item: memoryOut(row) });
}
