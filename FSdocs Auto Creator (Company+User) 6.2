// ==UserScript== 
// @name         FS-Sign Auto Creator (Company+User) 6.2 + Notifications
// @namespace    http://violentmonkey.github.io/
// @version      6.2
// @description  Создание компаний и/или пользователей из Google Sheets. Исправлена обработка скрытых уведомлений.
// @author       GrayRats
// @match        https://sign.fsdocs.kz/companies/add  
// @match        https://sign.fsdocs.kz/users/add  
// @match        https://sign.fsdocs.kz/users/edit/  *
// @match        https://sign.fsdocs.kz/companies/  *
// @match        https://sign.fsdocs.kz/companies
// @match        https://sign.fsdocs.kz/companies/*
// @match        https://sign.fsdocs.kz/companies/
// @match        https://sign.fsdocs.kz/users/edit/*
// @match        https://sign.fsdocs.kz/users/edit/
// @match        https://sign.fsdocs.kz/companies/edit/*
// @match        https://sign.fsdocs.kz/companies/add/*
// @match        https://sign.fsdocs.kz/companies/edit/  *
// @match        https://sign.fsdocs.kz/users
// @match        https://sign.fsdocs.kz/users/
// @match        https://sign.fsdocs.kz/users/*
// @match        https://sign.fsdocs.kz/users *
// @match        https://sign.fsdocs.kz/users*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @connect      sheets.googleapis.com
// @run-at       document-end
// ==/UserScript==
// https://sign.fsdocs.kz/companies/add
(function () {
    'use strict';

    // ===================================================================
    // КОНФИГУРАЦИЯ
    // ===================================================================
    const CONFIG = {
        SPREADSHEET_ID: "1pOZUWmTaB8qvlnheg4Vw4DLUnXaV1G7KerN1yqQy5Io",
        API_KEY: "AIzaSyARYjMuW8Krp3EirqedZoBPcweyhAfnJrg",
        SHEET_NAME: "Доступы",
        FROM_ROW: 4,
        TO_ROW: 570,

        MODES: {
            BOTH: 'both',
            COMPANIES_ONLY: 'companies_only',
            USERS_ONLY: 'users_only'
        },

        TIMING: {
            FIELD_DELAY: 1000,
            AFTER_SAVE: 3000,
            PAGE_LOAD_WAIT: 2000,
            POLL_INTERVAL: 500,
            WAIT_TIMEOUT: 14000,
            ELEMENT_CHECK: 300,
            RETRY_DELAY: 2000,
            NOTIFICATION_CHECK: 100  // Быстрая проверка уведомлений
        },

        STORAGE_KEYS: {
            STATE: 'fs_state_v6',
            FAILED_ROWS: 'fs_failed_rows_v6',
            PROGRESS_LOG: 'fs_progress_log_v6'
        }
    };

    // Колонки таблицы
    const COL = {
        TITLE: 0,
        BIN: 1,
        GLN: 2,
        ADMIN_EMAIL: 3,
        ADMIN_PASSWORD: 4,
        ADD_INFO: 7,
        COMPANY_EMAIL: 8,
        ADDRESS: 9
    };

    // ===================================================================
    // ЛОГИРОВАНИЕ
    // ===================================================================
    const Logger = {
        log: (...args) => console.log('[FSdocs v6.2]', ...args),
        warn: (...args) => console.warn('[FSdocs v6.2]', ...args),
        error: (...args) => console.error('[FSdocs v6.2]', ...args),
        step: (step, row) => console.log(`[FSdocs v6.2] ━━━ ${step} | Строка: ${row} ━━━`),
        success: (msg) => console.log('[FSdocs v6.2] ✅', msg)
    };

    // ===================================================================
    // УПРАВЛЕНИЕ СОСТОЯНИЕМ
    // ===================================================================
    class StateManager {
        constructor() {
            this.load();
        }

        load() {
            const saved = GM_getValue(CONFIG.STORAGE_KEYS.STATE, null);
            if (saved) {
                this.data = saved;
                Logger.log('Состояние загружено:', this.data);
            } else {
                this.reset();
            }
        }

        save() {
            GM_setValue(CONFIG.STORAGE_KEYS.STATE, this.data);
            Logger.log('💾 Состояние сохранено:', this.data);
        }

        reset() {
            this.data = {
                isRunning: false,
                currentRow: CONFIG.FROM_ROW,
                currentStep: 'idle',
                mode: CONFIG.MODES.BOTH,
                companyCreated: false,
                userCreated: false,
                gln_bound: false
            };
            this.save();
        }

        get(key) {
            return this.data[key];
        }

        set(key, value) {
            this.data[key] = value;
            this.save();
        }

        setMultiple(updates) {
            Object.assign(this.data, updates);
            this.save();
        }

        nextRow() {
            this.data.currentRow++;
            this.data.currentStep = 'idle';
            this.data.companyCreated = false;
            this.data.userCreated = false;
            this.data.gln_bound = false;
            this.save();
        }

        markFailed(reason) {
            const failed = GM_getValue(CONFIG.STORAGE_KEYS.FAILED_ROWS, []);
            failed.push({
                row: this.data.currentRow,
                reason: reason,
                timestamp: new Date().toISOString()
            });
            GM_setValue(CONFIG.STORAGE_KEYS.FAILED_ROWS, failed);
            Logger.error(`❌ Строка ${this.data.currentRow} провалилась: ${reason}`);
        }
    }

    const state = new StateManager();

    // ===================================================================
    // ПРОВЕРКА АВТОРИЗАЦИИ
    // ===================================================================
    if (document.body.textContent.includes('Пожалуйста, авторизуйтесь')) {
        Logger.error("Требуется авторизация!");
        return;
    }

    // ===================================================================
    // UI
    // ===================================================================
    const UI = {
        elements: {},

        createStyles() {
            const style = document.createElement('style');
            style.textContent = `
                #fs-auto-ui {
                    position: fixed; top: 20px; right: 20px;
                    background: #fff; border: 2px solid #3498db;
                    border-radius: 10px; padding: 20px;
                    box-shadow: 0 6px 14px rgba(0,0,0,0.3);
                    z-index: 2147483647;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    min-width: 320px; max-width: 400px;
                }
                #fs-auto-ui h4 { margin: 0 0 15px; color: #3498db; text-align: center; }
                #fs-auto-ui .status {
                    margin: 10px 0; padding: 10px;
                    background: #ecf0f1; border-radius: 5px;
                    text-align: center; font-weight: 500;
                }
                #fs-auto-ui .status.active { animation: pulse 1.5s infinite; }
                #fs-auto-ui .status.error { background: #f8d7da; color: #721c24; animation: none; }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                #fs-auto-ui .field { margin: 10px 0; }
                #fs-auto-ui label { display: block; margin-bottom: 5px; font-weight: 500; }
                #fs-auto-ui select, #fs-auto-ui input {
                    width: 100%; padding: 8px; border: 1px solid #3498db;
                    border-radius: 5px; box-sizing: border-box;
                }
                #fs-auto-ui .controls { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 15px; }
                #fs-auto-ui button {
                    padding: 10px; font-weight: 600; border: none;
                    border-radius: 5px; color: white; cursor: pointer;
                }
                .btn-start { background: #2ecc71; }
                .btn-start:hover { background: #27ae60; }
                .btn-stop { background: #e74c3c; }
                .btn-stop:hover { background: #c0392b; }
                .btn-reset { background: #3498db; }
                .btn-reset:hover { background: #2980b9; }
                .btn-continue { background: #f39c12; grid-column: span 2; }
                .btn-continue:hover { background: #e67e22; }
            `;
            document.head.appendChild(style);
        },

        create() {
            if (document.getElementById('fs-auto-ui')) return;

            this.createStyles();

            const ui = document.createElement('div');
            ui.id = 'fs-auto-ui';
            ui.innerHTML = `
                <h4>FSdocs Auto v6.2</h4>
                <div class="status" id="fs-status">Готов к запуску</div>
                <div class="field">
                    <label>Режим:</label>
                    <select id="fs-mode">
                        <option value="both">Компании + Пользователи</option>
                        <option value="companies_only">Только Компании</option>
                        <option value="users_only">Только Пользователи</option>
                    </select>
                </div>
                <div class="field">
                    <label>Текущая строка:</label>
                    <input type="number" id="fs-row" min="${CONFIG.FROM_ROW}" max="${CONFIG.TO_ROW}" value="${state.get('currentRow')}">
                </div>
                <div class="controls">
                    <button class="btn-start" id="fs-start">▶️ Старт</button>
                    <button class="btn-stop" id="fs-stop">⏹️ Стоп</button>
                    <button class="btn-reset" id="fs-reset">🔄 Сброс</button>
                    <button class="btn-continue" id="fs-continue" style="display:none;">➡️ Продолжить</button>
                </div>
            `;

            document.body.appendChild(ui);

            this.elements.status = document.getElementById('fs-status');
            this.elements.mode = document.getElementById('fs-mode');
            this.elements.row = document.getElementById('fs-row');
            this.elements.startBtn = document.getElementById('fs-start');
            this.elements.stopBtn = document.getElementById('fs-stop');
            this.elements.resetBtn = document.getElementById('fs-reset');
            this.elements.continueBtn = document.getElementById('fs-continue');

            this.elements.mode.value = state.get('mode');
            this.elements.row.value = state.get('currentRow');

            this.elements.startBtn.onclick = () => this.start();
            this.elements.stopBtn.onclick = () => this.stop();
            this.elements.resetBtn.onclick = () => this.reset();
            this.elements.continueBtn.onclick = () => this.continue();
            this.elements.mode.onchange = (e) => state.set('mode', e.target.value);
            this.elements.row.onchange = (e) => state.set('currentRow', parseInt(e.target.value));

            Logger.success('UI создан');
        },

        updateStatus(text, active = false, isError = false) {
            if (this.elements.status) {
                this.elements.status.textContent = text;
                this.elements.status.classList.toggle('active', active);
                this.elements.status.classList.toggle('error', isError);
            }
        },

        showContinueButton(show) {
            if (this.elements.continueBtn) {
                this.elements.continueBtn.style.display = show ? 'block' : 'none';
            }
        },

        start() {
            state.setMultiple({
                isRunning: true,
                mode: this.elements.mode.value,
                currentRow: parseInt(this.elements.row.value)
            });
            this.showContinueButton(false);
            this.updateStatus('🔄 Запуск...', true);
            Logger.log('═══ ЗАПУСК СКРИПТА ═══');
            setTimeout(() => main(), 1000);
        },

        stop() {
            state.set('isRunning', false);
            this.showContinueButton(false);
            this.updateStatus('⏹️ Остановлено', false);
            Logger.log('Скрипт остановлен');
        },

        reset() {
            state.reset();
            GM_deleteValue(CONFIG.STORAGE_KEYS.FAILED_ROWS);
            GM_deleteValue(CONFIG.STORAGE_KEYS.PROGRESS_LOG);
            this.elements.row.value = CONFIG.FROM_ROW;
            this.showContinueButton(false);
            this.updateStatus('🔄 Сброшено', false);
            Logger.log('Прогресс сброшен');
        },

        continue() {
            this.showContinueButton(false);
            state.set('isRunning', true);
            this.updateStatus('🔄 Продолжение...', true);
            Logger.log('═══ ПРОДОЛЖЕНИЕ СКРИПТА ═══');
            setTimeout(() => main(), 1000);
        }
    };

    // ===================================================================
    // УТИЛИТЫ
    // ===================================================================
    const Utils = {
        sleep: (ms) => new Promise(r => setTimeout(r, ms)),

        async fetchSheet() {
            const range = `${CONFIG.SHEET_NAME}!A${CONFIG.FROM_ROW}:J${CONFIG.TO_ROW}`;
            const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${range}?key=${CONFIG.API_KEY}`;

            Logger.log('📥 Загрузка данных из Google Sheets...');

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Google Sheets API error: ${response.status}`);
            }

            const data = await response.json();
            const rows = data.values || [];

            Logger.success(`Загружено ${rows.length} строк`);
            return rows;
        },

        async waitForElement(selector, timeout = CONFIG.TIMING.WAIT_TIMEOUT, checkVisibility = true) {
            const start = Date.now();
            while (Date.now() - start < timeout) {
                const el = document.querySelector(selector);
                if (el) {
                    // Если не требуется проверка видимости, или элемент видим
                    if (!checkVisibility || el.offsetParent !== null) {
                        Logger.log(`✓ Элемент найден: ${selector}`);
                        return el;
                    }
                    // Элемент найден, но скрыт - это тоже успех для некоторых случаев
                    if (!checkVisibility) {
                        Logger.log(`✓ Элемент найден (скрыт): ${selector}`);
                        return el;
                    }
                }
                await this.sleep(CONFIG.TIMING.ELEMENT_CHECK);
            }
            Logger.warn(`✗ Элемент не найден: ${selector}`);
            return null;
        },

        setValue(element, value) {
            if (!element) return false;

            if (element.type === 'checkbox') {
                element.checked = !!value;
            } else {
                element.value = String(value || '');
            }

            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));

            Logger.log(`  ↳ ${element.name || element.id}: "${value}"`);
            return true;
        },

        findSaveButton() {
            const buttons = [...document.querySelectorAll('button, input[type="submit"]')];
            return buttons.find(b => /сохран/i.test(b.textContent + b.value));
        },

        // ПОЛНОСТЬЮ ПЕРЕПИСАННЫЙ МЕТОД - теперь проверяет СКРЫТЫЕ уведомления
        getNotificationMessages() {
            const messages = {
                success: [],
                error: [],
                info: [],
                warning: []
            };

            // Ищем ВСЕ уведомления, включая скрытые
            const alerts = document.querySelectorAll('.alert, .alerts .alert, div.alert');
            
            Logger.log(`🔍 Найдено ${alerts.length} уведомлений (включая скрытые)`);

            alerts.forEach((alert, index) => {
                const text = alert.textContent.trim();
                const classes = alert.className || '';
                const display = alert.style.display || getComputedStyle(alert).display;
                
                Logger.log(`  [${index}] Текст: "${text.substring(0, 50)}..."`);
                Logger.log(`      Классы: "${classes}"`);
                Logger.log(`      Display: "${display}"`);

                if (!text) return;

                // Определяем тип уведомления
                if (classes.includes('alert-success') || /сохранено|создан|успешно|обновлен/i.test(text)) {
                    messages.success.push({ text, element: alert, display });
                } else if (classes.includes('alert-danger') || /дубликат|ошибка|не удалось|не найден/i.test(text)) {
                    messages.error.push({ text, element: alert, display });
                } else if (classes.includes('alert-warning') || /внимание|предупреждение/i.test(text)) {
                    messages.warning.push({ text, element: alert, display });
                } else if (classes.includes('alert-info') || /информация/i.test(text)) {
                    messages.info.push({ text, element: alert, display });
                }
            });

            Logger.log(`  ✅ Успех: ${messages.success.length}`);
            Logger.log(`  ❌ Ошибки: ${messages.error.length}`);
            Logger.log(`  ⚠️ Предупреждения: ${messages.warning.length}`);
            Logger.log(`  ℹ️ Информация: ${messages.info.length}`);

            return messages;
        },

        // Проверяет наличие сообщения о дубликате (даже скрытого)
        hasDuplicate() {
            const messages = this.getNotificationMessages();
            
            for (const error of messages.error) {
                if (/дубликат/i.test(error.text)) {
                    Logger.warn(`⚠️ Найдено сообщение о дубликате: "${error.text}"`);
                    Logger.warn(`    Display: ${error.display}`);
                    return true;
                }
            }
            
            return false;
        },

        // Проверяет наличие сообщения об успехе (даже скрытого)
        hasSuccess() {
            const messages = this.getNotificationMessages();
            
            for (const success of messages.success) {
                if (/сохранено|создан|успешно/i.test(success.text)) {
                    Logger.success(`✅ Найдено сообщение об успехе: "${success.text}"`);
                    Logger.success(`    Display: ${success.display}`);
                    return true;
                }
            }
            
            return false;
        },

        // Ждет появления уведомления любого типа (даже скрытого)
        async waitForAnyNotification(timeout = CONFIG.TIMING.WAIT_TIMEOUT) {
            return new Promise((resolve) => {
                const start = Date.now();
                
                // Проверяем существующие уведомления
                const existing = this.getNotificationMessages();
                if (existing.success.length > 0 || existing.error.length > 0) {
                    Logger.log('✓ Уведомления уже присутствуют на странице');
                    resolve(existing);
                    return;
                }

                // Наблюдаем за изменениями в DOM
                const observer = new MutationObserver(() => {
                    const msgs = this.getNotificationMessages();
                    if (msgs.success.length > 0 || msgs.error.length > 0) {
                        Logger.log('✓ Уведомления обнаружены через MutationObserver');
                        observer.disconnect();
                        clearTimeout(timer);
                        resolve(msgs);
                    }
                });

                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true,
                    characterData: true
                });

                // Таймер для выхода
                const timer = setTimeout(() => {
                    observer.disconnect();
                    Logger.warn(`✗ Таймаут ожидания уведомлений (${timeout}мс)`);
                    resolve({ success: [], error: [], info: [], warning: [] });
                }, timeout);
            });
        }
    };

    // ===================================================================
    // ОБРАБОТЧИКИ ДЕЙСТВИЙ
    // ===================================================================
    const Actions = {
        async createCompany(rowData) {
            Logger.step('СОЗДАНИЕ КОМПАНИИ', state.get('currentRow'));

            const fields = [
                { sel: 'input[name="title"]', val: rowData[COL.TITLE], req: true },
                { sel: 'input[name="bin"]', val: rowData[COL.BIN], req: true },
                { sel: 'input[name="gln"]', val: rowData[COL.GLN], req: true },
                { sel: 'input[name="address"]', val: rowData[COL.ADDRESS], req: false },
                { sel: 'input[name="email"]', val: rowData[COL.COMPANY_EMAIL], req: false },
                { sel: 'input[name="add_info"]', val: rowData[COL.ADD_INFO], req: false }
            ];

            for (const field of fields) {
                if (!field.val && !field.req) continue;

                const el = await Utils.waitForElement(field.sel);
                if (!el && field.req) {
                    throw new Error(`Поле не найдено: ${field.sel}`);
                }
                if (el) {
                    Utils.setValue(el, field.val);
                    await Utils.sleep(CONFIG.TIMING.FIELD_DELAY);
                }
            }

            const saveBtn = Utils.findSaveButton();
            if (!saveBtn) throw new Error('Кнопка сохранения не найдена');

            Logger.log('💾 Сохранение компании...');
            saveBtn.click();

            await Utils.sleep(CONFIG.TIMING.AFTER_SAVE);
        },

        async createUser(rowData) {
            Logger.step('СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ', state.get('currentRow'));

            const nameEl = await Utils.waitForElement('#name');
            Utils.setValue(nameEl, "Администратор");
            await Utils.sleep(CONFIG.TIMING.FIELD_DELAY);

            const activeEl = await Utils.waitForElement('#active[type="checkbox"]');
            if (activeEl && !activeEl.checked) {
                activeEl.click();
                await Utils.sleep(500);
            }

            const emailEl = await Utils.waitForElement('#email');
            Utils.setValue(emailEl, rowData[COL.ADMIN_EMAIL]);
            await Utils.sleep(CONFIG.TIMING.FIELD_DELAY);

            const passEl = await Utils.waitForElement('#password');
            Utils.setValue(passEl, rowData[COL.ADMIN_PASSWORD]);
            await Utils.sleep(CONFIG.TIMING.FIELD_DELAY);

            const roleEl = await Utils.waitForElement('#role');
            if (roleEl) {
                const companyOpt = [...roleEl.options].find(o => o.value === 'company');
                if (companyOpt) {
                    roleEl.value = companyOpt.value;
                    roleEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            const saveBtn = Utils.findSaveButton();
            if (!saveBtn) throw new Error('Кнопка сохранения не найдена');

            Logger.log('💾 Сохранение пользователя...');
            saveBtn.click();

            await Utils.sleep(CONFIG.TIMING.AFTER_SAVE);
        },

        async bindCompany(rowData) {
            Logger.step('ПРИВЯЗКА GLN', state.get('currentRow'));

            // Проверяем, не привязан ли уже GLN
            if (state.get('gln_bound')) {
                Logger.log('GLN уже привязан, пропуск');
                return true;
            }

            const select = await Utils.waitForElement('select[name="comp"]');
            if (!select) {
                Logger.warn('Select[name="comp"] не найден');
                return false;
            }

            const gln = (rowData[COL.GLN] || '').replace(/\D/g, '');
            const title = rowData[COL.TITLE] || '';

            Logger.log(`Поиск компании: GLN=${gln}, Название=${title}`);

            const option = [...select.options].find(opt => {
                const text = opt.textContent.trim();
                return text.includes(gln) || text.toLowerCase().includes(title.toLowerCase());
            });

            if (!option) {
                Logger.warn('Компания не найдена в списке');
                return false;
            }

            Logger.log(`Найдена компания: ${option.textContent}`);
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));

            const saveBtn = Utils.findSaveButton();
            if (saveBtn) {
                Logger.log('💾 Сохранение привязки...');
                saveBtn.click();
                await Utils.sleep(CONFIG.TIMING.AFTER_SAVE);
            }

            state.set('gln_bound', true);
            return true;
        }
    };

    // ===================================================================
    // ОСНОВНАЯ ЛОГИКА
    // ===================================================================
    async function main() {
        Logger.log('───────────────────────────────────');
        Logger.log(`Режим: ${state.get('mode')}`);
        Logger.log(`Строка: ${state.get('currentRow')}`);
        Logger.log(`Шаг: ${state.get('currentStep')}`);
        Logger.log(`Страница: ${location.pathname}`);
        Logger.log('───────────────────────────────────');

        if (!state.get('isRunning')) {
            Logger.log('Скрипт не активен');
            return;
        }

        try {
            // Проверка завершения
            if (state.get('currentRow') > CONFIG.TO_ROW) {
                Logger.success('🎉 ВСЕ СТРОКИ ОБРАБОТАНЫ!');
                UI.updateStatus('✅ Завершено', false);
                state.set('isRunning', false);
                UI.showContinueButton(false);
                return;
            }

            // Загрузка данных
            const allRows = await Utils.fetchSheet();
            const rowIndex = state.get('currentRow') - CONFIG.FROM_ROW;
            const rowData = allRows[rowIndex];

            if (!rowData || rowData.length < 10) {
                Logger.warn('Недостаточно данных, пропуск строки');
                state.nextRow();
                setTimeout(main, 1000);
                return;
            }

            // Валидация обязательных полей
            if (!rowData[COL.TITLE] || !rowData[COL.BIN] || !rowData[COL.GLN]) {
                Logger.warn('Отсутствуют обязательные поля, пропуск');
                state.markFailed('Отсутствуют обязательные поля');
                state.nextRow();
                setTimeout(main, 1000);
                return;
            }

            const mode = state.get('mode');
            const currentStep = state.get('currentStep');

            UI.updateStatus(`Обработка строки ${state.get('currentRow')}...`, true);

            // ═══════════════════════════════════════════════════════
            // РЕЖИМ: COMPANIES_ONLY
            // ═══════════════════════════════════════════════════════
            if (mode === CONFIG.MODES.COMPANIES_ONLY) {
                // Страница добавления компании
                if (location.pathname === '/companies/add') {
                    Logger.log('📝 Страница добавления компании');
                    await Actions.createCompany(rowData);
                    state.set('currentStep', 'company_creating');
                    Logger.log('⏳ Ожидание редиректа на /companies/edit/...');
                    return; // Ждем редиректа
                }

                // Страница редактирования (после редиректа)
                if (location.pathname.startsWith('/companies/edit/')) {
                    Logger.log('📄 Страница редактирования компании');

                    // Даём странице время загрузиться
                    await Utils.sleep(2000);

                    // ПОЛНАЯ ДИАГНОСТИКА УВЕДОМЛЕНИЙ
                    Logger.log('🔍 ПОЛНАЯ ДИАГНОСТИКА УВЕДОМЛЕНИЙ:');
                    const allMessages = Utils.getNotificationMessages();
                    Logger.log(`  Всего уведомлений: ${allMessages.success.length + allMessages.error.length + allMessages.warning.length + allMessages.info.length}`);

                    // Проверка дубликата - ИСПОЛЬЗУЕМ НОВЫЙ МЕТОД
                    Logger.log('🔍 Проверка на дубликат (включая скрытые)...');
                    if (Utils.hasDuplicate()) {
                        const currentRowNum = state.get('currentRow');
                        Logger.warn(`⚠️ Дубликат компании в строке ${currentRowNum}`);
                        state.markFailed('Дубликат компании');
                        state.nextRow(); // Переходим к следующей строке
                        UI.updateStatus(`⚠️ Дубликат (строка ${currentRowNum}). Скрипт остановлен.`, true, true);
                        UI.showContinueButton(true);
                        state.set('isRunning', false); // ОСТАНАВЛИВАЕМ СКРИПТ
                        return;
                    }

                    // Проверка успеха - ИСПОЛЬЗУЕМ НОВЫЙ МЕТОД
                    Logger.log('🔍 Проверка успешного создания (включая скрытые)...');
                    if (Utils.hasSuccess()) {
                        const prevRow = state.get('currentRow');
                        Logger.success(`✅ Компания создана успешно (строка ${prevRow})`);
                        state.nextRow();
                        UI.updateStatus(`✅ Компания ${prevRow} создана, переход к ${state.get('currentRow')}`, true);
                        await Utils.sleep(2000);
                        Logger.log('🔀 Редирект на /companies/add');
                        location.href = '/companies/add';
                        return;
                    }

                    // Если ни дубликата, ни успеха - ждем появления уведомления
                    Logger.log('⏳ Ожидание появления уведомления (включая скрытые)...');
                    const messages = await Utils.waitForAnyNotification(8000);

                    if (messages.error.length > 0) {
                        for (const error of messages.error) {
                            Logger.log(`📨 Получено сообщение об ошибке: "${error.text}"`);
                            
                            if (/дубликат/i.test(error.text)) {
                                const currentRowNum = state.get('currentRow');
                                Logger.warn('⚠️ Сообщение содержит "дубликат"');
                                state.markFailed('Дубликат компании');
                                state.nextRow();
                                UI.updateStatus(`⚠️ Дубликат (строка ${currentRowNum}). Скрипт остановлен.`, true, true);
                                UI.showContinueButton(true);
                                state.set('isRunning', false);
                                return;
                            }
                        }
                    }

                    if (messages.success.length > 0 || messages.error.length === 0) {
                        // Считаем успехом если есть успех или нет ошибок
                        const prevRow = state.get('currentRow');
                        state.nextRow();
                        UI.updateStatus(`➡️ Строка ${prevRow} обработана, переход к ${state.get('currentRow')}`, true);
                        await Utils.sleep(2000);
                        Logger.log('🔀 Редирект на /companies/add');
                        location.href = '/companies/add';
                        return;
                    }

                    // Таймаут - считаем успехом и продолжаем
                    Logger.warn('⏱️ Таймаут ожидания уведомлений');
                    Logger.log('  → Проверяем, что мы на странице редактирования (значит создание произошло)');

                    const prevRow = state.get('currentRow');
                    state.nextRow();
                    UI.updateStatus(`⚠️ Таймаут для ${prevRow}, считаем успехом, переход к ${state.get('currentRow')}`, true);
                    await Utils.sleep(2000);
                    Logger.log('🔀 Редирект на /companies/add');
                    location.href = '/companies/add';
                    return;
                }

                // Другие страницы - возврат к добавлению
                Logger.log('🔀 Неожиданная страница, переход к /companies/add');
                location.href = '/companies/add';
                return;
            }

            // ═══════════════════════════════════════════════════════
            // РЕЖИМ: USERS_ONLY
            // ═══════════════════════════════════════════════════════
            if (mode === CONFIG.MODES.USERS_ONLY) {
                // Валидация полей пользователя
                if (!rowData[COL.ADMIN_EMAIL] || !rowData[COL.ADMIN_PASSWORD]) {
                    Logger.warn('Отсутствуют email/пароль, пропуск');
                    state.markFailed('Отсутствуют данные пользователя');
                    state.nextRow();
                    setTimeout(main, 1000);
                    return;
                }

                // Страница добавления пользователя
                if (location.pathname === '/users/add') {
                    await Actions.createUser(rowData);
                    state.set('currentStep', 'user_creating');
                    return; // Ждем редиректа
                }

                // Страница редактирования пользователя
                if (location.pathname.startsWith('/users/edit/')) {
                    // Привязка компании
                    await Actions.bindCompany(rowData);

                    // Проверка успеха
                    Logger.log('🔍 Проверка создания пользователя (включая скрытые)...');
                    if (Utils.hasSuccess()) {
                        Logger.success(`Пользователь создан (строка ${state.get('currentRow')})`);
                        state.nextRow();
                        await Utils.sleep(2000);
                        location.href = '/users/add';
                        return;
                    }

                    // Ждем уведомлений
                    const messages = await Utils.waitForAnyNotification(5000);
                    if (messages.success.length > 0 || state.get('gln_bound')) {
                        Logger.success(`Пользователь создан (строка ${state.get('currentRow')})`);
                        state.nextRow();
                        await Utils.sleep(2000);
                        location.href = '/users/add';
                        return;
                    }

                    // Ошибка - пропускаем
                    Logger.warn('Пользователь не создан, пропуск');
                    state.markFailed('Ошибка создания пользователя');
                    state.nextRow();
                    await Utils.sleep(2000);
                    location.href = '/users/add';
                    return;
                }

                // Другие страницы
                Logger.log('Переход к /users/add');
                location.href = '/users/add';
                return;
            }

            // ═══════════════════════════════════════════════════════
            // РЕЖИМ: BOTH
            // ═══════════════════════════════════════════════════════
            if (mode === CONFIG.MODES.BOTH) {
                // Валидация всех полей
                if (!rowData[COL.ADMIN_EMAIL] || !rowData[COL.ADMIN_PASSWORD]) {
                    Logger.warn('Отсутствуют email/пароль, пропуск');
                    state.markFailed('Отсутствуют данные пользователя');
                    state.nextRow();
                    setTimeout(main, 1000);
                    return;
                }

                // ШАГ 1: Создание компании
                if (currentStep === 'idle' || currentStep === 'company_creating') {
                    if (location.pathname === '/companies/add') {
                        Logger.log('📝 Страница добавления компании (режим BOTH)');
                        await Actions.createCompany(rowData);
                        state.set('currentStep', 'company_creating');
                        Logger.log('⏳ Ожидание редиректа...');
                        return;
                    }

                    if (location.pathname.startsWith('/companies/edit/')) {
                        Logger.log('📄 Страница редактирования компании (режим BOTH)');

                        // Даём время на загрузку
                        await Utils.sleep(2000);

                        // Проверка дубликата - ИСПОЛЬЗУЕМ НОВЫЙ МЕТОД
                        Logger.log('🔍 Проверка на дубликат (включая скрытые)...');
                        if (Utils.hasDuplicate()) {
                            const currentRowNum = state.get('currentRow');
                            Logger.warn(`⚠️ Дубликат компании в строке ${currentRowNum}`);
                            state.markFailed('Дубликат компании');
                            state.nextRow();
                            UI.updateStatus(`⚠️ Дубликат (строка ${currentRowNum}). Скрипт остановлен.`, true, true);
                            UI.showContinueButton(true);
                            state.set('isRunning', false); // ОСТАНАВЛИВАЕМ СКРИПТ
                            return;
                        }

                        // Проверка успеха - ИСПОЛЬЗУЕМ НОВЫЙ МЕТОД
                        Logger.log('🔍 Проверка успешного создания компании (включая скрытые)...');
                        if (Utils.hasSuccess()) {
                            Logger.success('✅ Компания создана, переход к созданию пользователя');
                            state.set('currentStep', 'create_user');
                            state.set('companyCreated', true);
                            await Utils.sleep(2000);
                            Logger.log('🔀 Редирект на /users/add');
                            location.href = '/users/add';
                            return;
                        }

                        // Ждем появления уведомления
                        Logger.log('⏳ Ожидание появления уведомления (включая скрытые)...');
                        const messages = await Utils.waitForAnyNotification(8000);

                        if (messages.error.length > 0) {
                            for (const error of messages.error) {
                                if (/дубликат/i.test(error.text)) {
                                    const currentRowNum = state.get('currentRow');
                                    Logger.warn(`⚠️ Получено сообщение о дубликате в строке ${currentRowNum}`);
                                    state.markFailed('Дубликат компании (по сообщению)');
                                    state.nextRow();
                                    UI.updateStatus(`⚠️ Дубликат (строка ${currentRowNum}). Скрипт остановлен.`, true, true);
                                    UI.showContinueButton(true);
                                    state.set('isRunning', false);
                                    return;
                                }
                            }
                        }

                        // Компания создана - переход к пользователю
                        Logger.success('✅ Компания создана, переход к созданию пользователя');
                        state.set('currentStep', 'create_user');
                        state.set('companyCreated', true);
                        await Utils.sleep(2000);
                        Logger.log('🔀 Редирект на /users/add');
                        location.href = '/users/add';
                        return;
                    }

                    // Не на той странице
                    Logger.log('🔀 Переход на /companies/add');
                    location.href = '/companies/add';
                    return;
                }

                // ШАГ 2: Создание пользователя
                if (currentStep === 'create_user' || currentStep === 'user_creating') {
                    if (location.pathname === '/users/add') {
                        Logger.log('👤 Страница добавления пользователя (режим BOTH)');
                        await Actions.createUser(rowData);
                        state.set('currentStep', 'user_creating');
                        Logger.log('⏳ Ожидание редиректа на /users/edit/...');
                        return;
                    }

                    if (location.pathname.startsWith('/users/edit/')) {
                        Logger.log('📄 Страница редактирования пользователя (режим BOTH)');

                        // Привязка компании
                        await Actions.bindCompany(rowData);

                        // Проверка успеха - ИСПОЛЬЗУЕМ НОВЫЙ МЕТОД
                        Logger.log('🔍 Проверка создания пользователя (включая скрытые)...');
                        if (Utils.hasSuccess()) {
                            Logger.success(`✅ Пользователь создан (строка ${state.get('currentRow')})`);
                            state.nextRow();
                            await Utils.sleep(2000);
                            Logger.log('🔀 Редирект на /companies/add');
                            location.href = '/companies/add';
                            return;
                        }

                        // Ждем уведомлений
                        Logger.log('⏳ Ожидание появления уведомления (включая скрытые)...');
                        const messages = await Utils.waitForAnyNotification(8000);

                        if (messages.success.length > 0 || state.get('gln_bound')) {
                            Logger.success(`✅ Пользователь создан (строка ${state.get('currentRow')})`);
                            state.nextRow();
                            await Utils.sleep(2000);
                            Logger.log('🔀 Редирект на /companies/add');
                            location.href = '/companies/add';
                            return;
                        }

                        // Ошибка - пропускаем
                        Logger.warn('❌ Пользователь не создан, переход к следующей строке');
                        state.markFailed('Ошибка создания пользователя');
                        state.nextRow();
                        await Utils.sleep(2000);
                        Logger.log('🔀 Редирект на /companies/add');
                        location.href = '/companies/add';
                        return;
                    }

                    // Не на той странице
                    Logger.log('🔀 Переход на /users/add');
                    location.href = '/users/add';
                    return;
                }
            }

            // Если дошли сюда - что-то не так
            Logger.error('Неожиданное состояние!');
            Logger.error(`Mode: ${mode}, Step: ${currentStep}, Path: ${location.pathname}`);

        } catch (err) {
            Logger.error('❌ Критическая ошибка:', err);
            UI.updateStatus(`❌ Ошибка: ${err.message}`, false, true);
            state.markFailed(err.message);
            state.set('isRunning', false);
            UI.showContinueButton(true);
        }
    }

    // ===================================================================
    // ИНИЦИАЛИЗАЦИЯ
    // ===================================================================
    (async () => {
        UI.create();

        Logger.log('═══════════════════════════════════');
        Logger.success('FSdocs Auto v6.2 загружен');
        Logger.log(`Режим: ${state.get('mode')}`);
        Logger.log(`Текущая строка: ${state.get('currentRow')}`);
        Logger.log(`Шаг: ${state.get('currentStep')}`);
        Logger.log(`isRunning: ${state.get('isRunning')}`);
        Logger.log('═══════════════════════════════════');

        // Автовозобновление
        if (state.get('isRunning')) {
            Logger.log('🔄 Автовозобновление скрипта...');
            UI.updateStatus('🔄 Продолжение...', true);
            await Utils.sleep(CONFIG.TIMING.PAGE_LOAD_WAIT);
            main();
        }
    })();
})();
