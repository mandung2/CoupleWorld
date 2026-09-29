import { json, readJson, tooLong, checkPhotoList, uploadPhotoList, memoryOut } from '../_lib.js';

// 추억 기록 보상은 하루(한국 시간) 3건까지 — 쓰고 지우기로 포인트를 무한히 모으지 못하게
const RECORD_POINTS = 50;
const RECORD_POINTS_PER_DAY = 3;

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const date = (b.date || '').trim();
  const place = (b.place || '').trim();
  const title = (b.title || '').trim();
  const body = (b.body || '').trim();
  // 사진은 photos 배열(최대 5장). 예전 화면이 보내는 photo 한 장도 받아 줍니다.
  const photos = Array.isArray(b.photos) ? b.photos
    : (typeof b.photo === 'string' && b.photo.startsWith('data:image/') ? [b.photo] : []);

  if (!date && !place && !title && !body && !photos.length) return json({ ok: false, msg: '[시스템] 내용을 입력하세요.' });
  const over = tooLong({ date, place, title, body });
  if (over) return json({ ok: false, msg: over });
  const bad = checkPhotoList(photos);
  if (bad.msg) return json({ ok: false, msg: bad.msg });

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  // 사진은 R2에 올리고 D1에는 이미지 URL만 저장
  const urls = await uploadPhotoList(env, request, photos);
  if (!urls) return json({ ok: false, msg: '[시스템] 지원하지 않는 사진 형식입니다.' });

  // 지운 기록도 포함해서 셉니다
  const today = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM memories WHERE author_id = ? AND date(created_at, '+9 hours') = date('now', '+9 hours')"
  ).bind(id).first();
  const awarded = (today ? today.n : 0) < RECORD_POINTS_PER_DAY;

  const memId = crypto.randomUUID();
  const stmts = [
    env.DB.prepare(
      'INSERT INTO memories (id, author_id, date, place, title, body, photo, photos) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(memId, id, date, place, title, body, urls[0] || null, JSON.stringify(urls)),
  ];
  if (awarded) stmts.push(env.DB.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(RECORD_POINTS, id));
  await env.DB.batch(stmts);

  const row = await env.DB.prepare('SELECT * FROM memories WHERE id = ?').bind(memId).first();
  const updated = await env.DB.prepare('SELECT points FROM users WHERE id = ?').bind(id).first();
  return json({ ok: true, item: memoryOut(row), points: updated.points, awarded });
}
