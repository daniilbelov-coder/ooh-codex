// #region agent log
console.log('[DEBUG UI] ui.ts script loaded at', Date.now());
// #endregion

// --- DOM refs ---
const apiKeyInput = document.getElementById("apiKey") as HTMLInputElement;
const loadMasterBtn = document.getElementById("loadMasterBtn") as HTMLButtonElement;
const masterStatus = document.getElementById("masterStatus") as HTMLDivElement;
const screenshotInput = document.getElementById("screenshotInput") as HTMLInputElement;
const screenshotUploadArea = document.getElementById("screenshotUploadArea") as HTMLLabelElement;
const layoutStatus = document.getElementById("layoutStatus") as HTMLDivElement;
const ttInput = document.getElementById("ttInput") as HTMLInputElement;
const ttUploadArea = document.getElementById("ttUploadArea") as HTMLLabelElement;
const ttFromFigmaBtn = document.getElementById("ttFromFigmaBtn") as HTMLButtonElement;
const ttFromFigmaStatus = document.getElementById("ttFromFigmaStatus") as HTMLDivElement;
const specsBox = document.getElementById("specsBox") as HTMLDivElement;
const textSection = document.getElementById("textSection") as HTMLDivElement;
const headlineInput = document.getElementById("headlineInput") as HTMLTextAreaElement;
const sublineInput = document.getElementById("sublineInput") as HTMLTextAreaElement;
const disclaimerInput = document.getElementById("disclaimerInput") as HTMLTextAreaElement;
const generateBtn = document.getElementById("generateBtn") as HTMLButtonElement;
const errorMsg = document.getElementById("errorMsg") as HTMLDivElement;

// --- State ---
let masterLoaded = false;
let parsedSpecs: any = null;
let layoutAnalysis: any = null;

// --- Replicate helpers (дублируем, т.к. ui.ts изолирован от plugin main thread) ---
// ВАЖНО: если используем прокси, укажите полный base URL до /v1 (например: https://your-app.up.railway.app/v1)
const REPLICATE_BASE = "https://api.replicate.com/v1";

function getApiKey(): string { return apiKeyInput.value.trim(); }
function usingProxy(): boolean { return !REPLICATE_BASE.includes("api.replicate.com"); }

async function replicateUpload(blob: Blob): Promise<string> {
  const fd = new FormData();
  fd.append("content", blob);
  const res = await fetch(`${REPLICATE_BASE}/files`, {
    method: "POST",
    headers: usingProxy() ? {} : { Authorization: `Token ${getApiKey()}` },
    body: fd,
  });
  return (await res.json()).urls.get;
}

async function replicatePoll(id: string): Promise<string> {
  while (true) {
    const res = await fetch(`${REPLICATE_BASE}/predictions/${id}`, {
      headers: usingProxy() ? {} : { Authorization: `Token ${getApiKey()}` },
    });
    const d = await res.json();
    if (d.status === "succeeded") return d.output;
    if (d.status === "failed") throw new Error(d.error || "Prediction failed");
    await new Promise(r => setTimeout(r, 1500));
  }
}

async function replicateRun(prompt: string, imageBlob: Blob): Promise<string> {
  const url = await replicateUpload(imageBlob);
  const res = await fetch(`${REPLICATE_BASE}/predictions`, {
    method: "POST",
    headers: usingProxy()
      ? { "Content-Type": "application/json" }
      : { Authorization: `Token ${getApiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "openai/gpt-4o", input: { prompt, image: url } }),
  });
  const pred = await res.json();
  return replicatePoll(pred.id);
}

function cleanJson(raw: string): any {
  return JSON.parse(raw.replace(/```json\n?/g, "").replace(/```/g, "").trim());
}

// --- Промпты ---
const PARSE_PROMPT = `You are a parser for outdoor advertising technical specifications.
From the provided image extract parameters and return ONLY valid JSON, no text, no markdown, no code blocks:
{"name":"string","total_width_cm":number,"total_height_cm":number,"text_zone_width_cm":number|null,"text_zone_height_cm":number|null,"has_frame":boolean,"dpi":number,"color_mode":"CMYK"|"RGB","output_format":"string","notes":"string|null"}
If a parameter cannot be determined set it to null.`;

const LAYOUT_PROMPT = `You are an advertising layout analyst.
Look at this outdoor advertising banner image and determine the layout structure.
Return ONLY valid JSON:
{"photo_zone":"left"|"right"|"full","text_zone":"left"|"right"|"none","photo_x":number 0-1,"photo_y":number 0-1,"photo_scale":number >=1,"split_ratio":number 0-1}
photo_x/y = center of photo position (0.5=center). split_ratio = fraction of width for photo.
Full background = photo_zone "full", split_ratio 1.0`;

// #region agent log
console.log('[DEBUG UI] loadMasterBtn element:', loadMasterBtn);
// #endregion

// --- Загрузка мастера из Figma ---
loadMasterBtn.addEventListener("click", () => {
  parent.postMessage({ pluginMessage: { type: "READ_MASTER" } }, "*");
  masterStatus.textContent = "Загрузка мастера...";
  masterStatus.className = "status";
});

// --- Скриншот мастера для анализа layout ---
screenshotInput.addEventListener("change", async () => {
  const file = screenshotInput.files?.[0];
  if (!file) return;
  screenshotUploadArea.classList.add("active");
  screenshotUploadArea.textContent = "✓ " + file.name;

  if (!usingProxy() && !getApiKey()) { showError("Введите API Key"); return; }
  layoutStatus.textContent = "Анализ layout...";
  showError("");

  try {
    const raw = await replicateRun(LAYOUT_PROMPT, file);
    layoutAnalysis = cleanJson(raw);
    layoutStatus.textContent = `✓ Layout: фото ${layoutAnalysis.photo_zone}, текст ${layoutAnalysis.text_zone}, split ${layoutAnalysis.split_ratio}`;
    layoutStatus.className = "status ok";
    checkReady();
  } catch (e: any) {
    showError("Ошибка анализа layout: " + e.message);
  }
});

// --- Загрузка ТТ ---
ttInput.addEventListener("change", async () => {
  const file = ttInput.files?.[0];
  if (!file) return;
  ttUploadArea.classList.add("active");
  ttUploadArea.textContent = "✓ " + file.name;

  if (!usingProxy() && !getApiKey()) { showError("Введите API Key"); return; }
  specsBox.style.display = "block";
  specsBox.innerHTML = "Парсинг ТТ...";
  showError("");

  try {
    parsedSpecs = await parseSpecsFromBlob(file);
    specsBox.innerHTML = renderSpecs(parsedSpecs);
    checkReady();
  } catch (e: any) {
    showError("Ошибка парсинга ТТ: " + e.message);
  }
});

// --- Загрузка ТТ из Figma (выделенная картинка) ---
ttFromFigmaBtn.addEventListener("click", () => {
  if (!usingProxy() && !getApiKey()) { showError("Введите API Key"); return; }
  ttFromFigmaStatus.textContent = "Загрузка ТТ из Figma...";
  ttFromFigmaStatus.className = "status";
  showError("");
  parent.postMessage({ pluginMessage: { type: "READ_TT_IMAGE" } }, "*");
});

async function parseSpecsFromBlob(blob: Blob): Promise<any> {
  const raw = await replicateRun(PARSE_PROMPT, blob);
  return cleanJson(raw);
}

function renderSpecs(specs: any): string {
  return `
      <div><strong>${specs.name || "?"}</strong></div>
      <div>Размер: <span class="val">${specs.total_width_cm} × ${specs.total_height_cm} см</span></div>
      <div>Текстовое поле: <span class="val">${specs.text_zone_width_cm ?? "—"} × ${specs.text_zone_height_cm ?? "—"} см</span></div>
      <div>DPI: <span class="val">${specs.dpi}</span> &nbsp; ${specs.color_mode} &nbsp; ${specs.output_format}</div>
      ${specs.has_frame ? '<div>✓ Рамка</div>' : ''}
      ${specs.notes ? `<div style="color:#999">${specs.notes}</div>` : ''}
    `;
}

// --- Сообщения от Figma ---
window.onmessage = async (event: MessageEvent) => {
  if (!event.data.pluginMessage) return;
  const msg = event.data.pluginMessage;

  if (msg.type === "MASTER_LOADED") {
    masterLoaded = true;
    masterStatus.textContent = "✓ Мастер загружен";
    masterStatus.className = "status ok";
    textSection.style.display = "block";
    headlineInput.value = msg.data.headlineText || "";
    sublineInput.value = msg.data.sublineText || "";
    disclaimerInput.value = msg.data.disclaimerText || "";
    checkReady();
  }

  if (msg.type === "GENERATED") {
    showError("");
    masterStatus.textContent = `✓ Макет "${msg.name}" создан!`;
    masterStatus.className = "status ok";
  }

  if (msg.type === "ERROR") {
    showError(msg.message);
  }

  if (msg.type === "TT_IMAGE_DATA") {
    try {
      ttFromFigmaStatus.textContent = "Парсинг ТТ...";
      const blob = new Blob([msg.imageBytes]);
      parsedSpecs = await parseSpecsFromBlob(blob);
      specsBox.style.display = "block";
      specsBox.innerHTML = renderSpecs(parsedSpecs);
      ttFromFigmaStatus.textContent = "✓ ТТ загружено из Figma";
      ttFromFigmaStatus.className = "status ok";
      checkReady();
    } catch (e: any) {
      showError("Ошибка парсинга ТТ: " + e.message);
      ttFromFigmaStatus.textContent = "";
    }
  }
};

// --- Генерация ---
generateBtn.addEventListener("click", () => {
  if (!parsedSpecs || !masterLoaded) return;

  // Если layout не проанализирован — дефолт (фото справа 50/50)
  const layout = layoutAnalysis || {
    photo_zone: "right",
    text_zone: "left",
    photo_x: 0.5,
    photo_y: 0.5,
    photo_scale: 1.0,
    split_ratio: 0.5,
  };

  showError("");
  parent.postMessage({
    pluginMessage: {
      type: "GENERATE",
      specs: parsedSpecs,
      layout,
      text: {
        headline: headlineInput.value,
        subline: sublineInput.value,
        disclaimer: disclaimerInput.value,
      },
    },
  }, "*");
});

// --- Утилиты ---
function showError(msg: string) { errorMsg.textContent = msg; }
function checkReady() { generateBtn.disabled = !(parsedSpecs && masterLoaded); }
