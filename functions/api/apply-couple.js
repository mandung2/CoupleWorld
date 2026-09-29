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
  if (me.partner_id) return json({ ok: false, msg: '[시스템] 이미 커플섬이 연결되어 있어요.' });

  const partner = await env.DB.prepare('SELECT id, partner_id FROM users WHERE id = ?').bind(partnerId).first();
  if (!partner) return json({ ok: false, msg: '[시스템] 해당 아이디의 상대를 찾을 수 없어요. 상대가 먼저 회원가입해야 해요.' });
  if (partner.partner_id) return json({ ok: false, msg: '[시스템] 상대가 이미 다른 커플섬에 연결되어 있어요.' });

  // 같은 상대에게 아직 답을 받지 못한 신청서가 있으면 또 보내지 않음 (우편함 도배 방지)
  const pending = await env.DB.prepare(
    "SELECT id FROM mail WHERE from_id = ? AND to_id = ? AND type = 'couple_request' AND status = 'pending' AND deleted_at IS NULL"
  ).bind(id, partnerId).first();
  if (pending) return json({ ok: false, msg: '[시스템] 이미 보낸 신청서가 있어요. 상대의 답을 기다려주세요.' });

  const mailId = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO mail (id, to_id, from_id, from_nickname, start_date) VALUES (?, ?, ?, ?, ?)')
    .bind(mailId, partnerId, id, me.nickname, startDate).run();

  return json({ ok: true });
}
