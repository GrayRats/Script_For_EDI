// ==UserScript==
// @name         Fsedi.kz Warehouse Exporter to XLSX Table
// @namespace    http://violentmonkey.github.io/
// @version      1.0
// @description  Извлечение данных таблицы со страницы fsedi.kz/companies/edit/* в XLSX
// @author       You
// @match        https://fsedi.kz/companies/edit/*
// @match        https://edi.fsdocs.kz/companies/edit/*
// @grant        none
// @run-at       document-end
// @require      https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js
// ==/UserScript==

(function () {
    'use strict';

    const LOG_PREFIX = "[FsediExport]";

    // Создание UI кнопки
    const createExportButton = () => {
        const button = document.createElement('button');
        button.id = 'fsedi-export-btn';
        button.textContent = '📊 Экспорт в XLSX';
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 2147483647;
            padding: 12px 20px;
            background: #2ecc71;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transition: all 0.3s;
        `;

        button.onmouseover = () => {
            button.style.background = '#27ae60';
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
        };

        button.onmouseout = () => {
            button.style.background = '#2ecc71';
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        };

        button.onclick = exportTableToXLSX;

        document.body.appendChild(button);
        console.log(LOG_PREFIX, "Кнопка экспорта создана");
    };

    // Извлечение данных из таблицы
    const extractTableData = () => {
        try {
            console.log(LOG_PREFIX, "Начало извлечения данных...");

            // Ищем tbody таблицы
            const tbody = document.querySelector('tbody');
            if (!tbody) {
                throw new Error("Таблица tbody не найдена на странице");
            }

            // Массив для хранения данных
            const data = [];

            // Добавляем заголовки
            data.push(['ID', 'Город', 'Название', 'GLN']);

            // Извлекаем строки из tbody
            const rows = tbody.querySelectorAll('tr');
            console.log(LOG_PREFIX, `Найдено строк: ${rows.length}`);

            rows.forEach((row, index) => {
                const cells = row.querySelectorAll('td');

                if (cells.length >= 3) {
                    // Извлечение ID из ссылки whedit
                    let id = '';
                    const whLink = cells[1].querySelector('a.wh[href^="/companies/whedit/"]');
                    if (whLink) {
                        const href = whLink.getAttribute('href');
                        const match = href.match(/\/companies\/whedit\/(\d+)/);
                        if (match) {
                            id = match[1];
                        }
                    }

                    const city = cells[0].textContent.trim();
                    const title = cells[1].textContent.trim();
                    const gln = cells[2].textContent.trim();

                    data.push([id, city, title, gln]);

                    console.log(LOG_PREFIX, `Строка ${index + 1}:`, { id, city, title, gln });
                }
            });

            console.log(LOG_PREFIX, `Извлечено записей: ${data.length - 1}`);
            return data;

        } catch (err) {
            console.error(LOG_PREFIX, "Ошибка извлечения данных:", err);
            alert(`Ошибка: ${err.message}`);
            return null;
        }
    };

    // Экспорт в XLSX
    const exportTableToXLSX = () => {
        try {
            console.log(LOG_PREFIX, "Запуск экспорта в XLSX...");

            // Проверка наличия библиотеки XLSX
            if (typeof XLSX === 'undefined') {
                throw new Error("Библиотека XLSX не загружена");
            }

            // Извлечение данных
            const data = extractTableData();
            if (!data || data.length <= 1) {
                alert("Нет данных для экспорта!");
                return;
            }

            // Создание workbook
            const wb = XLSX.utils.book_new();

            // Создание worksheet из данных
            const ws = XLSX.utils.aoa_to_sheet(data);

            // Установка ширины колонок
            ws['!cols'] = [
                { wch: 10 },  // ID
                { wch: 20 },  // Город
                { wch: 40 },  // Название
                { wch: 20 }   // GLN
            ];

            // Добавление worksheet в workbook
            XLSX.utils.book_append_sheet(wb, ws, "Склады");

            // Генерация имени файла с датой
            const date = new Date();
            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
            const companyId = window.location.pathname.split('/').pop();
            const filename = `fsedi_warehouses_${companyId}_${dateStr}.xlsx`;

            // Экспорт файла
            XLSX.writeFile(wb, filename);

            console.log(LOG_PREFIX, `✅ Файл ${filename} успешно экспортирован`);

            // Уведомление пользователя
            const button = document.getElementById('fsedi-export-btn');
            const originalText = button.textContent;
            button.textContent = '✅ Экспортировано!';
            button.style.background = '#3498db';

            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '#2ecc71';
            }, 2000);

        } catch (err) {
            console.error(LOG_PREFIX, "Ошибка экспорта:", err);
            alert(`Ошибка экспорта: ${err.message}`);
        }
    };

    // Инициализация
    try {
        // Небольшая задержка для полной загрузки страницы
        setTimeout(() => {
            createExportButton();
            console.log(LOG_PREFIX, "✅ Скрипт инициализирован");
        }, 1000);
    } catch (err) {
        console.error(LOG_PREFIX, "Ошибка инициализации:", err);
    }
})();
