// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
const API_URL = "https://script.google.com/macros/s/AKfycbzvR903lBMnhRitzGVTj6E1XnIukpaOI7UZZM540_LX9Hdo7maew-vKKK-s_jDs7OGLvQ/exec";
let editandoId = null;
let chartH, chartR;
//const fMXN = (v) => v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const AppState = {
    movimientos: [],
    categorias: [],
    filtrosActuales: { busqueda: '', categoria: 'todos', mes: 6, año: 2026 },
    cargado: false // <--- NUEVA GUARDIA
};

// --- 1. INICIALIZACIÓN (Punto de entrada único) ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. CARGA DE INTERFAZ
    await showSection('home');

    // 2. RECUPERAR ESTADO
    const savedState = localStorage.getItem('financiero_state');
    const ahora = new Date();

    if (savedState) {
        const parsed = JSON.parse(savedState);
        // CAMBIO AQUÍ: Usamos AppState.movimientos consistentemente
        AppState.movimientos = parsed.movimientos || [];

        if (parsed.filtros) {
            AppState.filtrosActuales = parsed.filtros;
        }
    }

    // 3. CONFIGURACIÓN INICIAL
    const userDisplayEl = document.getElementById('user-display');
    if (userDisplayEl) userDisplayEl.innerText = localStorage.getItem('session_userName') || 'Soporte';

    // 4. INICIALIZAR Y FORZAR FECHA ACTUAL (Julio 2026)
    inicializarFiltros();

    // Forzamos el estado a la fecha actual del sistema
    AppState.filtrosActuales.mes = ahora.getMonth();
    AppState.filtrosActuales.año = ahora.getFullYear();

    // 5. SINCRONIZAR UI CON ESTADO (Modifica esta parte así)
    const selectoresMes = ['in-mes', 'ex-mes', 'res-mes'];
    const selectoresAnio = ['in-año', 'ex-año', 'res-año'];

    selectoresMes.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = AppState.filtrosActuales.mes;
    });

    selectoresAnio.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = AppState.filtrosActuales.año;
    });

    const inputFecha = document.getElementById('in-fecha');
    if (inputFecha) {
        // Formato YYYY-MM-DD necesario para el input type="date"
        inputFecha.value = new Date().toISOString().split('T')[0];
    }

    // 6. EJECUTAR REFRESCO FINAL
    refrescarVistaActual();

    // 7. SINCRONIZACIÓN EN SEGUNDO PLANO
    inicializarSincronizacion().then(() => {
        refrescarVistaActual();
    });
});

// Variable global fuera de la función
let currentLoadId = 0;
async function showSection(sectionId) {
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

        // 3. Control de concurrencia
        if (loadId !== currentLoadId) return;

        // 4. Inyectamos el esqueleto (HTML) UNA SOLA VEZ
        container.innerHTML = html;

        // 5. Renderizado final
        // Usamos requestAnimationFrame para asegurar que el navegador procesó el DOM
        requestAnimationFrame(() => {
            
            // A. Recuperar nombre de usuario
            const userDisplayEl = document.getElementById('user-display');
            if (userDisplayEl) userDisplayEl.innerText = localStorage.getItem('session_userName') || 'Soporte';

            // B. Re-iniciamos filtros
            if (typeof inicializarFiltros === 'function') inicializarFiltros();
            if (typeof configurarEventosFiltros === 'function') configurarEventosFiltros();

            // C. Lógica específica por sección
            if (sectionId === 'ingresos') {
                const inputFecha = document.getElementById('in-fecha');
                if (inputFecha) inputFecha.value = new Date().toISOString().split('T')[0];

                const mesSel = document.getElementById('in-mes');
                if (mesSel) {
                    mesSel.value = new Date().getMonth();
                    AppState.filtrosActuales.mes = parseInt(mesSel.value);
                }
                inicializarFuncionesPorSeccion(sectionId);
            }

            // D. SINCRONIZACIÓN DE DATOS (Con pequeña espera para estabilizar el DOM)
            setTimeout(() => {
                const faltanMovimientos = (!AppState.movimientos || AppState.movimientos.length === 0);
                const faltanCategorias = (!AppState.categorias || AppState.categorias.length === 0);

                if ((faltanMovimientos || faltanCategorias) && !AppState.cargado) {
                    inicializarSincronizacion().then(() => {
                        AppState.cargado = true;
                        inicializarFuncionesPorSeccion(sectionId);
                        if (typeof toggleLoading === 'function') toggleLoading(false);
                    });
                } else {
                    inicializarFuncionesPorSeccion(sectionId);
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
        actualizarGraficoDistribucion(ingM, gasM);
    }
    else if (idLimpio === 'ingresos') {
        actualizarSelectsCategorias();
        actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
    }
    else if (idLimpio === 'gastos') {
        actualizarSelectsCategorias();
        actualizarListadoIndividual('gasto', 'lista-gastos', 'cont-gastos');
    }
    else if (idLimpio === 'analisis') {
        actualizarResumen();
    }
    // 🔴 CAMBIO AQUÍ: Cambiamos 'ajustes' por 'config'
    else if (idLimpio === 'config') {
        abrirVistaAjustesInteligente();
    } else {
        console.log("⚠️ No se encontró la función para la sección:", idLimpio);
    }
}

function refrescarVistaActual() {
    const activeBtn = document.querySelector('.nav-active');
    if (!activeBtn) return;

    const seccionId = activeBtn.id;

    // ... (tu lógica de filtros se mantiene igual)

    // A. Pintar según la sección
    if (seccionId === 'nav-home') {
        actualizarHome();
    } else if (seccionId === 'nav-ingresos') {
        actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
    } else if (seccionId === 'nav-gastos') {
        actualizarListadoIndividual('gasto', 'lista-gastos', 'count-ex');
    }

    // B. CORRECCIÓN: Usamos requestAnimationFrame para asegurar que el DOM 
    // terminó de procesar los cambios de actualizarHome()
    requestAnimationFrame(() => {
        const canvas = document.getElementById('chartHome');
        
        if (canvas) {
            // Pasamos los datos calculados de tu estado global
            // Asegúrate de tener los valores disponibles aquí
            actualizarGraficoDistribucion(AppState.ingM, AppState.gasM);
        } else {
            console.warn("El canvas #chartHome no existe todavía, saltando dibujo.");
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