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
    
    // Ruta al archivo, asegúrate de que esté en la misma carpeta
    fetch(`${sectionId}.html`) 
        .then(response => {
            if (!response.ok) throw new Error('No se pudo cargar la página');
            return response.text();
        })
        .then(html => {
            container.innerHTML = html;
            console.log(`Contenido de ${sectionId}.html cargado.`);
            
            // UNA VEZ CARGADO EL HTML, LLAMAMOS A SUS FUNCIONES
            if (sectionId === 'home') {
                actualizarHome();
                actualizarFechaHeader();
            }
            // Puedes agregar aquí otras funciones según la sección
        })
        .catch(error => {
            console.error("Error:", error);
            container.innerHTML = `<p>Error al cargar la sección ${sectionId}</p>`;
        });
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
    
    console.log("Vista refrescada, total movimientos:", movimientos.length);
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

