// ==UserScript==
// @name         FS-EDI Auto Export on signlist RECADV with DOM Navigation
// @namespace    http://tampermonkey.net/
// @version      3.3
// @description  Scrape signlist pages, accumulate results in localStorage, supports DOM-pagination click or URL navigation, export to XLSX (up to 5000 rows), logging and cancel button
// @author       Grok (fixed)
// @match        https://fsedi.kz/signlist*
// @match        https://edi.fsdocs.kz/signlist*
// @grant        GM_addStyle
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// ==/UserScript==
(function () {
    'use strict';

    GM_addStyle(`
        .tampermonkey-ui {
            position: fixed;
            top: 10px;
            right: 10px;
            background: #f8f9fa;
            padding: 12px;
            border: 1px solid #ccc;
            border-radius: 8px;
            z-index: 99999;
            font-family: Arial, sans-serif;
            font-size: 13px;
            width: 220px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        .tampermonkey-ui input, .tampermonkey-ui select {
            margin: 6px 0;
            padding: 6px;
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        .tampermonkey-ui button {
            padding: 6px 8px;
            margin-top: 8px;
            width: 48%;
            box-sizing: border-box;
            border-radius: 4px;
            border: none;
            cursor: pointer;
        }
        .tm-btn-primary { background:#007bff; color:#fff; }
        .tm-btn-danger { background:#dc3545; color:#fff; }
        .tampermonkey-ui #status {
            margin-top: 8px;
            font-size: 12px;
            color: #222;
            max-height: 160px;
            overflow-y: auto;
            background: #fff;
            padding: 6px;
            border: 1px solid #eee;
            border-radius: 4px;
        }
    `);

    // Utilities
    function logStatus(msg) {
        const status = document.getElementById('status');
        if (status) {
            const time = new Date().toLocaleTimeString();
            status.innerHTML += `<div>[${time}] ${escapeHtml(msg)}</div>`;
            status.scrollTop = status.scrollHeight;
        }
        console.log(`[Signlist Export] ${msg}`);
    }
    function escapeHtml(text) {
        if (text === undefined || text === null) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    // Load saved filter values
    const savedFilters = JSON.parse(localStorage.getItem('signlistFilters') || '{}');

    // UI
    const ui = document.createElement('div');
    ui.className = 'tampermonkey-ui';
    ui.innerHTML = `
        <div>
            <input id="number" placeholder="№ recadv/desadv/order" value="${escapeHtml(savedFilters.number||'')}">
            <select id="statusRecadv">
                <option value="">Статус (все)</option>
                <option value="00">00 — Новый</option>
                <option value="01">01 — Подписан Покупателем</option>
                <option value="11">11 — Подписан</option>
                <option value="02">02 — Отозван Покупателем</option>
                <option value="03">03 — Отменен Покупателем</option>
            </select>
            <input id="sumvat" placeholder="Сумма с НДС" value="${escapeHtml(savedFilters.sumvat||'')}">
            <input id="dateFrom" placeholder="Дата с (YYYY-MM-DD)" value="${escapeHtml(savedFilters.dateFrom||'')}">
            <input id="dateTo" placeholder="Дата до (YYYY-MM-DD)" value="${escapeHtml(savedFilters.dateTo||'')}">
            <input id="dateReceptionFrom" placeholder="Дата приема с" value="${escapeHtml(savedFilters.dateReceptionFrom||'')}">
            <input id="dateReceptionTo" placeholder="Дата приема до" value="${escapeHtml(savedFilters.dateReceptionTo||'')}">
            <input id="pageFrom" placeholder="Стр с" value="${escapeHtml(savedFilters.pageFrom||'1')}">
            <input id="pageTo" placeholder="Стр по" value="${escapeHtml(savedFilters.pageTo||'')}">
            <div style="display:flex; gap:4px;">
                <button id="exportBtn" class="tm-btn-primary">Экспорт</button>
                <button id="cancelBtn" class="tm-btn-danger">Отмена</button>
            </div>
            <div id="status">Статус: готов</div>
        </div>
    `;
    document.body.appendChild(ui);

    // Save filters on change
    function saveFiltersToStorage() {
        const f = {
            number: document.getElementById('number').value,
            statusRecadv: document.getElementById('statusRecadv').value,
            sumvat: document.getElementById('sumvat').value,
            dateFrom: document.getElementById('dateFrom').value,
            dateTo: document.getElementById('dateTo').value,
            dateReceptionFrom: document.getElementById('dateReceptionFrom').value,
            dateReceptionTo: document.getElementById('dateReceptionTo').value,
            pageFrom: document.getElementById('pageFrom').value,
            pageTo: document.getElementById('pageTo').value
        };
        localStorage.setItem('signlistFilters', JSON.stringify(f));
        logStatus('Фильтры сохранены');
    }
    ['number','statusRecadv','sumvat','dateFrom','dateTo','dateReceptionFrom','dateReceptionTo','pageFrom','pageTo']
        .forEach(id => document.getElementById(id).addEventListener('input', saveFiltersToStorage));

    // Cleaning helpers
    function cleanText(text) {
        if (!text) return '';
        return text.replace(/<[^>]+>/g, '').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
    }
    function splitMultiLine(html) {
        if (!html) return [];
        const normalized = html.replace(/<br\s*\/?>/gi, '\n');
        return cleanText(normalized).split('\n').map(s => s.trim()).filter(Boolean);
    }

    // Extract ID logic (try few patterns)
    function extractIdFromDataL(cell) {
        try {
            if (!cell) return '';
            const selectors = [
                'div.btngetdata[data-l]',
                'div[data-l*="recadv"]',
                'a[data-l*="recadv"]',
                '[data-l*="recadv"]',
                'input[data-id]'
            ];
            for (const sel of selectors) {
                const el = cell.querySelector(sel);
                if (!el) continue;
                const dataL = el.getAttribute('data-l') || el.getAttribute('data-id') || '';
                if (!dataL) continue;
                const m = dataL.match(/\/recadv\/(\d+)/) || dataL.match(/(\d{6,})/);
                if (m && m[1]) return m[1];
            }
            return '';
        } catch (e) {
            console.error('extractIdFromDataL error', e);
            return '';
        }
    }

    // Scrape table rows with flexible selectors
    function scrapeTableData() {
        // Try several selectors to find rows
        const rowSelectors = [
            'table.table tbody tr.ord',
            'table tbody tr.ord',
            'table tbody tr',
            'table#orders tbody tr',
            'table.list tbody tr'
        ];
        let rows = [];
        for (const sel of rowSelectors) {
            const found = Array.from(document.querySelectorAll(sel));
            if (found && found.length) {
                rows = found;
                break;
            }
        }
        if (!rows.length) {
            logStatus('Не найдено строк таблицы (проверьте селекторы).');
            return [];
        }

        const data = [];
        rows.forEach((row, idx) => {
            const cells = Array.from(row.querySelectorAll('td'));
            // If row looks like header or too short - skip
            if (cells.length < 3) return;
            try {
                // Attempt mapping by position, but safe-guard missing cells
                const id = extractIdFromDataL(cells[0]);
                const numberData = splitMultiLine((cells[1] && cells[1].innerHTML) || '');
                const statusText = cleanText((cells[2] && (cells[2].querySelector('div')?.textContent || cells[2].textContent)) || '');
                const sumData = splitMultiLine((cells[3] && cells[3].innerHTML) || '');
                const buyerData = splitMultiLine((cells[4] && cells[4].innerHTML) || '');
                const signatureData = splitMultiLine((cells[5] && cells[5].innerHTML) || '');
                const deliveryData = splitMultiLine((cells[6] && cells[6].innerHTML) || '');
                const dateData = splitMultiLine((cells[7] && cells[7].innerHTML) || '');

                const rowData = [
                    id,
                    numberData[0] || '',
                    numberData[1] || '',
                    numberData[2] || '',
                    statusText,
                    sumData[0] || '',
                    sumData[1] || '',
                    buyerData[0] || '',
                    buyerData[1] || '',
                    signatureData[0] || '',
                    signatureData[1] || '',
                    deliveryData[0] || '',
                    deliveryData[1] || '',
                    deliveryData[2] || '',
                    dateData[0] || '',
                    dateData[1] || ''
                ];
                data.push(rowData);
            } catch (err) {
                console.error('Row parse error', err);
                logStatus(`Ошибка парсинга строки ${idx}: ${err.message}`);
            }
        });
        return data;
    }

    // Build filter URL (ensures page param present)
    function buildFilterURL(page) {
        const base = `${window.location.origin}${window.location.pathname.replace(/\/+$/,'')}`; // keep path
        const params = new URLSearchParams(window.location.search);

        // use UI values to override
        const vals = {
            number: document.getElementById('number').value,
            statusRecadv: document.getElementById('statusRecadv').value,
            sumvat: document.getElementById('sumvat').value,
            date_from: document.getElementById('dateFrom').value,
            date_to: document.getElementById('dateTo').value,
            date_reception_from: document.getElementById('dateReceptionFrom').value,
            date_reception_to: document.getElementById('dateReceptionTo').value
        };
        // set or delete params
        if (vals.number) params.set('number', vals.number); else params.delete('number');
        if (vals.statusRecadv) params.set('statusRecadv', vals.statusRecadv); else params.delete('statusRecadv');
        if (vals.sumvat) params.set('sumvat', vals.sumvat); else params.delete('sumvat');
        if (vals.date_from) params.set('date_from', vals.date_from); else params.delete('date_from');
        if (vals.date_to) params.set('date_to', vals.date_to); else params.delete('date_to');
        if (vals.date_reception_from) params.set('date_reception_from', vals.date_reception_from); else params.delete('date_reception_from');
        if (vals.date_reception_to) params.set('date_reception_to', vals.date_reception_to); else params.delete('date_reception_to');

        params.set('search', '1'); // ensure search param if site expects it
        params.set('page', String(page || 1));
        return `${base}?${params.toString()}`;
    }

    // Try clicking a page link in pagination (preferred for SPA)
    function clickPageLink(targetPage) {
        try {
            // common pagination link patterns
            const candidates = Array.from(document.querySelectorAll('a')).filter(a => {
                const href = a.getAttribute('href') || '';
                const text = (a.textContent || '').trim();
                // candidate if href contains page= and the number OR text equals number
                return (href.includes('page=') && href.match(new RegExp('[?&]page=' + targetPage + '\\b'))) || text === String(targetPage) || (a.dataset && (a.dataset.page == targetPage));
            });
            if (candidates.length) {
                candidates[0].click();
                return true;
            }
            // try class-based pagination
            const pageLinks = Array.from(document.querySelectorAll('ul.pagination li a, .pagination a'));
            for (const a of pageLinks) {
                const text = (a.textContent || '').trim();
                if (text === String(targetPage) || a.getAttribute('data-page') == targetPage) {
                    a.click();
                    return true;
                }
            }
            return false;
        } catch (e) {
            console.warn('clickPageLink error', e);
            return false;
        }
    }

    // Navigate to page: try click first, fallback to href change
    function navigateToPage(page) {
        logStatus(`Навигация к странице ${page} ...`);
        const clicked = clickPageLink(page);
        if (clicked) {
            logStatus(`Попытка клика по ссылке пагинации для страницы ${page}`);
            return;
        }
        const url = buildFilterURL(page);
        logStatus(`Перехожу по URL: ${url}`);
        window.location.href = url;
    }

    function getCurrentPageFromUrl() {
        const p = new URLSearchParams(window.location.search).get('page');
        return parseInt(p || '1', 10);
    }

    // Export state handling
    const STORAGE_KEY = 'signlistExportState_v3';
    const ROW_LIMIT = 5000;
    function readState() { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    function writeState(state) { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

    // trigger export
    function triggerExport() {
        const pageFrom = Math.max(1, parseInt(document.getElementById('pageFrom').value || '1', 10));
        const pageToInput = document.getElementById('pageTo').value;
        const pageTo = pageToInput ? Math.max(pageFrom, parseInt(pageToInput, 10)) : pageFrom;

        const existing = readState();
        if (existing && existing.inProgress) {
            logStatus('Экспорт уже выполняется. Нажмите "Отмена", чтобы остановить.');
            return;
        }

        const state = {
            inProgress: true,
            currentPage: pageFrom,
            pageTo: pageTo,
            allData: [],
            dateFrom: document.getElementById('dateFrom').value || '',
            dateTo: document.getElementById('dateTo').value || ''
        };
        writeState(state);

        // navigate to first page with filters
        const startUrl = buildFilterURL(pageFrom);
        logStatus(`Старт экспорта: страницы ${pageFrom}..${pageTo}. Открываю ${startUrl}`);
        // direct open (keeps state in localStorage)
        window.location.href = startUrl;
    }

    // Cancel export
    function cancelExport() {
        const st = readState();
        if (st && st.inProgress) {
            localStorage.removeItem(STORAGE_KEY);
            logStatus('Экспорт отменён пользователем.');
        } else logStatus('Нет активного экспорта.');
    }

    // Process current page: called on load
    async function processCurrentPage() {
        const state = readState();
        if (!state || !state.inProgress) {
            return;
        }
        const currentPage = getCurrentPageFromUrl();
        // If we're not on the expected page, but page param is lower than desired start, attempt navigation
        if (currentPage < state.currentPage) {
            logStatus(`Текущая страница ${currentPage} меньше ожидаемой ${state.currentPage}. Перехожу к ${state.currentPage}`);
            setTimeout(() => navigateToPage(state.currentPage), 800);
            return;
        }
        if (currentPage > state.pageTo) {
            logStatus(`Текущая страница ${currentPage} больше pageTo (${state.pageTo}). Финализирую.`);
            finalizeExport(state);
            return;
        }

        logStatus(`Обработка страницы ${currentPage}...`);
        // small delay to allow dynamic content to render
        await new Promise(r => setTimeout(r, 1100));
        const newRows = scrapeTableData();
        state.allData = (state.allData || []).concat(newRows || []);
        logStatus(`Страница ${currentPage} обработана: найдено ${newRows.length} строк, всего накоплено: ${state.allData.length}`);

        // save
        state.currentPage = currentPage;
        writeState(state);

        if (state.allData.length >= ROW_LIMIT) {
            logStatus(`Достигнут лимит ${ROW_LIMIT} строк — экспортирую сейчас.`);
            finalizeExport(state);
            return;
        }

        if (currentPage < state.pageTo) {
            const nextPage = currentPage + 1;
            state.currentPage = nextPage;
            writeState(state);
            // navigate to next page (try click first, otherwise href)
            setTimeout(() => navigateToPage(nextPage), 900);
        } else {
            finalizeExport(state);
        }
    }

    // Finalize and excel export
    function finalizeExport(state) {
        if (!state || !state.allData || !state.allData.length) {
            logStatus('Нет данных для экспорта.');
            localStorage.removeItem(STORAGE_KEY);
            return;
        }

        // header row
        const header = ['ID', '№', '№ Заказа', '№ уведомления об отгрузке', 'Статус', 'Сумма с НДС', 'Разница с НДС', 'Покупатель', 'Покупатель ID', 'Подпись поставщика', 'Подпись заказчика', 'Место доставки', 'Город', 'GLN', 'Дата', 'Дата приёма'];
        const ws = XLSX.utils.aoa_to_sheet([header, ...state.allData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Signlist');
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeFrom = (state.dateFrom || 'start').replace(/\s+/g,'_');
        const safeTo = (state.dateTo || 'end').replace(/\s+/g,'_');
        a.href = url;
        a.download = `signlist_${safeFrom}_to_${safeTo}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);

        logStatus(`Экспорт завершён: ${state.allData.length} строк. Файл скачан.`);
        localStorage.removeItem(STORAGE_KEY);
    }

    // Attach UI handlers
    document.getElementById('exportBtn').addEventListener('click', () => {
        triggerExport();
    });
    document.getElementById('cancelBtn').addEventListener('click', () => {
        cancelExport();
    });

    // On load, attempt to continue export if state exists
    window.addEventListener('load', () => {
        setTimeout(processCurrentPage, 800);
    });

    // Also try on popstate (SPA navigation)
    window.addEventListener('popstate', () => {
        setTimeout(processCurrentPage, 600);
    });

    // If there is an in-progress export but user loads page manually, show info
    (function checkExisting() {
        const st = readState();
        if (st && st.inProgress) {
            logStatus(`Найден незавершённый экспорт: текущая страница ${st.currentPage}, до ${st.pageTo}. Продолжится автоматически при загрузке страницы.`);
        }
    })();

})();
