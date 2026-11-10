/**
 * storage.js - Універсальний локальний модуль збереження (chrome.storage.local)
 * 100% гарантує доступ до спільних даних як з content script на meet.google.com,
 * так і зі сторінки розширення dashboard.html та popup.html.
 */

const MeetStorage = (() => {
  const STORAGE_KEY_MEETINGS = 'meet_attendance_records';
  const STORAGE_KEY_PRESETS = 'meet_presets';
  const STORAGE_KEY_CLASSES = 'meet_classes';

  const DEFAULT_PRESETS = [
    'Інформатика',
    'Математика',
    'Алгебра',
    'Геометрія',
    'Фізика',
    'Українська мова',
    'Українська література',
    'Англійська мова',
    'Історія України',
    'Біологія',
    'Хімія',
    'Географія',
    'Батьківські збори',
    'Класна година',
    'Робоча нарада'
  ];

  const DEFAULT_PRESETS_EN = [
    'Computer Science',
    'Mathematics',
    'Algebra',
    'Geometry',
    'Physics',
    'Ukrainian Language',
    'English Language',
    'History',
    'Biology',
    'Chemistry',
    'Geography',
    'Parent-Teacher Meeting',
    'Homeroom',
    'Team Standup'
  ];

  const DEFAULT_CLASSES = [
    '1 клас',
    '2 клас',
    '3 клас',
    '4 клас',
    '5 клас',
    '6 клас',
    '7 клас',
    '8 клас',
    '9 клас',
    '10 клас',
    '11 клас'
  ];

  const DEFAULT_CLASSES_EN = [
    'Grade 1',
    'Grade 2',
    'Grade 3',
    'Grade 4',
    'Grade 5',
    'Grade 6',
    'Grade 7',
    'Grade 8',
    'Grade 9',
    'Grade 10',
    'Grade 11'
  ];

  function getDefaultPresetsForCurrentLang() {
    if (typeof MeetI18n !== 'undefined' && MeetI18n.getLang() === 'en') {
      return DEFAULT_PRESETS_EN;
    }
    return DEFAULT_PRESETS;
  }

  function getDefaultClassesForCurrentLang() {
    if (typeof MeetI18n !== 'undefined' && MeetI18n.getLang() === 'en') {
      return DEFAULT_CLASSES_EN;
    }
    return DEFAULT_CLASSES;
  }

  // --- Пресети предметів ---
  async function getPresets() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEY_PRESETS], (res) => {
          if (res && Array.isArray(res[STORAGE_KEY_PRESETS]) && res[STORAGE_KEY_PRESETS].length > 0) {
            resolve(res[STORAGE_KEY_PRESETS]);
          } else {
            savePresets(DEFAULT_PRESETS).then(() => resolve(DEFAULT_PRESETS));
          }
        });
      } else {
        const raw = localStorage.getItem(STORAGE_KEY_PRESETS);
        resolve(raw ? JSON.parse(raw) : DEFAULT_PRESETS);
      }
    });
  }

  async function savePresets(presets) {
    const cleanList = Array.from(new Set(presets.map(p => String(p).trim()).filter(Boolean)));
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEY_PRESETS]: cleanList }, () => resolve(cleanList));
      } else {
        localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(cleanList));
        resolve(cleanList);
      }
    });
  }

  async function addPreset(presetName) {
    const list = await getPresets();
    const trimmed = String(presetName || '').trim();
    if (trimmed && !list.includes(trimmed)) {
      list.push(trimmed);
      list.sort((a, b) => a.localeCompare(b, 'uk'));
      await savePresets(list);
    }
    return list;
  }

  async function deletePreset(presetName) {
    const list = await getPresets();
    const updated = list.filter(p => p.toLowerCase() !== String(presetName || '').trim().toLowerCase());
    await savePresets(updated);
    return updated;
  }

  // --- Класи (1-11 класи) ---
  async function getClasses() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEY_CLASSES], (res) => {
          if (res && Array.isArray(res[STORAGE_KEY_CLASSES]) && res[STORAGE_KEY_CLASSES].length > 0) {
            resolve(res[STORAGE_KEY_CLASSES]);
          } else {
            saveClasses(DEFAULT_CLASSES).then(() => resolve(DEFAULT_CLASSES));
          }
        });
      } else {
        const raw = localStorage.getItem(STORAGE_KEY_CLASSES);
        resolve(raw ? JSON.parse(raw) : DEFAULT_CLASSES);
      }
    });
  }

  async function saveClasses(classList) {
    const cleanList = Array.from(new Set(classList.map(c => String(c).trim()).filter(Boolean)));
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEY_CLASSES]: cleanList }, () => resolve(cleanList));
      } else {
        localStorage.setItem(STORAGE_KEY_CLASSES, JSON.stringify(cleanList));
        resolve(cleanList);
      }
    });
  }

  async function addClass(className) {
    const list = await getClasses();
    const trimmed = String(className || '').trim();
    if (trimmed && !list.includes(trimmed)) {
      list.push(trimmed);
      await saveClasses(list);
    }
    return list;
  }

  /**
   * Очищує ім'я учасника від технічних лігатур іконок Material Icons,
   * дублювань для скрінрідерів та системних підписів Google Meet.
   */
  function sanitizeParticipantName(rawName) {
    if (!rawName) return '';
    let name = String(rawName).trim();

    // 1. Прибираємо назви іконок Material Icons (devices, mic_off, volume_up тощо)
    // Видаляємо лише суфікси у нижньому регістрі або окремі технічні токени, щоб не зачепити імена типу Michael/Pinchuk
    const iconTokens = [
      'devices', 'mic_off', 'volume_up', 'volume_off', 'more_vert',
      'push_pin', 'videocam_off', 'videocam', 'present_to_all',
      'hand_gesture', 'frame_person', 'visual_effects', 'closed_caption'
    ];
    iconTokens.forEach(token => {
      name = name.replace(new RegExp(token + '$', 'g'), '');
      name = name.replace(new RegExp('^' + token + '$', 'gi'), '');
      name = name.replace(new RegExp('\\s+' + token + '\\b', 'gi'), '');
    });

    // 2. Прибираємо службові приписки ролей Google Meet
    name = name.replace(/\s*\((Ви|You|You, presentation|Ви, презентація|Презентація|Presentation|Організатор|Host|Co-host|Співорганізатор)\)$/i, '');
    name = name.replace(/^(Ви|You)\s+/i, '');
    name = name.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

    // 3. Автоматичне усунення подвоєного імені (наприклад: "Діана ОхрименкоДіана Охрименко")
    for (let len = Math.floor(name.length / 2); len >= 3; len--) {
      const firstHalf = name.slice(0, len).trim();
      const secondHalf = name.slice(len).trim();
      if (firstHalf && firstHalf.length >= 3 && firstHalf === secondHalf) {
        name = firstHalf;
        break;
      }
    }

    return name.trim();
  }

  function cleanParticipantsMap(participantsMap) {
    if (!participantsMap || typeof participantsMap !== 'object') return {};
    const cleaned = {};
    for (const [key, p] of Object.entries(participantsMap)) {
      if (!p || typeof p !== 'object') continue;
      const cleanName = sanitizeParticipantName(p.name || key);
      if (cleanName && cleanName.length >= 2) {
        if (!cleaned[cleanName]) {
          cleaned[cleanName] = {
            ...p,
            name: cleanName,
            sessions: Array.isArray(p.sessions) ? p.sessions : []
          };
        } else {
          // Об'єднуємо дані, якщо один учень був записаний під кількома сирими ключами
          const existing = cleaned[cleanName];
          if (p.firstJoined && (!existing.firstJoined || new Date(p.firstJoined) < new Date(existing.firstJoined))) {
            existing.firstJoined = p.firstJoined;
          }
          if (p.lastSeen && (!existing.lastSeen || new Date(p.lastSeen) > new Date(existing.lastSeen))) {
            existing.lastSeen = p.lastSeen;
          }
          existing.totalSeconds = Math.max(existing.totalSeconds || 0, p.totalSeconds || 0);
          if (Array.isArray(p.sessions) && p.sessions.length > (existing.sessions || []).length) {
            existing.sessions = p.sessions;
          }
        }
      }
    }
    return cleaned;
  }

  // --- Зустрічі (Збереження у chrome.storage.local з підтримкою необмеженого обсягу) ---
  async function getAllMeetings() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEY_MEETINGS], (result) => {
          const raw = result ? result[STORAGE_KEY_MEETINGS] : null;
          let list = [];
          if (Array.isArray(raw)) {
            list = raw;
          } else if (raw && typeof raw === 'object') {
            list = Object.values(raw);
          }
          list.forEach(m => {
            if (m && m.participants) {
              m.participants = cleanParticipantsMap(m.participants);
              m.participantsCount = Object.keys(m.participants).length;
            }
          });
          list.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
          resolve(list);
        });
      } else {
        const raw = localStorage.getItem(STORAGE_KEY_MEETINGS);
        let list = [];
        try {
          list = raw ? JSON.parse(raw) : [];
        } catch {
          list = [];
        }
        if (!Array.isArray(list)) list = Object.values(list || {});
        list.forEach(m => {
          if (m && m.participants) {
            m.participants = cleanParticipantsMap(m.participants);
            m.participantsCount = Object.keys(m.participants).length;
          }
        });
        list.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
        resolve(list);
      }
    });
  }

  async function getMeeting(id) {
    const all = await getAllMeetings();
    return all.find(m => m.id === id) || null;
  }

  // Послідовна черга запису для уникнення гонитви даних (race conditions) у chrome.storage.local
  let writeQueue = Promise.resolve();
  function enqueueWrite(taskFn) {
    writeQueue = writeQueue.then(() => taskFn()).catch((err) => {
      console.error('[MeetStorage] Write error:', err);
    });
    return writeQueue;
  }

  async function saveMeeting(meeting, options = {}) {
    return enqueueWrite(async () => {
      const all = await getAllMeetings();
      const existingIndex = all.findIndex(m => m.id === meeting.id);
      const existing = existingIndex >= 0 ? all[existingIndex] : null;

      const mergedRawParticipants = existing
        ? { ...(existing.participants || {}), ...(meeting.participants || {}) }
        : (meeting.participants || {});
      const cleanParts = cleanParticipantsMap(mergedRawParticipants);

      // Якщо це фонове автозбереження, не перезаписуємо вже обраний користувачем предмет і клас дефолтним значенням
      let finalSubject = meeting.subject;
      let finalClass = meeting.schoolClass;
      if (options.isAutoSave && existing) {
        const isDefaultSub = !finalSubject || finalSubject === 'Загальна зустріч' || finalSubject === 'General Meeting';
        if (isDefaultSub && existing.subject && existing.subject !== 'Загальна зустріч' && existing.subject !== 'General Meeting') {
          finalSubject = existing.subject;
        }
        if (!finalClass && existing.schoolClass) {
          finalClass = existing.schoolClass;
        }
      }

      const cleanMeeting = {
        id: meeting.id || (existing && existing.id) || `meet_${meeting.meetingCode || 'unknown'}_${Date.now()}`,
        meetingCode: meeting.meetingCode || (existing && existing.meetingCode) || 'unknown',
        subject: finalSubject || (existing && existing.subject) || 'Загальна зустріч',
        schoolClass: finalClass !== undefined ? finalClass : ((existing && existing.schoolClass) || ''),
        customTitle: meeting.customTitle !== undefined ? meeting.customTitle : ((existing && existing.customTitle) || ''),
        notes: meeting.notes !== undefined ? meeting.notes : ((existing && existing.notes) || ''),
        startTime: meeting.startTime || (existing && existing.startTime) || new Date().toISOString(),
        endTime: meeting.endTime || (existing && existing.endTime) || new Date().toISOString(),
        durationSeconds: Math.max(existing ? (existing.durationSeconds || 0) : 0, meeting.durationSeconds || 0),
        participantsCount: Object.keys(cleanParts).length,
        participants: cleanParts,
        updatedAt: new Date().toISOString()
      };

      if (existingIndex >= 0) {
        all[existingIndex] = { ...existing, ...cleanMeeting };
      } else {
        all.unshift(cleanMeeting);
      }

      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ [STORAGE_KEY_MEETINGS]: all }, () => {
            resolve(cleanMeeting);
          });
        } else {
          localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(all));
          resolve(cleanMeeting);
        }
      });
    });
  }

  async function deleteMeeting(id) {
    const all = await getAllMeetings();
    const filtered = all.filter(m => m.id !== id);
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEY_MEETINGS]: filtered }, () => resolve(true));
      } else {
        localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify(filtered));
        resolve(true);
      }
    });
  }

  async function clearAllMeetings() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEY_MEETINGS]: [] }, () => resolve(true));
      } else {
        localStorage.setItem(STORAGE_KEY_MEETINGS, JSON.stringify([]));
        resolve(true);
      }
    });
  }

  async function exportAllData() {
    const meetings = await getAllMeetings();
    const presets = await getPresets();
    const classes = await getClasses();
    return {
      version: '1.2.0',
      exportedAt: new Date().toISOString(),
      presets,
      classes,
      meetings
    };
  }

  async function importData(importedObject) {
    if (!importedObject || typeof importedObject !== 'object') {
      throw new Error('Невалідний формат даних для імпорту');
    }
    if (Array.isArray(importedObject.presets)) {
      await savePresets(importedObject.presets);
    }
    if (Array.isArray(importedObject.classes)) {
      await saveClasses(importedObject.classes);
    }
    if (Array.isArray(importedObject.meetings)) {
      for (const meeting of importedObject.meetings) {
        if (meeting && meeting.id) {
          await saveMeeting(meeting);
        }
      }
    }
    return true;
  }

  return {
    getPresets,
    savePresets,
    addPreset,
    deletePreset,
    getClasses,
    saveClasses,
    addClass,
    saveMeeting,
    getMeeting,
    getAllMeetings,
    deleteMeeting,
    clearAllMeetings,
    exportAllData,
    importData,
    sanitizeParticipantName,
    cleanParticipantsMap,
    DEFAULT_PRESETS,
    DEFAULT_PRESETS_EN,
    DEFAULT_CLASSES,
    DEFAULT_CLASSES_EN,
    getDefaultPresetsForCurrentLang,
    getDefaultClassesForCurrentLang
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MeetStorage;
}
