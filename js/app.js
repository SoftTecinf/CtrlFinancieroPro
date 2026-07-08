

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
    iniciarSincronizacion(); 
});

// --- 1. SECCIÓN DE NAVEGACIÓN ---
function showSection(id) {
    seccionActual = id;
    
    // Ocultar y mostrar secciones
    document.querySelectorAll('section').forEach(s => s.classList.add('hidden-section'));
    document.getElementById(`sec-${id}`).classList.remove('hidden-section');
    
    // Cambiar subtítulo
    const nombres = { 'home': 'Inicio', 'ingresos': 'Ingresos', 'gastos': 'Gastos', 'resumen': 'Análisis', 'config': 'Configuración' };
    document.getElementById('subtitulo-seccion').innerText = " / " + nombres[id];
    
    // Cambiar estado de botones
    document.querySelectorAll('#main-nav button').forEach(btn => btn.classList.remove('nav-active'));
    document.getElementById(`nav-${id}`).classList.add('nav-active');
    
    // ¡EL PUENTE! Aquí llamas a la otra función para que sepa qué hacer
    refrescarVistaActual();
}

// --- 2. SECCIÓN DE LÓGICA DE DATOS ---
function refrescarVistaActual() {
    // Si no hay datos, salimos para no romper nada
    if (movimientos.length === 0 && categorias.length === 0) {
        console.warn("Esperando datos...");
        return; 
    }
    
    // Pintamos lo que siempre necesitamos
    actualizarSelectsCategorias();
    
    // Según la variable 'seccionActual' que definió el Director (showSection), actuamos
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

