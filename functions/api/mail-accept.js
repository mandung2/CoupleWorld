import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const mailId = b.mailId;

  const me = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  const mail = await env.DB.prepare('SELECT * FROM mail WHERE id = ? AND to_id = ? AND deleted_at IS NULL').bind(mailId, id).first();
  if (!mail) return json({ ok: false, msg: '[시스템] 신청서를 찾을 수 없습니다.' });
  if ((mail.type || 'couple_request') !== 'couple_request') return json({ ok: false, msg: '[시스템] 수락할 수 없는 우편입니다.' });
  if ((mail.status || 'pending') !== 'pending') return json({ ok: false, msg: '[시스템] 이미 처리된 신청서입니다.' });

  // 신청 후 어느 한쪽이 이미 다른 사람과 연결됐다면, 예전 신청서로 관계를 덮어쓰지 않음
  const sender = await env.DB.prepare('SELECT partner_id FROM users WHERE id = ?').bind(mail.from_id).first();
  if (me.partner_id || !sender || sender.partner_id) {
    await env.DB.prepare("UPDATE mail SET status = 'rejected' WHERE id = ?").bind(mailId).run();
    return json({ ok: false, msg: '[시스템] 이미 커플섬이 연결되어 있어 수락할 수 없어요.' });
  }

  // partner_id IS NULL 조건으로, 동시에 다른 신청서가 수락돼도 한쪽만 덮어쓰지 않게 함
  const res = await env.DB.batch([
    env.DB.prepare('UPDATE users SET partner_id = ?, start_date = ?, linked = 1 WHERE id = ? AND partner_id IS NULL').bind(mail.from_id, mail.start_date, id),
    env.DB.prepare('UPDATE users SET partner_id = ?, start_date = ?, linked = 1 WHERE id = ? AND partner_id IS NULL').bind(id, mail.start_date, mail.from_id),
    env.DB.prepare("UPDATE mail SET status = 'accepted' WHERE id = ?").bind(mailId)
  ]);
  if (res[0].meta.changes !== 1 || res[1].meta.changes !== 1) {
    // 한쪽만 연결됐으면 되돌림
    await env.DB.batch([
      env.DB.prepare('UPDATE users SET partner_id = NULL, start_date = NULL, linked = 0 WHERE id = ? AND partner_id = ?').bind(id, mail.from_id),
      env.DB.prepare('UPDATE users SET partner_id = NULL, start_date = NULL, linked = 0 WHERE id = ? AND partner_id = ?').bind(mail.from_id, id),
      env.DB.prepare("UPDATE mail SET status = 'rejected' WHERE id = ?").bind(mailId)
    ]);
    return json({ ok: false, msg: '[시스템] 이미 커플섬이 연결되어 있어 수락할 수 없어요.' });
  }

  const partner = await env.DB.prepare('SELECT avatar FROM users WHERE id = ?').bind(mail.from_id).first();

  return json({ ok: true, partnerNickname: mail.from_nickname, startDate: mail.start_date, partnerAvatar: partner ? partner.avatar : null });
}
