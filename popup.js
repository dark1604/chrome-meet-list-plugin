/**
 * popup.js - Швидке спливаюче вікно плагіна
 */

document.addEventListener('DOMContentLoaded', async () => {
  const btnOpenDashboard = document.getElementById('btn-open-dashboard');
  const recentList = document.getElementById('recent-list');
  const statusDesc = document.getElementById('status-desc');

  // Відкриття панелі Dashboard
  btnOpenDashboard.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });

  // Перевірка активної вкладки (чи відкритий Google Meet)
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0] && tabs[0].url) {
      const match = tabs[0].url.match(/([a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3})/i);
      if (match && match[1]) {
        statusDesc.textContent = `🟢 Відстеження кімнати: ${match[1].toLowerCase()}`;
        statusDesc.style.color = '#34d399';
      }
    }
  });

  // Завантаження останніх 3 зустрічей
  try {
    const meetings = await MeetStorage.getAllMeetings();
    if (meetings && meetings.length > 0) {
      recentList.innerHTML = '';
      const recents = meetings.slice(0, 3);

      recents.forEach(m => {
        const item = document.createElement('div');
        item.className = 'recent-item';

        const title = m.customTitle || m.subject || 'Зустріч Meet';
        const classBadge = m.schoolClass ? ` [${escapeHtml(m.schoolClass)}]` : '';
        const pCount = Object.keys(m.participants || {}).length;
        const dateStr = new Date(m.startTime).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' });

        item.innerHTML = `
          <div>
            <div class="recent-item-title">${escapeHtml(title)}${classBadge}</div>
            <div class="recent-item-meta">${dateStr} • ${escapeHtml(m.subject)} • ${escapeHtml(m.meetingCode)}</div>
          </div>
          <div style="font-weight: 600; font-size: 11px; color: #38bdf8;">
            👥 ${pCount}
          </div>
        `;

        item.addEventListener('click', () => {
          chrome.tabs.create({
            url: chrome.runtime.getURL(`dashboard.html?id=${encodeURIComponent(m.id)}`)
          });
        });

        recentList.appendChild(item);
      });
    }
  } catch (err) {
    console.error('Помилка завантаження останніх зустрічей:', err);
  }

  function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }
});
