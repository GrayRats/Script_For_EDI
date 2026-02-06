// ==UserScript==
// @name         FS-EDI Auto Warehouse Creator V1
// @namespace    http://violentmonkey.github.io/
// @version      1.0
// @description  Автоматическое создание складов из Google Sheets для Fsedi.kz
// @author       You
// @match        https://fsedi.kz/companies/whadd/1279
// @match        https://fsedi.kz/companies/edit/*
// @match        https:/edi.fsdocs.kz/companies/whadd/1279
// @match        https://edi.fsdocs.kz//companies/edit/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      sheets.googleapis.com
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        SPREADSHEET_ID: "1-WdN78D_xv8QBmXvPY2FjwsK1OpgRoyvdKfjImk5-_s",
        API_KEY: "AIzaSyARYjMuW8Krp3EirqedZoBPcweyhAfnJrg",
        SHEET_NAME: "AK NIET GROUP АФ",
        FROM_ROW: 3,
        TO_ROW: 200,
        FIELD_DELAY_MS: 1500,
        LOG_PREFIX: "[FsediAuto]"
    };

    // Индексы колонок в Google Sheets
    const COL = {
        TITLE: 0,        // A - Подразделение (Title)
        GLN: 1,          // B - GLN номер
        ADDRESS: 3,      // D - Адрес
        BRANCH: 5,       // F - Филиал
        CITY: 7          // H - Город
    };

    // Проверка авторизации
    if (document.body.textContent.trim().includes('Пожалуйста, авторизуйтесь')) {
        console.error(CONFIG.LOG_PREFIX, "❌ Требуется авторизация.");
        return;
    }

    const createStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            #fsedi-ui {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ffffff;
                border: 2px solid #3498db;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 6px 14px rgba(0,0,0,0.3);
                z-index: 2147483647;
                font-family: Arial, sans-serif;
                font-size: 14px;
                min-width: 320px;
            }
            #fsedi-ui h4 {
                margin: 0 0 15px;
                font-size: 18px;
                color: #3498db;
                text-align: center;
            }
            #fsedi-ui .status {
                margin: 10px 0;
                padding: 8px;
                background: #ecf0f1;
                border-radius: 5px;
                text-align: center;
                min-height: 24px;
            }
            #fsedi-ui .status.running {
                animation: pulse 1.5s infinite;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
            #fsedi-ui .field {
                margin: 10px 0;
            }
            #fsedi-ui label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
            }
            #fsedi-ui input {
                width: 100%;
                padding: 8px;
                border: 1px solid #3498db;
                border-radius: 5px;
                box-sizing: border-box;
            }
            #fsedi-ui .controls {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-top: 15px;
            }
            #fsedi-ui button {
                padding: 10px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                border: none;
                border-radius: 5px;
                color: white;
            }
            .btn-start { background: #2ecc71; }
            .btn-start:hover { background: #27ae60; }
            .btn-stop { background: #e74c3c; }
            .btn-stop:hover { background: #c0392b; }
            .btn-reset { background: #3498db; }
            .btn-reset:hover { background: #2980b9; }
        `;
        document.head.appendChild(style);
    };

    let elements = {};

    const createUI = () => {
        if (document.getElementById('fsedi-ui')) return;

        createStyles();

        const ui = document.createElement('div');
        ui.id = 'fsedi-ui';

        ui.innerHTML = `
            <h4>Fsedi Auto v2</h4>
            <div class="status" id="status">Ожидание...</div>
            <div class="field">
                <label>Старт с строки:</label>
                <input type="number" id="start-row" value="${GM_getValue('start_row', CONFIG.FROM_ROW)}" min="${CONFIG.FROM_ROW}" max="${CONFIG.TO_ROW}">
            </div>
            <div class="controls">
                <button class="btn-start" id="btn-start">▶️ Старт</button>
                <button class="btn-stop" id="btn-stop">⏹️ Стоп</button>
                <button class="btn-reset" id="btn-reset">🔄 Сброс</button>
            </div>
        `;

        document.body.appendChild(ui);

        elements.status = document.getElementById('status');
        elements.startRow = document.getElementById('start-row');
        elements.btnStart = document.getElementById('btn-start');
        elements.btnStop = document.getElementById('btn-stop');
        elements.btnReset = document.getElementById('btn-reset');

        elements.startRow.addEventListener('change', (e) => {
            const val = parseInt(e.target.value, 10);
            if (!isNaN(val) && val >= CONFIG.FROM_ROW && val <= CONFIG.TO_ROW) {
                GM_setValue('start_row', val);
            }
        });

        elements.btnStart.addEventListener('click', () => {
            GM_setValue('is_running', true);
            GM_setValue('current_row', parseInt(elements.startRow.value));
            updateStatus('Запуск...');
            location.reload();
        });

        elements.btnStop.addEventListener('click', () => {
            GM_setValue('is_running', false);
            updateStatus('Остановлено');
            elements.status.classList.remove('running');
        });

        elements.btnReset.addEventListener('click', () => {
            GM_deleteValue('is_running');
            GM_deleteValue('current_row');
            GM_deleteValue('start_row');
            GM_deleteValue('sheet_data');
            updateStatus('Прогресс сброшен');
            elements.startRow.value = CONFIG.FROM_ROW;
        });

        console.log(CONFIG.LOG_PREFIX, "UI создан");
    };

    const updateStatus = (text) => {
        if (elements.status) {
            elements.status.textContent = text;
        }
        console.log(CONFIG.LOG_PREFIX, text);
    };

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    const fetchSheetData = async () => {
        try {
            const cached = GM_getValue('sheet_data');
            if (cached) {
                console.log(CONFIG.LOG_PREFIX, "Используем кэшированные данные");
                return JSON.parse(cached);
            }

            const range = `${CONFIG.SHEET_NAME}!A1:H${CONFIG.TO_ROW + 10}`;
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${range}?key=${CONFIG.API_KEY}`;

            console.log(CONFIG.LOG_PREFIX, "Загрузка из Google Sheets...");
            const res = await fetch(url);

            if (!res.ok) {
                throw new Error(`API error: ${res.status}`);
            }

            const data = await res.json();
            const values = data.values || [];

            GM_setValue('sheet_data', JSON.stringify(values));
            console.log(CONFIG.LOG_PREFIX, "Загружено строк:", values.length);

            return values;
        } catch (err) {
            console.error(CONFIG.LOG_PREFIX, "Ошибка загрузки:", err);
            throw err;
        }
    };

    const setValue = (el, value) => {
        if (!el) return false;
        el.value = String(value || '');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
    };

    const setSelectValue = (selectEl, value) => {
        if (!selectEl) return false;
        const cleanValue = String(value || '').trim();
        const option = [...selectEl.options].find(opt =>
            opt.value === cleanValue || opt.textContent.trim() === cleanValue
        );
        if (option) {
            selectEl.value = option.value;
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        }
        return false;
    };

    const fillForm = async (row, rowNum) => {
        try {
            updateStatus(`Заполнение строки ${rowNum}...`);

            await sleep(1000);

            // Title
            const titleInput = document.querySelector('input[name="title"]');
            if (titleInput && row[COL.TITLE]) {
                setValue(titleInput, row[COL.TITLE]);
                await sleep(CONFIG.FIELD_DELAY_MS);
            }

            // Город
            const citySelect = document.querySelector('select[name="city"]');
            if (citySelect && row[COL.CITY]) {
                setSelectValue(citySelect, row[COL.CITY]);
                await sleep(CONFIG.FIELD_DELAY_MS);
            }

            // Адрес
            const addressInput = document.querySelector('input[name="address"]');
            if (addressInput && row[COL.ADDRESS]) {
                setValue(addressInput, row[COL.ADDRESS]);
                await sleep(CONFIG.FIELD_DELAY_MS);
            }

            // GLN
            const glnInput = document.querySelector('input[name="gln"]');
            if (glnInput && row[COL.GLN]) {
                setValue(glnInput, row[COL.GLN]);
                await sleep(CONFIG.FIELD_DELAY_MS);
            }

            // Филиал
            const branchInput = document.querySelector('input[name="branch"]');
            if (branchInput && row[COL.BRANCH]) {
                setValue(branchInput, row[COL.BRANCH]);
                await sleep(CONFIG.FIELD_DELAY_MS);
            }

            // Нажатие "Сохранить"
            const submitBtn = document.querySelector('input[type="submit"][value="Сохранить"]');
            if (!submitBtn) {
                throw new Error("Кнопка 'Сохранить' не найдена");
            }

            console.log(CONFIG.LOG_PREFIX, "Отправка формы...");
            submitBtn.click();

            return true;
        } catch (err) {
            console.error(CONFIG.LOG_PREFIX, "Ошибка заполнения:", err);
            return false;
        }
    };

    const main = async () => {
        const isRunning = GM_getValue('is_running', false);

        console.log(CONFIG.LOG_PREFIX, "Страница:", location.pathname);
        console.log(CONFIG.LOG_PREFIX, "Статус:", isRunning ? "Запущен" : "Остановлен");

        if (!isRunning) {
            console.log(CONFIG.LOG_PREFIX, "Скрипт не активен");
            return;
        }

        elements.status.classList.add('running');

        try {
            // Загрузка данных
            const sheetData = await fetchSheetData();
            const currentRow = GM_getValue('current_row', CONFIG.FROM_ROW);

            console.log(CONFIG.LOG_PREFIX, "Текущая строка:", currentRow);

            // Проверка завершения
            if (currentRow > CONFIG.TO_ROW || currentRow > sheetData.length) {
                updateStatus('✅ Все строки обработаны');
                GM_setValue('is_running', false);
                elements.status.classList.remove('running');
                return;
            }

            // Страница edit - переход к следующей строке
            if (location.pathname.startsWith('/companies/edit/')) {
                console.log(CONFIG.LOG_PREFIX, "На странице edit - строка сохранена");
                updateStatus(`✅ Строка ${currentRow} сохранена`);

                const nextRow = currentRow + 1;
                GM_setValue('current_row', nextRow);

                await sleep(2000);

                console.log(CONFIG.LOG_PREFIX, "Переход к строке", nextRow);
                window.location.href = 'https://fsedi.kz/companies/whadd/1279';
                return;
            }

            // Страница whadd - заполнение формы
            if (location.pathname === '/companies/whadd/1279') {
                const rowIndex = currentRow - 1;
                const row = sheetData[rowIndex];

                if (!row || row.length < 2) {
                    console.warn(CONFIG.LOG_PREFIX, "Пустая строка, пропуск");
                    GM_setValue('current_row', currentRow + 1);
                    await sleep(1000);
                    location.reload();
                    return;
                }

                console.log(CONFIG.LOG_PREFIX, "Заполнение формы для строки", currentRow);
                console.log(CONFIG.LOG_PREFIX, "Данные:", row);

                await fillForm(row, currentRow);
                return;
            }

            // Если на другой странице - переход на форму
            console.log(CONFIG.LOG_PREFIX, "Переход на форму добавления");
            window.location.href = 'https://fsedi.kz/companies/whadd/1279';

        } catch (err) {
            console.error(CONFIG.LOG_PREFIX, "Критическая ошибка:", err);
            updateStatus(`❌ Ошибка: ${err.message}`);
            GM_setValue('is_running', false);
            elements.status.classList.remove('running');
        }
    };

    // Инициализация
    try {
        createUI();

        const isRunning = GM_getValue('is_running', false);
        if (isRunning) {
            console.log(CONFIG.LOG_PREFIX, "Автозапуск через 2 сек...");
            setTimeout(main, 2000);
        } else {
            console.log(CONFIG.LOG_PREFIX, "✅ Готов к работе");
        }
    } catch (err) {
        console.error(CONFIG.LOG_PREFIX, "Ошибка инициализации:", err);
    }
})();
