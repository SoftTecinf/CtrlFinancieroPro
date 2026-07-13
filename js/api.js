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
            Object.assign(AppState, JSON.parse(guardado));
            if (typeof actualizarHome === 'function') actualizarHome();
            if (typeof renderCategoriasConfig === 'function') renderCategoriasConfig();
        } catch (e) { console.error(e); }
    }

    // 2. SINCRONIZACIÓN (Servidor)
    try {
        const response = await fetch(API_URL);
        const data = await response.json(); // Se asume que tu doGet retorna { movimientos: [], categorias: [] }

        // Barrera de seguridad: Validar que la respuesta sea un objeto válido
        if (!data || typeof data !== 'object') return;

        // ACTUALIZAMOS EL ESTADO
        AppState.movimientos = data.movimientos || [];
        AppState.categorias = data.categorias || []; // <--- AÑADE ESTO

        // Guardamos todo en caché
        localStorage.setItem('financiero_state', JSON.stringify(AppState));
        
        // 3. ACTUALIZACIÓN DE UI
        if (typeof actualizarHome === 'function') actualizarHome();
        if (typeof renderCategoriasConfig === 'function') renderCategoriasConfig();
        
    } catch (err) {
        console.error("Error al sincronizar:", err);
    }
}