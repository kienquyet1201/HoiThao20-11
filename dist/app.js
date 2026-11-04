import { renderMatchCards, renderScorerCards, renderStandingCards, renderBracketTree } from './tournament-ui.js';
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
  const matches = getScheduledMatches(content, { stage, group, order: $('#schedule-sort').value });
  $('#schedule-summary').textContent = `${matches.length} trận đã xếp lịch${stage === 'group' && group ? ` · Bảng ${group}` : ''} · Giờ Việt Nam (UTC+7)`;
  $('#matches').innerHTML = renderMatchCards(content, matches) || '<p class="empty">Chưa có trận đấu được xếp đủ ngày và giờ.</p>';
}

function renderScorers() { $('#scorer-list').innerHTML = renderScorerCards(content); }

function renderGroups() {
  $('#group-grid').innerHTML = renderStandingCards(content);
  const rules = content.settings;
  $('#group-note').textContent = `Điểm thắng / hòa / thua: ${rules.pointsWin} / ${rules.pointsDraw} / ${rules.pointsLoss}. Xếp hạng theo điểm → hiệu số → bàn thắng; bằng cả ba chỉ số thì đồng hạng. Dấu “—” là chưa thi đấu. Suất vào tứ kết do BTC xác nhận. Điểm chỉ tính từ trận đã kết thúc.`;
}

function renderBracket() { $('#bracket-content').innerHTML = renderBracketTree(content); }

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
  if (button && button.dataset.team !== '' && content) showTeam(Number(button.dataset.team));
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

$('#schedule-sort').addEventListener('change', () => { if (content) renderMatches(); });
