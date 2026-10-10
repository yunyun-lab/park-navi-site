/* パーク回遊ナビ 本体
   画面：今日 / やりたい / プラン / 準備
   保存：この端末（localStorage）。夫婦の同期は「家族の部屋」（合言葉で入る。Supabase の受付係 /room 経由）か「共有コード」 */
(function () {
  'use strict';
  var D = window.PARK_DATA;
  var TZ = 'America/Los_Angeles';
  var KEY = 'parknavi.v1';
  var LIVE_KEY = 'parknavi.live.v1';
  var SB = 'https://ajqbrrusenlybiloxcir.supabase.co/functions/v1'; /* 受付係・中継役の置き場（公開してよい住所。鍵は不要） */
  var API_BASES = [SB + '/api', 'https://api.themeparks.wiki/v1'];

  /* ---------- 小さな道具 ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toMin(hhmm) { if (!hhmm) return null; var a = String(hhmm).split(':'); return Number(a[0]) * 60 + Number(a[1]); }
  function fmt(m) { m = Math.round(m); return Math.floor(m / 60) + ':' + pad(m % 60); }
  function hhmm(m) { m = Math.round(m); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function la(d) {
    var o = {};
    new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).forEach(function (p) { o[p.type] = p.value; });
    return { date: o.year + '-' + o.month + '-' + o.day, min: (Number(o.hour) % 24) * 60 + Number(o.minute) };
  }
  function todayLA() { return la(new Date()).date; }
  var WD = ['日', '月', '火', '水', '木', '金', '土'];
  function dateLabel(date) { if (!date) return '日付未定'; var p = date.split('-'); var w = new Date(date + 'T12:00:00Z').getUTCDay(); return Number(p[1]) + '/' + Number(p[2]) + '(' + WD[w] + ')'; }
  function parkShort(p) { return p === 'dl' ? 'ランド' : 'カリフォルニア'; }
  function cmOf(inch) { return Math.ceil(inch * 2.54); } /* 切り上げ（32in=81.28cm → 82cm）。足りないのに「OK」と出さないため */

  /* ---------- データの下ごしらえ ---------- */
  function slug(it) { return it.park + ':' + it.en.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
  var ITEMS = D.items.map(function (it) {
    return Object.assign({ key: it.id || slug(it), parks: [it.park] }, it);
  }).concat((window.PARK_GUIDE || []).map(function (g) { return Object.assign({}, g); }));
  var BYKEY = {}; ITEMS.forEach(function (it) { BYKEY[it.key] = it; });
  function landOf(it) { return D.parks[it.park].lands[it.land] || { ja: '', en: '' }; }
  function find(ja) { for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].ja.indexOf(ja) === 0) return ITEMS[i]; return null; }

  /* ---------- 保存データ ---------- */
  function defaults() {
    return {
      me: 'わたし',
      kids: [{ name: '子ども', cm: 90 }],
      checks: {}, done: {}, by: {}, resv: {}, showPick: {}, pin: {}, later: {}, fav: {}, extra: [],
      days: [],
      dayIdx: 0, tab: 'today', sample: false,
      view: { park: null, wpark: 'dl', filter: 'all', kidOnly: false, mapPark: 'dl' }
    };
  }
  function load() { try { var s = localStorage.getItem(KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 保存できない環境でも動かす */ } }
  function save() { saveLocal(); if (window.__roomKick) window.__roomKick(); }
  var S = load();
  if (!S) {
    S = defaults();
    /* 初回は何も入れない（まっさらな状態） */
  } else {
    var d0 = defaults();
    Object.keys(d0).forEach(function (k) { if (S[k] == null) S[k] = d0[k]; });
    S.view = Object.assign(d0.view, S.view || {});
    /* 前の版の食事・お土産のチェックを、新しい一覧の同じお店に引き継ぐ */
    var OLD = {}; ITEMS.forEach(function (it) { if (it.guide && it.type === 'food' && it.en) OLD[slug(it)] = it.key; });
    ['checks', 'by', 'resv', 'done', 'pin', 'later'].forEach(function (f) {
      Object.keys(S[f] || {}).forEach(function (k) { if (BYKEY[k]) return; var nk = OLD[k]; if (nk && S[f][nk] == null) S[f][nk] = S[f][k]; delete S[f][k]; });
    });
    /* 前の初期値（子ども2人の仮の値）のままなら、1人の初期値に置き換える */
    if (JSON.stringify(S.kids) === JSON.stringify([{ name: '上の子', cm: 95 }, { name: '下の子', cm: 88 }])) S.kids = d0.kids;
  }

  /* ---------- リアルタイム情報（ThemeParks.wiki） ---------- */
  var LIVE = { dl: null, dca: null, hours: { dl: {}, dca: {} }, at: null, ok: false };
  (function () { try { var c = JSON.parse(localStorage.getItem(LIVE_KEY) || 'null'); if (c) { LIVE.dl = c.dl; LIVE.dca = c.dca; LIVE.hours = c.hours || LIVE.hours; LIVE.at = c.at; } } catch (e) { } })();
  var apiBase = null;
  function getJSON(path) {
    var bases = apiBase ? [apiBase] : API_BASES.slice();
    function tryNext() {
      if (!bases.length) return Promise.resolve(null);
      var b = bases.shift();
      return fetch(b + path, { cache: 'no-store' }).then(function (r) {
        var ct = r.headers.get('content-type') || '';
        if (!r.ok || ct.indexOf('json') < 0) return tryNext();
        return r.json().then(function (j) { apiBase = b; return j; });
      }).catch(tryNext);
    }
    return tryNext();
  }
  function refreshLive() {
    var parks = ['dl', 'dca'];
    return Promise.all(parks.map(function (p) {
      var id = D.parks[p].id;
      return Promise.all([getJSON('/entity/' + id + '/live'), getJSON('/entity/' + id + '/schedule')]).then(function (r) {
        if (r[0] && r[0].liveData) LIVE[p] = r[0].liveData.map(function (e) {
          return { id: e.id, name: e.name, type: e.entityType, status: e.status,
            wait: e.queue && e.queue.STANDBY && typeof e.queue.STANDBY.waitTime === 'number' ? e.queue.STANDBY.waitTime : null,
            shows: (e.showtimes || []).map(function (s) { return s.startTime; }) };
        });
        if (r[1] && r[1].schedule) r[1].schedule.forEach(function (s) {
          if (s.type === 'OPERATING' && s.openingTime) {
            var o = la(new Date(s.openingTime)), c = la(new Date(s.closingTime));
            LIVE.hours[p][s.date] = { open: o.min, close: c.min < o.min ? c.min + 1440 : c.min };
          }
        });
        return !!(r[0] && r[0].liveData);
      });
    })).then(function (oks) {
      if (oks.some(Boolean)) {
        LIVE.ok = true; LIVE.at = Date.now();
        try { localStorage.setItem(LIVE_KEY, JSON.stringify({ dl: LIVE.dl, dca: LIVE.dca, hours: LIVE.hours, at: LIVE.at })); } catch (e) { }
      }
      render();
    });
  }
  function liveFor(it) {
    var L = LIVE[it.park]; if (!L) return null;
    for (var i = 0; i < L.length; i++) if (it.id && L[i].id === it.id) return L[i];
    if (it.match) { var m = it.match.toLowerCase(); for (var j = 0; j < L.length; j++) if (L[j].name && L[j].name.toLowerCase().indexOf(m) >= 0) return L[j]; }
    return null;
  }
  function liveFresh() { return LIVE.at && (Date.now() - LIVE.at) < 30 * 60 * 1000; }
  function waitOf(it, useLive) {
    var e = useLive && liveFresh() ? liveFor(it) : null;
    if (e && e.wait != null) return { min: e.wait, live: true };
    return { min: it.wait || 0, live: false };
  }
  var STATUS = {
    DOWN: { ja: '一時運休中', en: 'Temporarily Closed' },
    CLOSED: { ja: '本日は休止', en: 'Closed' },
    REFURBISHMENT: { ja: '改修のため休止', en: 'Refurbishment' }
  };
  /* 開園前・閉園後は、どのアトラクションも「休止」と返ってくるので、お知らせを出さない */
  function parkState(park) {
    var h = parkHours(park, todayLA()), n = la(new Date()).min;
    if (n < h.open) return { ja: '開園前（' + fmt(h.open) + '開園）', closed: true };
    if (n >= h.close) return { ja: '閉園後', closed: true };
    return null;
  }
  function statusOf(it) {
    if (!liveFresh()) return null; var e = liveFor(it); if (!e || !STATUS[e.status]) return null;
    if (e.status !== 'REFURBISHMENT' && parkState(it.park)) return null;
    return STATUS[e.status];
  }
  function showTimes(it, date) {
    var out = [];
    if (date === todayLA() && liveFresh()) {
      var e = liveFor(it);
      if (e) e.shows.forEach(function (st) { var p = la(new Date(st)); if (p.date === date) out.push(p.min); });
    }
    if (!out.length && S.showPick[it.key]) out.push(toMin(S.showPick[it.key]));
    return out.sort(function (a, b) { return a - b; });
  }
  function parkHours(park, date) {
    var h = LIVE.hours[park] && LIVE.hours[park][date];
    if (h) return { open: h.open, close: h.close, live: true };
    var d = D.parks[park].hours; return { open: toMin(d.open), close: toMin(d.close), live: false };
  }

  /* ---------- 身長 ---------- */
  function heightInfo(it) {
    if (!it.height) return { cls: 'ok', ja: '身長制限なし', en: 'Any height', allOk: true };
    var cm = cmOf(it.height);
    var ok = S.kids.filter(function (k) { return Number(k.cm) >= cm; });
    var base = cm + 'cm以上 / ' + it.height + ' in';
    if (ok.length === S.kids.length) return { cls: 'ok', ja: base + '・子どもOK', allOk: true };
    if (!ok.length) return { cls: 'warn', ja: base + '・子どもは不可', allOk: false, rs: true };
    return { cls: 'warn', ja: base + '・' + ok.map(function (k) { return k.name; }).join('、') + 'はOK', allOk: false, rs: true };
  }

  /* ---------- 移動時間（簡易：エリアの位置から推定） ---------- */
  var BLOCKED = { dca: [['avg', 'cars']] };
  /* 休止中でも、リアルタイム情報で「運営中」なら再開したものとして扱う */
  function isClosed(it) { if (!it.closed) return false; var e = liveFresh() ? liveFor(it) : null; return !(e && e.status === 'OPERATING'); }
  function dowOf(date) { return new Date(date + 'T12:00:00Z').getUTCDay(); }
  var DOW_JA = ['日', '月', '火', '水', '木', '金', '土'];
  function dowLabel(it) { return it.dow.map(function (d) { return DOW_JA[d]; }).join('・') + 'のみ'; }
  function offOn(it, date) { return it.off && date && date >= it.off[0] && date <= it.off[1]; }
  function available(it, date) {
    return !isClosed(it) && !(it.from && date && date < it.from) && !(it.until && date && date > it.until) && !offOn(it, date) && !(it.dow && date && it.dow.indexOf(dowOf(date)) < 0);
  }
  function walk(park, a, b) {
    if (!a || !b) return 5; if (a === b) return 2;
    var M = window.PARK_MAP[park], p = M.lands[a], q = M.lands[b]; if (!p || !q) return 5;
    /* 工事で通れない道は、中央広場を回る距離で数える */
    if ((BLOCKED[park] || []).some(function (x) { return (x[0] === a && x[1] === b) || (x[0] === b && x[1] === a); })) {
      var h = M.hub; return Math.round(2 + (Math.hypot(p.c[0] - h[0], p.c[1] - h[1]) + Math.hypot(q.c[0] - h[0], q.c[1] - h[1])) * M.mpu / 55);
    }
    /* 子連れでゆっくり歩く想定：分速55m＋人混みの分 */
    return Math.round(2 + Math.hypot(p.c[0] - q.c[0], p.c[1] - q.c[1]) * M.mpu / 55);
  }

  /* ---------- プランづくり ---------- */
  function flexible(it) { return S.checks[it.key] && !S.done[it.key] && it.type !== 'show' && (!it.guide || it.single) && it.park !== 'out' && !(it.type === 'food' && S.resv[it.key] && S.resv[it.key].time); }
  function planAll() {
    var pools = { dl: [], dca: [] };
    ITEMS.forEach(function (it) { if (flexible(it) && !(S.pin[it.key] != null && S.days[S.pin[it.key]] && S.days[S.pin[it.key]].park === it.park)) pools[it.park].push(it); });
    var res = S.days.map(function (day, i) {
      var pinned = ITEMS.filter(function (it) { return flexible(it) && S.pin[it.key] === i && it.park === day.park; });
      var r = planDay(day, i, pinned.concat(pools[day.park]));
      var placed = {}; r.rows.forEach(function (x) { if (x.it) placed[x.it.key] = 1; });
      pools[day.park] = pools[day.park].filter(function (it) { return !placed[it.key]; });
      var later = S.days.some(function (d, j) { return j > i && d.park === day.park; });
      r.carried = later ? r.unplaced.filter(function (it) { return S.pin[it.key] !== i; }) : [];
      r.left = later ? r.unplaced.filter(function (it) { return S.pin[it.key] === i; }) : r.unplaced;
      return r;
    });
    /* 今日（現地）の、いまの状況でのプラン。旅行の日でなくても、チェックしたものとリアルタイム情報で計算する */
    var ti = todayDayIdx();
    res.live = {};
    ['dl', 'dca'].forEach(function (pk) {
      if (ti >= 0 && S.days[ti].park === pk) { res.live[pk] = res[ti]; return; }
      var r = planDay({ date: todayLA(), park: pk }, -1, ITEMS.filter(function (it) { return flexible(it) && it.park === pk; }));
      r.carried = []; r.left = r.unplaced; res.live[pk] = r;
    });
    return res;
  }
  function planDay(day, idx, cands) {
    var park = day.park, P = D.parks[park];
    var isToday = day.date === todayLA();
    var hrs = parkHours(park, day.date);
    var t = hrs.open, pos = P.entrance;
    if (isToday) { var now = la(new Date()).min; if (now > t) t = now; }
    var kidMin = Math.min.apply(null, S.kids.map(function (k) { return Number(k.cm) || 0; }).concat([999]));

    /* 時間が決まっている予定 */
    var fixed = [], lane = [], tbd = [];
    ITEMS.forEach(function (it) {
      if (it.park !== park) return;
      if (it.type === 'food' && S.checks[it.key] && !S.done[it.key] && S.resv[it.key] && S.resv[it.key].day === idx && S.resv[it.key].time)
        fixed.push({ kind: 'resv', it: it, start: toMin(S.resv[it.key].time), dur: it.dur, hold: 5, land: it.land });
      if (it.type !== 'show') return;
      if (!available(it, day.date)) return;
      var times = showTimes(it, day.date);
      var mine = !!S.checks[it.key] && !S.done[it.key];
      times.forEach(function (st) { lane.push({ it: it, start: st, dur: it.dur || 15, hold: it.hold || 0, land: it.land, mine: mine }); });
      if (mine) {
        var pick = S.showPick[it.key] ? toMin(S.showPick[it.key]) : null;
        if (pick == null && times.length) { pick = times.filter(function (x) { return x >= t; })[0]; if (pick == null) pick = times[times.length - 1]; }
        if (pick != null) fixed.push({ kind: 'show', it: it, start: pick, dur: it.dur || 15, hold: it.hold || 0, land: it.land });
        else tbd.push(it);
      }
    });
    S.extra.forEach(function (x, j) { if (x.day === idx && x.time) fixed.push({ kind: 'extra', name: x.name, start: toMin(x.time), dur: Number(x.dur) || 30, hold: 0, land: x.land || P.entrance, extra: j }); });
    fixed.sort(function (a, b) { return a.start - b.start; });

    /* 予定どうしの重なり */
    var conflicts = [];
    for (var i = 1; i < fixed.length; i++) {
      var a = fixed[i - 1], b = fixed[i];
      if (a.start + a.dur + walk(park, a.land, b.land) > b.start - b.hold) conflicts.push({ a: a, b: b });
    }

    /* 目安の待ち時間は時間帯で変える（朝は短く、昼すぎは長め）。当日はリアルタイムの値を使う */
    function factor(m) {
      if (m < hrs.open + 60) return 0.55; if (m < hrs.open + 120) return 0.75; if (m < 720) return 1.0;
      if (m < 1020) return 1.15; if (m < 1200) return 0.95; return 0.7;
    }
    function waitAt(it, m) { var w = waitOf(it, isToday); return w.live ? w.min : Math.round((it.wait || 0) * factor(m) / 5) * 5; }
    function span(it, from) {
      var w = it.type === 'ride' ? waitAt(it, t + walk(park, from, it.land)) : 0;
      var d = it.dur || 10, rs = false;
      if (it.type === 'ride' && it.height && cmOf(it.height) > kidMin) { d = d * 2 + 5; rs = true; }
      return { w: w, d: d, wk: walk(park, from, it.land), rs: rs };
    }
    function cost(it, s) {
      /* 歩く時間は子連れだと負担が大きいので重めに数える */
      var c = s.wk * 1.6 + s.w;
      if (S.fav[it.key]) c -= 25; /* お気に入りは先に入れる */
      /* 朝のうちは「ふだん長く並ぶもの」を先に */
      if (it.type === 'ride' && t < hrs.open + 120) c -= (it.wait || 0) * 0.4;
      if (it.tag === '人気' && t < hrs.open + 120) c -= 10;
      if (S.later[it.key]) c += 40;
      if (it.type === 'shop' && t < toMin('15:00')) c += 15;
      /* おやつは朝いちばんを避けて、午後に寄りやすくする */
      if (it.type === 'snack') c += t < toMin('10:30') ? 25 : (t >= toMin('13:30') && t <= toMin('16:30') ? -10 : 0);
      if (it.type === 'food') {
        var meal = (t >= toMin('11:00') && t <= toMin('13:30')) || (t >= toMin('17:00') && t <= toMin('19:30'));
        c += meal ? -25 : 60;
      }
      return c;
    }
    var rows = [], rem = cands.slice(), fi = 0, guard = 0;
    while (guard++ < 400) {
      var next = fixed[fi], best = null, bc = Infinity, bs = null;
      rem.forEach(function (it) {
        if (!available(it, day.date)) return;
        var s = span(it, pos), end = t + s.wk + s.w + s.d;
        if (end > hrs.close) return;
        if (next && end + walk(park, it.land, next.land) > next.start - next.hold) return;
        var c = cost(it, s); if (c < bc) { bc = c; best = it; bs = s; }
      });
      if (best) {
        var st = t + bs.wk;
        rows.push({ kind: 'item', it: best, start: st, wait: bs.w, dur: bs.d, walk: bs.wk, live: waitOf(best, isToday).live, rs: bs.rs, end: st + bs.w + bs.d });
        t = st + bs.w + bs.d; pos = best.land; rem = rem.filter(function (x) { return x !== best; });
        continue;
      }
      if (next) {
        var arrive = t + walk(park, pos, next.land);
        var late = arrive > next.start - next.hold;
        rows.push(Object.assign({}, next, { late: late, end: Math.max(arrive, next.start) + next.dur }));
        t = Math.max(arrive, next.start) + next.dur; pos = next.land; fi++;
        continue;
      }
      break;
    }
    rows.forEach(function (r, i) { r.n = i + 1; });
    /* ショー欄の状態 */
    lane.forEach(function (L) {
      var s = L.start - L.hold, e = L.start + L.dur;
      var busy = rows.filter(function (r) { return !(r.kind === 'show' && r.it === L.it) && r.start < e && r.end > s; })[0];
      var mineRow = rows.filter(function (r) { return r.kind === 'show' && r.it === L.it && r.start === L.start; })[0];
      L.chosen = !!mineRow;
      L.conflict = !!(mineRow && (mineRow.late || conflicts.some(function (c) { return (c.a.it === L.it || c.b.it === L.it) && (c.a.start === L.start || c.b.start === L.start); })));
      L.busy = busy;
    });
    var total = cands.filter(function (it) { return !isClosed(it); }).length + fixed.length;
    var placedCount = rows.filter(function (r) { return r.kind === 'item'; }).length + fixed.length;
    return { day: day, idx: idx, hrs: hrs, rows: rows, lane: lane, fixed: fixed, conflicts: conflicts, unplaced: rem, tbd: tbd, total: total, placed: placedCount, isToday: isToday };
  }

  /* ---------- 画面の部品 ---------- */
  var ICON = {
    today: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    wish: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/></svg>',
    plan: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
    prep: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7l5-3 6 3 5-3v13l-5 3-6-3-5 3z"/><path d="M9 4v13M15 7v13"/></svg>'
  };
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>';
  function favMark(it) { return it && S.fav[it.key] ? '<span class="favmark" aria-label="お気に入り">' + STAR + '</span>' : ''; }
  function icon(it, s) { return window.PARK_ICON ? window.PARK_ICON(it, s) : ''; }
  function nameHTML(ja, en, size, url) {
    var inner = '<span class="ja"' + (size ? ' style="font-size:' + size + 'px"' : '') + '>' + esc(ja) + (url ? EXT : '') + '</span><span class="en" lang="en">' + esc(en) + '</span>';
    return url ? '<a class="name namelink" href="' + esc(url) + '" target="_blank" rel="noopener" aria-label="' + esc(ja) + '（公式サイトを開く）">' + inner + '</a>' : '<div class="name">' + inner + '</div>';
  }
  /* 公式サイトのページ（links.js）。レストランはお店のページ、食べ歩き・グッズは売っているお店のメニュー */
  var EXT = '<svg class="ext" viewBox="0 0 16 16" aria-hidden="true"><path d="M9 3h4v4M13 3L7.5 8.5M11 9.5V13H3V5h3.5"/></svg>';
  function linkOf(it) {
    var L = window.PARK_LINKS || {}; if (!it) return null;
    var e = L[it.en]; if (e && it.type !== 'snack' && it.type !== 'shop') return { page: e[0], menu: e[1] || null };
    var st = it.guide && it.storeEn && L[it.storeEn]; if (st) return { page: st[1] || st[0], menu: null, store: true };
    return null;
  }
  function pageOf(it) { var l = linkOf(it); return l ? l.page : null; }
  function dot(park, land) { return '<span class="dot" style="background:' + landColor(park, land) + '" aria-hidden="true"></span>'; }
  function landHTML(it) { var L = landOf(it); return '<span class="land">' + dot(it.park, it.land) + esc(L.ja) + ' / <span lang="en">' + esc(L.en) + '</span></span>'; }
  function parkSeg(cur, act, withOut) {
    var ps = withOut ? ['dl', 'dca', 'out'] : ['dl', 'dca'];
    return '<div class="seg" role="group" aria-label="パーク">' + ps.map(function (p) {
      var ja = p === 'dl' ? (withOut ? 'ランド' : 'ディズニーランド') : p === 'dca' ? (withOut ? 'カリフォルニア' : 'カリフォルニア・A') : 'パーク外';
      var en = p === 'out' ? 'Downtown Disney・Hotels' : withOut ? (p === 'dl' ? 'Disneyland' : 'California Adventure') : D.parks[p].en;
      return '<button data-act="' + act + '" data-v="' + p + '" aria-pressed="' + (cur === p) + '"><span>' + esc(ja) + '</span><span class="en" lang="en">' + esc(en) + '</span></button>';
    }).join('') + '</div>';
  }
  function liveLine() {
    if (liveFresh()) { var d = new Date(LIVE.at); var p = la(d); return '現地 ' + fmt(p.min) + ' 更新・5分ごと'; }
    if (LIVE.at) return 'リアルタイム情報が古いので目安を表示中';
    return 'リアルタイム情報なし（目安を表示）';
  }

  /* ---------- 今日 ---------- */
  function todayDayIdx() { var t = todayLA(); for (var i = 0; i < S.days.length; i++) if (S.days[i].date === t) return i; return -1; }
  function todayCtx(plans) {
    var ti = todayDayIdx();
    var park = S.view.park || (ti >= 0 ? S.days[ti].park : 'dl');
    var plan = plans.live[park], day = plan.day;
    var di = ti >= 0 && S.days[ti].park === park ? ti : -1;
    var now = la(new Date()).min;
    var nextRow = plan ? plan.rows.filter(function (r) { var it = r.it; return !(it && S.done[it.key]) && (!plan.isToday || r.end >= now); })[0] : null;
    return { ti: ti, di: di, day: day, park: park, plan: plan, now: now, nextRow: nextRow };
  }
  function todayPins(plans) { var c = todayCtx(plans); return pinsFromPlan(c.plan, c.nextRow); }
  function viewToday(plans) {
    var C = todayCtx(plans), ti = C.ti, di = C.di, day = C.day, park = C.park, plan = C.plan, now = C.now, nextRow = C.nextRow;
    var top = '<div class="top-row"><h1>今日のパーク</h1><span class="meta">' + esc(liveLine()) + '</span></div>' + parkSeg(park, 'tpark');
    var h = '';
    var ps = liveFresh() ? parkState(park) : null;
    if (ps) h += '<p class="note">いまは' + esc(ps.ja) + 'です。運営中かどうかと実際の待ち時間は、営業時間中に表示されます。</p>';
    /* 次のおすすめ */
    if (nextRow) {
      var it = nextRow.it, isItem = nextRow.kind === 'item';
      var ja = it ? it.ja : nextRow.name, en = it ? it.en : '';
      var w = isItem && it.type === 'ride' ? (function () { var x = waitOf(it, plan.isToday); return x.live ? x : { min: nextRow.wait, live: false }; })() : null;
      var hi = it && it.type === 'ride' ? heightInfo(it) : null;
      h += '<section class="card hero" aria-label="次のおすすめ"><span class="eyebrow">次のおすすめ</span>' +
        '<div style="display:flex;justify-content:space-between;gap:12px;align-items:center">' +
        '<div style="display:flex;flex-direction:column;gap:4px;min-width:0">' + nameHTML(ja, en, 18, pageOf(it)) + (it ? landHTML(it) : '') + '</div>' +
        (w ? '<div class="wait"><span class="big">' + w.min + '</span><small>分待ち' + (w.live ? '' : '<br>' + fmt(nextRow.start) + 'ごろの目安') + '</small></div>'
          : '<div class="wait"><span class="big" style="font-size:22px">' + fmt(nextRow.start) + '</span><small>' + (nextRow.kind === 'show' ? '開始' : '予定') + '</small></div>') +
        '</div><div class="chips">' +
        (hi ? '<span class="chip ' + hi.cls + '">' + esc(hi.allOk ? '子どもOK' : '子どもは不可・大人は交代で') + (hi.rs ? ' / <span lang="en">Rider Switch</span>' : '') + '</span>' : '') +
        (nextRow.kind === 'show' && nextRow.hold ? '<span class="chip show">' + nextRow.hold + '分前から場所取り</span>' : '') +
        (nextRow.kind === 'resv' ? '<span class="chip ok">予約 ' + fmt(nextRow.start) + '</span>' : '') +
        '<span class="chip">' + fmt(nextRow.start) + 'ごろ着（徒歩' + (nextRow.walk || walk(park, 'hub', nextRow.land)) + '分）</span>' +
        '</div>' +
        (it ? '<div class="row2"><button class="btn primary" data-act="done" data-k="' + esc(it.key) + '">終わった</button><button class="btn" data-act="later" data-k="' + esc(it.key) + '">あとで</button></div>' : '') +
        '</section>';
    } else if (plan) {
      h += '<section class="card hero"><span class="eyebrow">次のおすすめ</span><p style="margin:0">' + (plan.rows.length ? 'この日の予定は全部終わりました。' : '「やりたい」タブでチェックを入れると、ここに次の行き先が出ます。') + '</p></section>';
    } else {
      h += '<section class="card hero"><span class="eyebrow">次のおすすめ</span><p style="margin:0">このパークに行く日がまだ決まっていません。「準備」タブで日程を設定できます。</p></section>';
    }
    /* お知らせ */
    var alerts = ITEMS.filter(function (it) { return it.park === park && S.checks[it.key] && !S.done[it.key] && (statusOf(it) || isClosed(it)); });
    if (alerts.length) {
      h += '<div style="display:flex;flex-direction:column;gap:6px">' + alerts.map(function (it) {
        var s = statusOf(it) || { ja: '休止中（' + it.closed + '）', en: 'Closed' }; return '<div class="alert" role="status"><span>' + esc(it.ja) + ' は' + esc(s.ja) + '</span><span lang="en">' + esc(it.en) + ' — ' + esc(s.en) + '</span></div>';
      }).join('') + '</div>';
    }
    /* やりたいことの待ち時間 */
    var mine = ITEMS.filter(function (it) { return it.park === park && S.checks[it.key] && (it.type === 'ride' || it.type === 'show'); });
    var doneN = mine.filter(function (it) { return S.done[it.key]; }).length;
    mine.sort(function (a, b) { return (S.done[a.key] ? 1 : 0) - (S.done[b.key] ? 1 : 0) || (a.type === 'show' ? 1 : 0) - (b.type === 'show' ? 1 : 0) || (waitOf(a, true).min - waitOf(b, true).min); });
    h += '<div class="top-row"><h2>やりたいことの待ち時間</h2><span class="meta">' + doneN + ' / ' + mine.length + ' 完了</span></div>';
    if (!mine.length) h += '<p class="empty">まだチェックがありません。「やりたい」タブから選んでください。</p>';
    else h += '<div class="list">' + mine.map(function (it) {
      var right;
      if (it.type === 'show') {
        var viewDate = todayLA();
        var times = showTimes(it, viewDate);
        var st = statusOf(it);
        right = it.from && viewDate && viewDate < it.from ? '<span class="wait"><small>' + esc(dateLabel(it.from)) + 'から</small></span>'
          : st ?'<span class="wait" style="color:var(--warn)">' + esc(st.ja) + '</span>'
          : times.length ? '<span class="wait">' + times.filter(function (x) { return x >= now - 30; }).slice(0, 2).map(fmt).join(' / ') + '<small>次の回</small></span>'
            : '<span class="wait"><small>' + (liveFresh() ? '今日はなし' : '時間は未取得') + '</small></span>';
      } else {
        var w = waitOf(it, true), st2 = statusOf(it);
        right = st2 ? '<span class="wait" style="color:var(--warn)">' + esc(st2.ja) + '</span>' : '<span class="wait">' + w.min + '分<small>' + (w.live ? 'いま' : 'ふだんの目安') + '</small></span>';
      }
      return '<div class="li' + (S.done[it.key] ? ' done' : '') + '"><div style="display:flex;gap:10px;align-items:flex-start;min-width:0">' + icon(it, 32) + '<div style="display:flex;flex-direction:column;min-width:0">' + favMark(it) + nameHTML(it.ja, it.en, 14, pageOf(it)) + landHTML(it) + '</div></div>' +
        '<div style="display:flex;align-items:center;gap:8px">' + right +
        '<button class="btn" style="min-width:44px;padding:0 8px" data-act="toggleDone" data-k="' + esc(it.key) + '" aria-label="' + esc(it.ja) + 'を' + (S.done[it.key] ? '未完了に戻す' : '完了にする') + '">' + (S.done[it.key] ? '戻す' : '済') + '</button></div></div>';
    }).join('') + '</div>';
    h += mapCard(park, '地図と回る順番', pinsFromPlan(plan, nextRow), 'today');
    return { top: top, main: h };
  }

  /* ---------- やりたい ---------- */
  var TYPES = [['all', 'すべて'], ['ride', '乗り物'], ['show', 'ショー'], ['snack', '食べ歩き'], ['food', 'レストラン'], ['shop', 'グッズ'], ['fav', 'お気に入り'], ['mine', 'チェック済み']];
  var TYPE_ORDER = { ride: 0, show: 1, food: 2, snack: 3, shop: 4 };
  var OUT_AREAS = [['ダウンタウン・ディズニー', 'Downtown Disney District'], ['ディズニーランド・ホテル', 'Disneyland Hotel'], ['グランド・カリフォルニアン', "Disney's Grand Californian Hotel"], ['ピクサー・プレイス・ホテル', 'Pixar Place Hotel'], ['複数パーク', 'Several locations']];
  function searchText(it) { return [it.ja, it.en, it.storeJa, it.storeEn, it.note, it.landmark, it.area, it.genre, it.genreEn, it.menu, it.menuEn].join(' ').toLowerCase(); }
  function viewWish() {
    var V = S.view, park = V.wpark;
    var fo = !!V.filtOpen;
    var pname = park === 'dl' ? 'ランド' : park === 'dca' ? 'カリフォルニア' : 'パーク外';
    var tname = (TYPES.filter(function (x) { return x[0] === V.filter; })[0] || ['', 'すべて'])[1];
    var sum = [pname, tname, V.q ? '「' + V.q + '」' : '', V.kidOnly ? '子どもOK' : '', V.hol ? 'ホリデー' : ''].filter(Boolean).join('・');
    var top = '<button class="filtbar" data-act="filtToggle" aria-expanded="' + fo + '"><span class="ftitle"><span class="fh">やりたいことリスト</span><span class="fsum">' + esc(sum) + '</span></span>' +
      '<span class="fbtn">' + (fo ? '閉じる' : '絞り込み') + '</span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
      (fo ? '<div class="filtpanel">' + parkSeg(park, 'wpark', true) +
      '<div class="filter" role="group" aria-label="種類で絞り込み">' + TYPES.map(function (t) { return '<button data-act="filter" data-v="' + t[0] + '" aria-pressed="' + (V.filter === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div class="searchrow"><input type="search" id="wishQ" placeholder="名前で探す（例：チュロス、ブルーイ）" value="' + esc(V.q || '') + '" aria-label="名前で探す"></div>' +
      '<div class="toggles"><label class="toggle"><input type="checkbox" id="kidOnly" data-act="kidOnly"' + (V.kidOnly ? ' checked' : '') + '>子ども（' + esc(S.kids.map(function (k) { return k.cm + 'cm'; }).join('・')) + '）が乗れるもの</label>' +
      '<label class="toggle"><input type="checkbox" id="holOnly" data-act="holOnly"' + (V.hol ? ' checked' : '') + '>ホリデー限定だけ</label></div></div>' : '');
    var q = (V.q || '').trim().toLowerCase();
    var list = ITEMS.filter(function (it) {
      if ((it.parks || [it.park]).indexOf(park) < 0) return false;
      if (V.filter === 'mine') { if (!S.checks[it.key]) return false; } else if (V.filter === 'fav') { if (!S.fav[it.key]) return false; } else if (V.filter !== 'all' && it.type !== V.filter) return false;
      if (V.kidOnly && it.type === 'ride' && !heightInfo(it).allOk) return false;
      if (V.hol && !(it.holiday || it.tag === 'ホリデー')) return false;
      if (q && searchText(it).indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return (TYPE_ORDER[a.type] || 0) - (TYPE_ORDER[b.type] || 0); });
    var h = '';
    var groups = [], used = {};
    if (park === 'out') {
      OUT_AREAS.forEach(function (a) {
        var group = list.filter(function (it) { return !used[it.key] && (it.area === a[0] || a[0] === '複数パーク'); });
        if (!group.length) return;
        group.forEach(function (it) { used[it.key] = 1; });
        groups.push({ id: 'out:' + a[0], ja: a[0] === '複数パーク' ? 'パーク内外のいろいろなお店' : a[0], en: a[1], items: group, inLand: false });
      });
    } else {
      var lands = D.parks[park].lands;
      Object.keys(lands).forEach(function (lk) {
        var group = list.filter(function (it) { return it.land === lk && it.park === park; });
        if (!group.length) return;
        group.forEach(function (it) { used[it.key] = 1; });
        groups.push({ id: park + ':' + lk, ja: lands[lk].ja, en: lands[lk].en, color: landColor(park, lk), items: group, inLand: true });
      });
      var misc = list.filter(function (it) { return !used[it.key]; });
      if (misc.length) groups.push({ id: park + ':misc', ja: 'パーク内のいろいろな場所・複数のお店', en: 'Several locations', items: misc, inLand: false });
    }
    /* 検索中・「チェック済み」表示のときは全部開く */
    var auto = !!q || V.filter === 'mine' || V.filter === 'fav';
    var open = S.view.open || {};
    h += '<div class="grpbar"><span class="meta">' + list.length + '件・' + groups.length + 'エリア</span>' + (auto ? '' :
      '<button class="btn small" data-act="grpAll" data-v="1">すべて開く</button><button class="btn small" data-act="grpAll" data-v="0">すべて閉じる</button>') + '</div>';
    groups.forEach(function (g) {
      var isOpen = auto || !!open[g.id];
      var nOn = g.items.filter(function (it) { return S.checks[it.key]; }).length, nFav = g.items.filter(function (it) { return S.fav[it.key]; }).length;
      var kinds = {}; g.items.forEach(function (it) { kinds[it.type] = (kinds[it.type] || 0) + 1; });
      var summary = Object.keys(TYPE_NAME).filter(function (k) { return kinds[k]; }).map(function (k) { return TYPE_NAME[k] + kinds[k]; }).join('・');
      h += '<section class="grp">' +
        '<button class="grphead" data-act="grp" data-v="' + esc(g.id) + '" aria-expanded="' + isOpen + '"' + (auto ? ' disabled' : '') + '>' +
        (g.color ? '<span class="dot big" style="background:' + g.color + '" aria-hidden="true"></span>' : '') +
        '<span class="grptitle"><span class="ja">' + esc(g.ja) + '</span><span class="en" lang="en">' + esc(g.en) + '</span><span class="grpsum">' + esc(summary) + '</span></span>' +
        (nFav ? '<span class="grpfav">' + STAR + nFav + '</span>' : '') + (nOn ? '<span class="grpon">チェック ' + nOn + '</span>' : '') +
        '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>' +
        (isOpen ? '<div class="grpbody">' + g.items.map(function (it) { return itemHTML(it, g.inLand); }).join('') + '</div>' : '') + '</section>';
    });
    if (!list.length) h += '<p class="empty">条件に合うものがありません。絞り込みや検索の文字を変えてみてください。</p>';
    h += '<p class="note">身長制限・休止情報・グッズ・食べ物は2026年10月10日時点で確認した情報</p>';
    return { top: top, main: h };
  }
  var TYPE_NAME = { ride: '乗り物', show: 'ショー', food: 'レストラン', snack: '食べ歩き', shop: 'グッズ' };
  function itemHTML(it, inLand) {
    var on = !!S.checks[it.key], chips = '';
    if (it.type === 'ride') { var hi = heightInfo(it); chips += '<span class="chip ' + hi.cls + '">' + esc(hi.ja) + (hi.en ? ' / <span lang="en">' + hi.en + '</span>' : '') + '</span>'; if (hi.rs) chips += '<span class="chip">大人は交代で / <span lang="en">Rider Switch</span></span>'; }
    if (it.type === 'show') chips += '<span class="chip show">' + esc({ parade: 'パレード', night: '夜のショー', stage: 'ショー', greet: 'グリーティング' }[it.sub] || 'ショー') + '</span>';
    if (it.guide) {
      chips += '<span class="chip ' + (LABEL_CLS[it.label] || '') + '">' + esc(it.label) + '</span>';
      if (it.holiday) chips += '<span class="chip show">ホリデー</span>';
      if (it.price) chips += '<span class="chip">' + esc(it.price) + '</span>';
    }
    if (it.type === 'food') chips += (it.genre ? '<span class="chip genre">' + esc(it.genre) + ' / <span lang="en">' + esc(it.genreEn) + '</span></span>' : '') + (it.kind ? '<span class="chip">' + esc(it.kind) + '</span>' : '') + (it.reserve ? '<span class="chip warn">' + esc(it.reserve) + ' / <span lang="en">Reservation</span></span>' : '');
    else if (it.reserve) chips += '<span class="chip warn">' + esc(it.reserve) + ' / <span lang="en">Reservation</span></span>';
    if (it.tag) chips += '<span class="chip ok">' + esc(it.tag) + '</span>';
    if (it.from) chips += '<span class="chip">' + esc(dateLabel(it.from)) + '〜</span>';
    if (it.until) chips += '<span class="chip">〜' + esc(dateLabel(it.until)) + '</span>';
    if (isClosed(it)) chips += '<span class="chip warn">休止中 / <span lang="en">Closed</span></span>';
    if (it.off) chips += '<span class="chip warn">' + esc(dateLabel(it.off[0])) + '〜' + esc(dateLabel(it.off[1])) + 'は休止</span>';
    if (it.dow) chips += '<span class="chip">' + esc(dowLabel(it)) + '</span>';
    var st = statusOf(it); if (st) chips += '<span class="chip warn">' + esc(st.ja) + '</span>';
    if (on && S.by[it.key]) chips += '<span class="chip">追加：' + esc(S.by[it.key]) + '</span>';
    if (S.done[it.key]) chips += '<span class="chip ok">完了</span>';
    var extra = '';
    if (on && it.type === 'food' && it.reserve) {
      var r = S.resv[it.key] || {};
      extra = '<div class="sub-form"><span>予約</span><select data-act="resvDay" data-k="' + esc(it.key) + '" aria-label="予約の日">' +
        '<option value="">日にちなし</option>' + S.days.map(function (d, i) { return d.park === it.park ? '<option value="' + i + '"' + (r.day === i ? ' selected' : '') + '>' + esc(dateLabel(d.date)) + '</option>' : ''; }).join('') +
        '</select><input type="time" data-act="resvTime" data-k="' + esc(it.key) + '" value="' + esc(r.time || '') + '" aria-label="予約の時間"></div>';
    }
    if (on && it.type === 'show') {
      extra = '<div class="sub-form"><span>見る回</span><input type="time" data-act="showPick" data-k="' + esc(it.key) + '" value="' + esc(S.showPick[it.key] || '') + '" aria-label="見る回の時間">' + (function () { var tt = showTimes(it, todayLA()).filter(function () { return liveFresh(); }); return tt.length ? '<span class="note">今日の回：' + tt.map(fmt).join('・') + '</span>' : ''; })() + '</div>';
    }
    var fv = !!S.fav[it.key];
    return '<div class="item"><input type="checkbox" id="c-' + esc(it.key) + '" data-act="check" data-k="' + esc(it.key) + '"' + (on ? ' checked' : '') + ' aria-label="' + esc(it.ja) + 'をやりたいに入れる">' + icon(it, 40) +
      '<div class="body">' + (pageOf(it) ? nameHTML(it.ja, it.en, 15, pageOf(it)) : '<label for="c-' + esc(it.key) + '">' + nameHTML(it.ja, it.en, 15) + '</label>') + whereHTML(it, inLand) +
      '<div class="chips">' + chips + '</div>' + menuHTML(it) + moveHTML(it) + (isClosed(it) ? '<span class="note" style="color:var(--warn)">' + esc(it.closed) + '。チェックしてもプランには入りません</span>' : '') + (it.note ? (it.note.length > 36 ? '<details class="more"><summary>くわしく</summary><span class="note">' + esc(it.note) + '</span></details>' : '<span class="note">' + esc(it.note) + '</span>') : '') +
      (on && it.guide && it.park === 'out' && it.parks.length === 1 ? '<span class="note">パーク外なので、プランの「パーク外のメモ」に入ります</span>' : on && it.guide && !it.single ? '<span class="note">売り場が1か所に決まらないので、プランの「買い物メモ」に入ります</span>' : '') + extra + '</div><button class="favbtn" data-act="fav" data-k="' + esc(it.key) + '" aria-pressed="' + fv + '" aria-label="' + esc(it.ja) + 'をお気に入りにする">' + STAR + '</button></div>';
  }

  var LABEL_CLS = { '2026確定': 'show', '10月販売中': 'ok', '体験': 'ok' };
  /* レストランの「何が食べられるか」 */
  function menuHTML(it) {
    if (!it.menu) return '';
    var l = linkOf(it);
    return '<div class="menu"><span class="menuhd">主なメニュー</span><span>' + esc(it.menu) + '</span>' + (it.menuEn ? '<span class="en" lang="en">' + esc(it.menuEn) + '</span>' : '') +
      (l && l.menu ? '<a class="menulink" href="' + esc(l.menu) + '" target="_blank" rel="noopener">公式のメニューと値段を見る' + EXT + '</a>' : '') + '</div>';
  }
  /* 移動に使える乗り物の「どこまで行けるか」 */
  function moveHTML(it, here) {
    var m = it.move; if (!m) return '';
    if (m.loop) return '<div class="move loop"><span class="movehd">移動には使えません</span><span>ぐるっと一周して、乗った場所に戻ります</span><span class="en" lang="en">Round trip – returns to where you boarded</span></div>';
    var stops = m.stops.map(function (st) {
      var isHere = here && st.land === here && it.move.stops.filter(function (x) { return x.land === here; }).length === 1;
      return '<li class="' + (st.out ? 'out' : '') + (isHere ? ' here' : '') + '"><i style="background:' + (st.out ? '#FFFFFF' : landColor(it.park, st.land)) + '"></i><span>' + esc(st.ja) + (isHere ? '<b class="herechip">この駅</b>' : '') + '<span class="en" lang="en">' + esc(st.en) + '</span></span></li>';
    }).join('');
    if (m.ring) stops += '<li class="back"><i></i><span>最初の駅に戻る<span class="en" lang="en">Back to the first station</span></span></li>';
    return '<div class="move"><span class="movehd">行ける場所 / <span lang="en">Stops</span></span><ol class="stops' + (m.ring ? ' ring' : stops.indexOf('out') >= 0 || m.stops.length === 2 ? ' both' : '') + '">' + stops + '</ol>' +
      '<span class="note">' + esc(m.how) + '</span>' + (m.howEn ? '<span class="en" lang="en">' + esc(m.howEn) + '</span>' : '') + (m.tip ? '<span class="note">' + esc(m.tip) + '</span>' : '') + '</div>';
  }
  function moveShort(it) {
    var m = it.move; if (!m) return '';
    if (m.loop) return '一周して戻る（移動用ではない）';
    return '行ける場所：' + m.stops.map(function (x) { return x.ja.replace(/（.*?）/g, '').replace(/駅$/, ''); }).join(m.ring ? '→' : '⇄') + (m.ring ? '→（1周）' : '');
  }
  function whereHTML(it, inLand) {
    if (!it.guide) return '';
    var h = '';
    if (it.type !== 'food' || it.storeJa !== it.ja) h += '<span class="land">売り場：' + esc(it.storeJa) + (it.storeEn ? ' / <span lang="en">' + esc(it.storeEn) + '</span>' : '') + '</span>';
    if (inLand) { /* エリアごとにまとめて表示しているので、エリア名は省く */ }
    else if (it.land && D.parks[it.park] && D.parks[it.park].lands[it.land]) h += landHTML(it);
    else if (it.area && it.area !== '複数パーク' && it.area !== 'パーク各所') h += '<span class="land">' + esc(it.area) + '</span>';
    if (it.landmark) h += '<span class="land">目印：' + esc(it.landmark) + '</span>';
    return h ? '<div class="name">' + h + '</div>' : '';
  }

  /* ---------- プラン ---------- */
  function planFor(plans) {
    if (S.dayIdx === -1 || !S.days.length) return plans.live[S.view.park || 'dl'];
    return plans[Math.min(S.dayIdx, S.days.length - 1)];
  }
  function viewPlan(plans) {
    var ti = todayDayIdx();
    var di = S.dayIdx === -1 || !S.days.length ? -1 : Math.min(S.dayIdx, S.days.length - 1);
    var top = '<div class="top-row"><h1>プランチェック</h1></div>';
    top += '<div class="daysel" role="group" aria-label="日にち">' + (ti < 0 ? '<button data-act="day" data-v="-1" aria-pressed="' + (di === -1) + '">今日 ' + esc(dateLabel(todayLA())) + '<br>いまの状況</button>' : '') + S.days.map(function (d, i) {
      return '<button data-act="day" data-v="' + i + '" aria-pressed="' + (i === di) + '">' + esc(dateLabel(d.date)) + '<br>' + esc(parkShort(d.park)) + '</button>';
    }).join('') + '</div>';
    if (di === -1) top += parkSeg(S.view.park || 'dl', 'tpark');
    var p = planFor(plans), park = p.day.park, h = '';
    var pct = p.total ? Math.round(p.placed / p.total * 100) : 0;
    h += '<section class="card" style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;align-items:baseline;gap:6px"><span class="big">' + p.placed + '</span><span class="meta" style="font-size:15px">/ ' + p.total + '件 回れそう</span></div>' +
      '<div class="progress" role="img" aria-label="' + pct + '%"><span style="width:' + pct + '%"></span></div>' +
      '<span class="note">' + esc(D.parks[park].ja) + '・営業 ' + fmt(p.hrs.open) + '〜' + fmt(p.hrs.close) + (p.hrs.live ? '（公式）' : '（仮。公式の時間が出たら自動で更新）') + '</span></section>';
    /* 警告 */
    p.conflicts.forEach(function (c) {
      var an = c.a.it ? c.a.it.ja : c.a.name, bn = c.b.it ? c.b.it.ja : c.b.name;
      var sug = suggestFor(p, c);
      h += '<div class="alert" role="status"><b>厳しい：時間が重なっています</b><span>' + esc(an) + ' ' + fmt(c.a.start) + ' と ' + esc(bn) + ' ' + fmt(c.b.start) + ' が近く、移動と場所取りが間に合いません</span>' +
        (sug ? '<span style="color:var(--ink);font-weight:500">提案：' + esc(sug.text) + '</span><button class="btn" style="align-self:flex-start;margin-top:4px" data-act="applySug" data-k="' + esc(sug.key) + '" data-v="' + esc(sug.time) + '">この回にする</button>' : '<span>どちらかの時間をずらしてください</span>') + '</div>';
    });
    p.rows.filter(function (r) { return r.late && !p.conflicts.some(function (c) { return c.b === r || c.b.start === r.start; }); }).forEach(function (r) {
      h += '<div class="alert" role="status"><b>間に合わないかも</b><span>' + esc(r.it ? r.it.ja : r.name) + '（' + fmt(r.start) + '）の前の予定が押しています</span></div>';
    });
    /* タイムライン */
    h += timelineHTML(p);
    h += mapCard(park, 'この日のルート', pinsFromPlan(p), 'plan');
 var memo = ITEMS.filter(function (it) { return it.guide && S.checks[it.key] && !it.single && it.parks.indexOf(park) >= 0; });
    if (memo.length) h += '<section class="card" style="display:flex;flex-direction:column;gap:8px"><h2>買い物メモ（' + memo.length + '件）</h2><p class="note" style="margin:0">売り場が複数あるもの。近くを通ったときに寄ってください</p>' + memo.map(memoHTML).join('') + '</section>';
    var outMemo = ITEMS.filter(function (it) { return it.guide && S.checks[it.key] && it.parks.length === 1 && it.park === 'out'; });
    if (outMemo.length) h += '<section class="card" style="display:flex;flex-direction:column;gap:8px"><h2>パーク外のメモ（' + outMemo.length + '件）</h2><p class="note" style="margin:0">ダウンタウン・ディズニーやホテル。パークの行き帰りに</p>' + outMemo.map(memoHTML).join('') + '</section>';
    if (p.tbd.length) h += '<section class="card"><h2>時間が未定のショー</h2><p class="note" style="margin:4px 0 0">' + p.tbd.map(function (it) { return esc(it.ja); }).join('・') + '：公式の公演時間が出ると自動で入ります。「やりたい」で見る回を入れることもできます</p></section>';
    if (p.carried.length) h += '<section class="card"><h2>次の' + esc(parkShort(park)) + 'の日に回すもの（' + p.carried.length + '件）</h2><p class="note" style="margin:4px 0 0">' + p.carried.map(function (it) { return esc(it.ja); }).join('・') + '</p></section>';
    var shut = p.left.filter(function (it) { return isClosed(it); });
    if (shut.length) h += '<section class="card" style="display:flex;flex-direction:column;gap:6px"><h2>休止中のため入れていないもの（' + shut.length + '件）</h2><p class="note" style="margin:0">' + shut.map(function (it) { return esc(it.ja) + '（' + esc(it.closed) + '）'; }).join('・') + '</p></section>';
    p.left = p.left.filter(function (it) { return !isClosed(it); });
    if (p.left.length) {
      h += '<section class="card" style="display:flex;flex-direction:column;gap:6px"><h2>回れなさそう（' + p.left.length + '件）</h2><p class="note" style="margin:0">' + p.left.map(function (it) { return esc(it.ja); }).join('・') + '</p>' +
        '<p class="note" style="margin:0">日程を1日増やす、優先度の低いもののチェックを外す、などで入ります。</p></section>';
    }
    /* 予定の追加 */
    var L = D.parks[park].lands;
    h += '<section class="card" style="display:flex;flex-direction:column;gap:8px"><h2>自分の予定を追加</h2><p class="note" style="margin:0">お昼寝・休憩・待ち合わせなど</p>' +
      '<div class="grid2"><label class="field">内容<input id="exName" placeholder="例：ベビーカーでお昼寝"></label><label class="field">時間<input id="exTime" type="time" value="12:30"></label>' +
      '<label class="field">何分<input id="exDur" type="number" inputmode="numeric" min="5" step="5" value="60"></label><label class="field">場所<select id="exLand">' +
      Object.keys(L).map(function (k) { return '<option value="' + k + '">' + esc(L[k].ja) + '</option>'; }).join('') + '</select></label></div>' +
      '<button class="btn ghost" data-act="addExtra">予定に入れる</button>' +
      S.extra.map(function (x, j) { return x.day === di ? '<div class="li" style="display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:13px"><span>' + esc(x.time) + ' ' + esc(x.name) + '（' + esc(x.dur) + '分）</span><button class="btn" data-act="delExtra" data-v="' + j + '">消す</button></div>' : ''; }).join('') +
      '</section>';
    return { top: top, main: h };
  }
  function suggestFor(p, c) {
    var cands = [c.b, c.a].filter(function (f) { return f.kind === 'show'; });
    for (var i = 0; i < cands.length; i++) {
      var f = cands[i];
      var alts = p.lane.filter(function (L) { return L.it === f.it && L.start !== f.start && !L.busy; });
      if (alts.length) return { key: f.it.key, time: hhmm(alts[0].start), text: f.it.ja + 'は ' + fmt(alts[0].start) + ' の回で見る' };
    }
    return null;
  }
  function timelineHTML(p) {
    var entries = [];
    p.rows.forEach(function (r) {
      if (r.kind === 'show') return;
      var body;
      if (r.kind === 'item') {
        var it = r.it, info = it.type === 'ride' ? '待ち' + r.wait + '分' + (r.live ? '' : '（目安）') : it.type === 'food' ? '食事' : it.type === 'snack' ? 'おやつ' : 'お買い物';
        if (it.guide && it.storeJa && it.storeJa !== it.ja) info = it.storeJa + '・' + info;
        if (r.rs) info += '・大人は交代で';
        body = '<div class="tlname">' + icon(it, 28) + '<div style="min-width:0;flex:1">' + nameHTML(it.ja, it.en, 14, pageOf(it)) + '</div>' + favMark(it) + '</div><span class="note">' + esc(info) + '・徒歩' + r.walk + '分</span>';
      } else if (r.kind === 'resv') body = nameHTML(r.it.ja + '（予約）', r.it.en, 14, pageOf(r.it)) + '<span class="note">固定の予定・' + r.dur + '分</span>';
      else body = '<div class="name"><span class="ja" style="font-size:14px">' + esc(r.name) + '</span></div><span class="note">自分の予定・' + r.dur + '分</span>';
      entries.push({ t: r.start, n: r.n, body: body, right: '' });
    });
    p.lane.forEach(function (L) {
      var cls = 'lane' + (L.conflict ? ' conflict' : '') + (L.chosen ? ' mine' : '');
      var lab = L.conflict ? '重なり' : L.chosen ? '見る予定' : L.busy ? '' : '見に行ける';
      var chip = '<div class="' + cls + '"><b>' + esc(L.it.ja) + '</b><span lang="en">' + esc(L.it.en) + '</span>' + (lab ? '<b>' + lab + '</b>' : '') + '</div>';
      var mr = L.chosen ? p.rows.filter(function (r) { return r.kind === 'show' && r.it === L.it && r.start === L.start; })[0] : null;
      var body = L.chosen ? '<span class="free">ショーを見る' + (L.hold ? '（' + L.hold + '分前から場所取り）' : '') + '</span>'
        : L.busy ? '<span class="free">（' + esc(L.busy.it ? L.busy.it.ja : L.busy.name) + ' の時間）</span>' : '<span class="free">（空き時間）</span>';
      entries.push({ t: L.start, n: mr ? mr.n : null, body: body, right: chip, lane: true });
    });
    entries.sort(function (a, b) { return a.t - b.t || (a.lane ? 1 : -1); });
    function row(t, n, body, right) {
      return '<div class="r" role="row"><span class="t" role="cell">' + fmt(t) + '</span><div class="tlbody' + (right ? '' : ' wide') + '" role="cell">' +
        (n ? '<span class="num" aria-label="' + n + '番目">' + n + '</span>' : '<span class="num ghost" aria-hidden="true"></span>') +
        '<div class="tlmain">' + body + '</div></div>' + (right ? '<div role="cell">' + right + '</div>' : '') + '</div>';
    }
    var h = '<div class="tl" role="table" aria-label="タイムライン"><div class="r h" role="row"><span role="columnheader">時間</span><span role="columnheader">自分の予定</span><span role="columnheader">ショー・パレード</span></div>';
    h += row(p.hrs.open, null, '<div class="name"><span class="ja" style="font-size:14px">開園</span><span class="en" lang="en">Park opens</span></div>', '');
    entries.forEach(function (e) { h += row(e.t, e.n, e.body, e.right); });
    h += row(p.hrs.close, null, '<div class="name"><span class="ja" style="font-size:14px">閉園</span><span class="en" lang="en">Park closes</span></div>', '') + '</div>';
    if (!entries.length) h += '<p class="empty">「やりたい」タブでチェックを入れると、ここに1日の流れが出ます。</p>';
    return h;
  }

  var CROWD_WORD = ['', '空き', 'ふつう', 'やや混む', '混む', 'とても混む'];
  function memoHTML(it) {
    return '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding-top:6px;border-top:1px solid var(--soft)' + (S.done[it.key] ? ';opacity:.55' : '') + '">' + icon(it, 32) + '<div class="name" style="flex:1">' + favMark(it) + '<span class="ja" style="font-size:14px">' + esc(it.ja) + '</span>' + (it.en ? '<span class="en" lang="en">' + esc(it.en) + '</span>' : '') +
      '<span class="land">売り場：' + esc(it.storeJa) + (it.storeEn ? ' / <span lang="en">' + esc(it.storeEn) + '</span>' : '') + '</span></div>' +
      '<button class="btn" style="min-width:44px;padding:0 8px" data-act="toggleDone" data-k="' + esc(it.key) + '">' + (S.done[it.key] ? '戻す' : '済') + '</button></div>';
  }
  /* ---------- 準備 ---------- */
  function viewPrep() {
    var top = '<h1>事前準備</h1>', h = '';
    /* 日程 */
    h += '<section class="card" style="display:flex;flex-direction:column;gap:8px"><h2>行く日とパーク</h2><span class="note">現地の日付で入れてください</span>' +
      S.days.map(function (d, i) {
        return '<div class="grid2" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) auto;align-items:end"><label class="field">' + (i + 1) + '日目<input type="date" data-act="dayDate" data-v="' + i + '" value="' + esc(d.date) + '"></label>' +
          '<label class="field">パーク<select data-act="dayPark" data-v="' + i + '"><option value="dl"' + (d.park === 'dl' ? ' selected' : '') + '>ランド</option><option value="dca"' + (d.park === 'dca' ? ' selected' : '') + '>カリフォルニア</option></select></label>' +
          '<button class="btn" data-act="delDay" data-v="' + i + '" aria-label="' + (i + 1) + '日目を消す">消す</button></div>';
      }).join('') + '<button class="btn ghost" data-act="addDay">日を追加</button></section>';
    /* 子どもの身長 */
    h += '<section class="card" style="display:flex;flex-direction:column;gap:8px"><h2>子どもの身長</h2><span class="note">乗れるかどうかの判定に使います（いまは仮の値）</span>' +
      S.kids.map(function (k, i) {
        return '<div class="grid2" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;align-items:end"><label class="field">呼び名<input data-act="kidName" data-v="' + i + '" value="' + esc(k.name) + '"></label>' +
          '<label class="field">身長(cm)<input type="number" inputmode="numeric" data-act="kidCm" data-v="' + i + '" value="' + esc(k.cm) + '"></label><button class="btn" data-act="delKid" data-v="' + i + '">消す</button></div>';
      }).join('') + '<button class="btn ghost" data-act="addKid">子どもを追加</button>' +
      '<label class="field">この端末を使う人の名前（チェックした人として表示）<input data-act="me" value="' + esc(S.me) + '"></label></section>';
    /* 家族の部屋 */
    h += roomCardHTML();
    /* 混雑 */
    h += '<section class="card" style="display:flex;flex-direction:column;gap:10px"><div class="top-row"><h2>混雑予想カレンダー</h2><span class="meta">予想の目安</span></div>' +
      '<div class="bars" role="img" aria-label="混雑の目安。旅行の日は枠で囲んでいます">' + D.crowd.map(function (c) {
        var mine = S.days.some(function (d) { return d.date === c.date; });
        return '<div' + (mine ? ' class="mine"' : '') + '><em>' + CROWD_WORD[c.level] + '</em><i class="lv' + c.level + '" style="height:' + (c.level * 14) + 'px"></i><span>' + esc(dateLabel(c.date)) + '</span></div>';
      }).join('') + '</div><ul style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:2px;font-size:13px">' +
      D.crowd.map(function (c) { return '<li>' + esc(dateLabel(c.date)) + '：' + esc(c.ja) + '</li>'; }).join('') +
      '</ul><span class="note">' + esc(D.crowdSource) + '。棒が高いほど混む目安。枠で囲んだ日が旅行の日。</span></section>';
    /* 地図 */
    var mp = S.view.mapPark;
    h += mapCard(mp, 'パークの地図', null, 'prep', parkSeg(mp, 'mpark'));
    /* お土産 */
    var shops = ITEMS.filter(function (it) { return it.guide && it.park === mp && it.type === 'shop' && it.single && it.label === '定番'; });
    h += '<section class="card" style="display:flex;flex-direction:column;gap:10px"><h2>おもなお土産ショップ</h2>' + shops.map(function (it) {
      var L = landOf(it);
      return '<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">' + nameHTML(it.storeJa, it.storeEn, 14) + '<div class="name" style="align-items:flex-end;text-align:right"><span class="land">' + esc(L.ja) + '</span><span class="en" lang="en">' + esc(L.en) + '</span></div></div><span class="note">' + esc(it.ja) + (it.landmark ? '・目印：' + esc(it.landmark) : '') + '</span>';
    }).join('') + '<span class="note">グッズの詳しい一覧は「やりたい」タブの「グッズ」で見られます。</span>' + '<span class="note">閉園前はメインストリートのお店が特に混むので、昼のうちに買うのがおすすめ。パーク外のダウンタウン・ディズニーにも大きなお店（ワールド・オブ・ディズニー）があります。</span></section>';
    /* 共有コード（手動） */
    h += '<section class="card" style="display:flex;flex-direction:column;gap:8px"><details class="more"><summary>共有コードで受け渡す（手動）</summary>' +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-top:6px"><span class="note">部屋を使わずに、コードをLINEなどで送って相手の端末で読み込む方法です。</span>' +
      '<button class="btn" data-act="exportCode">共有コードをコピー</button>' +
      '<label class="field">受け取った共有コード<textarea id="importCode" rows="3" style="border:1px solid var(--line);border-radius:10px;background:var(--bg);padding:8px;font:inherit;font-size:12px"></textarea></label>' +
      '<button class="btn ghost" data-act="importCode">読み込んで合わせる</button><span class="note" id="shareMsg" role="status"></span></div></details></section>';
    if (S.sample) h += '<section class="card" style="display:flex;flex-direction:column;gap:8px"><h2>例のチェック</h2><span class="note">いま入っているチェックは画面の見本です。</span><button class="btn" data-act="clearSample">例のチェックを全部消す</button></section>';
    h += '<p class="note">パーク情報の最終更新：' + esc(D.updated) + '。一度開くとスマホに保存され、電波が弱くても見られます（待ち時間など最新情報は電波が必要）。</p>';
    return { top: top, main: h };
  }
  /* ---------- イラスト地図 ---------- */
  var MAP = window.PARK_MAP;
  var ROAD = '#F7ECD2', ROAD_EDGE = '#CDB487';
  var ICONS = {
    castle: '<rect x="-3.6" y="-1.2" width="7.2" height="4.6" fill="#F4B6CE" stroke="#8A3D63" stroke-width=".3"/><rect x="-1.3" y="-4.4" width="2.6" height="3.4" fill="#F4B6CE" stroke="#8A3D63" stroke-width=".3"/><path d="M-1.7 -4.4L0 -7.8L1.7 -4.4Z" fill="#4F7FD0"/><rect x="-4.3" y="-2.8" width="1.7" height="6.2" fill="#F4B6CE" stroke="#8A3D63" stroke-width=".3"/><path d="M-4.7 -2.8L-3.45 -5.4L-2.2 -2.8Z" fill="#4F7FD0"/><rect x="2.6" y="-2.8" width="1.7" height="6.2" fill="#F4B6CE" stroke="#8A3D63" stroke-width=".3"/><path d="M2.2 -2.8L3.45 -5.4L4.7 -2.8Z" fill="#4F7FD0"/><path d="M-.9 3.4V1.8A.9 .9 0 0 1 .9 1.8V3.4Z" fill="#8A3D63"/>',
    snow: '<path d="M-4.6 3.5L-.5 -5.2L4.6 3.5Z" fill="#8FA3B8" stroke="#4E6175" stroke-width=".3"/><path d="M-2.4 -1L-.5 -5.2L1.7 -.9L.5 -1.8L-.6 -.4Z" fill="#FFFFFF"/>',
    rock: '<path d="M-5 3.5L-3 -2L-1.5 0L0 -4.6L2 -1L3.2 -3L5 3.5Z" fill="#C8643C" stroke="#7A3518" stroke-width=".3"/>',
    clock: '<rect x="-3.5" y="-2" width="7" height="5.5" fill="#FFFFFF" stroke="#B08A2E" stroke-width=".3"/><path d="M-3.5 -2L0 -5.6L3.5 -2Z" fill="#F2C94C" stroke="#B08A2E" stroke-width=".3"/><circle cx="0" cy=".7" r="1.5" fill="#F2C94C"/>',
    dome: '<path d="M-4.6 3.2V2.6A4.6 5.2 0 0 1 4.6 2.6V3.2Z" fill="#FFFFFF" stroke="#5B7EA6" stroke-width=".35"/><path d="M-2.6 -1.4L0 3.2M2.6 -1.4L0 3.2M0 -2.5V3.2" stroke="#9DB6D2" stroke-width=".3"/>',
    ship: '<path d="M-4.6 1H4.6L3 3.6H-3Z" fill="#7A4A26"/><path d="M-.3 1V-5" stroke="#5A3A1E" stroke-width=".35"/><path d="M-.1 -4.6L3 .4H-.1Z" fill="#FFFFFF" stroke="#8A8A8A" stroke-width=".2"/><path d="M-.5 -4L-3.4 .4H-.5Z" fill="#F4F0E6" stroke="#8A8A8A" stroke-width=".2"/>',
    house: '<rect x="-3.2" y="-.6" width="6.4" height="4.1" fill="#E9E4F2" stroke="#4A3A6A" stroke-width=".3"/><path d="M-4 -.6L0 -4.5L4 -.6Z" fill="#4A3A6A"/><rect x="-.7" y="1.3" width="1.4" height="2.2" fill="#4A3A6A"/>',
    temple: '<path d="M-4.6 3.5H4.6L3.7 1.5H-3.7Z M-3.4 1.4H3.4L2.6 -.7H-2.6Z M-2.4 -.8H2.4L1.6 -3H-1.6Z" fill="#D8B074" stroke="#7A5A28" stroke-width=".3"/>',
    falcon: '<circle r="3.6" fill="#C9C9C9" stroke="#555555" stroke-width=".3"/><rect x="-3" y="-5.3" width="1.6" height="3" fill="#C9C9C9" stroke="#555555" stroke-width=".3"/><rect x="1.4" y="-5.3" width="1.6" height="3" fill="#C9C9C9" stroke="#555555" stroke-width=".3"/><circle cx="2.6" cy="1.6" r=".9" fill="#555555"/>',
    theatre: '<rect x="-2.4" y="-2.5" width="4.8" height="6" fill="#FFFFFF" stroke="#7A6A4A" stroke-width=".3"/><path d="M-2.8 -2.5L0 -5.6L2.8 -2.5Z" fill="#5B8BD9"/><rect x="-4.6" y="1" width="9.2" height="2.5" fill="#F3E2C2" stroke="#7A6A4A" stroke-width=".3"/>',
    tower: '<rect x="-2" y="-6" width="4" height="9.5" fill="#3A3F55" stroke="#1E2233" stroke-width=".3"/><rect x="-2" y="-6" width="4" height="1.5" fill="#E8B84A"/>',
    coaster: '<path d="M-5 3.5Q-3 -5.4 0 -1Q3 3 5 -3.2" fill="none" stroke="#D3463B" stroke-width=".9" stroke-linecap="round"/><path d="M-5 3.6H5" stroke="#7A3518" stroke-width=".4"/>',
    wheel: '<path d="M-2 5L0 0L2 5" stroke="#555555" stroke-width=".4" fill="none"/><circle r="3.8" fill="none" stroke="#3D6FC4" stroke-width=".6"/><path d="M-3.8 0H3.8M0 -3.8V3.8M-2.7 -2.7L2.7 2.7M2.7 -2.7L-2.7 2.7" stroke="#3D6FC4" stroke-width=".3"/>',
    baby: '<circle r="2.1" fill="#D94F8C" stroke="#FFFFFF" stroke-width=".45"/><text y=".9" text-anchor="middle" font-size="2.5" font-weight="700" fill="#FFFFFF">B</text>',
    aid: '<circle r="2.1" fill="#FFFFFF" stroke="#D3463B" stroke-width=".45"/><path d="M-1.15 0H1.15M0 -1.15V1.15" stroke="#D3463B" stroke-width=".75"/>'
  };
  function landPos(park, land) { var L = MAP[park].lands[land]; return L ? L.c : MAP[park].hub; }
  function landColor(park, land) { var L = MAP[park] && MAP[park].lands[land]; return L && L.color ? L.color : '#DCE1EA'; }
  function project(park, ll) {
    var P = MAP[park].proj, x = ll[1] * P.k, y = -ll[0];
    if (P.rot === 180) { x = -x; y = -y; }
    return [Math.round(((x - P.minx) * P.scale + P.margin) * 10) / 10, Math.round(((y - P.miny) * P.scale + P.margin) * 10) / 10];
  }
  function itemPos(it) { if (it.ll) return project(it.park, it.ll); var p = MAP[it.park].items[it.en]; return p || landPos(it.park, it.land); }
  /* 文字の置き場所の微調整（エリア名・目印名が重ならないように） */
  var LABEL = { /* エリア名を置く場所（地図上の空いているところ） */
    dl: { main: [68.0, 77.1], adv: [41.7, 58.5], nos: [20.8, 78.0], bayou: [11.7, 45.3], front: [40.8, 43.0], gal: [15.4, 29.9], fant: [57.1, 29.9], toon: [58.9, 10.8], tomo: [78.9, 54.8] },
    dca: { bvs: [46, 61], hol: [15, 66], avg: [24, 35], cars: [20, 25], sfs: [52, 37.5], griz: [56, 46], pgp: [84, 40], pier: [84, 6] }
  };
  var MARK_LABEL = { /* 目印の名前の位置（アイコンからのずれ） */
    dl: { 'お城': [9, 1], 'マッターホーン': [12, 1], 'ビッグサンダー': [-8, 1.5], 'スモールワールド': [0, -6.5], 'スペースマウンテン': [0, 6], 'カリブの海賊': [-3, 6.5], 'ホーンテッド': [-10, 0.5], 'インディ': [3.7, 6.5], 'ファルコン': [0, 6] },
    dca: { 'カーセイ劇場': [9, 1], 'ガーディアンズ': [0, 6], 'ラジエーター': [0, -6.5], 'インクレディコースター': [0, 6], '観覧車': [9, 1], 'グリズリー山': [10, 0] }
  };
  function pinsFromPlan(plan, nextRow) {
    if (!plan) return [];
    var seen = {};
    return plan.rows.filter(function (r) { return r.land || (r.it && r.it.land); }).map(function (r) {
      var p = r.it ? itemPos(r.it) : landPos(plan.day.park, r.land);
      var key = p[0] + ',' + p[1], k = seen[key] = (seen[key] || 0) + 1;
      return { n: r.n, x: p[0] + (k - 1) * 3.2, y: p[1] - (k - 1) * 1.2, next: nextRow === r, done: r.it && S.done[r.it.key], key: r.it ? r.it.key : '', land: r.it ? r.it.land : r.land };
    });
  }
  function mtext(x, y, str, size, fill, weight, anchor, lang) {
    return '<text x="' + (+x).toFixed(1) + '" y="' + (+y).toFixed(1) + '" font-size="' + size + '" fill="' + fill + '"' + (weight ? ' font-weight="' + weight + '"' : '') + ' text-anchor="' + (anchor || 'middle') + '"' + (lang ? ' lang="' + lang + '"' : '') + ' class="halo">' + esc(str) + '</text>';
  }
  function favSpots(park) {
    return ITEMS.filter(function (it) { return S.fav[it.key] && it.park === park && it.land && P_LANDS(park)[it.land] && (!it.guide || it.single); })
      .map(function (it) { var p = itemPos(it); return { key: it.key, land: it.land, x: p[0], y: p[1] }; });
  }
  function P_LANDS(park) { return MAP[park].lands; }
  function starAt(x, y, sc) { return '<g transform="translate(' + (+x).toFixed(1) + ' ' + (+y).toFixed(1) + ') scale(' + sc + ') translate(-12 -12)"><path d="M12 3.2l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17.2l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="#F2B705" stroke="#FFFFFF" stroke-width="2.6" stroke-linejoin="round" paint-order="stroke"/></g>'; }
  /* opt: { tap: タッチできる地図か, sel: 選んだエリア {land, key} } */
  function mapSVG(park, pins, opt) {
    opt = opt || {};
    var M = MAP[park], P = D.parks[park], H = M.h, sel = opt.sel && opt.sel.park === park ? opt.sel : null;
    var s = '<svg class="map' + (opt.tap ? ' tap' : '') + '" viewBox="0 0 100 ' + H + '" role="img" aria-label="' + esc(P.ja) + 'のイラスト地図。入口が下">';
    s += '<rect x="0" y="0" width="100" height="' + H + '" rx="4" fill="#E4EFD3"/>';
    /* 木（外周の飾り） */
    var per = 2 * (100 + H), n = 54;
    for (var i = 0; i < n; i++) {
      var d0 = i / n * per, x, y;
      if (d0 < 100) { x = d0; y = 1.6; } else if (d0 < 100 + H) { x = 98.4; y = d0 - 100; } else if (d0 < 200 + H) { x = 100 - (d0 - 100 - H); y = H - 1.6; } else { x = 1.6; y = H - (d0 - 200 - H); }
      if (Math.abs(x - M.entrance[0]) < 12 && y > H - 6) continue;
      s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (1.3 + (i % 3) * 0.35) + '" fill="' + (i % 2 ? '#8DBA6A' : '#7AAE58') + '"/>';
    }
    /* エリア（実際のアトラクションの位置に色を塗って形にする） */
    var keys = Object.keys(M.lands);
    keys.forEach(function (k) { M.lands[k].pts.forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="6.2" fill="#FFFFFF"/>'; }); });
    keys.forEach(function (k) { var L = M.lands[k]; L.pts.forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="5.6" fill="' + L.color + '"/>'; }); });
    if (sel && M.lands[sel.land]) { /* 選んだエリアを青いふちで目立たせる */
      var SL = M.lands[sel.land];
      s += '<rect x="0" y="0" width="100" height="' + H + '" fill="#FFFFFF" opacity=".45"/>';
      SL.pts.forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="6.4" fill="#2457D6"/>'; });
      SL.pts.forEach(function (p) { s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="5.6" fill="' + SL.color + '"/>'; });
    }
    /* 川・湖 */
    M.water.forEach(function (d) { s += '<path d="' + d + '" fill="#A9D6EE" stroke="#7DB7D8" stroke-width=".4" stroke-linejoin="round"/>'; });
    if (M.island) s += '<ellipse cx="' + M.island[0] + '" cy="' + M.island[1] + '" rx="' + M.island[2] + '" ry="' + M.island[3] + '" fill="#BFE3A6" stroke="#8DBA6A" stroke-width=".3"/>';
    /* 大きな道 */
    M.roads.forEach(function (d) { s += '<path d="' + d + '" fill="none" stroke="' + ROAD_EDGE + '" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>'; });
    M.roads.forEach(function (d) { s += '<path d="' + d + '" fill="none" stroke="' + ROAD + '" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/>'; });
    s += '<circle cx="' + M.hub[0] + '" cy="' + M.hub[1] + '" r="4" fill="' + ROAD + '" stroke="' + ROAD_EDGE + '" stroke-width=".5"/>';
    if (M.waterLabel) s += mtext(M.waterLabel.xy[0], M.waterLabel.xy[1], M.waterLabel.ja, 2.1, '#1B4F5E', 700) + mtext(M.waterLabel.xy[0], M.waterLabel.xy[1] + 2.4, M.waterLabel.en, 1.7, '#1B4F5E', 0, 'middle', 'en');
    /* ディズニーランド鉄道の線路（駅の位置は正確、線はおおまか） */
    if (M.rail) s += '<path d="' + M.rail + '" fill="none" stroke="#7A5236" stroke-width="1.15" stroke-linejoin="round"/><path d="' + M.rail + '" fill="none" stroke="#F3E6D3" stroke-width=".5" stroke-dasharray=".35 .9"/>';
    /* パレードルート */
    if (M.parade) s += '<path d="' + M.parade + '" fill="none" stroke="#E8890C" stroke-width="1.4" stroke-dasharray="2.2 1.4" stroke-linecap="round" stroke-linejoin="round"/>';
    /* 目印 */
    M.landmarks.forEach(function (m) { s += '<g transform="translate(' + m.xy[0] + ' ' + m.xy[1] + ') scale(.82)">' + ICONS[m.icon] + '</g>'; });
    M.facilities.forEach(function (f) { s += '<g transform="translate(' + f.xy[0] + ' ' + f.xy[1] + ') scale(.85)"><title>' + esc(f.ja) + '</title>' + ICONS[f.icon] + '</g>'; });
    /* 文字 */
    keys.forEach(function (k) {
      var L = M.lands[k], o = (LABEL[park] || {})[k] || L.c, nm = P.lands[k];
      s += mtext(o[0], o[1], L.short || nm.ja, 3.1, L.ink, 700) + mtext(o[0], o[1] + 2.5, nm.en, 1.9, L.ink, 0, 'middle', 'en');
    });
    M.landmarks.forEach(function (m) {
      var o = (MARK_LABEL[park] || {})[m.ja] || [0, 6];
      s += mtext(m.xy[0] + o[0], m.xy[1] + o[1], m.ja, 2.2, '#222222', 700) + mtext(m.xy[0] + o[0], m.xy[1] + o[1] + 2.1, m.en, 1.6, '#444444', 0, 'middle', 'en');
    });
    /* 方角 */
    var rot = M.north || 0;
    var cy = H - 9;
    s += '<g transform="translate(91 ' + cy + ') rotate(' + rot + ')"><circle r="3.4" fill="#FFFFFF" stroke="#9AA3B6" stroke-width=".3"/><path d="M0 -2.6L1.2 .8L0 .2L-1.2 .8Z" fill="#D3463B"/></g>' +
      '<text x="91" y="' + (rot ? cy + 6 : cy - 4.4) + '" font-size="1.9" text-anchor="middle" fill="#444444" font-weight="700" class="halo">北 N</text>';
    /* 入口 */
    var e = M.entrance;
    s += '<rect x="' + (e[0] - 9) + '" y="' + (e[1] - 1.5) + '" width="18" height="4.6" rx="2.3" fill="#2457D6"/><text x="' + e[0] + '" y="' + (e[1] + 1.8) + '" font-size="2.3" fill="#FFFFFF" text-anchor="middle" font-weight="700">入口 Entrance</text>';
    /* タッチ用（エリアの上を押すと、そのエリアの中身を出す） */
    if (opt.tap) keys.forEach(function (k) {
      s += '<g data-act="mapLand" data-v="' + k + '" fill="transparent"><title>' + esc(P.lands[k].ja) + '</title>' + M.lands[k].pts.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="5.6"/>'; }).join('') + '</g>';
    });
    /* 駅（鉄道・モノレール） */
    var rr = find('ディズニーランド鉄道'), mono = find('ディズニーランド・モノレール');
    if (M.stations) M.stations.forEach(function (st) {
      var g = '<g transform="translate(' + st.xy[0] + ' ' + st.xy[1] + ')"><circle r="2.3" fill="#7A5236" stroke="#FFFFFF" stroke-width=".5"/><text y=".8" font-size="2.2" font-weight="700" text-anchor="middle" fill="#FFFFFF">駅</text></g>';
      s += opt.tap && rr ? '<g data-act="mapItem" data-k="' + esc(rr.key) + '" data-v="' + st.land + '"><title>' + esc(st.ja) + '</title><circle cx="' + st.xy[0] + '" cy="' + st.xy[1] + '" r="3.6" fill="transparent"/>' + g + '</g>' : g;
    });
    if (mono && park === 'dl') {
      var mp = itemPos(mono), mg = '<g transform="translate(' + mp[0] + ' ' + mp[1] + ')"><rect x="-2.3" y="-2.1" width="4.6" height="4.2" rx="1.2" fill="#1F7A8C" stroke="#FFFFFF" stroke-width=".5"/><text y=".8" font-size="2.2" font-weight="700" text-anchor="middle" fill="#FFFFFF">モ</text></g>';
      s += opt.tap ? '<g data-act="mapItem" data-k="' + esc(mono.key) + '" data-v="' + mono.land + '"><title>' + esc(mono.ja) + '</title><circle cx="' + mp[0] + '" cy="' + mp[1] + '" r="3.6" fill="transparent"/>' + mg + '</g>' : mg;
    }
    if (sel && sel.key) { var sp = BYKEY[sel.key]; if (sp && sp.park === park) { var q = itemPos(sp);
      if (sp.move && M.stations && sp === rr) M.stations.forEach(function (st) { if (st.land === sel.land) q = st.xy; }); s += '<circle cx="' + q[0] + '" cy="' + q[1] + '" r="4.2" fill="none" stroke="#2457D6" stroke-width=".8"/>'; } }
    /* お気に入り（★） */
    var pinKeys = {}; (pins || []).forEach(function (p) { if (p.key) pinKeys[p.key] = p; });
    favSpots(park).forEach(function (f) {
      if (pinKeys[f.key]) return; /* 回る順番に入っているものは番号の横に小さく出す */
      s += opt.tap ? '<g data-act="mapItem" data-k="' + esc(f.key) + '" data-v="' + f.land + '"><circle cx="' + f.x + '" cy="' + f.y + '" r="3.6" fill="transparent"/>' + starAt(f.x, f.y, .16) + '</g>' : starAt(f.x, f.y, .16);
    });
    /* プランの順番 */
    if (pins && pins.length) {
      var d = 'M' + e[0] + ' ' + (e[1] - 1.5) + pins.map(function (p) { return ' L' + p.x.toFixed(1) + ' ' + p.y.toFixed(1); }).join('');
      s += '<path d="' + d + '" fill="none" stroke="#2457D6" stroke-width=".6" stroke-dasharray="1.5 1" stroke-linejoin="round"/>';
      pins.forEach(function (p) {
        var r = p.next ? 3 : 2.2, fill = p.next ? '#E8890C' : p.done ? '#9AA3B6' : '#2457D6';
        var g = '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="' + r + '" fill="' + fill + '" stroke="#FFFFFF" stroke-width=".55"/><text x="' + p.x.toFixed(1) + '" y="' + (p.y + (p.next ? 1.05 : 0.8)).toFixed(1) + '" font-size="' + (p.next ? 2.8 : 2.2) + '" fill="#FFFFFF" font-weight="700" text-anchor="middle">' + p.n + '</text>' +
          (p.key && S.fav[p.key] ? starAt(p.x + r * .8, p.y - r * .8, .11) : '');
        s += opt.tap && p.land ? '<g data-act="mapItem" data-k="' + esc(p.key) + '" data-v="' + p.land + '"><circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.8" fill="transparent"/>' + g + '</g>' : g;
      });
    }
    return s + '</svg>';
  }
  function mapLegend(park, withPins) {
    var M = MAP[park];
    return '<div class="legend">' +
      (withPins ? '<span><span class="k pinkey">1</span>回る順番（オレンジは次の行き先）</span>' : '') +
      (favSpots(park).length ? '<span><span class="k favmark">' + STAR + '</span>お気に入り / <span lang="en">Favorites</span></span>' : '') +
      '<span><span class="k" style="width:28px;height:6px;background:' + ROAD + ';border:1px solid ' + ROAD_EDGE + ';border-radius:3px"></span>大きな道 / <span lang="en">Main walkways</span></span>' +
      (M.stations ? '<span><span class="k" style="width:28px;height:5px;background:#7A5236;border-radius:2px"></span><span class="k stkey">駅</span>ディズニーランド鉄道と駅（パークを1周・どの駅でも乗り降りOK） / <span lang="en">Railroad &amp; stations</span></span>' +
        '<span><span class="k monokey">モ</span>モノレール駅（ダウンタウン・ディズニーへ） / <span lang="en">Monorail</span></span>' : '') +
      '<span><span class="k babykey">B</span>ベビーセンター（おむつ替え・授乳） / <span lang="en">Baby Care Center</span></span>' +
      '<span><span class="k aidkey">+</span>救護室 / <span lang="en">First Aid</span></span>' +
      (M.parade ? '<span><span class="k" style="width:28px;border-top:3px dashed #E8890C"></span>' + esc(M.parade_text.ja) + 'のルート（例） / <span lang="en">Parade Route</span></span><span class="note">' + esc(M.parade_text.note) + '</span>'
        : '<span class="note">このパークのパレードのルートは未確認です。わかり次第追加します。</span>') +
      '<span class="note">アトラクションの位置は実際の位置情報（緯度・経度）から配置。入口から入って前を向いた向きで、入口が下になるようにしています' + (M.north ? '（このパークは北が下）' : '') + '。道は主な通路のおおまかな線で、縮尺は目安です。</span></div>';
  }
  function mapCard(park, title, pins, ctx, extra) {
    return '<section class="card" style="display:flex;flex-direction:column;gap:10px"><div class="top-row"><h2>' + esc(title) + '</h2><span class="meta">タップで拡大</span></div>' + (extra || '') +
      '<button class="mapbtn" data-act="mapOpen" data-v="' + park + '" data-k="' + ctx + '" aria-label="地図を大きく表示">' + mapSVG(park, pins) + '</button>' +
      mapLegend(park, pins && pins.length) + '</section>';
  }
  function mapOverlay(plans) {
    var F = S.view.mapFull; if (!F) return '';
    var pins = [];
    if (F.ctx === 'plan') pins = pinsFromPlan(planFor(plans));
    if (F.ctx === 'today') pins = todayPins(plans);
    var z = S.view.mapZoom || 1, sel = S.view.mapSel && S.view.mapSel.park === F.park ? S.view.mapSel : null;
    var plan = F.ctx === 'plan' ? planFor(plans) : F.ctx === 'today' ? todayCtx(plans).plan : null;
    return '<div class="mapfull" role="dialog" aria-modal="true" aria-label="地図"><div class="mapfull-bar"><b>' + esc(D.parks[F.park].ja) + '</b>' +
      '<button class="btn" data-act="mapZoom">' + (z > 1 ? '縮小' : '拡大') + '</button><button class="btn primary" data-act="mapClose">閉じる</button></div>' +
      '<div class="mapfull-body">' + (sel ? '' : '<p class="maphint">番号・★・エリアをタッチすると、そこにあるものが下に出ます</p>') +
      '<div style="width:' + (z > 1 ? 220 : 100) + '%">' + mapSVG(F.park, pins, { tap: true, sel: sel }) + '</div>' + mapLegend(F.park, pins.length) + '</div>' +
      (sel ? mapSheet(F.park, sel, plan) : '') + '</div>';
  }
  /* 地図でエリアを選んだときの「このエリアにあるもの」 */
  var TYPE_ORDER = { ride: 0, show: 1, food: 2, snack: 3, shop: 4 };
  var TYPE_JA = { ride: '乗り物', show: 'ショー・パレード', food: 'レストラン', snack: '食べ歩き', shop: 'グッズ' };
  function md(d) { var a = d.split('-'); return Number(a[1]) + '/' + Number(a[2]); }
  function sheetInfo(it, full) {
    var t = todayLA(), out = [];
    if (isClosed(it)) return '休止中';
    if (offOn(it, t)) return md(it.off[1]) + 'まで休止';
    if (it.dow && it.dow.indexOf(dowOf(t)) < 0) return '今日はお休み（' + dowLabel(it) + '）';
    if (it.from && t < it.from) out.push(md(it.from) + 'から');
    if (it.until && t > it.until) return '終了';
    if (it.type === 'ride') {
      var st = statusOf(it);
      if (st) out.push(st.ja);
      else if (!out.length) { var w = waitOf(it, true); if (w.live) out.push('いま ' + w.min + '分待ち'); else if (it.wait) out.push('ふだん ' + it.wait + '分ほど'); }
      if (it.height) { var h = heightInfo(it); out.push(h.ja); }
      if (it.move && !(full && !it.move.loop)) out.push(moveShort(it));
    } else if (it.type === 'show') {
      if (!out.length) {
        var e = liveFresh() ? liveFor(it) : null, tt = [];
        if (e) e.shows.forEach(function (x) { var p = la(new Date(x)); if (p.date === t && p.min >= la(new Date()).min) tt.push(p.min); });
        out.push(tt.length ? '今日このあと ' + tt.sort(function (a, b) { return a - b; }).map(fmt).join('・') : e ? '今日はこのあとなし' : '時間は当日に表示');
      }
    } else {
      if (it.genre) out.push(it.genre + '｜' + it.menu);
      if (it.storeJa && it.storeJa !== it.ja) out.push(it.storeJa);
      if (it.price) out.push(it.price);
      if (it.reserve) out.push(it.reserve);
    }
    return out.join('・');
  }
  function mapSheet(park, sel, plan) {
    var L = D.parks[park].lands[sel.land]; if (!L) return '';
    var nums = {}; if (plan && plan.day.park === park) plan.rows.forEach(function (r) { if (r.it) nums[r.it.key] = r.n; });
    var list = ITEMS.filter(function (it) {
      return it.park === park && (it.land === sel.land || it.key === sel.key || (it.move && it.move.stops && it.move.stops.some(function (x) { return x.land === sel.land; })));
    });
    list.sort(function (a, b) {
      return (b.key === sel.key) - (a.key === sel.key) || (TYPE_ORDER[a.type] - TYPE_ORDER[b.type]) || (!!S.fav[b.key] - !!S.fav[a.key]) || (!!S.checks[b.key] - !!S.checks[a.key]);
    });
    var nFav = list.filter(function (it) { return S.fav[it.key]; }).length, nOn = list.filter(function (it) { return S.checks[it.key]; }).length;
    var h = '<section class="mapsheet" aria-label="' + esc(L.ja) + 'にあるもの"><div class="mapsheet-head">' + dot(park, sel.land).replace('class="dot"', 'class="dot big"') +
      '<div class="grptitle"><span class="ja">' + esc(L.ja) + '</span><span class="en" lang="en">' + esc(L.en) + '</span></div>' +
      (nFav ? '<span class="grpfav">' + STAR + nFav + '</span>' : '') + (nOn ? '<span class="grpon">チェック ' + nOn + '</span>' : '') +
      '<button class="btn small" data-act="mapSelClose" aria-label="閉じる">閉じる</button></div><div class="mapsheet-list">';
    var lastType = null, selShown = false;
    list.forEach(function (it) {
      var isSel = it.key === sel.key;
      if (!isSel && it.type !== lastType) { h += '<div class="mgrp">' + TYPE_JA[it.type] + '</div>'; lastType = it.type; }
      var on = !!S.checks[it.key], fv = !!S.fav[it.key];
      h += '<div class="mrow' + (isSel ? ' sel' : '') + '">' + icon(it, 36) + '<div class="mbody"><div class="mname">' +
        (nums[it.key] ? '<span class="num">' + nums[it.key] + '</span>' : '') + (pageOf(it) ? '<a class="namelink" href="' + esc(pageOf(it)) + '" target="_blank" rel="noopener"><span class="ja">' + esc(it.ja) + EXT + '</span></a>' : '<span class="ja">' + esc(it.ja) + '</span>') + '</div>' +
        '<span class="en" lang="en">' + esc(it.en) + '</span>' + (sheetInfo(it, isSel) ? '<span class="note">' + esc(sheetInfo(it, isSel)) + '</span>' : '') + (isSel && it.move && !it.move.loop ? moveHTML(it, sel.land) : '') + '</div>' +
        '<button class="mcheck" data-act="mapCheck" data-k="' + esc(it.key) + '" aria-pressed="' + on + '">' + (on ? '✓ やりたい' : '＋ やりたい') + '</button>' +
        '<button class="favbtn" data-act="fav" data-k="' + esc(it.key) + '" aria-pressed="' + fv + '" aria-label="' + esc(it.ja) + 'をお気に入りにする">' + STAR + '</button></div>';
    });
    if (!list.length) h += '<p class="empty">このエリアの登録はまだありません</p>';
    return h + '</div></section>';
  }

  /* ---------- 描画 ---------- */
  var TABS = [['today', '今日'], ['wish', 'やりたい'], ['plan', 'プラン'], ['prep', '準備']];
  var lastSel = null;
  function render() {
    var plans = planAll();
    var v = S.tab === 'wish' ? viewWish() : S.tab === 'plan' ? viewPlan(plans) : S.tab === 'prep' ? viewPrep() : viewToday(plans);
    document.getElementById('top').innerHTML = v.top;
    document.getElementById('main').innerHTML = v.main;
    var ov = document.getElementById('overlay');
    if (ov) {
      var mb = ov.querySelector('.mapfull-body'), ml = ov.querySelector('.mapsheet-list');
      var keep = { t: mb ? mb.scrollTop : 0, l: mb ? mb.scrollLeft : 0, s: ml ? ml.scrollTop : 0 }, selNow = JSON.stringify(S.view.mapSel || null);
      ov.innerHTML = mapOverlay(plans); document.body.style.overflow = S.view.mapFull ? 'hidden' : '';
      mb = ov.querySelector('.mapfull-body'); ml = ov.querySelector('.mapsheet-list');
      if (mb) { mb.scrollTop = keep.t; mb.scrollLeft = keep.l; }
      if (ml && selNow === lastSel) ml.scrollTop = keep.s;
      lastSel = selNow;
    }
    document.getElementById('tabs').innerHTML = TABS.map(function (t) { return '<button data-act="tab" data-v="' + t[0] + '"' + (S.tab === t[0] ? ' aria-current="page"' : '') + '>' + ICON[t[0]] + '<span>' + t[1] + '</span></button>'; }).join('');
  }

  /* ---------- 操作 ---------- */
  function act(el, ev) {
    var a = el.getAttribute('data-act'), v = el.getAttribute('data-v'), k = el.getAttribute('data-k');
    var keepScroll = true;
    switch (a) {
      case 'tab': S.tab = v; keepScroll = false; break;
      case 'tpark': S.view.park = v; break;
      case 'wpark': S.view.wpark = v; break;
      case 'mpark': S.view.mapPark = v; break;
      case 'mapOpen': S.view.mapFull = { park: v, ctx: k }; S.view.mapZoom = 1; S.view.mapSel = null; break;
      case 'mapClose': S.view.mapFull = null; S.view.mapSel = null; break;
      case 'mapLand': S.view.mapSel = { park: S.view.mapFull && S.view.mapFull.park, land: v, key: null }; break;
      case 'mapItem': S.view.mapSel = { park: S.view.mapFull && S.view.mapFull.park, land: v, key: k || null }; break;
      case 'mapSelClose': S.view.mapSel = null; break;
      case 'mapCheck':
        if (S.checks[k]) { delete S.checks[k]; delete S.by[k]; delete S.resv[k]; delete S.showPick[k]; delete S.pin[k]; } else { S.checks[k] = true; S.by[k] = S.me || ''; }
        break;
      case 'mapZoom': S.view.mapZoom = (S.view.mapZoom || 1) > 1 ? 1 : 2; break;
      case 'filter': S.view.filter = v; break;
      case 'kidOnly': S.view.kidOnly = el.checked; break;
      case 'holOnly': S.view.hol = el.checked; break;
      case 'filtToggle': S.view.filtOpen = !S.view.filtOpen; break;
      case 'grp': S.view.open = S.view.open || {}; S.view.open[v] = !S.view.open[v]; break;
      case 'grpAll': {
        S.view.open = S.view.open || {};
        var on = v === '1';
        document.querySelectorAll('.grphead').forEach(function (b) { S.view.open[b.getAttribute('data-v')] = on; });
        break;
      }
      case 'day': S.dayIdx = Number(v); break;
      case 'fav':
        if (S.fav[k]) delete S.fav[k]; else { S.fav[k] = true; if (!S.checks[k]) { S.checks[k] = true; S.by[k] = S.me || ''; } }
        break;
      case 'check':
        if (el.checked) { S.checks[k] = true; S.by[k] = S.me || ''; } else { delete S.checks[k]; delete S.by[k]; delete S.resv[k]; delete S.showPick[k]; delete S.pin[k]; }
        break;
      case 'done': S.done[k] = true; delete S.later[k]; break;
      case 'toggleDone': if (S.done[k]) delete S.done[k]; else S.done[k] = true; break;
      case 'later': S.later[k] = true; break;
      case 'resvDay': S.resv[k] = Object.assign({}, S.resv[k], { day: v === '' || el.value === '' ? null : Number(el.value) }); break;
      case 'resvTime': S.resv[k] = Object.assign({ day: firstDay(BYKEY[k].park) }, S.resv[k], { time: el.value }); break;
      case 'showPick': if (el.value) S.showPick[k] = el.value; else delete S.showPick[k]; break;
      case 'applySug': S.showPick[k] = v; break;
      case 'addExtra': {
        var name = document.getElementById('exName').value.trim() || '自分の予定';
        S.extra.push({ day: Math.min(S.dayIdx, S.days.length - 1), name: name, time: document.getElementById('exTime').value || '12:00', dur: Number(document.getElementById('exDur').value) || 30, land: document.getElementById('exLand').value });
        break;
      }
      case 'delExtra': S.extra.splice(Number(v), 1); break;
      case 'dayDate': S.days[Number(v)].date = el.value; break;
      case 'dayPark': S.days[Number(v)].park = el.value; break;
      case 'addDay': { var last = S.days[S.days.length - 1]; var nd = last && last.date ? new Date(Date.parse(last.date + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10) : todayLA(); S.days.push({ date: nd, park: last && last.park === 'dl' ? 'dca' : 'dl' }); break; }
      case 'delDay': {
        var di = Number(v); S.days.splice(di, 1);
        Object.keys(S.pin).forEach(function (x) { if (S.pin[x] === di) delete S.pin[x]; else if (S.pin[x] > di) S.pin[x]--; });
        Object.keys(S.resv).forEach(function (x) { var r = S.resv[x]; if (r.day === di) r.day = null; else if (r.day > di) r.day--; });
        S.extra = S.extra.filter(function (x) { return x.day !== di; }).map(function (x) { if (x.day > di) x.day--; return x; });
        S.dayIdx = 0; break;
      }
      case 'kidName': S.kids[Number(v)].name = el.value; break;
      case 'kidCm': S.kids[Number(v)].cm = Number(el.value) || 0; break;
      case 'addKid': S.kids.push({ name: '子ども' + (S.kids.length + 1), cm: 90 }); break;
      case 'delKid': S.kids.splice(Number(v), 1); break;
      case 'me': S.me = el.value.trim(); break;
      case 'clearSample': S.checks = {}; S.by = {}; S.resv = {}; S.showPick = {}; S.pin = {}; S.later = {}; S.done = {}; S.sample = false; break;
      case 'exportCode': exportCode(); return;
      case 'roomCreate': roomCreate(); return;
      case 'roomJoin': roomJoin(); return;
      case 'roomSyncNow': roomSync(true); return;
      case 'roomCopy': roomCopy(); return;
      case 'roomLeave': roomLeave(); return;
      case 'roomRotate': roomRotate(); return;
      case 'importCode': importCode(); break;
      default: return;
    }
    save(); var y = window.scrollY; render(); if (keepScroll) window.scrollTo(0, y); else window.scrollTo(0, 0);
  }
  function firstDay(park) { for (var i = 0; i < S.days.length; i++) if (S.days[i].park === park) return i; return null; }
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    if (el.tagName === 'BUTTON') act(el, e);
    else if (el.type === 'checkbox') act(el, e);
    else if (el.ownerSVGElement && el.closest('.map.tap')) act(el, e);
  });
  document.addEventListener('input', function (e) {
    if (e.target.id !== 'wishQ') return;
    S.view.q = e.target.value; save(); render();
    var q = document.getElementById('wishQ'); if (q) { q.focus(); var n = q.value.length; try { q.setSelectionRange(n, n); } catch (x) { } }
  });
  document.addEventListener('change', function (e) {
    var el = e.target.closest('[data-act]'); if (!el || el.tagName === 'BUTTON' || el.type === 'checkbox') return;
    act(el, e);
  });

  /* ---------- 共有コード ---------- */
  function b64(str) { var b = new TextEncoder().encode(str), s = ''; b.forEach(function (x) { s += String.fromCharCode(x); }); return btoa(s); }
  function unb64(s) { var bin = atob(s.trim()), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); }
  function msg(t) { var m = document.getElementById('shareMsg'); if (m) m.textContent = t; }
  function exportCode() {
    var code = 'PN1:' + b64(JSON.stringify({ checks: S.checks, fav: S.fav, by: S.by, resv: S.resv, showPick: S.showPick, done: S.done, extra: S.extra, days: S.days, kids: S.kids }));
    var ta = document.getElementById('importCode');
    function fallback() { if (ta) { ta.value = code; ta.focus(); ta.select(); } msg('コピーできなかったので、上の欄に表示しました。長押しでコピーしてください。'); }
    try { navigator.clipboard.writeText(code).then(function () { msg('共有コードをコピーしました。相手に送ってください。'); }, fallback); } catch (e) { fallback(); }
  }
  function importCode() {
    var ta = document.getElementById('importCode'); var raw = (ta && ta.value || '').trim();
    try {
      if (raw.indexOf('PN1:') !== 0) throw 0;
      var o = JSON.parse(unb64(raw.slice(4)));
      Object.keys(o.checks || {}).forEach(function (k) { if (!BYKEY[k]) return; S.checks[k] = true; if (!S.by[k] && o.by) S.by[k] = o.by[k]; });
      ['resv', 'showPick', 'done', 'fav'].forEach(function (f) { Object.keys(o[f] || {}).forEach(function (k) { if (S[f][k] == null) S[f][k] = o[f][k]; }); });
      (o.extra || []).forEach(function (x) { if (!S.extra.some(function (y) { return y.name === x.name && y.time === x.time && y.day === x.day; })) S.extra.push(x); });
      if (S.sample) { S.sample = false; }
      setTimeout(function () { msg('読み込みました。チェックを合わせました。'); }, 0);
    } catch (e) { setTimeout(function () { msg('共有コードが読み取れませんでした。「PN1:」から始まる文字を全部貼り付けてください。'); }, 0); }
  }


  /* ---------- 家族の部屋（合言葉で入る自動同期） ----------
     - 合言葉は端末の中だけ。受付係（/room）には合言葉から作った指紋（SHA-256）だけを送る
     - 同期するのは旅行のチェック内容だけ。表示（タブや絞り込み）は端末ごと
     - 2台が同時に変えても、前回そろえた内容（base）との差分を重ねて、両方の変更を残す */
  var ROOM_KEY = 'parknavi.room.v1';
  var SHARED_MAP = ['checks', 'by', 'fav', 'resv', 'showPick', 'pin', 'later', 'done'], SHARED_WHOLE = ['extra', 'days', 'kids'];
  var ROOM = (function () { try { return JSON.parse(localStorage.getItem(ROOM_KEY) || 'null'); } catch (e) { return null; } })();
  var RS = { busy: false, err: '', note: '' };
  function roomUsable() { return !!(window.crypto && crypto.subtle && window.fetch) && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1'); }
  function roomSave() { try { if (ROOM) localStorage.setItem(ROOM_KEY, JSON.stringify(ROOM)); else localStorage.removeItem(ROOM_KEY); } catch (e) { } }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  function sharedOf() { var o = {}; SHARED_MAP.concat(SHARED_WHOLE).forEach(function (f) { o[f] = S[f]; }); return clone(o); }
  function applyShared(d) {
    SHARED_MAP.forEach(function (f) { S[f] = d[f] && typeof d[f] === 'object' && !Array.isArray(d[f]) ? clone(d[f]) : {}; });
    SHARED_WHOLE.forEach(function (f) { if (Array.isArray(d[f]) && (f === 'extra' || d[f].length)) S[f] = clone(d[f]); });
  }
  function merge3(base, local, remote) {
    var out = {};
    SHARED_MAP.forEach(function (f) {
      var r = Object.assign({}, remote[f] || {}), b = base[f] || {}, l = local[f] || {};
      Object.keys(Object.assign({}, b, l)).forEach(function (k) { if (!same(l[k], b[k])) { if (l[k] === undefined) delete r[k]; else r[k] = l[k]; } });
      out[f] = r;
    });
    SHARED_WHOLE.forEach(function (f) { out[f] = !same(local[f], base[f]) ? local[f] : remote[f]; });
    return out;
  }
  var CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; /* 見まちがえやすい I・O・0・1 は使わない */
  function newCode() { var a = new Uint8Array(20), s = ''; crypto.getRandomValues(a); for (var i = 0; i < 20; i++) { s += CODE_CHARS[a[i] % 32]; if (i % 5 === 4 && i < 19) s += '-'; } return s; }
  function normCode(c) { return String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function fmtCode(c) { return normCode(c).replace(/(.{5})(?=.)/g, '$1-'); }
  function roomId(code) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode('parknavi-room:' + normCode(code))).then(function (h) {
      return Array.prototype.map.call(new Uint8Array(h), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }
  function roomCall(body) {
    return fetch(SB + '/room', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'http' }; }); }, function () { return { ok: false, error: 'offline' }; });
  }
  function roomErr(r) { return r.error === 'offline' ? '電波がないので、つながったら同期します' : r.error === 'not_found' ? '部屋が見つかりません（合言葉が作り直されたかも）' : '同期できませんでした。しばらくしてもう一度'; }
  function editing() { var a = document.activeElement; return a && /INPUT|TEXTAREA|SELECT/.test(a.tagName); }
  function rerender() { if (editing()) return; var y = window.scrollY; render(); window.scrollTo(0, y); }
  var syncAgain = false;
  function roomSync(byHand) {
    if (!ROOM || !ROOM.id || !roomUsable()) return Promise.resolve();
    if (RS.busy) { syncAgain = true; return Promise.resolve(); }
    RS.busy = true; RS.err = ''; RS.errCode = ''; if (byHand) rerender();
    var tries = 0, changed = false;
    function step() {
      return roomCall({ op: 'get', id: ROOM.id }).then(function (g) {
        if (!g.ok) throw g;
        var local = sharedOf(), merged = merge3(ROOM.base || g.data, local, g.data);
        if (!same(merged, local)) { applyShared(merged); saveLocal(); changed = true; }
        if (same(merged, g.data)) { ROOM.ver = g.ver; ROOM.base = merged; ROOM.at = Date.now(); return; }
        return roomCall({ op: 'put', id: ROOM.id, base: g.ver, data: merged }).then(function (p) {
          if (p.ok) { ROOM.ver = p.ver; ROOM.base = merged; ROOM.at = Date.now(); return; }
          if (p.error === 'conflict' && ++tries < 4) return step();
          throw p;
        });
      });
    }
    return step().catch(function (e) { RS.err = roomErr(e || {}); RS.errCode = (e && e.error) || ''; }).then(function () {
      RS.busy = false; roomSave();
      if (changed || byHand || S.tab === 'prep') rerender();
      if (syncAgain) { syncAgain = false; roomKick(); }
    });
  }
  var kickTimer = null;
  function roomKick() {
    if (!ROOM || !ROOM.base) return;
    if (same(sharedOf(), ROOM.base)) return;
    clearTimeout(kickTimer); kickTimer = setTimeout(function () { roomSync(); }, 1500);
  }
  window.__roomKick = roomKick;
  function roomMsg(t) { RS.note = t; rerender(); }
  function roomCreate() {
    if (!roomUsable()) return roomMsg('この画面では使えません。公開版のアプリ（github.io）で開いてください');
    var code = newCode(), data = sharedOf();
    RS.busy = true; rerender();
    roomId(code).then(function (id) {
      return roomCall({ op: 'create', id: id, data: data }).then(function (r) {
        RS.busy = false;
        if (!r.ok) return roomMsg(roomErr(r));
        ROOM = { code: code, id: id, ver: r.ver, base: data, at: Date.now() }; roomSave();
        roomMsg('部屋を作りました。「合言葉をコピー」で相手に送ってください');
      });
    });
  }
  function roomJoin() {
    if (!roomUsable()) return roomMsg('この画面では使えません。公開版のアプリ（github.io）で開いてください');
    var inp = document.getElementById('roomCode'), code = normCode(inp && inp.value);
    if (code.length !== 20) return roomMsg('合言葉は20文字です（ハイフンはあってもなくてもOK）');
    RS.busy = true; rerender();
    roomId(code).then(function (id) {
      return roomCall({ op: 'get', id: id }).then(function (g) {
        RS.busy = false;
        if (!g.ok) return roomMsg(g.error === 'not_found' ? '部屋が見つかりません。合言葉を確かめてください' : roomErr(g));
        if (!window.confirm('この端末のチェック・予定は、部屋の内容に置きかわります。入りますか？')) return roomMsg('');
        applyShared(g.data); S.sample = false; saveLocal();
        ROOM = { code: fmtCode(code), id: id, ver: g.ver, base: clone(g.data), at: Date.now() }; roomSave();
        roomMsg('部屋に入りました。これから自動で同じ内容になります');
      });
    });
  }
  function roomLeave() {
    if (!window.confirm('この端末を部屋から外します（この端末のチェックはそのまま残ります）。よろしいですか？')) return;
    ROOM = null; roomSave(); roomMsg('部屋から出ました');
  }
  function roomRotate() {
    if (!ROOM || !window.confirm('新しい合言葉を作ります。古い合言葉は使えなくなるので、相手にも新しい合言葉を送り直してください。作り直しますか？')) return;
    var old = ROOM.id, code = newCode(), data = sharedOf();
    RS.busy = true; rerender();
    roomId(code).then(function (id) {
      return roomCall({ op: 'create', id: id, data: data }).then(function (r) {
        RS.busy = false;
        if (!r.ok) return roomMsg(roomErr(r));
        ROOM = { code: code, id: id, ver: r.ver, base: data, at: Date.now() }; roomSave();
        roomCall({ op: 'delete', id: old });
        roomMsg('新しい合言葉にしました。相手に送り直してください');
      });
    });
  }
  function roomCopy() {
    if (!ROOM) return;
    var text = 'パーク回遊ナビの家族の部屋の合言葉：' + ROOM.code + '\n（アプリの「準備」→「家族の部屋」→「部屋に入る」に入力）';
    try { navigator.clipboard.writeText(text).then(function () { roomMsg('合言葉をコピーしました。LINEなどで送ってください'); }, function () { roomMsg('コピーできませんでした。合言葉を長押ししてコピーしてください'); }); } catch (e) { roomMsg('コピーできませんでした。合言葉を長押ししてコピーしてください'); }
  }
  function roomCardHTML() {
    var h = '<section class="card" style="display:flex;flex-direction:column;gap:10px"><h2>家族の部屋（自動で同期）</h2>';
    if (!roomUsable()) return h + '<span class="note">この画面（プレビュー）では使えません。公開版のアプリ（github.io）で開くと使えます。</span></section>';
    if (!ROOM) {
      h += '<span class="note">合言葉を知っている人だけが入れる部屋です。チェック・お気に入り・予約・予定・日程・子どもの身長が、入っている端末どうしで自動で同じになります。</span>' +
        '<button class="btn primary" data-act="roomCreate"' + (RS.busy ? ' disabled' : '') + '>部屋を作る（合言葉ができます）</button>' +
        '<label class="field">もらった合言葉で入る<input id="roomCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXX-XXXXX-XXXXX-XXXXX"></label>' +
        '<button class="btn ghost" data-act="roomJoin"' + (RS.busy ? ' disabled' : '') + '>部屋に入る</button>';
    } else {
      var when = ROOM.at ? fmt(la(new Date(ROOM.at)).min) : '';
      var st = RS.busy ? '同期中…' : RS.err ? RS.err : '同期済み（現地 ' + when + '）・30秒ごとに確認';
      if (RS.errCode === 'not_found') h += '<span class="alert">部屋が見つかりません。合言葉が作り直された可能性があります。新しい合言葉をもらって入り直してください。</span>' +
        '<label class="field">新しい合言葉<input id="roomCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXXX-XXXXX-XXXXX-XXXXX"></label>' +
        '<button class="btn primary" data-act="roomJoin">新しい合言葉で入る</button>';
      h += '<span class="note">この端末は部屋に入っています。合言葉を知っている人だけが同じ内容を見られます。</span>' +
        '<div class="roomcode" aria-label="合言葉">' + esc(ROOM.code) + '</div>' +
        '<span class="note" role="status"' + (RS.err ? ' style="color:var(--warn)"' : '') + '>' + esc(st) + '</span>' +
        '<div class="row2"><button class="btn primary" data-act="roomCopy">合言葉をコピー</button><button class="btn" data-act="roomSyncNow"' + (RS.busy ? ' disabled' : '') + '>今すぐ同期</button></div>' +
        '<details class="more"><summary>合言葉の作り直し・部屋から出る</summary><div class="row2" style="margin-top:6px"><button class="btn" data-act="roomRotate">合言葉を作り直す</button><button class="btn" data-act="roomLeave">部屋から出る</button></div>' +
        '<span class="note">合言葉が他の人に知られたら「作り直す」を押して、家族に送り直してください。</span></details>';
    }
    if (RS.note) h += '<span class="note" role="status">' + esc(RS.note) + '</span>';
    return h + '</section>';
  }

  /* ---------- 起動 ---------- */
  /* 開いたときのプラン表示：旅行の日ならその日、それ以外は「今日（いまの状況）」 */
  (function () { var t = todayLA(), k = -1; S.days.forEach(function (d, j) { if (d.date === t) k = j; }); S.dayIdx = k; })();
  render();
  refreshLive();
  if (ROOM) roomSync();
  setInterval(function () { if (ROOM && !document.hidden) roomSync(); }, 30 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && ROOM) roomSync(); });
  setInterval(function () { if (!document.hidden) refreshLive(); }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && (!LIVE.at || Date.now() - LIVE.at > 4 * 60 * 1000)) refreshLive(); });
  try { if ('serviceWorker' in navigator && location.protocol === 'https:' && /github\.io$|localhost/.test(location.hostname)) navigator.serviceWorker.register('sw.js'); } catch (e) { }
  window.__parknavi = { planAll: planAll, S: function () { return S; }, merge3: merge3 };
})();
