/**
 * i18n.js - Bilingual Localization Module (Ukrainian 'uk' & English 'en')
 * Synchronizes language state across content scripts, popup, and dashboard via chrome.storage.local.
 */

const MeetI18n = (() => {
  const STORAGE_KEY_LANG = 'meet_language';
  let currentLang = 'uk';

  const DICTIONARY = {
    uk: {
      // Brand & Common
      app_title: 'Google Meet Attendance — Локальний Журнал',
      brand_badge: '100% Локально',
      popup_subtitle: 'Аналітика уроків',
      local_indicator_title: 'Працює локально',
      footer_local_100: '100% локально на вашому комп\'ютері',
      general_meeting: 'Загальна зустріч',
      special_meeting: 'Спеціальна зустріч',
      general_short: 'Загальна',
      no_class: '(Без класу / Загальна)',
      no_class_short: '(Без класу)',

      // Popup
      popup_status_label: 'Стан розширення:',
      popup_status_ready: 'Готовий до відстеження Google Meet',
      popup_status_tracking: '🟢 Відстеження кімнати: {code}',
      popup_open_dashboard: '📊 Відкрити повний журнал занять',
      popup_recent_title: 'Останні заняття:',
      popup_recent_empty: 'Записів ще немає',

      // Sidebar Navigation
      nav_section_reports: 'ЖУРНАЛ ТА ЗВІТИ',
      nav_all_meetings: '📋 Всі заняття',
      nav_by_subjects: '📚 За предметами',
      nav_by_classes: '🏫 За класами (1-11)',
      nav_by_students: '👤 За учнями',
      nav_section_settings: 'НАЛАШТУВАННЯ',
      nav_presets_classes: 'Заготовки та класи',
      nav_backup: 'Резервна копія',
      sidebar_secure_title: 'Безпечне сховище',
      sidebar_secure_desc: 'Дані зберігаються виключно на вашому комп\'ютері.',

      // Tab 1: All Meetings
      tab1_title: 'Журнал відвідуваності',
      tab1_subtitle: 'Історія всіх проведених уроків та онлайн-зустрічей Google Meet',
      btn_refresh: '🔄 Оновити',
      search_placeholder: 'Пошук за предметом, класом, темою або учнем...',
      filter_all_subjects: 'Всі предмети',
      filter_all_classes: 'Всі класи',
      sort_newest: 'Найновіші спочатку',
      sort_oldest: 'Найстаріші спочатку',
      sort_participants: 'За кількістю учнів',
      stat_total_meetings: 'Проведено занять',
      stat_total_students: 'Унікальних учнів',
      stat_total_hours: 'Сумарний час у Meet',
      empty_title: 'Жодних занять не знайдено',
      empty_desc: 'Коли ви почнете та завершите зустріч у Google Meet, дані про учнів з\'являться тут автоматично.',
      category_empty: 'Занять у цій категорії ще не зафіксовано.',

      // Meeting Card
      card_duration: 'Тривалість:',
      card_present: 'Присутніх:',
      card_students_suffix: 'учнів',
      card_btn_report: '📊 Звіт',
      card_btn_png_title: 'Завантажити графічну PNG-картку уроку',
      card_btn_csv_title: 'Експорт у Excel (CSV)',
      card_btn_del_title: 'Видалити запис',
      confirm_delete_meeting: 'Видалити запис уроку "{title}" від {date}?',

      // Tab 2: By Subjects
      tab2_title: 'Аналітика за предметами',
      tab2_subtitle: 'Перевірка відвідуваності та історії занять окремо для кожного предмета',
      tab2_select_label: 'Оберіть предмет для перевірки:',
      stat_subject_lessons: 'Уроків з предмета',
      stat_subject_time: 'Загальний час',
      stat_subject_avg: 'Сер. кількість учнів',
      tab2_list_heading: 'Усі проведені уроки з цього предмета:',

      // Tab 3: By Classes
      tab3_title: 'Аналітика за класами (1–11 класи)',
      tab3_subtitle: 'Перевірка відвідуваності окремо для конкретного класу по всіх предметах',
      tab3_select_label: 'Оберіть клас для аналізу:',
      stat_class_lessons: 'Уроків для цього класу',
      stat_class_students: 'Учнів у класі',
      stat_class_time: 'Загальний час занять',
      tab3_list_heading: 'Заняття вибраного класу:',

      // Tab 4: By Students
      tab4_title: 'Персональна аналітика учня',
      tab4_subtitle: 'Перевірка присутності, запізнень та повної історії уроків конкретного учня',
      tab4_select_label: 'Оберіть учня або почніть вводити ім\'я:',
      select_student_placeholder: '-- Оберіть учня зі списку ({count} учнів) --',
      btn_export_dossier: '📥 Експорт табеля учня (CSV)',
      dossier_subtitle: 'Статистика за весь навчальний період',
      stat_student_lessons: 'Відвідано занять',
      stat_student_time: 'Сумарний час на уроках',
      stat_student_avg: 'Середня присутність',
      dossier_history_heading: 'Історія відвідуваності уроків:',
      student_no_lessons: 'Цей учень ще не відвідував жодного заняття.',

      // Table Headers
      th_date: 'Дата',
      th_subject: 'Предмет',
      th_class: 'Клас',
      th_student_name: 'Ім\'я учасника / Учня',
      th_first_join: 'Перший вхід',
      th_last_leave: 'Останній вихід',
      th_duration: 'Час на уроці',
      th_attendance: 'Присутність',
      th_status: 'Статус',
      table_no_students: 'Учнів не знайдено',

      // Attendance Statuses
      status_present: 'Присутній',
      status_full: 'Був увесь час',
      status_partial: 'Частково',
      status_late: 'Запізнився',
      status_early: 'Вийшов раніше',
      status_short: 'Короткочасно',

      // Tab 5: Presets & Classes
      tab5_title: 'Заготовки предметів та класів',
      tab5_subtitle: 'Додавайте та редагуйте назви предметів і класів для швидкого вибору після уроку',
      presets_card_title: '📚 Заготовки предметів',
      input_new_preset_placeholder: 'Новий предмет (наприклад: Астрономія)...',
      btn_add: '➕ Додати',
      presets_active_list: 'Список активних предметів:',
      btn_reset_presets: 'Скинути до стандартних',
      classes_card_title: '🏫 Класи (1–11 класи)',
      input_new_class_placeholder: 'Новий клас (наприклад: 8-В клас)...',
      btn_add_class: '➕ Додати клас',
      classes_active_list: 'Список класів:',
      btn_reset_classes: 'Відновити 1-11 класи',
      confirm_reset_presets: 'Скинути предмети до стандартних?',
      confirm_reset_classes: 'Відновити стандартні класи з 1 по 11 клас?',
      remove_item_title: 'Видалити',

      // Tab 6: Backup & Database
      tab6_title: 'Керування локальними даними',
      tab6_subtitle: 'Створюйте копії журналу на своєму диску та відновлюйте дані у разі потреби',
      backup_export_title: 'Експорт всієї бази (JSON)',
      backup_export_desc: 'Збережіть усі зустрічі, історію відвідуваності та заготовки уроків у єдиний файл на свій комп\'ютер.',
      btn_download_backup: 'Завантажити файл резервної копії',
      backup_import_title: 'Імпорт з резервної копії',
      backup_import_desc: 'Відновіть дані журналу з раніше збереженого JSON-файлу.',
      btn_choose_import: 'Обрати файл для відновлення',
      backup_clear_title: 'Очищення бази даних',
      backup_clear_desc: 'Повне видалення всієї локальної історії занять. Цю дію неможливо скасувати.',
      btn_clear_all: 'Видалити всі записи',
      alert_import_success: 'Дані успішно імпортовано!',
      alert_import_error: 'Помилка імпорту: ',
      prompt_clear_db: 'Введіть "ВИДАЛИТИ" (або "DELETE") для повного очищення бази:',
      alert_db_cleared: 'Базу очищено.',

      // Detail Modal & Edit
      modal_heading_default: 'Деталі уроку',
      modal_meta_template: 'Код: <b>{code}</b> • Дата: <b>{date}</b> • Загальний час: <b>{duration}</b> • Всього учнів: <b>{count}</b>',
      edit_panel_title: '✏️ Редагування даних уроку:',
      edit_label_subject: 'Предмет:',
      edit_label_class: 'Клас:',
      edit_label_title: 'Тема уроку:',
      edit_placeholder_title: 'Тема уроку...',
      edit_label_notes: 'Нотатки / Домашнє завдання:',
      edit_placeholder_notes: 'Д/З або коментар...',
      btn_cancel: 'Скасувати',
      btn_save_changes: '💾 Зберегти зміни',
      modal_search_student: 'Пошук учня за іменем...',
      btn_edit: '✏️ Редагувати',
      btn_edit_title: 'Змінити предмет, клас, тему або нотатки',
      btn_png_card: '📷 Картка (PNG)',
      btn_copy_png: '📋 Копіювати PNG',
      btn_copied: '✅ Скопійовано!',
      btn_export_csv: '📥 Експорт у Excel (CSV)',
      btn_print: '🖨️ Друк / PDF',
      modal_notes_heading: '📝 Нотатки до уроку:',

      // Time units
      unit_sec: 'сек',
      unit_s: 'с',
      unit_min: 'хв',
      unit_hour: 'год',

      // CSV Exports
      csv_report_title: 'Звіт відвідуваності',
      csv_meeting_code: 'Код зустрічі',
      csv_date_time: 'Дата та час',
      csv_total_duration: 'Загальна тривалість',
      csv_notes: 'Нотатки',
      csv_headers: '"№";"Ім\'я учня";"Перший вхід";"Останній вихід";"Час на занятті";"Час у секундах";"Відсоток";"Статус"',
      csv_filename_prefix: 'Звіт',
      csv_dossier_title: 'Персональний табель відвідуваності учня',
      csv_generated: 'Згенеровано',
      csv_dossier_headers: '"Дата";"Предмет";"Клас";"Перший вхід";"Останній вихід";"Час на уроці";"Відсоток";"Статус"',
      csv_dossier_prefix: 'Табель',

      // PNG Card Generator
      png_badge: 'GOOGLE MEET ЗВІТ',
      png_topic_prefix: 'Тема: ',
      png_code_prefix: 'Код зустрічі: ',
      png_metric_students: 'Приєдналося учнів',
      png_metric_duration: 'Тривалість уроку',
      png_metric_avg: 'Середня присутність',
      png_teacher_note: '📝 Швидка нотатка вчителя:',
      png_present_list: 'Список присутніх ({count} учнів):',
      png_more_students: '...та ще +{count} учнів',
      png_no_participants: 'Учасників не було зафіксовано',
      png_footer_left: 'Згенеровано розширенням Google Meet Attendance Tracker • Локальний звіт',
      png_footer_right: '100% Локальне збереження',
      png_filename_prefix: 'Картка',

      // Google Meet HUD & Post-Meeting Modal (content.js)
      hud_indicator_title: 'Відстеження уроку активне',
      hud_participants_title: 'Зафіксовано учнів',
      hud_timer_title: 'Час від моменту вашого входу',
      hud_btn_sync: '📋 Список',
      hud_btn_sync_title: 'Відкрити бічний список учасників',
      hud_btn_finish: '⏹️ Завершити',
      hud_btn_finish_title: 'Завершити урок та зберегти звіт',
      hud_btn_dash: '📊 Журнал',
      hud_btn_dash_title: 'Відкрити журнал занять',

      post_modal_title: 'Урок завершено!',
      post_modal_subtitle: 'Код: <b>{code}</b> • Збережіть деталі в локальний журнал',
      post_summary_students: 'Приєднаних дітей',
      post_summary_duration: 'Час спілкування',
      post_summary_local: 'Локально на ПК',
      post_label_subject: 'Предмет / Заготовка:',
      post_opt_custom_subject: '➕ Вказати іншу назву...',
      post_label_class: 'Клас (1–11 класи):',
      post_opt_custom_class: '➕ Свій клас / літера (напр. 8-А)...',
      post_label_custom_subject: 'Кастомна назва предмета:',
      post_placeholder_custom_subject: 'Наприклад: Підготовка до олімпіади',
      post_label_custom_class: 'Кастомний клас / літера:',
      post_placeholder_custom_class: 'Наприклад: 8-Б клас або Факультатив',
      post_label_topic: 'Тема уроку (опціонально):',
      post_placeholder_topic: 'Наприклад: Квадратні рівняння, Розділ 3',
      post_label_notes: 'Швидка нотатка / ДЗ (буде на зображенні та в журналі):',
      post_placeholder_notes: 'Д/З параграф 12, виконати вправи 1-4...',
      post_png_title: '📷 Швидкий експорт результатів уроку (PNG-картка):',
      post_btn_download_png: '📥 Завантажити PNG',
      post_btn_copy_png: '📋 Скопіювати картинку (Ctrl+V)',
      post_feedback_saved: '✅ PNG-картку збережено на комп\'ютер!',
      post_feedback_copied: '✅ Скопійовано! Вставте картинку через Ctrl+V у Telegram чи Viber.',
      post_feedback_downloaded: '📥 Файл завантажено на комп\'ютер!',
      post_btn_save_close: 'Зберегти в журнал',
      post_btn_save_open: 'Зберегти та відкрити звіт'
    },

    en: {
      // Brand & Common
      app_title: 'Google Meet Attendance — Local Dashboard',
      brand_badge: '100% Local',
      popup_subtitle: 'Lesson Analytics',
      local_indicator_title: 'Running locally',
      footer_local_100: '100% stored locally on your PC',
      general_meeting: 'General Meeting',
      special_meeting: 'Special Meeting',
      general_short: 'General',
      no_class: '(No Grade / General)',
      no_class_short: '(No Grade)',

      // Popup
      popup_status_label: 'Extension Status:',
      popup_status_ready: 'Ready to track Google Meet',
      popup_status_tracking: '🟢 Tracking room: {code}',
      popup_open_dashboard: '📊 Open Full Attendance Log',
      popup_recent_title: 'Recent Lessons:',
      popup_recent_empty: 'No records yet',

      // Sidebar Navigation
      nav_section_reports: 'LOG & ANALYTICS',
      nav_all_meetings: '📋 All Sessions',
      nav_by_subjects: '📚 By Subject',
      nav_by_classes: '🏫 By Grade (1-11)',
      nav_by_students: '👤 By Student',
      nav_section_settings: 'SETTINGS',
      nav_presets_classes: 'Subjects & Grades',
      nav_backup: 'Backup & Restore',
      sidebar_secure_title: 'Private Local Storage',
      sidebar_secure_desc: 'All data stays strictly on your computer.',

      // Tab 1: All Meetings
      tab1_title: 'Attendance Log',
      tab1_subtitle: 'Complete history of your Google Meet lessons and online sessions',
      btn_refresh: '🔄 Refresh',
      search_placeholder: 'Search by subject, grade, topic, or student...',
      filter_all_subjects: 'All Subjects',
      filter_all_classes: 'All Grades',
      sort_newest: 'Newest First',
      sort_oldest: 'Oldest First',
      sort_participants: 'Most Students',
      stat_total_meetings: 'Total Sessions',
      stat_total_students: 'Unique Students',
      stat_total_hours: 'Total Time in Meet',
      empty_title: 'No sessions found',
      empty_desc: 'Once you join and finish a Google Meet session, student attendance data will appear here automatically.',
      category_empty: 'No sessions recorded in this category yet.',

      // Meeting Card
      card_duration: 'Duration:',
      card_present: 'Present:',
      card_students_suffix: 'students',
      card_btn_report: '📊 Report',
      card_btn_png_title: 'Download PNG Summary Card',
      card_btn_csv_title: 'Export to Excel (CSV)',
      card_btn_del_title: 'Delete record',
      confirm_delete_meeting: 'Delete session "{title}" from {date}?',

      // Tab 2: By Subjects
      tab2_title: 'Subject Analytics',
      tab2_subtitle: 'Review attendance statistics and lesson history for each subject',
      tab2_select_label: 'Select a subject to inspect:',
      stat_subject_lessons: 'Subject Sessions',
      stat_subject_time: 'Total Duration',
      stat_subject_avg: 'Avg. Students',
      tab2_list_heading: 'All recorded sessions for this subject:',

      // Tab 3: By Classes
      tab3_title: 'Grade Analytics (Grades 1–11)',
      tab3_subtitle: 'Review attendance across all subjects for a specific class or grade',
      tab3_select_label: 'Select a grade to analyze:',
      stat_class_lessons: 'Sessions for Grade',
      stat_class_students: 'Students in Grade',
      stat_class_time: 'Total Class Time',
      tab3_list_heading: 'Sessions for the selected grade:',

      // Tab 4: By Students
      tab4_title: 'Individual Student Dossier',
      tab4_subtitle: 'Inspect attendance rate, late arrivals, and complete lesson history for any student',
      tab4_select_label: 'Select a student from the list:',
      select_student_placeholder: '-- Select a student ({count} total) --',
      btn_export_dossier: '📥 Export Student Report (CSV)',
      dossier_subtitle: 'Cumulative statistics across all sessions',
      stat_student_lessons: 'Sessions Attended',
      stat_student_time: 'Total Time in Class',
      stat_student_avg: 'Average Attendance',
      dossier_history_heading: 'Lesson Attendance History:',
      student_no_lessons: 'This student has not attended any recorded sessions yet.',

      // Table Headers
      th_date: 'Date',
      th_subject: 'Subject',
      th_class: 'Grade',
      th_student_name: 'Participant / Student Name',
      th_first_join: 'First Join',
      th_last_leave: 'Last Seen',
      th_duration: 'Time in Call',
      th_attendance: 'Attendance',
      th_status: 'Status',
      table_no_students: 'No students found',

      // Attendance Statuses
      status_present: 'Present',
      status_full: 'Full Attendance',
      status_partial: 'Partial',
      status_late: 'Joined Late',
      status_early: 'Left Early',
      status_short: 'Brief Visit',

      // Tab 5: Presets & Classes
      tab5_title: 'Subject & Grade Presets',
      tab5_subtitle: 'Manage subject templates and school grades for quick post-meeting selection',
      presets_card_title: '📚 Subject Presets',
      input_new_preset_placeholder: 'New subject (e.g., Astronomy)...',
      btn_add: '➕ Add',
      presets_active_list: 'Active subjects:',
      btn_reset_presets: 'Reset to defaults',
      classes_card_title: '🏫 Grades (Grades 1–11)',
      input_new_class_placeholder: 'New grade (e.g., Grade 8-B)...',
      btn_add_class: '➕ Add Grade',
      classes_active_list: 'Active grades:',
      btn_reset_classes: 'Restore Grades 1-11',
      confirm_reset_presets: 'Reset subjects to default list?',
      confirm_reset_classes: 'Restore default Grades 1 to 11?',
      remove_item_title: 'Remove',

      // Tab 6: Backup & Database
      tab6_title: 'Local Database Management',
      tab6_subtitle: 'Create full backups on your disk and restore your attendance log anytime',
      backup_export_title: 'Export Full Database (JSON)',
      backup_export_desc: 'Save all meetings, student attendance history, and presets into a single file on your PC.',
      btn_download_backup: 'Download Backup File',
      backup_import_title: 'Import from Backup',
      backup_import_desc: 'Restore your attendance log from a previously saved JSON backup file.',
      btn_choose_import: 'Choose File to Restore',
      backup_clear_title: 'Clear Database',
      backup_clear_desc: 'Permanently delete all local session history. This action cannot be undone.',
      btn_clear_all: 'Delete All Records',
      alert_import_success: 'Data imported successfully!',
      alert_import_error: 'Import error: ',
      prompt_clear_db: 'Type "DELETE" (or "ВИДАЛИТИ") to permanently clear the database:',
      alert_db_cleared: 'Database cleared.',

      // Detail Modal & Edit
      modal_heading_default: 'Session Details',
      modal_meta_template: 'Code: <b>{code}</b> • Date: <b>{date}</b> • Duration: <b>{duration}</b> • Total Students: <b>{count}</b>',
      edit_panel_title: '✏️ Edit Session Details:',
      edit_label_subject: 'Subject:',
      edit_label_class: 'Grade:',
      edit_label_title: 'Lesson Topic:',
      edit_placeholder_title: 'Lesson topic...',
      edit_label_notes: 'Notes / Homework:',
      edit_placeholder_notes: 'Homework or comment...',
      btn_cancel: 'Cancel',
      btn_save_changes: '💾 Save Changes',
      modal_search_student: 'Search student by name...',
      btn_edit: '✏️ Edit',
      btn_edit_title: 'Change subject, grade, topic, or notes',
      btn_png_card: '📷 PNG Card',
      btn_copy_png: '📋 Copy PNG',
      btn_copied: '✅ Copied!',
      btn_export_csv: '📥 Export to Excel (CSV)',
      btn_print: '🖨️ Print / PDF',
      modal_notes_heading: '📝 Lesson Notes:',

      // Time units
      unit_sec: 'sec',
      unit_s: 's',
      unit_min: 'min',
      unit_hour: 'h',

      // CSV Exports
      csv_report_title: 'Attendance Report',
      csv_meeting_code: 'Meeting Code',
      csv_date_time: 'Date & Time',
      csv_total_duration: 'Total Duration',
      csv_notes: 'Notes',
      csv_headers: '"#";"Student Name";"First Join";"Last Seen";"Time in Call";"Time (Seconds)";"Percentage";"Status"',
      csv_filename_prefix: 'Report',
      csv_dossier_title: 'Individual Student Attendance Report',
      csv_generated: 'Generated',
      csv_dossier_headers: '"Date";"Subject";"Grade";"First Join";"Last Seen";"Time in Call";"Percentage";"Status"',
      csv_dossier_prefix: 'Student_Report',

      // PNG Card Generator
      png_badge: 'GOOGLE MEET REPORT',
      png_topic_prefix: 'Topic: ',
      png_code_prefix: 'Meeting code: ',
      png_metric_students: 'Students Joined',
      png_metric_duration: 'Session Duration',
      png_metric_avg: 'Avg. Attendance',
      png_teacher_note: '📝 Teacher\'s Quick Note:',
      png_present_list: 'Attendees ({count} students):',
      png_more_students: '...and +{count} more',
      png_no_participants: 'No participants recorded',
      png_footer_left: 'Generated by Google Meet Attendance Tracker • Local Report',
      png_footer_right: '100% Local Storage',
      png_filename_prefix: 'Card',

      // Google Meet HUD & Post-Meeting Modal (content.js)
      hud_indicator_title: 'Lesson tracking is active',
      hud_participants_title: 'Recorded students',
      hud_timer_title: 'Elapsed time since you joined',
      hud_btn_sync: '📋 People',
      hud_btn_sync_title: 'Open participants side panel',
      hud_btn_finish: '⏹️ Finish',
      hud_btn_finish_title: 'Finish lesson & save report',
      hud_btn_dash: '📊 Log',
      hud_btn_dash_title: 'Open attendance dashboard',

      post_modal_title: 'Lesson Finished!',
      post_modal_subtitle: 'Code: <b>{code}</b> • Save session details to your local log',
      post_summary_students: 'Students Joined',
      post_summary_duration: 'Call Duration',
      post_summary_local: 'Local on PC',
      post_label_subject: 'Subject / Preset:',
      post_opt_custom_subject: '➕ Enter custom subject...',
      post_label_class: 'Grade (Grades 1–11):',
      post_opt_custom_class: '➕ Custom grade / group (e.g. 8-A)...',
      post_label_custom_subject: 'Custom Subject Name:',
      post_placeholder_custom_subject: 'E.g., Olympiad Preparation',
      post_label_custom_class: 'Custom Grade / Group:',
      post_placeholder_custom_class: 'E.g., Grade 8-B or Elective',
      post_label_topic: 'Lesson Topic (optional):',
      post_placeholder_topic: 'E.g., Quadratic Equations, Unit 3',
      post_label_notes: 'Quick Note / Homework (shown on PNG card & log):',
      post_placeholder_notes: 'Homework: Chapter 12, exercises 1-4...',
      post_png_title: '📷 Quick Visual Export (PNG Summary Card):',
      post_btn_download_png: '📥 Download PNG',
      post_btn_copy_png: '📋 Copy Image (Ctrl+V)',
      post_feedback_saved: '✅ PNG card saved to your computer!',
      post_feedback_copied: '✅ Copied! Paste via Ctrl+V in Telegram, Viber, or Slack.',
      post_feedback_downloaded: '📥 File downloaded to your computer!',
      post_btn_save_close: 'Save to Log',
      post_btn_save_open: 'Save & Open Report'
    }
  };

  function getLang() {
    return currentLang;
  }

  function getLocaleCode() {
    return currentLang === 'en' ? 'en-US' : 'uk-UA';
  }

  async function init() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([STORAGE_KEY_LANG], (res) => {
          if (res && (res[STORAGE_KEY_LANG] === 'en' || res[STORAGE_KEY_LANG] === 'uk')) {
            currentLang = res[STORAGE_KEY_LANG];
          }
          try { localStorage.setItem(STORAGE_KEY_LANG, currentLang); } catch {}
          resolve(currentLang);
        });
      } else {
        try {
          const saved = localStorage.getItem(STORAGE_KEY_LANG);
          if (saved === 'en' || saved === 'uk') currentLang = saved;
        } catch {}
        resolve(currentLang);
      }
    });
  }

  async function setLang(lang) {
    const normalized = lang === 'en' ? 'en' : 'uk';
    currentLang = normalized;
    try { localStorage.setItem(STORAGE_KEY_LANG, normalized); } catch {}
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ [STORAGE_KEY_LANG]: normalized }, () => resolve(normalized));
      } else {
        resolve(normalized);
      }
    });
  }

  function t(key, params = {}) {
    const dict = DICTIONARY[currentLang] || DICTIONARY.uk;
    let str = dict[key] !== undefined ? dict[key] : (DICTIONARY.uk[key] || key);
    Object.entries(params).forEach(([k, v]) => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });
    return str;
  }

  function applyToDOM(root = document) {
    if (!root) return;
    if (root === document && document.documentElement) {
      document.documentElement.lang = currentLang;
      document.title = t('app_title');
    }

    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (key) el.textContent = t(key);
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (key) el.setAttribute('placeholder', t(key));
    });

    root.querySelectorAll('[data-i18n-title]').forEach(el => {
      const key = el.getAttribute('data-i18n-title');
      if (key) el.setAttribute('title', t(key));
    });

    // Update active state on language switch buttons
    root.querySelectorAll('[data-lang-switch]').forEach(btn => {
      const btnLang = btn.getAttribute('data-lang-switch');
      btn.classList.toggle('active', btnLang === currentLang);
    });
  }

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[STORAGE_KEY_LANG]) {
        const newLang = changes[STORAGE_KEY_LANG].newValue;
        if (newLang === 'en' || newLang === 'uk') {
          currentLang = newLang;
        }
      }
    });
  }

  return {
    init,
    getLang,
    setLang,
    getLocaleCode,
    t,
    applyToDOM,
    STORAGE_KEY_LANG
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = MeetI18n;
}
