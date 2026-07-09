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
    // Cambiamos FetchAPI para asegurarnos de capturar el error
    const res = await FetchAPI("obtenerDatos", {});

    // Si res es null o undefined, el problema está en la conexión o el backend
    if (!res) {
        alert("Error crítico: El servidor no respondió nada.");
        return;
    }

    if (res.success) {
        movimientos = res.movimientos;
        categorias = res.categorias;

        inicializarFiltros();
        refrescarVistaActual();
    } else {
        // AQUÍ CAPTURAMOS EL ERROR DEL SERVIDOR
        console.error("Error en sincronización:", res.message);
        alert("No se pudieron cargar los datos: " + res.message);
    }
}

