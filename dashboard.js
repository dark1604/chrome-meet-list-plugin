/**
 * dashboard.js - Логіка сторінки локальної аналітики та журналу відвідуваності
 * Підтримує структуризацію за предметами, класами (1-11 класи) та окремими учнями.
 */

document.addEventListener('DOMContentLoaded', async () => {
  let allMeetings = [];
  let currentActiveMeeting = null;
  let allStudentsSet = new Set();
  let initialUrlParamHandled = false;

  // --- Елементи Вкладки 1: Всі заняття ---
  const meetingsContainer = document.getElementById('meetings-container');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search-input');
  const filterSubject = document.getElementById('filter-subject');
  const filterClass = document.getElementById('filter-class');
  const sortOrder = document.getElementById('sort-order');
  const btnRefresh = document.getElementById('btn-refresh');

  const statTotalMeetings = document.getElementById('stat-total-meetings');
  const statTotalStudents = document.getElementById('stat-total-students');
  const statTotalHours = document.getElementById('stat-total-hours');

  // --- Елементи Вкладки 2: За предметами ---
  const selectAnalyticsSubject = document.getElementById('select-analytics-subject');
  const statSubjectLessons = document.getElementById('stat-subject-lessons');
  const statSubjectTime = document.getElementById('stat-subject-time');
  const statSubjectAvgStudents = document.getElementById('stat-subject-avg-students');
  const subjectLessonsList = document.getElementById('subject-lessons-list');

  // --- Елементи Вкладки 3: За класами ---
  const selectAnalyticsClass = document.getElementById('select-analytics-class');
  const statClassLessons = document.getElementById('stat-class-lessons');
  const statClassStudentsCount = document.getElementById('stat-class-students-count');
  const statClassTotalTime = document.getElementById('stat-class-total-time');
  const classLessonsList = document.getElementById('class-lessons-list');

  // --- Елементи Вкладки 4: За учнями ---
  const selectAnalyticsStudent = document.getElementById('select-analytics-student');
  const btnExportStudentDossier = document.getElementById('btn-export-student-dossier');
  const studentDossierCard = document.getElementById('student-dossier-card');
  const dossierStudentName = document.getElementById('dossier-student-name');
  const dossierLessonsCount = document.getElementById('dossier-lessons-count');
  const dossierTotalTime = document.getElementById('dossier-total-time');
  const dossierAvgAttendance = document.getElementById('dossier-avg-attendance');
  const studentHistoryTbody = document.getElementById('student-history-tbody');

  // --- Модальне вікно звіту та редагування ---
  const detailModal = document.getElementById('detail-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const modalSubjectBadge = document.getElementById('modal-subject-badge');
  const modalClassBadge = document.getElementById('modal-class-badge');
  const modalTitle = document.getElementById('modal-title');
  const modalMeta = document.getElementById('modal-meta');
  const modalTableBody = document.getElementById('modal-table-body');
  const modalParticipantSearch = document.getElementById('modal-participant-search');
  const modalNotesSection = document.getElementById('modal-notes-section');
  const modalNotesText = document.getElementById('modal-notes-text');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnExportPng = document.getElementById('btn-export-png');
  const btnCopyPng = document.getElementById('btn-copy-png');
  const btnPrintReport = document.getElementById('btn-print-report');

  const btnToggleEdit = document.getElementById('btn-toggle-edit');
  const modalEditPanel = document.getElementById('modal-edit-panel');
  const editMeetingSubject = document.getElementById('edit-meeting-subject');
  const editMeetingClass = document.getElementById('edit-meeting-class');
  const editMeetingTitle = document.getElementById('edit-meeting-title');
  const editMeetingNotes = document.getElementById('edit-meeting-notes');
  const btnCancelEdit = document.getElementById('btn-cancel-edit');
  const btnSaveEdit = document.getElementById('btn-save-edit');

  // --- Пресети та класи ---
  const formAddPreset = document.getElementById('form-add-preset');
  const inputNewPreset = document.getElementById('input-new-preset');
  const presetsListEl = document.getElementById('presets-list');
  const btnResetPresets = document.getElementById('btn-reset-presets');

  const formAddClass = document.getElementById('form-add-class');
  const inputNewClass = document.getElementById('input-new-class');
  const classesListEl = document.getElementById('classes-list');
  const btnResetClasses = document.getElementById('btn-reset-classes');

  // --- Бекап ---
  const btnExportBackup = document.getElementById('btn-export-backup');
  const btnTriggerImport = document.getElementById('btn-trigger-import');
  const fileImportInput = document.getElementById('file-import-input');
  const btnClearDatabase = document.getElementById('btn-clear-database');

  // --- Навігація вкладками ---
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const targetTab = item.getAttribute('data-tab');
      document.getElementById(targetTab)?.classList.add('active');

      if (targetTab === 'subjects-tab') renderSubjectAnalytics();
      if (targetTab === 'classes-tab') renderClassAnalytics();
      if (targetTab === 'students-tab') renderStudentAnalytics();
    });
  });

  // --- Форматування ---
  function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0 хв';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remMins = mins % 60;
      return `${hours} год ${remMins} хв`;
    }
    return `${mins} хв ${secs} с`;
  }

  function formatDateTime(isoString) {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatTimeOnly(isoString) {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleTimeString('uk-UA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  // --- Головне завантаження даних ---
  async function loadData() {
    allMeetings = await MeetStorage.getAllMeetings();

    // Збираємо список усіх унікальних учнів
    allStudentsSet.clear();
    allMeetings.forEach(m => {
      if (m.participants) {
        Object.keys(m.participants).forEach(name => allStudentsSet.add(name));
      }
    });

    await updateFilterOptions();
    renderStatistics();
    renderMeetingsList();
    renderSubjectAnalytics();
    renderClassAnalytics();
    renderStudentAnalytics();
    renderPresetsList();
    renderClassesList();

    // Якщо модальне вікно звіту відкрите, оновлюємо його свіжими даними
    if (detailModal.style.display === 'flex' && currentActiveMeeting) {
      const updated = allMeetings.find(m => m.id === currentActiveMeeting.id);
      if (updated) {
        currentActiveMeeting = updated;
        renderParticipantTable();
      }
    }

    // Одноразова перевірка параметра ?id=meet_xxx в URL при першому відкритті
    if (!initialUrlParamHandled) {
      initialUrlParamHandled = true;
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get('id');
      if (targetId) {
        const targetMeeting = allMeetings.find(m => m.id === targetId);
        if (targetMeeting) {
          openMeetingDetails(targetMeeting);
        }
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }

  // Оновлення списків фільтрації зі збереженням поточного вибору користувача
  async function updateFilterOptions() {
    const presets = await MeetStorage.getPresets();
    const classes = await MeetStorage.getClasses();

    // Об'єднуємо пресети з фактично наявними предметами в базі
    const allSubjects = Array.from(new Set([
      ...presets,
      ...allMeetings.map(m => m.subject).filter(Boolean)
    ])).sort((a, b) => a.localeCompare(b, 'uk'));

    const allClasses = Array.from(new Set([
      ...classes,
      ...allMeetings.map(m => m.schoolClass).filter(Boolean)
    ]));

    // Зберігаємо поточні вибрані значення
    const currentSub = filterSubject.value;
    const currentCls = filterClass.value;
    const currentAnaSub = selectAnalyticsSubject.value;
    const currentAnaCls = selectAnalyticsClass.value;
    const currentAnaStu = selectAnalyticsStudent.value;

    // 1. Фільтр предметів у головній таблиці
    filterSubject.innerHTML = '<option value="">Всі предмети</option>';
    allSubjects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      if (p === currentSub) opt.selected = true;
      filterSubject.appendChild(opt);
    });

    // 2. Фільтр класів у головній таблиці
    filterClass.innerHTML = '<option value="">Всі класи</option>';
    allClasses.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === currentCls) opt.selected = true;
      filterClass.appendChild(opt);
    });

    // 3. Випадаючий список для вкладки "За предметами"
    selectAnalyticsSubject.innerHTML = '';
    allSubjects.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p;
      opt.textContent = p;
      if (p === currentAnaSub) opt.selected = true;
      selectAnalyticsSubject.appendChild(opt);
    });

    // 4. Випадаючий список для вкладки "За класами"
    selectAnalyticsClass.innerHTML = '';
    allClasses.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === currentAnaCls) opt.selected = true;
      selectAnalyticsClass.appendChild(opt);
    });

    // 5. Випадаючий список для вкладки "За учнями"
    selectAnalyticsStudent.innerHTML = '<option value="">-- Оберіть учня зі списку (' + allStudentsSet.size + ' учнів) --</option>';
    const sortedStudents = Array.from(allStudentsSet).sort((a, b) => a.localeCompare(b, 'uk'));
    sortedStudents.forEach(st => {
      const opt = document.createElement('option');
      opt.value = st;
      opt.textContent = st;
      if (st === currentAnaStu) opt.selected = true;
      selectAnalyticsStudent.appendChild(opt);
    });
  }

  function renderStatistics() {
    statTotalMeetings.textContent = allMeetings.length;
    statTotalStudents.textContent = allStudentsSet.size;

    let totalSeconds = 0;
    allMeetings.forEach(m => {
      totalSeconds += (m.durationSeconds || 0);
    });
    statTotalHours.textContent = formatDuration(totalSeconds);
  }

  // --- Рендеринг списку занять (Вкладка 1) ---
  function renderMeetingsList() {
    const query = searchInput.value.trim().toLowerCase();
    const subject = filterSubject.value;
    const schoolClass = filterClass.value;
    const sort = sortOrder.value;

    let filtered = allMeetings.filter(m => {
      if (subject && m.subject !== subject) return false;
      if (schoolClass && m.schoolClass !== schoolClass) return false;

      if (query) {
        const matchTitle = (m.customTitle || '').toLowerCase().includes(query);
        const matchSubject = (m.subject || '').toLowerCase().includes(query);
        const matchClass = (m.schoolClass || '').toLowerCase().includes(query);
        const matchCode = (m.meetingCode || '').toLowerCase().includes(query);
        const matchStudent = m.participants && Object.keys(m.participants).some(name => name.toLowerCase().includes(query));
        return matchTitle || matchSubject || matchClass || matchCode || matchStudent;
      }
      return true;
    });

    if (sort === 'newest') {
      filtered.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    } else if (sort === 'oldest') {
      filtered.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    } else if (sort === 'participants') {
      filtered.sort((a, b) => (b.participantsCount || 0) - (a.participantsCount || 0));
    }

    renderCardsIntoContainer(filtered, meetingsContainer);
    emptyState.style.display = filtered.length === 0 ? 'block' : 'none';
  }

  function renderCardsIntoContainer(meetingsArray, containerElement) {
    containerElement.innerHTML = '';

    if (meetingsArray.length === 0) {
      containerElement.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 24px; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: var(--radius-md);">
          Занять у цій категорії ще не зафіксовано.
        </div>
      `;
      return;
    }

    meetingsArray.forEach(m => {
      const card = document.createElement('div');
      card.className = 'meeting-card';

      const title = m.customTitle || m.subject || 'Загальна зустріч';
      const participantsCount = Object.keys(m.participants || {}).length;

      card.innerHTML = `
        <div class="card-top">
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <span class="subject-badge">${escapeHtml(m.subject || 'Загальна')}</span>
            ${m.schoolClass ? `<span class="class-badge">🏫 ${escapeHtml(m.schoolClass)}</span>` : ''}
          </div>
          <span style="font-size: 11px; color: var(--text-muted); font-family: monospace;">${escapeHtml(m.meetingCode)}</span>
        </div>

        <h3 class="card-title">${escapeHtml(title)}</h3>

        <div class="card-meta-list">
          <div class="meta-item">
            <span>📅</span>
            <span>${formatDateTime(m.startTime)}</span>
          </div>
          <div class="meta-item">
            <span>⏱️</span>
            <span>Тривалість: <b>${formatDuration(m.durationSeconds)}</b></span>
          </div>
          <div class="meta-item">
            <span>👥</span>
            <span>Присутніх: <b>${participantsCount}</b> учнів</span>
          </div>
        </div>

        <div class="card-actions">
          <button class="btn btn-primary btn-sm btn-view-report" style="flex: 1;">
            📊 Звіт
          </button>
          <button class="btn btn-secondary btn-sm btn-card-png" title="Завантажити графічну PNG-картку уроку">
            📷
          </button>
          <button class="btn btn-secondary btn-sm btn-quick-export" title="Експорт у Excel (CSV)">
            📥
          </button>
          <button class="btn btn-danger btn-sm btn-delete-meeting" title="Видалити запис">
            🗑️
          </button>
        </div>
      `;

      card.querySelector('.btn-view-report').addEventListener('click', () => openMeetingDetails(m));
      card.querySelector('.btn-card-png').addEventListener('click', () => {
        if (typeof MeetingCardGenerator !== 'undefined') {
          MeetingCardGenerator.downloadPNG(m);
        }
      });
      card.querySelector('.btn-quick-export').addEventListener('click', () => exportMeetingToCSV(m));
      card.querySelector('.btn-delete-meeting').addEventListener('click', async () => {
        if (confirm(`Видалити запис уроку "${title}" від ${formatDateTime(m.startTime)}?`)) {
          await MeetStorage.deleteMeeting(m.id);
          await loadData();
        }
      });

      containerElement.appendChild(card);
    });
  }

  // --- Вкладка 2: Аналітика за предметами ---
  function renderSubjectAnalytics() {
    const selectedSubject = selectAnalyticsSubject.value;
    if (!selectedSubject) return;

    const subjectMeetings = allMeetings.filter(m => m.subject === selectedSubject);

    let totalSec = 0;
    let totalStudentsSum = 0;

    subjectMeetings.forEach(m => {
      totalSec += (m.durationSeconds || 0);
      totalStudentsSum += Object.keys(m.participants || {}).length;
    });

    const avgStudents = subjectMeetings.length > 0 ? Math.round(totalStudentsSum / subjectMeetings.length) : 0;

    statSubjectLessons.textContent = subjectMeetings.length;
    statSubjectTime.textContent = formatDuration(totalSec);
    statSubjectAvgStudents.textContent = avgStudents;

    renderCardsIntoContainer(subjectMeetings, subjectLessonsList);
  }

  selectAnalyticsSubject.addEventListener('change', renderSubjectAnalytics);

  // --- Вкладка 3: Аналітика за класами (1-11 класи) ---
  function renderClassAnalytics() {
    const selectedClass = selectAnalyticsClass.value;
    if (!selectedClass) return;

    const classMeetings = allMeetings.filter(m => m.schoolClass === selectedClass);

    let totalSec = 0;
    const classStudentsSet = new Set();

    classMeetings.forEach(m => {
      totalSec += (m.durationSeconds || 0);
      if (m.participants) {
        Object.keys(m.participants).forEach(name => classStudentsSet.add(name));
      }
    });

    statClassLessons.textContent = classMeetings.length;
    statClassStudentsCount.textContent = classStudentsSet.size;
    statClassTotalTime.textContent = formatDuration(totalSec);

    renderCardsIntoContainer(classMeetings, classLessonsList);
  }

  selectAnalyticsClass.addEventListener('change', renderClassAnalytics);

  // --- Вкладка 4: Аналітика за конкретним учнем ---
  function renderStudentAnalytics() {
    const studentName = selectAnalyticsStudent.value;

    if (!studentName) {
      studentDossierCard.style.display = 'none';
      btnExportStudentDossier.style.display = 'none';
      return;
    }

    studentDossierCard.style.display = 'block';
    btnExportStudentDossier.style.display = 'inline-flex';
    dossierStudentName.textContent = studentName;

    const attendedMeetings = [];
    let totalStudentSec = 0;
    let attendancePercentSum = 0;

    allMeetings.forEach(m => {
      if (m.participants && m.participants[studentName]) {
        const pData = m.participants[studentName];
        attendedMeetings.push({ meeting: m, pData });
        totalStudentSec += (pData.totalSeconds || 0);

        const meetingDuration = Math.max(1, m.durationSeconds || 1);
        const percent = Math.min(100, Math.round((pData.totalSeconds / meetingDuration) * 100));
        attendancePercentSum += percent;
      }
    });

    const avgPercent = attendedMeetings.length > 0 ? Math.round(attendancePercentSum / attendedMeetings.length) : 0;

    dossierLessonsCount.textContent = attendedMeetings.length;
    dossierTotalTime.textContent = formatDuration(totalStudentSec);
    dossierAvgAttendance.textContent = `${avgPercent}%`;

    studentHistoryTbody.innerHTML = '';

    attendedMeetings.forEach(item => {
      const m = item.meeting;
      const p = item.pData;
      const mDuration = Math.max(1, m.durationSeconds || 1);
      const percent = Math.min(100, Math.round((p.totalSeconds / mDuration) * 100));

      let statusClass = 'status-present';
      let statusText = 'Присутній';
      if (percent < 25) {
        statusClass = 'status-short';
        statusText = 'Короткочасно';
      } else if (percent < 75) {
        statusClass = 'status-late';
        statusText = 'Частково';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${formatDateTime(m.startTime)}</td>
        <td><b>${escapeHtml(m.subject)}</b></td>
        <td><span class="class-badge" style="font-size: 11px;">${escapeHtml(m.schoolClass || '—')}</span></td>
        <td>${formatTimeOnly(p.firstJoined)}</td>
        <td>${formatTimeOnly(p.lastSeen)}</td>
        <td><b>${formatDuration(p.totalSeconds)}</b></td>
        <td>
          <div class="progress-container">
            <span style="font-size: 11px; font-weight: bold;">${percent}%</span>
          </div>
        </td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      `;
      studentHistoryTbody.appendChild(tr);
    });

    if (attendedMeetings.length === 0) {
      studentHistoryTbody.innerHTML = `
        <tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 18px;">Цей учень ще не відвідував жодного заняття.</td></tr>
      `;
    }
  }

  selectAnalyticsStudent.addEventListener('change', renderStudentAnalytics);

  btnExportStudentDossier.addEventListener('click', () => {
    const studentName = selectAnalyticsStudent.value;
    if (!studentName) return;

    let csvContent = '\uFEFF';
    csvContent += `Персональний табель відвідуваності учня: "${studentName}"\n`;
    csvContent += `Згенеровано: ${new Date().toLocaleString('uk-UA')}\n\n`;
    csvContent += `"Дата";"Предмет";"Клас";"Перший вхід";"Останній вихід";"Час на уроці";"Відсоток";"Статус"\n`;

    allMeetings.forEach(m => {
      if (m.participants && m.participants[studentName]) {
        const p = m.participants[studentName];
        const mDuration = Math.max(1, m.durationSeconds || 1);
        const percent = Math.min(100, Math.round((p.totalSeconds / mDuration) * 100));
        let status = percent >= 75 ? 'Присутній' : (percent < 25 ? 'Короткочасно' : 'Частково');

        const row = [
          `"${formatDateTime(m.startTime)}"`,
          `"${m.subject.replace(/"/g, '""')}"`,
          `"${(m.schoolClass || '').replace(/"/g, '""')}"`,
          `"${formatTimeOnly(p.firstJoined)}"`,
          `"${formatTimeOnly(p.lastSeen)}"`,
          `"${formatDuration(p.totalSeconds)}"`,
          `"${percent}%"`,
          `"${status}"`
        ];
        csvContent += row.join(';') + '\n';
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, `Табель_${studentName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
  });

  // --- Детальний звіт зустрічі у модальному вікні ---
  function openMeetingDetails(meeting) {
    currentActiveMeeting = meeting;
    modalEditPanel.style.display = 'none';
    refreshModalHeader();
    renderParticipantTable();
    detailModal.style.display = 'flex';
  }

  function refreshModalHeader() {
    if (!currentActiveMeeting) return;
    modalSubjectBadge.textContent = currentActiveMeeting.subject || 'Загальна';

    if (currentActiveMeeting.schoolClass) {
      modalClassBadge.style.display = 'inline-block';
      modalClassBadge.textContent = `🏫 ${currentActiveMeeting.schoolClass}`;
    } else {
      modalClassBadge.style.display = 'none';
    }

    modalTitle.textContent = currentActiveMeeting.customTitle || currentActiveMeeting.subject || 'Зустріч Google Meet';

    const pCount = Object.keys(currentActiveMeeting.participants || {}).length;
    modalMeta.innerHTML = `
      Код: <b>${escapeHtml(currentActiveMeeting.meetingCode)}</b> • 
      Дата: <b>${formatDateTime(currentActiveMeeting.startTime)}</b> • 
      Загальний час: <b>${formatDuration(currentActiveMeeting.durationSeconds)}</b> • 
      Всього учнів: <b>${pCount}</b>
    `;

    if (currentActiveMeeting.notes) {
      modalNotesSection.style.display = 'block';
      modalNotesText.textContent = currentActiveMeeting.notes;
    } else {
      modalNotesSection.style.display = 'none';
    }
  }

  // Редагування уроку з модального вікна
  btnToggleEdit?.addEventListener('click', async () => {
    if (!currentActiveMeeting) return;
    if (modalEditPanel.style.display === 'block') {
      modalEditPanel.style.display = 'none';
      return;
    }

    const presets = await MeetStorage.getPresets();
    const classes = await MeetStorage.getClasses();

    const subjectsList = Array.from(new Set([...presets, currentActiveMeeting.subject].filter(Boolean)));
    const classesList = Array.from(new Set([...classes, currentActiveMeeting.schoolClass].filter(Boolean)));

    editMeetingSubject.innerHTML = '';
    subjectsList.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      if (s === currentActiveMeeting.subject) opt.selected = true;
      editMeetingSubject.appendChild(opt);
    });

    editMeetingClass.innerHTML = '<option value="">(Без класу)</option>';
    classesList.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      if (c === currentActiveMeeting.schoolClass) opt.selected = true;
      editMeetingClass.appendChild(opt);
    });

    editMeetingTitle.value = currentActiveMeeting.customTitle || '';
    editMeetingNotes.value = currentActiveMeeting.notes || '';
    modalEditPanel.style.display = 'block';
  });

  btnCancelEdit?.addEventListener('click', () => {
    modalEditPanel.style.display = 'none';
  });

  btnSaveEdit?.addEventListener('click', async () => {
    if (!currentActiveMeeting) return;
    currentActiveMeeting.subject = editMeetingSubject.value || 'Загальна зустріч';
    currentActiveMeeting.schoolClass = editMeetingClass.value || '';
    currentActiveMeeting.customTitle = editMeetingTitle.value.trim();
    currentActiveMeeting.notes = editMeetingNotes.value.trim();

    await MeetStorage.saveMeeting(currentActiveMeeting);
    modalEditPanel.style.display = 'none';
    refreshModalHeader();
    await loadData();
  });

  function renderParticipantTable() {
    if (!currentActiveMeeting) return;

    const participantsMap = currentActiveMeeting.participants || {};
    const list = Object.values(participantsMap);
    const filterQuery = (modalParticipantSearch.value || '').trim().toLowerCase();
    const meetingDuration = Math.max(1, currentActiveMeeting.durationSeconds || 1);
    const meetingStartMs = new Date(currentActiveMeeting.startTime).getTime();
    const meetingEndMs = new Date(currentActiveMeeting.endTime || Date.now()).getTime();

    list.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'uk'));

    modalTableBody.innerHTML = '';

    let index = 1;
    list.forEach(p => {
      if (filterQuery && !p.name.toLowerCase().includes(filterQuery)) return;

      const totalSec = p.totalSeconds || 0;
      const attendancePercent = Math.min(100, Math.round((totalSec / meetingDuration) * 100));

      let statusClass = 'status-present';
      let statusText = 'Був увесь час';

      const firstJoinMs = new Date(p.firstJoined).getTime();
      const lastSeenMs = new Date(p.lastSeen).getTime();

      const lateSeconds = Math.round((firstJoinMs - meetingStartMs) / 1000);
      const earlyLeaveSeconds = Math.round((meetingEndMs - lastSeenMs) / 1000);

      if (attendancePercent < 25) {
        statusClass = 'status-short';
        statusText = 'Короткочасно';
      } else if (earlyLeaveSeconds > 300) {
        statusClass = 'status-early';
        statusText = 'Вийшов раніше';
      } else if (lateSeconds > 300) {
        statusClass = 'status-late';
        statusText = 'Запізнився';
      }

      let barColor = '#10b981';
      if (attendancePercent < 40) barColor = '#ef4444';
      else if (attendancePercent < 75) barColor = '#f59e0b';

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="color: var(--text-muted);">${index++}</td>
        <td>
          <a href="#" class="student-link" style="color: #60a5fa; text-decoration: none; font-weight: 600;">
            ${escapeHtml(p.name)}
          </a>
        </td>
        <td>${formatTimeOnly(p.firstJoined)}</td>
        <td>${formatTimeOnly(p.lastSeen)}</td>
        <td><b>${formatDuration(totalSec)}</b></td>
        <td>
          <div class="progress-container">
            <div class="progress-bar-bg">
              <div class="progress-bar-fill" style="width: ${attendancePercent}%; background-color: ${barColor};"></div>
            </div>
            <span style="font-size: 11px; font-weight: bold; min-width: 35px;">${attendancePercent}%</span>
          </div>
        </td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      `;

      tr.querySelector('.student-link').addEventListener('click', (e) => {
        e.preventDefault();
        detailModal.style.display = 'none';
        navItems.forEach(n => n.classList.remove('active'));
        tabPanes.forEach(tp => tp.classList.remove('active'));

        const studentsTabBtn = document.querySelector('[data-tab="students-tab"]');
        studentsTabBtn?.classList.add('active');
        document.getElementById('students-tab')?.classList.add('active');

        selectAnalyticsStudent.value = p.name;
        renderStudentAnalytics();
      });

      modalTableBody.appendChild(tr);
    });

    if (modalTableBody.children.length === 0) {
      modalTableBody.innerHTML = `
        <tr><td colspan="7" style="text-align: center; padding: 20px; color: var(--text-muted);">Учнів не знайдено</td></tr>
      `;
    }
  }

  // --- Експорт у CSV ---
  function exportMeetingToCSV(meeting) {
    if (!meeting) return;

    const participants = Object.values(meeting.participants || {});
    participants.sort((a, b) => a.name.localeCompare(b.name, 'uk'));
    const meetingDuration = Math.max(1, meeting.durationSeconds || 1);

    let csvContent = '\uFEFF';
    csvContent += `Звіт відвідуваності: ${meeting.subject} ${meeting.schoolClass ? `(${meeting.schoolClass})` : ''} - ${meeting.customTitle || ''}\n`;
    csvContent += `Код зустрічі: ${meeting.meetingCode}\n`;
    csvContent += `Дата та час: ${formatDateTime(meeting.startTime)}\n`;
    csvContent += `Загальна тривалість: ${formatDuration(meeting.durationSeconds)}\n`;
    if (meeting.notes) csvContent += `Нотатки: "${meeting.notes.replace(/"/g, '""')}"\n`;
    csvContent += `\n`;

    csvContent += `"№";"Ім'я учня";"Перший вхід";"Останній вихід";"Час на занятті";"Час у секундах";"Відсоток";"Статус"\n`;

    participants.forEach((p, idx) => {
      const totalSec = p.totalSeconds || 0;
      const percent = Math.min(100, Math.round((totalSec / meetingDuration) * 100));
      let status = percent >= 75 ? 'Присутній' : (percent < 25 ? 'Короткочасно' : 'Частково');

      const row = [
        idx + 1,
        `"${p.name.replace(/"/g, '""')}"`,
        `"${formatTimeOnly(p.firstJoined)}"`,
        `"${formatTimeOnly(p.lastSeen)}"`,
        `"${formatDuration(totalSec)}"`,
        totalSec,
        `"${percent}%"`,
        `"${status}"`
      ];
      csvContent += row.join(';') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const classPart = meeting.schoolClass ? `_${meeting.schoolClass}` : '';
    const filename = `Звіт_${meeting.subject}${classPart}_${new Date(meeting.startTime).toISOString().slice(0, 10)}.csv`;
    downloadBlob(blob, filename);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // --- Керування заготовками предметів та класів ---
  async function renderPresetsList() {
    const presets = await MeetStorage.getPresets();
    presetsListEl.innerHTML = '';
    presets.forEach(preset => {
      const chip = document.createElement('div');
      chip.className = 'preset-chip';
      chip.innerHTML = `
        <span>${escapeHtml(preset)}</span>
        <span class="preset-chip-remove" title="Видалити">&times;</span>
      `;
      chip.querySelector('.preset-chip-remove').addEventListener('click', async () => {
        await MeetStorage.deletePreset(preset);
        await updateFilterOptions();
        await renderPresetsList();
      });
      presetsListEl.appendChild(chip);
    });
  }

  async function renderClassesList() {
    const classes = await MeetStorage.getClasses();
    classesListEl.innerHTML = '';
    classes.forEach(c => {
      const chip = document.createElement('div');
      chip.className = 'preset-chip';
      chip.innerHTML = `
        <span>🏫 ${escapeHtml(c)}</span>
        <span class="preset-chip-remove" title="Видалити">&times;</span>
      `;
      chip.querySelector('.preset-chip-remove').addEventListener('click', async () => {
        const list = await MeetStorage.getClasses();
        const updated = list.filter(item => item !== c);
        await MeetStorage.saveClasses(updated);
        await updateFilterOptions();
        await renderClassesList();
      });
      classesListEl.appendChild(chip);
    });
  }

  formAddPreset.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = inputNewPreset.value.trim();
    if (val) {
      await MeetStorage.addPreset(val);
      inputNewPreset.value = '';
      await updateFilterOptions();
      await renderPresetsList();
    }
  });

  btnResetPresets.addEventListener('click', async () => {
    if (confirm('Скинути предмети до стандартних?')) {
      await MeetStorage.savePresets(MeetStorage.DEFAULT_PRESETS);
      await updateFilterOptions();
      await renderPresetsList();
    }
  });

  formAddClass.addEventListener('submit', async (e) => {
    e.preventDefault();
    const val = inputNewClass.value.trim();
    if (val) {
      await MeetStorage.addClass(val);
      inputNewClass.value = '';
      await updateFilterOptions();
      await renderClassesList();
    }
  });

  btnResetClasses.addEventListener('click', async () => {
    if (confirm('Відновити стандартні класи з 1 по 11 клас?')) {
      await MeetStorage.saveClasses(MeetStorage.DEFAULT_CLASSES);
      await updateFilterOptions();
      await renderClassesList();
    }
  });

  // --- Бекап та очищення ---
  btnExportBackup.addEventListener('click', async () => {
    const backup = await MeetStorage.exportAllData();
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    downloadBlob(blob, `MeetAttendance_Backup_${new Date().toISOString().slice(0, 10)}.json`);
  });

  btnTriggerImport.addEventListener('click', () => fileImportInput.click());

  fileImportInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target.result);
        await MeetStorage.importData(importedData);
        alert('Дані успішно імпортовано!');
        await loadData();
      } catch (err) {
        alert('Помилка імпорту: ' + err.message);
      }
    };
    reader.readAsText(file);
    fileImportInput.value = '';
  });

  btnClearDatabase.addEventListener('click', async () => {
    const code = prompt('Введіть "ВИДАЛИТИ" для повного очищення бази:');
    if (code === 'ВИДАЛИТИ') {
      await MeetStorage.clearAllMeetings();
      alert('Базу очищено.');
      await loadData();
    }
  });

  // --- Слухачі фільтрів ---
  searchInput.addEventListener('input', renderMeetingsList);
  filterSubject.addEventListener('change', renderMeetingsList);
  filterClass.addEventListener('change', renderMeetingsList);
  sortOrder.addEventListener('change', renderMeetingsList);
  btnRefresh.addEventListener('click', loadData);

  modalParticipantSearch.addEventListener('input', renderParticipantTable);
  btnCloseModal.addEventListener('click', () => detailModal.style.display = 'none');
  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) detailModal.style.display = 'none';
  });

  btnExportPng?.addEventListener('click', () => {
    if (currentActiveMeeting && typeof MeetingCardGenerator !== 'undefined') {
      MeetingCardGenerator.downloadPNG(currentActiveMeeting);
    }
  });

  btnCopyPng?.addEventListener('click', async () => {
    if (!currentActiveMeeting || typeof MeetingCardGenerator === 'undefined') return;
    try {
      await MeetingCardGenerator.copyToClipboard(currentActiveMeeting);
      const originalText = btnCopyPng.innerHTML;
      btnCopyPng.innerHTML = '✅ Скопійовано!';
      setTimeout(() => { btnCopyPng.innerHTML = originalText; }, 2000);
    } catch {
      MeetingCardGenerator.downloadPNG(currentActiveMeeting);
    }
  });

  btnExportCsv.addEventListener('click', () => {
    if (currentActiveMeeting) exportMeetingToCSV(currentActiveMeeting);
  });

  btnPrintReport.addEventListener('click', () => window.print());

  function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  // Автоматичне оновлення даних при змінах у фоні
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        loadData();
      }
    });
  }

  await loadData();
});
