console.log("app.js carregado");

// ELEMENTOS
const loginSection = document.getElementById("login-section");
const contentSection = document.getElementById("content");
const userNameField = document.getElementById("user-name");
const logoutBtn = document.getElementById("logout-btn");
const uploadBtn = document.getElementById("upload-btn");
const statusField = document.getElementById("status");
const fileInput = document.getElementById("file-input");

/* -------------------------------
      LOGIN GOOGLE
--------------------------------*/

// Torna a função GLOBAL (obrigatório)
window.handleCredentialResponse = (response) => {
    console.log("Login response:", response);

    const data = parseJwt(response.credential);
    console.log("User data:", data);

    userNameField.textContent = data.name;

    loginSection.style.display = "none";
    contentSection.style.display = "block";

    localStorage.setItem("user", JSON.stringify(data));
};

// Função para decodificar JWT
function parseJwt(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
}

/* -------------------------------
      LOGOUT
--------------------------------*/
logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("user");
    contentSection.style.display = "none";
    loginSection.style.display = "block";
});

/* -------------------------------
     UPLOAD FOTOS (placeholder)
--------------------------------*/
uploadBtn.addEventListener("click", () => {
    const files = fileInput.files;

    if (!files.length) {
        statusField.textContent = "Nenhuma imagem selecionada.";
        return;
    }

    statusField.textContent = `Você enviou ${files.length} imagens (placeholder).`;
});

/* -------------------------------
     AUTO LOGIN SE JÁ EXISTE
--------------------------------*/
window.onload = () => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
        const user = JSON.parse(savedUser);
        userNameField.textContent = user.name;

        loginSection.style.display = "none";
        contentSection.style.display = "block";
    }
};
