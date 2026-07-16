window.EstadoFinanciero = {
    ingresos: 0,
    gastos: 0,
    ultimaCarga: { i: -1, g: -1 }
};

async function guardarRegistro(tipo) {
    let btn = document.querySelector(`#sec-${tipo}s button[onclick^="guardarRegistro"]`);
    if (!btn) return;

    const pref = tipo === 'ingreso' ? 'in' : 'ex';
    const monto = parseFloat(document.getElementById(`${pref}-monto-hidden`).value);

    if (!monto || monto <= 0) {
        alert("Por favor ingresa un monto válido.");
        return;
    }

    const idMovi = window.editandoId || Date.now();
    const nuevaData = {
        id: idMovi,
        tipo,
        fecha: document.getElementById(`${pref}-fecha`).value,
        cat: document.getElementById(`${pref}-categoria`).value,
        desc: document.getElementById(`${pref}-desc`).value.trim().toUpperCase() || 'SIN NOMBRE',
        monto
    };

    const esEdicion = !!window.editandoId;
    const estadoAnterior = JSON.stringify(AppState.movimientos);

    if (esEdicion) {
        const idx = AppState.movimientos.findIndex(m => m.id == idMovi);
        if (idx !== -1) AppState.movimientos[idx] = nuevaData;
    } else {
        AppState.movimientos.push(nuevaData);
    }

    localStorage.setItem("financiero_state", JSON.stringify(AppState));
    refrescarVistaActual();

    const textoOriginal = btn.innerText;
    btn.disabled = true;
    btn.innerText = "PROCESANDO...";
    btn.classList.add('opacity-70');

    try {
        const res = await FetchAPI("guardarMovimiento", { data: nuevaData });
        if (!res.success) throw new Error(res.message);

        if (esEdicion) window.editandoId = null;
        alert("Proceso éxitoso.");
        limpiarFormulario(tipo);
    } catch (error) {
        console.error("Error:", error);
        AppState.movimientos = JSON.parse(estadoAnterior);
        localStorage.setItem("financiero_state", JSON.stringify(AppState));
        refrescarVistaActual();
        alert("No se pudo guardar: " + error.message);
        btn.innerText = textoOriginal;
    } finally {
        btn.disabled = false;
        btn.classList.remove('opacity-70');
    }
}

function limpiarFormulario(tipo) {
    const pref = tipo === 'ingreso' ? 'in' : 'ex';

    // Lista de campos específicos
    const campos = [`${pref}-categoria`, `${pref}-desc`, `${pref}-monto-mask`, `${pref}-monto-hidden`];

    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = (id.includes('hidden')) ? 0 : "";
    });

    window.editandoId = null;

    // Limpieza de estados visuales del botón
    const btn = document.querySelector(`#sec-${tipo}s button[onclick^="guardarRegistro"]`);
    if (btn) {
        btn.innerText = tipo === 'ingreso' ? "GUARDAR REGISTRO" : "REGISTRAR EGRESO";
        btn.classList.remove('ring-4', 'ring-amber-100', 'bg-amber-600', 'opacity-70');
        btn.disabled = false;
    }
}

async function eliminarMovimiento(id) {
    if (!confirm("¿Deseas eliminar este registro de forma permanente?")) return;

    // 1. Guardamos estado previo para revertir si algo falla
    const estadoAnterior = JSON.stringify(AppState.movimientos);

    // 2. ACTUALIZACIÓN OPTIMISTA: Borramos de la memoria inmediatamente
    AppState.movimientos = AppState.movimientos.filter(m => m.id !== id);
    localStorage.setItem("financiero_state", JSON.stringify(AppState));
    refrescarVistaActual(); // La UI se limpia al instante

    try {
        // 3. Petición al servidor
        const res = await FetchAPI("eliminarMovimiento", { id });

        if (!res || !res.success) {
            throw new Error(res?.message || "Error al conectar con el servidor");
        }

        alert("Eliminado con éxito.");
    } catch (error) {
        // 4. REVERSIÓN SI FALLA
        console.error("Error al eliminar:", error);
        AppState.movimientos = JSON.parse(estadoAnterior);
        localStorage.setItem("financiero_state", JSON.stringify(AppState));
        refrescarVistaActual();
        alert("No se pudo eliminar el registro: " + error.message);
    }

}

async function agregarCategoria() {
    const inputNombre = document.getElementById('nueva-cat-nombre');
    const nom = inputNombre.value.trim().toUpperCase();
    const tipo = document.getElementById('nueva-cat-tipo').value;

    if (!nom) return;

    // 1. CREAMOS EL OBJETO DE MANERA OPTIMISTA
    const nuevaCat = { id: Date.now(), nombre: nom, tipo };

    // 2. ACTUALIZAMOS LA MEMORIA Y LA INTERFAZ AL INSTANTE (0 ms)
    AppState.categorias.push(nuevaCat);
    renderCategoriasConfig(); // Actualiza el DOM inmediatamente
    inputNombre.value = '';   // Limpiamos el input

    // 3. ENVIAMOS AL SERVIDOR EN SEGUNDO PLANO (No bloqueamos al usuario)
    try {
        const res = await FetchAPI("agregarCategoria", nuevaCat);

        if (res.success) {
            console.log("Categoría sincronizada con éxito en Google Sheets.");
            // Opcional: Si el ID real viene de Google, podrías actualizarlo aquí, 
            // pero para una lista simple, Date.now() es suficiente.
        } else {
            throw new Error(res.message);
        }
    } catch (error) {
        // 4. REVERSIÓN SI FALLA (Manejo de errores)
        console.error("Error al guardar, revirtiendo cambios...", error);
        AppState.categorias = AppState.categorias.filter(c => c.id !== nuevaCat.id);
        renderCategoriasConfig();
        alert("Hubo un error al guardar en la nube. Intenta de nuevo.");
    }
}

async function eliminarCategoria(id) {
    if (!confirm("¿Deseas borrar esta categoría?")) return;

    const estadoAnterior = [...AppState.categorias];
    AppState.categorias = AppState.categorias.filter(c => c.id !== id);
    renderCategoriasConfig();

    try {
        const res = await FetchAPI("eliminarCategoria", { id });

        // 🔥 MODIFICACIÓN AQUÍ: Si res es null o no es lo que esperamos
        if (!res || !res.success) {
            console.error("Respuesta del servidor:", res); // <-- Mira esto en la consola
            throw new Error(res ? res.message : "Error de conexión");
        }
    } catch (error) {
        console.error("Error al eliminar:", error);
        AppState.categorias = estadoAnterior;
        renderCategoriasConfig();
        // 🔥 AQUÍ VEREMOS EL ERROR REAL
        alert("No se pudo eliminar: " + error.message);
    }
}

function prepararEdicion(id, tipo) {
    const mov = AppState.movimientos.find(m => m.id === id);
    if (!mov) return;

    window.editandoId = id;
    const pref = tipo === 'ingreso' ? 'in' : 'ex';

    // 1. Fecha
    const fechaObj = new Date(mov.fecha);
    document.getElementById(`${pref}-fecha`).value = fechaObj.toISOString().split('T')[0];

    // 2. Categoría - DECLARAMOS 'selectCat' SOLO UNA VEZ
    // --- NUEVA PRUEBA PARA LA CATEGORÍA ---
    const selectCat = document.getElementById(`${pref}-categoria`);

    // Forzamos un pequeño retraso para asegurar que el DOM esté listo
    setTimeout(() => {
        selectCat.value = mov.cat;

        // Si sigue sin seleccionarse, el valor no existe en la lista
        if (selectCat.value !== mov.cat) {
            console.warn("¡Cuidado! No se pudo asignar el valor. ¿Está en la lista de opciones?");
        }
    }, 200);

    // 3. Descripción y Monto
    document.getElementById(`${pref}-desc`).value = mov.desc;
    const mask = document.getElementById(`${pref}-monto-mask`);
    const hidden = document.getElementById(`${pref}-monto-hidden`);

    if (mask && hidden) {
        hidden.value = mov.monto;
        mask.value = Number(mov.monto).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    }

    // 4. Feedback
    const btn1 = document.querySelector(`#sec-${tipo}s button[onclick^="guardarRegistro"]`);
    if (btn1) {
        btn1.innerText = "ACTUALIZAR REGISTRO";
        btn1.classList.add('ring-4', 'ring-amber-100', 'bg-amber-600');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 1. ANCLA GLOBAL: Definimos el estado si no existe
window.EstadoFinanciero = window.EstadoFinanciero || { ingresos: 0, gastos: 0 };
window.chartH = window.chartH || null;
window.ultimaCarga = { i: -1, g: -1 };

window.actualizarGraficoDistribucion = function() {
    // 1. BUSCAR CANVAS
    const canvas = document.getElementById('chartHome');
    if (!canvas) return; // Si no estamos en Home, no hacemos nada.

    // 2. LEER ESTADO
    const ingresos = window.EstadoFinanciero?.ingresos || 0;
    const gastos = window.EstadoFinanciero?.gastos || 0;

    // 3. FILTRO DE CAMBIOS
    if (window.ultimaCarga.i === ingresos && window.ultimaCarga.g === gastos) return;
    
    // 4. DESTRUCCIÓN SEGURA
    if (window.chartH instanceof Chart) {
        window.chartH.destroy();
    }

    // 5. DIBUJO DEL GRÁFICO CON TIMEOUT DE SEGURIDAD
    // Usamos requestAnimationFrame para asegurar que el DOM está listo y calculado
    requestAnimationFrame(() => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        window.chartH = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Ingresos', 'Gastos'],
                datasets: [{
                    data: [ingresos, gastos],
                    backgroundColor: ['#D6C7B3', '#E5E7EB']
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { display: true } }
            }
        });
        
        // Actualizamos el registro DESPUÉS de dibujar
        window.ultimaCarga = { i: ingresos, g: gastos };
    });
};

// --- CONTROL DE SESIÓN ---
function cerrarSesion() {
    localStorage.removeItem('session_user');
    localStorage.removeItem('session_userName');
    localStorage.removeItem('isLoggedIn');
    window.location.href = "./login.html";
}

function obtenerPeriodoActual() {
    let pref = seccionActual === 'ingresos' ? 'in' : (seccionActual === 'gastos' ? 'ex' : 'res');
    const mesEl = document.getElementById(`${pref}-mes`);
    const anioEl = document.getElementById(`${pref}-año`);
    return { mes: mesEl ? parseInt(mesEl.value) : new Date().getMonth(), año: anioEl ? parseInt(anioEl.value) : new Date().getFullYear() };
}

function obtenerMovimientosFiltrados() {
    // 1. Obtener periodo actual (asegúrate de que esto devuelva el mes y año correctos)
    const { mes, año } = obtenerPeriodoActual();

    return movimientos.filter(m => {
        // 2. Convertir la fecha del movimiento a objeto Date de forma segura
        // Si m.fecha es "2026-07-08", esto creará una fecha en UTC
        const fechaEstandar = new Date(m.fecha).toISOString().split('T')[0];
        const mF = new Date(fechaEstandar + 'T00:00:00');

        // 3. Comparar mes y año
        const coincideMes = mF.getMonth() === mes;
        const coincideAño = mF.getFullYear() === año;

        return coincideMes && coincideAño;
    });
}

async function generarLibroContable() {
    const { mes, año } = obtenerPeriodoActual();
    const filtrados = obtenerMovimientosFiltrados();
    const workbook = new ExcelJS.Workbook();
    const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const ahora = new Date();

    if (!filtrados.length) return alert("No hay datos en este período.");
    const sheetER = workbook.addWorksheet('Estado de Resultados');
    let filaER = 1;

    filaER = Encabezado(sheetER, "ESTADO DE RESULTADOS", filaER);
    filaER = Encabezado(sheetER, "PERIODO DE " + meses[mes] + " " + año, filaER);
    filaER = Encabezado(sheetER, "GENERADO EL " + ahora.toLocaleDateString('es-MX'), filaER);
    filaER++;

    let totalIngresos = 0;
    filaER = TitRepCont(sheetER, "INGRESOS", null, filaER);
    filtrados.filter(m => m.tipo === 'ingreso').forEach(m => {
        filaER = DatoRepCont(sheetER, m.cat, m.monto, filaER);
        totalIngresos += m.monto;
    });
    filaER = TitRepCont(sheetER, "(+) TOTAL INGRESOS", totalIngresos, filaER);
    filaER++;

    let totalGastos = 0;
    filaER = TitRepCont(sheetER, "GASTOS", null, filaER);
    filtrados.filter(m => m.tipo === 'gasto').forEach(m => {
        filaER = DatoRepCont(sheetER, m.cat, m.monto, filaER);
        totalGastos += m.monto;
    });
    filaER = TitRepCont(sheetER, "(-) TOTAL GASTOS", totalGastos, filaER);
    filaER++;

    const utilidad = totalIngresos - totalGastos;
    filaER = UtiNeta(sheetER, "UTILIDAD NETA DEL PERIODO", totalGastos, utilidad, filaER);

    descargarArchivo(workbook, "Reporte_Sincronizado_" + meses[mes]);
}

function Encabezado(ws, texto, fila) { ws.mergeCells(`A${fila}:D${fila}`); const cell = ws.getCell(`A${fila}`); cell.value = texto.toUpperCase(); cell.font = { size: 12, bold: true, color: { argb: 'FF45423E' } }; cell.alignment = { horizontal: 'center' }; return fila + 1; }
function TitRepCont(ws, tit, monto, fila) { const cell = ws.getCell(`A${fila}`); cell.value = tit.toUpperCase(); cell.font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E705B' } }; const cell1 = ws.getCell(`B${fila}`); cell1.value = monto; cell1.numFmt = '"$"#,##0.00'; return fila + 1; }
function DatoRepCont(ws, cat, monto, fila) { const cell = ws.getCell(`A${fila}`); cell.value = cat.toUpperCase(); const cell1 = ws.getCell(`B${fila}`); cell1.value = monto; cell1.numFmt = '"$"#,##0.00'; return fila + 1; }
function UtiNeta(ws, tit, monto, utilidad, fila) { const cell = ws.getCell(`A${fila}`); cell.value = tit.toUpperCase(); const cell1 = ws.getCell(`B${fila}`); cell1.value = utilidad; cell1.numFmt = '"$"#,##0.00'; return fila + 1; }
async function descargarArchivo(workbook, nombre) { const buffer = await workbook.xlsx.writeBuffer(); const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${nombre}.xlsx`; link.click(); }
