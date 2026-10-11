/**
 * KudaBesi — kudabesi.ui-events.js
 * Menangani: interaksi UI (kategori, slot foto, audio/rekam, STNK, tahun, modal, validasi, trigger).
 * Pengiriman data & render laporan ada di kudabesi.api-client.js (window.InspekApi).
 */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const MAX_FILE = 8_000_000;
  const MAX_REC_SECONDS = 15;
  const REC_SAMPLE_RATE = 22050;

  const SLOTS = {
    unit: ['Depan', 'Belakang', 'Sisi kanan', 'Sisi kiri / mesin'],
    part: ['Tampak utama', 'Detail / dudukan'],
  };
  const COPY = {
    unit: {
      photoHint: 'Minimal 4 sisi wajib: depan, belakang, kanan, kiri/mesin. Anda bisa tambahkan foto detail/sudut lain (spidometer, rangka, ban, dll) sebanyak yang dibutuhkan.',
      audioHint: 'Suara starter lalu idle mesin, 5–15 detik. Jauhkan dari bising lain (Wajib untuk unit motor).',
      notesLabel: 'Merek & tipe motor',
      notesPlaceholder: 'mis. Yamaha NMAX Turbo',
    },
    part: {
      photoHint: 'Minimal 2 sisi wajib: tampak utama dan detail. Anda bisa tambahkan foto sudut/detail lain sebanyak yang dibutuhkan.',
      audioHint: 'Suara part saat diketuk/diputar/ditekan jika ada (bearing, shock, CVT), 5–15 detik (Opsional untuk sparepart).',
      notesLabel: 'Nama part',
      notesPlaceholder: 'mis. Shock belakang Nmax',
    },
  };

  const state = {
    category: 'unit',
    photos: { unit: new Array(SLOTS.unit.length).fill(null), part: new Array(SLOTS.part.length).fill(null) },
    extraPhotos: { unit: [], part: [] },
    extraDocs: [],
    audio: null,
    stnk: null,
    service: null,
    busy: false,
  };

  const form = $('inspect-form');
  const reportEmpty = $('report-empty');
  const reportLoading = $('report-loading');
  const reportContent = $('report-content');
  let audioUrl = null;
  const photoUrls = new Map();

  /* =========================================================
     Kategori & slot foto (Minimal wajib + Upload tambahan)
     ========================================================= */
  function renderSlots() {
    const wrap = $('photo-slots');
    wrap.replaceChildren();

    // 1. Slot wajib (ketentuan minimal)
    SLOTS[state.category].forEach((label, i) => {
      const file = state.photos[state.category][i];
      const slot = document.createElement('label');
      slot.className = 'slot' + (file ? ' filled' : '');

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.className = 'visually-hidden';
      input.setAttribute('aria-label', `Foto ${label} (wajib minimal)`);
      input.addEventListener('change', () => setPhoto(i, input.files[0]));

      const box = document.createElement('span');
      box.className = 'slot-box';
      if (file) {
        const img = document.createElement('img');
        img.alt = `Pratinjau foto ${label}`;
        img.src = photoUrlFor(file);
        box.append(img);

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'slot-remove';
        removeBtn.textContent = '✕';
        removeBtn.setAttribute('aria-label', `Hapus foto ${label}`);
        removeBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          removePhoto(i);
        });
        slot.append(removeBtn);
      } else {
        const plus = document.createElement('span');
        plus.className = 'slot-plus';
        plus.textContent = '+';
        box.append(plus);
      }

      const name = document.createElement('span');
      name.className = 'slot-label';
      name.textContent = label;

      slot.append(input, box, name);
      wrap.append(slot);
    });

    // 2. Foto tambahan yang ditambahkan pengguna
    (state.extraPhotos[state.category] || []).forEach((file, idx) => {
      const slot = document.createElement('div');
      slot.className = 'slot filled';

      const box = document.createElement('span');
      box.className = 'slot-box';
      const img = document.createElement('img');
      img.alt = `Pratinjau foto ekstra #${idx + 1}`;
      img.src = photoUrlFor(file);
      box.append(img);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'slot-remove';
      removeBtn.textContent = '✕';
      removeBtn.setAttribute('aria-label', `Hapus foto ekstra #${idx + 1}`);
      removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeExtraPhoto(idx);
      });

      const name = document.createElement('span');
      name.className = 'slot-label';
      name.textContent = `Ekstra #${idx + 1}`;

      slot.append(removeBtn, box, name);
      wrap.append(slot);
    });

    // 3. Tombol slot "+ Tambah Foto Lain"
    const addSlot = document.createElement('label');
    addSlot.className = 'slot slot-add';

    const addInput = document.createElement('input');
    addInput.type = 'file';
    addInput.multiple = true;
    addInput.accept = 'image/*';
    addInput.className = 'visually-hidden';
    addInput.setAttribute('aria-label', 'Unggah foto tambahan');
    addInput.addEventListener('change', (e) => {
      addExtraPhotos(Array.from(e.target.files || []));
      e.target.value = '';
    });

    const addBox = document.createElement('span');
    addBox.className = 'slot-box';
    const addPlus = document.createElement('span');
    addPlus.className = 'slot-plus';
    addPlus.textContent = '+';
    addBox.append(addPlus);

    const addName = document.createElement('span');
    addName.className = 'slot-label';
    addName.textContent = '+ Foto Lain';

    addSlot.append(addInput, addBox, addName);
    wrap.append(addSlot);
  }

  function photoUrlFor(file) {
    if (!photoUrls.has(file)) photoUrls.set(file, URL.createObjectURL(file));
    return photoUrls.get(file);
  }

  function setPhoto(i, file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return showErrors(['File foto harus berupa gambar.']);
    if (file.size > MAX_FILE) return showErrors(['Ukuran foto maksimal 8 MB.']);
    clearErrors();
    const old = state.photos[state.category][i];
    if (old && photoUrls.has(old)) { URL.revokeObjectURL(photoUrls.get(old)); photoUrls.delete(old); }
    state.photos[state.category][i] = file;
    renderSlots();
  }

  function removePhoto(i) {
    const old = state.photos[state.category][i];
    if (old && photoUrls.has(old)) { URL.revokeObjectURL(photoUrls.get(old)); photoUrls.delete(old); }
    state.photos[state.category][i] = null;
    renderSlots();
  }

  function removeExtraPhoto(idx) {
    const list = state.extraPhotos[state.category];
    if (!list || !list[idx]) return;
    const old = list[idx];
    if (old && photoUrls.has(old)) { URL.revokeObjectURL(photoUrls.get(old)); photoUrls.delete(old); }
    list.splice(idx, 1);
    renderSlots();
  }

  function addExtraPhotos(files) {
    if (!files.length) return;
    const invalid = files.find((f) => !f.type.startsWith('image/'));
    if (invalid) return showErrors(['File foto tambahan harus berupa gambar.']);
    const oversized = files.find((f) => f.size > MAX_FILE);
    if (oversized) return showErrors(['Ukuran foto maksimal 8 MB per file.']);
    clearErrors();
    if (!state.extraPhotos[state.category]) state.extraPhotos[state.category] = [];
    state.extraPhotos[state.category].push(...files);
    renderSlots();
  }

  function applyCategory() {
    const checked = form.querySelector('input[name="category"]:checked');
    state.category = checked ? checked.value : 'unit';
    const isUnit = state.category === 'unit';
    const copy = COPY[state.category];
    $('photo-hint').textContent = copy.photoHint;
    $('audio-hint').textContent = copy.audioHint;
    const audioBadge = $('audio-req-badge');
    if (audioBadge) {
      audioBadge.className = isUnit ? 'req' : 'opt';
      audioBadge.textContent = isUnit ? 'wajib' : 'opsional';
    }
    $('notes-label').replaceChildren(copy.notesLabel + ' ', Object.assign(document.createElement('span'), { className: 'opt', textContent: 'opsional' }));
    $('notes').placeholder = copy.notesPlaceholder;
    $('unit-only').hidden = !isUnit;
    clearErrors();
    renderSlots();
  }

  /* =========================================================
     Tahun, STNK, file dokumen
     ========================================================= */
  function buildYearOptions() {
    const sel = $('year-select');
    sel.replaceChildren(new Option('Pilih tahun', ''));
    for (let y = 2026; y >= 2000; y--) sel.append(new Option(String(y), String(y)));
    sel.append(new Option('Sebelum 2000 (tulis sendiri)', 'custom'));
  }

  function onYearChange() {
    const custom = $('year-select').value === 'custom';
    $('year-custom').hidden = !custom;
    if (custom) $('year-custom').focus();
  }

  function currentYear() {
    const v = $('year-select').value;
    return v === 'custom' ? $('year-custom').value.trim() : v;
  }

  function applyStnk() {
    const none = form.querySelector('input[name="stnk_status"]:checked')?.value === 'none';
    $('stnk-upload').hidden = none;
    $('bodong-note').hidden = !none;
  }

  function onStnkChange() {
    const none = form.querySelector('input[name="stnk_status"]:checked')?.value === 'none';
    if (none) $('bodong-dialog').showModal();
    applyStnk();
  }

  function bindDocInput(inputId, nameId, key, emptyText) {
    $(inputId).addEventListener('change', (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const ok = f.type === 'application/pdf' || f.type.startsWith('image/');
      if (!ok) { e.target.value = ''; return showErrors(['Dokumen harus berupa gambar atau PDF.']); }
      if (f.size > MAX_FILE) { e.target.value = ''; return showErrors(['Ukuran dokumen maksimal 8 MB.']); }
      clearErrors();
      state[key] = f;
      $(nameId).textContent = f.name;
      $(nameId).classList.add('has-file');
    });
    $(nameId).dataset.empty = emptyText;
  }

  function initExtraDocs() {
    const input = $('extra-docs-file');
    if (!input) return;
    input.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const invalid = files.find((f) => f.type !== 'application/pdf' && !f.type.startsWith('image/'));
      if (invalid) { e.target.value = ''; return showErrors(['Dokumen pendukung harus berupa gambar atau PDF.']); }
      const oversized = files.find((f) => f.size > MAX_FILE);
      if (oversized) { e.target.value = ''; return showErrors(['Ukuran dokumen maksimal 8 MB per file.']); }
      clearErrors();
      state.extraDocs.push(...files);
      e.target.value = '';
      renderExtraDocs();
    });
  }

  function renderExtraDocs() {
    const list = $('extra-docs-list');
    const hint = $('extra-docs-hint');
    if (!list) return;
    list.replaceChildren();
    if (state.extraDocs.length === 0) {
      if (hint) hint.textContent = 'BPKB, faktur, nota servis, dll (bisa >1 file)';
      return;
    }
    if (hint) hint.textContent = `${state.extraDocs.length} dokumen ditambahkan`;
    state.extraDocs.forEach((file, idx) => {
      if (!file) return;
      const item = document.createElement('div');
      item.className = 'doc-item';
      const name = document.createElement('span');
      name.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'doc-item-del';
      del.textContent = '✕ Hapus';
      del.setAttribute('aria-label', `Hapus dokumen ${file.name}`);
      del.addEventListener('click', () => {
        state.extraDocs.splice(idx, 1);
        renderExtraDocs();
      });
      item.append(name, del);
      list.append(item);
    });
  }

  /* =========================================================
     Audio: upload + preview
     ========================================================= */
  function setAudio(file) {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    state.audio = file;
    if (!file) {
      audioUrl = null;
      $('audio-preview').hidden = true;
      $('audio-player').removeAttribute('src');
      $('audio-file').value = '';
      return;
    }
    audioUrl = URL.createObjectURL(file);
    $('audio-player').src = audioUrl;
    $('audio-name').textContent = file.name;
    $('audio-preview').hidden = false;
  }

  function onAudioFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith('audio/')) { e.target.value = ''; return showErrors(['File harus berupa audio (MP3, WAV, OGG, FLAC, AAC/M4A).']); }
    if (f.size > MAX_FILE) { e.target.value = ''; return showErrors(['Ukuran audio maksimal 8 MB.']); }
    clearErrors();
    setAudio(f);
  }

  /* =========================================================
     Modal: studio rekam suara
     ========================================================= */
  const rec = { recorder: null, stream: null, chunks: [], ctx: null, raf: 0, timer: 0, startedAt: 0, file: null, playbackUrl: null };

  function recReset() {
    cancelAnimationFrame(rec.raf);
    clearInterval(rec.timer);
    if (rec.recorder && rec.recorder.state !== 'inactive') { rec.recorder.onstop = null; rec.recorder.stop(); }
    rec.stream?.getTracks().forEach((t) => t.stop());
    rec.ctx?.close().catch(() => { });
    if (rec.playbackUrl) URL.revokeObjectURL(rec.playbackUrl);
    Object.assign(rec, { recorder: null, stream: null, chunks: [], ctx: null, file: null, playbackUrl: null });
    $('rec-toggle').textContent = 'Mulai rekam';
    $('rec-use').disabled = true;
    $('rec-playback').hidden = true;
    $('rec-playback').removeAttribute('src');
    $('rec-error').hidden = true;
    $('rec-timer').textContent = `00:00 / 00:${String(MAX_REC_SECONDS).padStart(2, '0')}`;
    const cv = $('rec-canvas');
    cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
  }

  function drawWave(analyser) {
    const cv = $('rec-canvas');
    const g = cv.getContext('2d');
    const buf = new Uint8Array(analyser.fftSize);
    const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#f5a524';
    const loop = () => {
      analyser.getByteTimeDomainData(buf);
      g.clearRect(0, 0, cv.width, cv.height);
      g.lineWidth = 2;
      g.strokeStyle = color;
      g.beginPath();
      for (let i = 0; i < buf.length; i++) {
        const x = (i / (buf.length - 1)) * cv.width;
        const y = (buf[i] / 255) * cv.height;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
      rec.raf = requestAnimationFrame(loop);
    };
    loop();
  }

  function recShowError(msg) {
    $('rec-error').textContent = msg;
    $('rec-error').hidden = false;
  }

  async function recStart() {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      return recShowError('Browser ini tidak mendukung perekaman. Gunakan "Unggah file audio".');
    }
    recReset();
    try {
      rec.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return recShowError('Akses mic ditolak atau tidak tersedia. Izinkan mic di browser, atau unggah file audio.');
    }
    rec.ctx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = rec.ctx.createAnalyser();
    analyser.fftSize = 1024;
    rec.ctx.createMediaStreamSource(rec.stream).connect(analyser);
    drawWave(analyser);

    rec.recorder = new MediaRecorder(rec.stream);
    rec.recorder.ondataavailable = (e) => e.data.size && rec.chunks.push(e.data);
    rec.recorder.onstop = recFinish;
    rec.recorder.start();
    rec.startedAt = performance.now();
    $('rec-toggle').textContent = 'Stop';
    rec.timer = setInterval(() => {
      const s = (performance.now() - rec.startedAt) / 1000;
      $('rec-timer').textContent = `00:${String(Math.floor(s)).padStart(2, '0')} / 00:${String(MAX_REC_SECONDS).padStart(2, '0')}`;
      if (s >= MAX_REC_SECONDS) recStop();
    }, 200);
  }

  function recStop() {
    if (rec.recorder && rec.recorder.state === 'recording') rec.recorder.stop();
  }

  async function recFinish() {
    cancelAnimationFrame(rec.raf);
    clearInterval(rec.timer);
    rec.stream?.getTracks().forEach((t) => t.stop());
    $('rec-toggle').textContent = 'Rekam ulang';
    try {
      const blob = new Blob(rec.chunks, { type: rec.recorder?.mimeType || 'audio/webm' });
      // Konversi ke WAV agar dikenali Gemini (webm tidak didukung)
      const wav = await blobToWav(blob);
      rec.file = new File([wav], `rekaman-${Date.now()}.wav`, { type: 'audio/wav' });
      rec.playbackUrl = URL.createObjectURL(rec.file);
      $('rec-playback').src = rec.playbackUrl;
      $('rec-playback').hidden = false;
      $('rec-use').disabled = false;
    } catch {
      recShowError('Rekaman gagal diproses. Coba rekam ulang atau unggah file audio.');
    }
  }

  async function blobToWav(blob) {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close().catch(() => { });
    const src = decoded.getChannelData(0);
    const ratio = decoded.sampleRate / REC_SAMPLE_RATE;
    const len = Math.floor(src.length / ratio);
    const pcm = new Int16Array(len);
    for (let i = 0; i < len; i++) {
      const a = Math.floor(i * ratio);
      const b = Math.max(a + 1, Math.min(Math.floor((i + 1) * ratio), src.length));
      let sum = 0;
      for (let j = a; j < b; j++) sum += src[j];
      const v = Math.max(-1, Math.min(1, sum / (b - a)));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const w = (o, s) => [...s].forEach((c, k) => out.setUint8(o + k, c.charCodeAt(0)));
    w(0, 'RIFF'); out.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, REC_SAMPLE_RATE, true); out.setUint32(28, REC_SAMPLE_RATE * 2, true);
    out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, 'data'); out.setUint32(40, pcm.length * 2, true);
    pcm.forEach((s, i) => out.setInt16(44 + i * 2, s, true));
    return new Blob([out], { type: 'audio/wav' });
  }

  /* =========================================================
     Validasi & submit
     ========================================================= */
  function showErrors(list) {
    const box = $('form-errors');
    box.replaceChildren(...list.map((t) => Object.assign(document.createElement('p'), { textContent: t })));
    box.hidden = false;
  }
  function clearErrors() { $('form-errors').hidden = true; }

  const parsePrice = () => Number($('offered-price').value.replace(/\D/g, '')) || 0;

  function validate() {
    const errors = [];
    const isUnit = state.category === 'unit';
    const need = SLOTS[state.category].length;
    const have = state.photos[state.category].filter(Boolean).length;
    if (have < need) errors.push(`Foto wajib kurang: baru ${have} dari ${need} sisi utama terisi.`);
    if (isUnit && !state.audio) errors.push('Audio suara mesin wajib untuk unit motor: unggah file atau rekam dari mic.');
    if (isUnit) {
      const stnkNone = form.querySelector('input[name="stnk_status"]:checked').value === 'none';
      if (!stnkNone && !state.stnk) errors.push('Lampirkan file STNK, atau pilih "Tidak ada".');
      const y = currentYear();
      if (!y) errors.push('Pilih tahun motor.');
      else if ($('year-select').value === 'custom' && !/^\d{3,4}$/.test(y)) errors.push('Tahun manual harus 3–4 digit (mis. 1987).');
    }
    if (!parsePrice()) errors.push('Isi harga yang ditawarkan penjual.');
    return errors;
  }

  let loadingTimer = 0;
  function setLoading(on) {
    state.busy = on;
    $('submit-btn').disabled = on;
    $('submit-btn').textContent = on ? 'Menganalisis…' : 'Jalankan audit';
    reportEmpty.hidden = true;
    reportContent.hidden = on;
    reportLoading.hidden = !on;
    clearInterval(loadingTimer);
    if (on) {
      const steps = ['Membaca foto…', 'Mendengarkan audio…', 'Memeriksa dokumen…', 'Mencari harga pasar…', 'Menyusun laporan…'];
      let i = 0;
      $('loading-text').textContent = steps[0];
      loadingTimer = setInterval(() => { i = Math.min(i + 1, steps.length - 1); $('loading-text').textContent = steps[i]; }, 3500);
    }
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (state.busy) return;
    const errors = validate();
    if (errors.length) return showErrors(errors);
    clearErrors();

    const isUnit = state.category === 'unit';
    const allPhotos = [
      ...state.photos[state.category].filter(Boolean),
      ...(state.extraPhotos[state.category] || []),
    ];
    const input = {
      category: state.category,
      photos: allPhotos,
      audio: state.audio,
      notes: $('notes').value.trim(),
      price: parsePrice(),
      stnkStatus: isUnit ? form.querySelector('input[name="stnk_status"]:checked').value : undefined,
      stnkFile: state.stnk,
      serviceFile: state.service,
      extraDocs: state.extraDocs,
      year: isUnit ? currentYear() : undefined,
    };

    setLoading(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const data = await window.InspekApi.analyze(input);
      window.InspekApi.renderReport(data, reportContent);
      setLoading(false);
    } catch (err) {
      setLoading(false);
      reportContent.hidden = true;
      reportEmpty.hidden = false;
      showErrors([err.message || 'Analisis gagal.']);
      form.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }

  function newInspection() {
    form.reset();
    photoUrls.forEach((u) => URL.revokeObjectURL(u));
    photoUrls.clear();
    state.photos.unit.fill(null);
    state.photos.part.fill(null);
    state.extraPhotos.unit = [];
    state.extraPhotos.part = [];
    state.extraDocs = [];
    state.stnk = null;
    state.service = null;
    setAudio(null);
    renderExtraDocs();
    ['stnk-name', 'service-name'].forEach((id) => {
      const el = $(id);
      el.textContent = id === 'stnk-name' ? 'Belum ada file (wajib)' : 'Kosong = AI mencari referensi pabrikan';
      el.classList.remove('has-file');
    });
    $('year-custom').hidden = true;
    applyCategory();
    applyStnk();
    reportContent.replaceChildren();
    reportContent.hidden = true;
    reportEmpty.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* =========================================================
     Modal helpers & aksi laporan
     ========================================================= */
  function openMarket() {
    window.InspekApi.renderMarketplace($('market-tabs'), $('market-body'));
    $('market-copy-status').textContent = '';
    $('market-dialog').showModal();
  }

  function openPrint() {
    window.InspekApi.renderPrintSheet($('print-sheet'));
    $('print-dialog').showModal();
  }

  async function copyMarket() {
    const text = window.InspekApi.marketplaceCopyText();
    try {
      await navigator.clipboard.writeText(text);
      $('market-copy-status').textContent = 'Tersalin.';
    } catch {
      $('market-copy-status').textContent = 'Gagal menyalin. Salin manual dari kotak di atas.';
    }
  }

  function bindDialogs() {
    document.querySelectorAll('[data-close]').forEach((btn) =>
      btn.addEventListener('click', () => $(btn.dataset.close).close()));

    // Fallback light-dismiss untuk browser tanpa dialog[closedby]
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      document.querySelectorAll('dialog[closedby="any"]').forEach((dlg) =>
        dlg.addEventListener('click', (e) => {
          const r = dlg.getBoundingClientRect();
          const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
          if (!inside) dlg.close();
        }));
    }

    $('recorder-dialog').addEventListener('close', recReset);
    $('open-recorder').addEventListener('click', () => { recReset(); $('recorder-dialog').showModal(); });
    $('rec-toggle').addEventListener('click', () => (rec.recorder?.state === 'recording' ? recStop() : recStart()));
    $('rec-use').addEventListener('click', () => {
      if (rec.file) { clearErrors(); setAudio(rec.file); $('recorder-dialog').close(); }
    });

    $('bodong-confirm').addEventListener('click', () => $('bodong-dialog').close());
    $('bodong-cancel').addEventListener('click', () => {
      form.querySelector('input[name="stnk_status"][value="available"]').checked = true;
      applyStnk();
      $('bodong-dialog').close();
    });
    // Esc pada dialog bodong = batal
    $('bodong-dialog').addEventListener('cancel', () => {
      form.querySelector('input[name="stnk_status"][value="available"]').checked = true;
      applyStnk();
    });

    // Modal Gemini Chat (chat.html tetap file terpisah, dimuat via iframe)
    const chatDialog = $('chat-dialog');
    const chatFrame = $('chat-frame');
    $('open-chat').addEventListener('click', () => {
      if (!chatFrame.getAttribute('src')) chatFrame.setAttribute('src', chatFrame.dataset.src);
      chatDialog.showModal();
    });
    window.addEventListener('message', (e) => {
      if (e.origin === window.location.origin && e.data?.type === 'close-chat') chatDialog.close();
    });

    $('market-copy').addEventListener('click', copyMarket);
    $('print-run').addEventListener('click', () => window.print());
  }

  /* =========================================================
     Init
     ========================================================= */
  function init() {
    buildYearOptions();
    form.querySelectorAll('input[name="category"]').forEach((r) => r.addEventListener('change', applyCategory));
    form.querySelectorAll('input[name="stnk_status"]').forEach((r) => r.addEventListener('change', onStnkChange));
    $('year-select').addEventListener('change', onYearChange);
    $('year-custom').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
    $('audio-file').addEventListener('change', onAudioFile);
    $('audio-remove').addEventListener('click', () => setAudio(null));
    bindDocInput('stnk-file', 'stnk-name', 'stnk', 'Belum ada file (wajib)');
    bindDocInput('service-file', 'service-name', 'service', 'Kosong = AI mencari referensi pabrikan');
    initExtraDocs();

    $('offered-price').addEventListener('input', (e) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
      e.target.value = digits ? Number(digits).toLocaleString('id-ID') : '';
    });

    form.addEventListener('submit', onSubmit);
    reportContent.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'open-market') openMarket();
      else if (action === 'open-print') openPrint();
      else if (action === 'new-inspection') newInspection();
    });

    bindDialogs();
    applyCategory();
    applyStnk();

    // Lightbox klik logo ukuran penuh tanpa border
    const brandLogo = document.querySelector('.brand-logo');
    if (brandLogo) {
      brandLogo.title = 'Klik atau arahkan kursor untuk melihat logo ukuran penuh';
      brandLogo.addEventListener('click', () => {
        const overlay = document.createElement('div');
        overlay.className = 'logo-lightbox-overlay';
        overlay.innerHTML = `
          <div class="logo-lightbox-content">
            <img src="src/images/logo.jpeg" alt="Logo KudaBesi" class="logo-lightbox-img">
            <button type="button" class="logo-lightbox-close" aria-label="Tutup">✕</button>
          </div>
        `;
        overlay.addEventListener('click', (e) => {
          if (e.target === overlay || e.target.classList.contains('logo-lightbox-close')) {
            overlay.remove();
          }
        });
        document.body.appendChild(overlay);
      });
    }
  }

  init();
})();
