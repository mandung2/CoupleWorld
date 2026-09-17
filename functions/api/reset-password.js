import { json, readJson, hashPassword, randomHex, validPassword } from '../_lib.js';

// Nickname + birth are visible to a partner (and guessable by an ex or
// acquaintance), so they're weak identity proof on their own. This locks an
// account's reset attempts out for a while after repeated mismatches, and
// wipes any existing session on a successful reset so a hijacked session
// can't keep riding on the old login.
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const nickname = (b.nickname || '').trim();
  const birth = (b.birth || '').trim();
  const newPassword = String(b.newPassword || '');

  if (!id || !nickname || !birth) return json({ ok: false, msg: '[시스템] 본인 확인 정보가 없습니다.' });
  if (!validPassword(newPassword)) return json({ ok: false, msg: '[시스템] 새 비밀번호는 8~16자이며 특수문자를 2개 이상 포함해야 합니다.' });

  const user = await env.DB.prepare('SELECT id, nickname, birth, reset_fail_count, reset_fail_at FROM users WHERE id = ?')
    .bind(id).first();
  if (!user) return json({ ok: false, msg: '[시스템] 일치하는 계정을 찾을 수 없습니다.' });

  const failCount = user.reset_fail_count || 0;
  const failAt = user.reset_fail_at ? new Date(user.reset_fail_at.replace(' ', 'T') + 'Z').getTime() : 0;
  if (failCount >= LOCKOUT_THRESHOLD && Date.now() - failAt < LOCKOUT_MS) {
    return json({ ok: false, msg: '[시스템] 본인 확인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' });
  }

  if (user.nickname !== nickname || user.birth !== birth) {
    await env.DB.prepare("UPDATE users SET reset_fail_count = ?, reset_fail_at = datetime('now') WHERE id = ?")
      .bind(failCount + 1, id).run();
    return json({ ok: false, msg: '[시스템] 일치하는 계정을 찾을 수 없습니다.' });
  }

  const salt = randomHex(16);
  const hash = await hashPassword(newPassword, salt);
  await env.DB.prepare("UPDATE users SET password_hash = ?, session_token = NULL, reset_fail_count = 0, reset_fail_at = NULL WHERE id = ?")
    .bind(salt + '$' + hash, id).run();

  return json({ ok: true, msg: '[시스템] 비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.' });
}
