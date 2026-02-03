// Укажите здесь base URL прокси до /v1, если используете Railway-прокси
const REPLICATE_BASE = "https://api.replicate.com/v1";
const USING_PROXY = !REPLICATE_BASE.includes("api.replicate.com");

export async function uploadImage(apiKey: string, blob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append("content", blob);
  const res = await fetch(`${REPLICATE_BASE}/files`, {
    method: "POST",
    headers: USING_PROXY ? {} : { "Authorization": `Token ${apiKey}` },
    body: formData,
  });
  const json = await res.json();
  return json.urls.get;
}

export async function createPrediction(
  apiKey: string,
  prompt: string,
  imageUrl: string
): Promise<string> {
  const res = await fetch(`${REPLICATE_BASE}/predictions`, {
    method: "POST",
    headers: {
      ...(USING_PROXY ? {} : { "Authorization": `Token ${apiKey}` }),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o",
      input: { prompt, image: imageUrl },
    }),
  });
  const json = await res.json();
  return json.id;
}

export async function pollPrediction(apiKey: string, id: string): Promise<string> {
  while (true) {
    const res = await fetch(`${REPLICATE_BASE}/predictions/${id}`, {
      headers: USING_PROXY ? {} : { "Authorization": `Token ${apiKey}` },
    });
    const data = await res.json();
    if (data.status === "succeeded") return data.output;
    if (data.status === "failed") throw new Error(data.error || "Prediction failed");
    await new Promise((r) => setTimeout(r, 1500));
  }
}

// Высокоуровневая: загрузить blob → prediction → polling → ответ
export async function runVision(apiKey: string, prompt: string, imageBlob: Blob): Promise<string> {
  const imageUrl = await uploadImage(apiKey, imageBlob);
  const predId = await createPrediction(apiKey, prompt, imageUrl);
  return pollPrediction(apiKey, predId);
}
