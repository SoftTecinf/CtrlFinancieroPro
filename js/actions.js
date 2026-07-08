// --- ACCIONES CON SHEETS ---
async function guardarRegistro(tipo) {
    const btn = document.querySelector(`#sec-${tipo}s button[onclick^="guardarRegistro"]`);
    btn.disabled = true; // Deshabilita el botón
    const pref = tipo === 'ingreso' ? 'in' : 'ex';
    const monto = parseFloat(document.getElementById(`${pref}-monto-hidden`).value);

    if (!monto || monto <= 0) {
        alert("Por favor ingresa un monto válido.");
        btn.disabled = false; // Importante: volver a habilitar si hay error
        return;
    }

    const descInput = document.getElementById(`${pref}-desc`).value.trim().toUpperCase();
    const idMovi = editandoId ? editandoId : Date.now();
    const nuevaData = {
        id: idMovi,
        tipo,
        fecha: document.getElementById(`${pref}-fecha`).value,
        cat: document.getElementById(`${pref}-categoria`).value,
        desc: descInput || 'SIN NOMBRE',
        monto
    };

    // Declaramos 'res' y hacemos la petición UNA sola vez
    const res = await FetchAPI("guardarMovimiento", { data: nuevaData });

    if (res.success) {
        if (editandoId) {
            const idx = movimientos.findIndex(m => m.id === editandoId);
            movimientos[idx] = nuevaData;
            editandoId = null;
            const btn = document.querySelector(`#sec-${tipo}s button[onclick^="guardarRegistro"]`);
            btn.innerText = tipo === 'ingreso' ? "GUARDAR REGISTRO" : "REGISTRAR EGRESO";
            btn.classList.remove('ring-4', 'ring-amber-100', 'bg-amber-600');
        } else {
            movimientos.push(nuevaData);
        }

        document.getElementById(`${pref}-monto-mask`).value = "";
        document.getElementById(`${pref}-monto-hidden`).value = 0;
        document.getElementById(`${pref}-desc`).value = "";
        refrescarVistaActual();
    }

    // Ya NO volvemos a declarar 'res' aquí. Solo habilitamos el botón.
    btn.disabled = false;
}

async function eliminarMovimiento(id) {
    if (confirm("¿Deseas eliminar este registro en la nube de forma permanente?")) {
        const res = await FetchAPI("eliminarMovimiento", { id });
        if (res.success) {
            movimientos = movimientos.filter(m => m.id !== id);
            refrescarVistaActual();
        }
    }
}

async function agregarCategoria() {
    const nom = document.getElementById('nueva-cat-nombre').value.trim().toUpperCase();
    const tipo = document.getElementById('nueva-cat-tipo').value;
    if (!nom) return;

    const nuevaCat = { id: Date.now(), nombre: nom, tipo };

    // Cambiamos el nombre de la acción aquí para que coincida con el servidor
    const res = await FetchAPI("agregarCategoria", nuevaCat);

    if (res.success) {
        categorias.push(nuevaCat);
        document.getElementById('nueva-cat-nombre').value = '';
        refrescarVistaActual();
    } else {
        alert("Error al guardar: " + res.message);
    }
}

async function eliminarCategoria(id) {
    if (confirm("¿Deseas borrar esta categoría?")) {
        const res = await FetchAPI("eliminarCategoria", { id });
        if (res.success) {
            categorias = categorias.filter(c => c.id !== id);
            refrescarVistaActual();
        }
    }
}

function prepararEdicion(id, tipo) {
    const mov = movimientos.find(m => m.id === id);
    if (!mov) return;
    editandoId = id;
    const pref = tipo === 'ingreso' ? 'in' : 'ex';

    document.getElementById(`${pref}-fecha`).value = mov.fecha;
    document.getElementById(`${pref}-categoria`).value = mov.cat;
    document.getElementById(`${pref}-desc`).value = mov.desc;

    const mask = document.getElementById(`${pref}-monto-mask`);
    document.getElementById(`${pref}-monto-hidden`).value = mov.monto;
    mask.value = mov.monto.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) + " MXN";

    const btn = document.querySelector(`#sec-${tipo}s button[onclick^="guardarRegistro"]`);
    btn.innerText = "ACTUALIZAR REGISTRO";
    btn.classList.add('ring-4', 'ring-amber-100', 'bg-amber-600');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

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
        const mF = new Date(m.fecha + 'T00:00:00'); 
        
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
