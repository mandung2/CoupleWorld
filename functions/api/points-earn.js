import { json, readJson } from '../_lib.js';

// Mirrors the QUESTS array in index.html — kept server-side so a reward
// can't be replayed by re-sending the same questId after a page refresh.
const QUEST_REWARDS = {
  login: 30, profile: 50, record: 50, region: 80, map3: 60, shop: 40,
};

export async function onRequestPost({ request, env }) {
  const b = await readJson(request);
  const id = (b.id || '').trim();
  const token = b.token || '';
  const questId = (b.questId || '').trim();
  const reward = QUEST_REWARDS[questId];

  if (!reward) return json({ ok: false, msg: '[시스템] 알 수 없는 퀘스트입니다.' });

  const me = await env.DB.prepare('SELECT session_token, points FROM users WHERE id = ?').bind(id).first();
  if (!me || me.session_token !== token) return json({ ok: false, msg: '[시스템] 로그인이 필요합니다.' });

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
