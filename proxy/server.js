const express = require("express");
const multer = require("multer");

const app = express();
const upload = multer();

const REPLICATE_BASE = "https://api.replicate.com/v1";
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

if (!REPLICATE_API_TOKEN) {
  console.warn("[proxy] Missing REPLICATE_API_TOKEN env var.");
}

app.use(express.json({ limit: "15mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Upload file to Replicate
app.post("/v1/files", upload.single("content"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided (field: content)" });
    }
    const formData = new FormData();
    formData.append("content", new Blob([req.file.buffer]), req.file.originalname || "file");

    const resp = await fetch(`${REPLICATE_BASE}/files`, {
      method: "POST",
      headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
      body: formData,
    });
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err) {
    console.error("[proxy] /v1/files error:", err);
    return res.status(500).json({ error: "Proxy error on /v1/files" });
  }
});

// Create prediction
app.post("/v1/predictions", async (req, res) => {
  try {
    const resp = await fetch(`${REPLICATE_BASE}/predictions`, {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err) {
    console.error("[proxy] /v1/predictions error:", err);
    return res.status(500).json({ error: "Proxy error on /v1/predictions" });
  }
});

// Poll prediction
app.get("/v1/predictions/:id", async (req, res) => {
  try {
    const resp = await fetch(`${REPLICATE_BASE}/predictions/${req.params.id}`, {
      headers: { Authorization: `Token ${REPLICATE_API_TOKEN}` },
    });
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err) {
    console.error("[proxy] /v1/predictions/:id error:", err);
    return res.status(500).json({ error: "Proxy error on /v1/predictions/:id" });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`[proxy] Listening on port ${port}`);
});
