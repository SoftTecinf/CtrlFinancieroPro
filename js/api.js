// --- ENVIAR DATOS A APPS SCRIPT ---
async function FetchAPI(action, extraData = {}) {
    toggleLoading(true);
    // 1. Preparamos el objeto con la acción y los datos extra
    const payload = {
        action: action,
        ...extraData
    };
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                // Forzamos explícitamente texto plano para evadir el preflight
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload),
            redirect: 'follow' // Crucial para Google Apps Script
        });

        // 2. Intentamos parsear la respuesta
        const data = await response.json();

        if (!data.success) {
            alert("Error: " + (data.message || "Sin mensaje de error"));
        }
        return data;

    } catch (error) {
        console.error("Error en la petición:", error);
        // Este alert es justo el que estabas viendo en tu pantalla
        alert("Error de conexión con Google Sheets.");
        return { success: false };
    } finally {
        toggleLoading(false);
    }
}

async function inicializarSincronizacion() {
    // Si la petición tarda más de 1 segundo, mostramos un pequeño aviso
    const timer = setTimeout(() => {
        const msg = document.getElementById('status-msg');
        if (msg) msg.innerText = "Sincronizando con la nube...";
    }, 1000);

    try {
        const res = await FetchAPI("obtenerDatos", {});
        if (res && res.success) {
            AppState.datosCache = res.movimientos;
            localStorage.setItem('financiero_cache', JSON.stringify(res.movimientos));
            refrescarVistaActual();
        }
    } finally {
        clearTimeout(timer);
        const msg = document.getElementById('status-msg');
        if (msg) msg.innerText = ""; // Limpiamos el aviso
    }
}