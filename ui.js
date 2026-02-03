"use strict";
(() => {
  // ui.ts
  console.log("[DEBUG UI] ui.ts script loaded at", Date.now());
  var apiKeyInput = document.getElementById("apiKey");
  var loadMasterBtn = document.getElementById("loadMasterBtn");
  var masterStatus = document.getElementById("masterStatus");
  var screenshotInput = document.getElementById("screenshotInput");
  var screenshotUploadArea = document.getElementById("screenshotUploadArea");
  var layoutStatus = document.getElementById("layoutStatus");
  var ttInput = document.getElementById("ttInput");
  var ttUploadArea = document.getElementById("ttUploadArea");
  var ttFromFigmaBtn = document.getElementById("ttFromFigmaBtn");
  var ttFromFigmaStatus = document.getElementById("ttFromFigmaStatus");
  var specsBox = document.getElementById("specsBox");
  var textSection = document.getElementById("textSection");
  var headlineInput = document.getElementById("headlineInput");
  var sublineInput = document.getElementById("sublineInput");
  var disclaimerInput = document.getElementById("disclaimerInput");
  var generateBtn = document.getElementById("generateBtn");
  var errorMsg = document.getElementById("errorMsg");
  var masterLoaded = false;
  var parsedSpecs = null;
  var layoutAnalysis = null;
  var REPLICATE_BASE = "https://api.replicate.com/v1";
  function getApiKey() {
    return apiKeyInput.value.trim();
  }
  function usingProxy() {
    return !REPLICATE_BASE.includes("api.replicate.com");
  }
  async function replicateUpload(blob) {
    const fd = new FormData();
    fd.append("content", blob);
    const res = await fetch(`${REPLICATE_BASE}/files`, {
      method: "POST",
      headers: usingProxy() ? {} : { Authorization: `Token ${getApiKey()}` },
      body: fd
    });
    return (await res.json()).urls.get;
  }
  async function replicatePoll(id) {
    while (true) {
      const res = await fetch(`${REPLICATE_BASE}/predictions/${id}`, {
        headers: usingProxy() ? {} : { Authorization: `Token ${getApiKey()}` }
      });
      const d = await res.json();
      if (d.status === "succeeded")
        return d.output;
      if (d.status === "failed")
        throw new Error(d.error || "Prediction failed");
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  async function replicateRun(prompt, imageBlob) {
    const url = await replicateUpload(imageBlob);
    const res = await fetch(`${REPLICATE_BASE}/predictions`, {
      method: "POST",
      headers: usingProxy() ? { "Content-Type": "application/json" } : { Authorization: `Token ${getApiKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "openai/gpt-4o", input: { prompt, image: url } })
    });
    const pred = await res.json();
    return replicatePoll(pred.id);
  }
  function cleanJson(raw) {
    return JSON.parse(raw.replace(/```json\n?/g, "").replace(/```/g, "").trim());
  }
  var PARSE_PROMPT = `You are a parser for outdoor advertising technical specifications.
From the provided image extract parameters and return ONLY valid JSON, no text, no markdown, no code blocks:
{"name":"string","total_width_cm":number,"total_height_cm":number,"text_zone_width_cm":number|null,"text_zone_height_cm":number|null,"has_frame":boolean,"dpi":number,"color_mode":"CMYK"|"RGB","output_format":"string","notes":"string|null"}
If a parameter cannot be determined set it to null.`;
  var LAYOUT_PROMPT = `You are an advertising layout analyst.
Look at this outdoor advertising banner image and determine the layout structure.
Return ONLY valid JSON:
{"photo_zone":"left"|"right"|"full","text_zone":"left"|"right"|"none","photo_x":number 0-1,"photo_y":number 0-1,"photo_scale":number >=1,"split_ratio":number 0-1}
photo_x/y = center of photo position (0.5=center). split_ratio = fraction of width for photo.
Full background = photo_zone "full", split_ratio 1.0`;
  loadMasterBtn.addEventListener("click", () => {
    parent.postMessage({ pluginMessage: { type: "READ_MASTER" } }, "*");
    masterStatus.textContent = "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043C\u0430\u0441\u0442\u0435\u0440\u0430...";
    masterStatus.className = "status";
  });
  screenshotInput.addEventListener("change", async () => {
    const file = screenshotInput.files?.[0];
    if (!file)
      return;
    screenshotUploadArea.classList.add("active");
    screenshotUploadArea.textContent = "\u2713 " + file.name;
    if (!usingProxy() && !getApiKey()) {
      showError("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 API Key");
      return;
    }
    layoutStatus.textContent = "\u0410\u043D\u0430\u043B\u0438\u0437 layout...";
    showError("");
    try {
      const raw = await replicateRun(LAYOUT_PROMPT, file);
      layoutAnalysis = cleanJson(raw);
      layoutStatus.textContent = `\u2713 Layout: \u0444\u043E\u0442\u043E ${layoutAnalysis.photo_zone}, \u0442\u0435\u043A\u0441\u0442 ${layoutAnalysis.text_zone}, split ${layoutAnalysis.split_ratio}`;
      layoutStatus.className = "status ok";
      checkReady();
    } catch (e) {
      showError("\u041E\u0448\u0438\u0431\u043A\u0430 \u0430\u043D\u0430\u043B\u0438\u0437\u0430 layout: " + e.message);
    }
  });
  ttInput.addEventListener("change", async () => {
    const file = ttInput.files?.[0];
    if (!file)
      return;
    ttUploadArea.classList.add("active");
    ttUploadArea.textContent = "\u2713 " + file.name;
    if (!usingProxy() && !getApiKey()) {
      showError("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 API Key");
      return;
    }
    specsBox.style.display = "block";
    specsBox.innerHTML = "\u041F\u0430\u0440\u0441\u0438\u043D\u0433 \u0422\u0422...";
    showError("");
    try {
      parsedSpecs = await parseSpecsFromBlob(file);
      specsBox.innerHTML = renderSpecs(parsedSpecs);
      checkReady();
    } catch (e) {
      showError("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0430\u0440\u0441\u0438\u043D\u0433\u0430 \u0422\u0422: " + e.message);
    }
  });
  ttFromFigmaBtn.addEventListener("click", () => {
    if (!usingProxy() && !getApiKey()) {
      showError("\u0412\u0432\u0435\u0434\u0438\u0442\u0435 API Key");
      return;
    }
    ttFromFigmaStatus.textContent = "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0422\u0422 \u0438\u0437 Figma...";
    ttFromFigmaStatus.className = "status";
    showError("");
    parent.postMessage({ pluginMessage: { type: "READ_TT_IMAGE" } }, "*");
  });
  async function parseSpecsFromBlob(blob) {
    const raw = await replicateRun(PARSE_PROMPT, blob);
    return cleanJson(raw);
  }
  function renderSpecs(specs) {
    return `
      <div><strong>${specs.name || "?"}</strong></div>
      <div>\u0420\u0430\u0437\u043C\u0435\u0440: <span class="val">${specs.total_width_cm} \xD7 ${specs.total_height_cm} \u0441\u043C</span></div>
      <div>\u0422\u0435\u043A\u0441\u0442\u043E\u0432\u043E\u0435 \u043F\u043E\u043B\u0435: <span class="val">${specs.text_zone_width_cm ?? "\u2014"} \xD7 ${specs.text_zone_height_cm ?? "\u2014"} \u0441\u043C</span></div>
      <div>DPI: <span class="val">${specs.dpi}</span> &nbsp; ${specs.color_mode} &nbsp; ${specs.output_format}</div>
      ${specs.has_frame ? "<div>\u2713 \u0420\u0430\u043C\u043A\u0430</div>" : ""}
      ${specs.notes ? `<div style="color:#999">${specs.notes}</div>` : ""}
    `;
  }
  window.onmessage = async (event) => {
    if (!event.data.pluginMessage)
      return;
    const msg = event.data.pluginMessage;
    if (msg.type === "MASTER_LOADED") {
      masterLoaded = true;
      masterStatus.textContent = "\u2713 \u041C\u0430\u0441\u0442\u0435\u0440 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D";
      masterStatus.className = "status ok";
      textSection.style.display = "block";
      headlineInput.value = msg.data.headlineText || "";
      sublineInput.value = msg.data.sublineText || "";
      disclaimerInput.value = msg.data.disclaimerText || "";
      checkReady();
    }
    if (msg.type === "GENERATED") {
      showError("");
      masterStatus.textContent = `\u2713 \u041C\u0430\u043A\u0435\u0442 "${msg.name}" \u0441\u043E\u0437\u0434\u0430\u043D!`;
      masterStatus.className = "status ok";
    }
    if (msg.type === "ERROR") {
      showError(msg.message);
    }
    if (msg.type === "TT_IMAGE_DATA") {
      try {
        ttFromFigmaStatus.textContent = "\u041F\u0430\u0440\u0441\u0438\u043D\u0433 \u0422\u0422...";
        const blob = new Blob([msg.imageBytes]);
        parsedSpecs = await parseSpecsFromBlob(blob);
        specsBox.style.display = "block";
        specsBox.innerHTML = renderSpecs(parsedSpecs);
        ttFromFigmaStatus.textContent = "\u2713 \u0422\u0422 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043E \u0438\u0437 Figma";
        ttFromFigmaStatus.className = "status ok";
        checkReady();
      } catch (e) {
        showError("\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0430\u0440\u0441\u0438\u043D\u0433\u0430 \u0422\u0422: " + e.message);
        ttFromFigmaStatus.textContent = "";
      }
    }
  };
  generateBtn.addEventListener("click", () => {
    if (!parsedSpecs || !masterLoaded)
      return;
    const layout = layoutAnalysis || {
      photo_zone: "right",
      text_zone: "left",
      photo_x: 0.5,
      photo_y: 0.5,
      photo_scale: 1,
      split_ratio: 0.5
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
          disclaimer: disclaimerInput.value
        }
      }
    }, "*");
  });
  function showError(msg) {
    errorMsg.textContent = msg;
  }
  function checkReady() {
    generateBtn.disabled = !(parsedSpecs && masterLoaded);
  }
})();
