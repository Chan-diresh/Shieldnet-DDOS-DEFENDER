const router = require("express").Router();
const db     = require("../db/connection");
const ml     = require("../services/mlService");
const { authMiddleware }  = require("../middleware/auth");
const { emitNewAttack, emitNewAlert } = require("../websocket/manager");
const { v4: uuidv4 } = require("uuid");

// GET /api/traffic — paginated traffic log
router.get("/", authMiddleware, async (req, res) => {
  const { page = 1, limit = 50, since } = req.query;
  const offset = (page - 1) * limit;
  try {
    let q = `SELECT id, recorded_at, src_ip, dst_ip, src_port, dst_port,
                    protocol, packets_per_sec, bytes_per_sec, duration
             FROM traffic_logs`;
    const params = [];
    if (since) { q += ` WHERE recorded_at > $1`; params.push(since); }
    q += ` ORDER BY recorded_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(limit, offset);

    const { rows } = await db.query(q, params);
    res.json({ data: rows, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err); res.status(500).json({ error: "DB error" });
  }
});

// GET /api/traffic/live-stats — last 60 seconds aggregated by second
router.get("/live-stats", authMiddleware, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        date_trunc('second', tl.recorded_at) AS second,
        COUNT(tl.id) AS total,
        COUNT(mp.id) FILTER (WHERE mp.is_attack = TRUE) AS attack,
        COUNT(mp.id) FILTER (WHERE mp.is_attack = FALSE) AS legitimate
      FROM traffic_logs tl
      LEFT JOIN ml_predictions mp ON mp.traffic_log_id = tl.id
      WHERE tl.recorded_at > NOW() - INTERVAL '60 seconds'
      GROUP BY 1
      ORDER BY 1
    `);
    res.json(rows);
  } catch (err) {
    console.error(err); res.status(500).json({ error: "DB error" });
  }
});

// POST /api/traffic/ingest — receive a network flow, run ML, store results
router.post("/ingest", async (req, res) => {
  const sample = req.body;
  try {
    // 1) Store raw traffic log
    const logId = uuidv4();
    await db.query(`
      INSERT INTO traffic_logs (id, src_ip, dst_ip, src_port, dst_port, protocol,
        packets_per_sec, bytes_per_sec, duration,
        spkts, dpkts, sbytes, dbytes, rate, sttl, dttl, sload, dload,
        sloss, dloss, sinpkt, dinpkt, sjit, djit, swin, dwin,
        tcprtt, synack, ackdat, smean, dmean, service, state,
        fwd_packets_count, bwd_packets_count, total_payload_bytes,
        syn_flag_counts, ack_flag_counts, fin_flag_counts, psh_flag_counts,
        fwd_packets_rate, bwd_packets_rate)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
              $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,
              $34,$35,$36,$37,$38,$39,$40,$41,$42)
    `, [
      logId, sample.src_ip, sample.dst_ip, sample.src_port, sample.dst_port,
      sample.proto, sample.packets_per_sec || 0, sample.bytes_per_sec || 0,
      sample.dur || 0, sample.spkts, sample.dpkts, sample.sbytes, sample.dbytes,
      sample.rate, sample.sttl, sample.dttl, sample.sload, sample.dload,
      sample.sloss, sample.dloss, sample.sinpkt, sample.dinpkt, sample.sjit,
      sample.djit, sample.swin, sample.dwin, sample.tcprtt, sample.synack,
      sample.ackdat, sample.smean, sample.dmean, sample.service, sample.state,
      sample.fwd_packets_count, sample.bwd_packets_count, sample.total_payload_bytes,
      sample.syn_flag_counts, sample.ack_flag_counts, sample.fin_flag_counts,
      sample.psh_flag_counts, sample.fwd_packets_rate, sample.bwd_packets_rate,
    ]);

    // 2) Run ML prediction
    const prediction = await ml.predict(sample);

    // 3) Store prediction
    const predId = uuidv4();
    await db.query(`
      INSERT INTO ml_predictions
        (id, traffic_log_id, stage1_label, stage1_prob, stage2_label, stage2_prob,
         is_attack, attack_type, confidence)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [predId, logId, prediction.stage1_label, prediction.stage1_prob,
        prediction.stage2_label, prediction.stage2_prob,
        prediction.is_attack, prediction.attack_type, prediction.confidence]);

    // 4) If attack → create event + alert + check IP block
    if (prediction.is_attack) {
      const eventId = uuidv4();
      await db.query(`
        INSERT INTO attack_events
          (id, prediction_id, src_ip, dst_ip, attack_type, severity, confidence)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [eventId, predId, sample.src_ip, sample.dst_ip,
          prediction.attack_type, prediction.severity, prediction.confidence]);

      // Auto-block high/critical severity IPs
      if (["HIGH","CRITICAL"].includes(prediction.severity)) {
        await db.query(`
          INSERT INTO blocked_ips (ip_address, reason, attack_type, blocked_by)
          VALUES ($1,$2,$3,'ml-engine')
          ON CONFLICT (ip_address) DO UPDATE
            SET hit_count = blocked_ips.hit_count + 1, last_seen = NOW()
        `, [sample.src_ip, `Auto-blocked: ${prediction.attack_type}`, prediction.attack_type]);

        const alertId = uuidv4();
        await db.query(`
          INSERT INTO alerts (id, event_id, severity, title, message)
          VALUES ($1,$2,$3,$4,$5)
        `, [alertId, eventId, prediction.severity,
            `${prediction.severity} Attack Detected`,
            `${prediction.attack_type} from ${sample.src_ip} (confidence: ${(prediction.confidence*100).toFixed(1)}%)`]);

        const io = req.app.get("io");
        emitNewAttack({ id: eventId, ...prediction, src_ip: sample.src_ip });
        emitNewAlert({ id: alertId, severity: prediction.severity,
          title: `${prediction.attack_type} detected`, src_ip: sample.src_ip });
      }
    }

    res.json({ log_id: logId, prediction });
  } catch (err) {
    console.error(err); res.status(500).json({ error: err.message });
  }
});

module.exports = router;
