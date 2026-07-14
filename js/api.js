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

let estaSincronizando = false; // Bandera global

async function inicializarSincronizacion() {
    // Si ya estamos sincronizando, no hagamos nada
    if (estaSincronizando) return; 
    estaSincronizando = true;

    // 1. CARGA INICIAL (Rápida desde LocalStorage)
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
        // En lugar de fetch directo, usa tu función FetchAPI si ya la tienes
        // para asegurar que los headers y el método sean correctos
        const data = await FetchAPI("obtenerDatos", {}); 

        if (data && data.success) {
            AppState.movimientos = data.movimientos;
            AppState.categorias = data.categorias;
            localStorage.setItem('financiero_state', JSON.stringify(AppState));
            
            // Solo refresca si realmente hubo un cambio
            refrescarVistaActual();
        }
    } catch (err) {
        console.error("Error al sincronizar:", err);
    } finally {
        estaSincronizando = false; // Liberamos para futuras peticiones
    }
}