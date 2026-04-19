document.addEventListener('DOMContentLoaded', () => {
    const calendarGrid = document.getElementById('calendarGrid');
    const currentMonthYear = document.getElementById('currentMonthYear');
    const prevMonthBtn = document.getElementById('prevMonth');
    const nextMonthBtn = document.getElementById('nextMonth');
    
    const popover = document.getElementById('quickAddPopover');
    const eventTitleInput = document.getElementById('eventTitleInput');
    
    const modal = document.getElementById('detailsModal');
    const closeModalBtn = document.getElementById('closeModal');
    const modalDateTitle = document.getElementById('modalDateTitle');
    const modalEventsList = document.getElementById('modalEventsList');
    const modalAddInput = document.getElementById('modalAddInput');

    let currentDate = new Date();
    let events = JSON.parse(localStorage.getItem('calendar_events')) || {};
    
    // Selection state
    let selectedDates = new Set(); // Setを使って一意な日付を管理

    // --- Init ---
    renderCalendar();

    // --- Calendar Rendering ---
    function renderCalendar() {
        calendarGrid.innerHTML = '';
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        currentMonthYear.textContent = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });
        
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const daysInPrevMonth = new Date(year, month, 0).getDate();
        
        // Previous month days
        for (let i = firstDayOfMonth - 1; i >= 0; i--) {
            const day = daysInPrevMonth - i;
            const dateStr = formatDate(year, month - 1, day);
            createDayCell(day, dateStr, true);
        }
        
        // Current month days
        for (let i = 1; i <= daysInMonth; i++) {
            const dateStr = formatDate(year, month, i);
            createDayCell(i, dateStr, false);
        }
        
        // Next month days (fill the grid to 42 cells)
        const totalCells = calendarGrid.children.length;
        const remainingCells = 42 - totalCells;
        for (let i = 1; i <= remainingCells; i++) {
            const dateStr = formatDate(year, month + 1, i);
            createDayCell(i, dateStr, true);
        }
    }

    function createDayCell(day, dateStr, isOtherMonth) {
        const cell = document.createElement('div');
        cell.className = `day-cell ${isOtherMonth ? 'other-month' : ''}`;
        cell.dataset.date = dateStr;
        
        const todayStr = formatDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
        if (dateStr === todayStr) {
            cell.classList.add('today');
        }

        const numberDiv = document.createElement('div');
        numberDiv.className = 'day-number';
        numberDiv.textContent = day;
        cell.appendChild(numberDiv);

        // Render events
        if (events[dateStr]) {
            events[dateStr].forEach((ev, idx) => {
                const pill = document.createElement('div');
                pill.className = 'event-pill';
                
                const textSpan = document.createElement('span');
                textSpan.className = 'event-text';
                textSpan.textContent = ev;
                textSpan.title = ev;
                
                // 予定テキストクリックで詳細モーダル表示
                textSpan.addEventListener('click', (e) => {
                    e.stopPropagation();
                    hidePopover();
                    openModal(dateStr);
                });

                // バツボタンクリックで直接削除
                const delBtn = document.createElement('button');
                delBtn.className = 'pill-del-btn';
                delBtn.innerHTML = '&times;';
                delBtn.title = "削除";
                delBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    events[dateStr].splice(idx, 1);
                    if (events[dateStr].length === 0) delete events[dateStr];
                    saveEvents();
                    renderCalendar(); // 再描画
                });

                pill.appendChild(textSpan);
                pill.appendChild(delBtn);
                cell.appendChild(pill);
            });
        }

        // Cell Click -> Toggle Selection & Show Quick Add
        cell.addEventListener('click', (e) => {
            if (e.target.closest('.event-pill')) return;

            // 選択状態をトグル
            if (selectedDates.has(dateStr)) {
                selectedDates.delete(dateStr);
                cell.classList.remove('selected');
            } else {
                selectedDates.add(dateStr);
                cell.classList.add('selected');
            }

            // 1つ以上選択されていればポップアップを表示、0になれば隠す
            if (selectedDates.size > 0) {
                // クリックされたマスの位置にポップアップを表示
                showPopover(cell);
            } else {
                hidePopover();
            }
        });

        // 既に選択されている日付なら（月を切り替えて戻ってきた時用）
        if (selectedDates.has(dateStr)) {
            cell.classList.add('selected');
        }

        calendarGrid.appendChild(cell);
    }

    // 枠外クリックで選択を解除
    document.addEventListener('click', (e) => {
        // クリックした要素が、カレンダーのマスでもポップアップでもモーダルでもなければ解除
        if (!e.target.closest('.day-cell') && 
            !e.target.closest('.popover') && 
            !e.target.closest('.calendar-header') &&
            !e.target.closest('.modal-overlay')) {
            hidePopover();
        }
    });

    // --- Popover (Quick Add) ---
    function showPopover(cellElement) {
        if (cellElement) {
            const rect = cellElement.getBoundingClientRect();
            popover.style.left = `${rect.left + rect.width / 2}px`;
            popover.style.top = `${rect.top}px`;
        }
        
        popover.classList.add('visible');
        eventTitleInput.value = '';
        eventTitleInput.focus();
    }

    function hidePopover() {
        popover.classList.remove('visible');
        document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('selected'));
        selectedDates.clear();
    }

    eventTitleInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && eventTitleInput.value.trim() !== '') {
            addEventToSelection(eventTitleInput.value.trim());
            hidePopover();
        } else if (e.key === 'Escape') {
            hidePopover();
        }
    });

    function addEventToSelection(title) {
        selectedDates.forEach(dateStr => {
            if (!events[dateStr]) events[dateStr] = [];
            events[dateStr].push(title);
        });
        saveEvents();
        renderCalendar();
    }

    // --- Modal (Details) ---
    let modalCurrentDate = null;

    function openModal(dateStr) {
        modalCurrentDate = dateStr;
        modalDateTitle.textContent = dateStr;
        renderModalEvents();
        modalAddInput.value = '';
        modal.classList.remove('hidden');
        setTimeout(() => modalAddInput.focus(), 100);
    }

    function closeModal() {
        modal.classList.add('hidden');
        modalCurrentDate = null;
    }

    function renderModalEvents() {
        modalEventsList.innerHTML = '';
        const dayEvents = events[modalCurrentDate] || [];
        
        if (dayEvents.length === 0) {
            modalEventsList.innerHTML = '<div style="color: var(--text-secondary); font-size: 0.9rem;">予定はありません</div>';
            return;
        }

        dayEvents.forEach((ev, idx) => {
            const item = document.createElement('div');
            item.className = 'modal-event-item';
            
            const text = document.createElement('span');
            text.textContent = ev;
            
            const delBtn = document.createElement('button');
            delBtn.className = 'delete-btn';
            delBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
            delBtn.onclick = () => {
                events[modalCurrentDate].splice(idx, 1);
                if (events[modalCurrentDate].length === 0) delete events[modalCurrentDate];
                saveEvents();
                renderModalEvents();
                renderCalendar();
            };

            item.appendChild(text);
            item.appendChild(delBtn);
            modalEventsList.appendChild(item);
        });
    }

    modalAddInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && modalAddInput.value.trim() !== '') {
            if (!events[modalCurrentDate]) events[modalCurrentDate] = [];
            events[modalCurrentDate].push(modalAddInput.value.trim());
            saveEvents();
            renderModalEvents();
            renderCalendar();
            modalAddInput.value = '';
        } else if (e.key === 'Escape') {
            closeModal();
        }
    });

    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // --- Helpers ---
    function saveEvents() {
        localStorage.setItem('calendar_events', JSON.stringify(events));
    }

    function formatDate(y, m, d) {
        const date = new Date(y, m, d);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // --- Navigation ---
    prevMonthBtn.addEventListener('click', () => {
        hidePopover();
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener('click', () => {
        hidePopover();
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
});
