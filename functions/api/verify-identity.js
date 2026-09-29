import { json, readJson, checkResetIdentity } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const nickname = (b.nickname || '').trim();
  const birth = (b.birth || '').trim();
  if (!id || !nickname || !birth) return json({ ok: false, msg: '[시스템] 아이디·닉네임·생년월일을 모두 입력하세요.' });

  // reset-password와 같은 잠금 카운트를 씁니다 — 여기서 무제한으로 맞춰볼 수 없도록.
  const check = await checkResetIdentity(env, id, nickname, birth);
  if (!check.ok) return json(check);

  return json({ ok: true, msg: '[시스템] 본인 확인이 완료됐어요. 아래에서 새 비밀번호를 설정해주세요.' });
}
