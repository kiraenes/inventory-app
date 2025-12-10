// ===============================
// CONFIGURAÇÕES
// ===============================

const CLIENT_ID = "576401061914-q9pij2kuo6l9ncp2qun7bo6bmpd7ng31.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

let accessToken = null;
let userEmail = null;
let currentSala = {};
let userJsonFileId = null;

// ===============================
// LOGIN GOOGLE
// ===============================

document.getElementById("login-btn").addEventListener("click", () => {
    google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (token) => {
            accessToken = token.access_token;
            localStorage.setItem("google_token", accessToken);

            getUserInfo().then(email => {
                userEmail = email;
                initUserDriveFiles();
                showApp();
            });
        }
    }).requestAccessToken();
});

async function getUserInfo() {
    const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await r.json();
    return data.email;
}

function showApp() {
    document.getElementById("login-section").classList.add("hidden");
    document.getElementById("app-section").classList.remove("hidden");
}

// ===============================
// JSON DO UTILIZADOR
// ===============================

async function initUserDriveFiles() {

    const fileName = `inventario_${userEmail}.json`;

    const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='${fileName}'&fields=files(id)`;

    const r = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = await r.json();

    if (data.files.length > 0) {
        userJsonFileId = data.files[0].id;
        return;
    }

    const emptyJson = JSON.stringify({ salas: {} });

    const createRes = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}` },
            body: new FormData()
        }
    );

    // Simples criação (versão mais curta)
    const metadata = {
        name: fileName,
        mimeType: "application/json"
    };

    const boundary = "boundary12345";
    const body =
        `--${boundary}\r\n` +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\n` +
        "Content-Type: application/json\r\n\r\n" +
        emptyJson +
        `\r\n--${boundary}--`;

    const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": `multipart/related; boundary=${boundary}`
            },
            body: body
        }
    );

    const json = await res.json();
    userJsonFileId = json.id;
}

// ===============================
// CONFIRMAR SALA
// ===============================

document.getElementById("confirmSala").addEventListener("click", () => {

    currentSala = {
        local: document.getElementById("local").value,
        sala: document.getElementById("sala").value,
        user: document.getElementById("userName").value || null,
        common: document.getElementById("commonDesk").checked,
        equipamentos: []
    };

    document.getElementById("status").innerText =
        `Sala ativa: ${currentSala.local} - ${currentSala.sala}`;
});

// ===============================
// UPLOAD FOTO + OCR
// ===============================

document.getElementById("uploadPhoto").addEventListener("click", async () => {

    const fileInput = document.getElementById("photoInput");
    if (!fileInput.files.length) {
        alert("Seleciona uma foto!");
        return;
    }

    const photo = fileInput.files[0];

    document.getElementById("status").innerText = "A enviar foto...";

    const fileId = await uploadToDrive(photo);

    document.getElementById("status").innerText = "A processar OCR...";

    const text = await driveOCR(fileId);

    const equipamento = parseEquipment(text, fileId);

    currentSala.equipamentos.push(equipamento);

    await saveToJson();

    document.getElementById("status").innerText = "Equipamento guardado!";
});

// ===============================
// UPLOAD DRIVE
// ===============================

async function uploadToDrive(file) {

    const metadata = {
        name: "foto_inventario.jpg",
        mimeType: file.type
    };

    const boundary = "xxxxxxxxxx";
    const body =
        `--${boundary}\r\n` +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        `\r\n--${boundary}\r\n` +
        `Content-Type: ${file.type}\r\n\r\n`;

    const bodyEnd = `\r\n--${boundary}--`;

    const fullBody = new Blob([body, file, bodyEnd]);

    const res = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": `multipart/related; boundary=${boundary}`
            },
            body: fullBody
        }
    );

    const data = await res.json();
    return data.id;
}

// ===============================
// OCR DRIVE
// ===============================

async function driveOCR(fileId) {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;

    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    return await res.text();
}

// ===============================
// EXTRAÇÃO DE CAMPOS (Regex simples)
// ===============================

function parseEquipment(text, fileId) {
    return {
        raw: text,
        foto: `https://drive.google.com/file/d/${fileId}/view`,
        data: new Date().toISOString(),
        tipo: guess(text, /(pc|monitor|hp|lenovo|impressora|telefone)/i),
        marca: guess(text, /(dell|hp|lenovo|asus|canon|epson|ricoh)/i),
        modelo: guess(text, /([A-Za-z0-9\-]{4,})/),
        serial: guess(text, /(sn[:\s]*[a-z0-9\-]+)/i),
        inventario: guess(text, /(uls\s*\d{6})/i),
        ip: guess(text, /\b\d{1,3}(\.\d{1,3}){3}\b/)
    };
}

function guess(text, regex) {
    const m = text.match(regex);
    return m ? m[0] : null;
}

// ===============================
// GUARDAR NO JSON
// ===============================

async function saveToJson() {

    const r = await fetch(
        `https://www.googleapis.com/drive/v3/files/${userJsonFileId}?alt=media`,
        {
            headers: { Authorization: `Bearer ${accessToken}` }
        }
    );

    const data = await r.json();

    if (!data.salas[currentSala.sala]) {
        data.salas[currentSala.sala] = currentSala;
    } else {
        data.salas[currentSala.sala].equipamentos.push(
            ...currentSala.equipamentos
        );
    }

    const updatedJson = JSON.stringify(data);

    await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${userJsonFileId}?uploadType=media`,
        {
            method: "PATCH",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json"
            },
            body: updatedJson
        }
    );
}
