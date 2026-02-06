// ==UserScript==
// @name FS-EDI Company выгрузка CSV/XLSX Export Table
// @namespace http://tampermonkey.net/
// @version 3.0
// @description Полный сканер stat компаний: все страницы, логирование, retry, export CSV/XLSX. Сохраняет прогресс в localStorage.
// @match https://fsedi.kz/statcompany*
// @match https://fsedi.kz/statcompany/*
// @match https://fsedi.kz/statcompany
// @grant none
// @require https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// @run-at document-end
// ==/UserScript==
(function () {
    'use strict';
    // ------------- Конфиг -------------
    const STORAGE_DATA = 'fsedi_statcompany_list_data';
    const STORAGE_STATE = 'fsedi_statcompany_list_state';
    const STORAGE_LOGS = 'fsedi_statcompany_list_logs';
    const FETCH_TIMEOUT = 20000;
    const RETRY_ATTEMPTS = 3;
    const RETRY_BASE_MS = 800;
    const PAGE_DELAY_MS = 600;
    const MAX_LOG_LINES = 2000;
    // ------------- UI -------------
    const panel = document.createElement('div');
    panel.id = 'fs-panel';
    panel.innerHTML = `
    <style>
    #fs-panel { position: fixed; top: 12px; right: 12px; width:420px; max-height:80vh; overflow:auto;
    background:#fff; border:1px solid #2b8cff; border-radius:10px; padding:10px; z-index:2147483647;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, Arial; font-size:13px; color:#222; box-shadow:0 8px 24px rgba(0,0,0,0.12); }
    #fs-panel .row{display:flex;justify-content:space-between;align-items:center;margin:6px 0;}
    #fs-panel .controls{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
    #fs-panel button{padding:6px 8px;border-radius:6px;border:1px solid #2b8cff;background:#fff;cursor:pointer;}
    #fs-panel .small{font-size:12px;color:#555;}
    #fs-panel .bar{height:8px;background:linear-gradient(90deg,#2b8cff,#2bd1ff);width:0;border-radius:6px}
    #fs-panel .progress{height:8px;background:#eee;border-radius:6px;overflow:hidden}
    #fs-panel .logs{background:#111;color:#0f0;font-family:monospace;font-size:12px;padding:8px;max-height:200px;overflow:auto;border-radius:6px;margin-top:8px}
    </style>
    <div class="row"><strong>FSEDI Stat Company List</strong><span class="small">v3.0</span></div>
    <div class="row"><span>Статус:</span><span id="fs-status">Idle</span></div>
    <div class="row"><span>Страница:</span><span id="fs-page">-</span></div>
    <div class="row"><span>Всего записей:</span><span id="fs-count">0</span></div>
    <div class="controls">
    <button id="fs-start">Start</button>
    <button id="fs-pause">Pause</button>
    <button id="fs-resume">Resume</button>
    <button id="fs-stop">Stop</button>
    <button id="fs-export-all">Export All</button>
    <button id="fs-download-logs">Download Logs</button>
    <button id="fs-clear-logs">Clear Logs</button>
    </div>
    <div class="progress" style="margin-top:8px;"><div class="bar" id="fs-bar"></div></div>
    <div class="logs" id="fs-logs" aria-live="polite"></div>
    <div class="small" style="margin-top:8px;">Данные и логи сохраняются в localStorage. Перезагрузка не теряет прогресс.</div>
    `;
    document.body.appendChild(panel);
    const statusEl = document.getElementById('fs-status');
    const pageEl = document.getElementById('fs-page');
    const countEl = document.getElementById('fs-count');
    const barEl = document.getElementById('fs-bar');
    const logsEl = document.getElementById('fs-logs');
    // ------------- State & Storage -------------
    let data = loadData();
    let state = loadState();
    let logs = loadLogs();
    updateUI();
    // ------------- Logging -------------
    function ts() {
        const d = new Date();
        return d.toISOString().replace('T',' ').split('.')[0];
    }
    function pushLog(level, msg) {
        const entry = { t: ts(), level, msg };
        logs.push(entry);
        if (logs.length > MAX_LOG_LINES) logs.shift();
        try { localStorage.setItem(STORAGE_LOGS, JSON.stringify(logs)); } catch(e){}
        const el = document.createElement('div');
        el.textContent = `[${entry.t}] ${entry.level.toUpperCase()}: ${entry.msg}`;
        logsEl.appendChild(el);
        logsEl.scrollTop = logsEl.scrollHeight;
        if (level === 'error') console.error(entry.msg); else if (level === 'warn') console.warn(entry.msg); else console.log(entry.msg);
    }
    function loadLogs() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_LOGS) || '[]');
        } catch (e) { return []; }
    }
    function clearLogs() { logs = []; localStorage.removeItem(STORAGE_LOGS); logsEl.innerHTML=''; pushLog('info','Logs cleared'); }
    (function renderLogs(){ logsEl.innerHTML=''; logs.forEach(e=>{ const d=document.createElement('div'); d.textContent=`[${e.t}] ${e.level.toUpperCase()}: ${e.msg}`; logsEl.appendChild(d); }); logsEl.scrollTop = logsEl.scrollHeight; })();
    // ------------- Storage helpers -------------
    function loadData() {
        try { return JSON.parse(localStorage.getItem(STORAGE_DATA) || '[]'); } catch(e){ pushLog('warn','Failed parse data from storage'); return []; }
    }
    function saveData() { try { localStorage.setItem(STORAGE_DATA, JSON.stringify(data)); countEl.textContent = data.length; } catch(e){ pushLog('error','Save data failed: '+e.message); } }
function loadState() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_STATE) || '{"running":false,"paused":false,"currentPage":1}');
    } catch(e) {
        return {running:false, paused:false, currentPage:1};
    }
}
    function saveState() { try { localStorage.setItem(STORAGE_STATE, JSON.stringify(state)); updateUI(); } catch(e){ pushLog('error','Save state failed: '+e.message); } }
    function resetState() { state = { running:false, paused:false, currentPage:1, totalPages:null }; saveState(); }
    // ------------- UI helpers -------------
    function updateUI(progress=0) {
        statusEl.textContent = state.running ? (state.paused ? 'Paused' : 'Running') : 'Idle';
// В updateUI:
        pageEl.textContent = state.currentPage || '-';
// Уберите: (state.totalPages ? (' / '+state.totalPages) : '')
        countEl.textContent = data.length;
        barEl.style.width = `${Math.min(100, Math.round(progress))}%`;
    }
    // ------------- Network helpers -------------
    async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const resp = await fetch(url, { credentials: 'same-origin', signal: controller.signal });
            clearTimeout(id);
            if (!resp.ok) throw new Error('HTTP '+resp.status);
            const text = await resp.text();
            return text;
        } catch (err) {
            clearTimeout(id);
            throw err;
        }
    }
    async function fetchPageHtml(page) {
        const url = new URL(window.location.href);
        url.searchParams.set('page', page);
        const full = url.toString();
        for (let att = 1; att <= RETRY_ATTEMPTS; att++) {
            try {
                pushLog('info', `Fetch page ${page} (attempt ${att}) -> ${full}`);
                const txt = await fetchWithTimeout(full);
                const parser = new DOMParser();
                const doc = parser.parseFromString(txt, 'text/html');
                if (doc.querySelectorAll('table tr').length === 0) {
                    pushLog('warn', `Page ${page} fetched but contains 0 <tr>.`);
                }
                return doc;
            } catch (err) {
                pushLog(att === RETRY_ATTEMPTS ? 'error' : 'warn', `Fetch page ${page} failed (attempt ${att}): ${err.message}`);
                if (att < RETRY_ATTEMPTS) {
                    const wait = RETRY_BASE_MS * Math.pow(2, att-1);
                    pushLog('info', `Retry after ${wait}ms`);
                    await sleep(wait);
                } else throw err;
            }
        }
    }
    function sleep(ms){ return new Promise(res => setTimeout(res, ms)); }
    // ------------- Parsing -------------
    function extractIdFromRow(row) {
        try {
            const a = row.querySelector('a[href*="/statcompany/"], a[href*="/statcompany/edit/"]');
            if (a && a.href) {
                const parts = a.href.split('/').filter(Boolean);
                for (let i = parts.length-1; i>=0; i--) if (/^\d+$/.test(parts[i])) return parts[i];
            }
            if (row.dataset && row.dataset.id) return row.dataset.id;
            const idAttr = row.getAttribute('id');
            if (idAttr && /^\d+$/.test(idAttr)) return idAttr;
            const onclick = row.getAttribute('onclick') || '';
            const m = onclick.match(/\b(\d{3,})\b/);
            if (m) return m[1];
        } catch(e){}
        return '';
    }
    function smartText(node) {
        if (!node) return '';
        return node.textContent.trim().replace(/\s+/g,' ');
    }
    function parseRowsFromDoc(doc, sourcePage) {
        const rows = Array.from(doc.querySelectorAll('table tr'));
        const parsed = [];
        for (const tr of rows) {
            const tds = Array.from(tr.querySelectorAll('td'));
            if (tds.length === 0) continue;
            const num = smartText(tds[0]);
            const nameLink = tds[1].querySelector('a');
            const name = nameLink ? smartText(nameLink) : smartText(tds[1]);
            const id = extractIdFromRow(tr) || (nameLink ? (nameLink.href.split('/').pop() || '') : '');
            const gln = smartText(tds[2]);
            const bin = smartText(tds[3]);
            const tariff = smartText(tds[4]);
            const status = smartText(tds[5]);
            parsed.push({
                id, num, name, gln, bin, tariff, status
            });
        }
        pushLog('info', `Parsed ${parsed.length} rows from page ${sourcePage}`);
        return parsed;
    }
    // ------------- Pagination detection -------------
    function findLastPageFromDoc(doc) {
        const anchors = Array.from(doc.querySelectorAll('a[href*="?page="]'));
        const lastAnchor = Array.from(doc.querySelectorAll('a')).find(a => /посл|последн|last|>>/i.test(a.textContent));
        if (lastAnchor && lastAnchor.href) {
            try { const u=new URL(lastAnchor.href, window.location.origin); return parseInt(u.searchParams.get('page')) || null; } catch(e){}
        }
        const pages = anchors.map(a=>{ try { const u=new URL(a.href, window.location.origin); return parseInt(u.searchParams.get('page'))||null; } catch(e){ return null; } }).filter(x=>x && !isNaN(x));
        if (pages.length) return Math.max(...pages);
        const nums = Array.from(doc.querySelectorAll('.pagination li, .pager li, ul.pagination li, .pagi > *')).map(n=>parseInt(n.textContent)).filter(x=>!isNaN(x));
        if (nums.length) return Math.max(...nums);
        return null;
    }
    // ------------- Dedupe -------------
    function mergeParsed(parsed) {
        for (const it of parsed) {
            let exists = null;
            if (it.id) exists = data.find(d => d.id && d.id === it.id);
            if (!exists && it.name && it.bin) exists = data.find(d => d.name === it.name && d.bin === it.bin);
            if (!exists) data.push(it);
            else {
                for (const k of ['num','gln','tariff','status']) {
                    if ((!exists[k] || exists[k]==='') && it[k]) exists[k]=it[k];
                }
            }
        }
        saveData();
    }
    // ------------- Export -------------
    function escapeCsv(v){ if (v==null) return '""'; const s=String(v).replace(/\r?\n/g,' '); return `"${s.replace(/"/g,'""')}"`; }
    function buildFilename(prefix) {
        const d=new Date();
        const dd=String(d.getDate()).padStart(2,'0');
        const mm=String(d.getMonth()+1).padStart(2,'0');
        const yy=String(d.getFullYear()).slice(-2);
        const hh=String(d.getHours()).padStart(2,'0');
        const mi=String(d.getMinutes()).padStart(2,'0');
        return `${prefix}_${dd}.${mm}.${yy}_${hh}-${mi}`;
    }
    function exportCSV(list, prefix) {
        const headers = ['ID','№','Название','GLN','BIN','Тариф','Стат'];
        const rows = list.map(it=>[it.id,it.num,it.name,it.gln,it.bin,it.tariff,it.status]);
        const csv = [headers.map(escapeCsv).join(',')].concat(rows.map(r=>r.map(escapeCsv).join(','))).join('\r\n');
        const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url; a.download = buildFilename(prefix)+'.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        pushLog('info', `CSV exported: ${prefix} (${list.length})`);
    }
    function exportXLSX(list, sheetName, prefix) {
        const wb = XLSX.utils.book_new();
        const wsData = list.map(it=>({
            ID: it.id,
            '№': it.num,
            Название: it.name,
            GLN: it.gln,
            BIN: it.bin,
            Тариф: it.tariff,
            Стат: it.status
        }));
        const headerOrder = ['ID','№','Название','GLN','BIN','Тариф','Стат'];
        const ws = XLSX.utils.json_to_sheet(wsData, {header: headerOrder});
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
        const blob = new Blob([wbout], {type:'application/octet-stream'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url; a.download = buildFilename(prefix)+'.xlsx'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        pushLog('info', `XLSX exported: ${prefix} (${list.length})`);
    }
    function exportAll() {
        if (!data.length) { pushLog('warn','No data to export'); alert('Нет данных — сначала запустите сканирование.'); return; }
        exportCSV(data, 'Fsedi_Stat_Company_List');
        exportXLSX(data, 'AllStatCompanies', 'Fsedi_Stat_Company_List');
    }
    // ------------- Main scanner -------------
// Удаляем detectTotalPagesInitial

async function scanAllPages() {
    if (state.running && !state.paused) { pushLog('warn','Already running'); return; }
    state.running = true;
    state.paused = false;
    // Не используем totalPages — идём до пустой страницы
    saveState();

    try {
        let p = state.currentPage || 1;
        let consecutiveEmpty = 0;
        const maxEmpty = 2; // выход после 2 пустых подряд

        pushLog('info', `Start scanning from page ${p} (stop on empty pages)`);

        while (state.running) {
            if (state.paused) {
                pushLog('info','Paused');
                await sleep(500);
                continue;
            }

            updateUI(); // без прогресс-бара, т.к. totalPages неизвестно
            pageEl.textContent = `Scanning page ${p}...`;

            try {
                const doc = await fetchPageHtml(p);
                const parsed = parseRowsFromDoc(doc, p);

                if (parsed.length === 0) {
                    consecutiveEmpty++;
                    pushLog('info', `Page ${p} is empty (${consecutiveEmpty}/${maxEmpty})`);
                    if (consecutiveEmpty >= maxEmpty) {
                        pushLog('info', `Stopping after ${maxEmpty} empty pages`);
                        break;
                    }
                } else {
                    consecutiveEmpty = 0; // сброс при наличии данных
                    mergeParsed(parsed);
                    state.currentPage = p + 1;
                    saveState();
                }

                p++;
                await sleep(PAGE_DELAY_MS);

            } catch (e) {
                pushLog('error', `Page ${p} failed: ${e.message}`);
                // Продолжаем, но можно остановиться при ошибке
                p++;
                state.currentPage = p;
                saveState();
                // Или break — по желанию
            }
        }

        pushLog('info','Scan finished');
        state.running = false;
        saveState();
        updateUI();

    } catch (e) {
        pushLog('error','Scan error: '+e.message);
        state.running = false;
        saveState();
        updateUI();
    }
}
    // ------------- Buttons -------------
    document.getElementById('fs-start').addEventListener('click', async () => {
        if (state.running && !state.paused) { pushLog('warn','Already running'); return; }
        if (!state.running && state.currentPage === 1) {
            data = []; saveData(); pushLog('info','Starting fresh, data cleared');
        }
        if (!state.totalPages) state.totalPages = await detectTotalPagesInitial();
        saveState();
        scanAllPages();
    });
    document.getElementById('fs-pause').addEventListener('click', () => {
        if (!state.running) { pushLog('warn','Not running'); return; }
        state.paused = true; saveState(); pushLog('info','Paused by user');
    });
    document.getElementById('fs-resume').addEventListener('click', () => {
        if (!state.running) { pushLog('info','Resume requested - starting scan'); state.paused=false; state.running=true; saveState(); scanAllPages(); return; }
        state.paused = false; saveState(); pushLog('info','Resumed by user');
    });
    document.getElementById('fs-stop').addEventListener('click', () => {
        state.running = false; state.paused = false; state.currentPage = 1; saveState(); pushLog('info','Stopped by user (progress reset to 1). Data kept in storage.');
    });
    document.getElementById('fs-export-all').addEventListener('click', exportAll);
    document.getElementById('fs-download-logs').addEventListener('click', () => {
        const text = logs.map(l=>`[${l.t}] ${l.level.toUpperCase()}: ${l.msg}`).join('\r\n');
        const blob = new Blob([text], {type:'text/plain;charset=utf-8;'}); const url=URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url; a.download = buildFilename('Fsedi_Stat_Comp_List_Logs') + '.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        pushLog('info','Logs downloaded');
    });
    document.getElementById('fs-clear-logs').addEventListener('click', clearLogs);
    // ------------- Auto-resume -------------
    (function autoResume() {
        if (state.running && !state.paused) {
            pushLog('info','Previous run detected — resuming scan automatically');
            scanAllPages();
        }
    })();
    // expose for debug
    window._fsdocs_scanner_v3 = { data, state, logs, scanAllPages, exportAll, clearLogs };
    pushLog('info','FSEDI Stat Company LIST initialized');
    updateUI();
})();
