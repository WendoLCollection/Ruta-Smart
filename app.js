// UI Elements
const uploadBtn = document.getElementById('pdf-upload');
const loader = document.getElementById('loader');
const emptyState = document.getElementById('empty-state');
const tasksContainer = document.getElementById('tasks-container');
const tasksList = document.getElementById('tasks-list');
const dateFilter = document.getElementById('date-filter');
const headerDateSelector = document.getElementById('header-date-selector');
const metadataBar = document.getElementById('metadata-bar');
const pdfTimestampEl = document.getElementById('pdf-timestamp');
const btnViewPdf = document.getElementById('btn-view-pdf');
const btnToggleCheck = document.getElementById('btn-toggle-check');

let allRouteGroups = [];
let availableDates = [];
let pdfCreationTime = '';
let notificationInterval = null;
let currentPdfUrl = null;
let isCheckModeEnabled = true;

// Toggle Check Mode
btnToggleCheck.addEventListener('click', () => {
    isCheckModeEnabled = !isCheckModeEnabled;
    btnToggleCheck.classList.toggle('active', isCheckModeEnabled);
    renderTasks();
});

// Original PDF Viewer
btnViewPdf.addEventListener('click', () => {
    if (currentPdfUrl) {
        window.open(currentPdfUrl, '_blank');
    }
});

// Request Notifications Permission - Temporarily Disabled
/*
if ("Notification" in window && Notification.permission !== "denied" && Notification.permission !== "granted") {
    Notification.requestPermission();
}
*/

// Events
uploadBtn.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Original PDF viewing logic
    if (currentPdfUrl) URL.revokeObjectURL(currentPdfUrl);
    currentPdfUrl = URL.createObjectURL(file);
    btnViewPdf.classList.remove('hidden');
    btnToggleCheck.classList.remove('hidden');
    btnToggleCheck.classList.add('active'); // Start with active by default
    isCheckModeEnabled = true;

    loader.classList.remove('hidden');
    emptyState.classList.add('hidden');
    tasksContainer.classList.add('hidden');
    headerDateSelector.classList.add('hidden');
    metadataBar.classList.add('hidden');
    pdfCreationTime = '';

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';
        
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            // join items
            const pageText = textContent.items.map(item => item.str).join('\n');
            fullText += pageText + '\n\n--- PAGE BREAK ---\n\n';
        }

        parsePDFText(fullText);
    } catch (error) {
        console.error("Error reading PDF: ", error);
        alert('Hubo un error al leer el documento PDF. Por favor, asegúrate de que es un archivo válido.');
        emptyState.classList.remove('hidden');
    } finally {
        loader.classList.add('hidden');
    }
});

dateFilter.addEventListener('change', renderTasks);

// Logic
function parsePDFText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    allRouteGroups = [];
    
    let i = 0;
    let currentCategoria = 'tienda'; // Default
    let currentGroup = null;

    function createNewGroup() {
        return {
            infoTransportista: { empresa: '', vehiculo: '', remolque: '' },
            infoCliente: { contacto: '', telefono: '', fecha: '' },
            tasks: []
        };
    }

    // Helper: extract value from "LABEL: value" or from the next non-label line
    function getVal(label) {
        const sameLine = lines[i].replace(label, '').trim();
        if (sameLine) return sameLine;
        // Look at next line, skip if it looks like another label (contains ":")
        const next = lines[i+1] || '';
        if (next && !next.includes(':') && !next.startsWith('---')) return next;
        return '';
    }

    while (i < lines.length) {
        let line = lines[i].trim();
        
        // ── New group starts at VIAJE: ──
        if (line === 'VIAJE:') {
            if (currentGroup && currentGroup.tasks.length > 0) {
                allRouteGroups.push(currentGroup);
            }
            currentGroup = createNewGroup();
        }
        
        if (!currentGroup) currentGroup = createNewGroup();

        // ── PDF Creation Timestamp (from DETALLE RUTAS TRANSPORTISTA) ──
        if (line.includes('DETALLE RUTAS TRANSPORTISTA')) {
            for (let k = i + 1; k < i + 5 && k < lines.length; k++) {
                const tsMatch = lines[k].match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})/);
                if (tsMatch) {
                    pdfCreationTime = tsMatch[1];
                    break;
                }
            }
        }

        // ── Metadata extraction ──
        if (line.startsWith('EMPRESA DE TRANSPORTES:')) {
            currentGroup.infoTransportista.empresa = getVal('EMPRESA DE TRANSPORTES:');
        } else if (line.startsWith('VEHICULO:')) {
            currentGroup.infoTransportista.vehiculo = getVal('VEHICULO:');
        } else if (line.startsWith('MAT. REMOLQ.:')) {
            currentGroup.infoTransportista.remolque = getVal('MAT. REMOLQ.:');
        } else if (line.startsWith('TELÉFONO:')) {
            // TELÉFONO: appears twice in some PDFs (first empty, second with value)
            // Only save if there's actually a value
            const val = getVal('TELÉFONO:');
            if (val) {
                currentGroup.infoCliente.telefono = val;
            }
        } else if (line.startsWith('PERSONA CONTACTO:')) {
            currentGroup.infoCliente.contacto = getVal('PERSONA CONTACTO:');
        } else if (line.startsWith('FECHA SERVICIO:')) {
            currentGroup.infoCliente.fecha = getVal('FECHA SERVICIO:');
        }

        // ── Identify section headers ──
        if (line.includes('COMPOSICIÓN') || line.includes('ZONA ORIGEN:')) {
            currentCategoria = 'tienda';
        } else if (line.includes('DETALLE DE LA RUTA') || line.includes('INFORMACION COMPLEMENTARIA')) {
            currentCategoria = 'reporte';
        }
        
        // Match CARGA / DESCARGA
        if (line === 'CARGA' || line === 'DESCARGA') {
            const tipo = line;
            i++;
            
            let currentTask = { 
                tipo, 
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
                if (nextLine === 'CARGA' || nextLine === 'DESCARGA' || nextLine === 'DETALLE RUTAS TRANSPORTISTA' || nextLine.startsWith('OBSERVACIONES:')) {
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
                            if (dl === 'CARGA' || dl === 'DESCARGA' || dl === 'DETALLE RUTAS TRANSPORTISTA' || dl.startsWith('OBSERVACIONES:') || dl.includes('--- PAGE BREAK ---') || dl === 'INICIO PARADA') {
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
        
        // Observations
        if (line.startsWith('OBSERVACIONES:')) {
            let obs = line.replace('OBSERVACIONES:', '').trim() + ' ';
            i++;
            while (i < lines.length) {
                let nextLine = lines[i];
                if (nextLine === 'CARGA' || nextLine === 'DESCARGA' || nextLine === 'DETALLE RUTAS TRANSPORTISTA' || nextLine.startsWith('TOTAL SIN') || nextLine.startsWith('TOTAL') || nextLine.startsWith('--- PAGE BREAK ---')) {
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

    // Populate Filters
    const allTaskDates = allRouteGroups.flatMap(g => g.tasks.map(t => t.fecha));
    const datesSet = new Set(allTaskDates.filter(f => f));
    availableDates = Array.from(datesSet).sort((a,b) => {
        const [d1,m1,y1] = a.split('/');
        const [d2,m2,y2] = b.split('/');
        return new Date(y1,m1-1,d1) - new Date(y2,m2-1,d2);
    });

    renderFilters();
    
    if (availableDates.length > 0) {
        const today = new Date();
        const todayStr = String(today.getDate()).padStart(2, '0') + '/' + String(today.getMonth()+1).padStart(2, '0') + '/' + today.getFullYear();
        if (availableDates.includes(todayStr)) {
            dateFilter.value = todayStr;
        } else {
            dateFilter.value = availableDates[0];
        }
        
        headerDateSelector.classList.remove('hidden');
        metadataBar.classList.remove('hidden');
        pdfTimestampEl.textContent = pdfCreationTime ? `(Actualizado: ${pdfCreationTime})` : '';
        tasksContainer.classList.remove('hidden');
        renderTasks();
    } else {
        headerDateSelector.classList.add('hidden');
        metadataBar.classList.add('hidden');
        emptyState.innerHTML = `
            <div class="empty-icon">⚠️</div>
            <h2>No se encontraron tareas</h2>
            <p>El formato del PDF puede ser diferente al esperado o no contener tareas legibles.</p>
        `;
        emptyState.classList.remove('hidden');
    }
}


function renderFilters() {
    dateFilter.innerHTML = '';
    availableDates.forEach(dateStr => {
        const option = document.createElement('option');
        option.value = dateStr;
        option.textContent = dateStr;
        dateFilter.appendChild(option);
    });
}

function renderTasks() {
    const selectedDate = dateFilter.value;
    tasksList.innerHTML = '';

    let visibleGroups = 0;

    allRouteGroups.forEach((group, gIdx) => {
        // Filter tasks by date
        const filteredTasks = group.tasks.filter(t => t.fecha === selectedDate);
        if (filteredTasks.length === 0) return;

        visibleGroups++;
        
        // Create Section for the Group
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
                    </div>
                </div>
                <div class="route-info-col client">
                    <div class="route-sub-title">👤 CONTACTO</div>
                    <div class="route-meta-grid" style="grid-template-columns: 1fr;">
                        <span>Persona contacto: <b>${group.infoCliente.contacto || '---'}</b></span>
                        ${group.infoCliente.telefono ? `<span>Teléfono: <b>${group.infoCliente.telefono}</b></span>` : ''}
                        ${group.infoCliente.fecha ? `<span>Fecha servicio: <b>${group.infoCliente.fecha}</b></span>` : ''}
                    </div>
                </div>
            </div>
        `;
        sec.appendChild(header);

        // Sort by time
        filteredTasks.sort((a,b) => (a.hora || '').localeCompare(b.hora || ''));

        filteredTasks.forEach(task => {
            const el = document.createElement('div');
            el.className = `task-card ${task.tipo.toLowerCase()}`;
            
            let prodHTML = '';
         if (task.productos && task.productos.length > 0) {
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
                            while(pIdx < task.productos.length && /^[\d.,]{2,}$/.test(task.productos[pIdx].trim())) pIdx++;
                        } else {
                            if (!rawStr.includes('--- PAGE BREAK ---')) pendingAgrup.push(rawStr);
                            pIdx++;
                        }
                    } else {
                        if (/^[\d]{4,}$/.test(rawStr) && pIdx + 1 < task.productos.length && /^[\d.,]+$/.test(task.productos[pIdx+1].trim())) {
                            parsedTienda.push({ destino: rawStr, uds: task.productos[pIdx+1].trim() });
                            pIdx += 2;
                            while(pIdx < task.productos.length && /^[\d.,]{2,}$/.test(task.productos[pIdx].trim())) pIdx++;
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
                let parsedReporte = [];
                let pIdx = 0;
                while (pIdx < task.productos.length) {
                    let maybePedido = task.productos[pIdx].trim();
                    if (/^\d{7,10}$/.test(maybePedido)) {
                        let huecos = '0'; let destinoFinal = '-';
                        for (let j = pIdx + 1; j < pIdx + 5 && j < task.productos.length; j++) {
                            if (/^\d+,[\d]{2}$/.test(task.productos[j].trim())) {
                                huecos = task.productos[j].trim();
                                for (let k = j + 1; k < j + 6 && k < task.productos.length; k++) {
                                    let candidate = task.productos[k].trim();
                                    if (candidate.length > 3 && !/^\d+,\d{2}$/.test(candidate) && !candidate.includes('TOTAL')) {
                                        let sameLineMatch = candidate.match(/(.+?)\s+(\d{4})$/);
                                        if (sameLineMatch) { destinoFinal = sameLineMatch[1].trim(); break; }
                                        if (k + 1 < task.productos.length && /^\d{4}$/.test(task.productos[k+1].trim())) { destinoFinal = candidate; break; }
                                    }
                                }
                                break;
                            }
                        }
                        parsedReporte.push({ pedido: maybePedido, huecos: huecos, destinoFinal: destinoFinal });
                        pIdx += 2;
                    } else { pIdx++; }
                }
                if (parsedReporte.length === 0) {
                    prodHTML = `<div class="divider"></div><div class="section-label">Detalle de Reporte</div><ul class="task-products">${task.productos.map(p => `<li>${p}</li>`).join('')}</ul>`;
                } else {
                    let tableRows = parsedReporte.map(pr => {
                        const huecosRaw = parseFloat(pr.huecos.replace(',', '.')) || 0;
                        const numChecks = Math.floor(huecosRaw);
                        let checksHTML = '';
                        for(let i=0; i<numChecks; i++) {
                            checksHTML += `
                                <label class="check-wrapper">
                                    <input type="checkbox" class="task-check" />
                                    <span class="check-number">${i+1}</span>
                                </label>
                            `;
                        }
                        
                        // Checkboxes only for CARGA and if mode is enabled
                        const checkRow = (task.tipo === 'CARGA' && isCheckModeEnabled) ? `
                            <tr class="check-row">
                                <td colspan="3">
                                    <div class="checkbox-group">
                                        ${checksHTML}
                                        <span class="check-label">Comprobar carga</span>
                                    </div>
                                </td>
                            </tr>
                        ` : '';
                        
                        return `
                            <tr class="item-main-row">
                                <td class="item-pedido">${pr.pedido}</td>
                                <td class="item-huecos">${pr.huecos}</td>
                                <td class="item-destino">${pr.destinoFinal}</td>
                            </tr>
                            ${checkRow}
                        `;
                    }).join('');
                    
                    prodHTML = `<div class="divider"></div><div class="section-label">Detalle de Reporte ${task.tipo === 'CARGA' ? '(Modo Comprobación)' : ''}</div><div class="table-responsive"><table class="products-table reporte-table"><thead><tr><th>Nº PEDIDO</th><th>HUECOS</th><th>DESTINO</th></tr></thead><tbody>${tableRows}</tbody></table></div>`;
                }
            }
        }

        let obsHTML = '';
        if (task.observaciones) {
            obsHTML = `<div class="divider"></div><div class="section-label">Observaciones</div><div class="task-observations">${task.observaciones}</div>`;
        }

        el.innerHTML = `
            <div class="task-header">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                    <span class="task-type">${task.tipo}</span>
                    <span class="task-category ${task.categoria}">${task.categoria === 'tienda' ? 'Tienda' : 'Reporte'}</span>
                </div>
                <div class="task-time"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg><span>${task.hora}</span></div>
            </div>
            <div class="task-detail destination">${task.destino}</div>
            <div class="task-detail address"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>${task.direccion || 'No especificada'}</div>
            ${prodHTML}${obsHTML}
        `;
        sec.appendChild(el);
        });

        tasksList.appendChild(sec);
    });

    if (visibleGroups === 0) {
        tasksList.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No hay tareas para esta fecha.</p>';
    }
}


function setupNotifications() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    
    if (notificationInterval) clearInterval(notificationInterval);
    
    // Check every minute for upcoming tasks
    notificationInterval = setInterval(() => {
        const now = new Date();
        const todayStr = String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth()+1).padStart(2, '0') + '/' + now.getFullYear();
        
        const todaysTasks = allTasks.filter(t => t.fecha === todayStr);
        todaysTasks.forEach(task => {
            if (!task.hora) return;
            const [h, m] = task.hora.split(':');
            const taskTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(h), parseInt(m));
            
            // Notify 15 minutes before
            const diffMs = taskTime - now;
            const diffMins = Math.floor(diffMs / 60000);
            
            // Generate notification if exactly 15 minutes away
            if (diffMins === 15) {
                new Notification(`Próxima Tarea: ${task.tipo}`, {
                    body: `En 15 minutos: ${task.destino}\nHora: ${task.hora}`,
                    icon: 'icon.png'
                });
            }
        });
    }, 60000);
}
