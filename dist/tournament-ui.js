import { resolveSide, resolveWinner, getStandings, getTopScorers, matchLabel } from './model.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const score = value => Number.isInteger(value) ? value : '—';
const dateLabel = value => value ? value.split('-').reverse().join('/') : 'Chờ công bố';
const teamById = (content, id) => content.teams.find(team => team.id === id);

export function crest(team) {
  const label = team ? `${team.group}` : '?';
  return `<svg class="ui-crest" viewBox="0 0 48 52" aria-hidden="true"><path d="M24 2 44 9v18c0 12-12 20-20 23C16 47 4 39 4 27V9Z" fill="currentColor" fill-opacity=".12" stroke="currentColor" stroke-width="1.5"/><path d="M13 15h22M14 36l20-20" stroke="currentColor" stroke-opacity=".2" stroke-width="4"/><text x="24" y="32" text-anchor="middle" fill="currentColor" font-size="15" font-weight="800">${label}</text></svg>`;
}

export function renderMatchCards(content, matches) {
  return matches.map(match => {
    const home = resolveSide(match.home, content), away = resolveSide(match.away, content);
    const live = match.status === 'live', finished = match.status === 'finished';
    const winner = resolveWinner(match, content);
    const status = live ? `<span class="ui-live"><i></i> LIVE ${match.liveMinute != null ? `· ${match.liveMinute}′` : ''}</span>` : `<span>${finished ? 'ĐÃ KẾT THÚC' : match.status === 'postponed' ? 'TẠM HOÃN' : 'SẮP DIỄN RA'}</span>`;
    const side = (value, label) => `<div class="ui-side">${crest(teamById(content, value.id))}<button data-team="${value.id ?? ''}" ${value.id === null ? 'disabled' : ''} aria-label="Xem đội ${esc(value.name)}"><strong>${esc(value.name)}</strong></button><small>${label}</small></div>`;
    return `<article class="ui-match ${live ? 'ui-match-live' : ''}" data-match-id="${esc(match.id)}"><div class="ui-match-top"><span>${esc(matchLabel(match))}</span>${status}</div><div class="ui-match-body">${side(home, 'ĐỘI NHÀ')}<div class="ui-match-center">${finished || live ? `<p class="ui-score" aria-label="Tỷ số ${score(match.homeScore)} - ${score(match.awayScore)}">${score(match.homeScore)}<span>:</span>${score(match.awayScore)}</p><small>${live ? `${match.liveMinute ?? '—'}′` : 'FT'}</small><time datetime="${esc(match.date)}">${dateLabel(match.date)}</time>` : `<time datetime="${esc(match.date)}T${esc(match.time)}:00+07:00"><strong class="ui-kickoff">${esc(match.time)}</strong><span>${dateLabel(match.date)}</span></time>`}</div>${side(away, 'ĐỘI KHÁCH')}</div><div class="ui-match-venue">${esc(match.venue || 'Sân chưa công bố')}</div>${finished && match.homeScore === match.awayScore && winner !== null ? `<p class="ui-tiebreak">Đội thắng luân lưu: ${esc(teamById(content,winner)?.name)}</p>` : ''}</article>`;
  }).join('');
}

export function renderScorerCards(content) {
  const rows = getTopScorers(content);
  if (!rows.length) return '<p class="empty">Chưa có dữ liệu ghi bàn. BTC sẽ cập nhật sau các trận đấu.</p>';
  // Retain all joint leaders and all other scorers instead of hiding ties at position five.
  const leaders = rows.filter(row => row.rank === 1), others = rows.filter(row => row.rank !== 1);
  const max = rows[0].goals;
  return `<div class="ui-scorer-leaders">${leaders.map(row => `<article class="ui-scorer-hero"><img class="${row.player.id === 't3-p12' ? 'ui-real-portrait' : ''}" src="${row.player.id === 't3-p12' ? '/scorer-portrait.svg' : '/player-illustration.svg'}" alt="${row.player.id === 't3-p12' ? 'Ảnh cầu thủ ' + esc(row.player.name) : 'Chân dung cầu thủ minh họa'}"/><div class="ui-scorer-copy"><p class="ui-eyebrow">${leaders.length > 1 ? 'ĐỒNG DẪN ĐẦU' : 'DẪN ĐẦU CUỘC ĐUA'}</p><p class="ui-goals">${row.goals}<small>BÀN THẮNG</small></p><h3>${esc(row.player.name)}</h3><button data-team="${row.team.id}">${esc(row.team.name)}</button>${row.player.id === 't3-p12' ? '' : '<small class="ui-portrait-note">Hình minh họa</small>'}</div></article>`).join('')}</div>${others.length ? `<ol class="ui-scorer-list" aria-label="Danh sách cầu thủ ghi bàn">${others.map(row => `<li><span class="ui-rank">${row.rank}</span>${crest(row.team)}<div class="ui-scorer-info"><h3>${esc(row.player.name)}</h3><button data-team="${row.team.id}">${esc(row.team.name)}</button><div role="progressbar" aria-label="Số bàn của ${esc(row.player.name)} so với người dẫn đầu" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${row.goals}" class="ui-progress"><span style="width:${row.goals / max * 100}%"></span></div></div><strong>${row.goals}<small>bàn</small></strong></li>`).join('')}</ol>` : ''}`;
}

export function renderStandingCards(content) {
  return ['A','B','C','D'].map(group => {
    const rows = getStandings(content, group), qualifiers = content.qualifiers[group];
    return `<article class="ui-group"><h3>Bảng ${group}<small>03 ĐỘI</small></h3><div class="ui-standing-row ui-standing-head" aria-hidden="true"><span>#</span><span>Đội bóng</span><span>Trận</span><span>HS</span><span>Điểm</span></div><ol aria-label="Xếp hạng bảng ${group}">${rows.map(row => {
      const confirmed = [qualifiers.first, qualifiers.second].includes(row.team.id);
      const leading = row.rank !== null && row.rank <= 2;
      return `<li class="ui-standing-row ${confirmed ? 'ui-qualified' : leading ? 'ui-leading' : ''}"><span class="ui-rank">${row.rank ?? '—'}</span><div><button data-team="${row.team.id}">${esc(row.team.name)}</button>${confirmed ? '<small>Đã xác nhận vào tứ kết</small>' : leading ? '<small>Nhóm dẫn đầu tạm thời</small>' : ''}</div><span>${row.played}</span><span>${row.gd > 0 ? '+' : ''}${row.gd}</span><strong>${row.points}</strong></li>`;
    }).join('')}</ol></article>`;
  }).join('');
}

export function renderBracketTree(content) {
  const rounds = [{stage:'quarter',label:'TỨ KẾT',tops:[48,240,432,624]},{stage:'semi',label:'BÁN KẾT',tops:[144,528]},{stage:'final',label:'CHUNG KẾT',tops:[336]}];
  const width = 300, gap = 80, height = 160;
  const positions = new Map();
  rounds.forEach((round,column) => content.matches.filter(m => m.stage === round.stage).forEach((m,index) => positions.set(m.id,{x:column*(width+gap),y:round.tops[index],match:m})));
  const eliminated = match => {
    const next = content.matches.find(m => m.stage !== 'third' && [m.home,m.away].some(s=>s.type==='winner' && s.matchId===match.id));
    const winner=resolveWinner(match,content), nextWinner=resolveWinner(next,content);
    return winner !== null && nextWinner !== null && winner !== nextWinner;
  };
  const paths=[];
  for (const [id,end] of positions) for (const source of [end.match.home,end.match.away]) {
    if(source.type!=='winner' || !positions.has(source.matchId)) continue;
    const start=positions.get(source.matchId), x1=start.x+width, y1=start.y+height/2, x2=end.x, y2=end.y+height/2, mid=(x1+x2)/2;
    const resolved=resolveWinner(start.match,content)!==null, faded=eliminated(start.match);
    paths.push(`<path d="M${x1} ${y1} C${mid} ${y1},${mid} ${y2},${x2} ${y2}" class="${faded?'ui-path-lost':resolved?'ui-path-won':'ui-path-pending'}"/>`);
  }
  const fixture = match => {
    if(!match) return '';
    const winner=resolveWinner(match,content), home=resolveSide(match.home,content),away=resolveSide(match.away,content);
    return `<article class="ui-fixture ${eliminated(match)?'ui-branch-lost':''}"><small>${esc(matchLabel(match))}</small>${[home,away].map((side,index)=>`<div class="ui-fixture-side ${winner!==null ? winner===side.id?'ui-winner':'ui-loser':''}">${crest(teamById(content,side.id))}<span>${esc(side.name)}</span><strong>${score(index===0?match.homeScore:match.awayScore)}</strong></div>`).join('')}<p>${esc(match.date ? `${dateLabel(match.date)} · ${match.time || 'Chờ giờ'}`:'Chờ công bố lịch')}<br>${esc(match.venue || 'Sân chưa công bố')}</p></article>`;
  };
  const final=content.matches.find(m=>m.stage==='final'), champion=teamById(content,resolveWinner(final,content));
  return `<div class="ui-tree" style="width:1060px;height:1010px"><svg class="ui-connections" viewBox="0 0 1060 1010" aria-hidden="true">${paths.join('')}</svg>${rounds.map((round,column)=>`<section class="ui-round" style="left:${column*(width+gap)}px" aria-label="${round.label}"><h3>${round.label}</h3>${content.matches.filter(m=>m.stage===round.stage).map((m,index)=>`<div style="top:${round.tops[index]}px" class="ui-fixture-position">${fixture(m)}</div>`).join('')}${round.stage==='final'?`<div class="ui-champion"><p>NHÀ VÔ ĐỊCH</p><h3>${champion ? esc(champion.name):'Hành trình đang tiếp diễn'}</h3></div><div class="ui-third">${fixture(content.matches.find(m=>m.stage==='third'))}</div>`:''}</section>`).join('')}</div>`;
}
