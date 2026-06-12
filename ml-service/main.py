"""
ShieldNet ML Service — FastAPI wrapper for the two-stage DDoS detection pipeline.
Stage 1 : UNSW-NB15 XGBoost  → binary (normal | suspicious)
Stage 2 : CICIDS   XGBoost  → multi-class attack type
"""

import os, logging
from typing import Optional, List
import numpy as np
import pandas as pd
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("shieldnet-ml")

app = FastAPI(title="ShieldNet ML Service", version="1.0.0", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

MODEL_DIR = os.getenv("MODEL_DIR", "./models")

# ── Global model registry ────────────────────────────────────────────────────
M = {}

CIC_FEATURES = [
    "duration", "packets_count", "fwd_packets_count", "bwd_packets_count",
    "total_payload_bytes", "fwd_total_payload_bytes", "bwd_total_payload_bytes",
    "payload_bytes_mean", "payload_bytes_std", "total_header_bytes",
    "mean_header_bytes", "std_header_bytes", "packets_IAT_mean", "packet_IAT_std",
    "fwd_packets_IAT_mean", "bwd_packets_IAT_mean", "syn_flag_counts",
    "ack_flag_counts", "fin_flag_counts", "psh_flag_counts",
    "fwd_packets_rate", "bwd_packets_rate",
]

UNSW_THRESHOLD = 0.3          # Stage-1 probability threshold to escalate
STAGE1_WEIGHT  = 0.4
STAGE2_WEIGHT  = 0.6


@app.on_event("startup")
async def load_models():
    try:
        M["unsw_model"]    = joblib.load(f"{MODEL_DIR}/xgb_unsw_nb15_model.joblib")
        M["unsw_features"] = joblib.load(f"{MODEL_DIR}/unsw_features_list.joblib")
        M["unsw_encoders"] = joblib.load(f"{MODEL_DIR}/unsw_label_encoders.joblib")
        M["cic_model"]     = joblib.load(f"{MODEL_DIR}/cic_xgb_model.joblib")
        M["cic_scaler"]    = joblib.load(f"{MODEL_DIR}/cic_scaler.joblib")
        M["cic_le"]        = joblib.load(f"{MODEL_DIR}/cic_label_encoder.joblib")
        log.info("✅ All models loaded.")
    except FileNotFoundError as exc:
        log.error("❌ Model file missing: %s", exc)
        log.warning("⚠️  Running without models — /predict will return mock data.")


# ── Schemas ──────────────────────────────────────────────────────────────────

class TrafficSample(BaseModel):
    # UNSW-NB15 fields
    dur: float = 0; proto: str = "tcp"; service: str = "http"; state: str = "CON"
    spkts: int = 0; dpkts: int = 0; sbytes: int = 0; dbytes: int = 0
    rate: float = 0; sttl: int = 64; dttl: int = 64
    sload: float = 0; dload: float = 0; sloss: int = 0; dloss: int = 0
    sinpkt: float = 0; dinpkt: float = 0; sjit: float = 0; djit: float = 0
    swin: int = 0; stcpb: int = 0; dtcpb: int = 0; dwin: int = 0
    tcprtt: float = 0; synack: float = 0; ackdat: float = 0
    smean: float = 0; dmean: float = 0; trans_depth: int = 0
    response_body_len: int = 0; ct_srv_src: int = 0; ct_state_ttl: int = 0
    ct_dst_ltm: int = 0; ct_src_dport_ltm: int = 0; ct_dst_sport_ltm: int = 0
    ct_dst_src_ltm: int = 0; is_ftp_login: int = 0; ct_ftp_cmd: int = 0
    ct_flw_http_mthd: int = 0; ct_src_ltm: int = 0; ct_srv_dst: int = 0
    is_sm_ips_ports: int = 0
    # CIC fields
    duration: float = 0; packets_count: int = 0; fwd_packets_count: int = 0
    bwd_packets_count: int = 0; total_payload_bytes: int = 0
    fwd_total_payload_bytes: int = 0; bwd_total_payload_bytes: int = 0
    payload_bytes_mean: float = 0; payload_bytes_std: float = 0
    total_header_bytes: int = 0; mean_header_bytes: float = 0
    std_header_bytes: float = 0; packets_IAT_mean: float = 0
    packet_IAT_std: float = 0; fwd_packets_IAT_mean: float = 0
    bwd_packets_IAT_mean: float = 0; syn_flag_counts: int = 0
    ack_flag_counts: int = 0; fin_flag_counts: int = 0; psh_flag_counts: int = 0
    fwd_packets_rate: float = 0; bwd_packets_rate: float = 0

class PredictionResult(BaseModel):
    is_attack: bool
    stage1_label: str
    stage1_prob: float
    stage2_label: Optional[str] = None
    stage2_prob: Optional[float] = None
    attack_type: Optional[str] = None
    confidence: float
    severity: str

class BatchRequest(BaseModel):
    samples: List[TrafficSample]


# ── Helpers ──────────────────────────────────────────────────────────────────

def severity_from(confidence: float, attack_type: Optional[str]) -> str:
    if not attack_type:
        return "LOW"
    critical_types = {"DDoS", "DoS Hulk", "DoS GoldenEye"}
    if attack_type in critical_types and confidence > 0.90:
        return "CRITICAL"
    if confidence > 0.85:
        return "HIGH"
    if confidence > 0.70:
        return "MEDIUM"
    return "LOW"


def _encode_unsw(df: pd.DataFrame) -> pd.DataFrame:
    for col, le in M["unsw_encoders"].items():
        if col in df.columns:
            df[col] = df[col].astype(str).apply(
                lambda v: le.transform([v])[0] if v in le.classes_ else -1
            )
    for col in df.select_dtypes(include="object").columns:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df.fillna(-1, inplace=True)
    return df


def _run_prediction(sample: TrafficSample) -> PredictionResult:
    if not M:
        # Fallback mock when models aren't loaded (dev mode)
        import random
        is_atk = random.random() > 0.6
        atype  = random.choice(["DDoS","DoS Hulk","DoS slowloris","HTTP Flood"]) if is_atk else None
        conf   = round(0.85 + random.random() * 0.14, 4)
        return PredictionResult(
            is_attack=is_atk, stage1_label="suspicious" if is_atk else "normal",
            stage1_prob=conf if is_atk else 1 - conf,
            stage2_label=atype, stage2_prob=conf if is_atk else None,
            attack_type=atype, confidence=conf,
            severity=severity_from(conf, atype)
        )

    row = sample.dict()
    df  = pd.DataFrame([row])

    # ── Stage 1: UNSW binary ────────────────────────────────────────────────
    X1 = df[M["unsw_features"]].copy()
    X1 = _encode_unsw(X1)
    s1_prob = float(M["unsw_model"].predict_proba(X1)[0][1])
    is_suspicious = s1_prob >= UNSW_THRESHOLD

    if not is_suspicious:
        return PredictionResult(
            is_attack=False, stage1_label="normal", stage1_prob=round(s1_prob, 4),
            confidence=round(1 - s1_prob, 4), severity="LOW"
        )

    # ── Stage 2: CIC multi-class ─────────────────────────────────────────────
    X2       = df[CIC_FEATURES].copy().apply(pd.to_numeric, errors="coerce").fillna(0)
    X2_scaled= M["cic_scaler"].transform(X2)
    cic_probs= M["cic_model"].predict_proba(X2_scaled)[0]
    idx      = int(np.argmax(cic_probs))
    s2_prob  = float(cic_probs[idx])
    s2_label = M["cic_le"].inverse_transform([idx])[0]

    confidence = round(STAGE1_WEIGHT * s1_prob + STAGE2_WEIGHT * s2_prob, 4)

    return PredictionResult(
        is_attack=True,
        stage1_label="suspicious", stage1_prob=round(s1_prob, 4),
        stage2_label=s2_label, stage2_prob=round(s2_prob, 4),
        attack_type=s2_label, confidence=confidence,
        severity=severity_from(confidence, s2_label)
    )


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok", "models_loaded": bool(M), "version": "1.0.0"}

@app.post("/predict", response_model=PredictionResult)
def predict(sample: TrafficSample):
    try:
        return _run_prediction(sample)
    except Exception as exc:
        log.exception("Prediction error")
        raise HTTPException(status_code=500, detail=str(exc))

@app.post("/predict/batch")
def predict_batch(req: BatchRequest):
    try:
        return [_run_prediction(s) for s in req.samples]
    except Exception as exc:
        log.exception("Batch prediction error")
        raise HTTPException(status_code=500, detail=str(exc))

@app.get("/model-info")
def model_info():
    if not M:
        return {"loaded": False}
    return {
        "loaded": True,
        "stage1": "XGBoost (UNSW-NB15) — binary detection",
        "stage2": "XGBoost (CICIDS)   — multi-class attack type",
        "unsw_features": len(M.get("unsw_features", [])),
        "cic_features": len(CIC_FEATURES),
        "attack_classes": list(M["cic_le"].classes_) if "cic_le" in M else [],
        "stage1_threshold": UNSW_THRESHOLD,
    }
