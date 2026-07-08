// --- RENDERIZADOS LOCALES ---
function actualizarListadoIndividual(tipo, contId, countId) {
    const filtrados = obtenerMovimientosFiltrados().filter(m => m.tipo === tipo).reverse();
    document.getElementById(countId).innerText = `${filtrados.length} items`;
   
    const cont = document.getElementById(contId);
    cont.innerHTML = filtrados.length ? '' : '<p class="opacity-20 text-center py-10">Sin registros.</p>';

    filtrados.forEach(m => {
        cont.innerHTML += `
                    <div class="p-4 bg-gray-50/50 rounded-xl border border-white flex justify-between items-center group transition-all hover:bg-white hover:shadow-sm">
                        <div class="flex-1">
                            <p class="text-sm font-semibold uppercase text-stone-700">${m.desc}</p>
                            <p class="text-[9px] opacity-40 uppercase font-bold">${m.fecha} | ${m.cat}</p>
                        </div>
                        <div class="flex items-center gap-4">
                            <div class="text-right">
                                <p class="text-sm font-bold ${tipo === 'gasto' ? 'text-rose-400' : 'text-stone-600'}">
                                    ${tipo === 'gasto' ? '-' : '+'}${fMXN(m.monto)}
                                </p>
                            </div>
                            <div class="flex gap-1">
                                <button onclick="prepararEdicion(${m.id}, '${tipo}')" class="p-2 hover:bg-stone-200 rounded-full transition-colors">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8C7E6A" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                </button>
                                <button onclick="eliminarMovimiento(${m.id})" class="p-2 hover:bg-rose-100 rounded-full transition-colors">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        </div>
                    </div>`;
    });
}

function actualizarSelectsCategorias() {
    const inSel = document.getElementById('in-categoria');
    const exSel = document.getElementById('ex-categoria');
    if (inSel) {
        inSel.innerHTML = '';
        categorias.filter(c => c.tipo === 'ingreso').forEach(c => { inSel.innerHTML += `<option value="${c.nombre}">${c.nombre}</option>`; });
    }
    if (exSel) {
        exSel.innerHTML = '';
        categorias.filter(c => c.tipo === 'gasto').forEach(c => { exSel.innerHTML += `<option value="${c.nombre}">${c.nombre}</option>`; });
    }
}

function renderCategoriasConfig() {
    const contIng = document.getElementById('lista-cats-ingreso');
    const contGas = document.getElementById('lista-cats-gasto');
    contIng.innerHTML = ''; contGas.innerHTML = '';
    categorias.forEach(c => {
        const itemHtml = `<div class="bg-gray-50 rounded-lg p-3 flex justify-between items-center"><span class="text-xs font-bold uppercase text-stone-600">${c.nombre}</span><button onclick="eliminarCategoria(${c.id})" class="text-rose-500 font-bold text-xs">X</button></div>`;
        if (c.tipo === 'ingreso') contIng.innerHTML += itemHtml;
        else contGas.innerHTML += itemHtml;
    });
}

function actualizarHome() {
    // 1. Cálculos (esto siempre se ejecuta)
    const hoyStr = new Date().toISOString().split('T')[0];
    const ahora = new Date();
    let balG = 0, balD = 0, ingM = 0, gasM = 0;

    movimientos.forEach(m => {
        const val = m.tipo === 'ingreso' ? m.monto : -m.monto;
        balG += val;
        if (m.fecha === hoyStr) balD += val;
        const mF = new Date(m.fecha + 'T00:00:00');
        if (mF.getMonth() === ahora.getMonth() && mF.getFullYear() === ahora.getFullYear()) {
            if (m.tipo === 'ingreso') ingM += m.monto; else gasM += m.monto;
        }
    });

    // 2. Actualización de texto con verificación de existencia
    const updates = [
        { id: 'balance-general', val: fMXN(balG) },
        { id: 'balance-dia', val: fMXN(balD) },
        { id: 'home-ingresos', val: fMXN(ingM) },
        { id: 'home-gastos', val: fMXN(gasM) }
    ];

    updates.forEach(item => {
        const el = document.getElementById(item.id);
        if (el) el.innerText = item.val;
    });

    // 3. Gráfico con verificación de existencia
    const canvas = document.getElementById('chartHome');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (chartH) chartH.destroy();
        chartH = new Chart(ctx, { 
            type: 'doughnut', 
            data: { 
                labels: ['Ingresos', 'Gastos'], 
                datasets: [{ data: [ingM, gasM], backgroundColor: ['#D6C7B3', '#E5E7EB'] }] 
            }, 
            options: { cutout: '75%', plugins: { legend: { display: false } } } 
        });
    }

    // 4. Lista reciente con verificación de existencia
    const listaH = document.getElementById('lista-recientes');
    if (listaH) {
        listaH.innerHTML = '';
        [...movimientos].reverse().slice(0, 10).forEach(m => {
            listaH.innerHTML += `
                <div class="flex justify-between items-center p-3 bg-gray-50/50 rounded-xl border border-white">
                    <div>
                        <p class="text-xs font-semibold uppercase">${m.desc}</p>
                        <p class="text-[8px] opacity-40 uppercase">${m.fecha}</p>
                    </div>
                    <span class="text-xs font-bold ${m.tipo === 'gasto' ? 'text-rose-400' : 'text-stone-600'}">
                        ${m.tipo === 'gasto' ? '-' : '+'}${fMXN(m.monto)}
                    </span>
                </div>`;
        });
    }
}

function actualizarResumen() {
    const filtrados = obtenerMovimientosFiltrados();
    let ing = 0, gas = 0;
    const contLista = document.getElementById('lista-resumen-periodo');
    contLista.innerHTML = filtrados.length ? '' : '<p class="opacity-20 text-center py-10 text-sm">Sin movimientos.</p>';

    filtrados.sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).forEach(m => {
        if (m.tipo === 'ingreso') ing += m.monto; else gas += m.monto;
        const div = document.createElement('div');
        div.className = "flex justify-between items-center p-3 bg-gray-50/50 rounded-xl border border-white";
        div.innerHTML = `<div><p class="text-[10px] font-semibold">${m.desc}</p><p class="text-[8px] opacity-40 uppercase">${m.cat} | ${m.fecha}</p></div><span class="text-[10px] font-bold ${m.tipo === 'gasto' ? 'text-rose-400' : 'text-stone-600'}">${m.tipo === 'gasto' ? '-' : '+'}${fMXN(m.monto)}</span>`;
        contLista.appendChild(div);
    });

    document.getElementById('resumen-balance-total').innerText = fMXN(ing - gas);
    const ctx = document.getElementById('chartResumen').getContext('2d');
    if (chartR) chartR.destroy();
    chartR = new Chart(ctx, { type: 'bar', data: { labels: ['Ingresos', 'Gastos'], datasets: [{ data: [ing, gas], backgroundColor: ['#D6C7B3', '#45423E'], borderRadius: 8 }] }, options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } } });
}

function actualizarFechaHeader() {
    const el = document.getElementById('fecha-sistema');
    if (!el) return; // Candado de seguridad por si no está en la pantalla actual

    const opciones = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const fecha = new Date().toLocaleDateString('es-MX', opciones);
    el.innerText = fecha.charAt(0).toUpperCase() + fecha.slice(1);
}

function toggleLoading(show) {
    const loader = document.getElementById('loading-overlay');
    // Solo intenta cambiar el estilo si el elemento existe en el HTML actual
    if (loader) {
        loader.style.display = show ? 'flex' : 'none';
    }
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
            if (sel) {
                sel.innerHTML = '';
                if (idx === 0) {
                    meses.forEach((m, i) => {
                        let opt = document.createElement('option');
                        opt.value = i; opt.innerHTML = m; sel.appendChild(opt);
                    });
                    sel.value = mesActual;
                } else {
                    for (let i = añoActual; i >= añoActual - 4; i--) {
                        let opt = document.createElement('option');
                        opt.value = i; opt.innerHTML = i; sel.appendChild(opt);
                    }
                }
            }
        });
    });
}

function formatCurrency(input, hiddenId) {
    let value = input.value.replace(/\D/g, "");
    let numericValue = value ? parseFloat(value) / 100 : 0;
    document.getElementById(hiddenId).value = numericValue;
    input.value = numericValue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) + " MXN";
}