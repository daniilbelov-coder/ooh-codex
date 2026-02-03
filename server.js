const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();

// Разрешаем запросы из Figma (и вообще отовсюду)
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || "";

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/", createProxyMiddleware({
  target: "https://api.replicate.com",
  changeOrigin: true,
  onProxyReq: (proxyReq) => {
    if (REPLICATE_API_TOKEN) {
      proxyReq.setHeader("Authorization", `Token ${REPLICATE_API_TOKEN}`);
    }
  },
  onProxyRes: (proxyRes) => {
    proxyRes.headers["Access-Control-Allow-Origin"] = "*";
  }
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
