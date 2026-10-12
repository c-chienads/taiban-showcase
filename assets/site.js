// 套版樣品間：挑選清單、目錄篩選、單款預覽、清單比較、詢問表單。沒有 JS 時每一頁照樣能看、表單照樣能送。
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const KEY = 'taiban-picks', DRAFT = 'taiban-inquiry-draft', MAX = 8;
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 無痕或封鎖儲存：清單只在這一頁有效 */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* */ } },
  };
  let picks = store.get(KEY, []).filter(x => /^F\d{2}$/.test(x));
  const live = $('#live');
  const say = msg => { if (live) { live.textContent = ''; setTimeout(() => { live.textContent = msg; }, 30); } };

  function syncPicks() {
    $$('[data-count]').forEach(el => { el.textContent = picks.length; el.dataset.n = picks.length; });
    $$('[data-pick]').forEach(b => {
      const on = picks.includes(b.dataset.pick);
      b.hidden = false;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.textContent = on ? '已在清單' : '加入挑選';
    });
    $$('[data-ask]').forEach(a => { const id = a.dataset.ask; a.href = '/inquiry/?t=' + [...new Set([id, ...picks])].join(','); });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    const id = b.dataset.pick, name = b.dataset.name || id;
    if (picks.includes(id)) { picks = picks.filter(x => x !== id); say(`已從挑選清單移除 ${name}，清單剩 ${picks.length} 款`); }
    else if (picks.length >= MAX) { say(`挑選清單最多 ${MAX} 款，先移除一款再加入`); return; }
    else { picks = [...picks, id]; say(`已把 ${name} 加入挑選清單，共 ${picks.length} 款`); }
    store.set(KEY, picks); syncPicks();
    if (document.body.dataset.page === 'list') renderList();
  });

  // ── 目錄篩選 ──
  const grid = $('#grid');
  if (grid) {
    const cards = $$('.card', grid), chips = $$('[data-group]'), q = $('#q'), out = $('#result'), empty = $('#empty');
    let group = 'all';
    const apply = () => {
      const words = (q.value || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      let n = 0;
      cards.forEach(c => {
        const okG = group === 'all' || c.dataset.groups.split(' ').includes(group);
        const okQ = words.every(w => c.dataset.q.includes(w));
        c.hidden = !(okG && okQ); if (!c.hidden) n++;
      });
      out.textContent = `顯示 ${n} 款`;
      empty.hidden = n > 0;
    };
    chips.forEach(ch => ch.addEventListener('click', () => {
      group = ch.dataset.group;
      chips.forEach(x => x.setAttribute('aria-pressed', x === ch ? 'true' : 'false'));
      apply();
      try { history.replaceState(null, '', group === 'all' ? location.pathname : '#' + group); } catch { /* */ }
    }));
    q.addEventListener('input', apply);
    $('#filters').hidden = false;
    const h = location.hash.slice(1), hit = chips.find(c => c.dataset.group === h);
    if (hit) hit.click(); else apply();
  }

  // ── 單款預覽：裝置切換＋等比縮放 ──
  const stage = $('#stage');
  if (stage) {
    const frame = $('.stage__frame', stage), iframe = $('iframe', stage), btns = $$('.seg [data-device]');
    const DEV = { desktop: [1440, 900], tablet: [820, 1100], phone: [390, 844] };
    let dev = window.innerWidth < 700 ? 'phone' : 'desktop';
    const fit = () => {
      const [w, h] = DEV[dev];
      const pad = dev === 'desktop' ? 0 : (dev === 'phone' ? 20 : 24);
      const avail = stage.clientWidth - 36;
      const s = Math.min(1, avail / (w + pad));
      frame.style.width = (w + pad) + 'px'; frame.style.height = (h + pad) + 'px';
      frame.style.transform = `scale(${s})`;
      stage.style.height = Math.round((h + pad) * s + 36) + 'px';
      stage.dataset.view = dev;
      const note = $('#scale'); if (note) note.textContent = s < 0.999 ? `以 ${Math.round(s * 100)}% 顯示（實際寬度 ${w}px）` : `實際寬度 ${w}px`;
    };
    btns.forEach(b => b.addEventListener('click', () => { dev = b.dataset.device; btns.forEach(x => x.setAttribute('aria-pressed', x === b ? 'true' : 'false')); fit(); }));
    btns.forEach(x => x.setAttribute('aria-pressed', x.dataset.device === dev ? 'true' : 'false'));
    $('#stagebar').hidden = false;
    iframe.classList.remove('nojs-frame');
    new ResizeObserver(fit).observe(stage);
    fit();
  }

  // ── 挑選清單頁 ──
  let catalog = null;
  const loadCatalog = async () => catalog || (catalog = await fetch('/assets/catalog.json').then(r => r.json()));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  async function renderList() {
    const box = $('#listbox'); if (!box) return;
    const cat = await loadCatalog();
    const items = picks.map(id => cat.find(t => t.id === id)).filter(Boolean);
    $('#listEmpty').hidden = items.length > 0;
    $('#listbar').hidden = items.length === 0;
    $('#askAll').href = '/inquiry/?t=' + items.map(t => t.id).join(',');
    $('#askAll').textContent = `用這 ${items.length} 款送出詢問`;
    if (!items.length) { box.innerHTML = ''; return; }
    const row = (label, f) => `<tr><th scope="row">${label}</th>${items.map(t => `<td>${f(t)}</td>`).join('')}</tr>`;
    box.innerHTML = `<div class="cmp-wrap"><table class="cmp"><caption class="vh">挑選清單比較</caption><thead><tr><td></td>${items.map(t => `<th scope="col"><a href="/t/${t.slug}/"><img src="/img/${t.slug}-d-480.jpg" width="480" height="300" alt="${esc(t.name)} 電腦版首頁"></a><a class="name" href="/t/${t.slug}/">${esc(t.name)}</a><button type="button" class="btn btn--quiet rm" data-pick="${t.id}" data-name="${esc(t.name)}">移除</button></th>`).join('')}</tr></thead><tbody>
      ${row('編號', t => `<span class="mono">${t.id}</span>`)}
      ${row('適合', t => esc(t.useCase.join('、')))}
      ${row('招牌互動', t => esc(t.pitch))}
      ${row('字型', t => esc(t.fonts.join('、')))}
      ${row('初次載入', t => `<span class="mono">${t.kb} KB</span>`)}
      ${row('配色', t => `<span class="pal">${t.palette.map(c => `<span style="background:${c}"></span>`).join('')}</span>`)}
    </tbody></table></div>`;
    syncPicks();
  }
  if (document.body.dataset.page === 'list') renderList();

  // ── 詢問表單 ──
  const form = $('#inquiry');
  if (form) {
    const params = new URLSearchParams(location.search);
    const fromUrl = (params.get('t') || '').toUpperCase().split(',').filter(x => /^F\d{2}$/.test(x));
    const draft = store.get(DRAFT, null);
    const want = new Set(fromUrl.length ? fromUrl : (draft?.templates?.length ? draft.templates : picks));
    $$('input[name="templates"]', form).forEach(c => { c.checked = want.has(c.value); });
    if (draft) for (const [k, v] of Object.entries(draft)) {
      if (k === 'templates') continue;
      const el = form.elements[k]; if (!el) continue;
      if (el instanceof RadioNodeList) { $$(`input[name="${k}"]`, form).forEach(r => { r.checked = r.value === v; }); }
      else if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
    }
    const picked = () => $$('input[name="templates"]:checked', form).map(c => c.value);
    const showPicked = () => { const n = picked().length; $('#tplCount').textContent = n ? `已選 ${n} 款` : '還沒選，可以先空著'; };
    showPicked();
    form.elements.t.value = String(Date.now());
    const collect = () => {
      const fd = new FormData(form), o = {};
      for (const [k, v] of fd.entries()) if (k !== 'templates') o[k] = v;
      o.templates = picked(); o.consent = form.elements.consent.checked;
      return o;
    };
    let saveT;
    form.addEventListener('input', () => { showPicked(); clearTimeout(saveT); saveT = setTimeout(() => { const o = collect(); delete o.t; delete o.website; store.set(DRAFT, o); }, 300); });
    const status = $('#status');
    const errs = e => {
      $$('.err', form).forEach(x => { x.textContent = ''; });
      $$('[aria-invalid]', form).forEach(x => x.removeAttribute('aria-invalid'));
      let first = null;
      for (const [k, msg] of Object.entries(e || {})) {
        const box = $(`#err-${k}`); if (box) box.textContent = msg;
        const el = form.elements[k]; if (el && el.setAttribute) { el.setAttribute('aria-invalid', 'true'); first ||= el; }
      }
      if (first) first.focus();
    };
    const qErr = params.get('error');
    if (qErr === 'store') status.textContent = '剛才系統沒存進去，請再送一次。';
    else if (qErr) status.textContent = '有幾個欄位要再確認，請看紅字提示。';
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const data = collect();
      const local = {};
      if (!data.name.trim()) local.name = '請留一個稱呼，我們回覆時才知道怎麼稱呼你。';
      if (!data.email.trim() && !data.contact.trim()) local.email = 'Email 和電話／LINE 至少留一個，不然我們聯絡不到你。';
      if (!data.consent) local.consent = '需要勾選同意，我們才能用這些資料聯絡你。';
      if (Object.keys(local).length) { errs(local); return; }
      const btn = $('#send'); btn.disabled = true; btn.textContent = '送出中…'; status.textContent = '';
      try {
        const r = await fetch('/api/inquiry', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
        const j = await r.json().catch(() => ({}));
        if (r.ok && j.ok) { store.del(DRAFT); location.href = '/inquiry/thanks/?no=' + encodeURIComponent(j.ref); return; }
        if (j.errors) errs(j.errors); else status.textContent = j.error || '送出沒有成功，請稍後再試一次；你填的內容還在。';
      } catch { status.textContent = '網路好像斷了，送出沒有成功；你填的內容還在，連上後再按一次送出。'; }
      btn.disabled = false; btn.textContent = '送出詢問';
    });
  }
  const no = $('#refno');
  if (no) { const v = new URLSearchParams(location.search).get('no') || ''; if (/^Q-\d{8}-[A-Z0-9]{5}$/.test(v)) { no.textContent = v; no.hidden = false; } }

  // ── 後台 ──
  const adm = $('#adminForm');
  if (adm) {
    const out = $('#adminOut'), msg = $('#adminMsg');
    let key = '';
    try { key = sessionStorage.getItem('taiban-admin') || ''; } catch { /* */ }
    const names = {};
    const load = async () => {
      msg.textContent = '讀取中…';
      const r = await fetch('/api/inquiries', { headers: { 'x-admin-key': key } });
      if (r.status === 401) { msg.textContent = '管理金鑰不對。'; return; }
      if (!r.ok) { msg.textContent = '讀取失敗（' + r.status + '）。'; return; }
      const j = await r.json();
      try { sessionStorage.setItem('taiban-admin', key); } catch { /* */ }
      const cat = await loadCatalog(); cat.forEach(t => { names[t.id] = t.name; });
      msg.textContent = `共 ${j.total} 筆，顯示最新 ${j.shown} 筆。`;
      $('#csv').hidden = j.shown === 0;
      out.innerHTML = j.records.length ? `<div class="cmp-wrap"><table><thead><tr><th>時間（台北）</th><th>編號</th><th>身分</th><th>稱呼／公司</th><th>聯絡</th><th>想用的套版</th><th>用途／時程／預算</th><th>想說的事</th></tr></thead><tbody>${j.records.map(x => `<tr><td class="mono">${esc(new Date(new Date(x.at).getTime() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' '))}</td><td class="mono">${esc(x.ref)}</td><td>${esc(x.role)}</td><td>${esc(x.name)}<br>${esc(x.company)}</td><td>${esc(x.email)}<br>${esc(x.contact)}</td><td>${x.templates.map(id => esc(id + ' ' + (names[id] || ''))).join('<br>')}</td><td>${esc(x.purpose)}<br>${esc(x.timeline)}<br>${esc(x.budget)}</td><td class="msg">${esc(x.message)}</td></tr>`).join('')}</tbody></table></div>` : '<p>目前還沒有詢問。</p>';
    };
    adm.addEventListener('submit', e => { e.preventDefault(); key = adm.elements.key.value.trim(); load(); });
    $('#csv').addEventListener('click', async () => {
      const r = await fetch('/api/inquiries?format=csv', { headers: { 'x-admin-key': key } });
      if (!r.ok) { msg.textContent = '匯出失敗（' + r.status + '）。'; return; }
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a'); a.href = url; a.download = `詢問單-${new Date().toISOString().slice(0, 10)}.csv`; document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
    if (key) { adm.elements.key.value = key; load(); }
  }

  syncPicks();
})();
