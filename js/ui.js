// --- RENDERIZADOS LOCALES ---
function actualizarListadoIndividual(tipo, contId, countId) {
    const cont = document.getElementById(contId);
    if (!cont) return; // Seguridad

    const todos = AppState.movimientos || [];
    const mesFiltro = AppState.filtrosActuales.mes;
    const añoFiltro = AppState.filtrosActuales.año;

    // 1. FILTRADO RÁPIDO (Evitamos crear miles de objetos Date)
    const filtrados = todos.filter(m => {
        if (!m.tipo || m.tipo !== tipo) return false;
        if (!m.fecha || !m.fecha.includes('-')) return true;

        const partes = m.fecha.split('-');
        const añoMov = parseInt(partes[0]);
        const mesMov = parseInt(partes[1]) - 1;

        // DOBLE IGUAL para ignorar si uno es string "6" y el otro es número 6
        return mesMov == mesFiltro && añoMov == añoFiltro;
    }).reverse();

    // 2. CONTEO
    const countEl = document.getElementById(countId);
    if (countEl) countEl.innerText = `${filtrados.length} MOVIMIENTOS`;

    // 3. RENDERIZADO CON FRAGMENT (Mucho más rápido que innerHTML acumulado)
    if (filtrados.length === 0) {
        cont.innerHTML = '<p class="opacity-20 text-center py-10">Sin registros.</p>';
        return;
    }

    const fragment = document.createDocumentFragment();
    filtrados.forEach(m => {
        const div = document.createElement('div');
        div.className = "p-4 bg-gray-50/50 rounded-xl border border-white flex justify-between items-center group transition-all hover:bg-white hover:shadow-sm";
        div.innerHTML = `
            <div class="flex-1">
                <p class="text-sm font-semibold uppercase text-stone-700">${m.desc || 'Sin descripción'}</p>
                <p class="text-[9px] opacity-40 uppercase font-bold">${m.fecha} | ${m.cat || 'General'}</p>
            </div>
            <div class="flex items-center gap-4">
                <p class="text-sm font-bold ${tipo === 'gasto' ? 'text-rose-400' : 'text-stone-600'}">
                    ${tipo === 'gasto' ? '-' : '+'}${fMXN(m.monto)}
                </p>
                <button onclick="eliminarMovimiento(${m.id})" class="p-2 hover:bg-rose-100 rounded-full transition-colors">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                </button>
            </div>`;
        fragment.appendChild(div);
    });

    cont.innerHTML = ''; // Limpiamos una sola vez
    cont.appendChild(fragment); // Añadimos todo el bloque de una vez
}

function actualizarSelectsCategorias() {
    // 1. Usamos la variable que definiste arriba
    const listaCategorias = AppState.categorias || [];

    const inSel = document.getElementById('in-categoria');
    const exSel = document.getElementById('ex-categoria');

    if (inSel) {
        inSel.innerHTML = '<option value="">Selecciona una categoría</option>';
        // 2. Usamos 'listaCategorias' en lugar de la variable global 'categorias'
        listaCategorias.filter(c => c.tipo === 'ingreso').forEach(c => {
            inSel.innerHTML += `<option value="${c.nombre}">${c.nombre}</option>`;
        });
    }

    if (exSel) {
        exSel.innerHTML = '<option value="">Selecciona una categoría</option>';
        // 2. Usamos 'listaCategorias' aquí también
        listaCategorias.filter(c => c.tipo === 'gasto').forEach(c => {
            exSel.innerHTML += `<option value="${c.nombre}">${c.nombre}</option>`;
        });
    }
}

function renderCategoriasConfig() {
    // 1. Define la variable DENTRO de la función
    const listaCategorias = AppState.categorias || [];

    // 2. Busca los contenedores
    const containerIng = document.getElementById('lista-cats-ingreso');
    const containerGas = document.getElementById('lista-cats-gasto');

    // 3. Validación de seguridad
    if (!containerIng || !containerGas) {
        return;
    }

    // 4. Limpieza y renderizado
    containerIng.innerHTML = '';
    containerGas.innerHTML = '';

    listaCategorias.forEach(c => {
        const itemHtml = `
            <div class="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                <span class="text-xs font-bold uppercase text-stone-600">${c.nombre}</span>
                <button onclick="eliminarCategoria(${c.id})" class="text-rose-500 font-bold text-xs">X</button>
            </div>`;

        if (c.tipo === 'ingreso') {
            containerIng.innerHTML += itemHtml;
        } else {
            containerGas.innerHTML += itemHtml;
        }
    });
}

// Variable para evitar renderizar si los datos son idénticos
let ultimaHashDatos = "";

function actualizarHome() {
    const datos = AppState.movimientos || [];

    // 1. MEMOIZACIÓN: Si los datos no cambiaron, no hacemos nada
    const hashActual = JSON.stringify(datos);
    if (hashActual === ultimaHashDatos) return;
    ultimaHashDatos = hashActual;

    const hoyStr = new Date().toISOString().split('T')[0];
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const añoActual = ahora.getFullYear();

    let balG = 0, balD = 0, ingM = 0, gasM = 0;

    // 2. CICLO ÚNICO: Cálculos optimizados
    for (let i = 0; i < datos.length; i++) {
        const m = datos[i];
        const monto = parseFloat(m.monto) || 0;
        const esIngreso = m.tipo === 'ingreso';
        const val = esIngreso ? monto : -monto;

        balG += val;
        if (m.fecha === hoyStr) balD += val;

        // Comparación rápida de fechas sin convertir a objeto Date si el formato es AAAA-MM-DD
        if (m.fecha.startsWith(`${añoActual}-${String(mesActual + 1).padStart(2, '0')}`)) {
            if (esIngreso) ingM += monto;
            else gasM += monto;
        }
    }

    // 3. ACTUALIZACIÓN EFICIENTE DEL DOM
    const elementos = {
        'balance-general': fMXN(balG),
        'balance-dia': fMXN(balD),
        'home-ingresos': fMXN(ingM),
        'home-gastos': fMXN(gasM)
    };

    for (const id in elementos) {
        const el = document.getElementById(id);
        if (el) el.innerText = elementos[id];
    }

    // 4. GRÁFICO: Actualización de datos en lugar de .destroy()
    const canvas = document.getElementById('chartHome');
    if (canvas) {
        if (!chartH) {
            chartH = new Chart(canvas.getContext('2d'), {
                type: 'doughnut',
                data: { labels: ['Ingresos', 'Gastos'], datasets: [{ data: [ingM, gasM], backgroundColor: ['#D6C7B3', '#E5E7EB'] }] },
                options: { cutout: '75%', plugins: { legend: { display: false } } }
            });
        } else {
            chartH.data.datasets[0].data = [ingM, gasM];
            chartH.update('none'); // Actualiza sin animaciones pesadas
        }
    }

    // 5. LISTA RECIENTE: Fragmentos de documento (más rápido que innerHTML)
    const listaH = document.getElementById('lista-recientes');
    if (listaH) {
        const fragment = document.createDocumentFragment();
        const ultimos = [...datos].reverse().slice(0, 10);

        ultimos.forEach(m => {
            const div = document.createElement('div');
            div.className = "flex justify-between items-center p-3 bg-gray-50/50 rounded-xl border border-white";
            div.innerHTML = `
                <div>
                    <p class="text-xs font-semibold uppercase">${m.desc}</p>
                    <p class="text-[8px] opacity-40 uppercase">${m.fecha}</p>
                </div>
                <span class="text-xs font-bold ${m.tipo === 'gasto' ? 'text-rose-400' : 'text-stone-600'}">
                    ${m.tipo === 'gasto' ? '-' : '+'}${fMXN(m.monto)}
                </span>`;
            fragment.appendChild(div);
        });
        listaH.innerHTML = '';
        listaH.appendChild(fragment);
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
    const añoActual = new Date().getFullYear();
    const mesActual = new Date().getMonth(); // 6 para Julio
    const selectsMes = ['in-mes', 'ex-mes', 'res-mes'];
    const selectsAnio = ['in-año', 'ex-año', 'res-año'];

    // 1. Llenamos y seteamos valores
    selectsMes.forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
            sel.innerHTML = '';
            meses.forEach((m, i) => {
                let opt = document.createElement('option');
                opt.value = i;
                opt.innerHTML = m;
                sel.appendChild(opt);
            });
            sel.value = mesActual;

            // ESCUCHA: Si el usuario cambia el mes, refrescamos la vista
            sel.addEventListener('change', () => {
                refrescarVistaActual();
            });
        }
    });

    selectsAnio.forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
            sel.innerHTML = '';
            for (let i = añoActual; i >= añoActual - 4; i--) {
                let opt = document.createElement('option');
                opt.value = i;
                opt.innerHTML = i;
                sel.appendChild(opt);
            }
            sel.value = añoActual;

            // ESCUCHA: Si el usuario cambia el año, refrescamos la vista
            sel.addEventListener('change', () => {
                refrescarVistaActual();
            });
        }
    });

    // 2. Sincronizamos AppState inicial
    AppState.filtrosActuales.mes = mesActual;
    AppState.filtrosActuales.año = añoActual;
}

function formatCurrency(input, hiddenId) {
    let value = input.value.replace(/\D/g, "");
    let numericValue = value ? parseFloat(value) / 100 : 0;
    document.getElementById(hiddenId).value = numericValue;
    input.value = numericValue.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) + " MXN";
}

// Función de seguridad para actualizar elementos
// Agrega esto a tu ui.js junto a safeSetText
function safeSetHTML(id, htmlContent) {
    const el = document.getElementById(id);
    if (el) {
        el.innerHTML = htmlContent;
    }
}

function actualizarUsuarioHeader() {
    // 1. Buscamos EXACTAMENTE el ID que tienes en tu HTML
    const nombreEl = document.getElementById('user-display'); 
    
    if (nombreEl) {
        // 2. Si existe el usuario en AppState lo pintamos, si no, ponemos algo genérico
        // Usamos el encadenamiento opcional (?) por si AppState.usuario no existe aún
        nombreEl.innerText = AppState.usuario?.nombre || 'Invitado'; 
    }
}