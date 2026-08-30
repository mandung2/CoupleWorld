import { json, readJson } from '../_lib.js';

// Records a real sale for the admin dashboard's shop stats. The client
// still gates the purchase locally against its own point balance (points
// aren't server-tracked yet) — this endpoint only records that a purchase
// happened, using the server's own price for the item rather than trusting
// a client-supplied amount.
export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const itemName = (b.itemName || '').trim();

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  const item = await env.DB.prepare('SELECT item_id, price FROM shop_items WHERE name = ?').bind(itemName).first();
  if (!item) return json({ ok: false, msg: '[시스템] 존재하지 않는 아이템입니다.' });

  await env.DB.prepare('UPDATE shop_items SET sold = sold + 1, revenue = revenue + ? WHERE item_id = ?')
    .bind(item.price, item.item_id)
    .run();

  return json({ ok: true });
}
