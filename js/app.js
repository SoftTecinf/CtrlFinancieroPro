// --- CONFIGURACIÓN Y ESTADO GLOBAL ---
const API_URL = "https://script.google.com/macros/s/AKfycbzvR903lBMnhRitzGVTj6E1XnIukpaOI7UZZM540_LX9Hdo7maew-vKKK-s_jDs7OGLvQ/exec";
let editandoId = null;
let chartH, chartR;
// En el nivel más alto de app.js
//let ingM = 40800;
//let gasM = 0;

// app.js
window.AppState = {
    movimientos: [],
    categorias: [],
    filtrosActuales: { 
        busqueda: '', 
        categoria: 'todos', 
        mes: new Date().getMonth(), // Usamos la fecha actual solo si no hay nada guardado
        año: new Date().getFullYear() 
    },
    cargado: false
};

// --- 1. INICIALIZACIÓN (Punto de entrada único) ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. INTENTAR RECUPERAR
    const ahora = new Date();
    const savedState = localStorage.getItem('financiero_state');
    

    if (savedState) {
        try {
            const parsed = JSON.parse(savedState);
            // Solo sobrescribimos si el localStorage tiene datos válidos
            if (parsed.movimientos) window.AppState.movimientos = parsed.movimientos;
            if (parsed.filtrosActuales) window.AppState.filtrosActuales = parsed.filtrosActuales;
            // ¡IMPORTANTE! No tocamos los filtros si no están en el guardado
        } catch (e) {
            console.error("Error al recuperar estado:", e);
        }
    }

    // 2. APLICAR VALORES POR DEFECTO SOLO SI NO EXISTEN
    // Si después de intentar recuperar, el mes sigue siendo null, entonces sí, usamos 'ahora'
    if (!window.AppState.filtrosActuales.mes) {
        window.AppState.filtrosActuales.mes = ahora.getMonth();
    }
    if (!window.AppState.filtrosActuales.año) {
        window.AppState.filtrosActuales.año = ahora.getFullYear();
    }

    // 3. UI
    await showSection('home');
    refrescarVistaActual();

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
    // 1. SIEMPRE actualizar los indicadores globales (Home, Hoy, Ingresos/Gastos Mes)
    // Esto asegura que donde sea que estés, los valores estén correctos
    if (typeof actualizarHome === 'function') {
        actualizarHome();
    }

    // 2. Lógica específica por sección
    const activeBtn = document.querySelector('.nav-active');
    if (!activeBtn) return;

    const seccionId = activeBtn.id;

    if (seccionId === 'nav-ingresos') {
        actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
    } else if (seccionId === 'nav-gastos') {
        // Actualizamos filtros de estado si existen los selects
        const m = document.getElementById('ex-mes');
        const a = document.getElementById('ex-año');
        if (m) window.AppState.filtrosActuales.mes = parseInt(m.value);
        if (a) window.AppState.filtrosActuales.año = parseInt(a.value);
        
        // ¡Importante! Aseguramos que la lista de gastos se actualice
        actualizarListadoIndividual('gasto', 'lista-gastos', 'count-ex');
    }

    // 3. Gráficos
    requestAnimationFrame(() => {
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