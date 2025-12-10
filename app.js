// =====================================================
// GOOGLE OAUTH LOGIN
// =====================================================

let tokenClient;
let accessToken = null;

function initializeGoogleAuth() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: "576401061914-q9pij2kuo6l9ncp2qun7bo6bmpd7ng31.apps.googleusercontent.com",
        scope: "https://www.googleapis.com/auth/drive.file",
        callback: (response) => {
            if (response.access_token) {
                accessToken = response.access_token;
                document.getElementById("loginSection").style.display = "none";
                document.getElementById("appSection").style.display = "block";
                console.log("Login OK!");
            }
        }
    });
}

function googleLogin() {
    tokenClient.requestAccessToken();
}

window.onload = initializeGoogleAuth;

// =====================================================
// SALA / UTILIZADOR
// =====================================================

let currentSala = null;
let currentLocal = null;
let currentUser = null;
let currentShared = null;

function confirmarSala() {
    currentLocal = document.getElementById("local").value;
    currentSala = document.getElementById("sala").value;
    currentUser = document.getElementById("utilizador").value;
    currentShared = document.getElementById("partilhada").value;

    if (!currentLocal || !currentSala) {
        alert("Local e Sala são obrigatórios.");
        return;
    }

    document.getElementById("equipSection").style.display = "block";
    alert("Sala confirmada! Agora podes enviar fotos dos equipamentos.");
}

function novaSala() {
    currentSala = null;
    currentLocal = null;
    currentUser = null;
    currentShared = null;

    document.getElementById("equipSection").style.display = "none";
    alert("Sala limpa! Seleciona a nova sala.");
}

// =====================================================
// UPLOAD + OCR
// =====================================================

async function processarFoto() {
    const fileInput = document.getElementById("foto");
    const file = fileInput.files[0];

    if (!file) {
        alert("Escolhe uma foto primeiro!");
        return;
    }

    if (!accessToken) {
        alert("Precisas de iniciar sessão primeiro.");
        return;
    }

    const tipo = document.getElementById("tipo").value;
    let tipoFinal = tipo;

    if (tipo === "outro") {
        tipoFinal = document.getElementById("tipoOutro").value || "Outro";
    }

    // 1️⃣ Upload para Google Drive
    const uploadRes = await uploadToDrive(file);

    if (!uploadRes.id) {
        alert("Erro ao enviar a foto para o Drive.");
        return;
    }

    // 2️⃣ Pedir OCR ao Drive
    const ocrText = await driveOCR(uploadRes.id);

    // 3️⃣ Mostrar resultado
    mostrarResultado(tipoFinal, ocrText);

    fileInput.value = "";
}

async function uploadToDrive(file) {
    const metadata = {
        name: file.name,
        mimeType: file.type
    };

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", file);

    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { Authorization: "Bearer " + accessToken },
        body: form
    });

    return res.json();
}

async function driveOCR(fileId) {
    const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`,
        {
            method: "GET",
            headers: { Authorization: "Bearer " + accessToken }
        }
    );

    return res.text();
}

// =====================================================
// MOSTRAR RESULTADOS
// =====================================================

function mostrarResultado(tipo, texto) {
    const container = document.getElementById("result");

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
        <h3>${tipo}</h3>
        <p><b>Local:</b> ${currentLocal}</p>
        <p><b>Sala:</b> ${currentSala}</p>
        <p><b>Utilizador:</b> ${currentUser || "—"}</p>
        <pre>${texto}</pre>
    `;

    container.prepend(card);
}
