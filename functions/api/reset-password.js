import { json, readJson, makePasswordHash, validPassword, checkResetIdentity, consumeCode } from '../_lib.js';

// 두 가지 방식:
// - { id, code, newPassword }: 등록된 이메일로 받은 인증번호 (reset-send-code)
// - { id, nickname, birth, newPassword }: 이메일이 없는 예전 계정만 (잠금은 checkResetIdentity)
// 성공하면 기존 세션을 지워서, 탈취된 세션이 예전 로그인으로 계속 쓰이지 않게 합니다.
export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const newPassword = String(b.newPassword || '');

  if (!id) return json({ ok: false, msg: '[시스템] 본인 확인 정보가 없습니다.' });
  if (!validPassword(newPassword)) return json({ ok: false, msg: '[시스템] 새 비밀번호는 8~16자이며 특수문자를 2개 이상 포함해야 합니다.' });

  let check;
  if (b.code !== undefined) {
    const user = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(id).first();
    if (!user || !user.email) return json({ ok: false, msg: '[시스템] 일치하는 계정을 찾을 수 없습니다.' });
    check = await consumeCode(env, 'reset', id, b.code, user.email);
  } else {
    const nickname = (b.nickname || '').trim();
    const birth = (b.birth || '').trim();
    if (!nickname || !birth) return json({ ok: false, msg: '[시스템] 본인 확인 정보가 없습니다.' });
    check = await checkResetIdentity(env, id, nickname, birth);
  }
  if (!check.ok) return json(check);

  await env.DB.prepare("UPDATE users SET password_hash = ?, session_token = NULL, reset_fail_count = 0, reset_fail_at = NULL, login_fail_count = 0, login_fail_at = NULL WHERE id = ?")
    .bind(await makePasswordHash(newPassword), id).run();

  return json({ ok: true, msg: '[시스템] 비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.' });
}
