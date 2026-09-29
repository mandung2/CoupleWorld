import { json, readJson, coupleKey } from '../_lib.js';

// Mirrors the QUESTS array in index.html — kept server-side so a reward
// can't be replayed by re-sending the same questId after a page refresh.
const QUEST_REWARDS = {
  login: 30, profile: 50, record: 50, region: 80, map3: 60, shop: 40,
};

const QUEST_CHECKS = {
  record: (env, id) => env.DB.prepare('SELECT 1 FROM memories WHERE author_id = ? LIMIT 1').bind(id).first(),
  region: (env, id, partnerId) => env.DB.prepare('SELECT 1 FROM visited_regions WHERE couple_key = ? LIMIT 1')
    .bind(coupleKey(id, partnerId)).first(),
  shop: (env, id) => env.DB.prepare('SELECT 1 FROM user_items WHERE user_id = ? LIMIT 1').bind(id).first(),
};

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const questId = (b.questId || '').trim();
  const reward = QUEST_REWARDS[questId];

  if (!reward) return json({ ok: false, msg: '[시스템] 알 수 없는 퀘스트입니다.' });

  const me = await env.DB.prepare('SELECT session_token, points, partner_id FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });
  // 화면과 같이, 퀘스트는 커플섬 연결 후에만 보상
  if (!me.partner_id) return json({ ok: false, msg: '[시스템] 커플섬 연결 후 이용할 수 있어요.' });
  // 서버에서 확인할 수 있는 퀘스트는 실제로 했는지 확인 (profile·map3는 기록이 서버에 없어 확인 불가)
  const check = QUEST_CHECKS[questId];
  if (check && !(await check(env, id, me.partner_id))) {
    return json({ ok: false, msg: '[시스템] 아직 퀘스트 조건을 달성하지 않았어요.' });
  }

  const inserted = await env.DB.prepare(
    'INSERT OR IGNORE INTO quest_completions (user_id, quest_id) VALUES (?, ?)'
  ).bind(id, questId).run();

  if (inserted.meta.changes === 0) {
    return json({ ok: true, points: me.points || 0, awarded: false });
  }

  await env.DB.prepare('UPDATE users SET points = points + ? WHERE id = ?').bind(reward, id).run();
  const row = await env.DB.prepare('SELECT points FROM users WHERE id = ?').bind(id).first();

  return json({ ok: true, points: row.points, awarded: true });
}
