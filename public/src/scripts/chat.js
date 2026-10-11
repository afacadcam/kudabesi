document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chat-form');
  const userInput = document.getElementById('user-input');
  const chatBox = document.getElementById('chat-box');
  const modelSelect = document.getElementById('model-select');
  const modelBadge = document.getElementById('active-model-badge');
  const submitButton = chatForm ? chatForm.querySelector('button[type="submit"]') : null;

  // Menyimpan interaction_id untuk menjaga konteks percakapan multi-turn
  let currentInteractionId = null;
  let lastUsedModel = modelSelect ? modelSelect.value : 'gemini-3.5-flash-lite';

  if (!chatForm || !userInput || !chatBox) {
    console.error('Chat elements not found in the DOM.');
    return;
  }

  // Update badge indikator model aktif
  function updateModelBadge(modelId) {
    if (modelBadge) modelBadge.textContent = modelId;
  }

  // Listener pergantian model dinamis
  if (modelSelect) {
    updateModelBadge(modelSelect.value);
    modelSelect.addEventListener('change', () => {
      const newModel = modelSelect.value;
      updateModelBadge(newModel);
      if (newModel !== lastUsedModel) {
        currentInteractionId = null;
        lastUsedModel = newModel;
        const modelLabel = modelSelect.options[modelSelect.selectedIndex]?.text || newModel;
        appendMessage('bot', `beralih ke model ${modelLabel} (${newModel}). Sesi percakapan baru dimulai.`, true);
      }
    });
  }

  // Sinkronkan daftar model & default model dari backend
  fetch('/api/models')
    .then((r) => r.json())
    .then((data) => {
      if (data && data.success && Array.isArray(data.models) && modelSelect) {
        const currentVal = modelSelect.value;
        modelSelect.replaceChildren();
        data.models.forEach((m) => {
          const opt = new Option(m.label, m.id);
          if (m.id === (currentVal || data.default_model)) opt.selected = true;
          modelSelect.append(opt);
        });
        updateModelBadge(modelSelect.value);
        lastUsedModel = modelSelect.value;
      }
    })
    .catch(() => { });

  // Konfigurasi marked jika library tersedia
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      breaks: true,
      gfm: true
    });
  }

  // Helper untuk mengubah markdown menjadi HTML yang rapih & aman
  function formatMarkdown(text) {
    if (typeof marked !== 'undefined') {
      const rawHtml = marked.parse(text);
      const sanitized = typeof DOMPurify !== 'undefined' ? DOMPurify.sanitize(rawHtml) : rawHtml;
      // Bungkus tabel agar responsif tanpa memicu scrollbar di bubble chat utama
      return sanitized.replace(/<table/g, '<div class="table-responsive"><table').replace(/<\/table>/g, '</table></div>');
    }
    return text;
  }

  // Helper untuk membuat elemen pesan baru di dalam chat-box
  function appendMessage(sender, text, isHtml = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('chat-message', `${sender}-message`);
    if (isHtml) {
      messageElement.innerHTML = text;
    } else {
      messageElement.textContent = text;
    }
    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
    return messageElement;
  }

  // Auto-resize tinggi textarea saat mengetik
  function autoResizeTextarea() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.max(92, Math.min(userInput.scrollHeight, 220)) + 'px';
  }

  userInput.addEventListener('input', autoResizeTextarea);

  // Keyboard shortcut: Enter untuk submit, Ctrl+Enter / Shift+Enter untuk baris baru
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Enter atau Cmd+Enter: buat baris baru
        e.preventDefault();
        const start = userInput.selectionStart;
        const end = userInput.selectionEnd;
        userInput.setRangeText('\n', start, end, 'end');
        autoResizeTextarea();
      } else if (!e.shiftKey) {
        // Enter biasa: kirim pesan
        e.preventDefault();
        if (typeof chatForm.requestSubmit === 'function') {
          chatForm.requestSubmit();
        } else {
          chatForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
    }
  });

  chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const prompt = userInput.value.trim();
    if (!prompt) return;

    // 1. Tampilkan pesan user ke chat-box
    appendMessage('user', prompt);
    userInput.value = '';
    userInput.style.height = '';

    // 2. Tampilkan pesan sementara "Thinking..." dari bot
    const botMessageElement = appendMessage('bot', '<span class="thinking-dots">Sedang merespon...</span>', true);
    botMessageElement.classList.add('thinking');

    // Nonaktifkan form saat menunggu respons
    userInput.disabled = true;
    if (submitButton) submitButton.disabled = true;

    try {
      // 3. Kirim request POST ke /api/chat menyertakan interaction_id dan pilihan model dinamis
      const selectedModel = modelSelect ? modelSelect.value : 'gemini-3.5-flash-lite';
      const payload = {
        prompt,
        model: selectedModel
      };

      if (currentInteractionId) {
        payload.interaction_id = currentInteractionId;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      botMessageElement.classList.remove('thinking');

      // 4. Update interaction_id dan render jawaban AI terformat markdown
      if (data && data.success) {
        if (data.interaction_id) {
          currentInteractionId = data.interaction_id;
        }
        if (data.model_used) {
          updateModelBadge(data.model_used);
        }
        if (data.message) {
          botMessageElement.innerHTML = formatMarkdown(data.message);
        } else {
          botMessageElement.textContent = 'Maaf, tidak ada respons yang diterima.';
        }
      } else {
        botMessageElement.textContent = data?.message || 'Maaf, terjadi kesalahan pada server.';
      }
    } catch (error) {
      console.error('Chat error:', error);
      botMessageElement.classList.remove('thinking');
      botMessageElement.textContent = `Gagal mengirim pesan: ${error.message}`;
    } finally {
      userInput.disabled = false;
      if (submitButton) submitButton.disabled = false;
      userInput.focus();
    }
  });
});
