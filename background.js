/**
 * background.js - Service Worker розширення
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Google Meet Attendance Tracker успішно встановлено.');
    // Ініціалізація дефолтних налаштувань
    chrome.storage.local.get(['meet_presets', 'meet_classes'], (res) => {
      const updates = {};
      if (!res.meet_presets) {
        updates.meet_presets = [
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
      }
      if (!res.meet_classes) {
        updates.meet_classes = [
          '1 клас', '2 клас', '3 клас', '4 клас', '5 клас',
          '6 клас', '7 клас', '8 клас', '9 клас', '10 клас', '11 клас'
        ];
      }
      if (Object.keys(updates).length > 0) {
        chrome.storage.local.set(updates);
      }
    });

    // Відкриваємо Dashboard при першому встановленні для ознайомлення
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  }
});

// Слухач повідомлень від content script або popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'OPEN_DASHBOARD') {
    const targetUrl = chrome.runtime.getURL('dashboard.html') + (request.meetingId ? `?id=${encodeURIComponent(request.meetingId)}` : '');
    
    // Шукаємо, чи вже відкрита вкладка з Dashboard
    chrome.tabs.query({ url: chrome.runtime.getURL('dashboard.html') + '*' }, (tabs) => {
      if (tabs && tabs.length > 0) {
        chrome.tabs.update(tabs[0].id, { url: targetUrl, active: true });
        if (tabs[0].windowId) {
          chrome.windows.update(tabs[0].windowId, { focused: true });
        }
      } else {
        chrome.tabs.create({ url: targetUrl });
      }
    });
    sendResponse({ success: true });
    return true;
  }
});
