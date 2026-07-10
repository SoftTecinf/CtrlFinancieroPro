// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
const API_URL = "https://script.google.com/macros/s/AKfycbzvR903lBMnhRitzGVTj6E1XnIukpaOI7UZZM540_LX9Hdo7maew-vKKK-s_jDs7OGLvQ/exec";
let editandoId = null;
let chartH, chartR;
const fMXN = (v) => v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const AppState = {
    datosCache: [],
    categorias: [], // <--- Añade esto
    filtrosActuales: { busqueda: '', categoria: 'todos' }
};

// --- 1. INICIALIZACIÓN (Punto de entrada único) ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. CARGA DE INTERFAZ PRIMERO
    await showSection('home'); 

    // 2. RECUPERAR ESTADO
    const savedState = localStorage.getItem('financiero_state');
    if (savedState) {
        const parsed = JSON.parse(savedState);
        AppState.datosCache = parsed.movimientos || [];
        if (parsed.filtros) AppState.filtrosActuales = parsed.filtros;
    }

    // 3. CONFIGURACIÓN DE UI (Ahora que showSection ya inyectó el HTML)
    const userDisplayEl = document.getElementById('user-display');
    if (userDisplayEl) userDisplayEl.innerText = localStorage.getItem('session_userName') || 'Soporte';

    inicializarFiltros(); 
    configurarEventosFiltros();

    // 4. ASEGURAR FILTROS
    const ahora = new Date();
    if (!savedState || AppState.filtrosActuales.mes === undefined) {
        AppState.filtrosActuales.mes = ahora.getMonth();
        AppState.filtrosActuales.año = ahora.getFullYear();
    }
    
    // 5. SINCRONIZAR UI CON ESTADO
    const mesSelect = document.getElementById('in-mes');
    const añoSelect = document.getElementById('in-año');
    if (mesSelect) mesSelect.value = AppState.filtrosActuales.mes;
    if (añoSelect) añoSelect.value = AppState.filtrosActuales.año;

    // 6. EJECUTAR REFRESCO FINAL
    refrescarVistaActual();

    // 7. SINCRONIZACIÓN EN SEGUNDO PLANO
    inicializarSincronizacion().then(() => {
        console.log("Datos frescos sincronizados");
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
            // A. Recuperar nombre de usuario tras inyectar el nuevo HTML
            const userDisplayEl = document.getElementById('user-display');
            if (userDisplayEl) {
                userDisplayEl.innerText = localStorage.getItem('session_userName') || 'Soporte';
            }

            // B. RE-INICIALIZACIÓN CRÍTICA (Lo que evita que los filtros mueran)
            // Esto asegura que los nuevos <select> tengan vida otra vez
            if (typeof inicializarFiltros === 'function') inicializarFiltros();
            if (typeof configurarEventosFiltros === 'function') configurarEventosFiltros();

            // C. Pintado de datos según la sección cargada
            inicializarFuncionesPorSeccion(sectionId);

            // D. Quitar spinner
            if (typeof toggleLoading === 'function') toggleLoading(false);
        });

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
    // 1. Sincronizar DOM -> ESTADO (Solo si los selectores existen)
    const mesSel = document.getElementById('in-mes');
    const añoSel = document.getElementById('in-año');
    
    if (mesSel && añoSel) {
        AppState.filtrosActuales.mes = parseInt(mesSel.value);
        AppState.filtrosActuales.año = parseInt(añoSel.value);
    }

    console.log("Refrescando con:", AppState.filtrosActuales);

    // 2. Identificar sección activa de forma segura
    const activeBtn = document.querySelector('.nav-active');
    if (!activeBtn) return;

    const seccionId = activeBtn.id; // ej: 'nav-home'

    // 3. Pintar según la sección detectada
    if (seccionId === 'nav-home') {
        actualizarHome();
    } else if (seccionId === 'nav-ingresos') {
        actualizarListadoIndividual('ingreso', 'lista-ingresos', 'contador-ingresos');
    } else if (seccionId === 'nav-gastos') {
        actualizarListadoIndividual('gasto', 'lista-gastos', 'contador-gastos');
    }
}

function configurarEventosFiltros() {
    const ids = ['in-mes', 'in-año'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            // Clonamos el elemento para eliminar todos los eventos antiguos rápidamente
            const clone = el.cloneNode(true);
            el.parentNode.replaceChild(clone, el);
            
            // Asignamos el evento al nuevo elemento limpio
            clone.addEventListener('change', () => refrescarVistaActual());
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