// ========================================================
// MÓDULO DE AUTENTICACIÓN (Limpio y Global)
// ========================================================
const AuthModule = {
    togglePasswordVisibility() {
        const passInput = document.getElementById('login-pass');
        const eyeIcon = document.getElementById('eye-icon');
        
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
    
    async ejecutarLogin() {
        const usuarioInput = document.getElementById('login-user');
        const passwordInput = document.getElementById('login-pass');
        const errorLabel = document.getElementById('login-error'); 

        const usuario = usuarioInput ? usuarioInput.value : '';
        const password = passwordInput ? passwordInput.value : '';
        
        if(!usuario || !password) {
            if (errorLabel) {
                errorLabel.innerText = "Por favor llena todos los campos.";
                errorLabel.classList.remove('hidden');
            } else {
                alert("Por favor llena todos los campos.");
            }
            return;
        }

        try {
            const res = await FetchAPI("login", { usuario, password });
            
            if(res && res.success) {
                localStorage.setItem('session_user', res.usuario);
                localStorage.setItem('session_userName', res.userName);
                
                if (errorLabel) {
                    errorLabel.classList.add('hidden');
                }
                window.location.href = "./index.html"; 
            } else {
                const msg = res && res.message ? res.message : "Usuario o contraseña incorrectos.";
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

// Dejar disponible el módulo globalmente en la ventana del navegador
window.AuthModule = AuthModule;
console.log("Módulo AuthModule cargado y listo en el entorno global.");