// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
const API_URL = "https://script.google.com/macros/s/AKfycbzvR903lBMnhRitzGVTj6E1XnIukpaOI7UZZM540_LX9Hdo7maew-vKKK-s_jDs7OGLvQ/exec";

// Usamos window.variable para evitar el error "already been declared"
window.chartH = null;
window.chartR = null;

const AppState = {
    movimientos: [],
    categorias: [],
    filtrosActuales: { busqueda: '', categoria: 'todos', mes: new Date().getMonth(), año: new Date().getFullYear() }
};

// --- 1. INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    // A. Carga desde caché local (Instantáneo)
    const savedState = localStorage.getItem('financiero_state');
    if (savedState) {
        const parsed = JSON.parse(savedState);
        AppState.movimientos = parsed.movimientos || [];
        AppState.categorias = parsed.categorias || [];
    }

    // B. Carga la interfaz inicial
    await showSection('home');

    // C. Sincronización única (Sin bloquear la UI)
    inicializarSincronizacion().then(() => {
        localStorage.setItem('financiero_state', JSON.stringify(AppState));
        refrescarVistaActual();
    });
});

// --- 2. CONTROL DE VISTAS ---
let currentLoadId = 0;
async function showSection(sectionId) {
    const container = document.getElementById('app-container');
    if (!container) return;

    const loadId = ++currentLoadId;
    
    // Feedback visual
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('nav-active'));
    document.getElementById(`nav-${sectionId}`)?.classList.add('nav-active');

    try {
        const response = await fetch(`${sectionId}.html`);
        const html = await response.text();

        if (loadId !== currentLoadId) return; // Si el usuario cambió de tab rápido, ignoramos lo viejo
        
        container.innerHTML = html;

        // Esperamos a que el DOM esté listo
        requestAnimationFrame(() => {
            inicializarFuncionesPorSeccion(sectionId);
        });
    } catch (error) {
        console.error("Error al cargar sección:", error);
    }
}

// --- 3. LÓGICA DE VISTAS (Limpia) ---
function inicializarFuncionesPorSeccion(sectionId) {
    if (sectionId === 'home') actualizarHome();
    if (sectionId === 'ingresos') actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
    if (sectionId === 'gastos') actualizarListadoIndividual('gasto', 'lista-gastos', 'count-ex');
}

function refrescarVistaActual() {
    const activeBtn = document.querySelector('.nav-active');
    if (!activeBtn) return;
    
    // Identificamos sección por ID del botón activo
    const id = activeBtn.id.replace('nav-', '');
    inicializarFuncionesPorSeccion(id);
}

function fMXN(monto) {
    const valor = parseFloat(monto) || 0;
    return valor.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}