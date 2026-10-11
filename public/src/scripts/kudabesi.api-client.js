/**
 * KudaBesi — kudabesi.api-client.js
 * Menangani: komunikasi ke backend (/api/analyze) dan render data hasil ke DOM.
 * Tidak berisi logika interaksi form/modal (lihat kudabesi.ui-events.js).
 * Semua teks dari AI dirender via textContent (aman dari XSS).
 */
(function () {
  'use strict';

  const SVG_NS = 'http://www.w3.org/2000/svg';
  const rupiahFmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

  let lastReport = null;
  let marketItems = [];

  /* ---------- util ---------- */
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const rupiah = (v) => rupiahFmt.format(num(v)).replace(/\s/g, ' ');
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

  function h(tag, cls, content) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content !== undefined && content !== null) {
      if (Array.isArray(content)) content.forEach((c) => c && node.append(c));
      else node.append(content);
    }
    return node;
  }

  function levelOf(report) {
    const allowed = ['good', 'caution', 'warning', 'danger'];
    const given = report?.verdict?.level;
    if (allowed.includes(given)) return given;
    const s = num(report?.health_score);
    if (s >= 75) return 'good';
    if (s >= 55) return 'caution';
    if (s >= 35) return 'warning';
    return 'danger';
  }

  const STNK_LABEL = {
    valid: 'Valid',
    bodong: 'Tanpa surat (bodong)',
    mismatch: 'Tidak cocok dengan fisik',
    unreadable: 'Tidak terbaca',
    not_applicable: 'Tidak berlaku',
  };

  /* ---------- network ---------- */
  async function analyze(input) {
    const fd = new FormData();
    fd.append('category', input.category);
    fd.append('notes', input.notes || '');
    fd.append('offered_price', String(input.price || 0));

    if (Array.isArray(input.photos)) {
      input.photos.forEach((f) => {
        if (f && f.name) fd.append('photos', f, f.name);
      });
    }

    if (input.audio && input.audio.name) {
      fd.append('audio', input.audio, input.audio.name);
    }

    if (input.category === 'unit') {
      fd.append('stnk_status', input.stnkStatus || 'none');
      fd.append('year', input.year || '');
      if (input.stnkStatus === 'available' && input.stnkFile && input.stnkFile.name) {
        fd.append('stnk', input.stnkFile, input.stnkFile.name);
      }
      if (input.serviceFile && input.serviceFile.name) {
        fd.append('service_book', input.serviceFile, input.serviceFile.name);
      }
    }

    if (Array.isArray(input.extraDocs)) {
      input.extraDocs.forEach((f) => {
        if (f && f.name) fd.append('extra_docs', f, f.name);
      });
    }

    let res;
    try {
      res = await fetch('/api/analyze', { method: 'POST', body: fd });
    } catch {
      throw new Error('Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.');
    }

    let json = null;
    try { json = await res.json(); } catch { /* respons bukan JSON */ }
    if (!res.ok || !json?.success) {
      throw new Error(json?.message || `Server error (${res.status}).`);
    }
    lastReport = json.data;
    return json.data;
  }

  /* ---------- komponen ---------- */
  function scoreRing(score, level) {
    const r = 44;
    const c = 2 * Math.PI * r;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('class', `ring lvl-${level}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `Skor kesehatan ${score} dari 100`);

    const track = document.createElementNS(SVG_NS, 'circle');
    track.setAttribute('class', 'ring-track');
    const bar = document.createElementNS(SVG_NS, 'circle');
    bar.setAttribute('class', 'ring-bar');
    [track, bar].forEach((el) => {
      el.setAttribute('cx', '50'); el.setAttribute('cy', '50'); el.setAttribute('r', String(r));
      svg.append(el);
    });
    bar.setAttribute('stroke-dasharray', String(c));
    bar.setAttribute('stroke-dashoffset', String(c));
    requestAnimationFrame(() => requestAnimationFrame(() => bar.setAttribute('stroke-dashoffset', String(c * (1 - score / 100)))));

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', '50'); text.setAttribute('y', '54'); text.setAttribute('class', 'ring-num');
    text.textContent = String(score);
    const sub = document.createElementNS(SVG_NS, 'text');
    sub.setAttribute('x', '50'); sub.setAttribute('y', '68'); sub.setAttribute('class', 'ring-sub');
    sub.textContent = '/ 100';
    svg.append(text, sub);
    return svg;
  }

  const row = (label, value, cls) => h('div', 'kv' + (cls ? ' ' + cls : ''), [h('dt', null, label), h('dd', 'mono', value)]);
  function block(title, text) {
    if (!text) return null;
    // Deteksi pola (a)...; (b)...; atau (a)... (b)... dan render sebagai ordered list
    const bulletPattern = /\(([a-z])\)\s*/gi;
    const hasLetterBullets = (text.match(bulletPattern) || []).length >= 2;
    const div = h('div', 'note', [h('h4', null, title)]);
    if (hasLetterBullets) {
      const parts = text.split(/(?=\([a-z]\))/gi).filter(s => s.trim());
      const ol = document.createElement('ol');
      ol.className = 'note-list';
      ol.type = 'a';
      parts.forEach(part => {
        const clean = part.replace(/^\([a-z]\)\s*/i, '').replace(/;\s*$/, '').trim();
        if (clean) {
          const li = document.createElement('li');
          // Bold label sebelum titik dua
          const colonIdx = clean.indexOf(':');
          if (colonIdx > 0 && colonIdx < 60) {
            const strong = document.createElement('strong');
            strong.textContent = clean.substring(0, colonIdx + 1);
            li.append(strong, ' ' + clean.substring(colonIdx + 1).trim());
          } else {
            li.textContent = clean;
          }
          ol.append(li);
        }
      });
      div.append(ol);
    } else {
      div.append(h('p', null, text));
    }
    return div;
  }
  const card = (title, children, cls) => h('section', 'card' + (cls ? ' ' + cls : ''), [h('h3', 'card-title', title), ...children]);

  function identityCard(r) {
    const level = levelOf(r);
    const score = clamp(Math.round(num(r.health_score)), 0, 100);
    const p = r.product_detected || {};
    const conf = Number.isFinite(Number(p.confidence)) ? Math.round(clamp(Number(p.confidence), 0, 1) * 100) : null;
    const chips = [
      h('span', 'chip', p.category === 'part' ? 'Sparepart' : 'Unit motor'),
      p.year ? h('span', 'chip mono', String(p.year)) : null,
      conf !== null ? h('span', 'chip mono', `Keyakinan ${conf}%`) : null,
    ];
    return h('section', `card card-identity lvl-${level}`, [
      scoreRing(score, level),
      h('div', 'identity-text', [
        h('div', 'chips', chips),
        h('h2', null, p.name || 'Produk tidak teridentifikasi'),
        h('span', `badge lvl-${level}`, r.verdict?.badge || 'Hasil audit'),
        h('p', null, r.verdict?.summary || ''),
      ]),
    ]);
  }

  function stnkCard(r) {
    const s = r.stnk_audit || {};
    const items = [
      row('Status', STNK_LABEL[s.status] || s.status || '-'),
      s.plate ? row('Nopol', s.plate) : null,
      row('Pajak', s.tax_status || '-'),
      s.tax_due_date ? row('Jatuh tempo', s.tax_due_date) : null,
      row('Estimasi denda', rupiah(s.tax_penalty_est)),
    ];
    const lvl = s.status === 'valid' ? 'good' : s.status === 'not_applicable' ? 'caution' : 'danger';
    return card('Legalitas & STNK', [h('dl', 'kv-list', items), block('Catatan', s.notes)], `card-${lvl}`);
  }

  function repairTotal(r) {
    const items = r.visual_sound_inspection?.repair_items;
    const sum = Array.isArray(items) ? items.reduce((n, i) => n + num(i?.est_cost), 0) : 0;
    return sum > 0 ? sum : num(r.price_matrix?.total_repair_cost);
  }

  function inspectionCard(r) {
    const v = r.visual_sound_inspection || {};
    const repairs = Array.isArray(v.repair_items) ? v.repair_items : [];
    let table = null;
    if (repairs.length) {
      const body = repairs.map((i) => h('tr', null, [h('td', null, i?.item || '-'), h('td', 'mono num', rupiah(i?.est_cost))]));
      body.push(h('tr', 'total', [h('td', null, 'Total perkiraan'), h('td', 'mono num', rupiah(repairTotal(r)))]));
      table = h('table', 'table', [h('caption', 'sr-only', 'Perbaikan yang disarankan'), h('tbody', null, body)]);
    }
    return card('Temuan fisik & suara', [
      block('Visual', v.physical_notes),
      block('Suara', v.sound_notes),
      block('Buku servis', v.service_book_notes),
      repairs.length ? h('h4', 'sub-title', 'Perlu diperbaiki / diganti') : null,
      table,
    ]);
  }

  function priceCard(r) {
    const m = r.price_matrix || {};
    const penalty = num(m.tax_penalty_est) || num(r.stnk_audit?.tax_penalty_est);
    const repair = repairTotal(r);
    const recommended = num(m.recommended_offer);
    const upside = num(m.estimated_resale_value) - recommended - repair - penalty;
    const rows = [
      row('Harga penjual', rupiah(m.offered_price)),
      row('Biaya perbaikan', rupiah(repair)),
      penalty ? row('Denda pajak', rupiah(penalty)) : null,
      row('Harga wajar', `${rupiah(m.fair_price_min)} – ${rupiah(m.fair_price_max)}`),
      row('Target tawar', rupiah(recommended), 'kv-accent'),
      row('Estimasi jual lagi', rupiah(m.estimated_resale_value)),
      recommended && m.estimated_resale_value ? row('Selisih potensial', rupiah(upside), upside < 0 ? 'kv-neg' : '') : null,
    ];
    return card('Matriks harga', [
      h('dl', 'kv-list', rows),
      m.bodong_adjustment_note ? h('p', 'callout callout-danger', m.bodong_adjustment_note) : null,
      m.negotiation_talking_point ? h('blockquote', 'talk', [h('h4', null, 'Bahan tawar'), h('p', null, m.negotiation_talking_point)]) : null,
      h('p', 'fineprint', 'Semua nominal adalah estimasi AI dari data pasar dan temuan inspeksi, bukan penilaian resmi.'),
    ]);
  }

  const MARKETPLACE_LOGOS = {
    Tokopedia: 'src/images/logo-tokopedia.jpg',
    Shopee: 'src/images/logo-shopee.webp',
    Blibli: 'src/images/logo-blibli.webp',
    OLX: 'src/images/log_olx.png',
  };

  function marketplaceCard(r) {
    const platforms = marketItems.map((p) => {
      const img = document.createElement('img');
      img.src = MARKETPLACE_LOGOS[p.name] || '';
      img.alt = p.name;
      img.className = 'platform-icon';
      return h('span', 'platform', [img, p.name]);
    });
    return card('Jual lagi', [
      h('div', 'platforms', platforms),
      h('button', 'btn btn-ghost', 'Jual di marketplace'),
    ]);
  }

  /* ---------- marketplace data ---------- */
  function buildMarketItems(r) {
    const mk = r.marketplace_sample || {};
    const p = r.product_detected || {};
    const PLATFORM_ORDER = ['Tokopedia', 'Shopee', 'Blibli', 'OLX'];
    let list = Array.isArray(mk.platforms) && mk.platforms.length
      ? [...mk.platforms]
      : PLATFORM_ORDER.map((name) => ({ name, est_price: r.price_matrix?.estimated_resale_value }));

    // Pastikan urutan selalu: Tokopedia, Shopee, Blibli, OLX
    list.sort((a, b) => {
      const idxA = PLATFORM_ORDER.indexOf(a?.name);
      const idxB = PLATFORM_ORDER.indexOf(b?.name);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    const title = mk.suggested_title || p.name || 'Motor bekas';
    const fallbackDesc = [
      p.name, p.year ? `Tahun ${p.year}` : null,
      r.verdict?.summary,
      r.stnk_audit?.status && r.stnk_audit.status !== 'not_applicable' ? `STNK: ${STNK_LABEL[r.stnk_audit.status] || r.stnk_audit.status}` : null,
    ].filter(Boolean).join('. ');
    return list.map((x) => ({
      name: String(x?.name || 'Marketplace'),
      price: num(x?.est_price),
      title,
      description: mk.description || fallbackDesc,
    }));
  }

  function renderMarketplace(tabsEl, bodyEl) {
    tabsEl.replaceChildren();
    bodyEl.replaceChildren();
    const select = (i) => {
      [...tabsEl.children].forEach((t, k) => t.setAttribute('aria-selected', String(k === i)));
      const it = marketItems[i];
      bodyEl.dataset.index = String(i);
      bodyEl.replaceChildren(
        h('div', 'kv-list', [row('Estimasi harga', rupiah(it.price), 'kv-accent')]),
        h('h4', 'sub-title', 'Judul iklan'), h('p', 'copy-box', it.title),
        h('h4', 'sub-title', 'Deskripsi'), h('p', 'copy-box pre', it.description),
      );
    };
    marketItems.forEach((it, i) => {
      const t = h('button', 'tab', it.name);
      t.type = 'button';
      t.setAttribute('role', 'tab');
      t.addEventListener('click', () => select(i));
      tabsEl.append(t);
    });
    if (marketItems.length) select(0);
  }

  function marketplaceCopyText() {
    const body = document.getElementById('market-body');
    const it = marketItems[Number(body?.dataset.index || 0)];
    return it ? `${it.title}\nHarga: ${rupiah(it.price)}\n\n${it.description}` : '';
  }

  /* ---------- laporan ---------- */
  function renderReport(r, container) {
    marketItems = buildMarketItems(r);
    const isUnit = r.product_detected?.category !== 'part';
    const actions = h('div', 'report-actions', [
      Object.assign(h('button', 'btn btn-ghost', 'Cetak laporan'), { type: 'button' }),
      Object.assign(h('button', 'btn btn-primary', 'Inspeksi baru'), { type: 'button' }),
    ]);
    actions.children[0].dataset.action = 'open-print';
    actions.children[1].dataset.action = 'new-inspection';

    const mk = marketplaceCard(r);
    mk.querySelector('button').type = 'button';
    mk.querySelector('button').dataset.action = 'open-market';

    container.replaceChildren(...[
      identityCard(r),
      isUnit ? stnkCard(r) : null,
      inspectionCard(r),
      priceCard(r),
      mk,
      actions,
    ].filter(Boolean));
  }

  function renderPrintSheet(el) {
    const r = lastReport;
    if (!r) { el.replaceChildren(); return; }
    const p = r.product_detected || {};
    const m = r.price_matrix || {};
    const v = r.visual_sound_inspection || {};
    const s = r.stnk_audit || {};
    const date = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const rows = (pairs) => h('table', 'table', [h('tbody', null, pairs.filter(Boolean).map(([k, val]) =>
      h('tr', null, [h('th', null, k), h('td', 'mono', val)])))]);

    el.replaceChildren(...[
      h('header', 'sheet-head', [
        h('div', 'sheet-brand', [
          Object.assign(document.createElement('img'), { src: 'src/images/logo.jpeg', alt: 'Logo KudaBesi', className: 'sheet-logo' }),
          h('h2', null, 'Laporan Inspeksi KudaBesi'),
        ]),
        h('p', 'mono', date),
      ]),
      h('h3', null, p.name || '-'),
      rows([
        ['Kategori', p.category === 'part' ? 'Sparepart' : 'Unit motor'],
        p.year ? ['Tahun', String(p.year)] : null,
        ['Skor kesehatan', `${clamp(Math.round(num(r.health_score)), 0, 100)} / 100`],
        ['Verdict', r.verdict?.badge || '-'],
      ]),
      h('p', null, r.verdict?.summary || ''),
      p.category === 'part' ? null : h('h4', null, 'STNK & pajak'),
      p.category === 'part' ? null : rows([
        ['Status', STNK_LABEL[s.status] || s.status || '-'], s.plate ? ['Nopol', s.plate] : null,
        ['Pajak', s.tax_status || '-'], ['Estimasi denda', rupiah(s.tax_penalty_est)],
      ]),
      h('h4', null, 'Temuan'),
      h('p', null, `Visual: ${v.physical_notes || '-'}`),
      h('p', null, `Suara: ${v.sound_notes || '-'}`),
      h('h4', null, 'Harga'),
      rows([
        ['Harga penjual', rupiah(m.offered_price)], ['Biaya perbaikan', rupiah(repairTotal(r))],
        ['Harga wajar', `${rupiah(m.fair_price_min)} – ${rupiah(m.fair_price_max)}`],
        ['Target tawar', rupiah(m.recommended_offer)], ['Estimasi jual lagi', rupiah(m.estimated_resale_value)],
      ]),
      h('p', 'fineprint', 'Estimasi AI, bukan penilaian resmi. Periksa langsung unit/part sebelum bertransaksi.'),
    ].filter(Boolean));
  }

  window.InspekApi = { analyze, renderReport, renderMarketplace, marketplaceCopyText, renderPrintSheet, rupiah };
})();
