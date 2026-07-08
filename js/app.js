

// --- URL DE GOOGLE APPS SCRIPT ---
const API_URL = "https://script.google.com/macros/s/AKfycby7qsVqL6ufthtYSi-A7LKUs7i7yy8joqyKp7-wNxGinuFym8C4GL8R44EnkDzRAEJyog/exec";
let editandoId = null;
let movimientos = [];
let categorias = [];
let chartH, chartR, seccionActual = 'home';
const fMXN = (v) => v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

// 2. Validación de Sesión (Lo primero que se ejecuta)
document.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    // 1. PRIMERO: Control de acceso
    if (!isLoggedIn && !window.location.pathname.includes('login.html')) {
        window.location.href = "./login.html";
        return;
    }

    // 2. SEGUNDO: Inicializar la vista por defecto
    // Esto asegura que la página tenga algo que mostrar apenas carga
    showSection('home');
    
    // 3. TERCERO: Iniciar la carga de datos (Google Sheets)
    iniciarSincronizacion(); 
});

function toggleLoading(show) {
    const loader = document.getElementById('loading-overlay');
    // Solo intenta cambiar el estilo si el elemento existe en el HTML actual
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
}

// --- ENVIAR DATOS A APPS SCRIPT ---
async function FetchAPI(action, extraData = {}) {
    toggleLoading(true);

    // 1. Preparamos el objeto con la acción y los datos extra
    const payload = {
        action: action,
        ...extraData
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                // Forzamos explícitamente texto plano para evadir el preflight
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload),
            redirect: 'follow' // Crucial para Google Apps Script
        });

        // 2. Intentamos parsear la respuesta
        const data = await response.json();

        if (!data.success) {
            alert("Error: " + (data.message || "Sin mensaje de error"));
        }
        return data;

    } catch (error) {
        console.error("Error en la petición:", error);
        // Este alert es justo el que estabas viendo en tu pantalla
        alert("Error de conexión con Google Sheets.");
        return { success: false };
    } finally {
        toggleLoading(false);
    }
}

async function inicializarSincronizacion() {
    console.log("Iniciando sincronización...");

    // Cambiamos FetchAPI para asegurarnos de capturar el error
    const res = await FetchAPI("obtenerDatos", {});

    // Si res es null o undefined, el problema está en la conexión o el backend
    if (!res) {
        alert("Error crítico: El servidor no respondió nada.");
        return;
    }

    if (res.success) {
        console.log("Datos recibidos correctamente:", res);
        movimientos = res.movimientos;
        categorias = res.categorias;

        inicializarFiltros();
        refrescarVistaActual();
    } else {
        // AQUÍ CAPTURAMOS EL ERROR DEL SERVIDOR
        console.error("Error en sincronización:", res.message);
        alert("No se pudieron cargar los datos: " + res.message);
    }
}

function formatCurrency(input, hiddenId) {
    let value = input.value.replace(/\D/g, "");
    let numericValue = value ? parseFloat(value) / 100 : 0;
    document.getElementById(hiddenId).value = numericValue;
    input.value = numericValue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) + " MXN";
}

// --- 1. SECCIÓN DE NAVEGACIÓN ---
function showSection(id) {
    seccionActual = id;
    
    // Ocultar y mostrar secciones
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden-section'));
    document.getElementById(`sec-${id}`).classList.remove('hidden-section');
    
    // Cambiar subtítulo
    const nombres = { 'home': 'Inicio', 'ingresos': 'Ingresos', 'gastos': 'Gastos', 'resumen': 'Análisis', 'config': 'Configuración' };
    document.getElementById('subtitulo-seccion').innerText = " / " + nombres[id];
    
    // Cambiar estado de botones
    document.querySelectorAll('#main-nav button').forEach(btn => btn.classList.remove('nav-active'));
    document.getElementById(`nav-${id}`).classList.add('nav-active');
    
    // ¡EL PUENTE! Aquí llamas a la otra función para que sepa qué hacer
    refrescarVistaActual();
}

// --- 2. SECCIÓN DE LÓGICA DE DATOS ---
function refrescarVistaActual() {
    // Si no hay datos, salimos para no romper nada
    if (movimientos.length === 0 && categorias.length === 0) {
        console.warn("Esperando datos...");
        return; 
    }
    
    // Pintamos lo que siempre necesitamos
    actualizarSelectsCategorias();
    
    // Según la variable 'seccionActual' que definió el Director (showSection), actuamos
    if (seccionActual === 'home') actualizarHome();
    if (seccionActual === 'ingresos') actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
    if (seccionActual === 'gastos') actualizarListadoIndividual('gasto', 'lista-gastos', 'count-ex');
    if (seccionActual === 'resumen') actualizarResumen();
    if (seccionActual === 'config') renderCategoriasConfig();
}

// --- ACCIONES CON SHEETS ---
async function guardarRegistro(tipo) {
    const btn = document.querySelector(`#sec-${tipo}s button[onclick^="guardarRegistro"]`);
    btn.disabled = true; // Deshabilita el botón
    const pref = tipo === 'ingreso' ? 'in' : 'ex';
    const monto = parseFloat(document.getElementById(`${pref}-monto-hidden`).value);

    if (!monto || monto <= 0) {
        alert("Por favor ingresa un monto válido.");
        btn.disabled = false; // Importante: volver a habilitar si hay error
        return;
    }

    const descInput = document.getElementById(`${pref}-desc`).value.trim().toUpperCase();
    const idMovi = editandoId ? editandoId : Date.now();
    const nuevaData = {
        id: idMovi,
        tipo,
        fecha: document.getElementById(`${pref}-fecha`).value,
        cat: document.getElementById(`${pref}-categoria`).value,
        desc: descInput || 'SIN NOMBRE',
        monto
    };

    // Declaramos 'res' y hacemos la petición UNA sola vez
    const res = await FetchAPI("guardarMovimiento", { data: nuevaData });

    if (res.success) {
        if (editandoId) {
            const idx = movimientos.findIndex(m => m.id === editandoId);
            movimientos[idx] = nuevaData;
            editandoId = null;
            const btn = document.querySelector(`#sec-${tipo}s button[onclick^="guardarRegistro"]`);
            btn.innerText = tipo === 'ingreso' ? "GUARDAR REGISTRO" : "REGISTRAR EGRESO";
            btn.classList.remove('ring-4', 'ring-amber-100', 'bg-amber-600');
        } else {
            movimientos.push(nuevaData);
        }

        document.getElementById(`${pref}-monto-mask`).value = "";
        document.getElementById(`${pref}-monto-hidden`).value = 0;
        document.getElementById(`${pref}-desc`).value = "";
        refrescarVistaActual();
    }

    // Ya NO volvemos a declarar 'res' aquí. Solo habilitamos el botón.
    btn.disabled = false;
}

async function eliminarMovimiento(id) {
    if (confirm("¿Deseas eliminar este registro en la nube de forma permanente?")) {
        const res = await FetchAPI("eliminarMovimiento", { id });
        if (res.success) {
            movimientos = movimientos.filter(m => m.id !== id);
            refrescarVistaActual();
        }
    }
}

async function agregarCategoria() {
    const nom = document.getElementById('nueva-cat-nombre').value.trim().toUpperCase();
    const tipo = document.getElementById('nueva-cat-tipo').value;
    if (!nom) return;

    const nuevaCat = { id: Date.now(), nombre: nom, tipo };
    
    // Cambiamos el nombre de la acción aquí para que coincida con el servidor
    const res = await FetchAPI("agregarCategoria", nuevaCat); 
    
    if (res.success) {
        categorias.push(nuevaCat);
        document.getElementById('nueva-cat-nombre').value = '';
        refrescarVistaActual();
    } else {
        alert("Error al guardar: " + res.message);
    }
}

async function eliminarCategoria(id) {
    if (confirm("¿Deseas borrar esta categoría?")) {
        const res = await FetchAPI("eliminarCategoria", { id });
        if (res.success) {
            categorias = categorias.filter(c => c.id !== id);
            refrescarVistaActual();
        }
    }
}

function prepararEdicion(id, tipo) {
    const mov = movimientos.find(m => m.id === id);
    if (!mov) return;
    editandoId = id;
    const pref = tipo === 'ingreso' ? 'in' : 'ex';

    document.getElementById(`${pref}-fecha`).value = mov.fecha;
    document.getElementById(`${pref}-categoria`).value = mov.cat;
    document.getElementById(`${pref}-desc`).value = mov.desc;

    const mask = document.getElementById(`${pref}-monto-mask`);
    document.getElementById(`${pref}-monto-hidden`).value = mov.monto;
    mask.value = mov.monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) + " MXN";

    const btn = document.querySelector(`#sec-${tipo}s button[onclick^="guardarRegistro"]`);
    btn.innerText = "ACTUALIZAR REGISTRO";
    btn.classList.add('ring-4', 'ring-amber-100', 'bg-amber-600');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- RENDERIZADOS LOCALES ---
function actualizarListadoIndividual(tipo, contId, countId) {
    const filtrados = obtenerMovimientosFiltrados().filter(m => m.tipo === tipo).reverse();
    document.getElementById(countId).innerText = `${filtrados.length} items`;
    const cont = document.getElementById(contId);
    cont.innerHTML = filtrados.length ? '' : '<p class="opacity-20 text-center py-10">Sin registros.</p>';

    filtrados.forEach(m => {
        cont.innerHTML += `
                    <div class="p-4 bg-gray-50/50 rounded-xl border border-white flex justify-between items-center group transition-all hover:bg-white hover:shadow-sm">
                        <div class="flex-1">
                            <p class="text-sm font-semibold uppercase text-stone-700">${m.desc}</p>
                            <p class="text-[9px] opacity-40 uppercase font-bold">${m.fecha} | ${m.cat}</p>
                        </div>
                        <div class="flex items-center gap-4">
                            <div class="text-right">
                                <p class="text-sm font-bold ${tipo === 'gasto' ? 'text-rose-400' : 'text-stone-600'}">
                                    ${tipo === 'gasto' ? '-' : '+'}${fMXN(m.monto)}
                                </p>
                            </div>
                            <div class="flex gap-1">
                                <button onclick="prepararEdicion(${m.id}, '${tipo}')" class="p-2 hover:bg-stone-200 rounded-full transition-colors">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8C7E6A" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                                <button onclick="eliminarMovimiento(${m.id})" class="p-2 hover:bg-rose-100 rounded-full transition-colors">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        </div>
                    </div>`;
    });
}

async function generarLibroContable() {
    const { mes, año } = obtenerPeriodoActual();
    const filtrados = obtenerMovimientosFiltrados();
    const workbook = new ExcelJS.Workbook();
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const ahora = new Date();

    if (!filtrados.length) return alert("No hay datos en este período.");
    const sheetER = workbook.addWorksheet('Estado de Resultados');
    let filaER = 1;

    filaER = Encabezado(sheetER, "ESTADO DE RESULTADOS", filaER);
    filaER = Encabezado(sheetER, "PERIODO DE " + meses[mes] + " " + año, filaER);
    filaER = Encabezado(sheetER, "GENERADO EL " + ahora.toLocaleDateString('es-MX'), filaER);
    filaER++;

    let totalIngresos = 0;
    filaER = TitRepCont(sheetER, "INGRESOS", null, filaER);
    filtrados.filter(m => m.tipo === 'ingreso').forEach(m => {
        filaER = DatoRepCont(sheetER, m.cat, m.monto, filaER);
        totalIngresos += m.monto;
    });
    filaER = TitRepCont(sheetER, "(+) TOTAL INGRESOS", totalIngresos, filaER);
    filaER++;

    let totalGastos = 0;
    filaER = TitRepCont(sheetER, "GASTOS", null, filaER);
    filtrados.filter(m => m.tipo === 'gasto').forEach(m => {
        filaER = DatoRepCont(sheetER, m.cat, m.monto, filaER);
        totalGastos += m.monto;
    });
    filaER = TitRepCont(sheetER, "(-) TOTAL GASTOS", totalGastos, filaER);
    filaER++;

    const utilidad = totalIngresos - totalGastos;
    filaER = UtiNeta(sheetER, "UTILIDAD NETA DEL PERIODO", totalGastos, utilidad, filaER);

    descargarArchivo(workbook, "Reporte_Sincronizado_" + meses[mes]);
}

function Encabezado(ws, texto, fila) { ws.mergeCells(`A${fila}:D${fila}`); const cell = ws.getCell(`A${fila}`); cell.value = texto.toUpperCase(); cell.font = { size: 12, bold: true, color: { argb: 'FF45423E' } }; cell.alignment = { horizontal: 'center' }; return fila + 1; }
function TitRepCont(ws, tit, monto, fila) { const cell = ws.getCell(`A${fila}`); cell.value = tit.toUpperCase(); cell.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E705B' } }; const cell1 = ws.getCell(`B${fila}`); cell1.value = monto; cell1.numFmt = '"$"#,##0.00'; return fila + 1; }
function DatoRepCont(ws, cat, monto, fila) { const cell = ws.getCell(`A${fila}`); cell.value = cat.toUpperCase(); const cell1 = ws.getCell(`B${fila}`); cell1.value = monto; cell1.numFmt = '"$"#,##0.00'; return fila + 1; }
function UtiNeta(ws, tit, monto, utilidad, fila) { const cell = ws.getCell(`A${fila}`); cell.value = tit.toUpperCase(); const cell1 = ws.getCell(`B${fila}`); cell1.value = utilidad; cell1.numFmt = '"$"#,##0.00'; return fila + 1; }
async function descargarArchivo(workbook, nombre) { const buffer = await workbook.xlsx.writeBuffer(); const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${nombre}.xlsx`; link.click(); }

function inicializarFiltros() {
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const idsAnio = ['in-año', 'ex-año', 'res-año'];
    const idsMes = ['in-mes', 'ex-mes', 'res-mes'];
    const añoActual = new Date().getFullYear();
    const mesActual = new Date().getMonth();
    [idsMes, idsAnio].forEach((list, idx) => {
        list.forEach(id => {
            const sel = document.getElementById(id);
            if (sel) {
                sel.innerHTML = '';
                if (idx === 0) {
                    meses.forEach((m, i) => {
                        let opt = document.createElement('option');
                        opt.value = i; opt.innerHTML = m; sel.appendChild(opt);
                    });
                    sel.value = mesActual;
                } else {
                    for (let i = añoActual; i >= añoActual - 4; i--) {
                        let opt = document.createElement('option');
                        opt.value = i; opt.innerHTML = i; sel.appendChild(opt);
                    }
                }
            }
        });
    });
}

function obtenerPeriodoActual() {
    let pref = seccionActual === 'ingresos' ? 'in' : (seccionActual === 'gastos' ? 'ex' : 'res');
    const mesEl = document.getElementById(`${pref}-mes`);
    const anioEl = document.getElementById(`${pref}-año`);
    return { mes: mesEl ? parseInt(mesEl.value) : new Date().getMonth(), año: anioEl ? parseInt(anioEl.value) : new Date().getFullYear() };
}

function obtenerMovimientosFiltrados() {
    const { mes, año } = obtenerPeriodoActual();
    return movimientos.filter(m => {
        const mF = new Date(m.fecha + 'T00:00:00Z'); // La 'Z' fuerza UTC
        return mF.getMonth() === mes && mF.getFullYear() === año;
    });
}

function actualizarSelectsCategorias() {
    const inSel = document.getElementById('in-categoria');
    const exSel = document.getElementById('ex-categoria');
    if (inSel) {
        inSel.innerHTML = '';
        categorias.filter(c => c.tipo === 'ingreso').forEach(c => { inSel.innerHTML += `<option value="${c.nombre}">${c.nombre}</option>`; });
    }
    if (exSel) {
        exSel.innerHTML = '';
        categorias.filter(c => c.tipo === 'gasto').forEach(c => { exSel.innerHTML += `<option value="${c.nombre}">${c.nombre}</option>`; });
    }
}

function renderCategoriasConfig() {
    const contIng = document.getElementById('lista-cats-ingreso');
    const contGas = document.getElementById('lista-cats-gasto');
    contIng.innerHTML = ''; contGas.innerHTML = '';
    categorias.forEach(c => {
        const itemHtml = `<div class="bg-gray-50 rounded-lg p-3 flex justify-between items-center"><span class="text-xs font-bold uppercase text-stone-600">${c.nombre}</span><button onclick="eliminarCategoria(${c.id})" class="text-rose-500 font-bold text-xs">X</button></div>`;
        if (c.tipo === 'ingreso') contIng.innerHTML += itemHtml;
        else contGas.innerHTML += itemHtml;
    });
}

function actualizarHome() {
    const hoyStr = new Date().toISOString().split('T')[0];
    const ahora = new Date();
    let balG = 0, balD = 0, ingM = 0, gasM = 0;

    movimientos.forEach(m => {
        const val = m.tipo === 'ingreso' ? m.monto : -m.monto;
        balG += val;
        if (m.fecha === hoyStr) balD += val;
        const mF = new Date(m.fecha + 'T00:00:00');
        if (mF.getMonth() === ahora.getMonth() && mF.getFullYear() === ahora.getFullYear()) {
            if (m.tipo === 'ingreso') ingM += m.monto; else gasM += m.monto;
        }
    });

    document.getElementById('balance-general').innerText = fMXN(balG);
    document.getElementById('balance-dia').innerText = fMXN(balD);
    document.getElementById('home-ingresos').innerText = fMXN(ingM);
    document.getElementById('home-gastos').innerText = fMXN(gasM);

    const ctx = document.getElementById('chartHome').getContext('2d');
    if (chartH) chartH.destroy();
    chartH = new Chart(ctx, { type: 'doughnut', data: { labels: ['Ingresos', 'Gastos'], datasets: [{ data: [ingM, gasM], backgroundColor: ['#D6C7B3', '#E5E7EB'] }] }, options: { cutout: '75%', plugins: { legend: { display: false } } } });

    const listaH = document.getElementById('lista-recientes');
    listaH.innerHTML = '';
    [...movimientos].reverse().slice(0, 10).forEach(m => {
        listaH.innerHTML += `<div class="flex justify-between items-center p-3 bg-gray-50/50 rounded-xl border border-white"><div><p class="text-xs font-semibold uppercase">${m.desc}</p><p class="text-[8px] opacity-40 uppercase">${m.fecha}</p></div><span class="text-xs font-bold ${m.tipo === 'gasto' ? 'text-rose-400' : 'text-stone-600'}">${m.tipo === 'gasto' ? '-' : '+'}${fMXN(m.monto)}</span></div>`;
    });
}

function actualizarResumen() {
    const filtrados = obtenerMovimientosFiltrados();
    let ing = 0, gas = 0;
    const contLista = document.getElementById('lista-resumen-periodo');
    contLista.innerHTML = filtrados.length ? '' : '<p class="opacity-20 text-center py-10 text-sm">Sin movimientos.</p>';

    filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(m => {
        if (m.tipo === 'ingreso') ing += m.monto; else gas += m.monto;
        const div = document.createElement('div');
        div.className = "flex justify-between items-center p-3 bg-gray-50/50 rounded-xl border border-white";
        div.innerHTML = `<div><p class="text-[10px] font-semibold">${m.desc}</p><p class="text-[8px] opacity-40 uppercase">${m.cat} | ${m.fecha}</p></div><span class="text-[10px] font-bold ${m.tipo === 'gasto' ? 'text-rose-400' : 'text-stone-600'}">${m.tipo === 'gasto' ? '-' : '+'}${fMXN(m.monto)}</span>`;
        contLista.appendChild(div);
    });

    document.getElementById('resumen-balance-total').innerText = fMXN(ing - gas);
    const ctx = document.getElementById('chartResumen').getContext('2d');
    if (chartR) chartR.destroy();
    chartR = new Chart(ctx, { type: 'bar', data: { labels: ['Ingresos', 'Gastos'], datasets: [{ data: [ing, gas], backgroundColor: ['#D6C7B3', '#45423E'], borderRadius: 8 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
}

function actualizarFechaHeader() {
    const el = document.getElementById('fecha-sistema');
    if (!el) return; // Candado de seguridad por si no está en la pantalla actual

    const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const fecha = new Date().toLocaleDateString('es-MX', opciones);
    el.innerText = fecha.charAt(0).toUpperCase() + fecha.slice(1);
}

// --- CONTROL DE SESIÓN ---
function cerrarSesion() {
    localStorage.removeItem('session_user');
    localStorage.removeItem('session_userName');
    localStorage.removeItem('isLoggedIn');
    window.location.href = "./login.html";
}

// --- VERIFICACIÓN DE SESIÓN AL CARGAR EL PANEL (BLINDADO) ---
window.onload = function () {
    const userDisplayEl = document.getElementById('user-display');
    const fechaSistemaEl = document.getElementById('fecha-sistema');

    // Si NO existe el contenedor de usuario, asumimos que estamos en login.html
    if (!userDisplayEl) {
        //console.log("Modo Login detectado: Saltando verificaciones del panel principal.");
        return; // Detiene la ejecución aquí de forma segura
    }

    // Si SÍ existe, ejecutamos la lógica normal del panel principal (index.html):
    if (typeof actualizarFechaHeader === "function" && fechaSistemaEl) {
        actualizarFechaHeader();
    }

    const usuarioActivo = localStorage.getItem('session_user');
    const userNameActivo = localStorage.getItem('session_userName');

    if (!usuarioActivo || !userNameActivo) {
        window.location.href = "./login.html";
    } else {
        userDisplayEl.innerText = userNameActivo;

        if (typeof inicializarSincronizacion === "function") {
            inicializarSincronizacion();
        }
    }
}

// Agrega esto en tu script para que el botón se ilumine si estás en la página correcta

// Código para iluminar el botón de navegación activo
window.addEventListener('load', () => {

    // 2. Lógica para el botón de salir (si necesitas aplicarle estilos específicos)
    const btnSalir = document.getElementById('nav-salir');
});

