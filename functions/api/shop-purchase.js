import { json, readJson } from '../_lib.js';

// Records a real sale for the admin dashboard's shop stats, and deducts
// the item's price from the buyer's server-tracked point balance (using
// the server's own price for the item rather than trusting a
// client-supplied amount).
export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const itemName = (b.itemName || '').trim();

  const me = await env.DB.prepare('SELECT session_token, points FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  const item = await env.DB.prepare('SELECT item_id, price FROM shop_items WHERE name = ?').bind(itemName).first();
  if (!item) return json({ ok: false, msg: '[시스템] 존재하지 않는 아이템입니다.' });
  if ((me.points || 0) < item.price) return json({ ok: false, msg: '[시스템] 포인트가 부족합니다.' });

  await env.DB.batch([
    env.DB.prepare('UPDATE shop_items SET sold = sold + 1, revenue = revenue + ? WHERE item_id = ?')
      .bind(item.price, item.item_id),
    env.DB.prepare('UPDATE users SET points = points - ? WHERE id = ?').bind(item.price, id),
  ]);

  const row = await env.DB.prepare('SELECT points FROM users WHERE id = ?').bind(id).first();
  return json({ ok: true, points: row.points });
}
