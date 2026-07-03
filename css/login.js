// ========================================================
// MÓDULO DE AUTENTICACIÓN
// ========================================================
var AuthModule = {
    // Función para ver/ocultar la contraseña
    togglePasswordVisibility: function () {
        var passInput = document.getElementById('login-pass');
        var eyeIcon = document.getElementById('eye-icon');

        if (!passInput || !eyeIcon) return;
        console.error("por entrar", eyeIcon);
        
        if (passInput.type === 'password') {
            passInput.type = 'text';
            eyeIcon.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
    `;
            console.error("Text", eyeIcon);
        } else {
            passInput.type = 'password';
            eyeIcon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
        <circle cx="12" cy="12" r="3"></circle>
    `;
            console.error("puntos", eyeIcon);
        }
    },

    // Función para procesar el inicio de sesión
    ejecutarLogin: async function () {
        var usuarioInput = document.getElementById('login-user');
        var passwordInput = document.getElementById('login-pass');
        var errorLabel = document.getElementById('login-error');

        var usuario = usuarioInput ? usuarioInput.value : '';
        var password = passwordInput ? passwordInput.value : '';

        if (!usuario || !password) {
            if (errorLabel) {
                errorLabel.innerText = "Por favor llena todos los campos.";
                errorLabel.classList.remove('hidden');
            } else {
                alert("Por favor llena todos los campos.");
            }
            return;
        }

        try {
            // Llama a la API global de app.js
            var res = await FetchAPI("login", { usuario: usuario, password: password });

            if (res && res.success) {
                localStorage.setItem('session_user', res.usuario);
                localStorage.setItem('session_userName', res.userName);

                if (errorLabel) {
                    errorLabel.classList.add('hidden');
                }
                window.location.href = "./index.html";
            } else {
                var msg = res && res.message ? res.message : "Usuario o contraseña incorrectos.";
                if (errorLabel) {
                    errorLabel.innerText = msg;
                    errorLabel.classList.remove('hidden');
                } else {
                    alert(msg);
                }
            }
        } catch (err) {
            console.error("Error en la petición de login:", err);
            alert("Hubo un problema al conectar con el servidor.");
        }
    }
};

// Lo registramos de forma ultra-directa en la ventana global
window.AuthModule = AuthModule;
console.log("--> login.js cargado y AuthModule listo para usarse.");
