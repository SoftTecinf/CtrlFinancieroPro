// --- URL DE GOOGLE APPS SCRIPT ---
const API_URL = "https://script.google.com/macros/s/AKfycby7qsVqL6ufthtYSi-A7LKUs7i7yy8joqyKp7-wNxGinuFym8C4GL8R44EnkDzRAEJyog/exec";
let editandoId = null;
let movimientos = [];
let categorias = [];
let chartH, chartR, seccionActual = 'home';
const fMXN = (v) => v.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });

// 2. Validación de Sesión (Lo primero que se ejecuta)
document.addEventListener('DOMContentLoaded', async () => {
    const appContainer = document.getElementById('app-container');
    
    if (!appContainer) {
        console.log("Página de login detectada.");
        return;
    }

    try {
        // 1. Cargamos la vista inicial (ejemplo: 'home')
        // Esto inyecta el HTML dentro de app-container
        await showSection('home'); 

        // 2. Ahora que el HTML existe, inicializamos datos y refrescamos
        if (typeof inicializarSincronizacion === "function") {
            await inicializarSincronizacion();
            refrescarVistaActual();
            console.log("Sistema listo.");
        }
    } catch (err) {
        console.error("Error crítico de carga:", err);
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
            // AHORA llamamos a la función específica de esta sección
            if (sectionId === 'config') {
                renderCategoriasConfig(); // Muebles puestos solo en la habitación correcta
            }
            if (sectionId === 'ingresos') {
                actualizarListadoIndividual('ingreso', 'lista-ingresos', 'count-in');
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


