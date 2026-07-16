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

        /*if (!data.success) {
            alert("Error: " + (data.message || "Sin mensaje de error"));
        }*/
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
    // Usar window.AppState para garantizar acceso global
    const state = window.AppState; 

    // PROTECCIÓN: Si por algún motivo no existe, inicialízalo vacío
    if (!state) {
        console.error("AppState no está inicializado.");
        return;
    }

    // 1. CARGA INICIAL (Rápida desde LocalStorage)
    if (state.movimientos.length > 0 && state.categorias.length > 0 && state.cargado) {
        return; 
    }
    
    const guardado = localStorage.getItem('financiero_state');
    if (guardado) {
        try {
            const cache = JSON.parse(guardado);
            // Asignación explícita para evitar errores de referencia
            state.movimientos = cache.movimientos || [];
            state.categorias = cache.categorias || [];
            
            if (typeof actualizarHome === 'function') actualizarHome();
        } catch (e) { console.error("Error al leer caché:", e); }
    }

    // 2. SINCRONIZACIÓN (Fresca desde la red)
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (!data || typeof data !== 'object') return;

        // Actualizamos estado global
        if (data.movimientos) state.movimientos = data.movimientos;
        if (data.categorias) state.categorias = data.categorias;
        state.cargado = true; // Marcamos como cargado

        localStorage.setItem('financiero_state', JSON.stringify(state));
        
        // 3. ACTUALIZACIÓN FINAL DE UI
        if (typeof actualizarHome === 'function') actualizarHome();
        if (typeof renderCategoriasConfig === 'function') renderCategoriasConfig();
        
    } catch (err) {
        console.error("Error al sincronizar con red:", err);
    }
}