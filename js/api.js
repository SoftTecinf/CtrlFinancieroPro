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
const state = window.AppState; 

    if (!state) return;

    // 1. CARGA INICIAL (Caché)
    const guardado = localStorage.getItem('financiero_state');
    if (guardado) {
        try {
            const cache = JSON.parse(guardado);
            state.movimientos = cache.movimientos || [];
            state.categorias = cache.categorias || [];
        } catch (e) { console.error("Error al leer caché:", e); }
    }

    // 2. SINCRONIZACIÓN (Red)
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (data && typeof data === 'object') {
            if (data.movimientos) state.movimientos = data.movimientos;
            if (data.categorias) state.categorias = data.categorias;
            state.cargado = true;
            localStorage.setItem('financiero_state', JSON.stringify(state));
        }
    } catch (err) {
        console.error("Error al sincronizar con red:", err);
        // Aquí podrías lanzar un aviso al usuario si la red falla
    }

        localStorage.setItem('financiero_state', JSON.stringify(state));
        
        // 3. ACTUALIZACIÓN FINAL DE UI
        if (typeof actualizarHome === 'function') actualizarHome();
        if (typeof renderCategoriasConfig === 'function') renderCategoriasConfig();
        
    } catch (err) {
        console.error("Error al sincronizar con red:", err);
    }
}