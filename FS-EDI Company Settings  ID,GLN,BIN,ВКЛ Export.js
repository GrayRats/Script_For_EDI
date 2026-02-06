// ==UserScript==
// @name         FS-EDI Company Settings  ID,GLN,BIN,ВКЛ Export (CSV/XLSX)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Полный сканер компаний: все страницы, логирование, retry, export CSV/XLSX (blocked/all). Сохраняет прогресс в localStorage.
// @match        https://edi.fsdocs.kz/companies/providers*
// @match        https://edi.fsdocs.kz/companies/providers/*
// @match        https://edi.fsdocs.kz/companies/providers
// @match        https://fsedi.kz/companies/providers*
// @match        https://fsedi.kz/companies/providers/*
// @match        https://fsedi.kz/companies/providers
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // ------------- Конфиг -------------
    const STORAGE_DATA = 'fsdocs_companies_v3_data';
    const STORAGE_STATE = 'fsdocs_companies_v3_state';
    const STORAGE_LOGS = 'fsdocs_companies_v3_logs';
    const FETCH_TIMEOUT = 20000;
    const RETRY_ATTEMPTS = 3;
    const RETRY_BASE_MS = 800;
    const PAGE_DELAY_MS = 600; // задержка между fetch страницами
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
    <div class="row"><strong>FSdocs Scanner</strong><span class="small">v3.0</span></div>
    <div class="row"><span>Статус:</span><span id="fs-status">Idle</span></div>
    <div class="row"><span>Страница:</span><span id="fs-page">-</span></div>
    <div class="row"><span>Всего записей:</span><span id="fs-count">0</span></div>
    <div class="controls">
    <button id="fs-start">Start</button>
    <button id="fs-pause">Pause</button>
    <button id="fs-resume">Resume</button>
    <button id="fs-stop">Stop</button>
    <button id="fs-export-all">Export All</button>
    <button id="fs-export-block">Export Blocked</button>
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
    let state = loadState(); // {running, paused, currentPage, totalPages}
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

    // preload logs into UI
    (function renderLogs(){ logsEl.innerHTML=''; logs.forEach(e=>{ const d=document.createElement('div'); d.textContent=`[${e.t}] ${e.level.toUpperCase()}: ${e.msg}`; logsEl.appendChild(d); }); logsEl.scrollTop = logsEl.scrollHeight; })();

    // ------------- Storage helpers -------------
    function loadData() {
        try { return JSON.parse(localStorage.getItem(STORAGE_DATA) || '[]'); } catch(e){ pushLog('warn','Failed parse data from storage'); return []; }
    }
    function saveData() { try { localStorage.setItem(STORAGE_DATA, JSON.stringify(data)); countEl.textContent = data.length; } catch(e){ pushLog('error','Save data failed: '+e.message); } }
    function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_STATE) || '{"running":false,"paused":false,"currentPage":1,"totalPages":null}'); } catch(e){ return {running:false,paused:false,currentPage:1,totalPages:null}; } }
    function saveState() { try { localStorage.setItem(STORAGE_STATE, JSON.stringify(state)); updateUI(); } catch(e){ pushLog('error','Save state failed: '+e.message); } }
    function resetState() { state = { running:false, paused:false, currentPage:1, totalPages:null }; saveState(); }

    // ------------- UI helpers -------------
    function updateUI(progress=0) {
        statusEl.textContent = state.running ? (state.paused ? 'Paused' : 'Running') : 'Idle';
        pageEl.textContent = (state.currentPage || '-') + (state.totalPages ? (' / '+state.totalPages) : '');
        countEl.textContent = data.length;
        barEl.style.width = `${Math.min(100, Math.round(progress))}%`;
    }

    // ------------- Network helpers (fetch with timeout + retries) -------------
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
                // quick validation: table exists?
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
            const a = row.querySelector('a[href*="/companies/"], a[href*="/companies/edit/"], a[href*="/companies/providers/"]');
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
            if (tds.length === 0) continue; // skip header/empty
            // based on example: 0:name (a),1:active,2:gln,3:bin,4:tariff,5:address,6:email,7:ftp
            const nameLink = tds[0].querySelector('a');
            const name = nameLink ? smartText(nameLink) : smartText(tds[0]);
            const id = extractIdFromRow(tr) || (nameLink ? (nameLink.href.split('/').pop() || '') : '');
            const activeRaw = tds[1] ? smartText(tds[1]) : '';
            const gln = tds[2] ? smartText(tds[2]) : '';
            const bin = tds[3] ? smartText(tds[3]) : '';
            const tariff = tds[4] ? tds[4].innerHTML.trim().replace(/<br\s*\/?>/gi,' ').replace(/\s+/g,' ') : '';
            const address = tds[5] ? smartText(tds[5]) : '';
            const email = tds[6] ? smartText(tds[6]) : '';
            let ftp = tds[7] ? smartText(tds[7]) : '';
            if (!ftp) {
                const last = tds[tds.length-1];
                ftp = last ? smartText(last) : '';
            }
            ftp = /(\+|да|yes|true)/i.test(ftp) ? 'Да' : (ftp ? 'Нет' : '');
            const status = /да|активн|active|enabled/i.test(activeRaw) ? 'Активен' : 'Блок';

            parsed.push({
                id, name, active: activeRaw, gln, bin, tariff, address, email, ftp, status
            });
        }
        pushLog('info', `Parsed ${parsed.length} rows from page ${sourcePage}`);
        return parsed;
    }

    // ------------- Pagination detection -------------
    function findLastPageFromDoc(doc) {
        // strategy: find anchor whose text includes посл/Последн/Last/>> then parse page param
        const anchors = Array.from(doc.querySelectorAll('a[href*="?page="]'));
        // first try anchors with 'посл' or >>
        const lastAnchor = Array.from(doc.querySelectorAll('a')).find(a => /посл|последн|last|>>/i.test(a.textContent));
        if (lastAnchor && lastAnchor.href) {
            try { const u=new URL(lastAnchor.href, window.location.origin); return parseInt(u.searchParams.get('page')) || null; } catch(e){}
        }
        // else compute max from anchors with page param
        const pages = anchors.map(a=>{ try { const u=new URL(a.href, window.location.origin); return parseInt(u.searchParams.get('page'))||null; } catch(e){ return null; } }).filter(x=>x && !isNaN(x));
        if (pages.length) return Math.max(...pages);
        // else try pagination numeric elements
        const nums = Array.from(doc.querySelectorAll('.pagination li, .pager li, ul.pagination li')).map(n=>parseInt(n.textContent)).filter(x=>!isNaN(x));
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
                // update missing fields if any
                for (const k of ['email','gln','bin','ftp','status','tariff','address']) {
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
        const headers = ['ID','Название','Вкл','GLN','БИН/ИИН','Тариф','Адрес','Email','FTP','Статус','ИсточникСтраницы'];
        const rows = list.map(it=>[it.id,it.name,it.active,it.gln,it.bin,it.tariff,it.address,it.email,it.ftp,it.status,it.sourcePage]);
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
            Вкл: it.active,
            GLN: it.gln,
            'БИН/ИИН': it.bin,
            Тариф: it.tariff,
            Адрес: it.address,
            Email: it.email,
            FTP: it.ftp,
            Статус: it.status
        }));
        const headerOrder = ['ID','Название','Вкл','GLN','БИН/ИИН','Тариф','Адрес','Email','FTP','Статус','Источник'];
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
        exportCSV(data, 'Fsedi_Company_All');
        exportXLSX(data, 'AllCompanies', 'Fsedi_Company_All');
    }
    function exportBlocked() {
        const blocked = data.filter(d=>d.status && /блок/i.test(d.status));
        if (!blocked.length) { pushLog('warn','No blocked rows to export'); alert('Нет заблокированных записей.'); return; }
        exportCSV(blocked, 'Fsedi_Company_Block_Statut');
        exportXLSX(blocked, 'Blocked', 'Fsedi_Company_Block_Statut');
    }

    // ------------- Main scanner -------------
    async function detectTotalPagesInitial() {
        // try current DOM first
        try {
            const currentDoc = document;
            const last = findLastPageFromDoc(currentDoc);
            if (last && last > 1) { pushLog('info','Detected total pages from current DOM: '+last); return last; }
        } catch(e){}
        // else fetch page=1
        try {
            const doc = await fetchPageHtml(1);
            const last = findLastPageFromDoc(doc);
            if (last && last > 1) { pushLog('info','Detected total pages from fetched page 1: '+last); return last; }
        } catch(e){ pushLog('warn','Failed detect totalPages by fetch: '+e.message); }
        pushLog('info','Defaulting totalPages=1');
        return 1;
    }

    async function scanAllPages() {
        if (state.running && !state.paused) { pushLog('warn','Already running'); return; }
        state.running = true; state.paused = false; saveState();

        try {
            if (!state.totalPages) state.totalPages = await detectTotalPagesInitial();
            const total = state.totalPages;
            pushLog('info', `Start scanning pages 1..${total} (resume page=${state.currentPage})`);
            for (let p = state.currentPage; p <= total; p++) {
                if (!state.running) { pushLog('info','Scan stopped by user'); break; }
                while (state.paused) { pushLog('info','Paused'); await sleep(500); }
                updateUI(((p-1)/total) * 100);
                pageEl.textContent = `${p} / ${total}`;
                try {
                    const doc = await fetchPageHtml(p);
                    const parsed = parseRowsFromDoc(doc, p);
                    mergeParsed(parsed);
                    state.currentPage = p + 1;
                    saveState();
                } catch (e) {
                    pushLog('error', `Page ${p} failed to fetch/parse: ${e.message}`);
                    // continue to next page (do not abort)
                    state.currentPage = p + 1;
                    saveState();
                }
                await sleep(PAGE_DELAY_MS);
            }
            pushLog('info','Scan finished');
            state.running = false; state.currentPage = 1; saveState(); updateUI(100);
        } catch (e) {
            pushLog('error','Scan error: '+e.message);
            state.running = false; saveState(); updateUI();
        }
    }

    // ------------- Buttons -------------
    document.getElementById('fs-start').addEventListener('click', async () => {
        if (state.running && !state.paused) { pushLog('warn','Already running'); return; }
        // reset data if starting fresh
        if (!state.running && state.currentPage === 1) {
            data = []; saveData(); pushLog('info','Starting fresh, data cleared');
        }
        // detect totalPages if unknown
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
    document.getElementById('fs-export-block').addEventListener('click', exportBlocked);
    document.getElementById('fs-download-logs').addEventListener('click', () => {
        const text = logs.map(l=>`[${l.t}] ${l.level.toUpperCase()}: ${l.msg}`).join('\r\n');
        const blob = new Blob([text], {type:'text/plain;charset=utf-8;'}); const url=URL.createObjectURL(blob);
        const a=document.createElement('a'); a.href=url; a.download = buildFilename('Fsedi_Scan_Logs') + '.txt'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        pushLog('info','Logs downloaded');
    });
    document.getElementById('fs-clear-logs').addEventListener('click', clearLogs);

    // ------------- Auto-resume on reload if was running -------------
    (function autoResume() {
        if (state.running && !state.paused) {
            pushLog('info','Previous run detected — resuming scan automatically');
            scanAllPages();
        }
    })();

    // expose for debug
    window._fsdocs_scanner_v3 = { data, state, logs, scanAllPages, exportAll, exportBlocked, clearLogs };

    pushLog('info','FSdocs Scanner initialized (v3.0)');
    updateUI();

})();
