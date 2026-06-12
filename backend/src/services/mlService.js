const axios = require("axios");

const ML_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

const mlClient = axios.create({ baseURL: ML_URL, timeout: 10000 });

async function predict(sample) {
  const { data } = await mlClient.post("/predict", sample);
  return data;
}

async function predictBatch(samples) {
  const { data } = await mlClient.post("/predict/batch", { samples });
  return data;
}

async function getModelInfo() {
  const { data } = await mlClient.get("/model-info");
  return data;
}

async function healthCheck() {
  try {
    const { data } = await mlClient.get("/health");
    return data;
  } catch {
    return { status: "unreachable", models_loaded: false };
  }
}

module.exports = { predict, predictBatch, getModelInfo, healthCheck };
