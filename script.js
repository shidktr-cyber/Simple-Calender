document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const calendarContainer = document.getElementById('calendar-container');
    const monthYearDisplay = document.getElementById('month-year-display');
    const prevMonthBtn = document.getElementById('prev-month');
    const nextMonthBtn = document.getElementById('next-month');
    const eventListEl = document.getElementById('event-list');
    
    // Input Panel Elements
    const inputPanel = document.getElementById('input-panel');
    const selectedDatesText = document.getElementById('selected-dates-text');
    const cancelSelectionBtn = document.getElementById('cancel-selection');
    const eventInput = document.getElementById('event-input');
    const addEventBtn = document.getElementById('add-event-btn');

    // --- State ---
    let currentDate = new Date();
    let selectedDates = new Set(); // Stores date strings like "2023-10-05"
    let events = []; // Array of { id: string, date: string, text: string }
    let holidays = {}; // key: "YYYY-MM-DD", value: "Holiday Name"

    // --- Localization ---
    const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

    // --- Initialization ---
    async function init() {
        loadEvents();
        await fetchHolidays();
        renderCalendar();
        renderEvents();
        setupEventListeners();
    }

    // --- Storage & API ---
    function loadEvents() {
        const stored = localStorage.getItem('simpleCalendarEvents');
        if (stored) {
            try {
                events = JSON.parse(stored);
            } catch (e) {
                console.error("Failed to parse events from local storage", e);
                events = [];
            }
        }
    }

    function saveEvents() {
        localStorage.setItem('simpleCalendarEvents', JSON.stringify(events));
    }

    async function fetchHolidays() {
        try {
            // 内閣府のデータをもとにした祝日APIを利用
            const response = await fetch('https://holidays-jp.github.io/api/v1/date.json');
            if (response.ok) {
                holidays = await response.json();
            }
        } catch (e) {
            console.error("Failed to fetch holidays", e);
        }
    }

    // --- Helpers ---
    function formatDateString(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function getFormattedDateDisplay(dateStr) {
        const d = new Date(dateStr);
        return `${d.getMonth() + 1}月${d.getDate()}日(${dayNames[d.getDay()]})`;
    }

    function getEventsForDate(dateStr) {
        return events.filter(e => e.date === dateStr);
    }

    function isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }

    // --- Rendering ---
    function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        monthYearDisplay.textContent = `${year}年 ${month + 1}月`;
        
        // Setup days
        const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        calendarContainer.innerHTML = '';
        
        // Add empty cells for previous month padding
        for (let i = 0; i < firstDayOfMonth; i++) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'date-item empty';
            calendarContainer.appendChild(emptyEl);
        }
        
        // Add days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            const date = new Date(year, month, i);
            const dateStr = formatDateString(date);
            const dayOfWeek = date.getDay();
            
            const dateEl = document.createElement('div');
            dateEl.className = 'date-item';
            if (isToday(date)) dateEl.classList.add('is-today');
            if (selectedDates.has(dateStr)) dateEl.classList.add('is-selected');
            if (getEventsForDate(dateStr).length > 0) dateEl.classList.add('has-event');
            
            // Add weekends and holidays coloring slightly
            if (dayOfWeek === 0 || holidays[dateStr]) {
                dateEl.style.color = '#fca5a5'; // Light red for Sunday and Holidays
            } else if (dayOfWeek === 6) {
                dateEl.style.color = '#93c5fd'; // Light blue for Saturday
            }
            
            dateEl.innerHTML = `<span class="day-number">${i}</span>`;
            
            dateEl.addEventListener('click', () => toggleDateSelection(dateStr, dateEl));
            
            calendarContainer.appendChild(dateEl);
        }
        
        updateInputPanel();
    }

    function renderEvents() {
        eventListEl.innerHTML = '';
        
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();

        // Sort events chronologically and filter by current displayed month
        const filteredEvents = events.filter(e => {
            const d = new Date(e.date);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });

        const sortedEvents = filteredEvents.sort((a, b) => a.date.localeCompare(b.date));
        
        if (sortedEvents.length === 0) {
            eventListEl.innerHTML = '<li class="no-events">この月の予定はありません</li>';
            return;
        }
        
        sortedEvents.forEach(event => {
            const li = document.createElement('li');
            li.className = 'event-item';
            li.innerHTML = `
                <div class="event-info">
                    <span class="event-date">${getFormattedDateDisplay(event.date)}</span>
                    <span class="event-text">${escapeHTML(event.text)}</span>
                </div>
                <button class="btn-delete" data-id="${event.id}" aria-label="削除">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            `;
            
            li.querySelector('.btn-delete').addEventListener('click', () => deleteEvent(event.id));
            eventListEl.appendChild(li);
        });
    }

    function escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }

    // --- Interaction ---
    function toggleDateSelection(dateStr, element) {
        if (selectedDates.has(dateStr)) {
            selectedDates.delete(dateStr);
            element.classList.remove('is-selected');
        } else {
            selectedDates.add(dateStr);
            element.classList.add('is-selected');
        }
        updateInputPanel();
    }

    function updateInputPanel() {
        if (selectedDates.size > 0) {
            inputPanel.classList.remove('hidden');
            
            if (selectedDates.size === 1) {
                const dateStr = Array.from(selectedDates)[0];
                selectedDatesText.textContent = `${getFormattedDateDisplay(dateStr)} に追加`;
            } else {
                selectedDatesText.textContent = `${selectedDates.size}日間の予定を追加`;
            }
        } else {
            inputPanel.classList.add('hidden');
            eventInput.value = '';
            eventInput.blur(); // dismiss keyboard
        }
    }

    function cancelSelection() {
        selectedDates.clear();
        renderCalendar(); // re-render to clear 'is-selected' classes
        updateInputPanel();
    }

    function addEvent() {
        const text = eventInput.value.trim();
        if (!text || selectedDates.size === 0) return;
        
        selectedDates.forEach(dateStr => {
            events.push({
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                date: dateStr,
                text: text
            });
        });
        
        saveEvents();
        cancelSelection(); // Also hides the panel and clears input
        renderCalendar(); // To update the 'has-event' dots
        renderEvents();
    }

    function deleteEvent(id) {
        events = events.filter(e => e.id !== id);
        saveEvents();
        renderCalendar(); // Update dots
        renderEvents();
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        prevMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() - 1);
            renderCalendar();
            renderEvents(); // Update event list for new month
        });
        
        nextMonthBtn.addEventListener('click', () => {
            currentDate.setMonth(currentDate.getMonth() + 1);
            renderCalendar();
            renderEvents(); // Update event list for new month
        });
        
        cancelSelectionBtn.addEventListener('click', cancelSelection);
        
        addEventBtn.addEventListener('click', addEvent);
        
        eventInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addEvent();
            }
        });
    }

    // Run
    init();
});
