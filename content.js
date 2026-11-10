/**
 * content.js - Google Meet Attendance Tracker Content Script
 * - Чітко розрізняє екран підготовки/лобі та реальний вхід на урок.
 * - Блокує повторне створення дублюючої зустрічі під час/після виходу з дзвінка.
 * - Показує компактне спливаюче меню СПРАВА з вибором ТІЛЬКИ Предмета та Класу.
 */

(() => {
  console.log('[Meet Tracker] Модуль відстеження завантажено на сторінці Meet.');

  if (typeof MeetI18n !== 'undefined' && MeetI18n.init) {
    MeetI18n.init();
  }

  function t(key, params = {}) {
    if (typeof MeetI18n !== 'undefined' && MeetI18n.t) {
      return MeetI18n.t(key, params);
    }
    return key;
  }

  let currentMeetingCode = null;
  let isMeetingActive = false;
  let hasEndedCurrentCall = false; // Захист від повторного авто-старту нової зустрічі після закриття
  let meetingStartTime = null;
  let meetingId = null;
  let scanInterval = null;
  let hudElement = null;
  let endedMeetingSnapshot = null;

  // Запам'ятовуємо останній вибраний предмет і клас для зручності
  let currentMetadata = {
    subject: localStorage.getItem('meet_last_subject') || 'Інформатика',
    schoolClass: localStorage.getItem('meet_last_class') || '6 клас'
  };

  // Словник зафіксованих учнів: { [name]: { name, firstJoined, lastSeen, totalSeconds, sessions: [] } }
  let participants = {};

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

  function extractMeetingCode() {
    const match = window.location.pathname.match(/([a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3})/i);
    return match ? match[1].toLowerCase() : null;
  }

  function formatSeconds(totalSec) {
    const mins = Math.floor((totalSec || 0) / 60);
    const secs = (totalSec || 0) % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

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

  // Перевірка: чи користувач на екрані завершеного дзвінка ("Ви залишили зустріч" / "You left the meeting")
  function isUserOnPostCallScreen() {
    const buttons = Array.from(document.querySelectorAll('button, a[role="button"]'));
    for (const b of buttons) {
      const text = (b.textContent || '').trim().toLowerCase();
      if (
        text.includes('повернутися на зустріч') ||
        text.includes('повернутися на головний екран') ||
        text.includes('rejoin') ||
        text.includes('return to home screen')
      ) {
        if (b.offsetParent !== null || b.offsetWidth > 0) {
          return true;
        }
      }
    }
    return false;
  }

  // Перевірка: чи користувач ще на екрані налаштування (лобі / передпокій)
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

      if (isJoinButton && !text.includes('знову') && b.offsetParent !== null && b.offsetWidth > 0) {
        return true;
      }
    }
    return false;
  }

  // Перевірка: чи користувач всередині активного дзвінка
  function isUserInActiveCall() {
    if (isUserInLobby() || isUserOnPostCallScreen()) {
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

  // Програмне закриття дзвінка у Google Meet (при натисканні кнопки "Завершити" на HUD)
  function triggerGoogleMeetLeaveCall() {
    const leaveBtn = document.querySelector(
      'button[jsname="CQylAd"], ' +
      'button[aria-label*="Залишити" i], ' +
      'button[aria-label*="Leave" i], ' +
      'button[aria-label*="Завершити" i], ' +
      'button[aria-label*="Покинути" i]'
    );
    if (leaveBtn) {
      leaveBtn.click();
      // Якщо Google Meet показує меню організатора ("Просто вийти з дзвінка" / "Завершити дзвінок для всіх")
      setTimeout(() => {
        const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], button'));
        const confirmBtn = menuItems.find(el => {
          const txt = (el.textContent || '').trim().toLowerCase();
          return txt.includes('просто вийти') ||
                 txt.includes('завершити дзвінок для всіх') ||
                 txt.includes('залишити дзвінок') ||
                 txt.includes('just leave the call') ||
                 txt.includes('end call for everyone');
        });
        if (confirmBtn) confirmBtn.click();
      }, 200);
    }
  }

  // --- Плаваючий віджет (HUD) під час уроку ---
  function createOrUpdateHUD() {
    if (!isMeetingActive || hasEndedCurrentCall) return;

    if (!hudElement || !document.body.contains(hudElement)) {
      hudElement = document.createElement('div');
      hudElement.id = 'gmeet-tracker-hud';
      hudElement.innerHTML = `
        <div class="gmeet-tracker-indicator" data-i18n-title="hud_indicator_title" title="${escapeHtml(t('hud_indicator_title'))}"></div>
        <div class="gmeet-tracker-info">
          <span class="gmeet-tracker-stat" id="gmeet-hud-participants" data-i18n-title="hud_participants_title" title="${escapeHtml(t('hud_participants_title'))}">
            👥 <b>0</b>
          </span>
          <span class="gmeet-tracker-stat" id="gmeet-hud-timer" data-i18n-title="hud_timer_title" title="${escapeHtml(t('hud_timer_title'))}">
            ⏱️ <b>00:00</b>
          </span>
        </div>
        <button class="gmeet-tracker-btn" id="gmeet-hud-sync" data-i18n="hud_btn_sync" data-i18n-title="hud_btn_sync_title" title="${escapeHtml(t('hud_btn_sync_title'))}">
          ${escapeHtml(t('hud_btn_sync'))}
        </button>
        <button class="gmeet-tracker-btn gmeet-tracker-btn-primary" id="gmeet-hud-finish" data-i18n="hud_btn_finish" data-i18n-title="hud_btn_finish_title" title="${escapeHtml(t('hud_btn_finish_title'))}">
          ${escapeHtml(t('hud_btn_finish'))}
        </button>
        <button class="gmeet-tracker-btn" id="gmeet-hud-dash" data-i18n="hud_btn_dash" data-i18n-title="hud_btn_dash_title" title="${escapeHtml(t('hud_btn_dash_title'))}">
          ${escapeHtml(t('hud_btn_dash'))}
        </button>
      `;
      document.body.appendChild(hudElement);

      makeDraggable(hudElement);

      document.getElementById('gmeet-hud-sync')?.addEventListener('click', () => {
        triggerPeoplePanelScan();
      });

      document.getElementById('gmeet-hud-finish')?.addEventListener('click', () => {
        onMeetingEnded();
        triggerGoogleMeetLeaveCall();
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
    if (!isMeetingActive || hasEndedCurrentCall) return;

    const currentSampleNames = new Set();

    const listItems = document.querySelectorAll('[role="listitem"]');
    listItems.forEach(item => {
      const nameEl = item.querySelector('.zWGUib, [data-self-name], span[dir="auto"]');
      if (nameEl) {
        const text = cleanParticipantName(extractCleanElementText(nameEl));
        if (text) currentSampleNames.add(text);
      }
    });

    const nameSpans = document.querySelectorAll('span[jsname="Wp6Ze"]');
    nameSpans.forEach(span => {
      const text = cleanParticipantName(extractCleanElementText(span));
      if (text) currentSampleNames.add(text);
    });

    document.querySelectorAll('[data-self-name]').forEach(el => {
      const name = cleanParticipantName(el.getAttribute('data-self-name'));
      if (name) currentSampleNames.add(name);
    });

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

  function autoSaveSession() {
    if (!isMeetingActive || hasEndedCurrentCall) return;
    if (!meetingId || !meetingStartTime) return;

    const duration = Math.round((Date.now() - meetingStartTime) / 1000);

    const draftMeeting = {
      id: meetingId,
      meetingCode: currentMeetingCode,
      subject: currentMetadata.subject || 'Інформатика',
      schoolClass: currentMetadata.schoolClass || '',
      customTitle: '',
      notes: '',
      startTime: new Date(meetingStartTime).toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds: duration,
      participants: participants
    };

    if (typeof MeetStorage !== 'undefined') {
      MeetStorage.saveMeeting(draftMeeting, { isAutoSave: true }).catch(err => {
        console.error('[Meet Tracker] Помилка автозбереження:', err);
      });
    }
  }

  // --- Моніторинг статусу кімнати ---
  function checkPageStatus() {
    const code = extractMeetingCode();

    if (!code) {
      if (isMeetingActive) {
        onMeetingEnded();
      }
      currentMeetingCode = null;
      hasEndedCurrentCall = false;
      return;
    }

    // Якщо змінився код кімнати (перехід в іншу зустріч), знімаємо блокування
    if (currentMeetingCode && currentMeetingCode !== code) {
      if (isMeetingActive) {
        onMeetingEnded();
      }
      hasEndedCurrentCall = false;
    }

    currentMeetingCode = code;
    const inActiveCall = isUserInActiveCall();

    // Якщо користувач вже завершив урок у цій кімнаті, НЕ починаємо нову зустріч автоматично
    if (hasEndedCurrentCall) {
      return;
    }

    if (inActiveCall && !isMeetingActive) {
      // Старт запису строго після входу в активний дзвінок
      isMeetingActive = true;
      meetingStartTime = Date.now();
      meetingId = `meet_${currentMeetingCode}_${meetingStartTime}`;
      participants = {};
      endedMeetingSnapshot = null;

      // Прибираємо попередній правий попап, якщо він був відкритий
      document.getElementById('gmeet-tracker-side-popup')?.remove();

      console.log(`[Meet Tracker] 🟢 УРОК РОЗПОЧАТО! Код: ${currentMeetingCode}`);

      createOrUpdateHUD();

      if (!scanInterval) {
        scanInterval = setInterval(scanParticipants, 2500);
        scanParticipants();
      }
    } else if (inActiveCall && isMeetingActive) {
      updateHUDMetrics();
    } else if (!inActiveCall && isMeetingActive) {
      console.log('[Meet Tracker] Дзвінок завершено.');
      onMeetingEnded();
    }
  }

  // Слухач кліків: вихід із зустрічі АБО явне натискання "Повернутися на зустріч" / "Приєднатися"
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button, a[role="button"]');
    if (!btn) return;

    const text = (btn.textContent || '').trim().toLowerCase();
    const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
    const jsname = btn.getAttribute('jsname') || '';

    // 1. Якщо натиснуто червону кнопку завершення дзвінка
    const isLeaveBtn = jsname === 'CQylAd' ||
                       aria.includes('залишити') ||
                       aria.includes('leave') ||
                       aria.includes('завершити дзвінок') ||
                       aria.includes('покинути') ||
                       text.includes('просто вийти з дзвінка') ||
                       text.includes('завершити дзвінок для всіх') ||
                       text.includes('just leave the call') ||
                       text.includes('end call for everyone');

    if (isLeaveBtn && isMeetingActive) {
      console.log('[Meet Tracker] Натиснуто кнопку виходу з зустрічі.');
      onMeetingEnded();
      return;
    }

    // 2. Якщо користувач свідомо натискає "Повернутися на зустріч" / "Rejoin" / "Приєднатися зараз"
    const isRejoinBtn = text.includes('повернутися на зустріч') ||
                        text.includes('rejoin') ||
                        text.includes('приєднатися зараз') ||
                        text.includes('join now');

    if (isRejoinBtn && hasEndedCurrentCall) {
      console.log('[Meet Tracker] Користувач повторно приєднується до зустрічі.');
      setTimeout(() => {
        hasEndedCurrentCall = false;
      }, 1000);
    }
  }, true);

  function onMeetingEnded() {
    if (!isMeetingActive) return;
    isMeetingActive = false;
    hasEndedCurrentCall = true; // Забороняємо старт нової сесії під час закриття дзвінка

    if (scanInterval) {
      clearInterval(scanInterval);
      scanInterval = null;
    }

    removeHUD();

    const duration = meetingStartTime ? Math.max(1, Math.round((Date.now() - meetingStartTime) / 1000)) : 0;

    // Фіксуємо незмінний знімок завершеного уроку
    endedMeetingSnapshot = {
      id: meetingId || `meet_${currentMeetingCode || 'room'}_${Date.now()}`,
      meetingCode: currentMeetingCode || 'unknown',
      subject: currentMetadata.subject || 'Інформатика',
      schoolClass: currentMetadata.schoolClass || '',
      customTitle: '',
      notes: '',
      startTime: new Date(meetingStartTime || Date.now()).toISOString(),
      endTime: new Date().toISOString(),
      durationSeconds: duration,
      participants: JSON.parse(JSON.stringify(participants || {}))
    };

    if (typeof MeetStorage !== 'undefined') {
      MeetStorage.saveMeeting(endedMeetingSnapshot);
    }

    showPostMeetingSidePopup(endedMeetingSnapshot);
  }

  // --- Компактне спливаюче меню СПРАВА після завершення зустрічі (ТІЛЬКИ Предмет та Клас) ---
  async function showPostMeetingSidePopup(snapshot) {
    if (!snapshot) return;

    document.getElementById('gmeet-tracker-side-popup')?.remove();

    if (typeof MeetI18n !== 'undefined' && MeetI18n.init) {
      await MeetI18n.init();
    }

    let presets = [];
    let classes = [];
    if (typeof MeetStorage !== 'undefined') {
      presets = await MeetStorage.getPresets();
      classes = await MeetStorage.getClasses();
    } else {
      presets = ['Інформатика', 'Математика', 'Фізика', 'Англійська мова'];
      classes = ['1 клас', '2 клас', '3 клас', '4 клас', '5 клас', '6 клас', '7 клас', '8 клас', '9 клас', '10 клас', '11 клас'];
    }

    const participantsCount = Object.keys(snapshot.participants || {}).length;
    const activeLang = (typeof MeetI18n !== 'undefined' && MeetI18n.getLang) ? MeetI18n.getLang() : 'uk';

    // Визначаємо початково вибраний предмет і клас
    const savedSubject = localStorage.getItem('meet_last_subject') || presets[0] || 'Інформатика';
    const savedClass = localStorage.getItem('meet_last_class') !== null ? localStorage.getItem('meet_last_class') : (classes[5] || '6 клас');

    const popupEl = document.createElement('div');
    popupEl.id = 'gmeet-tracker-side-popup';

    popupEl.innerHTML = `
      <div class="gmeet-side-header">
        <div class="gmeet-side-header-left">
          <div class="gmeet-side-icon">📚</div>
          <div>
            <h3 class="gmeet-side-title" data-i18n="post_modal_title">${escapeHtml(t('post_modal_title'))}</h3>
            <p class="gmeet-side-subtitle">Код: <b>${escapeHtml(snapshot.meetingCode)}</b></p>
          </div>
        </div>
        <div class="gmeet-side-header-right">
          <div class="gmeet-lang-switcher">
            <button type="button" class="gmeet-lang-btn ${activeLang === 'uk' ? 'active' : ''}" data-lang-switch="uk">UA</button>
            <button type="button" class="gmeet-lang-btn ${activeLang === 'en' ? 'active' : ''}" data-lang-switch="en">EN</button>
          </div>
          <button type="button" class="gmeet-side-close" id="gmeet-side-close-btn" title="Закрити">&times;</button>
        </div>
      </div>

      <div class="gmeet-side-stats">
        <div class="gmeet-side-stat-box">
          <span>👥</span>
          <div>
            <div class="gmeet-side-stat-val">${participantsCount}</div>
            <div class="gmeet-side-stat-lbl" data-i18n="post_summary_students">${escapeHtml(t('post_summary_students'))}</div>
          </div>
        </div>
        <div class="gmeet-side-stat-box">
          <span>⏱️</span>
          <div>
            <div class="gmeet-side-stat-val">${formatSeconds(snapshot.durationSeconds)}</div>
            <div class="gmeet-side-stat-lbl" data-i18n="post_summary_duration">${escapeHtml(t('post_summary_duration'))}</div>
          </div>
        </div>
      </div>

      <div class="gmeet-form-group">
        <label class="gmeet-form-label" for="gmeet-select-subject" data-i18n="post_label_subject">${escapeHtml(t('post_label_subject'))}</label>
        <select id="gmeet-select-subject" class="gmeet-select">
          ${presets.map(p => `<option value="${escapeHtml(p)}" ${p === savedSubject ? 'selected' : ''}>${escapeHtml(p)}</option>`).join('')}
          <option value="__custom__" data-i18n="post_opt_custom_subject">${escapeHtml(t('post_opt_custom_subject'))}</option>
        </select>
      </div>

      <div class="gmeet-form-group" id="gmeet-custom-subject-group" style="display: none;">
        <input type="text" id="gmeet-input-custom-subject" class="gmeet-input" data-i18n-placeholder="post_placeholder_custom_subject" placeholder="${escapeHtml(t('post_placeholder_custom_subject'))}" />
      </div>

      <div class="gmeet-form-group">
        <label class="gmeet-form-label" for="gmeet-select-class" data-i18n="post_label_class">${escapeHtml(t('post_label_class'))}</label>
        <select id="gmeet-select-class" class="gmeet-select">
          ${classes.map(c => `<option value="${escapeHtml(c)}" ${c === savedClass ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
          <option value="" ${savedClass === '' ? 'selected' : ''} data-i18n="no_class">${escapeHtml(t('no_class'))}</option>
          <option value="__custom_class__" data-i18n="post_opt_custom_class">${escapeHtml(t('post_opt_custom_class'))}</option>
        </select>
      </div>

      <div class="gmeet-form-group" id="gmeet-custom-class-group" style="display: none;">
        <input type="text" id="gmeet-input-custom-class" class="gmeet-input" data-i18n-placeholder="post_placeholder_custom_class" placeholder="${escapeHtml(t('post_placeholder_custom_class'))}" />
      </div>

      <div class="gmeet-png-mini-bar">
        <button type="button" id="gmeet-btn-download-png" class="gmeet-btn-mini" data-i18n="post_btn_download_png">
          ${escapeHtml(t('post_btn_download_png'))}
        </button>
        <button type="button" id="gmeet-btn-copy-png" class="gmeet-btn-mini" data-i18n="post_btn_copy_png">
          ${escapeHtml(t('post_btn_copy_png'))}
        </button>
      </div>
      <div id="gmeet-png-feedback" class="gmeet-png-feedback" style="display: none;"></div>

      <div class="gmeet-side-actions">
        <button type="button" id="gmeet-btn-save-close" class="gmeet-btn-save" data-i18n="post_btn_save_close">
          ${escapeHtml(t('post_btn_save_close'))}
        </button>
        <button type="button" id="gmeet-btn-save-open" class="gmeet-btn-save-open" data-i18n="post_btn_save_open">
          ${escapeHtml(t('post_btn_save_open'))}
        </button>
      </div>
    `;

    document.body.appendChild(popupEl);

    const selectEl = popupEl.querySelector('#gmeet-select-subject');
    const customGroup = popupEl.querySelector('#gmeet-custom-subject-group');
    const customInput = popupEl.querySelector('#gmeet-input-custom-subject');

    const selectClassEl = popupEl.querySelector('#gmeet-select-class');
    const customClassGroup = popupEl.querySelector('#gmeet-custom-class-group');
    const customClassInput = popupEl.querySelector('#gmeet-input-custom-class');
    const pngFeedback = popupEl.querySelector('#gmeet-png-feedback');

    function readSelectedMeetingRecord() {
      let finalSubject = selectEl ? selectEl.value : (presets[0] || 'Інформатика');
      if (finalSubject === '__custom__') {
        finalSubject = (customInput ? customInput.value.trim() : '') || t('special_meeting');
      }

      let finalClass = selectClassEl ? selectClassEl.value : '';
      if (finalClass === '__custom_class__') {
        finalClass = customClassInput ? customClassInput.value.trim() : '';
      }

      currentMetadata = {
        subject: finalSubject,
        schoolClass: finalClass
      };

      try {
        localStorage.setItem('meet_last_subject', finalSubject);
        localStorage.setItem('meet_last_class', finalClass);
      } catch {}

      snapshot.subject = finalSubject;
      snapshot.schoolClass = finalClass;
      return { ...snapshot };
    }

    async function persistSelectionImmediately() {
      const updated = readSelectedMeetingRecord();
      if (typeof MeetStorage !== 'undefined') {
        await MeetStorage.saveMeeting(updated);
      }
      return updated;
    }

    // Зберігаємо початково вибрані предмет і клас одразу при появі попапу
    persistSelectionImmediately();

    selectEl?.addEventListener('change', () => {
      if (selectEl.value === '__custom__') {
        customGroup.style.display = 'block';
        customInput?.focus();
      } else {
        customGroup.style.display = 'none';
      }
      persistSelectionImmediately();
    });

    selectClassEl?.addEventListener('change', () => {
      if (selectClassEl.value === '__custom_class__') {
        customClassGroup.style.display = 'block';
        customClassInput?.focus();
      } else {
        customClassGroup.style.display = 'none';
      }
      persistSelectionImmediately();
    });

    customInput?.addEventListener('input', persistSelectionImmediately);
    customClassInput?.addEventListener('input', persistSelectionImmediately);

    // Перемикач мови всередині правого попапу
    popupEl.querySelectorAll('[data-lang-switch]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const lang = btn.getAttribute('data-lang-switch');
        if (typeof MeetI18n !== 'undefined') {
          await MeetI18n.setLang(lang);
          MeetI18n.applyToDOM(popupEl);
        }
      });
    });

    popupEl.querySelector('#gmeet-side-close-btn')?.addEventListener('click', async () => {
      await persistSelectionImmediately();
      popupEl.remove();
    });

    popupEl.querySelector('#gmeet-btn-download-png')?.addEventListener('click', async () => {
      const currentMeeting = await persistSelectionImmediately();
      if (typeof MeetingCardGenerator !== 'undefined') {
        MeetingCardGenerator.downloadPNG(currentMeeting);
        if (pngFeedback) {
          pngFeedback.style.display = 'block';
          pngFeedback.textContent = t('post_feedback_saved');
          pngFeedback.style.color = '#34d399';
        }
      }
    });

    popupEl.querySelector('#gmeet-btn-copy-png')?.addEventListener('click', async () => {
      const currentMeeting = await persistSelectionImmediately();
      if (typeof MeetingCardGenerator !== 'undefined') {
        try {
          await MeetingCardGenerator.copyToClipboard(currentMeeting);
          if (pngFeedback) {
            pngFeedback.style.display = 'block';
            pngFeedback.textContent = t('post_feedback_copied');
            pngFeedback.style.color = '#38bdf8';
          }
        } catch {
          MeetingCardGenerator.downloadPNG(currentMeeting);
          if (pngFeedback) {
            pngFeedback.style.display = 'block';
            pngFeedback.textContent = t('post_feedback_downloaded');
            pngFeedback.style.color = '#fbbf24';
          }
        }
      }
    });

    async function handleFinalSave(openDashboard = false) {
      const finalMeeting = readSelectedMeetingRecord();

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

      if (typeof MeetStorage !== 'undefined') {
        await MeetStorage.saveMeeting(finalMeeting);
      }

      popupEl.remove();

      if (openDashboard && typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          action: 'OPEN_DASHBOARD',
          meetingId: finalMeeting.id
        });
      }
    }

    popupEl.querySelector('#gmeet-btn-save-close')?.addEventListener('click', () => handleFinalSave(false));
    popupEl.querySelector('#gmeet-btn-save-open')?.addEventListener('click', () => handleFinalSave(true));
  }

  // Захист при раптовому закритті вкладки під час активного уроку
  window.addEventListener('beforeunload', () => {
    if (isMeetingActive && !hasEndedCurrentCall) {
      autoSaveSession();
    }
  });

  // Оновлювати HUD та попап при перемиканні мови у фоні
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes.meet_language && typeof MeetI18n !== 'undefined') {
        if (hudElement) MeetI18n.applyToDOM(hudElement);
        const sidePopup = document.getElementById('gmeet-tracker-side-popup');
        if (sidePopup) MeetI18n.applyToDOM(sidePopup);
      }
    });
  }

  setInterval(checkPageStatus, 1000);
  checkPageStatus();
})();
