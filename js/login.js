// ========================================================
// MÓDULO DE AUTENTICACIÓN
// ========================================================
var AuthModule = {

    // Función para ver/ocultar la contraseña
    togglePasswordVisibility: function () {
        var passInput = document.getElementById('login-pass');
        var eyeOpen = document.getElementById('eye-open');
        var eyeClosed = document.getElementById('eye-closed');

        if (!passInput) return;

        if (passInput.type === 'password') {
            passInput.type = 'text';
            eyeOpen.style.display = 'none';
            eyeClosed.style.display = 'block';
        } else {
            passInput.type = 'password';
            eyeOpen.style.display = 'block';
            eyeClosed.style.display = 'none';
        }
    },

    // Función para procesar el inicio de sesión
    ejecutarLogin: async function (event) {
        if (event) event.preventDefault(); // Aseguramos que el evento exista

        // 1. Obtener valores
        var usuario = document.getElementById('login-user').value;
        var password = document.getElementById('login-pass').value;

        // 2. Validación básica de campos vacíos
        if (!usuario || !password) {
            alert("Por favor llena todos los campos.");
            return;
        }

        // ==========================================
        // 🧪 CÓDIGO DE TESTING: ANTES DE ENVIAR
        // ==========================================
        console.log("🚀 Iniciando prueba de conexión...");
        console.log("Enviando credenciales -> Usuario:", usuario, " | Pass:", password);

        try {
            // 3. Petición única al servidor
            var res = await FetchAPI("login", { user: usuario, pass: password });

            // ==========================================
            // 🧪 CÓDIGO DE TESTING: RESPUESTA RECIBIDA
            // ==========================================
            console.log("📦 Respuesta CRUDA de Google Sheets:", res);

            // 4. Procesar respuesta
            if (res && res.success) {
                // 🧪 Aviso visible de éxito
                alert("¡Conexión exitosa! El backend respondió bien. Revisa la consola.");

                // Guardamos correctamente en localStorage
                localStorage.setItem('session_user', res.usuario);
                localStorage.setItem('isLoggedIn', 'true');

                // 🧪 COMENTAMOS TEMPORALMENTE LA REDIRECCIÓN
                // Para que la página no cambie y puedas leer la consola tranquilamente
                // window.location.href = "./index.html"; 
                console.log("🟢 Login correcto. Redirección pausada por testing.");
            } else {
                // Manejo de error de credenciales
                var msg = res && res.message ? res.message : "Usuario o contraseña incorrectos.";

                // 🧪 Imprimimos el error exacto en consola
                console.error("🔴 El servidor rechazó el login. Razón:", msg);

                var errorLabel = document.getElementById('error-label'); // Asegúrate de tener este ID

                if (errorLabel) {
                    errorLabel.innerText = msg;
                    errorLabel.classList.remove('hidden');
                } else {
                    alert(msg);
                }
            }
        } catch (err) {
            // 5. Manejo de error de conexión
            console.error("❌ Error CRÍTICO en la petición de login (Probable CORS):", err);
            alert("Hubo un problema al conectar con el servidor.");
        }
    }
};

// Lo registramos en la ventana global
window.AuthModule = AuthModule;

// 2. Y al final colocas el escuchador
document.addEventListener('DOMContentLoaded', function () {
    var btn = document.getElementById('btn-toggle-pass');
    if (btn) {
        btn.addEventListener('click', AuthModule.togglePasswordVisibility);
    }
});