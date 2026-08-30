import { json, readJson, hashPassword, randomHex, validPassword } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const nickname = (b.nickname || '').trim();
  const birth = (b.birth || '').trim();
  const newPassword = String(b.newPassword || '');

  if (!id || !nickname || !birth) return json({ ok: false, msg: '[시스템] 본인 확인 정보가 없습니다.' });
  if (!validPassword(newPassword)) return json({ ok: false, msg: '[시스템] 새 비밀번호는 8~16자이며 특수문자를 2개 이상 포함해야 합니다.' });

  const row = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND nickname = ? AND birth = ?')
    .bind(id, nickname, birth).first();
  if (!row) return json({ ok: false, msg: '[시스템] 일치하는 계정을 찾을 수 없습니다.' });

  const salt = randomHex(16);
  const hash = await hashPassword(newPassword, salt);
  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(salt + '$' + hash, id).run();

  return json({ ok: true, msg: '[시스템] 비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.' });
}
