import { json, readJson, normEmail, consumeCode } from '../_lib.js';

// 로그인한 사용자의 복구 이메일 등록·변경 확인 { id, token, email, code }
export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const email = normEmail(b.email);

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== (b.token || '')) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  const check = await consumeCode(env, 'change', id, b.code, email);
  if (!check.ok) return json(check);

  try {
    await env.DB.prepare('UPDATE users SET email = ? WHERE id = ?').bind(email, id).run();
  } catch (e) {
    // 인증하는 사이에 다른 계정이 같은 주소를 등록함 (UNIQUE 인덱스)
    return json({ ok: false, msg: '[시스템] 이미 다른 계정에 등록된 이메일이에요.' });
  }
  return json({ ok: true, email, msg: '[시스템] 복구 이메일이 등록됐어요.' });
}
