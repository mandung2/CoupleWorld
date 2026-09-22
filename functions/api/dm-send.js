import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const targetId = (b.targetId || '').trim();
  const body = (b.body || '').trim();

  if (!targetId) return json({ ok: false, msg: '[시스템] 대상을 찾을 수 없습니다.' });
  if (!body) return json({ ok: false, msg: '[시스템] 메시지를 입력하세요.' });
  if (body.length > 300) return json({ ok: false, msg: '[시스템] 메시지는 300자 이내로 입력하세요.' });
  if (targetId === id) return json({ ok: false, msg: '[시스템] 자기 자신에게는 보낼 수 없습니다.' });

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  const target = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(targetId).first();
  if (!target) return json({ ok: false, msg: '[시스템] 존재하지 않는 사용자입니다.' });

  const msgId = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO dm_messages (id, from_id, to_id, body) VALUES (?, ?, ?, ?)'
  ).bind(msgId, id, targetId, body).run();

  const row = await env.DB.prepare('SELECT * FROM dm_messages WHERE id = ?').bind(msgId).first();
  return json({ ok: true, item: row });
}
