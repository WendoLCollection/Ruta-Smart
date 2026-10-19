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
        setTimeout(() => {
            if (inputPdfUrl) {
                inputPdfUrl.focus();
                inputPdfUrl.select();
            }
        }, 120);
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

// Pegar enlace desde portapapeles
btnPasteUrl?.addEventListener('click', async () => {
    try {
        if (navigator.clipboard && navigator.clipboard.readText) {
            const text = await navigator.clipboard.readText();
            if (text && text.trim()) {
                inputPdfUrl.value = text.trim();
                inputPdfUrl.focus();
                return;
            }
        }
    } catch (err) {
        console.warn('Error accediendo al portapapeles:', err);
    }
    inputPdfUrl.focus();
    inputPdfUrl.select();
});

// Limpiar campo de texto en modal
btnClearInput?.addEventListener('click', () => {
    if (inputPdfUrl) {
        inputPdfUrl.value = '';
        inputPdfUrl.focus();
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
        alert('Por favor, introduce o pega un enlace web válido.');
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
        
        // Intentar descarga directa con cache busting
        const cacheBustUrl = url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
        try {
            response = await fetch(cacheBustUrl);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            blob = await response.blob();
        } catch (fetchErr) {
            console.warn('Descarga directa no permitida (CORS o red), probando vía proxy...', fetchErr);
            // Intentar a través de proxy CORS
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

        // Nombre descriptivo con fecha para no sobreescribir partes de días distintos
        let downloadName = '';
        try {
            const urlPath = new URL(url).pathname;
            const parts = urlPath.split('/').filter(Boolean);
            if (parts.length > 0 && parts[parts.length - 1].toLowerCase().endsWith('.pdf')) {
                downloadName = decodeURIComponent(parts[parts.length - 1]);
            }
        } catch (e) {}

        if (!downloadName) {
            const now = new Date();
            const dateStr = String(now.getDate()).padStart(2, '0') + '-' + String(now.getMonth()+1).padStart(2, '0') + '-' + now.getFullYear();
            downloadName = `Parte_${dateStr}.pdf`;
        }

        const arrayBuffer = await blob.arrayBuffer();
        await processPdfArrayBuffer(arrayBuffer, downloadName, blob);
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
    // Avoid duplicates by name + time
    history = history.filter(h => h.filename !== filename || h.creationTime !== creationTime);
    
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
                <span class="history-item-time">${item.creationTime || 'Sin fecha de creación'}</span>
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
            
            // Recalculate available dates for this specific data
            const allTaskDates = allRouteGroups.flatMap(g => g.tasks.map(t => t.fecha));
            const datesSet = new Set(allTaskDates.filter(f => f));
            const now = new Date();
            const todayStr = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth()+1).padStart(2, '0') + '/' + now.getFullYear();
            datesSet.add(todayStr);

            availableDates = Array.from(datesSet).sort((a,b) => {
                const [d1,m1,y1] = a.split('/');
                const [d2,m2,y2] = b.split('/');
                return new Date(y1,m1-1,d1) - new Date(y2,m2-1,d2);
            });

            renderFilters();
            if (availableDates.includes(todayStr)) {
                dateFilter.value = todayStr;
            } else if (availableDates.length > 0) {
                dateFilter.value = availableDates[0];
            }
            
            pdfTimestampEl.textContent = (pdfCreationTime ? `(Actualizado: ${pdfCreationTime})` : "") + ` • Hoy: ${todayStr}`;
            
            // Try to load Original PDF from DB
            getPdfFromDB(currentPdfFilename).then(blob => {
                if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
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
    renderTasks(false); // El modo check NO debe mover la página
});

// Helper to parse report products into structured data (legacy / report format)
function parseReporteItems(productos) {
    let parsedReporte = [];
    let pIdx = 0;
    while (pIdx < productos.length) {
        let maybePedido = productos[pIdx].trim();
        // Look for 7-10 digit numbers (Order Numbers)
        if (/^\d{7,10}$/.test(maybePedido)) {
            let huecos = '0';
            let destinoFinal = '-';
            // Look ahead for huecos format: 1,00 or 2,00
            for (let j = pIdx + 1; j < pIdx + 5 && j < productos.length; j++) {
                if (/^\d+,[\d]{2}$/.test(productos[j].trim())) {
                    huecos = productos[j].trim();
                    // Look further ahead for destination
                    for (let k = j + 1; k < j + 6 && k < productos.length; k++) {
                        let candidate = productos[k].trim();
                        if (candidate.length > 3 && !/^\d+,\d{2}$/.test(candidate) && !candidate.includes('TOTAL')) {
                            let sameLineMatch = candidate.match(/(.+?)\s+(\d{4})$/);
                            if (sameLineMatch) {
                                destinoFinal = sameLineMatch[1].trim();
                                break;
                            }
                            if (k + 1 < productos.length && /^\d{4}$/.test(productos[k+1].trim())) {
                                destinoFinal = candidate;
                                break;
                            }
                        }
                    }
                    break;
                }
            }
            parsedReporte.push({ pedido: maybePedido, huecos: huecos, destinoFinal: destinoFinal });
            pIdx += 2;
        } else {
            pIdx++;
        }
    }
    return parsedReporte;
}

// Helper to find and link phone numbers in text
function linkifyPhoneNumbers(text) {
    if (!text) return text;
    // Regex for typical Spanish phone numbers (9 digits, maybe spaces, maybe +34)
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

// File upload event
uploadBtn.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const arrayBuffer = await file.arrayBuffer();
        await processPdfArrayBuffer(arrayBuffer, file.name, file);
    } catch (err) {
        console.error("Error reading PDF file:", err);
        alert('Hubo un error al leer el archivo. Inténtalo de nuevo.');
    } finally {
        uploadBtn.value = ''; // Reset input to allow re-uploading the same file
    }
});

// Process ArrayBuffer
async function processPdfArrayBuffer(arrayBuffer, filename, fileBlob = null) {
    if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
    if (fileBlob) {
        currentPdfUrl = URL.createObjectURL(fileBlob);
        savePdfToDB(filename, fileBlob);
    } else {
        const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
        currentPdfUrl = URL.createObjectURL(blob);
        savePdfToDB(filename, blob);
    }
    
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

        parsePDFText(fullText, filename);
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
function parsePDFText(fullText, filename) {
    currentPdfFilename = filename;
    
    // Detect whether document is in NEW FORMAT or OLD FORMAT
    const isNewFormat = fullText.includes('DETALLES RUTA TRANSPORTISTA') || 
                        (fullText.includes('DETALLE DE LA RUTA') && fullText.includes('AGRUPACIÓN'));

    // Extract creation timestamp
    const timeMatch = fullText.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
    if (timeMatch) {
        pdfCreationTime = timeMatch[1];
    } else {
        pdfCreationTime = '';
    }

    if (isNewFormat) {
        allRouteGroups = parseNewFormat(fullText);
        if (metadataTitleEl) metadataTitleEl.textContent = 'DETALLES RUTA TRANSPORTISTA';
    } else {
        allRouteGroups = parseOldFormat(fullText);
        if (metadataTitleEl) metadataTitleEl.textContent = 'DETALLE RUTAS TRANSPORTISTA';
    }

    if (allRouteGroups.length > 0) {
        welcomeView.classList.add('hidden');
        errorView.classList.add('hidden');
        emptyState.classList.add('hidden');

        // Populate Filters
        const allTaskDates = allRouteGroups.flatMap(g => g.tasks.map(t => t.fecha));
        const datesSet = new Set(allTaskDates.filter(f => f));
        
        // Incluir siempre la fecha de hoy
        const now = new Date();
        const todayStr = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth()+1).padStart(2, '0') + '/' + now.getFullYear();
        datesSet.add(todayStr);

        availableDates = Array.from(datesSet).sort((a,b) => {
            const [d1,m1,y1] = a.split('/');
            const [d2,m2,y2] = b.split('/');
            return new Date(y1,m1-1,d1) - new Date(y2,m2-1,d2);
        });

        renderFilters();
        
        if (availableDates.includes(todayStr)) {
            dateFilter.value = todayStr;
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

// Parser for NEW FORMAT ("DETALLES RUTA TRANSPORTISTA")
function parseNewFormat(fullText) {
    const rawPages = fullText.split('--- PAGE BREAK ---');
    let groups = [];
    const suministrosList = ['CONGELADO', 'REFRIGERADO', 'SECOS', 'PESCADO', 'CARNE', 'ENVASES', 'FRUTA', 'PAN'];

    rawPages.forEach((pageStr) => {
        const lines = pageStr.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) return;
        if (!lines.some(l => l.includes('VIAJE:') || l.includes('DETALLE DE LA RUTA'))) return;

        const group = {
            viajeId: '',
            tipoVehiculo: '',
            tamanoVehiculo: '',
            infoTransportista: { empresa: '', vehiculo: '', remolque: '', telefono: '' },
            infoCliente: { contacto: '', telefono: '', fecha: '' },
            tasks: []
        };

        let i = 0;
        // 1. Header parsing
        while (i < lines.length) {
            const line = lines[i];
            if (line === 'DETALLE DE LA RUTA') break;

            if (line === 'EMPRESA DE TRANSPORTES' || line === 'EMPRESA DE TRANSPORTES:') {
                if (i + 1 < lines.length && !lines[i+1].includes(':')) {
                    group.infoTransportista.empresa = lines[++i];
                }
            } else if (line.startsWith('EMPRESA DE TRANSPORTES:')) {
                group.infoTransportista.empresa = line.replace('EMPRESA DE TRANSPORTES:', '').trim();
            } else if (line.startsWith('VEHICULO:')) {
                const val = line.replace('VEHICULO:', '').trim();
                group.infoTransportista.vehiculo = val || (lines[i+1] && !lines[i+1].includes(':') ? lines[++i] : '');
            } else if (line.startsWith('MAT. REMOLQ.:')) {
                const val = line.replace('MAT. REMOLQ.:', '').trim();
                group.infoTransportista.remolque = val || (lines[i+1] && !lines[i+1].includes(':') ? lines[++i] : '');
            } else if (line.startsWith('TELÉFONO:') || line === 'TELÉFONO:') {
                const val = line.replace('TELÉFONO:', '').trim();
                const phoneVal = val || (lines[i+1] && /^\d{9}$/.test(lines[i+1]) ? lines[++i] : '');
                if (phoneVal) {
                    if (!group.infoTransportista.telefono) group.infoTransportista.telefono = phoneVal;
                    else group.infoCliente.telefono = phoneVal;
                }
            } else if (line.startsWith('PERSONA CONTACTO:')) {
                const val = line.replace('PERSONA CONTACTO:', '').trim();
                group.infoCliente.contacto = val || (lines[i+1] && !lines[i+1].includes(':') ? lines[++i] : '');
            } else if (line.startsWith('VIAJE:')) {
                const val = line.replace('VIAJE:', '').trim();
                group.viajeId = val || (lines[i+1] && !lines[i+1].includes(':') ? lines[++i] : '');
            } else if (line.startsWith('TAMAÑO:')) {
                const val = line.replace('TAMAÑO:', '').trim();
                group.tamanoVehiculo = val || (lines[i+1] && !lines[i+1].includes(':') ? lines[++i] : '');
            } else if (line.startsWith('TIPO:')) {
                const val = line.replace('TIPO:', '').trim();
                group.tipoVehiculo = val || (lines[i+1] && !lines[i+1].includes(':') ? lines[++i] : '');
            }
            i++;
        }

        // 2. Observations at page level
        let pageObservaciones = '';
        for (let k = 0; k < lines.length; k++) {
            if (lines[k].startsWith('OBSERVACIONES:')) {
                let obsParts = [lines[k].replace('OBSERVACIONES:', '').trim()];
                for (let m = k + 1; m < lines.length; m++) {
                    if (lines[m].startsWith('===') || lines[m].includes('--- PAGE BREAK ---')) break;
                    obsParts.push(lines[m]);
                }
                pageObservaciones = obsParts.join(' ').trim();
                break;
            }
        }

        // 3. Skip to first CARGA or DESCARGA
        while (i < lines.length) {
            if (lines[i] === 'CARGA' || lines[i] === 'DESCARGA') break;
            i++;
        }

        // 4. Tasks Parsing
        while (i < lines.length) {
            const line = lines[i];
            if (line.startsWith('OBSERVACIONES:')) break;

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
                while (nextIdx < lines.length && !fecha) {
                    if (/^\d{2}\/\d{2}\/\d{4}$/.test(lines[nextIdx])) {
                        fecha = lines[nextIdx++];
                        if (nextIdx < lines.length && /^\d{2}:\d{2}$/.test(lines[nextIdx])) {
                            hora = lines[nextIdx++];
                        }
                        break;
                    }
                    nextIdx++;
                }

                // Origin / Destination lines until MERCADONA or next task
                let origDestLines = [];
                while (nextIdx < lines.length) {
                    if (lines[nextIdx] === 'MERCADONA' || lines[nextIdx] === 'CARGA' || lines[nextIdx] === 'DESCARGA' || lines[nextIdx].startsWith('OBSERVACIONES:')) {
                        break;
                    }
                    origDestLines.push(lines[nextIdx]);
                    nextIdx++;
                }

                const origDestFull = origDestLines.join(' ');
                let destinoName = '';
                let direccion = '';
                const commaParts = origDestFull.split(',').map(s => s.trim());
                if (commaParts.length >= 2) {
                    destinoName = `${commaParts[0]}, ${commaParts[1]}`;
                    direccion = commaParts.slice(2).join(', ').trim();
                } else {
                    destinoName = origDestFull;
                }

                // Item lines
                let itemLines = [];
                while (nextIdx < lines.length) {
                    if (lines[nextIdx] === 'CARGA' || lines[nextIdx] === 'DESCARGA' || lines[nextIdx].startsWith('OBSERVACIONES:')) {
                        break;
                    }
                    itemLines.push(lines[nextIdx]);
                    nextIdx++;
                }

                let items = [];
                let mercIdxs = [];
                itemLines.forEach((l, idx) => {
                    if (l === 'MERCADONA') mercIdxs.push(idx);
                });

                if (mercIdxs.length > 0) {
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
                                if (preText.toUpperCase().endsWith(sum)) {
                                    suministro = sum;
                                    agrupacion = preText.slice(0, preText.length - sum.length).trim();
                                    break;
                                }
                            }
                            if (!suministro && suministrosList.includes(preText.toUpperCase())) {
                                suministro = preText.toUpperCase();
                            }

                            // If mainTipo is DESCARGA, preText actually contains origin & destination
                            let origen = '';
                            let destinoFinal = '';
                            let targetPost = (mainTipo === 'DESCARGA' && !postText) ? preText : postText;
                            targetPost = targetPost.replace(/\s+\d+,\d{2}(\s+[\d.,]+)?$/, '').trim();
                            const postMatch = targetPost.match(/^(.+?\b\d{3,5})\s+(.+)$/);
                            if (postMatch) {
                                origen = postMatch[1].trim();
                                destinoFinal = postMatch[2].trim();
                            } else {
                                destinoFinal = targetPost;
                            }

                            items.push({
                                agrupacion: agrupacion || (mainTipo === 'DESCARGA' ? 'DESCARGA COMPLETA' : 'GENERAL'),
                                suministro: suministro || '-',
                                huecos: huecosVal,
                                peso: pesoVal ? `${pesoVal} kg` : '-',
                                origen: origen,
                                destino: destinoFinal
                            });
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
                    categoria: 'tienda_nueva',
                    fecha: fecha,
                    hora: hora,
                    destino: destinoName,
                    direccion: direccion,
                    items: items,
                    observaciones: pageObservaciones
                });

                i = nextIdx;
                continue;
            }
            i++;
        }

        if (group.tasks.length > 0) {
            groups.push(group);
        }
    });

    return groups;
}

// Parser for OLD FORMAT (legacy "COMPOSICIÓN" or "DETALLE RUTAS TRANSPORTISTA")
function parseOldFormat(fullText) {
    const lines = fullText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let allRouteGroups = [];
    let i = 0;
    let currentCategoria = 'tienda';
    let currentGroup = null;

    function createNewGroup() {
        return {
            viajeId: '',
            infoTransportista: { empresa: '', vehiculo: '', remolque: '', telefono: '' },
            infoCliente: { contacto: '', telefono: '', fecha: '' },
            tasks: []
        };
    }

    function getVal(label) {
        const sameLine = lines[i].replace(label, '').trim();
        if (sameLine) return sameLine;
        const next = lines[i+1] || '';
        if (next && !next.includes(':') && !next.startsWith('---')) return next;
        return '';
    }

    while (i < lines.length) {
        let line = lines[i].trim();

        if (line.startsWith('VIAJE:')) {
            if (currentGroup && currentGroup.tasks.length > 0) {
                allRouteGroups.push(currentGroup);
            }
            currentGroup = createNewGroup();
            currentGroup.viajeId = getVal('VIAJE:');
        }

        if (!currentGroup) currentGroup = createNewGroup();

        if (line.startsWith('EMPRESA DE TRANSPORTES:') || line === 'EMPRESA DE TRANSPORTES') {
            currentGroup.infoTransportista.empresa = getVal(line.includes(':') ? 'EMPRESA DE TRANSPORTES:' : 'EMPRESA DE TRANSPORTES');
        } else if (line.startsWith('VEHICULO:')) {
            currentGroup.infoTransportista.vehiculo = getVal('VEHICULO:');
        } else if (line.startsWith('MAT. REMOLQ.:')) {
            currentGroup.infoTransportista.remolque = getVal('MAT. REMOLQ.:');
        } else if (line.startsWith('TELÉFONO:') || line === 'TELÉFONO:') {
            const val = getVal('TELÉFONO:');
            if (val) {
                if (!currentGroup.infoTransportista.telefono) currentGroup.infoTransportista.telefono = val;
                else currentGroup.infoCliente.telefono = val;
            }
        } else if (line.startsWith('PERSONA CONTACTO:')) {
            currentGroup.infoCliente.contacto = getVal('PERSONA CONTACTO:');
        } else if (line.startsWith('FECHA SERVICIO:')) {
            currentGroup.infoCliente.fecha = getVal('FECHA SERVICIO:');
        }

        if (line.includes('COMPOSICIÓN') || line.includes('ZONA ORIGEN:')) {
            currentCategoria = 'tienda';
        } else if (line.includes('DETALLE DE LA RUTA') || line.includes('INFORMACION COMPLEMENTARIA')) {
            currentCategoria = 'reporte';
        }

        if (line === 'CARGA' || line === 'DESCARGA') {
            const tipo = line;
            i++;
            let currentTask = {
                tipo,
                mainTipo: tipo,
                subTipo: '',
                categoria: currentCategoria,
                fecha: '',
                hora: '',
                destino: '',
                direccion: '',
                productos: [],
                observaciones: ''
            };

            while (i < lines.length) {
                let nextLine = lines[i];
                if (nextLine === 'CARGA' || nextLine === 'DESCARGA' || nextLine.includes('DETALLE RUTAS') || nextLine.startsWith('OBSERVACIONES:')) {
                    break;
                }
                const dtMatch = nextLine.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}:\d{2})/);
                if (dtMatch) {
                    currentTask.fecha = dtMatch[1];
                    currentTask.hora = dtMatch[2];
                } else if (!currentTask.fecha && nextLine.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                    currentTask.fecha = nextLine;
                } else if (!currentTask.hora && nextLine.match(/^\d{2}:\d{2}$/)) {
                    currentTask.hora = nextLine;
                } else if (currentTask.fecha && currentTask.hora) {
                    if (!currentTask.destino) {
                        currentTask.destino = nextLine;
                    } else {
                        let details = [];
                        while (i < lines.length) {
                            let dl = lines[i];
                            if (dl === 'CARGA' || dl === 'DESCARGA' || dl.includes('DETALLE RUTAS') || dl.startsWith('OBSERVACIONES:') || dl.includes('--- PAGE BREAK ---') || dl === 'INICIO PARADA') {
                                break;
                            }
                            details.push(dl);
                            i++;
                        }
                        let pIndex = Math.min(2, details.length);
                        const provinces = ['ALACANT', 'MURCIA', 'VALENCIA', 'ALBACETE', 'ALMERIA', 'CASTELLON', 'MADRID'];
                        for (let d=0; d<details.length; d++) {
                            if (provinces.includes(details[d].toUpperCase())) {
                                pIndex = d + 1;
                                break;
                            }
                        }
                        currentTask.direccion = details.slice(0, pIndex).join(' ');
                        currentTask.productos = details.slice(pIndex).filter(p => !p.match(/^(?:CARGA|DESCARGA)$/i));
                        i--;
                        break;
                    }
                }
                i++;
            }
            if (currentTask.fecha) {
                currentGroup.tasks.push(currentTask);
            }
            continue;
        }

        if (line.startsWith('OBSERVACIONES:')) {
            let obs = line.replace('OBSERVACIONES:', '').trim() + ' ';
            i++;
            while (i < lines.length) {
                let nextLine = lines[i];
                if (nextLine === 'CARGA' || nextLine === 'DESCARGA' || nextLine.includes('DETALLE RUTAS') || nextLine.startsWith('TOTAL SIN') || nextLine.startsWith('TOTAL') || nextLine.startsWith('--- PAGE BREAK ---')) {
                    break;
                }
                obs += nextLine + ' ';
                i++;
            }
            for (let j = currentGroup.tasks.length - 1; j >= 0; j--) {
                if (!currentGroup.tasks[j].observaciones) {
                    currentGroup.tasks[j].observaciones = obs.trim();
                } else {
                    break;
                }
            }
            continue;
        }
        i++;
    }

    if (currentGroup && currentGroup.tasks.length > 0) {
        allRouteGroups.push(currentGroup);
    }

    return allRouteGroups;
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

function renderTasks(shouldScroll = false) {
    const selectedDate = dateFilter.value;
    const currentScrollY = window.scrollY;
    
    if (shouldScroll) {
        // Solo hacer scroll al inicio cuando cambiamos de fecha explícitamente
        window.scrollTo({ top: 0, behavior: 'smooth' });
        tasksList.classList.remove('animate-update');
        void tasksList.offsetWidth; // Trigger reflow
        tasksList.classList.add('animate-update');
    }
    
    tasksList.innerHTML = '';
    
    // Calculate global daily totals for summary bar
    let globalDailyHuecos = 0;
    allRouteGroups.forEach(group => {
        group.tasks.filter(t => t.fecha === selectedDate).forEach(task => {
            if (task.categoria === 'tienda_nueva') {
                if (task.mainTipo === 'CARGA' && task.items) {
                    task.items.forEach(it => {
                        const h = parseFloat((it.huecos || '0').replace(',', '.')) || 0;
                        globalDailyHuecos += Math.floor(h);
                    });
                }
            } else if (task.categoria === 'reporte' && task.productos) {
                const items = parseReporteItems(task.productos);
                items.forEach(it => {
                    globalDailyHuecos += (Math.floor(parseFloat(it.huecos.replace(',', '.'))) || 0);
                });
            }
        });
    });

    let visibleGroups = 0;

    allRouteGroups.forEach((group, gIdx) => {
        const filteredTasks = group.tasks.filter(t => t.fecha === selectedDate);
        if (filteredTasks.length === 0) return;

        visibleGroups++;
        
        const sec = document.createElement('div');
        sec.className = 'route-section';
        
        const header = document.createElement('div');
        header.className = 'route-header-block';
        header.innerHTML = `
            <div class="route-header-main">
                <div class="route-info-col carrier">
                    <div class="route-sub-title">📦 TRANSPORTISTA</div>
                    <div class="route-meta-val">${group.infoTransportista.empresa || '---'}</div>
                    <div class="route-meta-grid">
                        <span>Vehículo: <b>${group.infoTransportista.vehiculo || '---'}</b></span>
                        <span>Remolque: <b>${group.infoTransportista.remolque || '---'}</b></span>
                        ${group.tipoVehiculo ? `<span>Tipo: <b>${group.tipoVehiculo}</b></span>` : ''}
                    </div>
                </div>
                <div class="route-info-col client">
                    <div class="route-sub-title">👤 CONTACTO Y VIAJE</div>
                    <div class="route-meta-grid" style="grid-template-columns: 1fr;">
                        ${group.viajeId ? `<span>Nº Viaje: <b>${group.viajeId}</b></span>` : ''}
                        <span>Contacto: <b>${linkifyPhoneNumbers(group.infoCliente.contacto) || '---'}</b></span>
                        ${group.infoCliente.telefono ? `<span>Teléfono: <a href="tel:${group.infoCliente.telefono.replace(/\s+/g, '')}" class="tel-link"><b>${group.infoCliente.telefono}</b></a></span>` : ''}
                        ${group.infoCliente.fecha ? `<span>Fecha servicio: <b>${group.infoCliente.fecha}</b></span>` : ''}
                    </div>
                </div>
            </div>
        `;
        sec.appendChild(header);

        filteredTasks.sort((a,b) => (a.hora || '').localeCompare(b.hora || ''));

        filteredTasks.forEach(task => {
            let prodHTML = '';
            
            // ── NUEVO FORMATO ──
            if (task.categoria === 'tienda_nueva') {
                if (task.items && task.items.length > 0) {
                    if (task.mainTipo === 'CARGA') {
                        let totalHuecosTrip = 0;
                        
                        let tableRows = task.items.map((it, itIdx) => {
                            const hVal = parseFloat((it.huecos || '0').replace(',', '.')) || 0;
                            totalHuecosTrip += hVal;
                            
                            const numHuecosMax = Math.floor(hVal);
                            const itemKey = `${task.hora}_${it.agrupacion || 'carga'}_${it.destino || itIdx}`.replace(/\s+/g, '_');
                            let savedCount = getSavedCheck(itemKey);
                            let initialBadges = '';
                            for (let n = 1; n <= savedCount; n++) {
                                const isOver = n > numHuecosMax;
                                const isLast = n === savedCount;
                                initialBadges += `<span class="check-item-badge ${isOver ? 'over-max' : 'verified'} ${isLast ? 'last-added' : ''}">${n}</span>`;
                            }
                            const isCompleted = savedCount > 0 && savedCount >= numHuecosMax;

                            return `
                                <tr class="item-main-row clickable-pedido ${isCompleted ? 'row-completed' : ''}" data-pedido="${itemKey}" data-huecos="${numHuecosMax}">
                                    <td class="item-pedido">${it.agrupacion || '-'}</td>
                                    <td class="item-huecos">${it.huecos || '-'}</td>
                                    <td class="item-destino">${it.destino || '-'}</td>
                                </tr>
                                <tr class="check-row-wrapper">
                                    <td colspan="3"><div class="pedido-checks-container">${initialBadges}</div></td>
                                </tr>
                            `;
                        }).join('');

                        const statsBarHTML = `
                            <div class="reporte-stats-bar">
                                <div class="stat-item">
                                    <span class="stat-label">HUECOS:</span>
                                    <span class="stat-value">${totalHuecosTrip.toFixed(2).replace('.', ',')}</span>
                                </div>
                                ${isCheckModeEnabled ? `
                                <div class="stat-item highlight">
                                    <span class="stat-label">CARGADOS:</span>
                                    <span class="stat-value trip-loaded-count">0</span>
                                </div>
                                ` : ''}
                            </div>
                        `;

                        prodHTML = `
                            <div class="divider"></div>
                            <div class="section-label">Detalle de Carga ${isCheckModeEnabled ? '(Modo Comprobación)' : ''}</div>
                            <div class="table-responsive">
                                <table class="products-table reporte-table">
                                    <thead>
                                        <tr>
                                            <th>AGRUPACIÓN</th>
                                            <th>HUECOS</th>
                                            <th>DESTINO</th>
                                        </tr>
                                    </thead>
                                    <tbody>${tableRows}</tbody>
                                </table>
                            </div>
                            ${statsBarHTML}
                        `;
                    } else {
                        // DESCARGA
                        let totalHuecosDesc = 0;
                        let tableRows = task.items.map((it, itIdx) => {
                            const hVal = parseFloat((it.huecos || '0').replace(',', '.')) || 0;
                            totalHuecosDesc += hVal;
                            const numHuecosMax = Math.floor(hVal);
                            const itemKey = `${task.hora}_descarga_${it.destino || itIdx}`.replace(/\s+/g, '_');
                            let savedCount = getSavedCheck(itemKey);
                            let initialBadges = '';
                            for (let n = 1; n <= savedCount; n++) {
                                const isOver = n > numHuecosMax;
                                const isLast = n === savedCount;
                                initialBadges += `<span class="check-item-badge ${isOver ? 'over-max' : 'verified'} ${isLast ? 'last-added' : ''}">${n}</span>`;
                            }
                            const isCompleted = savedCount > 0 && savedCount >= numHuecosMax;

                            return `
                                <tr class="item-main-row clickable-pedido ${isCompleted ? 'row-completed' : ''}" data-pedido="${itemKey}" data-huecos="${numHuecosMax}">
                                    <td class="item-pedido">${it.destino ? `Entrega en: <b>${it.destino}</b>` : 'Descarga Tienda'}</td>
                                    <td class="item-huecos"><b>${it.huecos}</b></td>
                                </tr>
                                <tr class="check-row-wrapper">
                                    <td colspan="2"><div class="pedido-checks-container">${initialBadges}</div></td>
                                </tr>
                            `;
                        }).join('');

                        const statsBarHTML = `
                            <div class="reporte-stats-bar">
                                <div class="stat-item">
                                    <span class="stat-label">HUECOS TOTALES:</span>
                                    <span class="stat-value">${totalHuecosDesc > 0 ? totalHuecosDesc.toFixed(2).replace('.', ',') : (task.items[0]?.huecos || '-')}</span>
                                </div>
                                ${isCheckModeEnabled ? `
                                <div class="stat-item highlight">
                                    <span class="stat-label">DESCARGADOS:</span>
                                    <span class="stat-value trip-loaded-count">0</span>
                                </div>
                                ` : ''}
                            </div>
                        `;

                        prodHTML = `
                            <div class="divider"></div>
                            <div class="section-label">Detalle de Descarga ${isCheckModeEnabled ? '(Modo Comprobación)' : ''}</div>
                            <div class="table-responsive">
                                <table class="products-table reporte-table">
                                    <thead>
                                        <tr>
                                            <th>DETALLE</th>
                                            <th>HUECOS</th>
                                        </tr>
                                    </thead>
                                    <tbody>${tableRows}</tbody>
                                </table>
                            </div>
                            ${statsBarHTML}
                        `;
                    }
                }
            } 
            // ── FORMATOS ANTERIORES (COMPOSICIÓN Y REPORTE) ──
            else if (task.productos && task.productos.length > 0) {
                if (task.categoria === 'tienda') {
                    let parsedTienda = [];
                    let pendingAgrup = [];
                    let pIdx = 0;
                    while (pIdx < task.productos.length) {
                        let rawStr = task.productos[pIdx].trim();
                        if (task.tipo === 'CARGA') {
                            if (/^[\d.,]+$/.test(rawStr) && pIdx + 1 < task.productos.length && /^[\d]{4,}$/.test(task.productos[pIdx+1].trim())) {
                                parsedTienda.push({ agrupacion: pendingAgrup.join(' '), uds: rawStr, destino: task.productos[pIdx+1].trim() });
                                pendingAgrup = []; pIdx += 2;
                            } else {
                                if (!rawStr.includes('--- PAGE BREAK ---')) pendingAgrup.push(rawStr);
                                pIdx++;
                            }
                        } else {
                            if (/^[\d]{4,}$/.test(rawStr) && pIdx + 1 < task.productos.length && /^[\d.,]+$/.test(task.productos[pIdx+1].trim())) {
                                parsedTienda.push({ destino: rawStr, uds: task.productos[pIdx+1].trim() });
                                pIdx += 2;
                            } else { pIdx++; }
                        }
                    }
                    if (parsedTienda.length === 0) {
                        prodHTML = `<div class="divider"></div><div class="section-label">Productos</div><ul class="task-products">${task.productos.map(p => `<li>${p}</li>`).join('')}</ul>`;
                    } else {
                        let tableHeaders = task.tipo === 'CARGA' ? '<tr><th>AGRUPACIÓN</th><th>UDS.</th><th>DESTINO</th></tr>' : '<tr><th>DESTINO</th><th>UDS.</th></tr>';
                        let tableRows = parsedTienda.map(pt => task.tipo === 'CARGA' ? `<tr><td>${pt.agrupacion}</td><td>${pt.uds}</td><td>${pt.destino}</td></tr>` : `<tr><td>${pt.destino}</td><td>${pt.uds}</td></tr>`).join('');
                        prodHTML = `<div class="divider"></div><div class="section-label">Detalle de ${task.tipo === 'CARGA' ? 'Carga' : 'Descarga'}</div><div class="table-responsive"><table class="products-table"><thead>${tableHeaders}</thead><tbody>${tableRows}</tbody></table></div>`;
                    }
                } else if (task.categoria === 'reporte') {
                    const parsedReporte = parseReporteItems(task.productos);
                    if (parsedReporte.length === 0) {
                        prodHTML = `<div class="divider"></div><div class="section-label">Detalle de Reporte</div><ul class="task-products">${task.productos.map(p => `<li>${p}</li>`).join('')}</ul>`;
                    } else {
                        const totalHuecosTrip = parsedReporte.reduce((sum, pr) => sum + (Math.floor(parseFloat(pr.huecos.replace(',', '.'))) || 0), 0);
                        let tableRows = parsedReporte.map(pr => {
                            const huecosRaw = parseFloat(pr.huecos.replace(',', '.')) || 0;
                            const numHuecosMax = Math.floor(huecosRaw);
                            let savedCount = getSavedCheck(pr.pedido);
                            let initialBadges = '';
                            for (let n = 1; n <= savedCount; n++) {
                                const isOver = n > numHuecosMax;
                                const isLast = n === savedCount;
                                initialBadges += `<span class="check-item-badge ${isOver ? 'over-max' : 'verified'} ${isLast ? 'last-added' : ''}">${n}</span>`;
                            }

                            let isCompleted = savedCount > 0 && savedCount >= numHuecosMax;

                            return `
                                <tr class="item-main-row clickable-pedido ${isCompleted ? 'row-completed' : ''}" data-pedido="${pr.pedido}" data-huecos="${numHuecosMax}">
                                    <td class="item-pedido">${pr.pedido}</td>
                                    <td class="item-huecos">${pr.huecos}</td>
                                    <td class="item-destino">${pr.destinoFinal}</td>
                                </tr>
                                <tr class="check-row-wrapper">
                                    <td colspan="3"><div class="pedido-checks-container">${initialBadges}</div></td>
                                </tr>
                            `;
                        }).join('');
                    
                        const statsBarHTML = `
                            <div class="reporte-stats-bar">
                                <div class="stat-item">
                                    <span class="stat-label">HUECOS TOTALES:</span>
                                    <span class="stat-value">${totalHuecosTrip}</span>
                                </div>
                                ${isCheckModeEnabled ? `
                                <div class="stat-item highlight">
                                    <span class="stat-label">TOTAL CARGADOS:</span>
                                    <span class="stat-value trip-loaded-count">0</span>
                                </div>
                                ` : ''}
                            </div>
                        `;

                        prodHTML = `<div class="divider"></div><div class="section-label">Detalle de Reporte ${isCheckModeEnabled ? '(Modo Comprobación)' : ''}</div><div class="table-responsive"><table class="products-table reporte-table"><thead><tr><th>Nº PEDIDO</th><th>HUECOS</th><th>DESTINO</th></tr></thead><tbody>${tableRows}</tbody></table></div>${statsBarHTML}`;
                    }
                }
            }

            const mainCardClass = (task.mainTipo || task.tipo || 'carga').toLowerCase();
            const el = document.createElement('div');
            el.className = `task-card ${mainCardClass.includes('descarga') ? 'descarga' : 'carga'}`;
            
            let obsHTML = '';
            if (task.observaciones) {
                obsHTML = `<div class="divider"></div><div class="section-label">Observaciones</div><div class="task-observations">${linkifyPhoneNumbers(task.observaciones)}</div>`;
            }

            const fullAddress = `${task.destino} ${task.direccion}`.trim();
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

            const catLabel = task.categoria === 'reporte' ? 'Reporte' : 'Tienda';

            el.innerHTML = `
                <div class="task-header">
                    <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                        <span class="task-type">${task.mainTipo || task.tipo}</span>
                        ${task.subTipo ? `<span class="task-subtype ${task.subTipo.toLowerCase()}">${task.subTipo}</span>` : ''}
                        <span class="task-category ${task.categoria}">${catLabel}</span>
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
                    ` : 'No especificada'}
                </div>
                ${prodHTML}${obsHTML}
            `;
            sec.appendChild(el);
        });

        tasksList.appendChild(sec);
    });

    if (visibleGroups === 0) {
        // Buscar otras fechas con tareas disponibles en el PDF
        const otherDatesWithTasks = availableDates.filter(d => {
            return allRouteGroups.some(g => g.tasks.some(t => t.fecha === d));
        });

        let switchButtonHtml = '';
        if (otherDatesWithTasks.length > 0) {
            const nextDate = otherDatesWithTasks[0];
            const now = new Date();
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
    }

    // Refresh all local counters after rendering
    document.querySelectorAll('.task-card').forEach(card => {
        refreshLocalCounter(card);
    });
}

function setupNotifications() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    if (notificationInterval) clearInterval(notificationInterval);
    
    // Check every minute for upcoming tasks
    notificationInterval = setInterval(() => {
        const now = new Date();
        const todayStr = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth()+1).padStart(2, '0') + '/' + now.getFullYear();
        
        allRouteGroups.forEach(group => {
            const todaysTasks = group.tasks.filter(t => t.fecha === todayStr);
            todaysTasks.forEach(task => {
                if (!task.hora) return;
                const [h, m] = task.hora.split(':');
                const taskTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(h), parseInt(m));
                
                const diffMs = taskTime - now;
                const diffMins = Math.floor(diffMs / 60000);
                
                if (diffMins === 15) {
                    new Notification(`Próxima Tarea: ${task.tipo}`, {
                        body: `En 15 minutos: ${task.destino}\nHora: ${task.hora}`,
                        icon: 'icon-192.png'
                    });
                }
            });
        });
    }, 60000);
}

// Global Click Handler for Checks
document.addEventListener('click', (e) => {
    if (!isCheckModeEnabled) return;
    
    // 1. Delete badge if clicking on it
    if (e.target.classList.contains('check-item-badge')) {
        e.stopPropagation();
        
        if (!confirm('¿Seguro que quieres borrar este pallet?')) return;
        
        const container = e.target.parentElement;
        const row = container.closest('.check-row-wrapper').previousElementSibling;
        const max = parseInt(row.getAttribute('data-huecos')) || 0;
        const pedido = row.getAttribute('data-pedido');
        
        e.target.remove();
        
        // Re-number remaining badges and highlight the new last one
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
        
        // Update row status
        if (remaining.length < max) {
            row.classList.remove('row-completed');
        } else {
            row.classList.add('row-completed');
        }

        refreshLocalCounter(container.closest('.task-card'));
        return;
    }

    // 2. Add badge if clicking row
    const row = e.target.closest('.clickable-pedido');
    if (row) {
        const container = row.nextElementSibling.querySelector('.pedido-checks-container');
        if (!container) return;
        
        // Quitar resaltado anterior
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

        // Update row status
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

// Ads Logic
setTimeout(() => {
    const footer = document.getElementById('ad-footer');
    if (footer) footer.classList.add('show');
}, 3000);

document.getElementById('btn-close-ad')?.addEventListener('click', () => {
    document.getElementById('ad-footer')?.classList.remove('show');
});

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
