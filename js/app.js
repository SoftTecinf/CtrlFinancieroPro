// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
const API_URL = "https://script.google.com/macros/s/AKfycbzvR903lBMnhRitzGVTj6E1XnIukpaOI7UZZM540_LX9Hdo7maew-vKKK-s_jDs7OGLvQ/exec";
let editandoId = null;
let chartH, chartR;
//const fMXN = (v) => v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const AppState = {
    datosCache: [],
    categorias: [], // <--- Añade esto
    filtrosActuales: { busqueda: '', categoria: 'todos' }
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
        AppState.datosCache = parsed.movimientos || [];
        // Solo cargamos filtros guardados si existen
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

        // 4. Inyectamos el esqueleto (HTML)
        container.innerHTML = html;

        // 5. Renderizado final: Reactivación de la interfaz y los datos
        requestAnimationFrame(() => {
            // A. Recuperar nombre de usuario
            const userDisplayEl = document.getElementById('user-display');
            if (userDisplayEl) userDisplayEl.innerText = localStorage.getItem('session_userName') || 'Soporte';

            // B. Re-iniciamos filtros
            if (typeof inicializarFiltros === 'function') inicializarFiltros();
            if (typeof configurarEventosFiltros === 'function') configurarEventosFiltros();

            // C. ESPERA DE SEGURIDAD (50ms): Damos tiempo al navegador a que el DOM se procese totalmente
            setTimeout(() => {
                // D. SINCRONIZACIÓN DE EMERGENCIA
                // Si datosCache está vacío, intentamos re-sincronizar antes de pintar
                if (AppState.datosCache.length === 0 && typeof inicializarSincronizacion === 'function') {
                    // console.log("Datos vacíos detectados, forzando fetch...");
                    inicializarSincronizacion().then(() => inicializarFuncionesPorSeccion(sectionId));
                } else {
                    inicializarFuncionesPorSeccion(sectionId);
                }

                // E. Quitar spinner
                if (typeof toggleLoading === 'function') toggleLoading(false);
            }, 50);
        });

        if (sectionId === 'ingresos') {
            const inputFecha = document.getElementById('in-fecha');
            if (inputFecha) {
                inputFecha.value = new Date().toISOString().split('T')[0];
            }
        }

    } catch (error) {
        if (loadId === currentLoadId) {
            console.error("Error al cargar la sección:", error);
            if (typeof toggleLoading === 'function') toggleLoading(false);
        }
    }
}

// --- 3. LÓGICA DE VISTAS ---
function inicializarFuncionesPorSeccion(sectionId) {
    if (sectionId === 'home') { actualizarHome(); actualizarFechaHeader(); }
    if (sectionId === 'ingresos') { actualizarSelectsCategorias(); actualizarListadoIndividual('ingreso', 'lista-ingresos', 'cont-ingresos'); }
    if (sectionId === 'gastos') { actualizarSelectsCategorias(); actualizarListadoIndividual('gasto', 'lista-gastos', 'cont-gastos'); }
    if (sectionId === 'analisis') { actualizarResumen(); }
    if (sectionId === 'ajustes') { renderCategoriasConfig(); }
}

function refrescarVistaActual() {
    const activeBtn = document.querySelector('.nav-active');
    if (!activeBtn) return;
    const seccionId = activeBtn.id;

    let mesSel, añoSel;
    if (seccionId === 'nav-ingresos') {
        mesSel = document.getElementById('in-mes');
        añoSel = document.getElementById('in-año');
    } else if (seccionId === 'nav-gastos') {
        mesSel = document.getElementById('ex-mes');
        añoSel = document.getElementById('ex-año');
    }

    // 🔥 CAMBIO CRUCIAL: Solo actualizamos si el usuario interactuó 
    // O si el selector tiene un valor válido diferente al por defecto (si aplica)
    if (mesSel && mesSel.value !== "") {
        AppState.filtrosActuales.mes = parseInt(mesSel.value);
    }
    if (añoSel && añoSel.value !== "") {
        AppState.filtrosActuales.año = parseInt(añoSel.value);
    }

    // 3. Pintar según la sección detectada
    if (seccionId === 'nav-home') {
        actualizarHome();
    } else if (seccionId === 'nav-ingresos') {
        actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
    } else if (seccionId === 'nav-gastos') {
        actualizarListadoIndividual('gasto', 'lista-gastos', 'count-ex');
    }
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