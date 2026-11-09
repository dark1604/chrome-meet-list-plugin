/**
 * card-generator.js - Генератор швидких візуальних карток-звітів у форматі PNG
 * Створює красивий прямокутний банер заняття на HTML5 Canvas без використання сторонніх серверів.
 */

const MeetingCardGenerator = (() => {

  function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  function t(key, params = {}) {
    if (typeof MeetI18n !== 'undefined' && MeetI18n.t) {
      return MeetI18n.t(key, params);
    }
    return key;
  }

  function getLocale() {
    if (typeof MeetI18n !== 'undefined' && MeetI18n.getLocaleCode) {
      return MeetI18n.getLocaleCode();
    }
    return 'uk-UA';
  }

  function formatTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return d.toLocaleDateString(getLocale(), { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDurationShort(seconds) {
    const sec = Math.max(0, Math.round(seconds || 0));
    if (sec > 0 && sec < 60) {
      return `${sec} ${t('unit_sec')}`;
    }
    const mins = Math.round(sec / 60);
    return `${mins} ${t('unit_min')}`;
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = String(text || '').split(' ');
    let line = '';
    let lineCount = 0;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, y);
        line = words[n] + ' ';
        y += lineHeight;
        lineCount++;
        if (lineCount >= maxLines - 1 && n < words.length - 1) {
          ctx.fillText(line.trim() + '...', x, y);
          return y + lineHeight;
        }
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, y);
    return y + lineHeight;
  }

  /**
   * Створює Canvas елемент із готовим зображенням високої роздільної здатності (Retina 1200x700)
   */
  function generateCanvas(meeting) {
    const width = 1200;
    const height = 700;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Очищуємо та дедуплікуємо учасників перед рендерингом
    const cleanParticipants = (typeof MeetStorage !== 'undefined' && MeetStorage.cleanParticipantsMap)
      ? MeetStorage.cleanParticipantsMap(meeting.participants || {})
      : (meeting.participants || {});

    // 1. Градієнтний фон картки
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#0d1527');
    bgGradient.addColorStop(0.5, '#131e36');
    bgGradient.addColorStop(1, '#0b1120');

    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Декоративні сяючі кола
    const glow1 = ctx.createRadialGradient(100, 100, 10, 100, 100, 400);
    glow1.addColorStop(0, 'rgba(16, 185, 129, 0.18)');
    glow1.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, width, height);

    const glow2 = ctx.createRadialGradient(width - 150, height - 150, 10, width - 150, height - 150, 450);
    glow2.addColorStop(0, 'rgba(59, 130, 246, 0.16)');
    glow2.addColorStop(1, 'rgba(59, 130, 246, 0)');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, width, height);

    // Акуратна зовнішня рамка картки
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    roundRect(ctx, 20, 20, width - 40, height - 40, 24);
    ctx.stroke();

    // 2. Верхня панель (Брендинг, дата, код)
    ctx.fillStyle = 'rgba(16, 185, 129, 0.2)';
    roundRect(ctx, 60, 56, 210, 34, 17);
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 1;
    roundRect(ctx, 60, 56, 210, 34, 17);
    ctx.stroke();

    // Зелена крапка
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(80, 73, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#34d399';
    ctx.fillText(t('png_badge'), 96, 78);

    // Дата та час
    const dateStr = formatDate(meeting.startTime);
    const timeStr = `${formatTime(meeting.startTime)} - ${formatTime(meeting.endTime || new Date().toISOString())}`;
    ctx.font = '500 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'right';
    ctx.fillText(`📅 ${dateStr}   ⏱️ ${timeStr}`, width - 60, 78);
    ctx.textAlign = 'left';

    // 3. Заголовок уроку та Клас
    const subject = meeting.subject || t('general_meeting');
    const schoolClass = meeting.schoolClass ? ` • ${meeting.schoolClass}` : '';
    const fullHeading = `${subject}${schoolClass}`;

    ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(fullHeading, 60, 140);

    // Тема уроку (якщо вказана)
    if (meeting.customTitle) {
      ctx.font = '500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#38bdf8';
      ctx.fillText(`${t('png_topic_prefix')}${meeting.customTitle}`, 60, 175);
    } else {
      ctx.font = '500 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${t('png_code_prefix')}meet.google.com/${meeting.meetingCode || ''}`, 60, 175);
    }

    // 4. Блок ключових показників (3 плашки)
    const pValues = Object.values(cleanParticipants);
    const pCount = pValues.length;
    const durationText = formatDurationShort(meeting.durationSeconds);

    let sumPercent = 0;
    pValues.forEach(p => {
      const dur = Math.max(1, meeting.durationSeconds || 1);
      sumPercent += Math.min(100, Math.round(((p.totalSeconds || 0) / dur) * 100));
    });
    const avgAttendance = pValues.length > 0 ? Math.round(sumPercent / pValues.length) : 100;

    const cardsY = 210;
    const cardW = 340;
    const cardH = 96;

    drawMetricCard(ctx, 60, cardsY, cardW, cardH, '👥', `${pCount}`, t('png_metric_students'), '#38bdf8');
    drawMetricCard(ctx, 430, cardsY, cardW, cardH, '⏱️', durationText, t('png_metric_duration'), '#34d399');
    drawMetricCard(ctx, 800, cardsY, cardW, cardH, '📊', `${avgAttendance}%`, t('png_metric_avg'), '#c084fc');

    // 5. Нотатка вчителя (якщо є)
    let currentY = 340;
    if (meeting.notes && meeting.notes.trim()) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      roundRect(ctx, 60, currentY, width - 120, 80, 14);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      roundRect(ctx, 60, currentY, width - 120, 80, 14);
      ctx.stroke();

      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(t('png_teacher_note'), 80, currentY + 28);

      ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillStyle = '#e2e8f0';
      wrapText(ctx, meeting.notes.trim(), 80, currentY + 52, width - 160, 20, 2);

      currentY += 100;
    }

    // 6. Список приєднаних учнів (компактна хмара)
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(t('png_present_list', { count: pCount }), 60, currentY + 24);

    const studentNames = Array.from(new Set(pValues.map(p => p.name).filter(Boolean))).sort((a, b) => a.localeCompare(b, getLocale()));
    let chipX = 60;
    let chipY = currentY + 40;
    const maxChipWidth = width - 120;
    let displayedCount = 0;

    ctx.font = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    for (let i = 0; i < studentNames.length; i++) {
      const name = studentNames[i];
      const textWidth = ctx.measureText(name).width;
      const chipWidth = textWidth + 24;

      if (chipX + chipWidth > maxChipWidth) {
        chipX = 60;
        chipY += 34;
        if (chipY > height - 80) {
          const rem = studentNames.length - displayedCount;
          if (rem > 0) {
            ctx.fillStyle = '#64748b';
            ctx.fillText(t('png_more_students', { count: rem }), chipX, chipY + 18);
          }
          break;
        }
      }

      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      roundRect(ctx, chipX, chipY, chipWidth, 26, 13);
      ctx.fill();

      ctx.fillStyle = '#f1f5f9';
      ctx.fillText(name, chipX + 12, chipY + 18);

      chipX += chipWidth + 8;
      displayedCount++;
    }

    if (studentNames.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(t('png_no_participants'), 60, currentY + 56);
    }

    // 7. Нижній футер
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#475569';
    ctx.fillText(t('png_footer_left'), 60, height - 35);

    ctx.textAlign = 'right';
    ctx.fillText(t('png_footer_right'), width - 60, height - 35);
    ctx.textAlign = 'left';

    return canvas;
  }

  function drawMetricCard(ctx, x, y, w, h, icon, value, label, accentColor) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    roundRect(ctx, x, y, w, h, 16);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 16);
    ctx.stroke();

    // Іконка (100% непрозорий колір)
    ctx.fillStyle = '#ffffff';
    ctx.font = '28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(icon, x + 20, y + 58);

    // Значення
    ctx.font = 'bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = accentColor;
    ctx.fillText(value, x + 70, y + 50);

    // Підпис
    ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(label, x + 72, y + 74);
  }

  /**
   * Завантажити PNG-файл картки на комп'ютер користувача
   */
  function downloadPNG(meeting, customFilename = null) {
    const canvas = generateCanvas(meeting);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const subject = (meeting.subject || t('png_filename_prefix')).replace(/[\\/:*?"<>|]/g, '_');
      const cls = (meeting.schoolClass || '').replace(/[\\/:*?"<>|]/g, '_');
      const dateStr = new Date(meeting.startTime || Date.now()).toISOString().slice(0, 10);
      link.download = customFilename || `${t('png_filename_prefix')}_${subject}${cls ? '_' + cls : ''}_${dateStr}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');
  }

  /**
   * Скопіювати PNG прямо в буфер обміну (для миттєвої вставки Ctrl+V у Telegram/Viber/Classroom)
   */
  async function copyToClipboard(meeting) {
    const canvas = generateCanvas(meeting);
    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) {
          reject(new Error('Не вдалося створити зображення'));
          return;
        }
        try {
          if (navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            resolve(true);
          } else {
            reject(new Error('Буфер обміну для зображень не підтримується цим браузером'));
          }
        } catch (err) {
          reject(err);
        }
      }, 'image/png');
    });
  }

  return {
    generateCanvas,
    downloadPNG,
    copyToClipboard
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MeetingCardGenerator;
}
