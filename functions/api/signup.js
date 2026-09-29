import { json, readJson, makePasswordHash, randomHex, validPassword, validDate, validId } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const password = String(b.password || '');
  const nickname = (b.nickname || '').trim();
  const gender = b.gender;
  const birth = (b.birth || '').trim();

  if (!id || !password || !nickname || !gender || !birth) return json({ ok: false, msg: '[시스템] 모든 항목을 입력하세요.' });
  if (!validId(id)) return json({ ok: false, msg: '[시스템] 아이디는 영문·숫자·밑줄(_) 3~20자로 입력하세요.' });
  if (nickname.length > 12) return json({ ok: false, msg: '[시스템] 닉네임은 12자 이내로 입력하세요.' });
  if (!validPassword(password)) return json({ ok: false, msg: '[시스템] 비밀번호는 8~16자이며 특수문자를 2개 이상 포함해야 합니다.' });
  if (gender !== 'F' && gender !== 'M') return json({ ok: false, msg: '[시스템] 성별을 선택하세요.' });
  if (!validDate(birth)) return json({ ok: false, msg: '[시스템] 생년월일을 입력하세요.' });

  const existing = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(id).first();
  if (existing) return json({ ok: false, msg: '[시스템] 이미 사용 중인 아이디입니다.' });
  const nickTaken = await env.DB.prepare('SELECT id FROM users WHERE nickname = ?').bind(nickname).first();
  if (nickTaken) return json({ ok: false, msg: '[시스템] 이미 사용 중인 닉네임입니다.' });

  const passwordHash = await makePasswordHash(password);
  const token = randomHex(24);
  await env.DB.prepare(
    "INSERT INTO users (id, password_hash, nickname, gender, birth, session_token, last_login) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))"
  ).bind(id, passwordHash, nickname, gender, birth, token).run();

  return json({ ok: true, token, user: { id, nickname, gender, birth, partnerId: null, partnerNickname: null, startDate: null, linked: false } });
}
