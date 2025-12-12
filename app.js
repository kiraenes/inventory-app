/* ======================
   CONFIG - substitui se necessário
   ====================== */
const CLIENT_ID = "576401061914-q9pij2kuo6l9ncp2qun7bo6bmpd7ng31.apps.googleusercontent.com";
const SCOPES = "https://www.googleapis.com/auth/drive.file";

/* ======================
   Estado
   ====================== */
let tokenClient = null;
let accessToken = null;
let userEmail = null;
let userJsonFileId = null; // id do inventario_<email>.json no Drive
let currentLocal = "";
let currentSala = "";
let devices = []; // array de objetos processados (antes de gravar)

/* ======================
   DOM
   ====================== */
const btnLogin = document.getElementById("btnLogin");
const loginArea = document.getElementById("loginArea");
const appArea = document.getElementById("appArea");
const selectLocal = document.getElementById("selectLocal");
const newLocalInput = document.getElementById("newLocalInput");
const btnAddLocal = document.getElementById("btnAddLocal");
const salaInput = document.getElementById("salaInput");
const portaFoto = document.getElementById("portaFoto");
const btnScanPorta = document.getElementById("btnScanPorta");
const tipoDevice = document.getElementById("tipoDevice");
const tipoOutro = document.getElementById("tipoOutro");
const devicePhotos = document.getElementById("devicePhotos");
const btnProcessDevice = document.getElementById("btnProcessDevice");
const devicesList = document.getElementById("devicesList");
const btnSaveAll = document.getElementById("btnSaveAll");
const btnExportCSV = document.getElementById("btnExportCSV");
const status = document.getElementById("status");
const userBadge = document.getElementById("userBadge");

/* ======================
   Inicializar GSI token client
   ====================== */
window.onload = () => {
  initGsiTokenClient();
  loadDefaultLocals();
};

function initGsiTokenClient() {
  // espera que 'google' exista
  const attempt = () => {
    if (window.google && google.accounts && google.accounts.oauth2) {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.error) {
            console.error("Erro token:", resp);
            alert("Erro no login: " + (resp.error || "ver console"));
            return;
          }
          accessToken = resp.access_token;
          localStorage.setItem("google_token", accessToken);
          afterLogin();
        }
      });
    } else {
      setTimeout(attempt, 200);
    }
  };
  attempt();
}

/* -----------------------
   Login
   ----------------------- */
btnLogin.addEventListener("click", () => {
  if (!tokenClient) return alert("A carregar Google Identity... tenta em 1s");
  tokenClient.requestAccessToken();
});

async function afterLogin() {
  // obter email do user
  const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: "Bearer " + accessToken }
  });
  const u = await r.json();
  userEmail = u.email;
  userBadge.innerText = `${u.name || u.email}`;
  loginArea.classList.add("hidden");
  appArea.classList.remove("hidden");
  status.innerText = "Login OK. A preparar ficheiro no Drive...";
  await ensureUserJson();
}

/* ======================
   Locais
   ====================== */
function loadDefaultLocals() {
  const defaults = [
    "Hospital Torres Novas",
    "Centro de Saúde Carregueiros",
    "Centro de Saúde Entroncamento"
  ];
  for (const l of defaults) addLocalToSelect(l);
}

btnAddLocal.addEventListener("click", () => {
  const v = newLocalInput.value.trim();
  if (!v) return;
  addLocalToSelect(v, true);
  newLocalInput.value = "";
});

function addLocalToSelect(name, selectNow = false) {
  const opt = document.createElement("option");
  opt.value = name;
  opt.innerText = name;
  selectLocal.appendChild(opt);
  if (selectNow) selectLocal.value = name;
}

/* ======================
   Sala / Porta OCR
   ====================== */
btnScanPorta.addEventListener("click", async () => {
  if (!portaFoto.files.length) return alert("Escolhe a foto da porta primeiro.");
  const file = portaFoto.files[0];
  status.innerText = "A enviar foto da porta ao Drive...";
  const fileId = await uploadToDrive(file);
  status.innerText = "A processar OCR da porta...";
  const txt = await driveOCR(fileId);
  // tentativa simples de extrair "Sala" ou número (regex)
  const salaMatch = txt.match(/Sala[:\s-]*([A-Za-z0-9 ]{1,30})/i) ||
                    txt.match(/\b(\d{2,4})\b/);
  if (salaMatch) {
    salaInput.value = salaMatch[1] ? salaMatch[1].toString().trim() : salaMatch[0];
    status.innerText = "Sala detectada (confirma/edita se necessário).";
  } else {
    status.innerText = "Não foi possível detectar automaticamente a sala. Edita manualmente.";
  }
});

/* ======================
   Tipo device UI
   ====================== */
tipoDevice.addEventListener("change", () => {
  if (tipoDevice.value === "outro") tipoOutro.style.display = "block";
  else tipoOutro.style.display = "none";
});

/* ======================
   Processar fotos de dispositivo (agrupa e parse)
   ====================== */
btnProcessDevice.addEventListener("click", async () => {
  const local = selectLocal.value || "";
  const salaVal = salaInput.value.trim();
  if (!local) return alert("Selecciona ou adiciona o Local.");
  if (!salaVal) return alert("Indica a Sala (ou tira foto da porta).");

  const tipo = tipoDevice.value === "outro" ? (tipoOutro.value.trim() || "Outro") : tipoDevice.value;
  if (!tipo) return alert("Escolhe o tipo de dispositivo.");

  if (!devicePhotos.files.length) return alert("Escolhe pelo menos 1 foto do dispositivo.");

  status.innerText = "A enviar fotos e a processar OCR (pode demorar uns segundos)...";

  // enviar cada foto, fazer OCR e juntar textos
  const files = Array.from(devicePhotos.files);
  const ocrTexts = [];
  const photoUrls = [];
  for (const f of files) {
    const up = await uploadToDrive(f);
    photoUrls.push(`https://drive.google.com/file/d/${up.id}/view`);
    const t = await driveOCR(up.id);
    ocrTexts.push(t);
  }

  // juntar todo o texto das fotos (mais dados)
  const joinedText = ocrTexts.join("\n\n");

  // extrair campos
  const marca = extractMarca(joinedText);
  const modelo = extractModelo(joinedText);
  const serial = extractSerial(joinedText);
  const inventario = extractInventario(joinedText);
  const ip = extractIp(joinedText);

  // criar objeto dispositivo (pré-guardável/editável)
  const device = {
    local: local,
    sala: salaVal,
    tipo: tipo,
    marca: marca || "",
    modelo: modelo || "",
    serial: serial || "",
    inventario: inventario || "",
    ip: ip || "",
    fotos: photoUrls,
    ocr_raw: joinedText,
    createdAt: new Date().toISOString()
  };

  // adicionar à lista temporária e renderizar
  devices.unshift(device);
  renderDevices();
  status.innerText = "Dispositivo processado — revisa e guarda.";
  // limpar input
  devicePhotos.value = "";
});

/* ======================
   Render devices (editar antes de guardar)
   ====================== */
function renderDevices() {
  devicesList.innerHTML = "";
  devices.forEach((d, idx) => {
    const card = document.createElement("div");
    card.className = "deviceCard";

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between">
        <strong>${d.tipo} — ${d.marca || "—"} ${d.modelo || ""}</strong>
        <button data-idx="${idx}" class="delBtn">Eliminar</button>
      </div>
      <div class="deviceRow">
        <label>Local: <input data-field="local" data-idx="${idx}" value="${escapeHtml(d.local)}" /></label>
        <label>Sala: <input data-field="sala" data-idx="${idx}" value="${escapeHtml(d.sala)}" /></label>
        <label>Tipo: <input data-field="tipo" data-idx="${idx}" value="${escapeHtml(d.tipo)}" /></label>
        <label>Marca: <input data-field="marca" data-idx="${idx}" value="${escapeHtml(d.marca)}" /></label>
        <label>Modelo: <input data-field="modelo" data-idx="${idx}" value="${escapeHtml(d.modelo)}" /></label>
        <label>Serial: <input data-field="serial" data-idx="${idx}" value="${escapeHtml(d.serial)}" /></label>
        <label>Inventário: <input data-field="inventario" data-idx="${idx}" value="${escapeHtml(d.inventario)}" /></label>
        <label>IP: <input data-field="ip" data-idx="${idx}" value="${escapeHtml(d.ip)}" /></label>
      </div>
      <div style="margin-top:8px">
        <button data-idx="${idx}" class="saveDevice">Guardar este dispositivo</button>
        <button data-idx="${idx}" class="downloadOCR">Ver OCR</button>
      </div>
    `;
    devicesList.appendChild(card);
  });

  // attach events
  devicesList.querySelectorAll(".delBtn").forEach(b => {
    b.addEventListener("click", (ev) => {
      const i = Number(ev.target.dataset.idx);
      devices.splice(i,1);
      renderDevices();
    });
  });
  devicesList.querySelectorAll(".saveDevice").forEach(b => {
    b.addEventListener("click", async (ev) => {
      const i = Number(ev.target.dataset.idx);
      await saveSingleDevice(i);
    });
  });
  devicesList.querySelectorAll(".downloadOCR").forEach(b => {
    b.addEventListener("click", (ev) => {
      const i = Number(ev.target.dataset.idx);
      alert(devices[i].ocr_raw.slice(0,3000) || "—");
    });
  });

  // input edits
  devicesList.querySelectorAll('input[data-field]').forEach(inp => {
    inp.addEventListener("change", (ev) => {
      const idx = Number(ev.target.dataset.idx);
      const field = ev.target.dataset.field;
      devices[idx][field] = ev.target.value;
    });
  });
}

/* ======================
   Guardar / Exportar
   ====================== */
btnSaveAll.addEventListener("click", async () => {
  if (!devices.length) return alert("Não há dispositivos para guardar.");
  status.innerText = "A guardar todos dispositivos no ficheiro JSON do Drive...";
  await ensureUserJson(); // garante userJsonFileId
  // obter JSON existente
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${userJsonFileId}?alt=media`, {
    headers: { Authorization: "Bearer " + accessToken }
  });
  const data = await res.json();
  data.salas = data.salas || {};
  for (const d of devices) {
    if (!data.salas[d.sala]) data.salas[d.sala] = { local: d.local, equipamentos: [] };
    data.salas[d.sala].equipamentos.push(d);
  }
  await updateDriveFile(userJsonFileId, JSON.stringify(data));
  devices = [];
  renderDevices();
  status.innerText = "Guardado com sucesso no Drive.";
});

btnExportCSV.addEventListener("click", () => {
  if (!devices.length) return alert("Sem dados para exportar.");
  const rows = devices.map(d => [
    d.local, d.sala, "", d.tipo, d.marca, d.modelo, d.serial, d.inventario, d.ip, "", d.fotos.join(";"), d.createdAt
  ]);
  const header = ["Local","Sala","Secretária/Mesa","Tipo","Marca","Modelo","Nº Série","Nº Inventário","IP","Utilizador","Fotos","Data"];
  const csv = [header, ...rows].map(r => r.map(cell => `"${String(cell||"").replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `inventario_export_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
});

/* ======================
   Funções Drive: upload, ocr, criar/atualizar JSON
   ====================== */

async function uploadToDrive(file) {
  const metadata = { name: `foto_${Date.now()}_${file.name}`, mimeType: file.type };
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
  // export to text/plain (Drive's OCR via Google Docs)
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`, {
    headers: { Authorization: "Bearer " + accessToken }
  });
  if (!res.ok) {
    console.error("driveOCR erro", await res.text());
    return "";
  }
  return res.text();
}

async function ensureUserJson() {
  if (!userEmail) throw new Error("User email unknown");
  if (userJsonFileId) return;
  const fileName = `inventario_${userEmail}.json`;
  // procurar
  const q = encodeURIComponent(`name='${fileName}' and trashed=false`);
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: "Bearer " + accessToken }
  });
  const js = await res.json();
  if (js.files && js.files.length) {
    userJsonFileId = js.files[0].id;
    return;
  }
  // criar novo
  const empty = JSON.stringify({ salas: {} });
  const metadata = { name: fileName, mimeType: "application/json" };
  const boundary = "----createboundary" + Date.now();
  const body =
    `--${boundary}\r\n` +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) + `\r\n` +
    `--${boundary}\r\n` +
    "Content-Type: application/json\r\n\r\n" +
    empty + `\r\n` +
    `--${boundary}--`;
  const createRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": `multipart/related; boundary=${boundary}`
    },
    body: body
  });
  const createJson = await createRes.json();
  userJsonFileId = createJson.id;
}

async function updateDriveFile(fileId, content) {
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
    method: "PATCH",
    headers: { Authorization: "Bearer " + accessToken, "Content-Type": "application/json" },
    body: content
  });
  return res.json();
}

/* ======================
   Parsers (regex básicos)
   ====================== */

function extractInventario(text) {
  if (!text) return "";
  const m = text.match(/\b(ULS[\s-]*\d{3,7}|AMI[\s-]*\d{3,7}|ULS[:\s-]*\d{3,7})\b/i);
  return m ? m[0].replace(/\s+/g," ").trim() : "";
}

function extractSerial(text) {
  if (!text) return "";
  // alguma variação típica: S/N, SN:, Serial:
  const m = text.match(/\b(?:S\/?N|SN|Serial|Serial No|Service Tag)[:\s\-]*([A-Z0-9\-]{4,})\b/i);
  if (m) return (m[1]||m[0]).trim();
  // fallback: long alphanum token
  const m2 = text.match(/\b([A-Z0-9]{6,})\b/gi);
  return m2 ? m2[0] : "";
}

function extractIp(text) {
  if (!text) return "";
  const m = text.match(/\b\d{1,3}(\.\d{1,3}){3}\b/);
  return m ? m[0] : "";
}

function extractMarca(text) {
  if (!text) return "";
  const brands = ["DELL","HP","LENOVO","ASUS","ACER","SAMSUNG","APPLE","BROTHER","CANON","EPSON","XEROX"];
  const up = text.toUpperCase();
  for (const b of brands) if (up.includes(b)) return b.charAt(0)+b.slice(1).toLowerCase();
  return "";
}

function extractModelo(text) {
  if (!text) return "";
  // heurística: procurar palavra(s) depois da marca
  const up = text;
  // simplificado: buscar padrões com palavras+num
  const m = up.match(/\b([A-Za-z0-9\-]{3,}\s?[A-Za-z0-9\-]{0,})\b/);
  return m ? m[0].trim() : "";
}

/* ======================
   Util helpers
   ====================== */
function escapeHtml(s){ return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
async function saveSingleDevice(idx) {
  const d = devices[idx];
  // garantir file json
  await ensureUserJson();
  // carregar conteúdo atual
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${userJsonFileId}?alt=media`, {
    headers: { Authorization: "Bearer " + accessToken }
  });
  const data = await r.json();
  data.salas = data.salas || {};
  if (!data.salas[d.sala]) data.salas[d.sala] = { local: d.local, equipamentos: [] };
  data.salas[d.sala].equipamentos.push(d);
  await updateDriveFile(userJsonFileId, JSON.stringify(data));
  devices.splice(idx,1);
  renderDevices();
  status.innerText = "Dispositivo guardado no Drive.";
}
