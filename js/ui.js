// --- RENDERIZADOS LOCALES ---
function actualizarListadoIndividual(tipo, contId, countId) {
    const todosLosMovimientos = AppState.movimientos || [];

    // Normalizamos el tipo recibido y el de los datos para evitar errores de comparación
    const tipoNormalizado = tipo.toLowerCase().trim();

    const filtrados = todosLosMovimientos.filter(m => {
        if (!m.fecha) return false;

        const d = new Date(m.fecha);
        const añoMov = d.getFullYear();
        const mesMov = d.getMonth();
        const tipoMov = (m.tipo || '').toLowerCase().trim();

        return tipoMov === tipoNormalizado &&
            mesMov === AppState.filtrosActuales.mes &&
            añoMov === AppState.filtrosActuales.año;
    }).reverse();

    const countEl = document.getElementById(countId);
    if (countEl) countEl.innerText = `${filtrados.length} MOVIMIENTOS`;

    const cont = document.getElementById(contId);
    if (!cont) return;

    if (filtrados.length === 0) {
        cont.innerHTML = '<p class="opacity-20 text-center py-10">Sin registros.</p>';
        return;
    }

    let htmlAcumulado = '';
    filtrados.forEach(m => {
        // Aseguramos que formatearFechaMX sea global (window.formatearFechaMX)
        const fechaLegible = (typeof window.formatearFechaMX === 'function')
            ? window.formatearFechaMX(m.fecha)
            : m.fecha.split('T')[0];

        htmlAcumulado += `
            <div class="p-4 bg-gray-50/50 rounded-xl border border-white flex justify-between items-center group transition-all hover:bg-white hover:shadow-sm">
                <div class="flex-1">
                    <p class="text-sm font-semibold uppercase text-stone-700">${m.desc || 'Sin descripción'}</p>
                    <p class="text-[9px] opacity-40 uppercase font-bold">${fechaLegible} | ${m.cat || 'General'}</p>
                </div>
                <div class="flex items-center gap-4">
                    <p class="text-sm font-bold ${tipoNormalizado === 'gasto' ? 'text-rose-400' : 'text-stone-600'}">
                        ${tipoNormalizado === 'gasto' ? '-' : '+'}${fMXN(m.monto)}
                    </p>
                    <div class="flex gap-1">
                        <button onclick="prepararEdicion(${m.id}, '${tipo}')" class="p-2 hover:bg-stone-200 rounded-full transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8C7E6A" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button onclick="eliminarMovimiento(${m.id})" class="p-2 hover:bg-rose-100 rounded-full transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            </div>`;
    });

    cont.innerHTML = htmlAcumulado;
}

function actualizarSelectsCategorias() {
    const inSel = document.getElementById('in-categoria');
    const exSel = document.getElementById('ex-categoria');
    const listaCategorias = window.AppState?.categorias || [];
    
    if (inSel) {
        inSel.innerHTML = '';
        listaCategorias.filter(c => c.tipo === 'ingreso').forEach(c => { 
            inSel.innerHTML += `<option value="${c.nombre}">${c.nombre.toUpperCase()}</option>`; 
        });
    }
    if (exSel) {
        exSel.innerHTML = '';
        listaCategorias.filter(c => c.tipo === 'gasto').forEach(c => { 
            exSel.innerHTML += `<option value="${c.nombre}">${c.nombre.toUpperCase()}</option>`; 
        });
    }
}

function renderCategoriasConfig() {
    const contIng = document.getElementById('lista-cats-ingreso');
    const contGas = document.getElementById('lista-cats-gasto');
    if (!contIng || !contGas) return;

    contIng.innerHTML = '';
    contGas.innerHTML = '';
    
    const listaCategorias = window.AppState?.categorias || [];

    listaCategorias.forEach(c => {
        const itemHtml = `
            <div class="group bg-stone-50 rounded-xl border border-stone-100 p-3 transition hover:shadow-sm">
                <div id="view-${c.id}" class="flex justify-between items-center">
                    <span class="text-xs font-bold uppercase text-stone-700">${c.nombre}</span>
                    <div class="flex gap-3 opacity-0 group-hover:opacity-100 transition">
                        <button onclick="editMode(${c.id}, true)" class="text-[10px] font-bold text-stone-400 hover:text-stone-800 tracking-wider">EDITAR</button>
                        <button onclick="eliminarCategoria(${c.id})" class="text-[10px] font-bold text-rose-300 hover:text-rose-600">X</button>
                    </div>
                </div>
                <div id="edit-${c.id}" class="hidden flex gap-2">
                    <input type="text" id="input-${c.id}" value="${c.nombre}" class="flex-1 text-xs p-2 rounded-lg border border-stone-200 outline-none uppercase font-semibold text-stone-700">
                    <button onclick="saveEdit(${c.id})" class="bg-stone-800 text-white px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">OK</button>
                </div>
            </div>`;
            
        if (c.tipo === 'ingreso') contIng.innerHTML += itemHtml;
        else contGas.innerHTML += itemHtml;
    });
}

// Asegúrate de que esta variable sea global en tu archivo
function editMode(id, active) {
    const viewEl = document.getElementById(`view-${id}`);
    const editEl = document.getElementById(`edit-${id}`);
    if (viewEl && editEl) {
        viewEl.classList.toggle('hidden', active);
        editEl.classList.toggle('hidden', !active);
        if (active) {
            const input = document.getElementById(`input-${id}`);
            if (input) input.focus();
        }
    }
}

function saveEdit(id) {
    const inputEl = document.getElementById(`input-${id}`);
    if (!inputEl) return;
    
    const nuevoNombre = inputEl.value.trim().toUpperCase();
    if (nuevoNombre && window.AppState) {
        const index = window.AppState.categorias.findIndex(c => c.id === id);
        if (index !== -1) {
            window.AppState.categorias[index].nombre = nuevoNombre;
            localStorage.setItem('cats_mxn', JSON.stringify(window.AppState.categorias));
            if (typeof refrescarVistaActual === 'function') refrescarVistaActual();
        }
    }
}

function actualizarHome() {
    // 1. LEEMOS Y NORMALIZAMOS DATOS
    let datos = AppState.movimientos || [];
    if (datos && !Array.isArray(datos) && typeof datos === 'object') {
        datos = datos.movimientos || Object.values(datos);
    }
    if (!Array.isArray(datos)) datos = [];

    if (datos.length === 0) return;

    // 2. CÁLCULOS
    const hoyStr = new Date().toISOString().split('T')[0]; // "2026-07-16"
    const ahora = new Date();
    let balG = 0, balD = 0, ingM = 0, gasM = 0;

    datos.forEach(m => {
        if (!m || typeof m.monto === 'undefined') return;

        const monto = parseFloat(m.monto) || 0;
        const val = m.tipo === 'ingreso' ? monto : -monto;
        balG += val;

        // --- NORMALIZACIÓN SEGURA PARA EL BALANCE DEL DÍA ---
        // Esto convierte cualquier formato de fecha de Google Sheets a "YYYY-MM-DD"
        const fechaMov = new Date(m.fecha).toISOString().split('T')[0];

        if (fechaMov === hoyStr) {
            balD += val;
        }

        // --- CÁLCULO MES ACTUAL ---
        const mF = new Date(m.fecha);
        if (!isNaN(mF.getTime()) && mF.getMonth() === ahora.getMonth() && mF.getFullYear() === ahora.getFullYear()) {
            if (m.tipo === 'ingreso') ingM += monto;
            else gasM += monto;
        }
    });

    // 3. ACTUALIZACIÓN INTELIGENTE DE TEXTOS
    const updates = [
        { id: 'balance-general', val: fMXN(balG) },
        { id: 'balance-dia', val: fMXN(balD) }, // Ahora balD debería sumar correctamente
        { id: 'home-ingresos', val: fMXN(ingM) },
        { id: 'home-gastos', val: fMXN(gasM) }
    ];

    updates.forEach(item => {
        const el = document.getElementById(item.id);
        if (el && el.innerText !== item.val) el.innerText = item.val;
    });

    // 4. ACTUALIZAR ESTADO GLOBAL
    window.EstadoFinanciero = { ingresos: ingM, gastos: gasM };

    // 5. LISTA RECIENTE
    const listaH = document.getElementById('lista-recientes');
    if (listaH) {
        const ultimosMovs = [...datos].reverse().slice(0, 10);
        let nuevoHtml = '';
        ultimosMovs.forEach(m => {
            nuevoHtml += `
                <div class="flex justify-between items-center p-3 bg-gray-50/50 rounded-xl border border-white">
                    <div>
                        <p class="text-xs font-semibold uppercase">${m.desc}</p>
                        <p class="text-[8px] opacity-40 uppercase">${window.formatearFechaMX(m.fecha)} | ${m.cat}</p>
                    </div>
                    <span class="text-xs font-bold ${m.tipo === 'gasto' ? 'text-rose-400' : 'text-stone-600'}">
                        ${m.tipo === 'gasto' ? '-' : '+'}${fMXN(m.monto)}
                    </span>
                </div>`;
        });

        if (listaH.innerHTML !== nuevoHtml) {
            listaH.innerHTML = nuevoHtml;
        }
    }
}

window.chartR = window.chartR || null;

function actualizarResumen() {
    const filtrados = obtenerMovimientosFiltrados();
    let ing = 0, gas = 0;
    
    const contLista = document.getElementById('lista-resumen-periodo');
    if (contLista) {
        contLista.innerHTML = filtrados.length ? '' : '<p class="opacity-20 text-center py-10 text-sm">Sin movimientos.</p>';
        
        filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(m => {
            if(m.tipo === 'ingreso') ing += m.monto; else gas += m.monto;
            
            const div = document.createElement('div');
            div.className = "flex justify-between items-center p-3 bg-gray-50/50 rounded-xl border border-white";
            
            // 🔥 AQUÍ CONECTAMOS TU FORMATEADOR INTELLIGENTE:
            div.innerHTML = `<div>
                <p class="text-xs font-semibold uppercase">${m.desc}</p>
                <p class="text-[8px] opacity-40 uppercase">${window.formatearFechaMX(m.fecha)} | ${m.cat}</p>
            </div>
            <span class="text-[10px] font-bold ${m.tipo === 'gasto' ? 'text-rose-400' : 'text-stone-600'}">
                ${m.tipo === 'gasto' ? '-' : '+'}${fMXN(m.monto)}
            </span>`;
            
            contLista.appendChild(div);
        });
    } else {
        filtrados.forEach(m => {
            if(m.tipo === 'ingreso') ing += m.monto; else gas += m.monto;
        });
    }

    const txtBalance = document.getElementById('resumen-balance-total');
    if (txtBalance) {
        txtBalance.innerText = fMXN(ing - gas);
    }

    const canvas = document.getElementById('chartResumen');
    if (!canvas) return; 

    const ctx = canvas.getContext('2d');
    
    if (window.chartR) {
        window.chartR.destroy();
    }

    window.chartR = new Chart(ctx, { 
        type: 'bar', 
        data: { 
            labels: ['Ingresos', 'Gastos'], 
            datasets: [{ 
                data: [ing, gas], 
                backgroundColor: ['#D6C7B3', '#45423E'], 
                borderRadius: 8 
            }] 
        },
        options: { 
            responsive: true,
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { y: { beginAtZero: true } } 
        } 
    });
}

function actualizarFechaHeader() {
    const el = document.getElementById('fecha-sistema');
    if (!el) return; // Candado de seguridad por si no está en la pantalla actual

    const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const fecha = new Date().toLocaleDateString('es-MX', opciones);
    el.innerText = fecha.charAt(0).toUpperCase() + fecha.slice(1);
}

function toggleLoading(show) {
    const loader = document.getElementById('loading-overlay');
    // Solo intenta cambiar el estilo si el elemento existe en el HTML actual
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

function inicializarFiltros() {
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const añoActual = new Date().getFullYear();
    const mesActual = new Date().getMonth(); // 6 para Julio
    const selectsMes = ['in-mes', 'ex-mes', 'res-mes'];
    const selectsAnio = ['in-año', 'ex-año', 'res-año'];

    // 1. Llenamos y seteamos valores
    selectsMes.forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
            sel.innerHTML = '';
            meses.forEach((m, i) => {
                let opt = document.createElement('option');
                opt.value = i;
                opt.innerHTML = m;
                sel.appendChild(opt);
            });
            sel.value = mesActual;

            // ESCUCHA: Si el usuario cambia el mes, refrescamos la vista
            sel.addEventListener('change', () => {
                refrescarVistaActual();
            });
        }
    });

    selectsAnio.forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
            sel.innerHTML = '';
            for (let i = añoActual; i >= añoActual - 4; i--) {
                let opt = document.createElement('option');
                opt.value = i;
                opt.innerHTML = i;
                sel.appendChild(opt);
            }
            sel.value = añoActual;

            // ESCUCHA: Si el usuario cambia el año, refrescamos la vista
            sel.addEventListener('change', () => {
                refrescarVistaActual();
            });
        }
    });

    // 2. Sincronizamos AppState inicial
    AppState.filtrosActuales.mes = mesActual;
    AppState.filtrosActuales.año = añoActual;
}

function formatCurrency(input, hiddenId) {
    let value = input.value.replace(/\D/g, "");
    let numericValue = value ? parseFloat(value) / 100 : 0;
    document.getElementById(hiddenId).value = numericValue;
    input.value = numericValue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) + " MXN";
}

// Función de seguridad para actualizar elementos
// Agrega esto a tu ui.js junto a safeSetText
function safeSetHTML(id, htmlContent) {
    const el = document.getElementById(id);
    if (el) {
        el.innerHTML = htmlContent;
    }
}

// --- CONTROLADOR INTELIGENTE DE VISTAS ---
async function abrirVistaAjustesInteligente() {
    toggleLoading(true); // Siempre muestra carga antes de la lógica
    try {
        if (!AppState.categorias || AppState.categorias.length === 0) {
            const formData = new FormData();
            formData.append('action', 'obtenerCategorias');
            const req = await fetch(API_URL, { method: 'POST', body: formData });
            const res = await req.json();
            if (res.exito) AppState.categorias = res.datos;
        }
    } catch (error) {
        console.error("Error al cargar categorías:", error);
    } finally {
        toggleLoading(false);
        renderCategoriasConfig(); // SE EJECUTA SIEMPRE, haya datos o error
    }
}