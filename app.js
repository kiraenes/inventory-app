console.log("app.js carregado");

// ----------------------------
// ELEMENTOS
// ----------------------------
const loginSection = document.getElementById("login-section");
const contentSection = document.getElementById("content");
const userNameField = document.getElementById("user-name");
const logoutBtn = document.getElementById("logout-btn");
const uploadBtn = document.getElementById("upload-btn");
const statusField = document.getElementById("status");
const fileInput = document.getElementById("file-input");
const selectLocal = document.getElementById("selectLocal");
const addLocalBtn = document.getElementById("add-local-btn");

// ----------------------------
// LOGIN GOOGLE
// ----------------------------
window.handleCredentialResponse = (response) => {
    console.log("Login response:", response);

    const data = parseJwt(response.credential);
    console.log("User data:", data);

    userNameField.textContent = data.name;

    loginSection.style.display = "none";
    contentSection.style.display = "block";

    localStorage.setItem("user", JSON.stringify(data));
};

// JWT decode
function parseJwt(token) {
  var base64Url = token.split('.')[1];
  var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));

  return JSON.parse(jsonPayload);
}

// ----------------------------
// LOGOUT
// ----------------------------
logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("user");
    contentSection.style.display = "none";
    loginSection.style.display = "block";
});

// ----------------------------
// LOCAIS (dropdown funcional)
// ----------------------------
function loadDefaultLocals() {
    selectLocal.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.innerText = "-- Selecionar Local --";
    selectLocal.appendChild(placeholder);

    const defaultLocals = [
        "Hospital Torres Novas",
        "Centro de Saúde Carregueiros",
        "Centro de Saúde Entroncamento"
    ];

    for (const loc of defaultLocals) addLocalToSelect(loc);
}

function addLocalToSelect(localName) {
    const opt = document.createElement("option");
    opt.value = localName;
    opt.innerText = localName;
    selectLocal.appendChild(opt);
}

addLocalBtn.addEventListener("click", () => {
    const novo = prompt("Nome do novo local:");
    if (novo && novo.trim().length > 1) {
        addLocalToSelect(novo.trim());
        selectLocal.value = novo.trim();
    }
});

// ----------------------------
// UPLOAD (placeholder por agora)
// ----------------------------
uploadBtn.addEventListener("click", () => {
    const files = fileInput.files;

    if (!files.length) {
        statusField.textContent = "Nenhuma imagem selecionada.";
        return;
    }

    if (!selectLocal.value) {
        statusField.textContent = "Escolha primeiro um local.";
        return;
    }

    statusField.textContent =
        `Imagens enviadas (${files.length}) do local: ${selectLocal.value}`;
});

// ----------------------------
// AUTO LOGIN
// ----------------------------
document.addEventListener("DOMContentLoaded", () => {
    loadDefaultLocals();
    autoLogin();
});

function autoLogin() {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
        const user = JSON.parse(savedUser);
        userNameField.textContent = user.name;

        loginSection.style.display = "none";
        contentSection.style.display = "block";
    }
}
