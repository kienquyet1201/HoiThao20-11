import { resolveSide, resolveWinner, getStandings, matchLabel, getScheduledMatches, getTopScorers } from './model.js';

const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const normalize = value => String(value ?? '').toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const GROUPS = ['A', 'B', 'C', 'D'];
const STATUS = { scheduled: 'CHƯA THI ĐẤU', finished: 'ĐÃ KẾT THÚC', postponed: 'TẠM HOÃN' };
const INITIAL_SCHEDULE_NOTICE = 'Ngày, giờ, sân thi đấu và kết quả chưa được cung cấp. Các cặp vòng bảng dưới đây được lập từ danh sách bảng đấu; thứ tự thi đấu chờ BTC xác nhận.';
let content = null;
let stage = 'group';

function badge(team) {
  if (!team) return '<span class="badge" aria-hidden="true">?</span>';
  const ordinal = content.teams.filter(item => item.group === team.group).findIndex(item => item.id === team.id) + 1;
  return `<span class="badge" aria-hidden="true">${esc(team.group)}${ordinal}</span>`;
}

function teamFor(side) {
  return content.teams.find(team => team.id === side.id);
}

function dateLabel(date) {
  if (!date) return 'Ngày chưa công bố';
  const parts = date.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
}

function matchDetails(match) {
  const time = match.time ? `${match.time} (giờ Việt Nam)` : 'Giờ chưa công bố';
  return `${dateLabel(match.date)} · ${time} · ${match.venue || 'Sân chưa công bố'}`;
}

function score(value) {
  return Number.isInteger(value) ? String(value) : '—';
}

function showTeam(id) {
  const team = content?.teams.find(item => item.id === id);
  if (!team) return;
  $('#roster-content').innerHTML = `<div class="eyebrow red">BẢNG ${esc(team.group)} · DANH SÁCH ĐĂNG KÝ</div>
    <h2>${esc(team.name)}</h2>
    <p class="roster-meta">Tên đăng ký: ${esc(team.alias)}<br>Đội trưởng: ${esc(team.captain)}<br>Trạng thái: ${esc(team.status)}<br>${team.players.length} cầu thủ trong danh sách · Kê khai: ${esc(team.declared ?? 'Chưa cung cấp')}</p>
    ${team.declared !== null && team.declared !== undefined && team.declared !== team.players.length ? '<div class="notice">Số cầu thủ trong danh sách khác số lượng kê khai. Chờ BTC xác nhận danh sách chính thức.</div>' : ''}
    <p class="footnote">Dấu “—”: chưa có số áo trong dữ liệu đăng ký.</p>
    ${team.players.map(player => `<div class="player"><span class="number">${esc(player.number || '—')}</span><span>${esc(player.name)}</span>${normalize(player.name) === normalize(team.captain) ? '<span class="captain">ĐỘI TRƯỞNG</span>' : ''}</div>`).join('')}`;
  $('#roster').showModal();
}

function renderTeams() {
  const query = normalize($('#search').value);
  const result = content.teams.filter(team => normalize(`${team.name} ${team.alias} ${team.captain} ${team.players.map(player => player.name).join(' ')}`).includes(query));
  $('#team-grid').innerHTML = result.length ? result.map(team => `<button class="team-card" data-team="${team.id}">
    <span class="team-group">BẢNG ${esc(team.group)}</span>${badge(team)}<h3>${esc(team.name)}</h3>
    <p>${esc(team.alias)}<br>Đội trưởng: ${esc(team.captain)}</p>
    <div class="team-bottom"><span>${team.players.length} cầu thủ</span><b>Xem đội hình ↗</b></div></button>`).join('') : '<p class="empty">Không tìm thấy đội hoặc cầu thủ phù hợp.</p>';
}

function renderMatches() {
  const group = $('#schedule-group').value;
  const matches = getScheduledMatches(content, { stage, group });
  $('#schedule-summary').textContent = `${matches.length} trận đã xếp lịch${stage === 'group' && group ? ` · Bảng ${group}` : ''} · Giờ Việt Nam (UTC+7)`;
  $('#matches').innerHTML = matches.map(match => {
    const home = resolveSide(match.home, content);
    const away = resolveSide(match.away, content);
    const winner = resolveWinner(match, content);
    const tiedWinner = match.status === 'finished' && match.homeScore === match.awayScore && winner !== null ? content.teams.find(team => team.id === winner) : null;
    return `<article class="match ${match.status === 'finished' ? 'match-finished' : ''}" data-match-id="${esc(match.id)}">
      <div class="match-top"><span class="tag">${esc(matchLabel(match))}</span><span>${STATUS[match.status] || STATUS.scheduled}</span></div>
      <div class="match-time-block"><time class="match-date" datetime="${esc(match.date)}">${esc(dateLabel(match.date))}</time><time class="match-kickoff" datetime="${esc(match.date)}T${esc(match.time)}:00+07:00"><strong>${esc(match.time)}</strong><small>giờ Việt Nam</small></time></div>
      <div class="match-team ${winner !== null && winner === home.id ? 'is-winner' : ''}">${badge(teamFor(home))}<span>${esc(home.name)}</span><span class="score">${score(match.homeScore)}</span></div>
      <div class="match-team ${winner !== null && winner === away.id ? 'is-winner' : ''}">${badge(teamFor(away))}<span>${esc(away.name)}</span><span class="score">${score(match.awayScore)}</span></div>
      <div class="match-bottom"><span class="match-venue">⌖ ${esc(match.venue || 'Sân chưa công bố')}</span>${tiedWinner ? `<br><strong>Đội thắng: ${esc(tiedWinner.name)}</strong>` : ''}</div></article>`;
  }).join('') || `<p class="empty">${stage === 'group' ? 'Chưa có trận đấu được xếp đủ ngày và giờ trong bảng này.' : 'Lịch vòng loại trực tiếp chưa được công bố.'}</p>`;
}

function renderScorers() {
  const rows = getTopScorers(content);
  $('#scorer-list').innerHTML = rows.length ? `<div class="scorer-table-wrap"><table class="scorer-table"><caption class="sr-only">Bảng xếp hạng cầu thủ ghi bàn</caption><thead><tr><th scope="col">Hạng</th><th scope="col">Cầu thủ</th><th scope="col">Đội bóng</th><th scope="col">Bàn thắng</th></tr></thead><tbody>${rows.map(row => `<tr class="${row.rank === 1 ? 'scorer-leader' : ''}"><td>${row.rank === 1 ? '<span aria-hidden="true">★ </span>' : ''}${row.rank}</td><th scope="row">${esc(row.player.name)}<small>Số áo: ${esc(row.player.number || '—')}</small></th><td><button data-team="${row.team.id}">${esc(row.team.name)}</button></td><td><strong>${row.goals}</strong></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">Chưa có dữ liệu ghi bàn. Danh sách sẽ xuất hiện khi BTC cập nhật số bàn thắng của cầu thủ.</p>';
}

function renderGroups() {
  $('#group-grid').innerHTML = GROUPS.map(group => {
    const rows = getStandings(content, group);
    return `<article class="group"><h3>Bảng ${group}<span>${String(rows.length).padStart(2, '0')} ĐỘI</span></h3>
      <table><thead><tr><th>Hạng</th><th>Đội bóng</th><th>Trận</th><th>HS</th><th>Điểm</th></tr></thead><tbody>
      ${rows.map(row => `<tr><td>${row.rank ?? '—'}</td><td><button data-team="${row.team.id}">${esc(row.team.name)}</button></td><td>${row.played}</td><td>${row.gd > 0 ? '+' : ''}${row.gd}</td><td>${row.points}</td></tr>`).join('')}</tbody></table></article>`;
  }).join('');
  const rules = content.settings;
  $('#group-note').textContent = `Điểm thắng / hòa / thua: ${rules.pointsWin} / ${rules.pointsDraw} / ${rules.pointsLoss}. Thứ hạng và suất vào tứ kết do BTC xác nhận; dấu “—” là chưa xác nhận. Điểm chỉ tính từ trận đã kết thúc.`;
}

function bracketFixture(match, extraClass = '') {
  if (!match) return '';
  const home = resolveSide(match.home, content);
  const away = resolveSide(match.away, content);
  const winner = resolveWinner(match, content);
  return `<div class="fixture ${extraClass}"><small>${esc(matchLabel(match))}</small>
    <p class="${winner !== null && winner === home.id ? 'is-winner' : ''}"><span>${esc(home.name)}</span><b>${score(match.homeScore)}</b></p>
    <p class="${winner !== null && winner === away.id ? 'is-winner' : ''}"><span>${esc(away.name)}</span><b>${score(match.awayScore)}</b></p>
    <div class="fixture-details">${esc(matchDetails(match))}<br>${STATUS[match.status] || STATUS.scheduled}</div></div>`;
}

function renderBracket() {
  const matches = content.matches;
  const final = matches.find(match => match.stage === 'final');
  const winnerId = resolveWinner(final, content);
  const champion = content.teams.find(team => team.id === winnerId);
  $('#bracket-content').innerHTML = `<div class="round"><h3>TỨ KẾT</h3>${matches.filter(match => match.stage === 'quarter').map(match => bracketFixture(match)).join('')}</div>
    <div class="round semis"><h3>BÁN KẾT</h3>${matches.filter(match => match.stage === 'semi').map(match => bracketFixture(match)).join('')}</div>
    <div class="round finals"><h3>CHUNG KẾT</h3>${bracketFixture(final, 'featured')}${bracketFixture(matches.find(match => match.stage === 'third'), 'bronze')}</div>
    <div class="champion"><span aria-hidden="true">♜</span><small>${esc(content.settings.title)}</small><h3>${champion ? esc(champion.name) : 'NHÀ VÔ ĐỊCH'}</h3><p>${champion ? 'Chúc mừng nhà vô địch!' : 'Hành trình đang chờ phía trước'}</p></div>`;
}

function render() {
  const settings = content.settings;
  document.title = `${settings.title} — Trung tâm giải đấu`;
  $('#hero-line1').textContent = settings.heroLine1;
  $('#hero-line2').textContent = settings.heroLine2;
  $('#hero-description').textContent = settings.description;
  $('#tournament-notice').textContent = settings.notice === INITIAL_SCHEDULE_NOTICE && getScheduledMatches(content, { stage: 'all' }).length
    ? 'Lịch hiển thị các trận đã được xếp ngày và giờ. Thời gian thi đấu theo giờ Việt Nam (UTC+7).'
    : settings.notice;
  $('#tournament-notice').hidden = !settings.notice;
  $('#team-count').textContent = content.teams.length;
  $('#player-count').textContent = content.teams.reduce((total, team) => total + team.players.length, 0);
  $('#teams-heading').textContent = `${content.teams.length} đội. Một mục tiêu.`;
  const updated = content.updatedAt ? new Date(content.updatedAt) : null;
  $('#data-updated').textContent = updated && !Number.isNaN(updated.getTime()) ? `Cập nhật: ${updated.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` : 'Dữ liệu đăng ký ban đầu';
  renderScorers(); renderTeams(); renderMatches(); renderGroups(); renderBracket();
}

async function loadContent() {
  let lastError;
  for (const url of ['/api/content', '/content.json']) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const value = await response.json();
      if (value.schemaVersion !== 1 || !Array.isArray(value.teams) || !Array.isArray(value.matches) || !value.settings) throw new Error('Dữ liệu giải đấu không hợp lệ.');
      return value;
    } catch (error) { lastError = error; }
  }
  throw lastError;
}

loadContent().then(value => { content = value; render(); }).catch(() => {
  $('#matches').innerHTML = '<p class="empty" role="alert">Không thể tải dữ liệu giải đấu. Vui lòng tải lại trang.</p>';
  $('#scorer-list').innerHTML = '<p class="empty">Không thể tải danh sách vua phá lưới. Vui lòng tải lại trang.</p>';
  $('#team-grid').innerHTML = '<p class="empty">Dữ liệu đội bóng tạm thời chưa tải được.</p>';
});

document.addEventListener('click', event => {
  const button = event.target.closest('[data-team]');
  if (button && content) showTeam(Number(button.dataset.team));
  const tab = event.target.closest('[data-stage]');
  if (tab && content) {
    stage = tab.dataset.stage;
    document.querySelectorAll('[data-stage]').forEach(item => item.classList.toggle('active', item === tab));
    $('#schedule-group').hidden = stage !== 'group';
    renderMatches();
  }
});
$('#search').addEventListener('input', () => { if (content) renderTeams(); });
$('#schedule-group').addEventListener('change', () => { if (content) renderMatches(); });
$('.close').addEventListener('click', () => $('#roster').close());
$('#roster').addEventListener('click', event => {
  if (event.target !== $('#roster')) return;
  const rect = event.target.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close();
});
