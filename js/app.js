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
        // 2. Fetch del HTML de la sección
        const response = await fetch(`${sectionId}.html`);
        if (!response.ok) throw new Error("Error de carga");
        const html = await response.text();

        // 3. Control de concurrencia
        if (loadId !== currentLoadId) return;

        // CORRECCIÓN: Primero inyectamos el HTML limpio en el DOM
        container.innerHTML = html;

        // 4. Renderizado final y repoblación de datos
        requestAnimationFrame(() => {

            // A. Recuperar nombre de usuario
            const userDisplayEl = document.getElementById('user-display');
            if (userDisplayEl) userDisplayEl.innerText = localStorage.getItem('session_userName') || 'Soporte';

            // B. Re-iniciamos filtros generales de la UI
            if (typeof inicializarFiltros === 'function') inicializarFiltros();
            if (typeof configurarEventosFiltros === 'function') configurarEventosFiltros();

            // C. Lógica específica por sección (Respetando el Estado Global)
            if (sectionId === 'home') {
                inicializarFuncionesPorSeccion(sectionId);
                window.ultimaCarga = { i: -1, g: -1 };

                setTimeout(() => {
                    if (typeof actualizarGraficoDistribucion === 'function') {
                        actualizarGraficoDistribucion();
                    }
                }, 200);
            }
            else if (sectionId === 'ingresos') {
                const inputFecha = document.getElementById('in-fecha');
                if (inputFecha) inputFecha.value = new Date().toISOString().split('T')[0];

                const mesSel = document.getElementById('in-mes');
                if (mesSel) {
                    // MODIFICADO: Lee el mes del estado global, NO el mes del sistema actual
                    mesSel.value = AppState.filtrosActuales.mes;
                }
                inicializarFuncionesPorSeccion(sectionId);
            }
            else if (sectionId === 'gastos') {
                const inputFecha = document.getElementById('ex-fecha');
                if (inputFecha) inputFecha.value = new Date().toISOString().split('T')[0];

                const mesSel = document.getElementById('ex-mes');
                if (mesSel) {
                    // MODIFICADO: Lee el mes del estado global, NO el mes del sistema actual
                    mesSel.value = AppState.filtrosActuales.mes;
                }
                inicializarFuncionesPorSeccion(sectionId);
            }
            else if (sectionId === 'resumen' || sectionId === 'analisis') {
                // Bloque explícito para asegurar que la sección de análisis se sincronice al entrar
                const mesSel = document.getElementById('res-mes');
                if (mesSel) {
                    mesSel.value = AppState.filtrosActuales.mes;
                }
                inicializarFuncionesPorSeccion(sectionId);
            }

            // D. SINCRONIZACIÓN Y DIBUJO DE DATOS
            const movs = AppState.movimientos || [];
            const cats = AppState.categorias || [];

            const faltanMovimientos = (movs.length === 0);
            const faltanCategorias = (cats.length === 0);

            setTimeout(() => {
                if ((faltanMovimientos || faltanCategorias) && !AppState.cargado) {
                    inicializarSincronizacion().then(() => {
                        AppState.cargado = true;
                        inicializarFuncionesPorSeccion(sectionId); // Llena selects de categorías con datos nuevos
                        refrescarVistaActual();
                        if (typeof toggleLoading === 'function') toggleLoading(false);
                    });
                } else {
                    // 🔥 CORRECCIÓN AQUÍ: Aunque los datos ya existan en caché, 
                    // debemos volver a llenar los selects de categorías del nuevo HTML
                    inicializarFuncionesPorSeccion(sectionId);
                    refrescarVistaActual();
                    if (typeof toggleLoading === 'function') toggleLoading(false);
                }
            }, 150);
        });

    } catch (error) {
        if (loadId === currentLoadId) {
            console.error("Error al cargar la sección:", error);
            if (typeof toggleLoading === 'function') toggleLoading(false);
        }
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
        const m = document.getElementById('res-mes');
        const a = document.getElementById('res-año');
        if (m) window.AppState.filtrosActuales.mes = parseInt(m.value);
        if (a) window.AppState.filtrosActuales.año = parseInt(a.value);

        actualizarResumen(); // Esta función procesa tus textos y datos numéricos
    }

    // 3. Gráficos dentro de refrescarVistaActual
    requestAnimationFrame(() => {
        // Mantiene el bucle del home si existe
        if (typeof window.actualizarGraficoDistribucion === 'function') {
            window.actualizarGraficoDistribucion();
        }

        // 🔥 LADO DE ANÁLISIS: Llama a tu formato original de barras
        if (seccionId === 'resumen' || seccionId === 'analisis' || seccionId === 'nav-resumen') {
            if (typeof window.actualizarResumen === 'function') {
                window.actualizarResumen();
            }
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