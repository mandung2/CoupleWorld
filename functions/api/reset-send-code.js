import { json, readJson, issueCode, maskEmail } from '../_lib.js';

// 비밀번호 찾기: 계정에 등록된 이메일로 인증번호 보내기 { id }
// 이메일이 없는 예전 계정은 noEmail로 알려서 닉네임·생년월일 확인으로 넘어가게 함
export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  if (!id) return json({ ok: false, msg: '[시스템] 아이디를 입력하세요.' });

  const user = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(id).first();
  if (!user) return json({ ok: false, msg: '[시스템] 일치하는 계정을 찾을 수 없습니다.' });
  if (!user.email) {
    return json({ ok: false, noEmail: true, msg: '[시스템] 등록된 이메일이 없는 계정이에요. 닉네임과 생년월일로 본인 확인을 해주세요.' });
  }

  const r = await issueCode(env, request, 'reset', id, user.email);
  if (!r.ok) return json(r);
  return json({ ok: true, msg: `[시스템] ${maskEmail(user.email)} 로 인증번호를 보냈어요. 메일함(스팸함 포함)을 확인해주세요.` });
}
