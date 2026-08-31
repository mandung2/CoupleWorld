import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const mailId = b.mailId;

  const me = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  const mail = await env.DB.prepare('SELECT * FROM mail WHERE id = ? AND to_id = ?').bind(mailId, id).first();
  if (!mail) return json({ ok: false, msg: '[시스템] 신청서를 찾을 수 없습니다.' });
  if ((mail.type || 'couple_request') !== 'couple_request') return json({ ok: false, msg: '[시스템] 수락할 수 없는 우편입니다.' });

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET partner_id = ?, start_date = ?, linked = 1 WHERE id = ?').bind(mail.from_id, mail.start_date, id),
    env.DB.prepare('UPDATE users SET partner_id = ?, start_date = ?, linked = 1 WHERE id = ?').bind(id, mail.start_date, mail.from_id),
    env.DB.prepare('DELETE FROM mail WHERE id = ?').bind(mailId)
  ]);

  const partner = await env.DB.prepare('SELECT avatar FROM users WHERE id = ?').bind(mail.from_id).first();

  return json({ ok: true, partnerNickname: mail.from_nickname, startDate: mail.start_date, partnerAvatar: partner ? partner.avatar : null });
}
