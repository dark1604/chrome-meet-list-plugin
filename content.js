/**
 * content.js - Google Meet Attendance Tracker Content Script
 * Чітко розрізняє екран підготовки/лобі та реальний вхід на урок.
 * Запис починається ВИКЛЮЧНО в момент фактичного входу в активну зустріч з класом.
 */

(() => {
  console.log('[Meet Tracker] Модуль відстеження завантажено на сторінці Meet.');

  let currentMeetingCode = null;
  let isMeetingActive = false;
  let meetingStartTime = null;
  let meetingId = null;
  let postModalShown = false;
  let scanInterval = null;
  let hudElement = null;

  // Метадані уроку (оновлюються у вікні завершення зустрічі)
  let currentMetadata = {
    subject: 'Загальна зустріч',
    schoolClass: '',
    customTitle: '',
    notes: ''
  };

  // Словник зафіксованих учнів: { [name]: { name, firstJoined, lastSeen, totalSeconds, sessions: [] } }
  let participants = {};

  // Системні фрази інтерфейсу Google Meet, які треба ігнорувати при скануванні імен
  const IGNORED_STRINGS = [
    'hd720p', 'webcam', 'камера', 'мікрофон', 'фони й ефекти', 'розмити фон',
    'запитайте gemini', 'лише ви', 'налаштування', 'деталі зустрічі', 'учасники',
    'чат', 'дошка', 'приєднатися', 'залишити', 'вимкнути', 'увімкнути', 'поділитися',
    'підняти руку', 'показати екран', 'більше опцій', 'закріпити', 'відкріпити',
    'вилучити', 'немає звуку', 'без звуку', 'ви презентуєте', 'виступ'
  ];

  function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  // Отримання коду кімнати з URL
  function extractMeetingCode() {
    const match = window.location.pathname.match(/([a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3})/i);
    return match ? match[1].toLowerCase() : null;
  }

  function formatSeconds(totalSec) {
    const mins = Math.floor((totalSec || 0) / 60);
    const secs = (totalSec || 0) % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Витягує чистий текст із DOM-елемента без внутрішніх іконок Material Icons та кнопок
   */
  function extractCleanElementText(el) {
    if (!el) return '';
    const attrName = el.getAttribute('data-self-name');
    if (attrName) return attrName;

    const clone = el.cloneNode(true);
    clone.querySelectorAll('i, svg, button, [aria-hidden="true"], .google-symbols, .material-icons, .google-material-icons').forEach(node => node.remove());
    return clone.textContent || '';
  }

  function cleanParticipantName(rawName) {
    if (!rawName) return '';
    let name = (typeof MeetStorage !== 'undefined' && MeetStorage.sanitizeParticipantName)
      ? MeetStorage.sanitizeParticipantName(rawName)
      : String(rawName).trim();

    if (!name) return '';

    const lower = name.toLowerCase();
    for (const ignored of IGNORED_STRINGS) {
      if (lower.includes(ignored)) return '';
    }

    if (name.length < 2 || name.includes('http') || !isNaN(name)) {
      return '';
    }

    return name.trim();
  }

  // --- Перевірка: чи користувач ще на екрані налаштування (лобі / передпокій) ---
  function isUserInLobby() {
    const buttons = Array.from(document.querySelectorAll('button'));
    for (const b of buttons) {
      const text = (b.textContent || '').trim().toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();

      const isJoinButton = text.includes('приєднатися зараз') ||
                           text.includes('почати зустріч') ||
                           text.includes('увійти') ||
                           text.includes('join now') ||
                           text.includes('ask to join') ||
                           aria.includes('приєднатися зараз') ||
                           aria.includes('join now');

      // Якщо кнопка приєднання дійсно видима на екрані — ми ще в лобі
      if (isJoinButton && !text.includes('знову') && b.offsetParent !== null && b.offsetWidth > 0) {
        return true;
      }
    }
    return false;
  }

  // --- Перевірка: чи користувач вже всередині активного дзвінка зі співрозмовниками ---
  function isUserInActiveCall() {
    if (isUserInLobby()) {
      return false;
    }

    const leaveBtn = document.querySelector(
      'button[jsname="CQylAd"], ' +
      'button[aria-label*="Залишити" i], ' +
      'button[aria-label*="Leave" i], ' +
      'button[aria-label*="Завершити" i], ' +
      'button[aria-label*="Покинути" i], ' +
      'button[data-tooltip*="Leave" i], ' +
      'button[data-tooltip*="Залишити" i]'
    );

    const inCallControls = document.querySelector('button[data-panel-id="1"], button[data-panel-id="2"], div[data-is-muted]');

    const hasLeaveBtn = leaveBtn && (leaveBtn.offsetParent !== null || leaveBtn.offsetWidth > 0);
    const hasInCallControls = inCallControls && (inCallControls.offsetParent !== null || inCallControls.offsetWidth > 0);

    return Boolean(hasLeaveBtn || hasInCallControls);
  }

  // --- Плаваючий віджет (HUD) ---
  function createOrUpdateHUD() {
    if (!isMeetingActive) return;

    if (!hudElement || !document.body.contains(hudElement)) {
      hudElement = document.createElement('div');
      hudElement.id = 'gmeet-tracker-hud';
      hudElement.innerHTML = `
        <div class="gmeet-tracker-indicator" title="Відстеження уроку активне"></div>
        <div class="gmeet-tracker-info">
          <span class="gmeet-tracker-stat" id="gmeet-hud-participants" title="Зафіксовано учнів">
            👥 <b>0</b>
          </span>
          <span class="gmeet-tracker-stat" id="gmeet-hud-timer" title="Час від моменту вашого входу">
            ⏱️ <b>00:00</b>
          </span>
        </div>
        <button class="gmeet-tracker-btn" id="gmeet-hud-sync" title="Відкрити бічний список учасників">
          📋 Список
        </button>
        <button class="gmeet-tracker-btn gmeet-tracker-btn-primary" id="gmeet-hud-finish" title="Завершити урок та зберегти звіт">
          ⏹️ Завершити
        </button>
        <button class="gmeet-tracker-btn" id="gmeet-hud-dash" title="Відкрити журнал занять">
          📊 Журнал
        </button>
      `;
      document.body.appendChild(hudElement);

      makeDraggable(hudElement);

      document.getElementById('gmeet-hud-sync')?.addEventListener('click', () => {
        triggerPeoplePanelScan();
      });

      document.getElementById('gmeet-hud-finish')?.addEventListener('click', () => {
        onMeetingEnded();
      });

      document.getElementById('gmeet-hud-dash')?.addEventListener('click', () => {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({ action: 'OPEN_DASHBOARD' });
        }
      });
    }

    updateHUDMetrics();
  }

  function updateHUDMetrics() {
    if (!hudElement) return;
    const countEl = document.getElementById('gmeet-hud-participants');
    const timerEl = document.getElementById('gmeet-hud-timer');
    if (countEl) {
      countEl.innerHTML = `👥 <b>${Object.keys(participants).length}</b>`;
    }
    if (timerEl && meetingStartTime) {
      const elapsed = Math.floor((Date.now() - meetingStartTime) / 1000);
      timerEl.innerHTML = `⏱️ <b>${formatSeconds(elapsed)}</b>`;
    }
  }

  function removeHUD() {
    if (hudElement) {
      hudElement.remove();
      hudElement = null;
    }
  }

  function makeDraggable(el) {
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    el.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.style.left = `${initialLeft}px`;
      el.style.top = `${initialTop}px`;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      el.style.left = `${Math.max(10, initialLeft + dx)}px`;
      el.style.top = `${Math.max(10, initialTop + dy)}px`;
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });
  }

  function triggerPeoplePanelScan() {
    const peopleBtn = document.querySelector('button[data-panel-id="1"], button[aria-label*="учасник" i], button[aria-label*="люди" i], button[aria-label*="people" i]');
    if (peopleBtn) {
      peopleBtn.click();
      setTimeout(scanParticipants, 500);
    }
  }

  // --- Сканування присутніх учнів ---
  function scanParticipants() {
    if (!isMeetingActive) return;

    const currentSampleNames = new Set();

    // 1. Пошук у бічній панелі учасників (якщо відкрита)
    const listItems = document.querySelectorAll('[role="listitem"]');
    listItems.forEach(item => {
      const nameEl = item.querySelector('.zWGUib, [data-self-name], span[dir="auto"]');
      if (nameEl) {
        const text = cleanParticipantName(extractCleanElementText(nameEl));
        if (text) currentSampleNames.add(text);
      }
    });

    // 2. Пошук на відеоплитках учнів на екрані (span[jsname="Wp6Ze"])
    const nameSpans = document.querySelectorAll('span[jsname="Wp6Ze"]');
    nameSpans.forEach(span => {
      const text = cleanParticipantName(extractCleanElementText(span));
      if (text) currentSampleNames.add(text);
    });

    // 3. Пошук атрибута data-self-name (завжди чисте ім'я без іконок)
    document.querySelectorAll('[data-self-name]').forEach(el => {
      const name = cleanParticipantName(el.getAttribute('data-self-name'));
      if (name) currentSampleNames.add(name);
    });

    // 4. Пошук тексту імені в кутках відеоконтейнерів
    document.querySelectorAll('div[aria-label]').forEach(el => {
      const label = el.getAttribute('aria-label');
      if (label && label.includes('–') && !label.includes('Налаштування')) {
        const parts = label.split('–');
        if (parts[0]) {
          const cleaned = cleanParticipantName(parts[0]);
          if (cleaned) currentSampleNames.add(cleaned);
        }
      }
    });

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();

    currentSampleNames.forEach(name => {
      if (!participants[name]) {
        console.log('[Meet Tracker] 👤 До уроку приєднався:', name);
        participants[name] = {
          name: name,
          firstJoined: nowIso,
          lastSeen: nowIso,
          totalSeconds: 1,
          sessions: [{ joinTime: nowIso, leaveTime: nowIso }]
        };
      } else {
        const p = participants[name];
        const lastSeenMs = new Date(p.lastSeen).getTime();
        const diffSec = Math.round((nowMs - lastSeenMs) / 1000);

        p.lastSeen = nowIso;

        if (diffSec > 15) {
          console.log('[Meet Tracker] 👤 Учень повернувся на урок:', name);
          p.sessions.push({ joinTime: nowIso, leaveTime: nowIso });
        } else {
          const lastSession = p.sessions[p.sessions.length - 1];
          if (lastSession) lastSession.leaveTime = nowIso;
        }

        let total = 0;
        p.sessions.forEach(s => {
          const start = new Date(s.joinTime).getTime();
          const end = new Date(s.leaveTime).getTime();
          total += Math.max(1, Math.round((end - start) / 1000));
        });
        p.totalSeconds = total;
      }
    });

    createOrUpdateHUD();
    autoSaveSession();
  }

  function autoSaveSession(force = false) {
    if (!isMeetingActive && !force) return;
    if (!meetingId || !meetingStartTime) return;

    const duration = Math.round((Date.now() - meetingStartTime) / 1000);

    const draftMeeting = {
      id: meetingId,
      meetingCode: currentMeetingCode,
      subject: currentMetadata.subject || 'Загальна зустріч',
      schoolClass: currentMetadata.schoolClass || '',
      customTitle: currentMetadata.customTitle || '',
      notes: currentMetadata.notes || '',
      startTime: new Date(meetingStartTime).toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds: duration,
      participants: participants
    };

    if (typeof MeetStorage !== 'undefined') {
      MeetStorage.saveMeeting(draftMeeting).catch(err => {
        console.error('[Meet Tracker] Помилка збереження:', err);
      });
    }
  }

  // --- Безперервний моніторинг статусу ---
  function checkPageStatus() {
    const code = extractMeetingCode();

    if (!code) {
      if (isMeetingActive) {
        onMeetingEnded();
      }
      return;
    }

    currentMeetingCode = code;
    const inActiveCall = isUserInActiveCall();

    if (inActiveCall && !isMeetingActive) {
      // Користувач натиснув "Приєднатися" і увійшов на урок
      isMeetingActive = true;
      meetingStartTime = Date.now();
      meetingId = `meet_${currentMeetingCode}_${meetingStartTime}`;
      participants = {};
      postModalShown = false;
      currentMetadata = {
        subject: 'Загальна зустріч',
        schoolClass: '',
        customTitle: '',
        notes: ''
      };

      console.log(`[Meet Tracker] 🟢 УРОК РОЗПОЧАТО! Код: ${currentMeetingCode}. Час старту: ${new Date(meetingStartTime).toLocaleTimeString()}`);

      createOrUpdateHUD();

      if (!scanInterval) {
        scanInterval = setInterval(scanParticipants, 2500);
        scanParticipants();
      }
    } else if (inActiveCall && isMeetingActive) {
      // Щосекундне оновлення таймера у віджеті
      updateHUDMetrics();
    } else if (!inActiveCall && isMeetingActive) {
      // Урок закінчився або користувач вийшов
      console.log('[Meet Tracker] Дзвінок завершено.');
      onMeetingEnded();
    }
  }

  // Делегований перехоплювач кліку по червоній слухавці завершення дзвінка
  document.addEventListener('click', (e) => {
    if (!isMeetingActive) return;
    const leaveBtn = e.target.closest(
      'button[jsname="CQylAd"], ' +
      'button[aria-label*="Залишити" i], ' +
      'button[aria-label*="Leave" i], ' +
      'button[aria-label*="Завершити" i], ' +
      'button[aria-label*="Покинути" i]'
    );
    if (leaveBtn) {
      console.log('[Meet Tracker] Натиснуто кнопку виходу.');
      setTimeout(onMeetingEnded, 250);
    }
  }, true);

  function onMeetingEnded() {
    if (!isMeetingActive) return;
    isMeetingActive = false;

    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }

    removeHUD();
    autoSaveSession(true);
    showPostMeetingModal();
  }

  // --- Модальне вікно підсумків уроку після виходу ---
  async function showPostMeetingModal() {
    if (postModalShown) return;
    postModalShown = true;

    const duration = meetingStartTime ? Math.round((Date.now() - meetingStartTime) / 1000) : 0;
    const participantsList = Object.values(participants);

    let presets = [];
    let classes = [];
    if (typeof MeetStorage !== 'undefined') {
      presets = await MeetStorage.getPresets();
      classes = await MeetStorage.getClasses();
    } else {
      presets = ['Інформатика', 'Математика', 'Фізика', 'Англійська мова'];
      classes = ['1 клас', '2 клас', '3 клас', '4 клас', '5 клас', '6 клас', '7 клас', '8 клас', '9 клас', '10 клас', '11 клас'];
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'gmeet-tracker-modal-overlay';

    modalOverlay.innerHTML = `
      <div class="gmeet-modal-card">
        <div class="gmeet-modal-header">
          <div class="gmeet-modal-icon">📚</div>
          <div>
            <h2 class="gmeet-modal-title">Урок завершено!</h2>
            <p class="gmeet-modal-subtitle">Код: <b>${escapeHtml(currentMeetingCode)}</b> • Збережіть деталі в локальний журнал</p>
          </div>
        </div>

        <div class="gmeet-modal-summary">
          <div class="gmeet-summary-item">
            <div class="gmeet-summary-num">${participantsList.length}</div>
            <div class="gmeet-summary-label">Приєднаних дітей</div>
          </div>
          <div class="gmeet-summary-item">
            <div class="gmeet-summary-num">${formatSeconds(duration)}</div>
            <div class="gmeet-summary-label">Час спілкування</div>
          </div>
          <div class="gmeet-summary-item">
            <div class="gmeet-summary-num">100%</div>
            <div class="gmeet-summary-label">Локально на ПК</div>
          </div>
        </div>

        <div class="gmeet-form-row">
          <div class="gmeet-form-group">
            <label class="gmeet-form-label" for="gmeet-select-subject">Предмет / Заготовка:</label>
            <select id="gmeet-select-subject" class="gmeet-select">
              ${presets.map(p => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
              <option value="__custom__">➕ Вказати іншу назву...</option>
            </select>
          </div>

          <div class="gmeet-form-group">
            <label class="gmeet-form-label" for="gmeet-select-class">Клас (1–11 класи):</label>
            <select id="gmeet-select-class" class="gmeet-select">
              <option value="">(Без класу / Загальна)</option>
              ${classes.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
              <option value="__custom_class__">➕ Свій клас / літера (напр. 8-А)...</option>
            </select>
          </div>
        </div>

        <div class="gmeet-form-row">
          <div class="gmeet-form-group" id="gmeet-custom-subject-group" style="display: none;">
            <label class="gmeet-form-label" for="gmeet-input-custom-subject">Кастомна назва предмета:</label>
            <input type="text" id="gmeet-input-custom-subject" class="gmeet-input" placeholder="Наприклад: Підготовка до олімпіади" />
          </div>

          <div class="gmeet-form-group" id="gmeet-custom-class-group" style="display: none;">
            <label class="gmeet-form-label" for="gmeet-input-custom-class">Кастомний клас / літера:</label>
            <input type="text" id="gmeet-input-custom-class" class="gmeet-input" placeholder="Наприклад: 8-Б клас або Факультатив" />
          </div>
        </div>

        <div class="gmeet-form-group">
          <label class="gmeet-form-label" for="gmeet-input-title">Тема уроку (опціонально):</label>
          <input type="text" id="gmeet-input-title" class="gmeet-input" placeholder="Наприклад: Квадратні рівняння, Розділ 3" />
        </div>

        <div class="gmeet-form-group">
          <label class="gmeet-form-label" for="gmeet-input-notes">Швидка нотатка / ДЗ (буде на зображенні та в журналі):</label>
          <textarea id="gmeet-input-notes" class="gmeet-textarea" placeholder="Д/З параграф 12, виконати вправи 1-4..."></textarea>
        </div>

        <!-- Швидкий експорт прямокутної PNG-картки -->
        <div class="gmeet-png-export-section">
          <div class="gmeet-png-title">
            <span>📷 Швидкий експорт результатів уроку (PNG-картка):</span>
          </div>
          <div class="gmeet-png-buttons">
            <button type="button" id="gmeet-btn-download-png" class="gmeet-btn-action">
              📥 Завантажити PNG
            </button>
            <button type="button" id="gmeet-btn-copy-png" class="gmeet-btn-action">
              📋 Скопіювати картинку (Ctrl+V)
            </button>
          </div>
          <div id="gmeet-png-feedback" class="gmeet-png-feedback" style="display: none;"></div>
        </div>

        <div class="gmeet-modal-actions">
          <button id="gmeet-btn-save-close" class="gmeet-btn-cancel">Зберегти в журнал</button>
          <button id="gmeet-btn-save-open" class="gmeet-btn-submit">Зберегти та відкрити звіт</button>
        </div>
      </div>
    `;

    document.body.appendChild(modalOverlay);

    const selectEl = document.getElementById('gmeet-select-subject');
    const customGroup = document.getElementById('gmeet-custom-subject-group');
    const customInput = document.getElementById('gmeet-input-custom-subject');

    const selectClassEl = document.getElementById('gmeet-select-class');
    const customClassGroup = document.getElementById('gmeet-custom-class-group');
    const customClassInput = document.getElementById('gmeet-input-custom-class');

    const titleInput = document.getElementById('gmeet-input-title');
    const notesInput = document.getElementById('gmeet-input-notes');
    const pngFeedback = document.getElementById('gmeet-png-feedback');

    function syncCurrentMetadata() {
      let finalSubject = selectEl ? selectEl.value : 'Загальна зустріч';
      if (finalSubject === '__custom__') {
        finalSubject = (customInput ? customInput.value.trim() : '') || 'Спеціальна зустріч';
      }

      let finalClass = selectClassEl ? selectClassEl.value : '';
      if (finalClass === '__custom_class__') {
        finalClass = customClassInput ? customClassInput.value.trim() : '';
      }

      currentMetadata = {
        subject: finalSubject,
        schoolClass: finalClass,
        customTitle: titleInput ? titleInput.value.trim() : '',
        notes: notesInput ? notesInput.value.trim() : ''
      };
    }

    selectEl?.addEventListener('change', () => {
      if (selectEl.value === '__custom__') {
        customGroup.style.display = 'block';
        customInput.focus();
      } else {
        customGroup.style.display = 'none';
      }
      syncCurrentMetadata();
    });

    selectClassEl?.addEventListener('change', () => {
      if (selectClassEl.value === '__custom_class__') {
        customClassGroup.style.display = 'block';
        customClassInput.focus();
      } else {
        customClassGroup.style.display = 'none';
      }
      syncCurrentMetadata();
    });

    [customInput, customClassInput, titleInput, notesInput].forEach(inp => {
      inp?.addEventListener('input', syncCurrentMetadata);
    });

    syncCurrentMetadata();

    function getCurrentMeetingObject() {
      syncCurrentMetadata();
      return {
        id: meetingId || `meet_${currentMeetingCode}_${Date.now()}`,
        meetingCode: currentMeetingCode,
        subject: currentMetadata.subject,
        schoolClass: currentMetadata.schoolClass,
        customTitle: currentMetadata.customTitle,
        notes: currentMetadata.notes,
        startTime: new Date(meetingStartTime || Date.now()).toISOString(),
        endTime: new Date().toISOString(),
        durationSeconds: duration,
        participants: participants
      };
    }

    document.getElementById('gmeet-btn-download-png')?.addEventListener('click', async () => {
      const currentMeeting = getCurrentMeetingObject();
      if (typeof MeetingCardGenerator !== 'undefined') {
        MeetingCardGenerator.downloadPNG(currentMeeting);
        if (pngFeedback) {
          pngFeedback.style.display = 'block';
          pngFeedback.textContent = '✅ PNG-картку збережено на комп\'ютер!';
          pngFeedback.style.color = '#34d399';
        }
      }
      if (typeof MeetStorage !== 'undefined') {
        await MeetStorage.saveMeeting(currentMeeting);
      }
    });

    document.getElementById('gmeet-btn-copy-png')?.addEventListener('click', async () => {
      const currentMeeting = getCurrentMeetingObject();
      if (typeof MeetingCardGenerator !== 'undefined') {
        try {
          await MeetingCardGenerator.copyToClipboard(currentMeeting);
          if (pngFeedback) {
            pngFeedback.style.display = 'block';
            pngFeedback.textContent = '✅ Скопійовано! Вставте картинку через Ctrl+V у Telegram чи Viber.';
            pngFeedback.style.color = '#38bdf8';
          }
        } catch (e) {
          MeetingCardGenerator.downloadPNG(currentMeeting);
          if (pngFeedback) {
            pngFeedback.style.display = 'block';
            pngFeedback.textContent = '📥 Файл завантажено на комп\'ютер!';
            pngFeedback.style.color = '#fbbf24';
          }
        }
      }
      if (typeof MeetStorage !== 'undefined') {
        await MeetStorage.saveMeeting(currentMeeting);
      }
    });

    async function handleSave(openDashboard = false) {
      syncCurrentMetadata();

      if (selectEl && selectEl.value === '__custom__' && customInput && customInput.value.trim()) {
        if (typeof MeetStorage !== 'undefined') {
          await MeetStorage.addPreset(customInput.value.trim());
        }
      }

      if (selectClassEl && selectClassEl.value === '__custom_class__' && customClassInput && customClassInput.value.trim()) {
        if (typeof MeetStorage !== 'undefined') {
          await MeetStorage.addClass(customClassInput.value.trim());
        }
      }

      const finalMeeting = getCurrentMeetingObject();

      if (typeof MeetStorage !== 'undefined') {
        await MeetStorage.saveMeeting(finalMeeting);
      }

      modalOverlay.remove();
      removeHUD();

      if (openDashboard && typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          action: 'OPEN_DASHBOARD',
          meetingId: finalMeeting.id
        });
      }
    }

    document.getElementById('gmeet-btn-save-close')?.addEventListener('click', () => handleSave(false));
    document.getElementById('gmeet-btn-save-open')?.addEventListener('click', () => handleSave(true));
  }

  // Захист при раптовому закритті вкладки
  window.addEventListener('beforeunload', () => {
    if (isMeetingActive || postModalShown) {
      autoSaveSession(true);
    }
  });

  // Моніторинг статусу кожну 1 секунду
  setInterval(checkPageStatus, 1000);
  checkPageStatus();
})();
