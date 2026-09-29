import { json, readJson, deleteImage, coupleKey } from '../_lib.js';

// 탈퇴하면 이 사용자가 남긴 기록을 모두 지웁니다 (사진 파일 포함).
// 문의 내역(inquiries)은 관리자 응대 기록이라 남겨둡니다.
export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';

  const me = await env.DB.prepare('SELECT session_token, partner_id, avatar, email FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  const { results: photos } = await env.DB.prepare('SELECT photo FROM memories WHERE author_id = ? AND photo IS NOT NULL')
    .bind(id).all();

  const stmts = [
    env.DB.prepare('DELETE FROM mail WHERE to_id = ? OR from_id = ?').bind(id, id),
    env.DB.prepare('DELETE FROM memories WHERE author_id = ?').bind(id),
    env.DB.prepare('DELETE FROM messages WHERE from_id = ? OR to_id = ?').bind(id, id),
    env.DB.prepare('DELETE FROM dm_messages WHERE from_id = ? OR to_id = ?').bind(id, id),
    env.DB.prepare('DELETE FROM world_messages WHERE from_id = ?').bind(id),
    env.DB.prepare('DELETE FROM quest_completions WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM user_items WHERE user_id = ?').bind(id),
    env.DB.prepare('DELETE FROM email_codes WHERE target = ? OR email = ?').bind(id, me.email || ''),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id)
  ];
  if (me.partner_id) {
    stmts.push(
      env.DB.prepare('DELETE FROM visited_regions WHERE couple_key = ?').bind(coupleKey(id, me.partner_id)),
      env.DB.prepare('UPDATE users SET partner_id = NULL, start_date = NULL, linked = 0 WHERE id = ? AND partner_id = ?').bind(me.partner_id, id)
    );
  }
  await env.DB.batch(stmts);

  await deleteImage(env, me.avatar);
  for (const p of photos) await deleteImage(env, p.photo);

  return json({ ok: true });
}
