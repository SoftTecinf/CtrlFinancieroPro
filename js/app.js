// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
const API_URL = "https://script.google.com/macros/s/AKfycby7qsVqL6ufthtYSi-A7LKUs7i7yy8joqyKp7-wNxGinuFym8C4GL8R44EnkDzRAEJyog/exec";
let editandoId = null;
let chartH, chartR;
const fMXN = (v) => v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const AppState = {
    datosCache: [], // Aquí guardamos los datos una vez descargados
    filtros: { busqueda: '' }
};

// --- 1. INICIALIZACIÓN (Punto de entrada único) ---
document.addEventListener('DOMContentLoaded', async () => {
    const appContainer = document.getElementById('app-container');
    const userDisplayEl = document.getElementById('user-display');

    // Si es Login (no hay contenedor app), salir
    if (!appContainer) return;

    // Verificar Sesión
    const usuarioActivo = localStorage.getItem('session_user');
    if (!usuarioActivo) {
        window.location.href = "./login.html";
        return;
    }
    if (userDisplayEl) userDisplayEl.innerText = localStorage.getItem('session_userName');

    // Carga inicial segura
    try {
        await inicializarSincronizacion(); // Esto debe llenar AppState.datosCache
        await showSection('home');
        refrescarVistaActual();
    } catch (err) {
        console.error("Error al iniciar la app:", err);
    }
});

// Variable global fuera de la función
let currentLoadId = 0; 

async function showSection(sectionId) {
    const container = document.getElementById('app-container');
    if (!container) return;

    // Aumentamos el ID cada vez que el usuario hace clic
    const loadId = ++currentLoadId; 

    if (typeof toggleLoading === 'function') toggleLoading(true);

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('nav-active'));
    const activeBtn = document.getElementById(`nav-${sectionId}`);
    if (activeBtn) activeBtn.classList.add('nav-active');

    try {
        const response = await fetch(`${sectionId}.html`);
        if (!response.ok) throw new Error("Error de carga");
        const html = await response.text();

        // Si el usuario hizo clic en otra cosa mientras esta sección cargaba, ignoramos este resultado
        if (loadId !== currentLoadId) return; 

        container.innerHTML = html;
        
        requestAnimationFrame(() => {
            inicializarFuncionesPorSeccion(sectionId);
            if (typeof toggleLoading === 'function') toggleLoading(false);
        });

    } catch (error) {
        if (loadId === currentLoadId) { // Solo mostrar error si es la última petición
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
    // Si los datos están en AppState, la UI se pintará correctamente aunque cambies de vista
    if (document.getElementById('lista-ingresos')) actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
    if (document.getElementById('lista-gastos')) actualizarListadoIndividual('gasto', 'lista-gastos', 'count-ex');
    if (document.getElementById('home-stats')) actualizarHome();
    if (document.getElementById('lista-cats-ingreso')) renderCategoriasConfig();
}