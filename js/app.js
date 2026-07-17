// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
const API_URL = "https://script.google.com/macros/s/AKfycbzvR903lBMnhRitzGVTj6E1XnIukpaOI7UZZM540_LX9Hdo7maew-vKKK-s_jDs7OGLvQ/exec";
let editandoId = null;
let chartH, chartR;
// En el nivel más alto de app.js
//let ingM = 40800;
//let gasM = 0;

// app.js
window.AppState = {
    movimientos: [],
    categorias: [],
    filtrosActuales: {
        busqueda: '',
        categoria: 'todos',
        mes: new Date().getMonth(), // Usamos la fecha actual solo si no hay nada guardado
        año: new Date().getFullYear()
    },
    cargado: false
};

// --- 1. INICIALIZACIÓN (Punto de entrada único) ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. DEFINICIÓN DE TIEMPO
    const ahora = new Date();

    // 2. RECUPERAR ESTADO (Cache Primero)
    const savedState = localStorage.getItem('financiero_state');
    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            if (parsed.movimientos) window.AppState.movimientos = parsed.movimientos;
            if (parsed.filtrosActuales) window.AppState.filtrosActuales = parsed.filtrosActuales;
        } catch (e) {
            console.error("Error al recuperar estado:", e);
        }
    }

    // 3. APLICAR VALORES POR DEFECTO (Solo si NO existen en el caché)
    if (window.AppState.filtrosActuales.mes === undefined) {
        window.AppState.filtrosActuales.mes = ahora.getMonth();
    }
    if (window.AppState.filtrosActuales.año === undefined) {
        window.AppState.filtrosActuales.año = ahora.getFullYear();
    }

    // 4. ACTUALIZAR UI (Encabezado y Sección)
    // Actualizamos la fecha del header (HOLA, SOPORTE, JUEVES 16...)
    const headerDate = document.getElementById('fecha-header'); // Asegúrate que tu HTML tenga este ID
    if (headerDate) {
        const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        headerDate.innerText = ahora.toLocaleDateString('es-MX', opciones).toUpperCase();
    }

    // Navegación persistente
    const ultimaSeccion = localStorage.getItem('ultima_seccion') || 'home';
    await showSection(ultimaSeccion);

    // Activar botón nav
    const btn = document.getElementById(`nav-${ultimaSeccion}`);
    if (btn) {
        document.querySelectorAll('nav button').forEach(b => b.classList.remove('nav-active'));
        btn.classList.add('nav-active');
    }

    // 5. SINCRONIZAR SELECTORES DE UI CON EL ESTADO RECUPERADO
    const state = window.AppState;
    const selectoresMes = ['in-mes', 'ex-mes', 'res-mes'];
    const selectoresAnio = ['in-año', 'ex-año', 'res-año'];

    selectoresMes.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = state.filtrosActuales.mes;
    });

    selectoresAnio.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = state.filtrosActuales.año;
    });

    const inputFecha = document.getElementById('in-fecha');
    if (inputFecha) {
        inputFecha.value = ahora.toISOString().split('T')[0];
    }

    // 6. EJECUTAR REFRESCO INICIAL (Con datos de caché)
    refrescarVistaActual();

    // 7. SINCRONIZACIÓN EN SEGUNDO PLANO (Datos reales)
    inicializarSincronizacion().then(() => {
        // Al terminar la carga real, refrescamos una vez más para asegurar datos frescos
        refrescarVistaActual();
    });
});

// Variable global fuera de la función
let currentLoadId = 0;
async function showSection(sectionId) {
    localStorage.setItem('ultima_seccion', sectionId);
    const container = document.getElementById('app-container');
    if (!container) return;

    const loadId = ++currentLoadId;

    // 1. UI: Feedback inmediato
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('nav-active'));
    const activeBtn = document.getElementById(`nav-${sectionId}`);
    if (activeBtn) activeBtn.classList.add('nav-active');

    if (typeof toggleLoading === 'function') toggleLoading(true);

    try {
        // 2. Fetch del HTML
        const response = await fetch(`${sectionId}.html`);
        if (!response.ok) throw new Error("Error de carga");
        const html = await response.text();

        // Control de concurrencia
        if (loadId !== currentLoadId) return;

        // 3. ¡CORRECCIÓN CRÍTICA!: Inyectamos el HTML PRIMERO
        container.innerHTML = html;

        // 4. Ahora que el DOM existe, actualizamos la interfaz
        actualizarFechaHeader(); 
        
        // Ejecutamos la lógica de la sección
        inicializarFuncionesPorSeccion(sectionId);

        if (typeof toggleLoading === 'function') toggleLoading(false);

    } catch (error) {
        console.error("Error al cargar:", error);
        if (typeof toggleLoading === 'function') toggleLoading(false);
    }
}

// --- 3. LÓGICA DE VISTAS (EN APP.JS) ---
function inicializarFuncionesPorSeccion(sectionId) {
    const idLimpio = sectionId.replace('nav-', '');

    if (idLimpio === 'home') {
        actualizarHome();
        actualizarFechaHeader();
        // CAMBIO: Quita (ingM, gasM), déjalo vacío. 
        // La función buscará los valores en window.EstadoFinanciero
        window.ultimaCarga = { i: -1, g: -1 };
        actualizarGraficoDistribucion();
    }
    else if (idLimpio === 'ingresos') {
        actualizarSelectsCategorias();
        actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
    }
    else if (idLimpio === 'gastos') {
        actualizarSelectsCategorias(); // Asegura que las categorías se carguen
        actualizarListadoIndividual('gasto', 'lista-gastos', 'count-ex'); // Usa 'count-ex' como en tu HTML
    }
    else if (idLimpio === 'analisis') {
        actualizarResumen();
    }
    // 🔴 CAMBIO AQUÍ: Cambiamos 'ajustes' por 'config'
    else if (idLimpio === 'config') {
        abrirVistaAjustesInteligente();
    } else {
    }
}

function refrescarVistaActual() {
    // 1. SIEMPRE actualizar los indicadores globales (Home, Hoy, Ingresos/Gastos Mes)
    if (typeof actualizarHome === 'function') {
        actualizarHome();
    }

    // 2. Lógica específica por sección
    const activeBtn = document.querySelector('.nav-active');
    if (!activeBtn) return;

    const seccionId = activeBtn.id;

    if (seccionId === 'nav-ingresos') {
        actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
    } 
    else if (seccionId === 'nav-gastos') {
        // Actualizamos filtros de estado desde los selects
        const m = document.getElementById('ex-mes');
        const a = document.getElementById('ex-año');
        if (m) window.AppState.filtrosActuales.mes = parseInt(m.value);
        if (a) window.AppState.filtrosActuales.año = parseInt(a.value);

        actualizarListadoIndividual('gasto', 'lista-gastos', 'count-ex');
    } 
    else if (seccionId === 'nav-resumen') {
        // --- AQUÍ ESTABA LA CLAVE ---
        // Sincronizamos los filtros de la sección de análisis antes de calcular
        const m = document.getElementById('res-mes');
        const a = document.getElementById('res-año');
        
        if (m) window.AppState.filtrosActuales.mes = parseInt(m.value);
        if (a) window.AppState.filtrosActuales.año = parseInt(a.value);
        
        // Ahora sí, llamamos al cálculo
        actualizarResumen();
    }

    // 3. Gráficos
    requestAnimationFrame(() => {
        if (typeof window.actualizarGraficoDistribucion === 'function') {
            window.actualizarGraficoDistribucion();
        }
    });
}

function fMXN(monto) {
    // Convertimos a número, si no es válido, usamos 0
    const valor = parseFloat(monto);

    if (isNaN(valor)) {
        console.warn("Valor inválido detectado para formato:", monto);
        return "$0.00";
    }

    return valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

// app.js (al principio de todo el archivo)
window.formatearFechaMX = function (fechaString) {
    if (!fechaString) return "";
    const fecha = new Date(fechaString.includes('T') ? fechaString : `${fechaString}T00:00:00`);
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
};