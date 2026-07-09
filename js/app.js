// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
const API_URL = "https://script.google.com/macros/s/AKfycby7qsVqL6ufthtYSi-A7LKUs7i7yy8joqyKp7-wNxGinuFym8C4GL8R44EnkDzRAEJyog/exec";
let editandoId = null;
let chartH, chartR;
const fMXN = (v) => v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const AppState = {
    filtrosActuales: { busqueda: '', categoria: 'todos' },
    datosCache: [] 
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

// --- 2. NAVEGACIÓN ---
async function showSection(sectionId) {
    const container = document.getElementById('app-container');
    if (!container) return;

    // 1. Mostrar estado de carga (Feedback inmediato)
    if (typeof toggleLoading === 'function') toggleLoading(true);

    // 2. UI: Cambio de botones (Esto debe ser instantáneo)
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('nav-active'));
    const activeBtn = document.getElementById(`nav-${sectionId}`);
    if (activeBtn) activeBtn.classList.add('nav-active');

    try {
        // 3. Fetch con timeout (opcional pero recomendado)
        const response = await fetch(`${sectionId}.html`);
        if (!response.ok) throw new Error("Archivo no encontrado");
        
        const html = await response.text();

        // 4. Inyección controlada
        // En lugar de borrar todo de golpe, inyectamos el HTML
        container.innerHTML = html;
        
        // 5. Inicialización optimizada
        // Aseguramos que las funciones corran después de que el navegador haya renderizado el HTML
        requestAnimationFrame(() => {
            inicializarFuncionesPorSeccion(sectionId);
            refrescarVistaActual();
            
            // Ocultar carga solo cuando todo esté listo
            if (typeof toggleLoading === 'function') toggleLoading(false);
        });

    } catch (error) {
        console.error("Error al cargar la sección:", error);
        container.innerHTML = `<p class="p-5 text-red-500">Error al cargar la sección. Intenta nuevamente.</p>`;
        if (typeof toggleLoading === 'function') toggleLoading(false);
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