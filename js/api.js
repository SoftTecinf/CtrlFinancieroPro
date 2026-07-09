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
    // 1. Mostrar carga si es necesario
    if (typeof toggleLoading === 'function') toggleLoading(true);

    try {
        const res = await FetchAPI("obtenerDatos", {});

        if (!res) throw new Error("El servidor no respondió nada.");

        if (res.success) {
            // 2. ACTUALIZAMOS EL ESTADO GLOBAL (AppState)
            // Esto es lo que permite que los datos sobrevivan al cambio de vista
            AppState.datosCache = res.movimientos;
            
            // También mantenemos tus variables globales por compatibilidad
            movimientos = res.movimientos;
            categorias = res.categorias;

            inicializarFiltros();
            refrescarVistaActual();
        } else {
            console.error("Error en sincronización:", res.message);
            alert("No se pudieron cargar los datos: " + res.message);
        }
    } catch (err) {
        console.error("Error crítico:", err);
        // Evitar dejar la app bloqueada si falla el fetch
    } finally {
        if (typeof toggleLoading === 'function') toggleLoading(false);
    }
}