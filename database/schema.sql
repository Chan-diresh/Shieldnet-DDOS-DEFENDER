-- ============================================================
-- ShieldNet DDoS Protection Platform — PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ────────────────────────────────────────────────────
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username    VARCHAR(64)  UNIQUE NOT NULL,
  email       VARCHAR(128) UNIQUE NOT NULL,
  password    VARCHAR(256) NOT NULL,
  role        VARCHAR(32)  NOT NULL DEFAULT 'analyst',  -- admin | analyst | viewer
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Traffic Logs ──────────────────────────────────────────────
CREATE TABLE traffic_logs (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_ip                INET,
  dst_ip                INET,
  src_port              INTEGER,
  dst_port              INTEGER,
  protocol              VARCHAR(16),
  packets_per_sec       NUMERIC(12,2),
  bytes_per_sec         NUMERIC(16,2),
  duration              NUMERIC(10,6),
  -- UNSW NB15 raw features
  spkts                 INTEGER,
  dpkts                 INTEGER,
  sbytes                BIGINT,
  dbytes                BIGINT,
  rate                  NUMERIC(12,4),
  sttl                  INTEGER,
  dttl                  INTEGER,
  sload                 NUMERIC(14,4),
  dload                 NUMERIC(14,4),
  sloss                 INTEGER,
  dloss                 INTEGER,
  sinpkt                NUMERIC(10,4),
  dinpkt                NUMERIC(10,4),
  sjit                  NUMERIC(10,4),
  djit                  NUMERIC(10,4),
  swin                  INTEGER,
  dwin                  INTEGER,
  tcprtt                NUMERIC(10,4),
  synack                NUMERIC(10,4),
  ackdat                NUMERIC(10,4),
  smean                 NUMERIC(10,2),
  dmean                 NUMERIC(10,2),
  service               VARCHAR(32),
  state                 VARCHAR(32),
  -- CIC features
  fwd_packets_count     INTEGER,
  bwd_packets_count     INTEGER,
  total_payload_bytes   BIGINT,
  syn_flag_counts       INTEGER,
  ack_flag_counts       INTEGER,
  fin_flag_counts       INTEGER,
  psh_flag_counts       INTEGER,
  fwd_packets_rate      NUMERIC(12,4),
  bwd_packets_rate      NUMERIC(12,4)
);

CREATE INDEX idx_traffic_logs_recorded_at ON traffic_logs (recorded_at DESC);
CREATE INDEX idx_traffic_logs_src_ip      ON traffic_logs (src_ip);

-- ── ML Predictions ────────────────────────────────────────────
CREATE TABLE ml_predictions (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  traffic_log_id  UUID        REFERENCES traffic_logs(id) ON DELETE CASCADE,
  predicted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Stage 1: UNSW binary detection
  stage1_label    VARCHAR(16) NOT NULL,   -- 'normal' | 'suspicious'
  stage1_prob     NUMERIC(6,4),
  -- Stage 2: CIC attack classification
  stage2_label    VARCHAR(64),            -- 'DDoS' | 'DoS Hulk' | ... | null if stage1=normal
  stage2_prob     NUMERIC(6,4),
  -- Final verdict
  is_attack       BOOLEAN     NOT NULL DEFAULT FALSE,
  attack_type     VARCHAR(64),
  confidence      NUMERIC(6,4),
  model_version   VARCHAR(32) NOT NULL DEFAULT '1.0.0'
);

CREATE INDEX idx_ml_predictions_traffic_log ON ml_predictions (traffic_log_id);
CREATE INDEX idx_ml_predictions_predicted_at ON ml_predictions (predicted_at DESC);
CREATE INDEX idx_ml_predictions_is_attack    ON ml_predictions (is_attack);

-- ── Attack Events ─────────────────────────────────────────────
CREATE TABLE attack_events (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  prediction_id   UUID        REFERENCES ml_predictions(id) ON DELETE SET NULL,
  detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  src_ip          INET        NOT NULL,
  dst_ip          INET,
  attack_type     VARCHAR(64) NOT NULL,
  severity        VARCHAR(16) NOT NULL DEFAULT 'MEDIUM', -- LOW | MEDIUM | HIGH | CRITICAL
  confidence      NUMERIC(6,4),
  packets_rate    NUMERIC(12,2),
  bytes_rate      NUMERIC(16,2),
  country         VARCHAR(64),
  asn             VARCHAR(128),
  status          VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | MITIGATED | RESOLVED
  resolved_at     TIMESTAMPTZ,
  notes           TEXT
);

CREATE INDEX idx_attack_events_detected_at ON attack_events (detected_at DESC);
CREATE INDEX idx_attack_events_src_ip      ON attack_events (src_ip);
CREATE INDEX idx_attack_events_status      ON attack_events (status);
CREATE INDEX idx_attack_events_severity    ON attack_events (severity);

-- ── Alerts ────────────────────────────────────────────────────
CREATE TABLE alerts (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id      UUID        REFERENCES attack_events(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  severity      VARCHAR(16) NOT NULL,
  title         VARCHAR(256) NOT NULL,
  message       TEXT        NOT NULL,
  is_read       BOOLEAN     NOT NULL DEFAULT FALSE,
  is_resolved   BOOLEAN     NOT NULL DEFAULT FALSE,
  resolved_by   UUID        REFERENCES users(id),
  resolved_at   TIMESTAMPTZ
);

CREATE INDEX idx_alerts_created_at  ON alerts (created_at DESC);
CREATE INDEX idx_alerts_is_read     ON alerts (is_read);
CREATE INDEX idx_alerts_severity    ON alerts (severity);

-- ── Blocked IPs ───────────────────────────────────────────────
CREATE TABLE blocked_ips (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address    INET        UNIQUE NOT NULL,
  reason        VARCHAR(128) NOT NULL,
  attack_type   VARCHAR(64),
  blocked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  blocked_by    VARCHAR(32) NOT NULL DEFAULT 'ml-engine',  -- 'ml-engine' | 'manual' | 'geo-block'
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  hit_count     INTEGER     NOT NULL DEFAULT 1,
  last_seen     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_blocked_ips_ip_address ON blocked_ips (ip_address);
CREATE INDEX idx_blocked_ips_is_active  ON blocked_ips (is_active);

-- ── Mitigation Rules ─────────────────────────────────────────
CREATE TABLE mitigation_rules (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(128) UNIQUE NOT NULL,
  description   TEXT,
  layer         VARCHAR(16) NOT NULL,  -- 'L3' | 'L4' | 'L7'
  rule_type     VARCHAR(64) NOT NULL,  -- 'rate-limit' | 'block' | 'challenge' | 'geo-block' | 'syn-cookie'
  threshold     VARCHAR(64),
  action        VARCHAR(32) NOT NULL DEFAULT 'block',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by    UUID        REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hit_count     BIGINT      NOT NULL DEFAULT 0,
  last_triggered TIMESTAMPTZ
);

-- Seed default mitigation rules
INSERT INTO mitigation_rules (name, description, layer, rule_type, threshold, action, is_active) VALUES
  ('SYN Cookie Protection',   'Protect against SYN flood attacks',           'L4', 'syn-cookie',   '10000 pps',      'mitigate', TRUE),
  ('HTTP Rate Limiting',       'Limit HTTP requests per IP',                  'L7', 'rate-limit',   '100 req/s',      'rate-limit', TRUE),
  ('IP Reputation Filter',     'Block known malicious IPs from threat DB',    'L3', 'block',        'Global DB',      'block', TRUE),
  ('UDP Flood Limiter',        'Mitigate UDP amplification attacks',           'L4', 'rate-limit',   '5000 pps',       'block', TRUE),
  ('ICMP Rate Limit',          'Limit ICMP packets to prevent ping floods',   'L3', 'rate-limit',   '1000 pps',       'rate-limit', TRUE),
  ('Geo-Blocking Tier',        'Block traffic from high-risk regions',        'L3', 'geo-block',    '15 countries',   'block', TRUE),
  ('Slowloris Guard',          'Detect and block slow HTTP attacks',          'L7', 'rate-limit',   '50 conn/IP',     'block', FALSE),
  ('DNS Amplification Guard',  'Limit DNS response sizes and rates',          'L3', 'rate-limit',   '2000 pps',       'block', TRUE);

-- ── Analytics Snapshots (hourly aggregates) ───────────────────
CREATE TABLE analytics_snapshots (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_hour       TIMESTAMPTZ UNIQUE NOT NULL,
  total_requests      BIGINT      NOT NULL DEFAULT 0,
  legitimate_requests BIGINT      NOT NULL DEFAULT 0,
  attack_requests     BIGINT      NOT NULL DEFAULT 0,
  blocked_requests    BIGINT      NOT NULL DEFAULT 0,
  unique_attackers    INTEGER     NOT NULL DEFAULT 0,
  top_attack_type     VARCHAR(64),
  avg_confidence      NUMERIC(6,4),
  bandwidth_in_gbps   NUMERIC(8,4),
  bandwidth_out_gbps  NUMERIC(8,4)
);

CREATE INDEX idx_analytics_snapshots_hour ON analytics_snapshots (snapshot_hour DESC);

-- ── Audit Log ─────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(128) NOT NULL,
  entity      VARCHAR(64),
  entity_id   UUID,
  details     JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address  INET
);

CREATE INDEX idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX idx_audit_logs_user_id    ON audit_logs (user_id);

-- ── Updated-at trigger ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_mitigation_rules_updated_at
  BEFORE UPDATE ON mitigation_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
