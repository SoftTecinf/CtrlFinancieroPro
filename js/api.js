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
    // 1. CARGA INICIAL (Rápida desde LocalStorage)
    if (AppState.movimientos.length > 0 && AppState.categorias.length > 0 && AppState.cargado) {
        return; 
    }
    const guardado = localStorage.getItem('financiero_state');
    if (guardado) {
        try {
            const cache = JSON.parse(guardado);
            Object.assign(AppState, cache);
            console.log("Cargado desde caché...");
            // Renderizamos inmediato para que el usuario vea algo al abrir
            if (typeof actualizarHome === 'function') actualizarHome();
        } catch (e) { console.error("Error al leer caché:", e); }
    }

    // 2. SINCRONIZACIÓN (Fresca desde la red)
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (!data || typeof data !== 'object') return;

        // Actualizamos estado
        if (data.movimientos) AppState.movimientos = data.movimientos;
        if (data.categorias) AppState.categorias = data.categorias;

        // Guardamos nuevo estado
        localStorage.setItem('financiero_state', JSON.stringify(AppState));
        
        console.log("Sincronización completa. Refrescando UI...");

        // 3. ACTUALIZACIÓN FINAL DE UI
        if (typeof actualizarHome === 'function') actualizarHome();
        if (typeof renderCategoriasConfig === 'function') renderCategoriasConfig();
        
    } catch (err) {
        console.error("Error al sincronizar con red:", err);
    }
}