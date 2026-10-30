import { resolveSide } from './model.js';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GROUPS = ['A', 'B', 'C', 'D'];
const STAGES = { group: 'Vòng bảng', quarter: 'Tứ kết', semi: 'Bán kết', third: 'Tranh giải ba', final: 'Chung kết' };
const STATUS = { scheduled: 'Chưa thi đấu', finished: 'Đã kết thúc', postponed: 'Hoãn thi đấu' };
const KNOCKOUT_ORDER = ['TK1', 'TK2', 'TK3', 'TK4', 'BK1', 'BK2', 'THIRD', 'FINAL'];
const TABS = [['teams', 'Đội & cầu thủ'], ['matches', 'Lịch & kết quả'], ['groups', 'Bảng & nhánh đấu'], ['settings', 'Thông tin giải']];
const state = { user: null, content: null, sha: null, dirty: false, saving: false, tab: 'teams', teamId: 0, matchStage: 'all', conflict: false };
let toastTimer;

function toast(message, error = false) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.toggle('error', error);
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, error ? 10000 : 6500);
}

async function request(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...options, signal: controller.signal });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || 'Yêu cầu chưa hoàn tất. Vui lòng thử lại.');
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('Kết nối mất quá nhiều thời gian. Vui lòng thử lại.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function renderAccount() {
  const node = $('#account');
  node.hidden = !state.user;
  node.innerHTML = state.user ? `<span class="account-name" title="${esc(state.user.login)}">${esc(state.user.login)}</span><button type="button" class="button text" data-action="logout">Đăng xuất</button>` : '';
}

const githubIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.1c-3.12.68-3.78-1.33-3.78-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.4-1.22.71-1.5-2.49-.28-5.11-1.24-5.11-5.54 0-1.22.44-2.22 1.16-3-.11-.29-.5-1.43.11-2.97 0 0 .94-.3 3.08 1.15a10.7 10.7 0 0 1 5.61 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.54.22 2.68.11 2.97.72.78 1.16 1.78 1.16 3 0 4.31-2.62 5.26-5.12 5.54.4.35.76 1.03.76 2.08v3.09c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z"/></svg>';

function renderSignIn(configured, missing = [], denied = false) {
  state.content = null;
  $('#app').setAttribute('aria-busy', 'false');
  const queryError = new URLSearchParams(location.search).get('error');
  const accessDenied = denied || queryError === 'AccessDenied';
  $('#app').innerHTML = `<section class="login-shell"><div class="login-art"><div class="eyebrow">KHU VỰC CHỦ SỞ HỮU</div><h1>Cập nhật giải đấu.<br><em>Ngay trên sân nhà.</em></h1><p>Chỉnh sửa đội bóng, cầu thủ, lịch thi đấu và kết quả trong một nơi. Khán giả luôn xem bản đã được xuất bản.</p></div><div class="login-form"><h2>Quản trị giải đấu</h2><p>Đăng nhập tài khoản GitHub <strong>kienquyet1201</strong> để chỉnh sửa website.</p>${accessDenied ? '<div class="notice error">Tài khoản này không có quyền chỉnh sửa. Chỉ chủ sở hữu kienquyet1201 được phép lưu thay đổi.</div>' : queryError ? '<div class="notice error">Chưa thể đăng nhập. Vui lòng thử lại bằng tài khoản chủ sở hữu.</div>' : ''}${!configured ? `<div class="notice warning"><strong>Đăng nhập chưa được cấu hình</strong><p>Chủ sở hữu cần thiết lập ứng dụng OAuth GitHub cho website và thêm hai biến môi trường trong Vercel:</p><ul class="setup-list"><li><code>AUTH_GITHUB_ID</code></li><li><code>AUTH_GITHUB_SECRET</code></li></ul><p>Callback URL: <code>${esc(location.origin)}/api/auth/callback/github</code></p><p>Sau khi lưu cấu hình, triển khai lại website rồi tải lại trang này.</p></div>` : ''}<button type="button" class="button github-button" data-action="login" ${configured ? '' : 'disabled'}>${githubIcon} Đăng nhập bằng GitHub</button><p class="login-small">Chỉ chủ sở hữu được phép lưu. Quyền truy cập luôn được kiểm tra trên máy chủ.</p></div></section>`;
  renderAccount();
}

function renderFailure(error) {
  $('#app').setAttribute('aria-busy', 'false');
  $('#app').innerHTML = `<section class="panel auth-error"><div class="eyebrow">CHƯA THỂ MỞ TRANG QUẢN TRỊ</div><h1>Không tải được dữ liệu</h1><p>${esc(error.message)}</p><button class="button green" type="button" data-action="retry">Thử lại</button></section>`;
}

function selectedTeam() { return state.content.teams.find(team => team.id === state.teamId) || state.content.teams[0]; }
function teamsInGroup(group) { return state.content.teams.filter(team => team.group === group).sort((a, b) => a.id - b.id); }
function teamName(id) { return state.content.teams.find(team => team.id === id)?.name || 'Chưa xác định'; }

function option(value, label, selected) {
  return `<option value="${esc(value)}" ${String(value) === String(selected ?? '') ? 'selected' : ''}>${esc(label)}</option>`;
}

function textField(label, value, attrs, { type = 'text', wide = false, help = '', readonly = false } = {}) {
  return `<label class="field${wide ? ' wide' : ''}"><span>${esc(label)}</span><input type="${type}" value="${esc(value)}" ${attrs} ${readonly ? 'readonly' : ''}>${help ? `<small>${esc(help)}</small>` : ''}</label>`;
}

function renderTeams() {
  const team = selectedTeam();
  state.teamId = team.id;
  return `<section class="panel"><div class="panel-heading"><div><h2>Thông tin đội bóng</h2><p>Chọn đội để chỉnh sửa thông tin và danh sách cầu thủ.</p></div><label class="field team-picker"><span>Đội đang chỉnh sửa</span><select id="team-picker">${state.content.teams.map(t => option(t.id, `${t.name} · Bảng ${t.group}`, team.id)).join('')}</select></label></div><div class="form-grid">${textField('Tên hiển thị', team.name, 'data-team-field="name" maxlength="120" required')}${textField('Tên đăng ký / tên viết tắt', team.alias, 'data-team-field="alias" maxlength="120"')}${textField('Đội trưởng', team.captain, 'data-team-field="captain" maxlength="160"')}${textField('Bảng đấu', `Bảng ${team.group}`, '', { readonly: true, help: 'Đổi bảng tại mục “Bảng & nhánh đấu”.' })}${textField('Trạng thái đăng ký', team.status, 'data-team-field="status" maxlength="160"')}${textField('Số lượng cầu thủ kê khai', team.declared ?? 0, 'data-team-field="declared" min="0" max="100" step="1" required', { type: 'number' })}</div></section><section class="panel"><div class="panel-heading"><div><h2>Cầu thủ <span class="count-badge" id="roster-count">${team.players.length} người</span></h2><p>Để trống số áo nếu chưa có thông tin. Nhập tổng số bàn thắng của từng cầu thủ để cập nhật bảng Vua phá lưới; không tính luân lưu.</p></div></div><div class="player-table-wrap"><table class="player-table"><thead><tr><th>#</th><th>Họ và tên</th><th>Số áo</th><th>Bàn thắng</th><th><span class="sr-only">Thao tác</span></th></tr></thead><tbody>${team.players.length ? team.players.map((player, index) => `<tr><td>${index + 1}</td><td><input aria-label="Tên cầu thủ ${index + 1}" value="${esc(player.name)}" data-player-index="${index}" data-player-field="name" maxlength="160" required></td><td><input aria-label="Số áo cầu thủ ${index + 1}" value="${esc(player.number)}" data-player-index="${index}" data-player-field="number" maxlength="12"></td><td><input type="number" aria-label="Bàn thắng cầu thủ ${index + 1}" value="${player.goals ?? 0}" data-player-index="${index}" data-player-field="goals" min="0" max="999" step="1" required></td><td><button type="button" class="remove-player" data-action="remove-player" data-index="${index}" aria-label="Xóa cầu thủ ${esc(player.name || index + 1)}">×</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty-players">Đội chưa có cầu thủ. Bấm “Thêm cầu thủ” để bổ sung.</td></tr>'}</tbody></table></div><div class="add-player-row"><button type="button" class="button" data-action="add-player">＋ Thêm cầu thủ</button><span class="help">Thay đổi chỉ được công bố sau khi bạn bấm lưu.</span></div></section>`;
}

function sideOf(source) {
  try { return resolveSide(source, state.content); } catch { return { id: null, name: 'Chưa xác định' }; }
}

function matchLabel(match) { return match.stage === 'group' ? `Bảng ${match.group} · ${match.id}` : `${STAGES[match.stage] || 'Trận đấu'} · ${match.id}`; }

function winnerOptions(match) {
  const home = sideOf(match.home), away = sideOf(match.away);
  return option('', 'Chưa xác nhận', match.winnerTeamId) + [home, away].filter(side => side.id !== null && side.id !== undefined).map(side => option(side.id, side.name, match.winnerTeamId)).join('');
}

function renderMatch(match) {
  const home = sideOf(match.home), away = sideOf(match.away);
  return `<article class="match-card" data-fixture="${esc(match.id)}"><div class="match-card-heading"><span>${esc(matchLabel(match))}</span><span class="match-code">${esc(STATUS[match.status] || STATUS.scheduled)}</span></div><div class="match-card-body"><div class="opponents"><span class="home">${esc(home.name)}</span><span class="versus">VS</span><span class="away">${esc(away.name)}</span></div><div class="form-grid">${textField('Ngày thi đấu', match.date, `data-match-id="${esc(match.id)}" data-match-field="date"`, { type: 'date' })}${textField('Giờ thi đấu', match.time, `data-match-id="${esc(match.id)}" data-match-field="time"`, { type: 'time' })}${textField('Sân / địa điểm', match.venue, `data-match-id="${esc(match.id)}" data-match-field="venue" maxlength="160"`, { wide: true })}<label class="field wide"><span>Trạng thái trận đấu</span><select data-match-id="${esc(match.id)}" data-match-field="status">${Object.entries(STATUS).map(([value, label]) => option(value, label, match.status)).join('')}</select></label></div><div class="score-fields">${textField('Bàn thắng đội bên trái', match.homeScore, `data-match-id="${esc(match.id)}" data-match-field="homeScore" min="0" max="999" step="1"`, { type: 'number' })}${textField('Bàn thắng đội bên phải', match.awayScore, `data-match-id="${esc(match.id)}" data-match-field="awayScore" min="0" max="999" step="1"`, { type: 'number' })}</div>${match.stage === 'group' ? '' : `<label class="field winner-field" ${match.status !== 'finished' || match.homeScore === null || match.awayScore === null || match.homeScore !== match.awayScore ? 'hidden' : ''}><span>Đội đi tiếp / thắng luân lưu</span><select data-match-id="${esc(match.id)}" data-match-field="winnerTeamId">${winnerOptions(match)}</select><small>Khi tỷ số hòa, bạn cần xác nhận đội thắng để cập nhật nhánh tiếp theo.</small></label>`}</div></article>`;
}

function renderMatches() {
  const matches = state.content.matches.filter(match => state.matchStage === 'all' || match.stage === state.matchStage);
  return `<div class="notice">Nhập ngày, giờ, sân và kết quả thực tế. Để trống thông tin chưa công bố. Chỉ trận có trạng thái “Đã kết thúc” được tính vào bảng thành tích.</div><div class="match-toolbar"><p>${matches.length} trận đang hiển thị</p><label class="field"><span>Lọc vòng đấu</span><select id="match-stage" class="control">${option('all', 'Tất cả vòng đấu', state.matchStage)}${Object.entries(STAGES).map(([value, label]) => option(value, label, state.matchStage)).join('')}</select></label></div><div class="match-grid">${matches.map(renderMatch).join('')}</div>`;
}

function qualifierSelect(group, rank, label) {
  return `<label class="field"><span>${label}</span><select data-qualifier-group="${group}" data-qualifier-rank="${rank}">${option('', 'Chưa xác nhận', state.content.qualifiers[group][rank])}${teamsInGroup(group).map(team => option(team.id, team.name, state.content.qualifiers[group][rank])).join('')}</select></label>`;
}

function renderGroups() {
  return `<section class="panel"><div class="panel-heading"><div><h2>Đổi đội giữa hai bảng</h2><p>Mỗi bảng luôn có ba đội. Chọn hai đội ở các bảng khác nhau để hoán đổi.</p></div></div><div class="notice warning">Cặp đấu vòng bảng thay đổi sẽ được đặt lại ngày giờ, sân và kết quả. Các cặp giữ nguyên hai đội trong cùng bảng vẫn giữ thông tin cũ. Kết quả vòng loại trực tiếp có đội tham dự thay đổi cũng sẽ được đặt lại.</div><div class="swap-grid"><label class="field"><span>Đội thứ nhất</span><select id="swap-a">${state.content.teams.map(team => option(team.id, `${team.name} · Bảng ${team.group}`, state.content.teams[0].id)).join('')}</select></label><span class="swap-arrow" aria-hidden="true">⇄</span><label class="field"><span>Đội thứ hai</span><select id="swap-b">${state.content.teams.map(team => option(team.id, `${team.name} · Bảng ${team.group}`, state.content.teams.find(team => team.group !== state.content.teams[0].group)?.id)).join('')}</select></label><button type="button" class="button green" data-action="swap-groups">Đổi bảng</button></div></section><div class="notice">Xác nhận hai đội đi tiếp theo kết quả và điều lệ của BTC. Hệ thống không tự quyết định thứ hạng khi các đội bằng điểm.</div><div class="group-grid">${GROUPS.map(group => `<section class="panel group-card"><h3>Bảng ${group}</h3><div class="group-members">${teamsInGroup(group).map(team => `<span class="group-member">${esc(team.name)}</span>`).join('')}</div><div class="form-grid">${qualifierSelect(group, 'first', 'Nhất bảng')}${qualifierSelect(group, 'second', 'Nhì bảng')}</div></section>`).join('')}</div><section class="panel"><h2>Nhánh loại trực tiếp</h2><p class="bracket-note">TK1: Nhất A – Nhì C · TK2: Nhất B – Nhì D<br>TK3: Nhất C – Nhì B · TK4: Nhất D – Nhì A<br>BK1: Thắng TK1 – Thắng TK2 · BK2: Thắng TK3 – Thắng TK4<br>Chung kết: Thắng BK1 – Thắng BK2 · Giải ba: Thua BK1 – Thua BK2</p><p class="help">Nhánh giữ đúng sơ đồ giải. Đội thắng được cập nhật từ kết quả trong mục “Lịch & kết quả”.</p></section>`;
}

function renderSettings() {
  const settings = state.content.settings;
  return `<section class="panel"><div class="panel-heading"><div><h2>Nội dung website</h2><p>Những nội dung này xuất hiện trên trang công khai của giải.</p></div></div><div class="form-grid">${textField('Tên giải đấu', settings.title, 'data-setting="title" maxlength="120" required', { wide: true })}${textField('Tiêu đề lớn · dòng 1', settings.heroLine1, 'data-setting="heroLine1" maxlength="120" required')}${textField('Tiêu đề lớn · dòng 2', settings.heroLine2, 'data-setting="heroLine2" maxlength="120" required')}<label class="field wide"><span>Mô tả ngắn</span><textarea data-setting="description" maxlength="2000" rows="3">${esc(settings.description)}</textarea></label><label class="field wide"><span>Thông báo lịch thi đấu</span><textarea data-setting="notice" maxlength="3000" rows="4">${esc(settings.notice)}</textarea><small>Có thể cập nhật thông báo của BTC khi lịch thi đấu hoặc địa điểm thay đổi.</small></label></div></section><section class="panel"><div class="panel-heading"><div><h2>Quy ước tính điểm vòng bảng</h2><p>Điểm được tính từ những trận đã kết thúc. Xác nhận đội đi tiếp trong mục “Bảng & nhánh đấu”.</p></div></div><div class="form-grid three">${textField('Điểm thắng', settings.pointsWin, 'data-setting="pointsWin" min="0" max="100" step="1" required', { type: 'number' })}${textField('Điểm hòa', settings.pointsDraw, 'data-setting="pointsDraw" min="0" max="100" step="1" required', { type: 'number' })}${textField('Điểm thua', settings.pointsLoss, 'data-setting="pointsLoss" min="0" max="100" step="1" required', { type: 'number' })}</div></section>`;
}

function renderMain() {
  const functions = { teams: renderTeams, matches: renderMatches, groups: renderGroups, settings: renderSettings };
  $('#editor-content').innerHTML = functions[state.tab]();
  document.querySelectorAll('[data-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === state.tab);
    button.setAttribute('aria-selected', String(button.dataset.tab === state.tab));
  });
}

function formatDate(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return 'Chưa có lần cập nhật';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(value));
}

function renderEditor() {
  $('#app').setAttribute('aria-busy', 'false');
  $('#app').innerHTML = `<div class="intro"><div><div class="eyebrow">TRUNG TÂM ĐIỀU HÀNH</div><h1>Quản trị giải đấu</h1><p>Cập nhật thông tin, sắp xếp lịch và theo dõi kết quả.</p></div><span class="owner-label">CHỦ SỞ HỮU · KIENQUYET1201</span></div><div id="editor-alert" role="alert"></div><nav class="dashboard-tabs" aria-label="Mục chỉnh sửa" role="tablist">${TABS.map(([id, label]) => `<button type="button" role="tab" aria-selected="${state.tab === id}" data-tab="${id}" class="${state.tab === id ? 'active' : ''}">${label}</button>`).join('')}</nav><div id="editor-content"></div><p class="last-updated" id="last-updated">Cập nhật gần nhất: ${esc(formatDate(state.content.updatedAt))}</p><div class="save-bar"><div class="save-state" id="save-state"><span class="state-dot"></span><span id="save-label">Đã tải bản đang lưu</span></div><div class="save-actions"><button type="button" class="button" id="reload-button" data-action="reload">Tải lại bản đã lưu</button><button type="button" class="button primary" id="save-button" data-action="save" disabled>Lưu thay đổi</button></div></div>`;
  renderMain();
  renderAccount();
  syncSaveState();
}

function syncSaveState() {
  if (!state.content || !$('#save-button')) return;
  $('#editor-content').inert = state.saving;
  $('#save-state').classList.toggle('dirty', state.dirty);
  $('#save-label').textContent = state.saving ? 'Đang lưu thay đổi…' : state.dirty ? 'Có thay đổi chưa lưu' : 'Mọi thay đổi đã được lưu';
  $('#save-button').disabled = !state.dirty || state.saving || state.conflict;
  $('#save-button').textContent = state.saving ? 'Đang lưu…' : 'Lưu thay đổi';
  $('#reload-button').disabled = state.saving;
}

function markDirty() { state.dirty = true; syncSaveState(); }

async function loadEditor() {
  const result = await request('/api/editor');
  if (!result.content?.teams || !result.content?.matches || !result.sha) throw new Error('Dữ liệu giải đấu chưa đầy đủ. Vui lòng thử tải lại.');
  state.content = structuredClone(result.content);
  state.sha = result.sha;
  state.user = result.user || state.user;
  state.dirty = false;
  state.conflict = false;
  renderEditor();
}

async function boot() {
  try {
    const setup = await request('/api/setup');
    if (!setup.configured) { renderSignIn(false, setup.missing || []); return; }
    const session = await request('/api/auth/session');
    state.user = session?.user || null;
    if (!state.user) { renderSignIn(true); return; }
    try { await loadEditor(); }
    catch (error) {
      if (error.status === 401 || error.status === 403) { renderSignIn(true, [], error.status === 403); return; }
      throw error;
    }
  } catch (error) { renderFailure(error); }
}

async function authAction(signIn) {
  if (state.saving) { toast('Đang lưu thay đổi. Vui lòng chờ hoàn tất.'); return; }
  if (!signIn && state.dirty && !confirm('Bạn có thay đổi chưa lưu. Đăng xuất và bỏ các thay đổi này?')) return;
  try {
    const { csrfToken } = await request('/api/auth/csrf');
    if (!csrfToken) throw new Error('Chưa thể tạo phiên đăng nhập. Vui lòng tải lại trang.');
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = signIn ? '/api/auth/signin/github' : '/api/auth/signout';
    for (const [name, value] of Object.entries({ csrfToken, callbackUrl: `${location.origin}/admin` })) {
      const input = document.createElement('input');
      input.type = 'hidden'; input.name = name; input.value = value; form.append(input);
    }
    document.body.append(form);
    state.dirty = false;
    form.submit();
  } catch (error) { toast(error.message, true); }
}

function participants() {
  return Object.fromEntries(state.content.matches.filter(match => match.stage !== 'group').map(match => [match.id, [sideOf(match.home).id, sideOf(match.away).id]]));
}

function resetChangedKnockout(previous, exceptId = null) {
  let reset = 0;
  for (const id of KNOCKOUT_ORDER) {
    const match = state.content.matches.find(item => item.id === id);
    if (!match || id === exceptId || !previous[id]) continue;
    const current = [sideOf(match.home).id, sideOf(match.away).id];
    if (current.some((teamId, index) => teamId !== previous[id][index])) {
      const hadResult = match.homeScore !== null || match.awayScore !== null || match.status === 'finished' || match.winnerTeamId !== null;
      match.homeScore = null; match.awayScore = null; match.winnerTeamId = null;
      if (match.status === 'finished') match.status = 'scheduled';
      if (hadResult) reset++;
    }
  }
  return reset;
}

function refreshMatchCards() {
  document.querySelectorAll('[data-fixture]').forEach(card => {
    const match = state.content.matches.find(item => item.id === card.dataset.fixture);
    if (!match) return;
    $('.home', card).textContent = sideOf(match.home).name;
    $('.away', card).textContent = sideOf(match.away).name;
    $('.match-code', card).textContent = STATUS[match.status] || STATUS.scheduled;
    card.querySelectorAll('[data-match-field]').forEach(input => {
      const field = input.dataset.matchField;
      if (field === 'winnerTeamId' && document.activeElement !== input) input.innerHTML = winnerOptions(match);
      if (document.activeElement !== input) input.value = match[field] ?? '';
    });
    const winner = $('.winner-field', card);
    if (winner) winner.hidden = match.status !== 'finished' || match.homeScore === null || match.awayScore === null || match.homeScore !== match.awayScore;
  });
}

function updateField(input) {
  if (!state.content || state.saving) return;
  if (input.dataset.setting) {
    const field = input.dataset.setting;
    state.content.settings[field] = field.startsWith('points') ? (input.value === '' ? null : Number(input.value)) : input.value;
  } else if (input.dataset.teamField) {
    selectedTeam()[input.dataset.teamField] = input.dataset.teamField === 'declared' ? (input.value === '' ? null : Number(input.value)) : input.value;
  } else if (input.dataset.playerField) {
    const player = selectedTeam().players[Number(input.dataset.playerIndex)];
    if (!player) return;
    player[input.dataset.playerField] = input.dataset.playerField === 'goals' ? (input.value === '' ? null : Number(input.value)) : input.dataset.playerField === 'number' && input.value === '' ? null : input.value;
  } else if (input.dataset.matchField) {
    const match = state.content.matches.find(item => item.id === input.dataset.matchId);
    if (!match) return;
    const previous = participants();
    const field = input.dataset.matchField;
    match[field] = ['homeScore', 'awayScore', 'winnerTeamId'].includes(field) ? (input.value === '' ? null : Number(input.value)) : input.value;
    if (match.stage !== 'group' && ['homeScore', 'awayScore', 'status'].includes(field)) {
      const home = sideOf(match.home), away = sideOf(match.away);
      if (match.status === 'finished' && match.homeScore !== null && match.awayScore !== null && match.homeScore !== match.awayScore) match.winnerTeamId = match.homeScore > match.awayScore ? home.id : away.id;
      else match.winnerTeamId = null;
    }
    const reset = resetChangedKnockout(previous, match.id);
    if (reset) toast(`Đã đặt lại kết quả của ${reset} trận phía sau do đội tham dự thay đổi.`);
    refreshMatchCards();
  } else if (input.dataset.qualifierGroup) {
    const group = input.dataset.qualifierGroup;
    const rank = input.dataset.qualifierRank;
    const id = input.value === '' ? null : Number(input.value);
    const otherRank = rank === 'first' ? 'second' : 'first';
    if (id !== null && id === state.content.qualifiers[group][otherRank]) {
      toast('Nhất bảng và nhì bảng phải là hai đội khác nhau.', true);
      input.value = state.content.qualifiers[group][rank] ?? '';
      return;
    }
    const previous = participants();
    state.content.qualifiers[group][rank] = id;
    const reset = resetChangedKnockout(previous);
    if (reset) toast(`Đã đặt lại kết quả của ${reset} trận loại trực tiếp do đội đi tiếp thay đổi.`);
  } else return;
  markDirty();
}

function swapGroups() {
  const a = state.content.teams.find(team => team.id === Number($('#swap-a').value));
  const b = state.content.teams.find(team => team.id === Number($('#swap-b').value));
  if (!a || !b || a.group === b.group) { toast('Chọn hai đội ở hai bảng khác nhau để hoán đổi.', true); return; }
  const previous = participants();
  const original = state.content.matches.filter(match => match.stage === 'group');
  [a.group, b.group] = [b.group, a.group];
  const rebuilt = [];
  let changed = 0;
  for (const group of GROUPS) {
    const teams = teamsInGroup(group);
    for (const [index, pair] of [[0, 1], [0, 2], [1, 2]].entries()) {
      const [home, away] = pair.map(position => teams[position].id);
      const old = original.find(match => match.group === group && match.home.type === 'team' && match.away.type === 'team' && [match.home.teamId, match.away.teamId].includes(home) && [match.home.teamId, match.away.teamId].includes(away));
      const base = old ? structuredClone(old) : { date: '', time: '', venue: '', status: 'scheduled', homeScore: null, awayScore: null, winnerTeamId: null };
      if (old && old.home.teamId !== home) [base.homeScore, base.awayScore] = [base.awayScore, base.homeScore];
      if (!old) changed++;
      rebuilt.push({ ...base, id: `${group}${index + 1}`, stage: 'group', group, home: { type: 'team', teamId: home }, away: { type: 'team', teamId: away } });
    }
    for (const rank of ['first', 'second']) {
      if (!teams.some(team => team.id === state.content.qualifiers[group][rank])) state.content.qualifiers[group][rank] = null;
    }
  }
  state.content.matches = [...rebuilt, ...state.content.matches.filter(match => match.stage !== 'group')];
  resetChangedKnockout(previous);
  markDirty(); renderMain();
  toast(`Đã đổi bảng ${a.name} và ${b.name}. ${changed} cặp đấu mới được đặt lại. Bấm lưu để công bố.`);
}

function validateContent() {
  const content = state.content;
  if (!content.settings.title?.trim() || !content.settings.heroLine1?.trim() || !content.settings.heroLine2?.trim()) return 'Vui lòng nhập tên giải và hai dòng tiêu đề lớn.';
  if (['title', 'heroLine1', 'heroLine2'].some(field => content.settings[field].length > 120)) return 'Tên giải và mỗi dòng tiêu đề tối đa 120 ký tự.';
  if (content.settings.description.length > 2000 || content.settings.notice.length > 3000) return 'Mô tả tối đa 2.000 ký tự và thông báo tối đa 3.000 ký tự.';
  for (const field of ['pointsWin', 'pointsDraw', 'pointsLoss']) if (!Number.isInteger(content.settings[field]) || content.settings[field] < 0 || content.settings[field] > 100) return 'Điểm thắng, hòa, thua phải là số nguyên từ 0 đến 100.';
  for (const team of content.teams) {
    if (!team.name.trim()) return 'Mỗi đội cần có tên hiển thị.';
    if (team.name.length > 120 || team.alias.length > 120 || team.captain.length > 160 || team.status.length > 160) return `Thông tin đội ${team.name} vượt quá độ dài cho phép.`;
    if (!Number.isInteger(team.declared) || team.declared < 0 || team.declared > 100) return `Số lượng kê khai của ${team.name} phải là số nguyên từ 0 đến 100.`;
    if (team.players.some(player => !Number.isInteger(player.goals === undefined ? 0 : player.goals) || (player.goals ?? 0) < 0 || (player.goals ?? 0) > 999)) return `Số bàn thắng của cầu thủ ${team.name} phải là số nguyên từ 0 đến 999.`;
    if (team.players.some(player => !player.name.trim())) return `Vui lòng nhập đủ tên cầu thủ của ${team.name}.`;
    if (team.players.some(player => player.name.length > 160)) return `Tên cầu thủ của ${team.name} tối đa 160 ký tự.`;
  }
  for (const group of GROUPS) {
    if (teamsInGroup(group).length !== 3) return `Bảng ${group} cần có đúng ba đội.`;
    const { first, second } = content.qualifiers[group];
    if (first !== null && first === second) return `Hai đội đi tiếp bảng ${group} phải khác nhau.`;
  }
  for (const match of content.matches) {
    if ([match.homeScore, match.awayScore].some(score => score !== null && (!Number.isInteger(score) || score < 0 || score > 999))) return `Tỷ số trận ${match.id} phải là số nguyên từ 0 đến 999, hoặc để trống.`;
    if (match.status === 'finished') {
      if (match.homeScore === null || match.awayScore === null) return `Vui lòng nhập đủ tỷ số trận ${match.id} đã kết thúc.`;
      const ids = [sideOf(match.home).id, sideOf(match.away).id];
      if (ids.some(id => id === null || id === undefined)) return `Cần xác nhận đủ hai đội tham dự trận ${match.id} trước khi nhập kết quả đã kết thúc.`;
      if (match.stage !== 'group' && match.homeScore === match.awayScore && !ids.includes(match.winnerTeamId)) return `Trận ${match.id} có tỷ số hòa. Vui lòng chọn đội thắng / đi tiếp.`;
    }
  }
  const invalid = $('#editor-content').querySelector(':invalid');
  if (invalid) { invalid.focus(); invalid.reportValidity(); return 'Vui lòng kiểm tra trường thông tin được đánh dấu.'; }
  return null;
}

async function save() {
  if (!state.dirty || state.saving || state.conflict) return;
  const error = validateContent();
  if (error) { toast(error, true); return; }
  state.saving = true; syncSaveState();
  const content = structuredClone(state.content);
  content.updatedAt = new Date().toISOString();
  try {
    const result = await request('/api/editor', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, sha: state.sha }) });
    if (!result.sha) throw new Error('Chưa xác nhận được dữ liệu đã lưu. Vui lòng tải lại bản mới trước khi thử lại.');
    state.content = content;
    state.sha = result.sha;
    state.dirty = false;
    $('#last-updated').textContent = `Cập nhật gần nhất: ${formatDate(content.updatedAt)}`;
    $('#editor-alert').innerHTML = '<div class="notice success">Đã lưu lên GitHub. Website công khai cập nhật sau khi Vercel triển khai xong.</div>';
    toast('Đã lưu thay đổi. Vercel sẽ cập nhật website công khai sau khi triển khai xong.');
  } catch (error) {
    if (error.status === 409) {
      state.conflict = true;
      $('#editor-alert').innerHTML = '<div class="notice warning"><strong>Đã có bản cập nhật mới hơn.</strong><p>Thay đổi trong tab này chưa được lưu. Hãy ghi lại thông tin cần giữ, sau đó tải bản mới nhất để tiếp tục. Thao tác tải lại sẽ bỏ bản nháp hiện tại.</p><button type="button" class="button" data-action="reload">Tải bản mới nhất</button></div>';
    } else if (error.status === 401 || error.status === 403) {
      $('#editor-alert').innerHTML = '<div class="notice error">Phiên đăng nhập không còn quyền lưu. Bản nháp vẫn ở tab này. Hãy ghi lại thay đổi cần giữ và đăng nhập lại tài khoản chủ sở hữu.</div>';
    }
    toast(error.message, true);
  } finally { state.saving = false; syncSaveState(); }
}

async function reload() {
  if (state.saving) return;
  if (state.dirty && !confirm('Tải lại bản đã lưu sẽ bỏ các thay đổi chưa lưu trong tab này. Tiếp tục?')) return;
  try { await loadEditor(); toast('Đã tải bản mới nhất.'); }
  catch (error) { toast(error.message, true); }
}

document.addEventListener('click', async event => {
  const tab = event.target.closest('[data-tab]');
  if (tab && state.content) { state.tab = tab.dataset.tab; renderMain(); return; }
  const button = event.target.closest('[data-action]');
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (action === 'login') { await authAction(true); return; }
  if (action === 'logout') { await authAction(false); return; }
  if (action === 'retry') { await boot(); return; }
  if (!state.content) return;
  if (state.saving) { toast('Đang lưu thay đổi. Vui lòng chờ hoàn tất.'); return; }
  if (action === 'save') await save();
  if (action === 'reload') await reload();
  if (action === 'swap-groups') swapGroups();
  if (action === 'add-player') {
    if (selectedTeam().players.length >= 100) { toast('Mỗi đội hỗ trợ tối đa 100 cầu thủ.', true); return; }
    selectedTeam().players.push({ id: crypto.randomUUID(), name: '', number: null, goals: 0 });
    markDirty(); renderMain();
    $('.player-table tbody tr:last-child input')?.focus();
  }
  if (action === 'remove-player') {
    selectedTeam().players.splice(Number(button.dataset.index), 1);
    markDirty(); renderMain();
  }
});

document.addEventListener('input', event => {
  if (event.target.matches('input,textarea')) updateField(event.target);
});

document.addEventListener('change', event => {
  const input = event.target;
  if (input.id === 'team-picker') { state.teamId = Number(input.value); renderMain(); return; }
  if (input.id === 'match-stage') { state.matchStage = input.value; renderMain(); return; }
  if (input.matches('select')) updateField(input);
});

window.addEventListener('beforeunload', event => {
  if (state.dirty) { event.preventDefault(); event.returnValue = ''; }
});

boot();
