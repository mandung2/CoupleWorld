import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const mailId = b.mailId;

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  // Also used as the "확인" (acknowledge) action for non couple-request mail
  // (see mailItems() in the client), so pick the right status for the type.
  const mail = await env.DB.prepare('SELECT type FROM mail WHERE id = ? AND to_id = ?').bind(mailId, id).first();
  const status = mail && (mail.type || 'couple_request') === 'couple_request' ? 'rejected' : 'read';
  await env.DB.prepare('UPDATE mail SET status = ? WHERE id = ? AND to_id = ?').bind(status, mailId, id).run();
  return json({ ok: true });
}
