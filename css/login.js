// --- AUTENTICACIÓN ---
async function ejecutarLogin() {
    const usuario = document.getElementById('login-user').value;
    const password = document.getElementById('login-pass').value;
    const errorLabel = document.getElementById('login-error');

    if (!usuario || !password) {
        errorLabel.innerText = "Por favor llena todos los campos.";
        errorLabel.classList.remove('hidden');
        return;
    }

    // Nota: FetchAPI sigue estando en app.js, pero al estar cargados ambos scripts, 
    // login.js puede acceder a ella perfectamente.
    const res = await FetchAPI("login", { usuario, password });
    if (res.success) {
        localStorage.setItem('session_user', res.usuario);
        localStorage.setItem('session_userName', res.userName);
        errorLabel.classList.add('hidden');
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('app-content').classList.remove('hidden');
        document.getElementById('user-display').innerText = res.userName;
        await inicializarSincronizacion();
    } else {
        errorLabel.innerText = res.message;
        errorLabel.classList.remove('hidden');
    }
}

function cerrarSesion() {
    localStorage.removeItem('session_user');
    localStorage.removeItem('session_userName');
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('app-content').classList.add('hidden');
    document.getElementById('login-user').value = "";
    document.getElementById('login-pass').value = "";
}

// --- ARREGLO ACCESIBILIDAD LOGIN ---
// Manejo del formulario de inicio de sesión de forma nativa
document.getElementById('login-form')?.addEventListener('submit', function (e) {
    e.preventDefault();
    ejecutarLogin();
});