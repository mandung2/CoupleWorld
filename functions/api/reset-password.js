import { json, readJson, makePasswordHash, validPassword, checkResetIdentity } from '../_lib.js';

// 본인 확인(닉네임+생년월일)과 잠금은 _lib.js의 checkResetIdentity가 맡습니다.
// 성공하면 기존 세션을 지워서, 탈취된 세션이 예전 로그인으로 계속 쓰이지 않게 합니다.
export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const nickname = (b.nickname || '').trim();
  const birth = (b.birth || '').trim();
  const newPassword = String(b.newPassword || '');

  if (!id || !nickname || !birth) return json({ ok: false, msg: '[시스템] 본인 확인 정보가 없습니다.' });
  if (!validPassword(newPassword)) return json({ ok: false, msg: '[시스템] 새 비밀번호는 8~16자이며 특수문자를 2개 이상 포함해야 합니다.' });

  const check = await checkResetIdentity(env, id, nickname, birth);
  if (!check.ok) return json(check);

  await env.DB.prepare("UPDATE users SET password_hash = ?, session_token = NULL, reset_fail_count = 0, reset_fail_at = NULL, login_fail_count = 0, login_fail_at = NULL WHERE id = ?")
    .bind(await makePasswordHash(newPassword), id).run();

  return json({ ok: true, msg: '[시스템] 비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.' });
}
