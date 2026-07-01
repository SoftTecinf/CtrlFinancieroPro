// --- AUTENTICACIÓN ---
async function ejecutarLogin() {
    const usuario = document.getElementById('login-user').value;
    const password = document.getElementById('login-pass').value;
    const errorLabel = document.getElementById('login-error');
    
    if(!usuario || !password) {
        errorLabel.innerText = "Por favor llena todos los campos.";
        errorLabel.classList.remove('hidden');
        return;
    }

    const res = await FetchAPI("login", { usuario, password });
    if(res.success) {
        localStorage.setItem('session_user', res.usuario);
        localStorage.setItem('session_userName', res.userName);
        errorLabel.classList.add('hidden');
        
        // Redirección al panel principal
        window.location.href = "./index.html"; 
    } else {
        errorLabel.innerText = res.message;
        errorLabel.classList.remove('hidden');
    }
}



// Manejo del formulario
document.getElementById('login-form')?.addEventListener('submit', function(e) {
    e.preventDefault();
    ejecutarLogin();
});