// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
const API_URL = "https://script.google.com/macros/s/AKfycbzvR903lBMnhRitzGVTj6E1XnIukpaOI7UZZM540_LX9Hdo7maew-vKKK-s_jDs7OGLvQ/exec";
let editandoId = null;
let chartH, chartR;

// --- ANCLAJE GLOBAL SEGURO ---
window.AppState = window.AppState || {
    movimientos: [],
    categorias: [],
    filtrosActuales: { mes: new Date().getMonth(), año: new Date().getFullYear() },
    cargado: false
};

window.EstadoFinanciero = window.EstadoFinanciero || { ingresos: 0, gastos: 0 };

// --- 1. INICIALIZACIÓN (Punto de entrada único) ---
document.addEventListener('DOMContentLoaded', async () => {
    setInterval(actualizarGraficoDistribucion, 500);
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
            if (sectionId === 'home') {
                // 1. Ejecutamos la lógica de refresco
                inicializarFuncionesPorSeccion(sectionId);

                // 2. FORZAMOS EL DIBUJO DEL GRÁFICO AQUÍ MISMO
                // Resetemos la bandera de carga para obligar a dibujar aunque el objeto crea que ya lo hizo
                window.ultimaCarga = { i: -1, g: -1 };

                setTimeout(() => {
                    if (typeof actualizarGraficoDistribucion === 'function') {
                        actualizarGraficoDistribucion();
                    }
                }, 200); // 200ms es un tiempo seguro para que el navegador ya haya "pintado" el canvas
            }
            else if (sectionId === 'ingresos') {
                const inputFecha = document.getElementById('in-fecha');
                if (inputFecha) inputFecha.value = new Date().toISOString().split('T')[0];

                const mesSel = document.getElementById('in-mes');
                if (mesSel) {
                    mesSel.value = new Date().getMonth();
                    AppState.filtrosActuales.mes = parseInt(mesSel.value);
                }
                inicializarFuncionesPorSeccion(sectionId);
            }
            else if (sectionId === 'gastos') {
                // ESTE BLOQUE ES PARA GASTOS
                const inputFecha = document.getElementById('ex-fecha');
                if (inputFecha) inputFecha.value = new Date().toISOString().split('T')[0];

                const mesSel = document.getElementById('ex-mes');
                if (mesSel) {
                    mesSel.value = new Date().getMonth();
                    AppState.filtrosActuales.mes = parseInt(mesSel.value);
                }
                inicializarFuncionesPorSeccion(sectionId);
            }

            // D. SINCRONIZACIÓN DE DATOS
            // Definimos las variables AQUÍ, en el mismo nivel que el resto de la función showSection
            const movs = AppState.movimientos || [];
            const cats = AppState.categorias || [];

            const faltanMovimientos = (movs.length === 0);
            const faltanCategorias = (cats.length === 0);

            setTimeout(() => {
                // Usamos las variables que ya declaramos arriba de forma segura
                if ((faltanMovimientos || faltanCategorias) && !AppState.cargado) {
                    inicializarSincronizacion().then(() => {
                        AppState.cargado = true;
                        // Solo renderizamos UNA VEZ cuando ya tenemos los datos frescos
                        inicializarFuncionesPorSeccion(sectionId);
                        if (typeof toggleLoading === 'function') toggleLoading(false);
                    });
                } else {
                    // Si ya estaban cargados, renderizamos normal
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
        console.log("⚠️ No se encontró la función para la sección:", idLimpio);
    }
}

function refrescarVistaActual() {
    const activeBtn = document.querySelector('.nav-active');
    if (!activeBtn) return;

    const seccionId = activeBtn.id; // ej: 'nav-gastos'

    // A. Pintar según la sección
    if (seccionId === 'nav-home') {
        actualizarHome();
    } else if (seccionId === 'nav-ingresos') {
        actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
    } else if (seccionId === 'nav-gastos') {
        const m = document.getElementById('ex-mes');
        const a = document.getElementById('ex-año');
        if (m) AppState.filtrosActuales.mes = parseInt(m.value);
        if (a) AppState.filtrosActuales.año = parseInt(a.value);
    }

    requestAnimationFrame(() => {
        // Solo llamamos a la función global, sin argumentos
        if (typeof window.actualizarGraficoDistribucion === 'function') {
            window.actualizarGraficoDistribucion();
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
window.formatearFechaMX = function(fechaString) {
    if (!fechaString) return "";
    const fecha = new Date(fechaString.includes('T') ? fechaString : `${fechaString}T00:00:00`);
    return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
};