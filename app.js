// UI Elements
const uploadBtn = document.getElementById('pdf-upload');
const loader = document.getElementById('loader');
const emptyState = document.getElementById('empty-state');
const welcomeView = document.getElementById('welcome-view');
const errorView = document.getElementById('error-view');
const tasksContainer = document.getElementById('tasks-container');
const tasksList = document.getElementById('tasks-list');
const dateFilter = document.getElementById('date-filter');
const headerDateSelector = document.getElementById('header-date-selector');
const metadataBar = document.getElementById('metadata-bar');
const metadataTitleEl = document.getElementById('metadata-title');
const pdfTimestampEl = document.getElementById('pdf-timestamp');
const btnViewPdf = document.getElementById('btn-view-pdf');
const btnShareWhatsapp = document.getElementById('btn-share-whatsapp');
const btnHome = document.getElementById('btn-home');
const btnToggleCheck = document.getElementById('btn-toggle-check');
const headerTools = document.getElementById('header-tools');
const btnExpandTools = document.getElementById('btn-expand-tools');
const historyContainer = document.getElementById('history-container');
const historyList = document.getElementById('history-list');

// URL Feature Elements
const btnOpenUrl = document.getElementById('btn-open-url');
const btnWelcomeUrl = document.getElementById('btn-welcome-url');
const btnRefreshUrl = document.getElementById('btn-refresh-url');
const urlModal = document.getElementById('url-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnSubmitUrl = document.getElementById('btn-submit-url');
const btnClearUrl = document.getElementById('btn-clear-url');
const btnPasteUrl = document.getElementById('btn-paste-url');
const btnClearInput = document.getElementById('btn-clear-input');
const inputPdfUrl = document.getElementById('input-pdf-url');
const urlSavedInfo = document.getElementById('url-saved-info');
const savedUrlLink = document.getElementById('saved-url-link');

let allRouteGroups = [];
let availableDates = [];
let pdfCreationTime = '';
let notificationInterval = null;
let currentPdfUrl = null;
let currentPdfBlob = null;
let currentPdfFilename = '';
let isCheckModeEnabled = false;

// IndexedDB for Original PDFs
const DB_NAME = 'RutaSmartDB';
const STORE_NAME = 'pdf_files';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function savePdfToDB(filename, fileBlob) {
    initDB().then(db => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(fileBlob, filename);
    }).catch(console.error);
}

function getPdfFromDB(filename) {
    return new Promise((resolve, reject) => {
        initDB().then(db => {
            const tx = db.transaction(STORE_NAME, 'readonly');
            const req = tx.objectStore(STORE_NAME).get(filename);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }).catch(reject);
    });
}

function deletePdfFromDB(filename) {
    initDB().then(db => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(filename);
    }).catch(console.error);
}

// LocalStorage for Checks
function saveCheck(pedido, count) {
    if (!currentPdfFilename) return;
    const key = `rs_checks_${currentPdfFilename}`;
    let checks = JSON.parse(localStorage.getItem(key) || '{}');
    if (count > 0) {
        checks[pedido] = count;
    } else {
        delete checks[pedido];
    }
    localStorage.setItem(key, JSON.stringify(checks));
}

function getSavedCheck(pedido) {
    if (!currentPdfFilename) return 0;
    const key = `rs_checks_${currentPdfFilename}`;
    let checks = JSON.parse(localStorage.getItem(key) || '{}');
    return checks[pedido] || 0;
}

// Local Pallet Counter (Per trip)
function refreshLocalCounter(card) {
    if (!card) return;
    const tripCounter = card.querySelector('.trip-loaded-count');
    if (tripCounter) {
        tripCounter.textContent = card.querySelectorAll('.check-item-badge').length;
    }
}

// Home Button Reset
btnHome.addEventListener('click', () => {
    currentPdfUrl = null;
    currentPdfBlob = null;
    currentPdfFilename = '';
    allRouteGroups = [];
    
    // UI Reset
    emptyState.classList.remove('hidden');
    welcomeView.classList.remove('hidden');
    errorView.classList.add('hidden');
    
    tasksContainer.classList.add('hidden');
    headerDateSelector.classList.add('hidden');
    metadataBar.classList.add('hidden');
    if (btnExpandTools) btnExpandTools.classList.add('hidden');
    if (headerTools) headerTools.classList.add('hidden');

    const floatBtn = document.getElementById('btn-float-now');
    if (floatBtn) floatBtn.style.display = 'none';
    
    renderHistory();
    updateUrlUi();
});

// URL UI and Management
function updateUrlUi() {
    const savedUrl = localStorage.getItem('ruta_smart_live_url');
    if (savedUrl) {
        if (btnRefreshUrl) btnRefreshUrl.classList.remove('hidden');
        if (urlSavedInfo) {
            urlSavedInfo.classList.remove('hidden');
            if (savedUrlLink) {
                savedUrlLink.textContent = savedUrl;
                savedUrlLink.href = savedUrl;
            }
        }
        if (inputPdfUrl) inputPdfUrl.value = savedUrl;
        if (btnClearUrl) btnClearUrl.classList.remove('hidden');
    } else {
        if (btnRefreshUrl) btnRefreshUrl.classList.add('hidden');
        if (urlSavedInfo) urlSavedInfo.classList.add('hidden');
        if (inputPdfUrl) inputPdfUrl.value = '';
        if (btnClearUrl) btnClearUrl.classList.add('hidden');
    }
}

function openUrlModal() {
    updateUrlUi();
    if (urlModal) {
        urlModal.classList.remove('hidden');
        // Do NOT focus input field to avoid showing on-screen keyboard on mobile
    }
}

function closeUrlModal() {
    if (urlModal) urlModal.classList.add('hidden');
}

btnOpenUrl?.addEventListener('click', openUrlModal);
btnWelcomeUrl?.addEventListener('click', openUrlModal);
btnCloseModal?.addEventListener('click', closeUrlModal);
urlModal?.addEventListener('click', (e) => {
    if (e.target === urlModal) closeUrlModal();
});

// Pegar enlace desde portapapeles sin abrir el teclado
btnPasteUrl?.addEventListener('click', async () => {
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            if (text && text.trim()) {
                inputPdfUrl.value = text.trim();
                return;
            }
        }
    } catch (err) {
        console.warn('Error accediendo al portapapeles:', err);
    }
});

// Limpiar campo de texto en modal sin abrir teclado
btnClearInput?.addEventListener('click', () => {
    if (inputPdfUrl) {
        inputPdfUrl.value = '';
    }
});

btnClearUrl?.addEventListener('click', () => {
    if (confirm('¿Deseas eliminar el enlace web guardado?')) {
        localStorage.removeItem('ruta_smart_live_url');
        updateUrlUi();
    }
});

btnSubmitUrl?.addEventListener('click', async () => {
    const url = inputPdfUrl?.value.trim();
    if (!url) {
        alert('Por favor, pulsa "Pegar" para introducir un enlace web válido.');
        return;
    }
    closeUrlModal();
    await loadPdfFromUrl(url);
});

btnRefreshUrl?.addEventListener('click', async () => {
    const savedUrl = localStorage.getItem('ruta_smart_live_url');
    if (savedUrl) {
        await loadPdfFromUrl(savedUrl);
    } else {
        openUrlModal();
    }
});

// Fetch PDF from URL
async function loadPdfFromUrl(url) {
    loader.classList.remove('hidden');
    const loaderP = loader.querySelector('p');
    if (loaderP) loaderP.textContent = 'Descargando hoja de ruta...';

    emptyState.classList.add('hidden');
    tasksContainer.classList.add('hidden');
    headerDateSelector.classList.add('hidden');
    metadataBar.classList.add('hidden');

    try {
        let response = null;
        let blob = null;
        
        // Cache busting
        const cacheBustUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
        try {
            response = await fetch(cacheBustUrl);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            blob = await response.blob();
        } catch (fetchErr) {
            console.warn('Descarga directa bloqueada (CORS o red), probando vía proxy...', fetchErr);
            try {
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                response = await fetch(proxyUrl);
                if (!response.ok) throw new Error(`Proxy error ${response.status}`);
                blob = await response.blob();
            } catch (proxyErr) {
                console.error('Fallo también con proxy:', proxyErr);
                throw fetchErr;
            }
        }

        localStorage.setItem('ruta_smart_live_url', url);
        updateUrlUi();

        // Nombre temporal; parsePDFText le asignará la fecha real de la tarea
        let tempDownloadName = '';
        try {
            const urlPath = new URL(url).pathname;
            const parts = urlPath.split('/').filter(Boolean);
            if (parts.length > 0 && parts[parts.length - 1].toLowerCase().endsWith('.pdf')) {
                tempDownloadName = decodeURIComponent(parts[parts.length - 1]);
            }
        } catch (e) {}

        if (!tempDownloadName) {
            tempDownloadName = 'Parte_Pendiente.pdf';
        }

        const arrayBuffer = await blob.arrayBuffer();
        await processPdfArrayBuffer(arrayBuffer, tempDownloadName, blob, true);
    } catch (error) {
        console.error('Error al descargar PDF:', error);
        alert('No se pudo descargar el archivo automáticamente desde el enlace.\n\nEs posible que requiera contraseña, esté en una red interna o tenga bloqueos de seguridad (CORS).\n\nPuedes abrir el enlace en tu navegador, guardarlo en tu móvil y cargarlo desde el inicio.');
        emptyState.classList.remove('hidden');
    } finally {
        loader.classList.add('hidden');
        if (loaderP) loaderP.textContent = 'Procesando documento...';
    }
}

// Initial URL Check
updateUrlUi();

// History Logic
function saveToHistory(filename, routeGroups, creationTime) {
    let history = JSON.parse(localStorage.getItem('ruta_smart_history') || '[]');
    // Avoid duplicates by name
    history = history.filter(h => h.filename !== filename);
    
    const newItem = {
        filename,
        routeGroups,
        creationTime,
        savedAt: new Date().getTime()
    };
    
    history.unshift(newItem);
    if (history.length > 5) history.pop();
    
    localStorage.setItem('ruta_smart_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const history = JSON.parse(localStorage.getItem('ruta_smart_history') || '[]');
    if (history.length === 0) {
        historyContainer.classList.add('hidden');
        return;
    }
    
    historyContainer.classList.remove('hidden');
    historyList.innerHTML = history.map((item, idx) => `
        <div class="history-item" data-idx="${idx}">
            <div class="history-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            </div>
            <div class="history-item-info">
                <span class="history-item-name">${item.filename}</span>
                <span class="history-item-time">${item.creationTime ? 'Generado: ' + item.creationTime : 'Carga guardada'}</span>
            </div>
            <button class="btn-delete-history" data-idx="${idx}" title="Borrar carga">
                &times;
            </button>
        </div>
    `).join('');
    
    document.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', () => {
            const idx = el.getAttribute('data-idx');
            const item = history[idx];
            allRouteGroups = item.routeGroups;
            pdfCreationTime = item.creationTime;
            currentPdfFilename = item.filename;
            
            // UI Update
            emptyState.classList.add('hidden');
            tasksContainer.classList.remove('hidden');
            headerDateSelector.classList.remove('hidden');
            metadataBar.classList.remove('hidden');
            if (btnExpandTools) btnExpandTools.classList.remove('hidden');
            if (headerTools) {
                headerTools.classList.remove('hidden');
                headerTools.classList.add('collapsed');
            }
            
            // Recalculate available dates
            const allTaskDates = allRouteGroups.flatMap(g => g.tasks.map(t => t.fecha)).filter(Boolean);
            const datesSet = new Set(allTaskDates);
            const now = new Date();
            const todayStr = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth()+1).padStart(2, '0') + '/' + now.getFullYear();
            datesSet.add(todayStr);

            availableDates = Array.from(datesSet).sort((a,b) => {
                const [d1,m1,y1] = a.split('/');
                const [d2,m2,y2] = b.split('/');
                return new Date(y1,m1-1,d1) - new Date(y2,m2-1,d2);
            });

            renderFilters();
            
            // Default to today if has tasks, else first date with tasks
            const datesWithTasks = availableDates.filter(d => allRouteGroups.some(g => g.tasks.some(t => t.fecha === d)));
            if (datesWithTasks.includes(todayStr)) {
                dateFilter.value = todayStr;
            } else if (datesWithTasks.length > 0) {
                dateFilter.value = datesWithTasks[0];
            } else if (availableDates.length > 0) {
                dateFilter.value = availableDates[0];
            }
            
            pdfTimestampEl.textContent = (pdfCreationTime ? `(Actualizado: ${pdfCreationTime})` : "") + ` • Hoy: ${todayStr}`;
            
            // Try to load Original PDF from DB
            getPdfFromDB(currentPdfFilename).then(blob => {
                if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
                currentPdfBlob = blob || null;
                currentPdfUrl = blob ? URL.createObjectURL(blob) : null;
            });

            renderTasks(true);
        });
    });

    // Handle delete button clicks
    document.querySelectorAll('.btn-delete-history').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = btn.getAttribute('data-idx');
            const item = history[idx];
            if (confirm(`¿Seguro que quieres borrar la carga "${item.filename}" de recientes?`)) {
                deletePdfFromDB(item.filename);
                history.splice(idx, 1);
                localStorage.setItem('ruta_smart_history', JSON.stringify(history));
                renderHistory();
            }
        });
    });
}

// Initial history load
renderHistory();

// Tool Menu Toggle
btnExpandTools?.addEventListener('click', () => {
    headerTools?.classList.toggle('collapsed');
    btnExpandTools?.classList.toggle('rotated');
});

// Toggle Check Mode
btnToggleCheck?.addEventListener('click', () => {
    isCheckModeEnabled = !isCheckModeEnabled;
    btnToggleCheck?.classList.toggle('active', isCheckModeEnabled);
    renderTasks(false); // Check mode does not scroll page
});

// Helper to find and link phone numbers in text
function linkifyPhoneNumbers(text) {
    if (!text) return text;
    const phoneRegex = /(?:(?:\+34|0034)[\s.-]?)?([6789]\d{2}[\s.-]?\d{3}[\s.-]?\d{3})/g;
    return text.replace(phoneRegex, (match) => {
        const cleanNumber = match.replace(/[\s.-]/g, '').replace(/^00/, '+');
        return `<a href="tel:${cleanNumber}" class="tel-link">${match}</a>`;
    });
}

// Original PDF Viewer
btnViewPdf.addEventListener('click', () => {
    if (currentPdfUrl) {
        const link = document.createElement('a');
        link.href = currentPdfUrl;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        alert('El archivo PDF original no está disponible. Por favor, vuelve a cargarlo.');
    }
});

// Toast Notification
function showToast(msg) {
    document.querySelectorAll('.toast-notice').forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = 'toast-notice';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
}

// Compartir por WhatsApp (PDF y enlace de Mercadona juntos)
async function shareParte() {
    if (!currentPdfFilename || allRouteGroups.length === 0) {
        alert('No hay ninguna hoja de ruta cargada para compartir.');
        return;
    }

    let mercadonaUrl = localStorage.getItem('ruta_smart_live_url') || '';
    if (!mercadonaUrl) {
        const inputUrl = prompt('Introduce o pega el enlace de Mercadona para compartirlo junto al PDF:', '');
        if (inputUrl && inputUrl.trim()) {
            mercadonaUrl = inputUrl.trim();
            localStorage.setItem('ruta_smart_live_url', mercadonaUrl);
            updateUrlUi();
        }
    }

    let blob = currentPdfBlob;
    if (!blob && currentPdfFilename) {
        try {
            blob = await getPdfFromDB(currentPdfFilename);
        } catch (e) {
            console.warn('Error recuperando PDF de DB:', e);
        }
    }

    const filename = currentPdfFilename.endsWith('.pdf') ? currentPdfFilename : `${currentPdfFilename}.pdf`;

    // Copiar automáticamente el enlace de Mercadona al portapapeles
    if (mercadonaUrl) {
        try {
            await navigator.clipboard.writeText(mercadonaUrl);
            showToast('📋 Enlace de Mercadona copiado al portapapeles');
        } catch (err) {
            console.warn('No se pudo copiar al portapapeles:', err);
        }
    }

    // Compartir el archivo PDF y el enlace de Mercadona
    const shareData = {
        title: filename,
        text: mercadonaUrl || filename
    };
    if (mercadonaUrl) {
        shareData.url = mercadonaUrl;
    }

    if (blob && navigator.canShare) {
        try {
            const pdfFile = new File([blob], filename, { type: 'application/pdf' });
            if (navigator.canShare({ files: [pdfFile] })) {
                shareData.files = [pdfFile];
                await navigator.share(shareData);
                return;
            }
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.warn('Fallo con Web Share API:', err);
        }
    }

    // Fallback: Descargar el archivo PDF para adjuntarlo y abrir WhatsApp con el enlace de Mercadona
    if (blob) {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    if (mercadonaUrl) {
        const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(mercadonaUrl)}`;
        window.open(waUrl, '_blank');
    } else {
        alert('El PDF se ha descargado. Puedes adjuntarlo en WhatsApp.');
    }
}

btnShareWhatsapp?.addEventListener('click', shareParte);

// File upload event
uploadBtn.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        await processPdfArrayBuffer(arrayBuffer, file.name, file, false);
    } catch (err) {
        console.error("Error reading PDF file:", err);
        alert('Hubo un error al leer el archivo. Inténtalo de nuevo.');
    } finally {
        uploadBtn.value = '';
    }
});

// Process ArrayBuffer
async function processPdfArrayBuffer(arrayBuffer, filename, fileBlob = null, isFromUrl = false) {
    if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
    currentPdfBlob = fileBlob || new Blob([arrayBuffer], { type: 'application/pdf' });
    currentPdfUrl = URL.createObjectURL(currentPdfBlob);
    
    // UI state for tools
    if (btnExpandTools) {
        btnExpandTools.classList.remove('hidden');
        btnExpandTools.classList.remove('rotated');
    }
    if (headerTools) {
        headerTools.classList.remove('hidden');
        headerTools.classList.add('collapsed');
    }
    
    btnToggleCheck?.classList.remove('active');
    isCheckModeEnabled = false;

    loader.classList.remove('hidden');
    emptyState.classList.add('hidden');
    tasksContainer.classList.add('hidden');
    headerDateSelector.classList.add('hidden');
    metadataBar.classList.add('hidden');
    pdfCreationTime = '';

    try {
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join('\n');
            fullText += pageText + '\n\n--- PAGE BREAK ---\n\n';
        }

        parsePDFText(fullText, filename, isFromUrl);
    } catch (error) {
        console.error("Error reading PDF: ", error);
        alert('Hubo un error al leer el documento PDF. Por favor, asegúrate de que es un archivo válido.');
        emptyState.classList.remove('hidden');
    } finally {
        loader.classList.add('hidden');
    }
}

dateFilter.addEventListener('change', () => renderTasks(true));

// Main Parsing Logic
function parsePDFText(fullText, filename, isFromUrl = false) {
    // Extract creation timestamp
    const timeMatch = fullText.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
    pdfCreationTime = timeMatch ? timeMatch[1] : '';

    // Unified Parser that handles both COMPOSICIÓN and DETALLE DE LA RUTA without losing any tasks
    allRouteGroups = parseUnifiedRoutes(fullText);

    if (metadataTitleEl) {
        metadataTitleEl.textContent = 'DETALLE RUTAS';
    }

    if (allRouteGroups.length > 0) {
        welcomeView.classList.add('hidden');
        errorView.classList.add('hidden');
        emptyState.classList.add('hidden');

        // Extract the actual task date to assign as filename (not the download date)
        let actualTaskDate = '';
        for (const g of allRouteGroups) {
            for (const t of g.tasks) {
                if (t.fecha) {
                    actualTaskDate = t.fecha;
                    break;
                }
            }
            if (actualTaskDate) break;
        }
        if (!actualTaskDate && allRouteGroups[0]?.infoCliente?.fecha) {
            actualTaskDate = allRouteGroups[0].infoCliente.fecha;
        }

        if (actualTaskDate) {
            const dateStr = actualTaskDate.replace(/\//g, '-');
            const vehiculo = allRouteGroups[0]?.infoTransportista?.vehiculo || '';
            const assignedName = vehiculo ? `Parte_${dateStr}_${vehiculo}.pdf` : `Parte_${dateStr}.pdf`;
            
            // If loaded from URL or had temporary/default name, update to task date
            if (isFromUrl || filename.startsWith('Parte_') || filename.includes('Pendiente') || filename.includes('temp') || filename.startsWith('http')) {
                filename = assignedName;
            }
        }

        currentPdfFilename = filename;
        if (currentPdfBlob) {
            savePdfToDB(currentPdfFilename, currentPdfBlob);
        }

        // Populate Filters
        const allTaskDates = allRouteGroups.flatMap(g => g.tasks.map(t => t.fecha)).filter(Boolean);
        const datesSet = new Set(allTaskDates);
        
        const now = new Date();
        const todayStr = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth()+1).padStart(2, '0') + '/' + now.getFullYear();
        datesSet.add(todayStr);

        availableDates = Array.from(datesSet).sort((a,b) => {
            const [d1,m1,y1] = a.split('/');
            const [d2,m2,y2] = b.split('/');
            return new Date(y1,m1-1,d1) - new Date(y2,m2-1,d2);
        });

        renderFilters();
        
        // Auto-select date with tasks (prioritizing today if it has tasks)
        const datesWithTasks = availableDates.filter(d => allRouteGroups.some(g => g.tasks.some(t => t.fecha === d)));
        if (datesWithTasks.includes(todayStr)) {
            dateFilter.value = todayStr;
        } else if (datesWithTasks.length > 0) {
            dateFilter.value = datesWithTasks[0];
        } else if (availableDates.length > 0) {
            dateFilter.value = availableDates[0];
        }
        
        headerDateSelector.classList.remove('hidden');
        metadataBar.classList.remove('hidden');
        pdfTimestampEl.textContent = (pdfCreationTime ? `(Actualizado: ${pdfCreationTime})` : '') + ` • Hoy: ${todayStr}`;
        tasksContainer.classList.remove('hidden');
        
        renderTasks(true);
    } else {
        headerDateSelector.classList.add('hidden');
        metadataBar.classList.add('hidden');
        welcomeView.classList.add('hidden');
        errorView.classList.remove('hidden');
        emptyState.classList.remove('hidden');
    }

    saveToHistory(filename, allRouteGroups, pdfCreationTime);
}

// Unified Parser for All Formats (COMPOSICIÓN, DETALLE DE LA RUTA, PARADAS)
function parseUnifiedRoutes(fullText) {
    const rawPages = fullText.split('--- PAGE BREAK ---');
    const suministrosList = ['CONGELADO', 'REFRIGERADO', 'SECOS', 'PESCADO', 'CARNE', 'ENVASES', 'FRUTA', 'PAN', 'FRESCOS', 'VERDURA'];
    const provinces = ['ALACANT', 'MURCIA', 'VALENCIA', 'ALBACETE', 'ALMERIA', 'CASTELLON', 'MADRID', 'SEVILLA', 'BARCELONA', 'MALAGA', 'ZARAGOZA'];

    let allGroups = [];
    let currentGroup = null;

    function getOrCreateGroup(lines, fallbackViaje = '') {
        let vId = '';
        let emp = '';
        let veh = '';
        let rem = '';
        let tel = '';
        let telCli = '';
        let contacto = '';
        let fecha = '';
        let tamano = '';
        let tipo = '';

        for (let i = 0; i < lines.length; i++) {
            const l = lines[i];
            if (l.startsWith('VIAJE:')) {
                const same = l.replace('VIAJE:', '').trim();
                vId = same || (lines[i+1] && !lines[i+1].includes(':') ? lines[i+1].trim() : '');
            } else if (l.startsWith('EMPRESA DE TRANSPORTES:') || l === 'EMPRESA DE TRANSPORTES') {
                const same = l.replace(/EMPRESA DE TRANSPORTES:?/, '').trim();
                emp = same || (lines[i+1] && !lines[i+1].includes(':') ? lines[i+1].trim() : '');
            } else if (l.startsWith('VEHICULO:')) {
                const same = l.replace('VEHICULO:', '').trim();
                veh = same || (lines[i+1] && !lines[i+1].includes(':') ? lines[i+1].trim() : '');
            } else if (l.startsWith('MAT. REMOLQ.:')) {
                const same = l.replace('MAT. REMOLQ.:', '').trim();
                rem = same || (lines[i+1] && !lines[i+1].includes(':') ? lines[i+1].trim() : '');
            } else if (l.startsWith('TELÉFONO:') || l === 'TELÉFONO:') {
                const same = l.replace('TELÉFONO:', '').trim();
                const ph = same || (lines[i+1] && /^\d{9}$/.test(lines[i+1].trim()) ? lines[i+1].trim() : '');
                if (ph) {
                    if (!tel) tel = ph;
                    else telCli = ph;
                }
            } else if (l.startsWith('PERSONA CONTACTO:')) {
                const same = l.replace('PERSONA CONTACTO:', '').trim();
                contacto = same || (lines[i+1] && !lines[i+1].includes(':') ? lines[i+1].trim() : '');
            } else if (l.startsWith('FECHA SERVICIO:')) {
                const same = l.replace('FECHA SERVICIO:', '').trim();
                fecha = same || (lines[i+1] && !lines[i+1].includes(':') ? lines[i+1].trim() : '');
            } else if (l.startsWith('TAMAÑO:')) {
                const same = l.replace('TAMAÑO:', '').trim();
                tamano = same || (lines[i+1] && !lines[i+1].includes(':') ? lines[i+1].trim() : '');
            } else if (l.startsWith('TIPO:')) {
                const same = l.replace('TIPO:', '').trim();
                tipo = same || (lines[i+1] && !lines[i+1].includes(':') ? lines[i+1].trim() : '');
            }
        }

        // Si esta página inicia un viaje nuevo
        if (vId && (!currentGroup || currentGroup.viajeId !== vId)) {
            currentGroup = {
                viajeId: vId,
                tipoVehiculo: tipo,
                tamanoVehiculo: tamano,
                infoTransportista: { empresa: emp, vehiculo: veh, remolque: rem, telefono: tel },
                infoCliente: { contacto: contacto, telefono: telCli, fecha: fecha },
                tasks: []
            };
            allGroups.push(currentGroup);
            return currentGroup;
        }

        if (!currentGroup) {
            currentGroup = {
                viajeId: vId || fallbackViaje || 'VIAJE_1',
                tipoVehiculo: tipo,
                tamanoVehiculo: tamano,
                infoTransportista: { empresa: emp, vehiculo: veh, remolque: rem, telefono: tel },
                infoCliente: { contacto: contacto, telefono: telCli, fecha: fecha },
                tasks: []
            };
            allGroups.push(currentGroup);
        } else {
            // Completar datos si están en esta página
            if (emp && !currentGroup.infoTransportista.empresa) currentGroup.infoTransportista.empresa = emp;
            if (veh && !currentGroup.infoTransportista.vehiculo) currentGroup.infoTransportista.vehiculo = veh;
            if (rem && !currentGroup.infoTransportista.remolque) currentGroup.infoTransportista.remolque = rem;
            if (tel && !currentGroup.infoTransportista.telefono) currentGroup.infoTransportista.telefono = tel;
            if (contacto && !currentGroup.infoCliente.contacto) currentGroup.infoCliente.contacto = contacto;
            if (telCli && !currentGroup.infoCliente.telefono) currentGroup.infoCliente.telefono = telCli;
            if (fecha && !currentGroup.infoCliente.fecha) currentGroup.infoCliente.fecha = fecha;
            if (tipo && !currentGroup.tipoVehiculo) currentGroup.tipoVehiculo = tipo;
            if (tamano && !currentGroup.tamanoVehiculo) currentGroup.tamanoVehiculo = tamano;
        }

        return currentGroup;
    }

    rawPages.forEach((pageStr, pIdx) => {
        const lines = pageStr.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return;

        const group = getOrCreateGroup(lines, 'V_' + (pIdx+1));

        // Observaciones en esta página
        let pageObs = '';
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('OBSERVACIONES:')) {
                let parts = [lines[i].replace('OBSERVACIONES:', '').trim()];
                for (let j = i + 1; j < lines.length; j++) {
                    if (lines[j].startsWith('TOTAL SIN') || lines[j].startsWith('TOTAL') || lines[j].startsWith('DETALLE') || lines[j].startsWith('Gerente:') || lines[j].startsWith('---')) break;
                    parts.push(lines[j]);
                }
                pageObs = parts.join(' ').trim();
                break;
            }
        }

        const isDetalleRuta = lines.includes('DETALLE DE LA RUTA');
        const isComposicion = lines.includes('COMPOSICIÓN');

        let i = 0;
        while (i < lines.length) {
            const line = lines[i];

            // PARADAS (Lavado de camión, descansos, etc.)
            if (line === 'INICIO PARADA') {
                let paradaTipo = lines[i+1] || 'PARADA';
                let paradaSub = lines[i+2] || '';
                let paradaFecha = '';
                let paradaHora = '';
                let j = i + 1;
                while (j < lines.length && j < i + 10) {
                    const dtMatch = lines[j].match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}:\d{2})/);
                    if (dtMatch) {
                        paradaFecha = dtMatch[1];
                        paradaHora = dtMatch[2];
                        break;
                    }
                    j++;
                }

                let finHora = '';
                for (let k = j + 1; k < lines.length && k < j + 8; k++) {
                    if (lines[k] === 'FIN PARADA') {
                        for (let m = k + 1; m < lines.length && m < k + 6; m++) {
                            const finMatch = lines[m].match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}:\d{2})/);
                            if (finMatch) {
                                finHora = finMatch[2];
                                break;
                            }
                        }
                        break;
                    }
                }

                group.tasks.push({
                    tipo: 'PARADA',
                    mainTipo: 'PARADA',
                    subTipo: paradaTipo + (paradaSub ? ' ' + paradaSub : ''),
                    categoria: 'parada',
                    fecha: paradaFecha || group.infoCliente.fecha,
                    hora: paradaHora,
                    finHora: finHora,
                    destino: paradaTipo + (paradaSub ? ' ' + paradaSub : ''),
                    direccion: finHora ? ('Duración programada hasta las ' + finHora) : '',
                    items: [],
                    observaciones: pageObs
                });
                i = j + 1;
                continue;
            }

            if (line === 'CARGA' || line === 'DESCARGA') {
                const mainTipo = line;
                let subTipo = '';
                let nextIdx = i + 1;

                if (nextIdx < lines.length && ['ALMACÉN', 'TIENDA', 'ENVASES'].includes(lines[nextIdx])) {
                    subTipo = lines[nextIdx];
                    nextIdx++;
                }
                const fullTipo = subTipo ? `${mainTipo} ${subTipo}` : mainTipo;

                let fecha = '';
                let hora = '';

                // Extraer fecha y hora
                while (nextIdx < lines.length && !fecha) {
                    const dtMatch = lines[nextIdx].match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}:\d{2})/);
                    if (dtMatch) {
                        fecha = dtMatch[1];
                        hora = dtMatch[2];
                        nextIdx++;
                        break;
                    }
                    if (/^\d{2}\/\d{2}\/\d{4}$/.test(lines[nextIdx])) {
                        fecha = lines[nextIdx++];
                        if (nextIdx < lines.length && /^\d{2}:\d{2}$/.test(lines[nextIdx])) {
                            hora = lines[nextIdx++];
                        }
                        break;
                    }
                    nextIdx++;
                }

                // Destino y Dirección
                let origDestLines = [];
                while (nextIdx < lines.length) {
                    const cur = lines[nextIdx];
                    if (cur === 'MERCADONA' || cur === 'CARGA' || cur === 'DESCARGA' || cur === 'INICIO PARADA' || cur.startsWith('OBSERVACIONES:') || cur.startsWith('DETALLE') || cur.startsWith('---') || cur.startsWith('TOTAL')) {
                        break;
                    }
                    origDestLines.push(cur);
                    nextIdx++;
                    // En composicion la dirección termina en la provincia
                    if (provinces.includes(cur.toUpperCase())) {
                        break;
                    }
                }

                let destinoName = '';
                let direccion = '';
                let pIndex = -1;
                for (let d = 0; d < origDestLines.length; d++) {
                    if (provinces.includes(origDestLines[d].toUpperCase())) {
                        pIndex = d + 1;
                        break;
                    }
                }

                if (pIndex > 0) {
                    destinoName = origDestLines[0];
                    direccion = origDestLines.slice(1, pIndex).join(' ');
                } else if (origDestLines.length >= 2) {
                    destinoName = origDestLines[0];
                    direccion = origDestLines.slice(1).join(', ');
                } else {
                    destinoName = origDestLines.join(' ');
                }

                // Extraer líneas de productos / bultos
                let items = [];
                let itemLines = [];
                let stopTotalUds = '';
                let stopTotalKg = '';

                while (nextIdx < lines.length) {
                    const cur = lines[nextIdx];
                    if (cur === 'CARGA' || cur === 'DESCARGA' || cur === 'INICIO PARADA' || cur.startsWith('OBSERVACIONES:') || cur.startsWith('DETALLE') || cur.startsWith('---') || cur.startsWith('TOTAL SIN')) {
                        break;
                    }
                    itemLines.push(cur);
                    nextIdx++;
                }

                // Caso 1: DETALLE DE LA RUTA (con MERCADONA o números de pedido)
                if (itemLines.includes('MERCADONA')) {
                    let mercIdxs = [];
                    itemLines.forEach((l, idx) => { if (l === 'MERCADONA') mercIdxs.push(idx); });

                    for (let m = 0; m < mercIdxs.length; m++) {
                        const start = mercIdxs[m] + 1;
                        const end = (m + 1 < mercIdxs.length) ? mercIdxs[m + 1] : itemLines.length;
                        const block = itemLines.slice(start, end);

                        let numberIdxs = [];
                        block.forEach((bl, bIdx) => {
                            if (/^\d+,\d{2}$/.test(bl)) numberIdxs.push(bIdx);
                        });

                        if (numberIdxs.length >= 1) {
                            const hIdx = numberIdxs[0];
                            const huecosVal = block[hIdx];
                            const pesoVal = (hIdx + 1 < block.length && /^[\d.,]+$/.test(block[hIdx + 1])) ? block[hIdx + 1] : '';
                            const preText = block.slice(0, hIdx).join(' ');
                            const postStart = pesoVal ? hIdx + 2 : hIdx + 1;
                            const postText = block.slice(postStart).join(' ');

                            let agrupacion = preText;
                            let suministro = '';
                            for (const sum of suministrosList) {
                                if (preText.toUpperCase().includes(sum)) {
                                    suministro = sum;
                                    agrupacion = preText.replace(new RegExp('\\b' + sum + '\\b', 'i'), '').trim();
                                    break;
                                }
                            }

                            // Limpiar postText si contiene totales acumulados
                            let cleanPost = postText.replace(/\s+\d+,\d{2}(\s+[\d.,]+)?$/, '').trim();

                            items.push({
                                agrupacion: agrupacion || (mainTipo === 'DESCARGA' ? 'DESCARGA TIENDA' : 'GENERAL'),
                                suministro: suministro || '-',
                                huecos: huecosVal,
                                peso: pesoVal ? `${pesoVal} kg` : '-',
                                origen: '',
                                destino: cleanPost || destinoName
                            });
                        }
                    }
                } 
                // Caso 2: COMPOSICIÓN (Agrupaciones con Uds y Kgs)
                else {
                    let pIdx = 0;
                    let pendingName = [];
                    while (pIdx < itemLines.length) {
                        const cur = itemLines[pIdx];
                        if (/^\d+,\d{2}$/.test(cur)) {
                            const huecosVal = cur;
                            let storeId = '';
                            if (pIdx + 1 < itemLines.length && /^\d{4,}$/.test(itemLines[pIdx + 1])) {
                                storeId = itemLines[pIdx + 1];
                                pIdx += 2;
                            } else {
                                pIdx++;
                            }

                            // Comprobar si las siguientes dos líneas son totales de la parada (Uds y Kgs)
                            if (pIdx + 1 < itemLines.length && /^\d+,\d{2}$/.test(itemLines[pIdx]) && /^[\d.]+(?:,\d{2})?$/.test(itemLines[pIdx + 1])) {
                                stopTotalUds = itemLines[pIdx];
                                stopTotalKg = itemLines[pIdx + 1];
                                pIdx += 2;
                            }

                            const name = pendingName.join(' ').trim();
                            pendingName = [];

                            let suministro = '';
                            for (const sum of suministrosList) {
                                if (name.toUpperCase().includes(sum)) {
                                    suministro = sum;
                                    break;
                                }
                            }

                            items.push({
                                agrupacion: name || (mainTipo === 'DESCARGA' ? 'DESCARGA TIENDA' : 'CARGA ALMACÉN'),
                                suministro: suministro || '-',
                                huecos: huecosVal,
                                peso: '-',
                                origen: '',
                                destino: storeId || destinoName
                            });
                        } else {
                            pendingName.push(cur);
                            pIdx++;
                        }
                    }
                }

                if (fecha && !group.infoCliente.fecha) {
                    group.infoCliente.fecha = fecha;
                }

                group.tasks.push({
                    tipo: fullTipo,
                    mainTipo: mainTipo,
                    subTipo: subTipo,
                    categoria: isDetalleRuta ? 'tienda_nueva' : (isComposicion ? 'tienda' : 'reporte'),
                    fecha: fecha,
                    hora: hora,
                    destino: destinoName,
                    direccion: direccion,
                    items: items,
                    stopTotalUds: stopTotalUds,
                    stopTotalKg: stopTotalKg,
                    observaciones: pageObs
                });

                i = nextIdx;
                continue;
            }

            i++;
        }
    });

    return allGroups.filter(g => g.tasks.length > 0);
}

function renderFilters() {
    dateFilter.innerHTML = '';
    const now = new Date();
    const todayStr = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth()+1).padStart(2, '0') + '/' + now.getFullYear();
    
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = String(tomorrow.getDate()).padStart(2, '0') + '/' + String(tomorrow.getMonth()+1).padStart(2, '0') + '/' + tomorrow.getFullYear();

    availableDates.forEach(dateStr => {
        const option = document.createElement('option');
        option.value = dateStr;
        let label = dateStr;
        if (dateStr === todayStr) {
            label = `${dateStr} (Hoy)`;
        } else if (dateStr === tomorrowStr) {
            label = `${dateStr} (Mañana)`;
        }
        option.textContent = label;
        dateFilter.appendChild(option);
    });
}

// Auto-scroll a la siguiente tarea programada (SOLO si estamos en el mismo día)
function scrollToNextTask() {
    const selectedDate = dateFilter ? dateFilter.value : '';
    const now = new Date();
    const todayStr = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth()+1).padStart(2, '0') + '/' + now.getFullYear();

    // Si el parte NO es de hoy, no lleva a ningún lado
    if (selectedDate !== todayStr) {
        document.querySelectorAll('.task-card.is-closest-now').forEach(c => c.classList.remove('is-closest-now'));
        document.querySelectorAll('.closest-now-badge').forEach(b => b.remove());
        const floatBtn = document.getElementById('btn-float-now');
        if (floatBtn) floatBtn.style.display = 'none';
        return;
    }

    const taskCards = document.querySelectorAll('.task-card[data-task-time]');
    if (taskCards.length === 0) return;

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    let targetCard = null;
    let minFutureDiff = Infinity;
    let fallbackCard = null;
    let minAnyDiff = Infinity;

    taskCards.forEach(card => {
        const timeStr = card.getAttribute('data-task-time');
        if (!timeStr || !timeStr.includes(':')) return;
        const [h, m] = timeStr.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return;
        const taskMinutes = h * 60 + m;

        // Buscar siguiente tarea (hora >= hora actual)
        if (taskMinutes >= currentMinutes) {
            const diff = taskMinutes - currentMinutes;
            if (diff < minFutureDiff) {
                minFutureDiff = diff;
                targetCard = card;
            }
        }

        // Tarea más cercana si ya pasaron todas las del día
        const rawDiff = Math.abs(taskMinutes - currentMinutes);
        const circularDiff = Math.min(rawDiff, 1440 - rawDiff);
        if (circularDiff < minAnyDiff) {
            minAnyDiff = circularDiff;
            fallbackCard = card;
        }
    });

    const cardToHighlight = targetCard || fallbackCard;

    if (cardToHighlight) {
        document.querySelectorAll('.task-card.is-closest-now').forEach(c => c.classList.remove('is-closest-now'));
        cardToHighlight.classList.add('is-closest-now');
        
        cardToHighlight.querySelector('.closest-now-badge')?.remove();
        const badge = document.createElement('div');
        badge.className = 'closest-now-badge';
        const taskTime = cardToHighlight.getAttribute('data-task-time') || '';
        badge.innerHTML = `<span>⏱️ Siguiente tarea (${taskTime})</span>`;
        cardToHighlight.prepend(badge);

        setTimeout(() => {
            const topBar = document.querySelector('.top-bar-container');
            const topOffset = topBar ? topBar.offsetHeight : 80;
            const cardRect = cardToHighlight.getBoundingClientRect();
            const targetY = cardRect.top + window.pageYOffset - topOffset - 15;
            window.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
        }, 180);
    }
}

// Render Tasks
function renderTasks(shouldScrollToNext = false) {
    const selectedDate = dateFilter.value;
    const now = new Date();
    const todayStr = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth()+1).padStart(2, '0') + '/' + now.getFullYear();
    const isToday = (selectedDate === todayStr);
    
    tasksList.innerHTML = '';
    
    // Crear o actualizar botón flotante de siguiente tarea (SOLO visible si estamos en la fecha de hoy)
    let floatBtn = document.getElementById('btn-float-now');
    if (!floatBtn) {
        floatBtn = document.createElement('button');
        floatBtn.id = 'btn-float-now';
        floatBtn.className = 'btn-float-now';
        floatBtn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
            <span>Siguiente tarea</span>
        `;
        floatBtn.addEventListener('click', () => scrollToNextTask());
        document.body.appendChild(floatBtn);
    }
    floatBtn.style.display = isToday ? 'flex' : 'none';

    let visibleGroups = 0;

    allRouteGroups.forEach((group, gIdx) => {
        const filteredTasks = group.tasks.filter(t => t.fecha === selectedDate);
        if (filteredTasks.length === 0) return;

        visibleGroups++;
        
        const sec = document.createElement('div');
        sec.className = 'route-section';
        
        // Cabecera destacada de inicio de trabajo / viaje (NO VERDE, NO ROJA)
        const header = document.createElement('div');
        header.innerHTML = `
            <div class="route-section-badge">
                <span>💼 TRABAJO / VIAJE: ${group.viajeId || (gIdx + 1)}</span>
                <span>${group.infoCliente.fecha || selectedDate}</span>
            </div>
            <div class="route-header-block">
                <div class="route-header-main">
                    <div class="route-info-col carrier">
                        <div class="route-sub-title">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                            <span>DATOS TRANSPORTISTA</span>
                        </div>
                        <div class="route-meta-val">${group.infoTransportista.empresa || 'Empresa de transportes'}</div>
                        <div class="route-meta-grid">
                            <span>Vehículo: <b>${group.infoTransportista.vehiculo || '---'}</b></span>
                            <span>Remolque: <b>${group.infoTransportista.remolque || '---'}</b></span>
                            ${group.tipoVehiculo ? `<span>Tipo: <b>${group.tipoVehiculo}</b></span>` : ''}
                            ${group.tamanoVehiculo ? `<span>Tamaño: <b>${group.tamanoVehiculo}</b></span>` : ''}
                        </div>
                    </div>
                    <div class="route-info-col client">
                        <div class="route-sub-title">👤 CONTACTO Y SERVICIO</div>
                        <div class="route-meta-grid" style="grid-template-columns: 1fr;">
                            ${group.viajeId ? `<span>Nº Viaje: <b>${group.viajeId}</b></span>` : ''}
                            <span>Contacto: <b>${linkifyPhoneNumbers(group.infoCliente.contacto) || 'No especificado'}</b></span>
                            ${group.infoCliente.telefono ? `<span>Teléfono: <a href="tel:${group.infoCliente.telefono.replace(/\s+/g, '')}" class="tel-link"><b>${group.infoCliente.telefono}</b></a></span>` : ''}
                            ${group.infoCliente.fecha ? `<span>Fecha servicio: <b>${group.infoCliente.fecha}</b></span>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
        sec.appendChild(header);

        filteredTasks.sort((a,b) => (a.hora || '').localeCompare(b.hora || ''));

        filteredTasks.forEach((task, tIdx) => {
            // RENDER PARADA (Lavado camión, etc.)
            if (task.mainTipo === 'PARADA') {
                const elParada = document.createElement('div');
                elParada.className = 'task-card parada';
                if (task.hora) elParada.setAttribute('data-task-time', task.hora);

                elParada.innerHTML = `
                    <div class="task-header">
                        <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                            <span class="task-type parada">⏸️ PARADA</span>
                            <span class="task-subtype parada">${task.subTipo || 'LAVADO CAMIÓN'}</span>
                        </div>
                        <div class="task-time parada">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                            <span>${task.hora}${task.finHora ? ' - ' + task.finHora : ''}</span>
                        </div>
                    </div>
                    <div class="task-detail destination"><b>${task.destino}</b></div>
                    ${task.direccion ? `<div class="task-detail address" style="font-size:0.85rem; color:var(--text-muted);">${task.direccion}</div>` : ''}
                    ${task.observaciones ? `<div class="divider"></div><div class="section-label">Observaciones</div><div class="task-observations">${linkifyPhoneNumbers(task.observaciones)}</div>` : ''}
                `;
                sec.appendChild(elParada);
                return;
            }

            // RENDER CARGA / DESCARGA (Sin suministros ni peso)
            let prodHTML = '';
            let totalHuecosTrip = 0;

            if (task.items && task.items.length > 0) {
                const isDescarga = task.mainTipo === 'DESCARGA';

                let tableRows = task.items.map((it, itIdx) => {
                    const hVal = parseFloat((it.huecos || '0').replace(',', '.')) || 0;
                    totalHuecosTrip += hVal;
                    
                    const numHuecosMax = Math.floor(hVal);
                    const itemKey = `${task.hora}_${it.agrupacion || 'item'}_${it.destino || itIdx}`.replace(/\s+/g, '_');
                    let savedCount = getSavedCheck(itemKey);
                    let initialBadges = '';
                    for (let n = 1; n <= savedCount; n++) {
                        const isOver = n > numHuecosMax;
                        const isLast = n === savedCount;
                        initialBadges += `<span class="check-item-badge ${isOver ? 'over-max' : 'verified'} ${isLast ? 'last-added' : ''}">${n}</span>`;
                    }
                    const isCompleted = savedCount > 0 && savedCount >= numHuecosMax;

                    if (isDescarga) {
                        return `
                            <tr class="item-main-row clickable-pedido ${isCompleted ? 'row-completed' : ''}" data-pedido="${itemKey}" data-huecos="${numHuecosMax}">
                                <td class="item-pedido">${it.destino ? `Entrega en: <b>${it.destino}</b>` : (it.agrupacion || 'Descarga Tienda')}</td>
                                <td class="item-huecos"><b>${it.huecos || '-'}</b></td>
                            </tr>
                            <tr class="check-row-wrapper">
                                <td colspan="2"><div class="pedido-checks-container">${initialBadges}</div></td>
                            </tr>
                        `;
                    } else {
                        return `
                            <tr class="item-main-row clickable-pedido ${isCompleted ? 'row-completed' : ''}" data-pedido="${itemKey}" data-huecos="${numHuecosMax}">
                                <td class="item-pedido">${it.agrupacion || '-'}</td>
                                <td class="item-huecos"><b>${it.huecos || '-'}</b></td>
                                <td class="item-destino">${it.destino || '-'}</td>
                            </tr>
                            <tr class="check-row-wrapper">
                                <td colspan="3"><div class="pedido-checks-container">${initialBadges}</div></td>
                            </tr>
                        `;
                    }
                }).join('');

                // Totales de la parada / tarea (Sin peso)
                let displayHuecos = totalHuecosTrip > 0 ? totalHuecosTrip.toFixed(2).replace('.', ',') : (task.stopTotalUds || '-');

                const statsBarHTML = `
                    <div class="reporte-stats-bar">
                        <div class="stat-item">
                            <span class="stat-label">HUECOS TOTALES:</span>
                            <span class="stat-value">${displayHuecos}</span>
                        </div>
                        ${isCheckModeEnabled ? `
                        <div class="stat-item highlight">
                            <span class="stat-label">${isDescarga ? 'DESCARGADOS:' : 'CARGADOS:'}</span>
                            <span class="stat-value trip-loaded-count">0</span>
                        </div>
                        ` : ''}
                    </div>
                `;

                let tableHeaders = isDescarga ? `
                    <tr>
                        <th>DETALLE</th>
                        <th>HUECOS</th>
                    </tr>
                ` : `
                    <tr>
                        <th>AGRUPACIÓN</th>
                        <th>HUECOS</th>
                        <th>DESTINO</th>
                    </tr>
                `;

                prodHTML = `
                    <div class="divider"></div>
                    <div class="section-label">Detalle de ${isDescarga ? 'Descarga' : 'Carga'} ${isCheckModeEnabled ? '(Modo Comprobación)' : ''}</div>
                    <div class="table-responsive">
                        <table class="products-table reporte-table">
                            <thead>${tableHeaders}</thead>
                            <tbody>${tableRows}</tbody>
                        </table>
                    </div>
                    ${statsBarHTML}
                `;
            }

            const mainCardClass = (task.mainTipo || task.tipo || 'carga').toLowerCase();
            const el = document.createElement('div');
            el.className = `task-card ${mainCardClass.includes('descarga') ? 'descarga' : 'carga'}`;
            if (task.hora) el.setAttribute('data-task-time', task.hora);

            let obsHTML = '';
            if (task.observaciones) {
                obsHTML = `<div class="divider"></div><div class="section-label">Observaciones</div><div class="task-observations">${linkifyPhoneNumbers(task.observaciones)}</div>`;
            }

            const fullAddress = `${task.destino} ${task.direccion}`.trim();
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

            el.innerHTML = `
                <div class="task-header">
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <span class="task-type">${task.mainTipo || task.tipo}</span>
                        ${task.subTipo ? `<span class="task-subtype ${task.subTipo.toLowerCase()}">${task.subTipo}</span>` : ''}
                    </div>
                    <div class="task-time">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                        <span>${task.hora || '--:--'}</span>
                    </div>
                </div>
                <div class="task-detail destination">${linkifyPhoneNumbers(task.destino)}</div>
                <div class="task-detail address">
                    ${task.direccion ? `
                        <a href="${mapsUrl}" target="_blank" class="maps-link" title="Abrir en Google Maps">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            <span class="address-text">${linkifyPhoneNumbers(task.direccion)}</span>
                        </a>
                    ` : 'Dirección no especificada'}
                </div>
                ${prodHTML}${obsHTML}
            `;
            sec.appendChild(el);
        });

        tasksList.appendChild(sec);
    });

    if (visibleGroups === 0) {
        if (floatBtn) floatBtn.style.display = 'none';
        const otherDatesWithTasks = availableDates.filter(d => {
            return allRouteGroups.some(g => g.tasks.some(t => t.fecha === d));
        });

        let switchButtonHtml = '';
        if (otherDatesWithTasks.length > 0) {
            const nextDate = otherDatesWithTasks[0];
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = String(tomorrow.getDate()).padStart(2, '0') + '/' + String(tomorrow.getMonth()+1).padStart(2, '0') + '/' + tomorrow.getFullYear();
            const nextLabel = nextDate === tomorrowStr ? `Ver tareas de Mañana (${nextDate})` : `Ver tareas del ${nextDate}`;
            switchButtonHtml = `
                <div style="margin-top: 1.25rem;">
                    <button id="btn-quick-switch-date" class="btn-compact highlight" style="padding: 0.6rem 1.25rem; font-size: 0.9rem; margin: 0 auto; display: inline-flex; align-items: center; gap: 0.5rem; border-radius: 8px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span>${nextLabel}</span>
                    </button>
                </div>
            `;
        }

        tasksList.innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 2.5rem 1rem; background: white; border-radius: 12px; border: 1px dashed var(--border-color); margin: 1rem 0;">
                <p style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.35rem;">No hay tareas programadas para el ${selectedDate}.</p>
                <p style="font-size: 0.85rem;">Puedes consultar otra fecha en el selector superior.</p>
                ${switchButtonHtml}
            </div>
        `;

        const quickSwitchBtn = document.getElementById('btn-quick-switch-date');
        if (quickSwitchBtn && otherDatesWithTasks.length > 0) {
            quickSwitchBtn.addEventListener('click', () => {
                dateFilter.value = otherDatesWithTasks[0];
                renderTasks(true);
            });
        }
    } else {
        // Al abrir o cambiar de fecha, solo llevar a la siguiente tarea SI es hoy
        if (shouldScrollToNext && isToday) {
            scrollToNextTask();
        }
    }

    // Refresh all local counters after rendering
    document.querySelectorAll('.task-card').forEach(card => {
        refreshLocalCounter(card);
    });
}

// Global Click Handler for Checks
document.addEventListener('click', (e) => {
    if (!isCheckModeEnabled) return;
    
    // 1. Borrar badge al hacer clic sobre él
    if (e.target.classList.contains('check-item-badge')) {
        e.stopPropagation();
        
        if (!confirm('¿Seguro que quieres borrar este pallet?')) return;
        
        const container = e.target.parentElement;
        const row = container.closest('.check-row-wrapper').previousElementSibling;
        const max = parseInt(row.getAttribute('data-huecos')) || 0;
        const pedido = row.getAttribute('data-pedido');
        
        e.target.remove();
        
        const remaining = container.querySelectorAll('.check-item-badge');
        remaining.forEach((badge, index) => {
            const num = index + 1;
            badge.textContent = num;
            if (num > max) {
                badge.classList.add('over-max');
                badge.classList.remove('verified');
            } else {
                badge.classList.add('verified');
                badge.classList.remove('over-max');
            }
            if (index === remaining.length - 1) {
                badge.classList.add('last-added');
            } else {
                badge.classList.remove('last-added');
            }
        });
        
        saveCheck(pedido, remaining.length);
        
        if (remaining.length < max) {
            row.classList.remove('row-completed');
        } else {
            row.classList.add('row-completed');
        }

        refreshLocalCounter(container.closest('.task-card'));
        return;
    }

    // 2. Añadir badge al pulsar la fila
    const row = e.target.closest('.clickable-pedido');
    if (row) {
        const container = row.nextElementSibling.querySelector('.pedido-checks-container');
        if (!container) return;
        
        document.querySelectorAll('.check-item-badge.last-added').forEach(b => b.classList.remove('last-added'));

        const pedido = row.getAttribute('data-pedido');
        const max = parseInt(row.getAttribute('data-huecos')) || 0;
        const currentCount = container.querySelectorAll('.check-item-badge').length;
        const nextNum = currentCount + 1;
        
        const badge = document.createElement('span');
        badge.className = 'check-item-badge last-added';
        badge.textContent = nextNum;
        
        if (nextNum > max) {
            badge.classList.add('over-max');
        } else {
            badge.classList.add('verified');
        }
        
        container.appendChild(badge);
        saveCheck(pedido, nextNum);

        if (nextNum >= max) {
            row.classList.add('row-completed');
        } else {
            row.classList.remove('row-completed');
        }

        refreshLocalCounter(row.closest('.task-card'));
    }
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js').catch(err => console.log('SW error:', err));
    });
}

// Carga automática si se abre con enlace en los parámetros de la URL (?url= o ?pdf=)
window.addEventListener('DOMContentLoaded', () => {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const directUrl = urlParams.get('url') || urlParams.get('pdf') || urlParams.get('link');
        if (directUrl) {
            loadPdfFromUrl(directUrl);
        }
    } catch (e) {
        console.warn('Error al leer parámetros de URL:', e);
    }
});
