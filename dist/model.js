const STAGE_NAMES = { group: 'Vòng bảng', quarter: 'Tứ kết', semi: 'Bán kết', third: 'Tranh giải ba', final: 'Chung kết' };

export function matchLabel(match) {
  if (!match) return 'Trận đấu';
  return match.stage === 'group' ? `Bảng ${match.group} · ${match.id}` : `${STAGE_NAMES[match.stage] || 'Trận đấu'}${match.stage === 'quarter' || match.stage === 'semi' ? ` · ${match.id}` : ''}`;
}

function finishedScore(match) {
  return match?.status === 'finished' && Number.isInteger(match.homeScore) && match.homeScore >= 0 && Number.isInteger(match.awayScore) && match.awayScore >= 0;
}

function winnerFor(match, content, visiting) {
  if (!finishedScore(match) || visiting.has(match.id)) return null;
  const next = new Set(visiting).add(match.id);
  const home = sideFor(match.home, content, next);
  const away = sideFor(match.away, content, next);
  if (home.id === null || away.id === null || home.id === away.id) return null;
  if (match.homeScore > match.awayScore) return home.id;
  if (match.awayScore > match.homeScore) return away.id;
  return [home.id, away.id].includes(match.winnerTeamId) ? match.winnerTeamId : null;
}

function sideFor(source, content, visiting) {
  const teams = content?.teams || [];
  if (!source) return { id: null, name: 'Chưa xác định' };
  if (source.type === 'team') {
    const team = teams.find(item => item.id === source.teamId);
    return team ? { id: team.id, name: team.name } : { id: null, name: 'Chưa xác định' };
  }
  if (source.type === 'groupRank') {
    const label = `${source.rank === 1 ? 'Nhất' : 'Nhì'} bảng ${source.group}`;
    const id = content?.qualifiers?.[source.group]?.[source.rank === 1 ? 'first' : 'second'];
    const team = teams.find(item => item.id === id && item.group === source.group);
    return team ? { id: team.id, name: team.name } : { id: null, name: label };
  }
  if (source.type === 'winner' || source.type === 'loser') {
    const label = `${source.type === 'winner' ? 'Thắng' : 'Thua'} ${source.matchId}`;
    const match = content?.matches?.find(item => item.id === source.matchId);
    const winner = match ? winnerFor(match, content, visiting) : null;
    if (winner === null) return { id: null, name: label };
    if (source.type === 'winner') {
      const team = teams.find(item => item.id === winner);
      return team ? { id: team.id, name: team.name } : { id: null, name: label };
    }
    const next = new Set(visiting).add(match.id);
    const participants = [sideFor(match.home, content, next), sideFor(match.away, content, next)];
    const loser = participants.find(item => item.id !== null && item.id !== winner);
    return loser || { id: null, name: label };
  }
  return { id: null, name: 'Chưa xác định' };
}

export function resolveSide(source, content) {
  return sideFor(source, content, new Set());
}

export function resolveWinner(match, content) {
  return winnerFor(match, content, new Set());
}

export function getStandings(content, group) {
  const qualifiers = content?.qualifiers?.[group] || {};
  const rows = (content?.teams || []).filter(team => team.group === group).map(team => ({
    team, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0,
    rank: qualifiers.first === team.id ? 1 : qualifiers.second === team.id ? 2 : null
  }));
  const byId = new Map(rows.map(row => [row.team.id, row]));
  const points = {
    win: Number.isFinite(content?.settings?.pointsWin) ? content.settings.pointsWin : 3,
    draw: Number.isFinite(content?.settings?.pointsDraw) ? content.settings.pointsDraw : 1,
    loss: Number.isFinite(content?.settings?.pointsLoss) ? content.settings.pointsLoss : 0
  };
  for (const match of content?.matches || []) {
    if (match.stage !== 'group' || match.group !== group || !finishedScore(match)) continue;
    const home = byId.get(resolveSide(match.home, content).id);
    const away = byId.get(resolveSide(match.away, content).id);
    if (!home || !away || home === away) continue;
    home.played++; away.played++;
    home.gf += match.homeScore; home.ga += match.awayScore;
    away.gf += match.awayScore; away.ga += match.homeScore;
    if (match.homeScore > match.awayScore) {
      home.won++; away.lost++; home.points += points.win; away.points += points.loss;
    } else if (match.homeScore < match.awayScore) {
      away.won++; home.lost++; away.points += points.win; home.points += points.loss;
    } else {
      home.drawn++; away.drawn++; home.points += points.draw; away.points += points.draw;
    }
  }
  rows.forEach(row => { row.gd = row.gf - row.ga; });
  return rows.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
}
