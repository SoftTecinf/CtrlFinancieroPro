// --- URL DE GOOGLE APPS SCRIPT ---
const API_URL = "https://script.google.com/macros/s/AKfycby7qsVqL6ufthtYSi-A7LKUs7i7yy8joqyKp7-wNxGinuFym8C4GL8R44EnkDzRAEJyog/exec";
let editandoId = null;
let movimientos = [];
let categorias = [];
let chartH, chartR, seccionActual = 'home';
const fMXN = (v) => v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

// 2. Validación de Sesión (Lo primero que se ejecuta)
document.addEventListener('DOMContentLoaded', () => {
    const isLoggedIn = localStorage.getItem('isLoggedIn');

    // 1. PRIMERO: Control de acceso
    if (!isLoggedIn && !window.location.pathname.includes('login.html')) {
        window.location.href = "./login.html";
        return;
    }

    // 2. SEGUNDO: Inicializar la vista por defecto
    // Esto asegura que la página tenga algo que mostrar apenas carga
    showSection('home');
    
    // 3. TERCERO: Iniciar la carga de datos (Google Sheets)
    inicializarSincronizacion(); 
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
    
    // 2. Según la sección, llamamos a la función de dibujo
    if (seccionActual === 'home') actualizarHome();
    if (seccionActual === 'ingresos') actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
    if (seccionActual === 'gastos') actualizarListadoIndividual('gasto', 'lista-gastos', 'count-ex');
    if (seccionActual === 'resumen') actualizarResumen();
    if (seccionActual === 'config') renderCategoriasConfig();
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


