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
    // 1. CARGA INSTANTÁNEA: Leemos el caché guardado
    const guardado = localStorage.getItem('financiero_state');
    if (guardado) {
        // 🔥 SOLUCIÓN AQUÍ: Inyectamos los datos en lugar de reemplazar la constante
        Object.assign(AppState, JSON.parse(guardado));
        
        // Pintamos la pantalla de inicio y la vista actual de inmediato
        if (typeof actualizarHome === 'function') actualizarHome();
        if (typeof refrescarVistaActual === 'function') refrescarVistaActual();
        console.log("Carga instantánea desde caché lista.");
    }

    // 2. SINCRONIZACIÓN SILENCIOSA: Vamos a Google Sheets en segundo plano
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        let lista = data.movimientos || data;
        if (!Array.isArray(lista)) {
            lista = []; 
        }
        
        AppState.datosCache = lista.filter(m => m && m.monto !== undefined && m.fecha !== undefined);

        // Guardamos los datos más frescos en el almacenamiento
        localStorage.setItem('financiero_state', JSON.stringify(AppState));
        
        // 3. ACTUALIZACIÓN INVISIBLE: Refrescamos la pantalla con los datos nuevos
        if (typeof actualizarHome === 'function') actualizarHome();
        if (typeof refrescarVistaActual === 'function') refrescarVistaActual();
        
        //console.log("✅ Sincronización en segundo plano completada con éxito.");
        
    } catch (err) {
        console.error("❌ Error al sincronizar con Google Sheets:", err);
    }
}