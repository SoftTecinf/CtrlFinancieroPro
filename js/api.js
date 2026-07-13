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
    // 1. CARGA INSTANTÁNEA: Leemos el caché guardado de inmediato
    const guardado = localStorage.getItem('financiero_state');
    
    if (guardado) {
        try {
            Object.assign(AppState, JSON.parse(guardado));
            // Pintamos la pantalla con lo que ya tenemos guardado
            if (typeof actualizarHome === 'function') actualizarHome();
            if (typeof refrescarVistaActual === 'function') refrescarVistaActual();
        } catch (e) {
            console.error("Error al parsear el localStorage inicial:", e);
        }
    }

    // 2. SINCRONIZACIÓN EN SEGUNDO PLANO
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        // Extraemos la lista de movimientos de forma segura
        let lista = data.movimientos || data;
        
        // Si la API devolvió un objeto extraño en lugar de un arreglo, intentamos rescatarlo
        if (lista && !Array.isArray(lista) && typeof lista === 'object') {
            lista = Object.values(lista);
        }

        // BARRERA DE SEGURIDAD CRUCIAL:
        // Si por alguna razón NO es un arreglo válido o viene vacío, ABORTAMOS.
        // Jamás limpiaremos el caché si la respuesta del servidor es errónea.
        if (!Array.isArray(lista) || lista.length === 0) {
            console.warn("⚠️ La API no devolvió registros nuevos válidos. Se mantiene el caché actual.");
            return; // Salimos de la función sin sobreescribir el localStorage
        }
        
        // Si pasamos la barrera, filtramos los datos frescos
        const datosFiltrados = lista.filter(m => m && m.monto !== undefined && m.fecha !== undefined);

        if (datosFiltrados.length > 0) {
            // Actualizamos el caché local de forma segura
            AppState.datosCache = datosFiltrados;

            // Guardamos los datos más frescos en el almacenamiento local
            localStorage.setItem('financiero_state', JSON.stringify(AppState));
            
            // 3. ACTUALIZACIÓN DE PANTALLA: Refrescamos la UI con lo nuevo de Google Sheets
            if (typeof actualizarHome === 'function') actualizarHome();
            if (typeof refrescarVistaActual === 'function') refrescarVistaActual();
        }
        
    } catch (err) {
        // Si falla el internet o Google Sheets tarda de más, la app sigue funcionando con el caché
        console.error("❌ Error al sincronizar con Google Sheets en segundo plano:", err);
    }
}