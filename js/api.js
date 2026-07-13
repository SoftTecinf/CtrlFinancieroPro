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

// En api.js, dentro de inicializarSincronizacion
async function inicializarSincronizacion() {
    // 1. CARGA INSTANTÁNEA (Caché)
    const guardado = localStorage.getItem('financiero_state');
    if (guardado) {
        try {
            const estadoLocal = JSON.parse(guardado);
            Object.assign(AppState, estadoLocal);
            
            // Refrescar UI con caché
            if (typeof actualizarHome === 'function') actualizarHome();
            if (typeof renderCategoriasConfig === 'function') renderCategoriasConfig();
        } catch (e) { console.error("Error al leer caché:", e); }
    }

    // 2. SINCRONIZACIÓN (Servidor)
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        // 1. Validar que la respuesta tenga datos antes de tocar el AppState
        if (data && data.movimientos) AppState.movimientos = data.movimientos;
        if (data && data.categorias) AppState.categorias = data.categorias;

        localStorage.setItem('financiero_state', JSON.stringify(AppState));

        // 2. Ejecutar renderizados solo si existen
        if (typeof actualizarHome === 'function') actualizarHome();
        if (typeof renderCategoriasConfig === 'function') renderCategoriasConfig();
        
    } catch (err) {
        console.error("Error crítico en sincronización:", err);
    }async function inicializarSincronizacion() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (!data || typeof data !== 'object') return;

        // ACTUALIZAMOS EL ESTADO (Plural siempre)
        if (data.movimientos) {
            AppState.movimientos = data.movimientos;
            console.log("Movimientos cargados:", AppState.movimientos.length);
        }
        
        if (data.categorias) {
            AppState.categorias = data.categorias;
            console.log("Categorías cargadas:", AppState.categorias.length);
        }

        localStorage.setItem('financiero_state', JSON.stringify(AppState));
        
        // ACTUALIZACIÓN DE UI (Protegida)
        if (typeof actualizarHome === 'function') actualizarHome();
        if (typeof renderCategoriasConfig === 'function') renderCategoriasConfig();
        
    } catch (err) {
        console.error("Error al sincronizar:", err);
    }
}
}