import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const avatar = typeof b.avatar === 'string' && b.avatar.startsWith('data:image/') ? b.avatar : null;
  // Optional: the dotmate costume editor's own "코디 코드" for the look that
  // produced this avatar, so re-opening the editor can restore it exactly
  // instead of starting over. Plain photo uploads (no editor involved)
  // simply omit this and leave whatever code was last saved untouched.
  const code = typeof b.code === 'string' && b.code.length <= 500 ? b.code : undefined;

  if (!avatar) return json({ ok: false, msg: '[시스템] 사진을 선택하세요.' });
  if (avatar.length > 2_000_000) return json({ ok: false, msg: '[시스템] 사진 용량이 너무 큽니다.' });

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  if (code !== undefined) {
    await env.DB.prepare('UPDATE users SET avatar = ?, costume_code = ? WHERE id = ?').bind(avatar, code, id).run();
  } else {
    await env.DB.prepare('UPDATE users SET avatar = ? WHERE id = ?').bind(avatar, id).run();
  }
  return json({ ok: true, avatar });
}
