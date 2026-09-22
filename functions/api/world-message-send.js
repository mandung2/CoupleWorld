import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const body = (b.body || '').trim();

  if (!body) return json({ ok: false, msg: '[시스템] 메시지를 입력하세요.' });
  if (body.length > 300) return json({ ok: false, msg: '[시스템] 메시지는 300자 이내로 입력하세요.' });

  const me = await env.DB.prepare('SELECT session_token, nickname FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  const msgId = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO world_messages (id, from_id, from_nickname, body) VALUES (?, ?, ?, ?)'
  ).bind(msgId, id, me.nickname, body).run();

  const row = await env.DB.prepare('SELECT * FROM world_messages WHERE id = ?').bind(msgId).first();
  return json({ ok: true, item: row });
}
