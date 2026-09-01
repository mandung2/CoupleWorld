import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const inquiryId = b.inquiryId;

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  await env.DB.prepare("UPDATE inquiries SET deleted_at = datetime('now') WHERE id = ? AND user_id = ?").bind(inquiryId, id).run();
  return json({ ok: true });
}
