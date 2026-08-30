import { json, readJson } from '../_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  if (!id || !token) return json({ ok: false });

  const row = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!row || row.session_token !== token) return json({ ok: false });

  await env.DB.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").bind(id).run();

  let partnerNickname = null;
  if (row.partner_id) {
    const p = await env.DB.prepare('SELECT nickname FROM users WHERE id = ?').bind(row.partner_id).first();
    partnerNickname = p ? p.nickname : null;
  }

  return json({
    ok: true,
    user: {
      id: row.id, nickname: row.nickname, gender: row.gender, birth: row.birth,
      partnerId: row.partner_id, partnerNickname, startDate: row.start_date, linked: !!row.linked
    }
  });
}
