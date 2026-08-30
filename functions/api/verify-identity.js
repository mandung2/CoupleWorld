import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const nickname = (b.nickname || '').trim();
  const birth = (b.birth || '').trim();
  if (!id || !nickname || !birth) return json({ ok: false, msg: '[시스템] 아이디·닉네임·생년월일을 모두 입력하세요.' });

  const row = await env.DB.prepare('SELECT id FROM users WHERE id = ? AND nickname = ? AND birth = ?')
    .bind(id, nickname, birth).first();
  if (!row) return json({ ok: false, msg: '[시스템] 일치하는 계정을 찾을 수 없습니다.' });

  return json({ ok: true, msg: '[시스템] 본인 확인이 완료됐어요. 아래에서 새 비밀번호를 설정해주세요.' });
}
