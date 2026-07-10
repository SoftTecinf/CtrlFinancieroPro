// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
const API_URL = "https://script.google.com/macros/s/AKfycby7qsVqL6ufthtYSi-A7LKUs7i7yy8joqyKp7-wNxGinuFym8C4GL8R44EnkDzRAEJyog/exec";
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
    // 1. Recuperar sesión
    const userDisplayEl = document.getElementById('user-display');
    const usuarioNombre = localStorage.getItem('session_userName');
    if (userDisplayEl && usuarioNombre) userDisplayEl.innerText = usuarioNombre;

    // 2. Recuperar el estado completo
    const savedState = localStorage.getItem('financiero_state');
    if (savedState) {
        const parsed = JSON.parse(savedState);
        AppState.datosCache = parsed.movimientos || [];
        if (parsed.filtros) AppState.filtrosActuales = parsed.filtros;
    }

    // 3. Inicializar selects (Usa tu función existente)
    // Asegúrate de que esta función NO llame a refrescarVistaActual internamente
    inicializarFiltros(); 

    // 4. Asegurar que los filtros coincidan con la fecha actual SI no venían guardados
    const ahora = new Date();
    // Solo sobreescribimos el estado si no había filtros guardados en localStorage
    if (!savedState || !AppState.filtrosActuales.mes) {
        AppState.filtrosActuales.mes = ahora.getMonth();
        AppState.filtrosActuales.año = ahora.getFullYear();
    }
    
    // Sincronizar UI con el estado actual
    const mesSelect = document.getElementById('in-mes');
    const añoSelect = document.getElementById('in-año');
    if (mesSelect) mesSelect.value = AppState.filtrosActuales.mes;
    if (añoSelect) añoSelect.value = AppState.filtrosActuales.año;

    // 5. CARGA INMEDIATA
    await showSection('home');
    refrescarVistaActual();

    // 6. SINCRONIZACIÓN EN SEGUNDO PLANO
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

    // 1. UI: Botones y Spinner (Feedback inmediato)
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('nav-active'));
    const activeBtn = document.getElementById(`nav-${sectionId}`);
    if (activeBtn) activeBtn.classList.add('nav-active');

    if (typeof toggleLoading === 'function') toggleLoading(true);

    try {
        // 2. Fetch del HTML
        const response = await fetch(`${sectionId}.html`);
        if (!response.ok) throw new Error("Error de carga");
        const html = await response.text();

        // 3. Control de concurrencia: si cambió el loadId, paramos aquí
        if (loadId !== currentLoadId) return;

        // 4. Inyectamos el esqueleto (HTML)
        container.innerHTML = html;

        // 5. Renderizado final: ahora que el HTML existe, inyectamos los datos
        requestAnimationFrame(() => {
            // Si tenemos datos en caché, se verán casi instantáneamente
            inicializarFuncionesPorSeccion(sectionId);

            if (typeof toggleLoading === 'function') toggleLoading(false);
        });

    } catch (error) {
        if (loadId === currentLoadId) {
            console.error(error);
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
    const mesSel = document.getElementById('in-mes');
    const añoSel = document.getElementById('in-año');

    if (mesSel) AppState.filtrosActuales.mes = parseInt(mesSel.value);
    if (añoSel) AppState.filtrosActuales.año = parseInt(añoSel.value);

    console.log("Refresco disparado");

    // Aquí llamas a tus funciones de pintado
    actualizarListadoIndividual('ingreso', 'lista-ingresos', 'contador-ingresos');

    // 1. Verificación crítica: ¿Tenemos datos?
    if (!AppState.datosCache || AppState.datosCache.length === 0) {
        console.warn("Aún no hay datos para pintar");
        return;
    }

    // 2. Identificar en qué página estamos (basado en el URL o estado)
    // Supongamos que tienes una variable que sabe qué sección está activa
    const seccionActiva = document.querySelector('.nav-active')?.id;

    // 3. Refrescar según la sección
    if (seccionActiva === 'nav-home') {
        actualizarHome();
    } else if (seccionActiva === 'nav-ingresos') {
        actualizarListadoIndividual('ingreso', 'lista-ingresos', 'contador-ingresos');
    } else if (seccionActiva === 'nav-gastos') {
        actualizarListadoIndividual('gasto', 'lista-gastos', 'contador-gastos');
    }
}

function inicializarFiltrosFecha() {
    const mesSelect = document.getElementById('in-mes');
    const añoSelect = document.getElementById('in-año');
    if (!mesSelect || !añoSelect) return;

    // Llenar Meses
    const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    mesSelect.innerHTML = meses.map((m, i) => `<option value="${i}">${m}</option>`).join('');

    // Llenar Años (rango +/- 1 año)
    const year = new Date().getFullYear();
    añoSelect.innerHTML = `<option value="${year}">${year}</option><option value="${year - 1}">${year - 1}</option>`;

    // Poner valor actual
    mesSelect.value = new Date().getMonth();
    añoSelect.value = year;
}