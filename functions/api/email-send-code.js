import { json, readJson, normEmail, validEmail, issueCode } from '../_lib.js';

// 이메일 인증번호 보내기
// - purpose 'signup': 가입 전이라 로그인 없이 { email }
// - purpose 'change': 로그인한 사용자가 복구 이메일 등록·변경 { id, token, email }
export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const purpose = b.purpose;
  const email = normEmail(b.email);

  if (purpose !== 'signup' && purpose !== 'change') return json({ ok: false, msg: '[시스템] 잘못된 요청입니다.' });
  if (!validEmail(email)) return json({ ok: false, msg: '[시스템] 이메일 주소를 다시 확인해주세요.' });

  let target = email;
  if (purpose === 'change') {
    const id = (b.id || '').trim();
    const me = await env.DB.prepare('SELECT session_token, email FROM users WHERE id = ?').bind(id).first();
    if (!me || me.session_token !== (b.token || '')) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });
    if (me.email === email) return json({ ok: false, msg: '[시스템] 이미 등록된 이메일이에요.' });
    target = id;
  }

  const taken = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (taken) return json({ ok: false, msg: '[시스템] 이미 다른 계정에 등록된 이메일이에요.' });

  const r = await issueCode(env, request, purpose, target, email);
  if (!r.ok) return json(r);
  return json({ ok: true, msg: '[시스템] 인증번호를 보냈어요. 메일함(스팸함 포함)을 확인해주세요.' });
}
