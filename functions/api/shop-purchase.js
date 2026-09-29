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

  const me = await env.DB.prepare('SELECT session_token FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

  const item = await env.DB.prepare('SELECT item_id, price FROM shop_items WHERE name = ?').bind(itemName).first();
  if (!item) return json({ ok: false, msg: '[시스템] 존재하지 않는 아이템입니다.' });
  const owned = await env.DB.prepare('SELECT 1 FROM user_items WHERE user_id = ? AND item_name = ?').bind(id, itemName).first();
  if (owned) return json({ ok: false, msg: '[시스템] 이미 가지고 있는 아이템입니다.' });

  // 잔액 확인과 차감을 한 문장으로 — 동시에 여러 번 눌러도 포인트가 음수가 되지 않음
  const paid = await env.DB.prepare('UPDATE users SET points = points - ? WHERE id = ? AND points >= ?')
    .bind(item.price, id, item.price).run();
  if (paid.meta.changes === 0) return json({ ok: false, msg: '[시스템] 포인트가 부족합니다.' });

  const got = await env.DB.prepare('INSERT OR IGNORE INTO user_items (user_id, item_name) VALUES (?, ?)').bind(id, itemName).run();
  if (got.meta.changes === 0) {
    // 동시에 들어온 같은 구매 요청이 먼저 처리됨 — 이번 차감은 되돌림
    await env.DB.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(item.price, id).run();
    return json({ ok: false, msg: '[시스템] 이미 가지고 있는 아이템입니다.' });
  }
  await env.DB.prepare('UPDATE shop_items SET sold = sold + 1, revenue = revenue + ? WHERE item_id = ?')
    .bind(item.price, item.item_id).run();

  const row = await env.DB.prepare('SELECT points FROM users WHERE id = ?').bind(id).first();
  return json({ ok: true, points: row.points });
}
