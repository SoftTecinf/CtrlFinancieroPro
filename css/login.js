// ========================================================
// MÓDULO DE AUTENTICACIÓN
// ========================================================
const AuthModule = {
    // Función para ver/ocultar la contraseña con el icono del ojo
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
    
    // Función principal para procesar el inicio de sesión
    async ejecutarLogin() {
        const usuarioInput = document.getElementById('login-user');
        const passwordInput = document.getElementById('login-pass');
        const errorLabel = document.getElementById('login-error'); 

        // Verificamos que los inputs existan en el HTML para evitar caídas
        const usuario = usuarioInput ? usuarioInput.value : '';
        const password = passwordInput ? passwordInput.value : '';
        
        // Validación de campos vacíos
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
            // Envía los datos a tu Google Apps Script de forma segura
            const res = await FetchAPI("login", { usuario, password });
            
            if(res && res.success) {
                // Guarda los datos de sesión devueltos por el excel en el navegador
                localStorage.setItem('session_user', res.usuario);
                localStorage.setItem('session_userName', res.userName);
                
                // Si existe la etiqueta de error, la ocultamos de forma segura
                if (errorLabel) {
                    errorLabel.classList.add('hidden');
                }
                
                // Redirección exitosa al panel principal
                window.location.href = "./index.html"; 
            } else {
                // Si las credenciales fallan o el servidor avisa un error
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

// ========================================================
// ESCUCHADORES DE EVENTOS ULTRA SEGUROS Y CON LOGS
// ========================================================

// Escuchador global para atrapar cualquier clic en la pantalla
document.addEventListener('click', function(e) {
    // Buscamos si el clic viene del botón o de algo adentro de él
    const botonOjo = e.target.id === 'btn-toggle-pass' || e.target.closest('#btn-toggle-pass');
    
    if (botonOjo) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log("¡Clic detectado en el botón del ojo! Ejecutando togglePasswordVisibility...");
        AuthModule.togglePasswordVisibility();
    }
});

// Escuchador global para el envío del formulario
document.addEventListener('submit', function(e) {
    if (e.target && e.target.id === 'login-form') {
        e.preventDefault();
        
        console.log("¡Intento de envío de formulario detectado! Ejecutando ejecutarLogin...");
        AuthModule.ejecutarLogin();
    }
});

console.log("Sistema de eventos de Login activo con logs de diagnóstico.");