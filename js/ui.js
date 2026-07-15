// --- RENDERIZADOS LOCALES ---
function actualizarListadoIndividual(tipo, contId, countId) {
    // 1. Obtén los movimientos del AppState centralizado
    const todosLosMovimientos = AppState.movimientos || [];

    // 2. Filtramos usando tu lógica segura
    const filtrados = todosLosMovimientos.filter(m => {
        if (!m.fecha) return false;

        const d = new Date(m.fecha);
        const añoMov = d.getFullYear();
        const mesMov = d.getMonth();

        return m.tipo === tipo &&
            mesMov === AppState.filtrosActuales.mes &&
            añoMov === AppState.filtrosActuales.año;
    }).reverse();

    // 3. Renderizamos el conteo
    const countEl = document.getElementById(countId);
    if (countEl) countEl.innerText = `${filtrados.length} MOVIMIENTOS`;

    const cont = document.getElementById(contId);
    if (!cont) return; // Si no existe el contenedor, salimos de la función

    // 4. Validamos si está vacío de forma definitiva
    if (filtrados.length === 0) {
        cont.innerHTML = '<p class="opacity-20 text-center py-10">Sin registros.</p>';
        return; // Detenemos la ejecución aquí ya que no hay nada que recorrer
    }

    // 5. Si sí hay datos, acumulamos el HTML y lo insertamos una sola vez
    let htmlAcumulado = '';
    filtrados.forEach(m => {
        htmlAcumulado += `
            <div class="p-4 bg-gray-50/50 rounded-xl border border-white flex justify-between items-center group transition-all hover:bg-white hover:shadow-sm">
                <div class="flex-1">
                    <p class="text-sm font-semibold uppercase text-stone-700">${m.desc || 'Sin descripción'}</p>
                    <p class="text-[9px] opacity-40 uppercase font-bold">${m.fecha.split('T')[0]} | ${m.cat || 'General'}</p>
                </div>
                <div class="flex items-center gap-4">
                    <p class="text-sm font-bold ${tipo === 'gasto' ? 'text-rose-400' : 'text-stone-600'}">
                        ${tipo === 'gasto' ? '-' : '+'}${fMXN(m.monto)}
                    </p>
                    <div class="flex gap-1">
                        <button onclick="prepararEdicion(${m.id}, '${tipo}')" class="p-2 hover:bg-stone-200 rounded-full transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8C7E6A" stroke-width="2.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button onclick="eliminarMovimiento(${m.id})" class="p-2 hover:bg-rose-100 rounded-full transition-colors">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
                        </button>
                    </div>
                </div>
            </div>`;
    });

    cont.innerHTML = htmlAcumulado;
}

function actualizarSelectsCategorias() {
    const listaCategorias = AppState.categorias || [];

    // Función auxiliar para llenar el select y evitar repetir código
    const llenarSelect = (id, tipo) => {
        const select = document.getElementById(id);
        if (!select) return;

        // Limpiamos y creamos el primer option de una vez
        select.innerHTML = '<option value="">Selecciona una categoría</option>';

        // Usamos map y join para mayor rendimiento que hacer += en un bucle
        const opciones = listaCategorias
            .filter(c => c && c.tipo === tipo) // Verificamos que 'c' exista
            .map(c => `<option value="${c.nombre}">${c.nombre}</option>`)
            .join('');

        select.innerHTML += opciones;
    };

    llenarSelect('in-categoria', 'ingreso');
    llenarSelect('ex-categoria', 'gasto');
}

function renderCategoriasConfig() {
    const listaCategorias = AppState.categorias || [];
    const containerIng = document.getElementById('lista-cats-ingreso');
    const containerGas = document.getElementById('lista-cats-gasto');

    if (!containerIng || !containerGas) return;

    // Variables temporales para acumular el HTML
    let htmlIngresos = '';
    let htmlGastos = '';

    listaCategorias.forEach(c => {
        const itemHtml = `
            <div class="bg-gray-50 rounded-lg p-3 flex justify-between items-center">
                <span class="text-xs font-bold uppercase text-stone-600">${c.nombre}</span>
                <button onclick="eliminarCategoria(${c.id})" class="text-rose-500 font-bold text-xs">X</button>
            </div>`;

        if (c.tipo === 'ingreso') {
            htmlIngresos += itemHtml; // Acumulamos en texto
        } else {
            htmlGastos += itemHtml;   // Acumulamos en texto
        }
    });

    // Modificamos el DOM una sola vez al final
    containerIng.innerHTML = htmlIngresos;
    containerGas.innerHTML = htmlGastos;
}

// Asegúrate de que esta variable sea global en tu archivo
window.chartH = window.chartH || null;
let renderizadoEnProgreso = false;
function actualizarHome() {
    renderizadoEnProgreso = true;
    // 1. LEEMOS Y NORMALIZAMOS DATOS
    let datos = AppState.movimientos || [];
    if (datos && !Array.isArray(datos) && typeof datos === 'object') {
        datos = datos.movimientos || Object.values(datos);
    }
    if (!Array.isArray(datos)) datos = [];

    // 2. CÁLCULOS (FUERA DEL BUCLE DE DIBUJO)
    const hoyStr = new Date().toISOString().split('T')[0];
    const ahora = new Date();
    let balG = 0, balD = 0, ingM = 0, gasM = 0;

    datos.forEach(m => {
        if (!m || typeof m.monto === 'undefined') return;

        const monto = parseFloat(m.monto) || 0;
        const val = m.tipo === 'ingreso' ? monto : -monto;

        balG += val;
        if (m.fecha === hoyStr) balD += val;

        const mF = new Date(m.fecha);

        // Y para asegurar que funciona incluso si m.fecha viene como string raro:
        if (isNaN(mF.getTime())) {
            console.warn("Fecha inválida encontrada:", m.fecha);
            return; // Saltamos este movimiento
        }
        // Combinamos el chequeo de validez con la fecha actual
        const esFechaValida = !isNaN(mF.getTime());
        const esMesActual = mF.getMonth() === ahora.getMonth() && mF.getFullYear() === ahora.getFullYear();

        if (esFechaValida && esMesActual) {
            if (m.tipo === 'ingreso') {
                ingM += monto;
            } else {
                gasM += monto;
            }
        }
    });

    // 3. ACTUALIZACIÓN DE TEXTOS (DOM)
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

    // 4. GRÁFICO (SE EJECUTA UNA SOLA VEZ, DESPUÉS DE LOS CÁLCULOS)

    actualizarGraficoDistribucion(ingM, gasM);
    renderizadoEnProgreso = false;
    
    // 5. LISTA RECIENTE
    const listaH = document.getElementById('lista-recientes');
    if (listaH) {
        listaH.innerHTML = '';
        [...datos].reverse().slice(0, 10).forEach(m => {
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

// --- CONTROLADOR INTELIGENTE DE VISTAS ---
async function abrirVistaAjustesInteligente() {
    // 1. Verificamos si NO hay categorías
    if (!AppState.categorias || AppState.categorias.length === 0) {

        toggleLoading(true);

        try {
            // AQUÍ PUEDE ESTAR EL ERROR: ¿Tu API espera esto exactamente?
            const formData = new FormData();
            formData.append('action', 'obtenerCategorias');

            console.log("3. Enviando petición a la API...");
            const req = await fetch(API_URL, { method: 'POST', body: formData });
            const res = await req.json();

            console.log("4. Respuesta recibida de la API:", res);

            if (res.exito) {
                AppState.categorias = res.datos;
                console.log("5. Categorías guardadas exitosamente.");
            } else {
                console.error("6. Error en la API. Respuesta no exitosa:", res);
            }
        } catch (error) {
            console.error("❌ ERROR CRÍTICO AL DESCARGAR:", error);
        } finally {
            toggleLoading(false);
        }
    }

    renderCategoriasConfig();
}