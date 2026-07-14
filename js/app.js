// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
const API_URL = "https://script.google.com/macros/s/AKfycbzvR903lBMnhRitzGVTj6E1XnIukpaOI7UZZM540_LX9Hdo7maew-vKKK-s_jDs7OGLvQ/exec";
let editandoId = null;
let chartH, chartR;
//const fMXN = (v) => v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

const AppState = {
    datosCache: [],
    movimientos: [],
    categorias: [],
    filtrosActuales: { busqueda: '', categoria: 'todos', mes: 6, año: 2026 },
    cargado: false // <--- NUEVA GUARDIA
};

// --- 1. INICIALIZACIÓN (Punto de entrada único) ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. CARGA INMEDIATA: Lo que está en localStorage (Instantáneo)
    const savedState = localStorage.getItem('financiero_state');
    if (savedState) {
        const parsed = JSON.parse(savedState);
        AppState.movimientos = parsed.movimientos || [];
        AppState.categorias = parsed.categorias || [];
        // Refrescamos la UI de inmediato con lo que ya sabemos
        if (document.querySelector('.nav-active')) {
            refrescarVistaActual();
        }
    }

    // 2. CARGA DE INTERFAZ (El resto de tu lógica)
    await showSection('home');
    inicializarFiltros();

    // 3. ACTUALIZACIÓN EN SEGUNDO PLANO (Sin bloquear al usuario)
    // No usamos 'await' aquí para que la app no espere a que Sheets responda
    inicializarSincronizacion().then(() => {
        console.log("Datos actualizados desde servidor");
        // Guardamos en cache después de actualizar
        localStorage.setItem('financiero_state', JSON.stringify(AppState));
        // Refrescamos solo si es necesario
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

        // 5. Renderizado final
        requestAnimationFrame(() => {
            // A. Recuperar nombre de usuario
            const userDisplayEl = document.getElementById('user-display');
            if (userDisplayEl) userDisplayEl.innerText = localStorage.getItem('session_userName') || 'Soporte';

            // B. Re-iniciamos filtros
            if (typeof inicializarFiltros === 'function') inicializarFiltros();
            if (typeof configurarEventosFiltros === 'function') configurarEventosFiltros();

            setTimeout(() => {
                // C. FORZAR FECHA EN INPUTS (Aquí sí existe el DOM)
                if (sectionId === 'ingresos') {
                    const inputFecha = document.getElementById('in-fecha');
                    if (inputFecha) inputFecha.value = new Date().toISOString().split('T')[0];

                    // 🔥 FORZAR FILTRO A JULIO (Para que no inicie en Enero)
                    const mesSel = document.getElementById('in-mes');
                    if (mesSel) {
                        mesSel.value = new Date().getMonth(); // 6
                        AppState.filtrosActuales.mes = parseInt(mesSel.value);
                    }
                }

                // D. SINCRONIZACIÓN DE DATOS
                if (AppState.datosCache.length === 0 && typeof inicializarSincronizacion === 'function') {
                    inicializarSincronizacion().then(() => inicializarFuncionesPorSeccion(sectionId));
                } else {
                    inicializarFuncionesPorSeccion(sectionId);
                }

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
    if (sectionId === 'home') { 
        actualizarHome(); 
        actualizarFechaHeader(); 
    }
    if (sectionId === 'ingresos') { 
        actualizarSelectsCategorias(); 
        // Cambié 'cont-ingresos' por 'count-in' para que coincida con tu HTML
        actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in'); 
    }
    if (sectionId === 'gastos') { 
        actualizarSelectsCategorias(); 
        // Verifica si tu HTML de gastos tiene 'cont-gastos' o 'count-ex'
        actualizarListadoIndividual('gasto', 'lista-gastos', 'cont-gastos'); 
    }
    if (sectionId === 'analisis') { 
        actualizarResumen(); 
    }
    if (sectionId === 'ajustes') { 
        renderCategoriasConfig(); 
    }
}

function refrescarVistaActual() {
    const activeBtn = document.querySelector('.nav-active');
    if (!activeBtn) return;

    const seccionId = activeBtn.id;
    
    // Sincronizar filtros primero
    const mesSel = document.getElementById(seccionId === 'nav-ingresos' ? 'in-mes' : 'ex-mes');
    const añoSel = document.getElementById(seccionId === 'nav-ingresos' ? 'in-año' : 'ex-año');
    if (mesSel?.value) AppState.filtrosActuales.mes = parseInt(mesSel.value);
    if (añoSel?.value) AppState.filtrosActuales.año = parseInt(añoSel.value);

    // Pintar según la sección
    if (seccionId === 'nav-home') {
        console.log("Forzando actualización de Home...");
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