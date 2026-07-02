// ========================================================
// MÓDULO DE AUTENTICACIÓN
// ========================================================
var AuthModule = {
    // Función para ver/ocultar la contraseña
    togglePasswordVisibility: function() {
        var passInput = document.getElementById('login-pass');
        var eyeIcon = document.getElementById('eye-icon');
        
        if (!passInput || !eyeIcon) return; 

        if (passInput.type === 'password') {
            passInput.type = 'text';
            eyeIcon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
                <line x1="1" y1="1" x2="23" y2="23"></line>
            `;
        } else {
            passInput.type = 'password';
            eyeIcon.innerHTML = `
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            `;
        }
    },
    
    // Función para procesar el inicio de sesión
    ejecutarLogin: async function() {
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