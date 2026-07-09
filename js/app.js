// --- URL DE GOOGLE APPS SCRIPT ---
const API_URL = "https://script.google.com/macros/s/AKfycby7qsVqL6ufthtYSi-A7LKUs7i7yy8joqyKp7-wNxGinuFym8C4GL8R44EnkDzRAEJyog/exec";
let editandoId = null;
let movimientos = [];
let categorias = [];
let chartH, chartR, seccionActual = 'home';
const fMXN = (v) => v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

// 2. Validación de Sesión (Lo primero que se ejecuta)
document.addEventListener('DOMContentLoaded', async () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    if (!isLoggedIn && !window.location.pathname.includes('login.html')) {
        window.location.href = "./login.html";
        return;
    }

    showSection('home');
    
    // Esperamos a que la sincronización termine antes de intentar refrescar la vista
    try {
        await inicializarSincronizacion(); 
        console.log("Sincronización completada. Refrescando vista...");
        refrescarVistaActual();
    } catch (error) {
        console.error("Error al inicializar los datos:", error);
    }
});

// --- 1. SECCIÓN DE NAVEGACIÓN ---
function showSection(sectionId) {
    const container = document.getElementById('app-container');
    if (!container) {
        console.error("ERROR: No se encontró el elemento 'app-container'");
        return;
    }

    // 1. UI: Botones activos
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('nav-active'));
    const activeBtn = document.getElementById(`nav-${sectionId}`);
    if (activeBtn) activeBtn.classList.add('nav-active');

    // 2. Cargar HTML
    
    fetch(`${sectionId}.html`) 
        .then(response => {
            if (!response.ok) throw new Error(`No se pudo cargar: ${sectionId}.html`);
            return response.text();
        })
        .then(html => {
            // 3. Inyectar contenido en el contenedor específico
            container.innerHTML = html;
            
            // 4. Inicializar lógica de la nueva vista
            if (typeof inicializarFuncionesPorSeccion === 'function') {
                inicializarFuncionesPorSeccion(sectionId);
            }
            
        })
        .catch(error => {
            console.error("Error al cargar la sección:", error);
            container.innerHTML = `<p style="padding: 20px; color: red;">Error al cargar la sección ${sectionId}. Verifica el nombre del archivo.</p>`;
        });
}

// Función auxiliar para mantener el código limpio
function inicializarFuncionesPorSeccion(sectionId) {
    switch(sectionId) {
        case 'home':
            actualizarHome();
            actualizarFechaHeader();
            break;
        case 'ingresos':
            actualizarSelectsCategorias();
            actualizarListadoIndividual('ingreso', 'lista-ingresos', 'cont-ingresos');
            break;
        case 'gastos':
            actualizarSelectsCategorias();
            actualizarListadoIndividual('gasto', 'lista-gastos', 'cont-gastos');
            break;
        case 'analisis':
            actualizarResumen();
            break;
        case 'ajustes':
            renderCategoriasConfig();
            break;
    }
}

// --- 2. SECCIÓN DE LÓGICA DE DATOS ---
function refrescarVistaActual() {
    // 1. Pintamos lo que siempre necesitamos
    if (typeof actualizarSelectsCategorias === "function") {
        actualizarSelectsCategorias();
    }
    
    // 2. FORZAR actualización de la sección que realmente está visible
    // Buscamos cuál sección tiene display block o está activa
    const secciones = ['home', 'ingresos', 'gastos', 'resumen', 'config'];
    
    secciones.forEach(sec => {
        const elemento = document.getElementById(`sec-${sec}`);
        // Verificamos si el elemento existe y está visible
        if (elemento && window.getComputedStyle(elemento).display !== 'none') {
            // Si está visible, ejecutamos su lógica de dibujo
            if (sec === 'ingresos') actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
            if (sec === 'home') actualizarHome();
            if (sec === 'gastos') actualizarListadoIndividual('gasto', 'lista-gastos', 'count-ex');
            if (sec === 'resumen') actualizarResumen();
            if (sec === 'config') renderCategoriasConfig();
        }
    });
}

// --- VERIFICACIÓN DE SESIÓN AL CARGAR EL PANEL (BLINDADO) ---
window.onload = function () {
    const userDisplayEl = document.getElementById('user-display');
    const fechaSistemaEl = document.getElementById('fecha-sistema');

    // Si NO existe el contenedor de usuario, asumimos que estamos en login.html
    if (!userDisplayEl) {
        //console.log("Modo Login detectado: Saltando verificaciones del panel principal.");
        return; // Detiene la ejecución aquí de forma segura
    }

    // Si SÍ existe, ejecutamos la lógica normal del panel principal (index.html):
    if (typeof actualizarFechaHeader === "function" && fechaSistemaEl) {
        actualizarFechaHeader();
    }

    const usuarioActivo = localStorage.getItem('session_user');
    const userNameActivo = localStorage.getItem('session_userName');

    if (!usuarioActivo || !userNameActivo) {
        window.location.href = "./login.html";
    } else {
        userDisplayEl.innerText = userNameActivo;

        if (typeof inicializarSincronizacion === "function") {
            inicializarSincronizacion();
        }
    }
}


