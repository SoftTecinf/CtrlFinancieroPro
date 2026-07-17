// 🔥 INYECTORES GLOBALES DE EMERGENCIA (Deben ir en la línea 1 de actions.js)
Object.defineProperty(window, 'seccionActual', {
    get: function () {
        return localStorage.getItem('ultima_seccion') || 'home';
    },
    configurable: true
});

Object.defineProperty(window, 'movimientos', {
    get: function() {
        // Devuelve los movimientos reales desde el estado global seguro
        return window.AppState?.movimientos || [];
    },
    configurable: true
});

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
        // --- AQUÍ AÑADIMOS LA ACTUALIZACIÓN ---
        // 1. Sincronizamos con el servidor para obtener los datos más recientes
        await inicializarSincronizacion(); 
        // 2. Refrescamos la vista para que el balance del día y las listas se redibujen
        //alert("Proceso éxitoso.");
        refrescarVistaActual();
        // ---------------------------------------
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

       // alert("Eliminado con éxito.");
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

// ==========================================
// CONTROL DE GRÁFICOS GLOBALES
// ==========================================
window.chartH = window.chartH || null;
window.miChartResumenInstance = window.miChartResumenInstance || null;
window.ultimaCarga = { i: -1, g: -1 };

// --- GRÁFICO 1: PANTALLA INICIO (HOME) ---
window.actualizarGraficoDistribucion = function() {
    const canvas = document.getElementById('chartHome');
    if (!canvas) return;

    const ingresos = window.EstadoFinanciero?.ingresos || 0;
    const gastos = window.EstadoFinanciero?.gastos || 0;

    // El cerrojo para evitar parpadeos innecesarios
    if (window.chartH && window.ultimaCarga?.i === ingresos && window.ultimaCarga?.g === gastos) {
        return; 
    }

    if (window.chartH) {
        window.chartH.destroy();
    }

    const ctx = canvas.getContext('2d');
    window.chartH = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Ingresos', 'Gastos'],
            datasets: [{
                data: [ingresos, gastos],
                backgroundColor: ['#D6C7B3', '#E5E7EB']
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    window.ultimaCarga = { i: ingresos, g: gastos };
};

// --- BUCLE DE SEGURIDAD PARA HOME ---
window.addEventListener('load', () => {
    setInterval(() => {
        if (typeof Chart !== 'undefined' && typeof window.actualizarGraficoDistribucion === 'function') {
            window.actualizarGraficoDistribucion();
        }
    }, 500);
});

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

 // FUNCIÓN DE REPORTE INTEGRADA (ESTADO RESULTADOS + BALANCE EN DISTINTAS PESTAÑAS)
        async function generarLibroContable() {
            const { mes, año } = obtenerPeriodoActual();
            const filtrados = obtenerMovimientosFiltrados();
            const workbook = new ExcelJS.Workbook();
            const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            const ahora = new Date();

            // --- PESTAÑA 1: ESTADO DE RESULTADOS ---
            if (!filtrados.length) return alert("No hay datos.");
            const sheetER = workbook.addWorksheet('Estado de Resultados');
            let filaER = 1; // Empezamos en la fila 1

            filaER = Encabezado(sheetER, "ESTADO DE RESULTADOS", filaER);
            filaER = Encabezado(sheetER, "PERIODO DE " + meses[mes] + " " + año, filaER);
            filaER = Encabezado(sheetER, "GENERADO EL " + ahora.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',  }), filaER);

            // Espacio en blanco opcional
            filaER++;

            let totalIngresos = 0;
            filaER = TitRepCont(sheetER, "INGRESOS",null, filaER);
            filtrados.filter(m => m.tipo === 'ingreso').forEach(m => {
                filaER = DatoRepCont(sheetER, m.cat, m.monto, filaER)
                totalIngresos += m.monto;
            });
            filaER = TitRepCont(sheetER, "(+) TOTAL INGRESOS", totalIngresos,filaER);
            filaER = TitRepCont(sheetER, "", null,filaER);
            
            let totalGastos = 0;
            filaER = TitRepCont(sheetER, "GASTOS",null, filaER);
            filtrados.filter(m => m.tipo === 'gasto').forEach(m => {
                filaER = DatoRepCont(sheetER, m.cat, m.monto, filaER)
                totalGastos += m.monto;
            });

            filaER = TitRepCont(sheetER, "(-) TOTAL GASTOS", totalGastos,filaER);
            filaER = TitRepCont(sheetER, "", null,filaER);
            
            const utilidad = totalIngresos - totalGastos;
            filaER = UtiNeta(sheetER, "UTILIDAD NETA DEL PERIODO", totalGastos,utilidad,filaER);

            // --- PESTAÑA 2: BALANCE GENERAL ---
            if (!filtrados.length) return alert("No hay datos.");
            const sheetBG = workbook.addWorksheet('Balance General');
            let filaBG = 1;

            filaBG = Encabezado(sheetBG, "BALANCE GENERAL", filaBG);
            filaBG = Encabezado(sheetBG, "FECHA DE CORTE: " +  ahora.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',  }), filaBG);
            filaBG = Encabezado(sheetBG, "GENERADO EL " + ahora.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',  }), filaBG);
            filaBG++;

            let ingHist = 0, gasHist = 0;
            movimientos.forEach(m => {
                if(m.tipo === 'ingreso') ingHist += m.monto;
                else gasHist += m.monto;
            });

            filaBG = TitRepCont(sheetBG, "ACTIVOS",null, filaBG);
            filaBG = DatoRepCont(sheetBG, "Efectivo y Equivalentes",ingHist - gasHist, filaBG);
            filaBG = TitRepCont(sheetBG, "TOTAL ACTIVOS", ingHist - gasHist, filaBG);
            filaBG = TitRepCont(sheetBG, "", null,filaBG);
            
            filaBG = TitRepCont(sheetBG, "PATRIMONIO",null, filaBG);
            filaBG = DatoRepCont(sheetBG, "Utilidades Acumuladas (Ingresos)",ingHist, filaBG);
            filaBG = DatoRepCont(sheetBG, "Gastos Acumulados",-1*gasHist, filaBG);
            filaBG = UtiNeta(sheetBG, "TOTAL PATRIMONIO",ingHist - gasHist, ingHist - gasHist, filaBG);

            // --- PESTAÑA 3: INGRESOS ---
            const wsIng = workbook.addWorksheet('Ingresos');
            let filaIng = 1;

            filaIng = Encabezado(wsIng, "DETALLE DE INGRESOS", filaIng);
            filaIng = Encabezado(wsIng, "PERIODO DE " + meses[mes] + " " + año, filaIng);
            filaIng = Encabezado(wsIng, "GENERADO EL " + ahora.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',  }), filaIng);
            
            filaIng = Encabezado(wsIng, "",filaIng);
            llenarTablaDetalle(wsIng, filtrados.filter(m => m.tipo === 'ingreso'));
            
            // --- PESTAÑA 4: GASTOS ---
            const wsGas = workbook.addWorksheet('Gastos');
            let filaGas = 1;

            filaGas = Encabezado(wsGas, "DETALLE DE GASTOS", filaGas);
            filaGas = Encabezado(wsGas, "PERIODO DE " + meses[mes] + " " + año, filaGas);
            filaGas = Encabezado(wsGas, "GENERADO EL " + ahora.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',  }), filaGas);
            filaGas = Encabezado(wsGas, "",filaGas);
            llenarTablaDetalle(wsGas, filtrados.filter(m => m.tipo === 'gasto'));

            // DESCARGAR ARCHIVO
            descargarArchivo(workbook, "RepCont"+meses[mes] + " " + año);
        }

        async function exportarFiltradoXLSX(tipo) {
            const ahora = new Date();
            const filtrados = obtenerMovimientosFiltrados().filter(m => m.tipo === tipo);
            alert(filtrados);
            if (!filtrados.length) return alert("Sin movimientos.");
            const { mes, año } = obtenerPeriodoActual();
            const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            const workbook = new ExcelJS.Workbook();
            const ws = workbook.addWorksheet('Detalle');
            let filaFil = 1;
           
            filaFil = Encabezado(ws, "DETALLE DE " + tipo.toUpperCase(), filaFil);
            filaFil = Encabezado(ws,"PERIODO DE " + meses[mes] + " " + año, filaFil);
            filaFil = Encabezado(ws, "GENERADO EL " + ahora.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',  }), filaFil);
            filaFil++;
            llenarTablaDetalle(ws, filtrados,filaFil);
            descargarArchivo(workbook, "Detalle_" + tipo+ "_"+meses[mes] + " " + año);
        }

        function llenarTablaDetalle(ws, datos, filaLle) {
        // Configuramos el encabezado
        const head = ws.getRow(filaLle);
        head.values = ['FECHA', 'CATEGORÍA', 'DESCRIPCIÓN', 'MONTO'];
        
        head.eachCell(c => {
            c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E705B' } };
            c.alignment = { horizontal: 'center' };
        });
        
        // Commit de la fila de encabezado
        head.commit();
        filaLle++;

        // Llenamos los datos
        datos.forEach((d, i) => {
            const r = ws.getRow(filaLle);
            r.values = [d.fecha, d.cat, d.desc, d.monto];
            
            const colorFila = (i % 2 === 0) ? 'FFF2ECE5' : 'FFB9AB97';
            
            r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colorFila } };
                cell.font = { size: 12, color: { argb: 'FF45423E' } };
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
                
                if (colNumber === 4) {
                    cell.numFmt = '"$"#,##0.00';
                    cell.alignment = { horizontal: 'right' };
                }
            });

            r.commit();
            filaLle++;
        });

    ws.columns.forEach(c => c.width = 22);
}

        async function descargarArchivo(workbook, nombre) {
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `${nombre}.xlsx`;
            link.click();
        }

        // --- FUNCIONES EXCEL ---
        function Encabezado(ws, texto, fila) {
            ws.mergeCells(`A${fila}:D${fila}`);
            const cell = ws.getCell(`A${fila}`);
            cell.value = texto.toUpperCase();
            cell.font = { size: 12, bold: true, color: { argb: 'FF45423E' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'center' };
            ws.views = [{ showGridLines: false }];
            return fila + 1;
        }

        function TitRepCont(ws, tit, monto, fila) {
            const cell = ws.getCell(`A${fila}`);
            cell.value = tit.toUpperCase();
            cell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E705B' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            ws.columns.forEach(c => c.width = 25);
            
            const cell1 = ws.getCell(`B${fila}`);
            cell1.value = monto;
            cell1.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
            cell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E705B' } };
            cell1.numFmt = '"$"#,##0.00';
            cell1.alignment = { vertical: 'middle', horizontal: 'right' };
            return fila + 1;
        }

        function DatoRepCont(ws, cat, monto, fila) {
           const cell = ws.getCell(`A${fila}`);
            cell.value = cat.toUpperCase();
            cell.font = { size: 12, color: { argb: 'FF45423E' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: (fila % 2 !== 0) ? 'FFB9AB97' : 'FFF2ECE5' } };
            const bordeContorno = { style: 'medium', color: { argb: 'FF7E705B' } };
            cell.border = { right: bordeContorno };
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            ws.columns.forEach(c => c.width = 25);

            const cell1 = ws.getCell(`B${fila}`);
            cell1.value = monto;
            cell1.font = { size: 12,  color: { argb: 'FF45423E' } };
            cell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: (fila % 2 !== 0) ? 'FFB9AB97' : 'FFF2ECE5' }  };
            cell1.numFmt = '"$"#,##0.00';
            cell1.alignment = { vertical: 'middle', horizontal: 'right' };
            return fila + 1;
        }
        
        function UtiNeta(ws, tit, monto, utilidad,fila) {
            const cell = ws.getCell(`A${fila}`);
            cell.value = tit.toUpperCase();
            cell.font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E705B' } };
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
            ws.columns.forEach(c => c.width = 30);
            
            const cell1 = ws.getCell(`B${fila}`);
            cell1.value = monto;
            cell1.font = { size: 12, bold: true,  color: { argb: utilidad >= 0 ? 'FFFFFFFF' : 'FF0000' }};
            cell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF7E705B' } };
            cell1.numFmt = '"$"#,##0.00';
            cell1.alignment = { vertical: 'middle', horizontal: 'right' };
            return fila + 1;
        }
       
        function inicializarFiltros() {
            const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
            const idsAnio = ['in-año', 'ex-año', 'res-año'];
            const idsMes = ['in-mes', 'ex-mes', 'res-mes'];
            const añoActual = new Date().getFullYear();
            const mesActual = new Date().getMonth();
            [idsMes, idsAnio].forEach((list, idx) => {
                list.forEach(id => {
                    const sel = document.getElementById(id);
                    if(sel) {
                        sel.innerHTML = '';
                        if(idx === 0) {
                            meses.forEach((m, i) => {
                                let opt = document.createElement('option');
                                opt.value = i; opt.innerHTML = m;
                                sel.appendChild(opt);
                            });
                            sel.value = mesActual;
                        } else {
                            for (let i = añoActual; i >= añoActual - 4; i--) {
                                let opt = document.createElement('option');
                                opt.value = i; opt.innerHTML = i;
                                sel.appendChild(opt);
                            }
                        }
                    }
                });
            });
        }

        function obtenerPeriodoActual() {
            let pref = seccionActual === 'ingresos' ? 'in' : (seccionActual === 'gastos' ? 'ex' : 'res');
            const mesEl = document.getElementById(`${pref}-mes`);
            const anioEl = document.getElementById(`${pref}-año`);
            return { mes: mesEl ? parseInt(mesEl.value) : new Date().getMonth(), año: anioEl ? parseInt(anioEl.value) : new Date().getFullYear() };
        }

        function obtenerMovimientosFiltrados() {
            const { mes, año } = obtenerPeriodoActual();
            return movimientos.filter(m => {
                const mF = new Date(m.fecha + 'T00:00:00');
                return mF.getMonth() === mes && mF.getFullYear() === año;
            });
        }

        function actualizarSelectsCategorias() {
            const inSel = document.getElementById('in-categoria');
            const exSel = document.getElementById('ex-categoria');
            if(inSel) {
                inSel.innerHTML = '';
                categorias.filter(c => c.tipo === 'ingreso').forEach(c => { inSel.innerHTML += `<option value="${c.nombre}">${c.nombre}</option>`; });
            }
            if(exSel) {
                exSel.innerHTML = '';
                categorias.filter(c => c.tipo === 'gasto').forEach(c => { exSel.innerHTML += `<option value="${c.nombre}">${c.nombre}</option>`; });
            }
        }

        function renderCategoriasConfig() {
            const contIng = document.getElementById('lista-cats-ingreso');
            const contGas = document.getElementById('lista-cats-gasto');
            contIng.innerHTML = '';
            contGas.innerHTML = '';
            categorias.forEach(c => {
                const itemHtml = `
                    <div class="group bg-gray-50 rounded-lg border border-white p-3">
                        <div id="view-${c.id}" class="flex justify-between items-center">
                            <span class="text-xs font-bold uppercase text-stone-600">${c.nombre}</span>
                            <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                <button onclick="editMode(${c.id}, true)" class="text-[9px] font-bold text-stone-400 hover:text-stone-800">EDITAR</button>
                                <button onclick="eliminarCategoria(${c.id})" class="text-[9px] font-bold text-rose-300 hover:text-rose-500">X</button>
                            </div>
                        </div>
                        <div id="edit-${c.id}" class="hidden flex gap-2">
                            <input type="text" id="input-${c.id}" value="${c.nombre}" class="flex-1 text-xs p-1 rounded border border-stone-200 outline-none uppercase">
                            <button onclick="saveEdit(${c.id})" class="bg-stone-800 text-white px-2 py-1 rounded text-[9px] font-bold uppercase">OK</button>
                        </div>
                    </div>`;
                if(c.tipo === 'ingreso') contIng.innerHTML += itemHtml;
                else contGas.innerHTML += itemHtml;
            });
        }

        function editMode(id, active) {
            document.getElementById(`view-${id}`).classList.toggle('hidden', active);
            document.getElementById(`edit-${id}`).classList.toggle('hidden', !active);
            if(active) document.getElementById(`input-${id}`).focus();
        }

        function saveEdit(id) {
            const nuevoNombre = document.getElementById(`input-${id}`).value.trim().toUpperCase();
            if(nuevoNombre) {
                const index = categorias.findIndex(c => c.id === id);
                categorias[index].nombre = nuevoNombre;
                localStorage.setItem('cats_mxn', JSON.stringify(categorias));
                refrescarVistaActual();
            }
        }

        function agregarCategoria() {
            const nom = document.getElementById('nueva-cat-nombre').value.trim().toUpperCase();
            const tipo = document.getElementById('nueva-cat-tipo').value;
            if(!nom) return;
            categorias.push({ id: Date.now(), nombre: nom, tipo });
            localStorage.setItem('cats_mxn', JSON.stringify(categorias));
            document.getElementById('nueva-cat-nombre').value = '';
            refrescarVistaActual();
        }

        function eliminarCategoria(id) {
            categorias = categorias.filter(c => c.id !== id);
            localStorage.setItem('cats_mxn', JSON.stringify(categorias));
            refrescarVistaActual();
        }

        function borrarTodo() {
            if(confirm("¿Borrar todo?")) { localStorage.clear(); location.reload(); }
        }

        function actualizarHome() {
            const hoyStr = new Date().toISOString().split('T')[0];
            const ahora = new Date();
            let balG = 0, balD = 0, ingM = 0, gasM = 0;
            movimientos.forEach(m => {
                const val = m.tipo === 'ingreso' ? m.monto : -m.monto;
                balG += val;
                if(m.fecha === hoyStr) balD += val;
                const mF = new Date(m.fecha + 'T00:00:00');
                if(mF.getMonth() === ahora.getMonth() && mF.getFullYear() === ahora.getFullYear()) {
                    if(m.tipo === 'ingreso') ingM += m.monto; else gasM += m.monto;
                }
            });
            document.getElementById('balance-general').innerText = fMXN(balG);
            document.getElementById('balance-dia').innerText = fMXN(balD);
            document.getElementById('home-ingresos').innerText = fMXN(ingM);
            document.getElementById('home-gastos').innerText = fMXN(gasM);
            const ctx = document.getElementById('chartHome').getContext('2d');
            if(chartH) chartH.destroy();
            chartH = new Chart(ctx, { type: 'doughnut', data: { labels: ['Ingresos', 'Gastos'], datasets: [{ data: [ingM, gasM], backgroundColor: ['#D6C7B3', '#E5E7EB'] }] }, options: { cutout: '75%' } });
            const listaH = document.getElementById('lista-recientes');
            listaH.innerHTML = '';
            [...movimientos].reverse().slice(0, 10).forEach(m => {
                listaH.innerHTML += `<div class="flex justify-between items-center p-3 bg-gray-50/50 rounded-xl border border-white"><div><p class="text-xs font-semibold uppercase">${m.desc}</p><p class="text-[8px] opacity-40 uppercase">${m.fecha}</p></div><span class="text-xs font-bold ${m.tipo === 'gasto' ? 'text-rose-400' : 'text-stone-600'}">${m.tipo === 'gasto' ? '-' : '+'}${fMXN(m.monto)}</span></div>`;
            });
        }

        function actualizarResumen() {
             const filtrados = obtenerMovimientosFiltrados();
            let ing = 0, gas = 0;
            const contLista = document.getElementById('lista-resumen-periodo');
            contLista.innerHTML = filtrados.length ? '' : '<p class="opacity-20 text-center py-10 text-sm">Sin movimientos.</p>';
            filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(m => {
                if(m.tipo === 'ingreso') ing += m.monto; else gas += m.monto;
                const div = document.createElement('div');
                div.className = "flex justify-between items-center p-3 bg-gray-50/50 rounded-xl border border-white";
                div.innerHTML = `<div><p class="text-[10px] font-semibold">${m.desc}</p><p class="text-[8px] opacity-40 uppercase">${m.cat} | ${m.fecha}</p></div>
                    <span class="text-[10px] font-bold ${m.tipo === 'gasto' ? 'text-rose-400' : 'text-stone-600'}">${m.tipo === 'gasto' ? '-' : '+'}${fMXN(m.monto)}</span>`;
                contLista.appendChild(div);
            });
            document.getElementById('resumen-balance-total').innerText = fMXN(ing - gas);
            const ctx = document.getElementById('chartResumen').getContext('2d');
            if(chartR) chartR.destroy();
            chartR = new Chart(ctx, { 
                type: 'bar', 
                data: { labels: ['Ingresos', 'Gastos'], datasets: [{ data: [ing, gas], backgroundColor: ['#D6C7B3', '#45423E'], borderRadius: 8 }] },
                options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } 
            });
        }

        function actualizarFechaHeader() {
            const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
            const fecha = new Date().toLocaleDateString('es-MX', opciones);
            document.getElementById('fecha-sistema').innerText = fecha.charAt(0).toUpperCase() + fecha.slice(1);
        }

        inicializarFiltros();
        actualizarFechaHeader();
        showSection('home');
