// ==UserScript==
// @name         FS-EDI Orders Export (ordersp, full)
// @namespace    https://fsedi.kz/ordersp
// @namespace    https://fsedi.kz/ordersp/*
// @namespace    https://fsedi.kz/ordersp
// @version      1.2
// @description  Полная выгрузка вкладки "Заказы" с автопереходом по пагинации (<div class="pagi">) в XLSX
// @match        https://fsedi.kz/ordersp*
// @match        https://fsedi.kz/ordersp/*
// @grant        GM_addStyle
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// ==/UserScript==

(function () {
    'use strict';

    /* ================= НАСТРОЙКИ ================= */

    const STORAGE_KEY = 'ordersp_export_state';
    const DELAY_MS = 900;        // задержка между страницами
    const ROW_LIMIT = 50000;     // жёсткий лимит строк (защита)

    /* ================= UI ================= */

    GM_addStyle(`
        .tm-orders-ui {
            position: fixed;
            top: 12px;
            right: 12px;
            z-index: 99999;
            background: #ffffff;
            border: 1px solid #cfcfcf;
            padding: 10px;
            border-radius: 6px;
            font-family: Arial, sans-serif;
            font-size: 13px;
            width: 220px;
        }
        .tm-orders-ui button {
            width: 100%;
            padding: 6px;
            margin-bottom: 6px;
            cursor: pointer;
        }
        .tm-orders-ui .status {
            font-size: 12px;
            max-height: 120px;
            overflow-y: auto;
            border: 1px solid #eee;
            padding: 4px;
        }
    `);

    const ui = document.createElement('div');
    ui.className = 'tm-orders-ui';
    ui.innerHTML = `
        <button id="tmStart">Экспорт заказов</button>
        <button id="tmStop">Остановить</button>
        <div class="status" id="tmStatus">Ожидание</div>
    `;
    document.body.appendChild(ui);

    function log(msg) {
        const box = document.getElementById('tmStatus');
        const t = new Date().toLocaleTimeString();
        box.innerHTML += `<div>[${t}] ${msg}</div>`;
        box.scrollTop = box.scrollHeight;
        console.log('[ordersp]', msg);
    }

    /* ================= ВСПОМОГАТЕЛЬНЫЕ ================= */

    function clean(text) {
        return text
            ? text.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
            : '';
    }

    function firstLine(el) {
        if (!el) return '';
        return clean(el.innerText.split('\n')[0]);
    }

    function readState() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    }

    function writeState(state) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function clearState() {
        localStorage.removeItem(STORAGE_KEY);
    }

    /* ================= ПАГИНАЦИЯ ================= */

    function getCurrentPage() {
        const p = new URLSearchParams(location.search).get('page');
        return parseInt(p || '1', 10);
    }

    function getLastPage() {
        const last = document.querySelector('.pagi a:last-of-type');
        if (!last) return null;
        const m = last.href.match(/page=(\d+)/);
        return m ? parseInt(m[1], 10) : null;
    }

    function goNextPage() {
        const next = [...document.querySelectorAll('.pagi a')]
            .find(a => a.textContent.trim() === 'След');

        if (!next) return false;

        location.href = next.href;
        return true;
    }

    /* ================= СБОР ДАННЫХ ================= */

    function scrapeOrders() {
        const rows = document.querySelectorAll('table.table tbody tr.ord');
        if (!rows.length) {
            log('Строки заказов не найдены');
            return [];
        }

        const data = [];

        rows.forEach(row => {
            const td = row.querySelectorAll('td');
            if (td.length < 9) return;

            // Индексы соответствуют <thead>, который вы прислали
            const number        = clean(td[1]?.innerText);
            const status        = clean(td[2]?.innerText);
            const deliveryPlace = firstLine(td[3]);
            const buyer         = firstLine(td[4]);
            const loadedDate    = clean(td[7]?.innerText);
            const deliveryDate  = clean(td[8]?.innerText);

            data.push([
                number,
                status,
                deliveryPlace,
                buyer,
                loadedDate,
                deliveryDate
            ]);
        });

        return data;
    }

    /* ================= ЭКСПОРТ ================= */

    function finalizeExport(allRows) {
        if (!allRows.length) {
            log('Нет данных для экспорта');
            clearState();
            return;
        }

        const header = [
            '№',
            'Статус',
            'Место доставки',
            'Покупатель',
            'Загружено',
            'Поставка'
        ];

        const ws = XLSX.utils.aoa_to_sheet([header, ...allRows]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Orders');

        XLSX.writeFile(wb, 'ordersp.xlsx');

        log(`Экспорт завершён: ${allRows.length} строк`);
        clearState();
    }

    /* ================= ОСНОВНОЙ ЦИКЛ ================= */

    function processPage() {
        const state = readState();
        if (!state || !state.inProgress) return;

        const current = getCurrentPage();
        const last = getLastPage();

        log(`Обработка страницы ${current}${last ? ' / ' + last : ''}`);

        const rows = scrapeOrders();
        state.rows = state.rows.concat(rows);

        log(`Добавлено ${rows.length}, всего ${state.rows.length}`);

        if (state.rows.length >= ROW_LIMIT) {
            log('Достигнут лимит строк');
            finalizeExport(state.rows);
            return;
        }

        writeState(state);

        if (last && current < last) {
            setTimeout(() => {
                if (!goNextPage()) {
                    finalizeExport(state.rows);
                }
            }, DELAY_MS);
        } else {
            finalizeExport(state.rows);
        }
    }

    /* ================= КНОПКИ ================= */

    document.getElementById('tmStart').addEventListener('click', () => {
        if (readState()?.inProgress) {
            log('Экспорт уже запущен');
            return;
        }

        writeState({
            inProgress: true,
            rows: []
        });

        log('Экспорт запущен');
        processPage();
    });

    document.getElementById('tmStop').addEventListener('click', () => {
        clearState();
        log('Экспорт остановлен пользователем');
    });

    /* ================= АВТОПРОДОЛЖЕНИЕ ================= */

    window.addEventListener('load', () => {
        setTimeout(processPage, 800);
    });

})();
