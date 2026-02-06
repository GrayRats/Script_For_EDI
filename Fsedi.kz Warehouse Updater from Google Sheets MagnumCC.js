// ==UserScript==
// @name         Fsedi.kz Warehouse Updater from Google Sheets MagnumCC
// @namespace    http://violentmonkey.github.io/
// @version      2.0
// @description  Автоматическое обновление складов из Google Sheets (лист Magnum Cash&Carry)
// @author       You
// @match        https://fsedi.kz/companies/edit/3
// @match        https://fsedi.kz/companies/whedit/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      sheets.googleapis.com
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    const CONFIG = {
        SPREADSHEET_ID: "1PLtGkS0muLL1cKptBULOpCciLBVQ_sRPfxKVa_DOseQ",
        API_KEY: "AIzaSyARYjMuW8Krp3EirqedZoBPcweyhAfnJrg",
        SHEET_NAME: "Magnum Cash&Carry",
        FROM_ROW: 100,
        TO_ROW: 695,
        FIELD_DELAY_MS: 1500,
        LOG_PREFIX: "[FsediWarehouseUpdater]"
    };

    // Индексы колонок в Google Sheets
    const COL = {
        TITLE: 0,        // A - Подразделение (Title)
        GLN: 1,          // B - GLN номер
        ADDRESS: 2,      // C - Адрес
        BRANCH: 3        // D - Филиал
    };

    // Извлечение всех складов со страницы edit/3
    const extractWarehousesFromPage = () => {
        try {
            const warehouses = [];
            const tbody = document.querySelector('tbody');

            if (!tbody) {
                console.warn(CONFIG.LOG_PREFIX, "tbody не найден на странице");
                return warehouses;
            }

            const rows = tbody.querySelectorAll('tr');
            console.log(CONFIG.LOG_PREFIX, `Найдено строк складов: ${rows.length}`);

            rows.forEach((row, index) => {
                const cells = row.querySelectorAll('td');
                if (cells.length >= 3) {
                    // Извлечение ID из ссылки whedit
                    const whLink = cells[1].querySelector('a.wh[href^="/companies/whedit/"]');
                    if (whLink) {
                        const href = whLink.getAttribute('href');
                        const match = href.match(/\/companies\/whedit\/(\d+)/);
                        if (match) {
                            const id = match[1];
                            const gln = cells[2].textContent.trim();
                            warehouses.push({ id, gln });
                            console.log(CONFIG.LOG_PREFIX, `Склад ${index + 1}: ID=${id}, GLN=${gln}`);
                        }
                    }
                }
            });

            console.log(CONFIG.LOG_PREFIX, `Всего извлечено складов: ${warehouses.length}`);
            return warehouses;
        } catch (err) {
            console.error(CONFIG.LOG_PREFIX, "Ошибка извлечения складов:", err);
            return [];
        }
    };

    // Сопоставление данных из Google Sheets с ID складов
    const matchWarehouseData = (sheetData, warehouses) => {
        const matched = [];

        // Начинаем с 2-й строки (индекс 1, т.к. 0 - заголовки)
        for (let i = 1; i < sheetData.length; i++) {
            const row = sheetData[i];
            if (!row || row.length < 2) continue;

            const sheetGLN = String(row[COL.GLN] || '').trim();

            // Ищем склад с таким GLN
            const warehouse = warehouses.find(wh => {
                const whGLN = wh.gln.trim();
                return whGLN === sheetGLN || whGLN.endsWith(sheetGLN) || sheetGLN.endsWith(whGLN);
            });

            if (warehouse) {
                matched.push({
                    id: warehouse.id,
                    rowNum: i + 1, // +1 потому что строки в таблице нумеруются с 1
                    title: row[COL.TITLE],
                    gln: row[COL.GLN],
                    address: row[COL.ADDRESS],
                    branch: row[COL.BRANCH]
                });
                console.log(CONFIG.LOG_PREFIX, `Сопоставлено: GLN=${sheetGLN} → ID=${warehouse.id}`);
            } else {
                console.warn(CONFIG.LOG_PREFIX, `Не найден склад для GLN: ${sheetGLN}`);
            }
        }

        console.log(CONFIG.LOG_PREFIX, `Всего сопоставлено: ${matched.length}`);
        return matched;
    };

    // Проверка авторизации
    if (document.body.textContent.trim().includes('Пожалуйста, авторизуйтесь')) {
        console.error(CONFIG.LOG_PREFIX, "❌ Требуется авторизация.");
        return;
    }

    const createStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            #fsedi-updater-ui {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ffffff;
                border: 2px solid #9b59b6;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 6px 14px rgba(0,0,0,0.3);
                z-index: 2147483647;
                font-family: Arial, sans-serif;
                font-size: 14px;
                min-width: 320px;
            }
            #fsedi-updater-ui h4 {
                margin: 0 0 15px;
                font-size: 18px;
                color: #9b59b6;
                text-align: center;
            }
            #fsedi-updater-ui .status {
                margin: 10px 0;
                padding: 8px;
                background: #ecf0f1;
                border-radius: 5px;
                text-align: center;
                min-height: 24px;
            }
            #fsedi-updater-ui .status.running {
                animation: pulse 1.5s infinite;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.6; }
            }
            #fsedi-updater-ui .field {
                margin: 10px 0;
            }
            #fsedi-updater-ui label {
                display: block;
                margin-bottom: 5px;
                font-weight: 500;
            }
            #fsedi-updater-ui input {
                width: 100%;
                padding: 8px;
                border: 1px solid #9b59b6;
                border-radius: 5px;
                box-sizing: border-box;
            }
            #fsedi-updater-ui .controls {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-top: 15px;
            }
            #fsedi-updater-ui button {
                padding: 10px;
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                border: none;
                border-radius: 5px;
                color: white;
            }
            .btn-start { background: #9b59b6; }
            .btn-start:hover { background: #8e44ad; }
            .btn-stop { background: #e74c3c; }
            .btn-stop:hover { background: #c0392b; }
            .btn-reset { background: #3498db; }
            .btn-reset:hover { background: #2980b9; }
        `;
        document.head.appendChild(style);
    };

    let elements = {};

    const createUI = () => {
        if (document.getElementById('fsedi-updater-ui')) return;

        createStyles();

        const ui = document.createElement('div');
        ui.id = 'fsedi-updater-ui';

        ui.innerHTML = `
            <h4>Warehouse Updater</h4>
            <div class="status" id="status">Ожидание...</div>
            <div class="field">
                <label>Старт с строки:</label>
                <input type="number" id="start-row" value="${GM_getValue('wh_start_row', CONFIG.FROM_ROW)}" min="${CONFIG.FROM_ROW}" max="${CONFIG.TO_ROW}">
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
                GM_setValue('wh_start_row', val);
            }
        });

        elements.btnStart.addEventListener('click', () => {
            GM_setValue('wh_is_running', true);
            GM_setValue('wh_current_row', parseInt(elements.startRow.value));
            updateStatus('Запуск...');
            location.reload();
        });

        elements.btnStop.addEventListener('click', () => {
            GM_setValue('wh_is_running', false);
            updateStatus('Остановлено');
            elements.status.classList.remove('running');
        });

        elements.btnReset.addEventListener('click', () => {
            GM_deleteValue('wh_is_running');
            GM_deleteValue('wh_current_row');
            GM_deleteValue('wh_start_row');
            GM_deleteValue('wh_sheet_data');
            GM_deleteValue('wh_form_submitted');
            GM_deleteValue('wh_matched_data');
            GM_deleteValue('wh_current_index');
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
            const cached = GM_getValue('wh_sheet_data');
            if (cached) {
                console.log(CONFIG.LOG_PREFIX, "Используем кэшированные данные");
                return JSON.parse(cached);
            }

            const range = `${CONFIG.SHEET_NAME}!A1:E${CONFIG.TO_ROW + 10}`;
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${range}?key=${CONFIG.API_KEY}`;

            console.log(CONFIG.LOG_PREFIX, "Загрузка из Google Sheets...");
            const res = await fetch(url);

            if (!res.ok) {
                throw new Error(`API error: ${res.status}`);
            }

            const data = await res.json();
            const values = data.values || [];

            GM_setValue('wh_sheet_data', JSON.stringify(values));
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

    const fillWarehouseForm = async (warehouseData) => {
        try {
            updateStatus(`Заполнение склада ID=${warehouseData.id} (строка ${warehouseData.rowNum})...`);

            await sleep(1000);

            console.log(CONFIG.LOG_PREFIX, "Данные для заполнения:", warehouseData);

            // 1. Title (Подразделение)
            const titleInput = document.querySelector('input[name="title"]');
            if (titleInput && warehouseData.title) {
                setValue(titleInput, warehouseData.title);
                console.log(CONFIG.LOG_PREFIX, "Title:", warehouseData.title);
                await sleep(CONFIG.FIELD_DELAY_MS);
            }

            // 2. Branch (Филиал) - только если не пустое
            const branchInput = document.querySelector('input[name="branch"]');
            if (branchInput && warehouseData.branch) {
                setValue(branchInput, warehouseData.branch);
                console.log(CONFIG.LOG_PREFIX, "Branch:", warehouseData.branch);
                await sleep(CONFIG.FIELD_DELAY_MS);
            }

            // 3. Address (Адрес)
            const addressInput = document.querySelector('input[name="address"]');
            if (addressInput && warehouseData.address) {
                setValue(addressInput, warehouseData.address);
                console.log(CONFIG.LOG_PREFIX, "Address:", warehouseData.address);
                await sleep(CONFIG.FIELD_DELAY_MS);
            }

            // Нажатие "Сохранить"
            const submitBtn = document.querySelector('input[type="submit"][value="Сохранить"]');
            if (!submitBtn) {
                throw new Error("Кнопка 'Сохранить' не найдена");
            }

            console.log(CONFIG.LOG_PREFIX, "Отправка формы...");
            GM_setValue('wh_form_submitted', true);
            submitBtn.click();

            return true;
        } catch (err) {
            console.error(CONFIG.LOG_PREFIX, "Ошибка заполнения:", err);
            updateStatus(`❌ Ошибка: ${err.message}`);
            return false;
        }
    };

    const main = async () => {
        const isRunning = GM_getValue('wh_is_running', false);

        console.log(CONFIG.LOG_PREFIX, "=== MAIN START ===");
        console.log(CONFIG.LOG_PREFIX, "Страница:", location.pathname);
        console.log(CONFIG.LOG_PREFIX, "Статус:", isRunning ? "Запущен" : "Остановлен");

        if (!isRunning) {
            console.log(CONFIG.LOG_PREFIX, "Скрипт не активен");
            return;
        }

        elements.status.classList.add('running');

        try {
            // Страница whedit - заполнение формы
            if (location.pathname.startsWith('/companies/whedit/')) {
                const currentId = location.pathname.split('/').pop();
                console.log(CONFIG.LOG_PREFIX, "=== На странице whedit, ID:", currentId);

                // Проверяем, была ли уже отправлена форма
                const wasSubmitted = GM_getValue('wh_form_submitted', false);

                if (wasSubmitted) {
                    // Форма была отправлена, переходим к следующему складу
                    console.log(CONFIG.LOG_PREFIX, "Форма отправлена, переход к следующему");

                    const currentIndex = GM_getValue('wh_current_index', 0);
                    updateStatus(`✅ Склад ID=${currentId} обработан`);

                    GM_setValue('wh_current_index', currentIndex + 1);
                    GM_setValue('wh_form_submitted', false);

                    await sleep(2000);

                    console.log(CONFIG.LOG_PREFIX, "Возврат на /companies/edit/3");
                    window.location.href = 'https://fsedi.kz/companies/edit/3';
                    return;
                } else {
                    // Получаем данные для текущего склада
                    const matchedData = JSON.parse(GM_getValue('wh_matched_data', '[]'));
                    const currentIndex = GM_getValue('wh_current_index', 0);

                    if (currentIndex < matchedData.length) {
                        const warehouseData = matchedData[currentIndex];

                        // Проверяем что ID совпадает
                        if (warehouseData.id === currentId) {
                            console.log(CONFIG.LOG_PREFIX, "Заполнение формы склада");
                            await fillWarehouseForm(warehouseData);
                            return;
                        } else {
                            console.error(CONFIG.LOG_PREFIX, "Несоответствие ID! Ожидалось:", warehouseData.id, "Получено:", currentId);
                            updateStatus(`❌ Ошибка: несоответствие ID`);
                            GM_setValue('wh_is_running', false);
                            return;
                        }
                    } else {
                        console.log(CONFIG.LOG_PREFIX, "Все склады обработаны");
                        updateStatus('✅ Все склады обработаны');
                        GM_setValue('wh_is_running', false);
                        elements.status.classList.remove('running');
                        return;
                    }
                }
            }

            // Страница edit/3 - начало работы или переход к следующему складу
            if (location.pathname === '/companies/edit/3') {
                console.log(CONFIG.LOG_PREFIX, "=== На главной странице edit/3 ===");

                // Проверяем есть ли уже сопоставленные данные
                let matchedData = JSON.parse(GM_getValue('wh_matched_data', '[]'));

                if (matchedData.length === 0) {
                    // Первый запуск - нужно загрузить и сопоставить данные
                    console.log(CONFIG.LOG_PREFIX, "Первый запуск - загрузка и сопоставление данных");
                    updateStatus('Загрузка данных из Google Sheets...');

                    // Извлекаем склады со страницы
                    const warehouses = extractWarehousesFromPage();
                    if (warehouses.length === 0) {
                        throw new Error("Не найдено ни одного склада на странице");
                    }

                    // Загружаем данные из Google Sheets
                    const sheetData = await fetchSheetData();

                    // Сопоставляем данные
                    matchedData = matchWarehouseData(sheetData, warehouses);

                    if (matchedData.length === 0) {
                        throw new Error("Не удалось сопоставить ни одного склада");
                    }

                    // Сохраняем сопоставленные данные
                    GM_setValue('wh_matched_data', JSON.stringify(matchedData));
                    GM_setValue('wh_current_index', 0);

                    console.log(CONFIG.LOG_PREFIX, `Сопоставлено складов: ${matchedData.length}`);
                }

                // Получаем текущий индекс
                const currentIndex = GM_getValue('wh_current_index', 0);

                // Проверка завершения
                if (currentIndex >= matchedData.length) {
                    updateStatus('✅ Все склады обработаны');
                    GM_setValue('wh_is_running', false);
                    elements.status.classList.remove('running');
                    return;
                }

                // Получаем данные текущего склада
                const warehouseData = matchedData[currentIndex];
                updateStatus(`Переход к складу ID=${warehouseData.id} (${currentIndex + 1}/${matchedData.length})...`);

                await sleep(1000);

                const targetUrl = `https://fsedi.kz/companies/whedit/${warehouseData.id}`;
                console.log(CONFIG.LOG_PREFIX, "Переход на:", targetUrl);
                window.location.href = targetUrl;
                return;
            }

            // Если на другой странице - переход на edit/3
            console.log(CONFIG.LOG_PREFIX, "Переход на /companies/edit/3");
            window.location.href = 'https://fsedi.kz/companies/edit/3';

        } catch (err) {
            console.error(CONFIG.LOG_PREFIX, "Критическая ошибка:", err);
            updateStatus(`❌ Ошибка: ${err.message}`);
            GM_setValue('wh_is_running', false);
            elements.status.classList.remove('running');
        }
    };

    // Инициализация
    try {
        createUI();

        const isRunning = GM_getValue('wh_is_running', false);
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
