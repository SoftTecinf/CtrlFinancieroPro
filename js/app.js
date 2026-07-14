// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
const API_URL = "https://script.google.com/macros/s/AKfycbzvR903lBMnhRitzGVTj6E1XnIukpaOI7UZZM540_LX9Hdo7maew-vKKK-s_jDs7OGLvQ/exec";

// Usamos window.variable para evitar el error "already been declared"
window.chartH = null;
window.chartR = null;

const AppState = {
    usuario: { nombre: '' }, // <-- Agregamos esta línea
    movimientos: [],
    categorias: [],
    filtrosActuales: { busqueda: '', categoria: 'todos', mes: new Date().getMonth(), año: new Date().getFullYear() }
};

// --- 1. INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    const savedState = localStorage.getItem('financiero_state');
    
    // Recuperamos el nombre de la llave que SÍ tiene el dato
    const nombreGuardado = localStorage.getItem('session_userName') || '';

    if (savedState) {
        const parsed = JSON.parse(savedState);
        AppState.movimientos = parsed.movimientos || [];
        AppState.categorias = parsed.categorias || [];
        
        // FORZAMOS la asignación aquí
        AppState.usuario = { nombre: nombreGuardado }; 
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
async function showSection(sectionId) {
    const container = document.getElementById('app-container');
    if (!container) return;

    const loadId = ++currentLoadId;
    
    // 1. Feedback visual (esto está bien)
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('nav-active'));
    document.getElementById(`nav-${sectionId}`)?.classList.add('nav-active');

    try {
        // 2. Carga el HTML
        const response = await fetch(`${sectionId}.html`);
        const html = await response.text();

        if (loadId !== currentLoadId) return;
        
        container.innerHTML = html;

        // 3. RE-HIDRATACIÓN:
        // Aquí forzamos que, sin importar el tiempo, se vuelva a pintar.
        // Además, nos aseguramos de que el estado esté actualizado antes de pintar.
        actualizarUsuarioHeader(); // Pinta el nombre
        inicializarFuncionesPorSeccion(sectionId);
        
    } catch (error) {
        console.error("Error al cargar sección:", error);
    }
}

// --- 3. LÓGICA DE VISTAS (Corregida) ---
function inicializarFuncionesPorSeccion(sectionId) {
    // Siempre actualizamos el usuario (ya que lo tienes en localStorage)
    actualizarUsuarioHeader(); 

    if (sectionId === 'home') {
        actualizarHome(); // Asegúrate de que esta función pinte el resumen
    } else if (sectionId === 'ingresos') {
        actualizarSelectsCategorias();
        actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
    } else if (sectionId === 'gastos') {
        actualizarSelectsCategorias();
        actualizarListadoIndividual('gasto', 'lista-gastos', 'count-ex');
    }
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