/**
 * popup.js - Quick Extension Toolbar Popup (with UA / EN localization)
 */

document.addEventListener('DOMContentLoaded', async () => {
  const btnOpenDashboard = document.getElementById('btn-open-dashboard');
  const recentList = document.getElementById('recent-list');
  const statusDesc = document.getElementById('status-desc');
  let activeRoomCode = null;

  await MeetI18n.init();

  function renderPopupContent(meetings = []) {
    MeetI18n.applyToDOM(document);

    if (activeRoomCode) {
      statusDesc.textContent = MeetI18n.t('popup_status_tracking', { code: activeRoomCode });
      statusDesc.style.color = '#34d399';
    } else {
      statusDesc.textContent = MeetI18n.t('popup_status_ready');
      statusDesc.style.color = '#38bdf8';
    }

    recentList.innerHTML = '';
    if (meetings && meetings.length > 0) {
      const recents = meetings.slice(0, 3);
      const locale = MeetI18n.getLocaleCode();

      recents.forEach(m => {
        const item = document.createElement('div');
        item.className = 'recent-item';

        const title = m.customTitle || m.subject || MeetI18n.t('general_meeting');
        const classBadge = m.schoolClass ? ` [${escapeHtml(m.schoolClass)}]` : '';
        const pCount = Object.keys(m.participants || {}).length;
        const dateStr = new Date(m.startTime).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });

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
    } else {
      recentList.innerHTML = `<div class="recent-empty">${escapeHtml(MeetI18n.t('popup_recent_empty'))}</div>`;
    }
  }

  let cachedMeetings = [];
  try {
    cachedMeetings = await MeetStorage.getAllMeetings();
  } catch (err) {
    console.error('Error loading recent meetings:', err);
  }

  // Check active tab for Google Meet room code
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0] && tabs[0].url) {
      const match = tabs[0].url.match(/([a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3})/i);
      if (match && match[1]) {
        activeRoomCode = match[1].toLowerCase();
      }
    }
    renderPopupContent(cachedMeetings);
  });

  // Language switcher buttons
  document.querySelectorAll('[data-lang-switch]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lang = btn.getAttribute('data-lang-switch');
      await MeetI18n.setLang(lang);
      renderPopupContent(cachedMeetings);
    });
  });

  // Open Dashboard
  btnOpenDashboard.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
  });

  function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }
});
