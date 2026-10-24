// 各組（2026-10 改版）：五個組別＋教學班。每組看成員、分部課、組內公告、出席率。
import { secsOf, mySecs } from '../core.js';
import { sb, state, me, route, esc, pageHead, empty, avatar, nameOf, fmtDate, render, $$ } from '../core.js';
import { SECTIONS, rateLevel, sectionsOf } from '../logic.js';
import { eventCard } from './events.js';
import { classesTab } from './teaching.js';

const TEACH = '教學班';
const MINE = '我的組別';  // 同時在好幾組的人，先看全部自己的組，不預設在哪一組
const multi = () => mySecs().filter((s) => SECTIONS.includes(s)).length > 1;
const pct = (r) => r == null ? '<span class="muted">—</span>' : `<span class="rate rate-${rateLevel(r)} mono">${Math.round(r)}%</span>`;

function pickTab() {
  const saved = sessionStorage.getItem('grp');
  if (saved && (SECTIONS.includes(saved) || saved === TEACH || (saved === MINE && multi()))) return saved;
  if (multi()) return MINE;
  return mySecs().find((s) => SECTIONS.includes(s)) || SECTIONS[0];
}

const avgRate = (list) => { const r = list.filter((s) => s.current_rate != null); return r.length ? r.reduce((a, b) => a + Number(b.current_rate), 0) / r.length : null; };
const rateBox = (avg, label = '組內出席率') => `<div class="grp-rate lv-${rateLevel(avg)}"><span>${label}</span><b class="mono">${avg == null ? '—' : Math.round(avg)}${avg == null ? '' : '<small>%</small>'}</b></div>`;

// 我的組別：每組一張卡（點了進那組），加上所有自己組的分部課與組內公告
async function mineView() {
  const p = state.p; const secs = SECTIONS.filter((s) => mySecs().includes(s));
  const nowIso = new Date(Date.now() - 3 * 3600e3).toISOString();
  const [evs, anns, stats] = await Promise.all([
    sb.from('events').select('*').contains('kinds', ['sectional']).gte('starts_at', nowIso).order('starts_at').limit(40),
    sb.from('announcements').select('*').eq('audience', 'section').in('section', secs).order('created_at', { ascending: false }).limit(8),
    state.semester && !p.ringerOnly ? sb.rpc('attendance_stats', { sem: state.semester.id }) : { data: [] },
  ]);
  const myEvs = (evs.data || []).filter((e) => sectionsOf(e).some((s) => secs.includes(s))).slice(0, 8);
  const people = [...state.people.values()].filter((u) => u.status === 'active');
  return `<div class="grp-mine">${secs.map((sec) => {
      const ids = new Set(people.filter((u) => secsOf(u).includes(sec)).map((u) => u.id));
      const leaders = people.filter((u) => ids.has(u.id) && u.roles.includes('leader'));
      return `<button class="grp-hero sec-${esc(sec)}" data-grp="${esc(sec)}"><div><h2>${esc(sec)}組</h2>
        <p class="small muted">${ids.size} 位成員${leaders.length ? `・組長 ${leaders.map((u) => esc(nameOf(u.id))).join('、')}` : ''}</p><span class="go small">看這組 →</span></div>
        ${!p.ringerOnly ? rateBox(avgRate((stats.data || []).filter((x) => ids.has(x.user_id)))) : ''}</button>`;
    }).join('')}</div>
    <div class="grp-grid">
      <section class="card"><div class="card-head"><h2>我的分部課</h2><a class="link" href="#/events">行事曆</a></div>
        ${myEvs.length ? `<div class="ev-list">${myEvs.map((e) => eventCard(e)).join('')}</div>` : '<p class="small muted">接下來沒有排定的分部課。</p>'}</section>
      <section class="card"><div class="card-head"><h2>組內公告</h2><a class="link" href="#/announcements">全部公告</a></div>
        ${anns.data?.length ? `<ul class="ann-mini">${anns.data.map((a) => `<li><a href="#/announcements"><span class="sec sec-${esc(a.section)}">${esc(a.section)}</span> ${esc(a.title)}</a><span class="muted small mono">${fmtDate(a.created_at)}</span></li>`).join('')}</ul>` : '<p class="small muted">還沒有發給你這幾組的公告。</p>'}</section>
    </div>`;
}

async function sectionView(sec) {
  const p = state.p;
  const members = [...state.people.values()].filter((u) => u.status === 'active' && secsOf(u).includes(sec))
    .sort((a, b) => (b.roles.includes('leader') - a.roles.includes('leader')) || nameOf(a.id).localeCompare(nameOf(b.id), 'zh-Hant'));
  const leaders = members.filter((u) => u.roles.includes('leader'));
  const nowIso = new Date(Date.now() - 3 * 3600e3).toISOString();
  const [evs, anns, stats] = await Promise.all([
    sb.from('events').select('*').contains('sections', [sec]).gte('starts_at', nowIso).order('starts_at').limit(6),
    sb.from('announcements').select('*').eq('audience', 'section').eq('section', sec).order('created_at', { ascending: false }).limit(5),
    state.semester && !p.ringerOnly ? sb.rpc('attendance_stats', { sem: state.semester.id }) : { data: [] },
  ]);
  const ids = new Set(members.map((u) => u.id));
  const secStats = (stats.data || []).filter((s) => ids.has(s.user_id));
  const rated = secStats.filter((s) => s.current_rate != null);
  const avg = rated.length ? rated.reduce((a, b) => a + Number(b.current_rate), 0) / rated.length : null;
  const statOf = new Map(secStats.map((s) => [s.user_id, s]));
  const canSeeAll = p.officer || mySecs().includes(sec);

  return `<section class="grp-hero sec-${esc(sec)}"><div>
      <h2>${esc(sec)}組</h2>
      <p class="small muted">${members.length} 位成員${leaders.length ? `・組長 ${leaders.map((u) => esc(nameOf(u.id))).join('、')}` : ''}</p></div>
      ${!p.ringerOnly ? `<div class="grp-rate lv-${rateLevel(avg)}"><span>組內出席率</span><b class="mono">${avg == null ? '—' : Math.round(avg)}${avg == null ? '' : '<small>%</small>'}</b></div>` : ''}
    </section>
    <div class="grp-grid">
      <section class="card"><div class="card-head"><h2>分部課</h2><a class="link" href="#/events">行事曆</a></div>
        ${evs.data?.length ? `<div class="ev-list">${evs.data.map((e) => eventCard(e)).join('')}</div>` : '<p class="small muted">接下來沒有排定的分部課。</p>'}</section>
      <section class="card"><div class="card-head"><h2>組內公告</h2><a class="link" href="#/announcements">全部公告</a></div>
        ${anns.data?.length ? `<ul class="ann-mini">${anns.data.map((a) => `<li><a href="#/announcements">${esc(a.title)}</a><span class="muted small mono">${fmtDate(a.created_at)}</span></li>`).join('')}</ul>` : '<p class="small muted">還沒有發給這組的公告。</p>'}</section>
    </div>
    <section class="card"><div class="card-head"><h2>成員</h2>${canSeeAll && !p.ringerOnly ? '<span class="muted small">出席率為目前已點名的場次</span>' : ''}</div>
      ${members.length ? `<ul class="grp-people">${members.map((u) => {
        const st = statOf.get(u.id);
        return `<li class="${u.id === me() ? 'me' : ''}">${avatar(u.id, 36)}<div><b>${esc(nameOf(u.id))}</b>${u.roles.includes('leader') ? '<span class="chip gold">組長</span>' : ''}
          <span class="small muted">${esc(u.instruments || '')}</span></div>${canSeeAll && !p.ringerOnly ? pct(st?.current_rate ?? null) : ''}</li>`;
      }).join('')}</ul>` : empty('這組還沒有成員', p.admin ? '到頭像選單的「成員」設定每個人的組別。' : '')}
    </section>`;
}

route('/groups', async () => {
  const tab = pickTab();
  setTimeout(() => $$('[data-grp]').forEach((b) => (b.onclick = () => { sessionStorage.setItem('grp', b.dataset.grp); render(); })));
  const tabs = [...(multi() ? [MINE] : []), ...SECTIONS, TEACH];
  return pageHead('各組', '各聲部的成員、分部課、組內公告與出席，以及新生教學班。') +
    `<div class="grp-tabs" role="tablist">${tabs.map((t) => `<button role="tab" data-grp="${t}" aria-selected="${t === tab}" class="${t === TEACH ? 'teach' : t === MINE ? 'mine-tab' : `sec-${t}`} ${mySecs().includes(t) ? 'is-mine' : ''}">${t}</button>`).join('')}</div>` +
    (tab === TEACH ? `<p class="small muted grp-note">新生教學班與進度，帶課的人在這裡勾選學員的進度。</p>${await classesTab()}` : tab === MINE ? await mineView() : await sectionView(tab));
});
