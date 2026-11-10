// Shared tour state (order + skipped stops) for every phone.
// Storage: Upstash Redis over its REST API (Vercel Marketplace integration).
// Works with either env naming: KV_REST_API_* or UPSTASH_REDIS_REST_*.
// GET  /api/state?since=<v>  -> 204 if the stored version equals <v>, else the state JSON
// POST /api/state            -> body {order, skip}; stores it with a new version, returns it

const KEY = "grezzo-biennale:state";
const ZONES = ["zs", "sm", "ars", "gia"];

function creds() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redis(c, cmd) {
  const r = await fetch(c.url, {
    method: "POST",
    headers: { Authorization: "Bearer " + c.token, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error("redis " + r.status);
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function clean(b) {
  const order = {};
  for (const k of ZONES) {
    const src = b && b.order && Array.isArray(b.order[k]) ? b.order[k] : [];
    order[k] = src.filter((x) => typeof x === "string" && x.length < 40).slice(0, 40);
  }
  const skip = {};
  if (b && b.skip && typeof b.skip === "object") {
    for (const id of Object.keys(b.skip).slice(0, 60)) {
      if (b.skip[id] === true && id.length < 40) skip[id] = true;
    }
  }
  const done = {};
  if (b && b.done && typeof b.done === "object") {
    for (const id of Object.keys(b.done).slice(0, 60)) {
      const v = b.done[id];
      if (typeof v === "number" && v >= 0 && v < 1440 && id.length < 40 && !skip[id]) done[id] = Math.round(v);
    }
  }
  return { order, skip, done };
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const c = creds();
  if (!c) {
    res.status(503).json({ error: "no_db" });
    return;
  }
  try {
    if (req.method === "GET") {
      const raw = await redis(c, ["GET", KEY]);
      const st = raw ? JSON.parse(raw) : { v: 0, order: null, skip: {} };
      const since = Number(req.query && req.query.since);
      if (Number.isFinite(since) && st.v === since) {
        res.status(204).end();
        return;
      }
      res.status(200).json(st);
      return;
    }
    if (req.method === "POST") {
      let body = req.body;
      if (typeof body === "string") {
        try { body = JSON.parse(body); } catch (e) { body = null; }
      }
      if (!body || typeof body !== "object") {
        res.status(400).json({ error: "bad_body" });
        return;
      }
      const v = await redis(c, ["INCR", KEY + ":v"]);
      const st = Object.assign({ v }, clean(body), { at: Date.now() });
      await redis(c, ["SET", KEY, JSON.stringify(st)]);
      res.status(200).json(st);
      return;
    }
    res.setHeader("Allow", "GET, POST");
    res.status(405).end();
  } catch (e) {
    res.status(502).json({ error: "db_error" });
  }
};
