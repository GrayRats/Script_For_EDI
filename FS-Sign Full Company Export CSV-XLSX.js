// ==UserScript==
// @name FS-Sign Full Company Export CSV/XLSX
// @namespace http://tampermonkey.net/
// @version 3.0
// @description Полный сканер компаний: все страницы, логирование, retry, export CSV/XLSX. Сохраняет прогресс в localStorage.
// @match https://sign.fsdocs.kz/companies*
// @match https://sign.fsdocs.kz/companies/*
// @match https://sign.fsdocs.kz/companies
// @match https://signtest.fsdocs.kz/companies*
// @match https://signtest.fsdocs.kz/companies/*
// @match https://signtest.fsdocs.kz/companies
// @grant none
// @require https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// @run-at document-end
// ==/UserScript==
(function () {
    'use strict';
    // ------------- Конфиг -------------
    const STORAGE_DATA = 'fsign_companies_sign_v3_data';
    const STORAGE_STATE = 'fsign_companies_sign_v3_state';
    const STORAGE_LOGS = 'fsign_companies_sign_v3_logs';
    const FETCH_TIMEOUT = 20000;
    const RETRY_ATTEMPTS = 5;
    const RETRY_BASE_MS = 800;
    const PAGE_DELAY_MS = 400;
    const MAX_LOG_LINES = 10000;
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
    <div class="row"><strong>FSign Full Company Export</strong><span class="small">v3.0</span></div>
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
    const logsEl = document.getElementById('fs-logs');
    // ------------- State & Storage -------------
    let data = loadData();
    let state = loadState(); // {running, paused, currentPage}
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
    function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_STATE) || '{"running":false,"paused":false,"currentPage":1}'); } catch(e){ return {running:false,paused:false,currentPage:1}; } }
    function saveState() { try { localStorage.setItem(STORAGE_STATE, JSON.stringify(state)); updateUI(); } catch(e){ pushLog('error','Save state failed: '+e.message); } }
    function resetState() { state = { running:false, paused:false, currentPage:1 }; saveState(); }
    // ------------- UI helpers -------------
    function updateUI() {
        statusEl.textContent = state.running ? (state.paused ? 'Paused' : 'Running') : 'Idle';
        pageEl.textContent = state.currentPage || '-';
        countEl.textContent = data.length;
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
            const a = row.querySelector('a[href*="/companies/"], a[href*="/companies/edit/"]');
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
            const nameLink = tds[0].querySelector('a');
            const name = nameLink ? smartText(nameLink) : smartText(tds[0]);
            const id = extractIdFromRow(tr) || (nameLink ? (nameLink.href.split('/').pop() || '') : '');
            const gln = smartText(tds[1]);
            const bin = smartText(tds[2]);
            const address = smartText(tds[3]);
            const email = smartText(tds[4]);
            parsed.push({
                id, name, gln, bin, address, email
            });
        }
        pushLog('info', `Parsed ${parsed.length} rows from page ${sourcePage}`);
        return parsed;
    }
    // ------------- Next detection -------------
    function hasNextFromDoc(doc) {
        const nextAnchor = Array.from(doc.querySelectorAll('a')).find(a => /след|next|>>/i.test(a.textContent));
        return !!nextAnchor;
    }
    // ------------- Dedupe -------------
    function mergeParsed(parsed) {
        for (const it of parsed) {
            let exists = null;
            if (it.id) exists = data.find(d => d.id && d.id === it.id);
            if (!exists && it.name && it.bin) exists = data.find(d => d.name === it.name && d.bin === it.bin);
            if (!exists) data.push(it);
            else {
                for (const k of ['gln','address','email']) {
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
        const headers = ['ID','Название','GLN','БИН/ИИН','Адрес','Email'];
        const rows = list.map(it=>[it.id,it.name,it.gln,it.bin,it.address,it.email]);
        const csv = [headers.map(escapeCsv).join(',')].concat(rows.map(r=>r.map(escapeCsv).join(','))).join('\r\n');
        const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url; a.download = buildFilename(prefix)+'.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        pushLog('info', `CSV exported: ${prefix} (${list.length})`);
    }
    function exportXLSX(list, sheetName, prefix) {
        const wb = XLSX.utils.book_new();
        const wsData = list.map(it=>({
            ID: it.id,
            Название: it.name,
            GLN: it.gln,
            'БИН/ИИН': it.bin,
            Адрес: it.address,
            Email: it.email
        }));
        const headerOrder = ['ID','Название','GLN','БИН/ИИН','Адрес','Email'];
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
        exportCSV(data, 'Fsdocs_Company_All');
        exportXLSX(data, 'AllCompanies', 'Fsdocs_Company_All');
    }
    // ------------- Main scanner -------------
    async function scanAllPages() {
        if (state.running && !state.paused) { pushLog('warn','Already running'); return; }
        state.running = true; state.paused = false; saveState();
        try {
            pushLog('info', `Start scanning from page ${state.currentPage}`);
            let p = state.currentPage;
            while (true) {
                if (!state.running) { pushLog('info','Scan stopped by user'); break; }
                while (state.paused) { pushLog('info','Paused'); await sleep(500); }
                updateUI();
                pageEl.textContent = p;
                try {
                    const doc = await fetchPageHtml(p);
                    const parsed = parseRowsFromDoc(doc, p);
                    mergeParsed(parsed);
                    if (parsed.length === 0) {
                        pushLog('info', `Page ${p} has 0 rows - stopping`);
                        break;
                    }
                    const hasNext = hasNextFromDoc(doc);
                    state.currentPage = p + 1;
                    saveState();
                    if (!hasNext) {
                        pushLog('info', `No next link on page ${p} - stopping`);
                        break;
                    }
                } catch (e) {
                    pushLog('error', `Page ${p} failed to fetch/parse: ${e.message}`);
                    if (e.message.includes('HTTP 4')) break;
                    state.currentPage = p + 1;
                    saveState();
                }
                await sleep(PAGE_DELAY_MS);
                p++;
            }
            pushLog('info','Scan finished');
            state.running = false; state.currentPage = 1; saveState(); updateUI();
        } catch (e) {
            pushLog('error','Scan error: '+e.message);
            state.running = false; saveState(); updateUI();
        }
    }
    // ------------- Buttons -------------
    document.getElementById('fs-start').addEventListener('click', () => {
        if (state.running && !state.paused) { pushLog('warn','Already running'); return; }
        if (!state.running && state.currentPage === 1) {
            data = []; saveData(); pushLog('info','Starting fresh, data cleared');
        }
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
        const a=document.createElement('a'); a.href=url; a.download = buildFilename('Fsign_Scan_Logs') + '.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
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
    pushLog('info','FSdocs Company Scanner initialized');
    updateUI();
})();
