import { z } from 'zod';
import { resolveSide, resolveWinner } from '../dist/model.js';

const group = z.enum(['A', 'B', 'C', 'D']);
const text = (max = 200) => z.string().max(max);
const teamId = z.number().int().min(0).max(11);
const score = z.number().int().min(0).max(999).nullable();
const source = z.discriminatedUnion('type', [
  z.object({ type: z.literal('team'), teamId }).strict(),
  z.object({ type: z.literal('groupRank'), group, rank: z.union([z.literal(1), z.literal(2)]) }).strict(),
  z.object({ type: z.literal('winner'), matchId: text(20) }).strict(),
  z.object({ type: z.literal('loser'), matchId: text(20) }).strict(),
]);
const schema = z.object({
  schemaVersion: z.literal(1),
  updatedAt: z.string().datetime().nullable(),
  settings: z.object({
    title: text(120).trim().min(1), heroLine1: text(120).trim().min(1), heroLine2: text(120).trim().min(1),
    description: text(2000), notice: text(3000),
    pointsWin: z.number().int().min(0).max(100), pointsDraw: z.number().int().min(0).max(100), pointsLoss: z.number().int().min(0).max(100),
  }).strict(),
  teams: z.array(z.object({
    id: teamId, name: text(120).trim().min(1), alias: text(120), group, captain: text(160), status: text(160),
    declared: z.number().int().min(0).max(100).nullable(),
    players: z.array(z.object({ id: text(80).regex(/^[a-zA-Z0-9_-]+$/), name: text(160).trim().min(1), number: text(12).nullable() }).strict()).max(100),
  }).strict()).length(12),
  matches: z.array(z.object({
    id: text(20), stage: z.enum(['group', 'quarter', 'semi', 'third', 'final']), group: group.nullable(), home: source, away: source,
    date: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
    time: z.union([z.literal(''), z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)]), venue: text(240),
    status: z.enum(['scheduled', 'finished', 'postponed']), homeScore: score, awayScore: score, winnerTeamId: teamId.nullable(),
  }).strict()).length(20),
  qualifiers: z.object(Object.fromEntries(['A', 'B', 'C', 'D'].map(g => [g, z.object({ first: teamId.nullable(), second: teamId.nullable() }).strict()]))).strict(),
}).strict();

const knockout = [
  ['TK1', 'quarter', { type: 'groupRank', group: 'A', rank: 1 }, { type: 'groupRank', group: 'C', rank: 2 }],
  ['TK2', 'quarter', { type: 'groupRank', group: 'B', rank: 1 }, { type: 'groupRank', group: 'D', rank: 2 }],
  ['TK3', 'quarter', { type: 'groupRank', group: 'C', rank: 1 }, { type: 'groupRank', group: 'B', rank: 2 }],
  ['TK4', 'quarter', { type: 'groupRank', group: 'D', rank: 1 }, { type: 'groupRank', group: 'A', rank: 2 }],
  ['BK1', 'semi', { type: 'winner', matchId: 'TK1' }, { type: 'winner', matchId: 'TK2' }],
  ['BK2', 'semi', { type: 'winner', matchId: 'TK3' }, { type: 'winner', matchId: 'TK4' }],
  ['THIRD', 'third', { type: 'loser', matchId: 'BK1' }, { type: 'loser', matchId: 'BK2' }],
  ['FINAL', 'final', { type: 'winner', matchId: 'BK1' }, { type: 'winner', matchId: 'BK2' }],
];

function equalSource(a, b) {
  return a?.type === b?.type && (a.type === 'team' ? a.teamId === b.teamId : a.type === 'groupRank' ? a.group === b.group && a.rank === b.rank : a.matchId === b.matchId);
}

export function validateContent(input) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: `Dữ liệu không hợp lệ tại ${parsed.error.issues[0]?.path.join('.') || 'nội dung'}.` };
  const content = parsed.data;
  const fail = error => ({ ok: false, error });
  if (new Set(content.teams.map(t => t.id)).size !== 12) return fail('Mã đội bị trùng hoặc thiếu.');
  const playerIds = content.teams.flatMap(t => t.players.map(p => p.id));
  if (new Set(playerIds).size !== playerIds.length) return fail('Mã cầu thủ bị trùng.');
  if (new Set(content.matches.map(m => m.id)).size !== 20) return fail('Mã trận đấu bị trùng.');
  for (const g of ['A', 'B', 'C', 'D']) {
    const ids = content.teams.filter(t => t.group === g).map(t => t.id).sort((a, b) => a - b);
    if (ids.length !== 3) return fail(`Bảng ${g} phải có đúng 3 đội.`);
    const ranks = content.qualifiers[g];
    if ([ranks.first, ranks.second].some(id => id !== null && !ids.includes(id))) return fail(`Suất đi tiếp bảng ${g} phải thuộc đội trong bảng.`);
    if (ranks.first !== null && ranks.first === ranks.second) return fail(`Nhất và nhì bảng ${g} không thể cùng một đội.`);
    for (const [index, [a, b]] of [[0, 1], [0, 2], [1, 2]].entries()) {
      const m = content.matches.find(m => m.id === `${g}${index + 1}`);
      if (!m || m.stage !== 'group' || m.group !== g || m.home.type !== 'team' || m.away.type !== 'team' ||
          new Set([m.home.teamId, m.away.teamId, ids[a], ids[b]]).size !== 2 || m.home.teamId === m.away.teamId) {
        return fail(`Cặp đấu vòng bảng ${g}${index + 1} không khớp phân bảng.`);
      }
    }
  }
  for (const [id, stage, home, away] of knockout) {
    const m = content.matches.find(m => m.id === id);
    if (!m || m.stage !== stage || m.group !== null || !equalSource(m.home, home) || !equalSource(m.away, away)) return fail(`Nhánh đấu ${id} không khớp sơ đồ giải.`);
  }
  for (const m of content.matches) {
    const calendarDate = m.date ? new Date(`${m.date}T00:00:00Z`) : null;
    if (calendarDate && (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== m.date)) return fail(`Ngày của trận ${m.id} không hợp lệ.`);
    if (m.status === 'finished') {
      if (m.homeScore === null || m.awayScore === null) return fail(`Trận ${m.id} đã kết thúc cần đủ hai tỷ số.`);
      const home = resolveSide(m.home, content).id;
      const away = resolveSide(m.away, content).id;
      if (home === null || away === null || home === away) return fail(`Trận ${m.id} chưa xác định đủ hai đội.`);
      if (m.stage === 'group' && m.winnerTeamId !== null) return fail(`Trận vòng bảng ${m.id} không cần chọn đội thắng luân lưu.`);
      if (m.stage !== 'group') {
        if (m.winnerTeamId !== null && ![home, away].includes(m.winnerTeamId)) return fail(`Đội thắng trận ${m.id} không thuộc cặp đấu.`);
        if (m.homeScore !== m.awayScore && m.winnerTeamId !== null && m.winnerTeamId !== (m.homeScore > m.awayScore ? home : away)) return fail(`Đội thắng trận ${m.id} không khớp tỷ số.`);
        if (resolveWinner(m, content) === null) return fail(`Trận ${m.id} hòa cần xác nhận đội thắng luân lưu.`);
      }
    } else if (m.homeScore !== null || m.awayScore !== null || m.winnerTeamId !== null) {
      return fail(`Trận ${m.id} chưa kết thúc cần để trống kết quả.`);
    }
  }
  return { ok: true, content };
}
