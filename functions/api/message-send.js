import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const body = (b.body || '').trim();

  if (!body) return json({ ok: false, msg: '[시스템] 메시지를 입력하세요.' });

  const me = await env.DB.prepare('SELECT session_token, partner_id FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });
  if (!me.partner_id) return json({ ok: false, msg: '[시스템] 커플섬 연결 후 이용할 수 있어요.' });

  const msgId = crypto.randomUUID();
  await env.DB.prepare(
    'INSERT INTO messages (id, from_id, to_id, body) VALUES (?, ?, ?, ?)'
  ).bind(msgId, id, me.partner_id, body).run();

  const row = await env.DB.prepare('SELECT * FROM messages WHERE id = ?').bind(msgId).first();
  return json({ ok: true, item: row });
}
