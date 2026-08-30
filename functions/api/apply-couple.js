import { json, readJson, validDate } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const partnerId = (b.partnerId || '').trim();
  const startDate = (b.startDate || '').trim();

  const me = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });
  if (!partnerId || !startDate) return json({ ok: false, msg: '[시스템] 상대 아이디와 사귄 날짜를 입력하세요.' });
  if (!validDate(startDate)) return json({ ok: false, msg: '[시스템] 날짜를 다시 확인해주세요.' });
  if (partnerId === id) return json({ ok: false, msg: '[시스템] 본인 아이디는 입력할 수 없습니다.' });

  const partner = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(partnerId).first();
  if (!partner) return json({ ok: false, msg: '[시스템] 해당 아이디의 상대를 찾을 수 없어요. 상대가 먼저 회원가입해야 해요.' });

  const mailId = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO mail (id, to_id, from_id, from_nickname, start_date) VALUES (?, ?, ?, ?, ?)')
    .bind(mailId, partnerId, id, me.nickname, startDate).run();

  return json({ ok: true });
}
