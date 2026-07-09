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
    try {
        const res = await FetchAPI("obtenerDatos", {});
        if (res && res.success) {
            AppState.datosCache = res.movimientos;
            
            // GUARDAMOS TODO EL ESTADO PARA QUE NO SE PIERDAN FILTROS
            localStorage.setItem('financiero_state', JSON.stringify({
                movimientos: AppState.datosCache,
                filtros: AppState.filtrosActuales
            }));
            
            refrescarVistaActual();
        }
    } catch (err) {
        console.error("Error sincronizando:", err);
    }
}