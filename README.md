# 🎓 Google Meet Attendance & Lesson Tracker

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-2563eb?style=flat-square&logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![100% Local Storage](https://img.shields.io/badge/Storage-100%25_Local-10b981?style=flat-square)](manifest.json)
[![Localization](https://img.shields.io/badge/i18n-EN_%7C_UA-8b5cf6?style=flat-square)](i18n.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-f59e0b?style=flat-square)](LICENSE)

A privacy-first, 100% local browser extension for Chromium-based browsers (**Google Chrome**, **Opera GX**, **Microsoft Edge**, **Brave**) built for teachers, educators, and team leads hosting sessions in **Google Meet**.

It automatically tracks participant attendance in real time, organizes session logs by **Subjects**, **School Grades (1–11)**, and **Individual Student Dossiers**, supports instant **English (`EN`) / Ukrainian (`UA`)** UI localization, and generates high-resolution **PNG summary cards** and **Excel/CSV reports** with a single click.

> 🇺🇦 **[Короткий опис українською мовою доступний внизу сторінки ↓](#-короткий-опис-українською)**

---

## ✨ Key Features

- 🔒 **100% Local & Private (Zero-Cloud):** All attendance records are stored strictly on your computer (`chrome.storage.local` with `unlimitedStorage`). No external servers, no accounts, and zero third-party data sharing.
- 🌐 **Bilingual Interface (`EN` / `UA`):** Instant language switching between **English** and **Ukrainian** across the Dashboard, Toolbar Popup, Google Meet HUD, Post-Meeting Modal, and exported PNG/CSV reports.
- 🎯 **Smart Active-Call Detection:** Tracking starts **strictly when you enter the active meeting room** with students (the camera/microphone preview lobby screen is automatically ignored).
- 🧹 **DOM Name Sanitizer & Session Merging:** Automatically strips Google Material Symbols icon ligatures (`devices`, `mic_off`, `more_vert`, `keep`) and duplicate accessibility labels from Google Meet tiles, and merges multiple reconnect sessions per student.
- 🖥️ **Background Tab Resilience:** Continues tracking even when you switch browser tabs or present slides in other applications.
- 🏷️ **Post-Meeting Classification Modal:**
  - Select a **Subject** from customizable presets or add a new subject on the fly.
  - Select a **Grade (Grades 1–11)** or custom group (e.g., *8-A*).
  - Add a **Lesson Topic** and **Teacher's Quick Note / Homework**.
- 📸 **Instant Visual PNG Card Export (1200×700 Retina):**
  - Download a clean summary card as `.png` or **copy it directly to your clipboard (`Ctrl+V`)** to paste into Telegram, Viber, Slack, or Google Classroom.
- 📊 **4-View Local Analytics Dashboard (`dashboard.html`):**
  1. 📋 **All Sessions** — Full chronological attendance log with search, subject/grade filters, and inline metadata editing.
  2. 📚 **By Subject** — Cumulative metrics and session history per discipline.
  3. 🏫 **By Grade (1–11)** — Attendance breakdown for any specific class across all subjects.
  4. 👤 **By Student** — Individual student dossier (attendance rate, total time, arrival/departure timestamps, and individual CSV report card export).
- 💾 **Data Export & Backup:**
  - Export to **Excel / CSV** (`UTF-8 BOM` encoded).
  - Print-ready layout / **Save as PDF**.
  - Full **JSON Database Backup & Restore**.

---

## 🗂️ Project Structure

```text
chrome-meet-list-plugin/
├── manifest.json        # Extension configuration (Manifest V3)
├── i18n.js              # Bilingual localization engine & dictionary (EN / UA)
├── storage.js           # Local storage module (chrome.storage.local) & name sanitizer
├── background.js        # Service Worker (preset initialization & tab routing)
├── content.js           # Google Meet DOM tracker, draggable HUD & post-meeting modal
├── content.css          # Styles for in-call HUD widget and post-meeting modal
├── card-generator.js    # HTML5 Canvas Retina PNG summary card generator
├── dashboard.html       # Standalone analytics dashboard & attendance log
├── dashboard.css        # Dashboard styles (Dark UI + Print CSS)
├── dashboard.js         # Dashboard logic, 4 analytical views, inline editor & exports
├── popup.html           # Toolbar popup layout
├── popup.css            # Toolbar popup styles
├── popup.js             # Quick status & recent sessions viewer
└── icons/               # Extension icons (16x16, 32x32, 48x48, 128x128)
```

---

## 🚀 Installation (Chrome / Opera GX / Edge / Brave)

1. Clone or download this repository to your computer:
   ```bash
   git clone https://github.com/dark1604/chrome-meet-list-plugin.git
   ```
2. Open the Extensions management page in your browser:
   - **Google Chrome:** `chrome://extensions/`
   - **Opera / Opera GX:** `opera://extensions/`
   - **Microsoft Edge:** `edge://extensions/`
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** (Завантажити розпаковане розширення).
5. Select the `chrome-meet-list-plugin` folder.
6. Pin **Meet Tracker** to your browser toolbar (puzzle icon 🧩 → pin 📌).

---

## 💡 How to Use

1. **Join a Call:** Open a meeting on `https://meet.google.com/...`. While you configure your camera and microphone in the lobby, the extension waits. As soon as you click **Join now** and enter the active call, a draggable **HUD widget** appears in the top-right corner with a live timer and student counter.
2. **During the Lesson:** Participants are recorded automatically. For large classes (15+ students where not all video tiles fit on screen), click **📋 People** on the HUD widget once to open the participants side panel and capture everyone.
3. **End of Lesson:** When you leave the call, the **Post-Meeting Modal** pops up:
   - Pick the **Subject** and **Grade (1–11)**;
   - Optionally download or **copy the PNG summary card** (`Ctrl+V`);
   - Click **Save to Log** or **Save & Open Report**.
4. **Switch Language (`UA` / `EN`):** Use the `UA | EN` toggle in the Dashboard sidebar, Toolbar Popup, or Post-Meeting Modal at any time.

---

## 🇺🇦 Короткий опис українською

**Google Meet Attendance & Lesson Tracker** — це повністю локальне розширення для браузерів **Google Chrome**, **Opera GX** та **Microsoft Edge**, створене для автоматичного обліку відвідуваності уроків і зустрічей у Google Meet.

### Головні переваги:
- **100% локальне збереження:** Усі дані зберігаються виключно на вашому комп'ютері (`chrome.storage.local`) без жодних хмарних сервісів.
- **Двомовний інтерфейс (`UA` / `EN`):** Миттєве перемикання між українською та англійською мовами у журналі, спливаючому меню, вікні завершення уроку та на PNG/CSV-звітах.
- **Точний старт запису:** Відлік часу та фіксація учнів починаються **суворо після входу в активну кімнату уроку** (екран налаштування камери та мікрофона в лобі ігнорується).
- **Чисті імена учасників:** Автоматичне очищення імен від системних іконок Google Meet (`devices`, `mic_off` тощо) та склеєних дублікатів.
- **Швидка PNG-картка та Excel-звіти:** Після завершення уроку плагін пропонує обрати **Предмет**, **Клас (1–11)**, додати тему/ДЗ і в один клік завантажити або скопіювати в буфер обміну (`Ctrl+V`) графічну **PNG-картку підсумків**, або відкрити розширений журнал аналітики (за предметами, класами та кожним учнем окремо).

### Швидке встановлення:
1. Відкрийте `chrome://extensions/` (або `opera://extensions/`).
2. Увімкніть **«Режим розробника» (Developer mode)**.
3. Натисніть **«Завантажити розпаковане розширення» (Load unpacked)** та оберіть папку проєкту.

---

## 📄 License

Distributed under the [MIT License](LICENSE).
