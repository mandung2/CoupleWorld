import { json, readJson, saveImage, tooLong } from '../_lib.js';

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
  const photo = typeof b.photo === 'string' && b.photo.startsWith('data:image/') ? b.photo : null;

  if (!date && !place && !title && !body && !photo) return json({ ok: false, msg: '[시스템] 내용을 입력하세요.' });
  const over = tooLong({ date, place, title, body });
  if (over) return json({ ok: false, msg: over });
  if (photo && photo.length > 2_000_000) return json({ ok: false, msg: '[시스템] 사진 용량이 너무 큽니다.' });

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  // 사진은 R2에 올리고 D1에는 이미지 URL만 저장
  const photoUrl = photo ? await saveImage(env, request, photo, 'memories') : null;

  // 지운 기록도 포함해서 셉니다
  const today = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM memories WHERE author_id = ? AND date(created_at, '+9 hours') = date('now', '+9 hours')"
  ).bind(id).first();
  const awarded = (today ? today.n : 0) < RECORD_POINTS_PER_DAY;

  const memId = crypto.randomUUID();
  const stmts = [
    env.DB.prepare(
      'INSERT INTO memories (id, author_id, date, place, title, body, photo) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(memId, id, date, place, title, body, photoUrl),
  ];
  if (awarded) stmts.push(env.DB.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(RECORD_POINTS, id));
  await env.DB.batch(stmts);

  const row = await env.DB.prepare('SELECT * FROM memories WHERE id = ?').bind(memId).first();
  const updated = await env.DB.prepare('SELECT points FROM users WHERE id = ?').bind(id).first();
  return json({ ok: true, item: row, points: updated.points, awarded });
}
