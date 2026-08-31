import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const title = (b.title || '').trim();
  const body = (b.body || '').trim();
  const photo = typeof b.photo === 'string' && b.photo.startsWith('data:image/') ? b.photo : null;

  if (!title || !body) return json({ ok: false, msg: '[시스템] 제목과 내용을 입력하세요.' });
  if (photo && photo.length > 2_000_000) return json({ ok: false, msg: '[시스템] 사진 용량이 너무 큽니다.' });

  const me = await env.DB.prepare('SELECT nickname, session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  await env.DB.prepare(
    "INSERT INTO inquiries (user, user_id, title, body, status, photo) VALUES (?, ?, ?, ?, '답변대기', ?)"
  ).bind(me.nickname, id, title, body, photo).run();

  return json({ ok: true, msg: '[시스템] 문의가 접수되었습니다. 답변을 기다려주세요.' });
}
