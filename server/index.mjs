// Tiny dependency-free API + static server. Data lives in a JSON file (mount DATA_DIR as a volume).
import http from "node:http"
import fs from "node:fs/promises"
import path from "node:path"
import { createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"
import zlib from "node:zlib"

const PORT = Number(process.env.PORT || 3000)
const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data")
const DATA_FILE = path.join(DATA_DIR, "habits.json")
const DIST = path.resolve(process.env.DIST_DIR || "./dist")
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
// A real calendar date (rejects 2024-99-99 and 2025-02-30).
const isValidDate = (s) => {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false
  const [y, m, d] = s.split("-").map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}
const pad = (n) => String(n).padStart(2, "0")
const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
// Latest day a tick may be recorded: tomorrow, so clients ahead of the server's timezone still work.
const maxTickDate = () => localDate(new Date(Date.now() + 24 * 3600 * 1000))

const DEAD_TICK_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>This tick is dead</title>
<style>
:root{color-scheme:light dark;--bg:#f4f8f5;--fg:#12261b;--mut:#4d6556;--ac:#1f8a4c}
@media(prefers-color-scheme:dark){:root{--bg:#0b1410;--fg:#e6f2ea;--mut:#8fa89a;--ac:#4ade80}}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px}
svg{width:160px;height:auto;margin-bottom:8px}
h1{margin:0 0 4px;font-size:1.6rem}
p{margin:0 0 20px;color:var(--mut)}
a{color:var(--ac);font-weight:600}
</style></head><body><main>
<svg viewBox="0 0 120 100" role="img" aria-label="A dead tick lying on its back with its legs in the air">
<g stroke="currentColor" stroke-width="3" stroke-linecap="round" fill="none">
<path d="M42 50 L24 28M46 46 L34 20M74 46 L86 20M78 50 L96 28M40 62 L20 74M44 70 L30 90M76 70 L90 90M80 62 L100 74"/></g>
<ellipse cx="60" cy="62" rx="26" ry="22" fill="var(--ac)"/>
<g stroke="var(--bg)" stroke-width="3" stroke-linecap="round"><path d="M46 52l8 8m0-8l-8 8M66 52l8 8m0-8l-8 8"/><path d="M52 74q8-5 16 0" fill="none"/></g>
</svg>
<h1>This tick is dead.</h1>
<p>That link is malformed. Nothing lives here.</p>
<a href="/">Back to the herd</a>
</main></body></html>`
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
}

let habits = []
let writing = Promise.resolve()

// ---------------------------------------------------------------------------
// Auth: one account (created on first run), scrypt-hashed password, signed session cookie.
// Files in DATA_DIR: auth.json (username + password hash) and secret.key (cookie signing key).
// ---------------------------------------------------------------------------
const scrypt = promisify(scryptCb)
const AUTH_FILE = path.join(DATA_DIR, "auth.json")
const SECRET_FILE = path.join(DATA_DIR, "secret.key")
const COOKIE = "tick_session"
const SESSION_MS = 30 * 24 * 3600 * 1000
const MIN_PASSWORD = 8
const MAX_FAILS = 8
const FAIL_WINDOW_MS = 15 * 60 * 1000

let account = null // { username, hash, createdAt }
let secret = null
let DUMMY_HASH = ""
const fails = new Map() // ip -> { count, since }

// Behind a reverse proxy, set TRUST_PROXY to the number of proxies in front of Tick (true = 1) so the login/setup
// rate limits see each visitor's address (taken from the right of X-Forwarded-For) instead of the proxy's.
const TRUST_PROXY = (() => {
  const v = (process.env.TRUST_PROXY || "").trim().toLowerCase()
  if (!v || v === "false" || v === "0") return 0
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : 1
})()
const clientIp = (req) => {
  const direct = req.socket.remoteAddress || "?"
  if (!TRUST_PROXY) return direct
  const hops = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean)
  return hops.length >= TRUST_PROXY ? hops[hops.length - TRUST_PROXY] : direct
}

// Sessions are remembered server-side (id -> expiry) so signing out, or changing the password, really revokes them.
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json")
const MAX_SESSIONS = 50
let sessions = new Map()

function pruneSessions() {
  const now = Date.now()
  for (const [id, exp] of sessions) if (exp <= now) sessions.delete(id)
  while (sessions.size > MAX_SESSIONS) sessions.delete(sessions.keys().next().value) // drop the oldest
}

async function saveSessions() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const tmp = SESSIONS_FILE + ".tmp"
  await fs.writeFile(tmp, JSON.stringify(Object.fromEntries(sessions)), { mode: 0o600 })
  await fs.rename(tmp, SESSIONS_FILE)
}

async function hashPassword(pw) {
  const salt = randomBytes(16)
  const key = await scrypt(pw, salt, 64)
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`
}

async function verifyPassword(pw, stored) {
  const [, saltHex, keyHex] = stored.split("$")
  const expected = Buffer.from(keyHex, "hex")
  const key = await scrypt(pw, Buffer.from(saltHex, "hex"), expected.length)
  return key.length === expected.length && timingSafeEqual(key, expected)
}

function validateCreds(username, password) {
  if (typeof username !== "string" || typeof password !== "string") return "Username and password are required."
  const u = username.trim()
  if (!u) return "Username is required."
  if (u.length > 40 || /[\x00-\x1f|]/.test(u)) return "Username must be 1-40 characters."
  if (password.length < MIN_PASSWORD) return `Password must be at least ${MIN_PASSWORD} characters.`
  if (password.length > 200) return "Password is too long."
  return null
}

async function saveAuth() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const tmp = AUTH_FILE + ".tmp"
  await fs.writeFile(tmp, JSON.stringify(account, null, 2), { mode: 0o600 })
  await fs.rename(tmp, AUTH_FILE)
}

async function loadAuth() {
  DUMMY_HASH = await hashPassword(randomUUID()) // burned on unknown-user logins so timing doesn't reveal the username
  try {
    account = JSON.parse(await fs.readFile(AUTH_FILE, "utf8"))
  } catch (e) {
    if (e.code !== "ENOENT") console.error("Could not read auth file:", e)
  }
  try {
    secret = Buffer.from(await fs.readFile(SECRET_FILE, "utf8"), "hex")
    if (secret.length !== 32) throw new Error("bad secret")
  } catch {
    secret = randomBytes(32)
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(SECRET_FILE, secret.toString("hex"), { mode: 0o600 })
  }
  try {
    sessions = new Map(Object.entries(JSON.parse(await fs.readFile(SESSIONS_FILE, "utf8"))).filter(([, exp]) => typeof exp === "number"))
    pruneSessions()
  } catch (e) {
    if (e.code !== "ENOENT") console.error("Could not read sessions file:", e)
  }
  // Optional: pre-create the account from the environment so nobody can claim it first on a public host.
  const { TICK_USERNAME: u, TICK_PASSWORD: p } = process.env
  if (!account && u && p) {
    const err = validateCreds(u, p)
    if (err) console.error("TICK_USERNAME/TICK_PASSWORD ignored:", err)
    else {
      account = { username: u.trim(), hash: await hashPassword(p), createdAt: new Date().toISOString() }
      await saveAuth()
      console.log(`Created account "${account.username}" from environment.`)
    }
  }
  console.log(account ? `Account: ${account.username}` : "No account yet - the first visitor will be asked to create one.")
}

// Changing the password changes this fingerprint, which signs every old session out.
const fingerprint = () => createHash("sha256").update(account.hash).digest("hex").slice(0, 16)
const sign = (payload) => createHmac("sha256", secret).update(payload).digest("base64url")

function makeToken(sessionId) {
  const payload = Buffer.from(JSON.stringify({ u: account.username, e: Date.now() + SESSION_MS, f: fingerprint(), s: sessionId })).toString("base64url")
  return `${payload}.${sign(payload)}`
}

// The verified payload of the session cookie (signature checked, nothing else), or null.
function readToken(req) {
  if (!account) return null
  const raw = (req.headers.cookie || "").split(";").map((c) => c.trim()).find((c) => c.startsWith(COOKIE + "="))
  if (!raw) return null
  const [payload, sig] = raw.slice(COOKIE.length + 1).split(".")
  if (!payload || !sig) return null
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString())
  } catch {
    return null
  }
}

function currentUser(req) {
  const t = readToken(req)
  if (!t || !(t.e > Date.now()) || t.u !== account.username || t.f !== fingerprint()) return null
  return typeof t.s === "string" && (sessions.get(t.s) || 0) > Date.now() ? account.username : null
}

async function startSession(req, res) {
  const id = randomBytes(16).toString("hex")
  sessions.set(id, Date.now() + SESSION_MS)
  pruneSessions()
  await saveSessions()
  setSession(req, res, makeToken(id), SESSION_MS / 1000)
}

function setSession(req, res, token, maxAgeSec) {
  const secure = req.headers["x-forwarded-proto"] === "https" ? "; Secure" : ""
  res.setHeader("set-cookie", `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${secure}`)
}

const rateLimited = (ip) => {
  const f = fails.get(ip)
  if (!f) return false
  if (Date.now() - f.since > FAIL_WINDOW_MS) { fails.delete(ip); return false }
  return f.count >= MAX_FAILS
}
const recordFail = (ip) => {
  if (fails.size > 1000) for (const [k, v] of fails) if (Date.now() - v.since > FAIL_WINDOW_MS) fails.delete(k)
  const f = fails.get(ip)
  if (!f || Date.now() - f.since > FAIL_WINDOW_MS) fails.set(ip, { count: 1, since: Date.now() })
  else f.count++
}

async function authApi(req, res, parts) {
  const action = parts[2]
  if (action === "status" && req.method === "GET") {
    const user = currentUser(req)
    return send(res, 200, { needsSetup: !account, authenticated: !!user, username: user })
  }
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" })

  if (action === "logout") {
    const t = readToken(req)
    if (t && typeof t.s === "string" && sessions.delete(t.s)) await saveSessions()
    setSession(req, res, "", 0)
    return send(res, 204)
  }

  if (action === "password") {
    if (!currentUser(req)) return send(res, 401, { error: "Not signed in" })
    const ip = clientIp(req)
    if (rateLimited(ip)) return send(res, 429, { error: "Too many failed attempts. Try again in a few minutes." })
    const b = await readBody(req)
    const current = typeof b.current === "string" ? b.current : ""
    const next = typeof b.next === "string" ? b.next : ""
    if (!(await verifyPassword(current, account.hash))) {
      recordFail(ip)
      return send(res, 403, { error: "Current password is incorrect." })
    }
    const err = validateCreds(account.username, next)
    if (err) return send(res, 400, { error: err })
    if (next === current) return send(res, 400, { error: "Choose a different password than the current one." })
    account.hash = await hashPassword(next)
    await saveAuth()
    fails.delete(ip)
    // Every other device is signed out: forget all sessions, then hand back a fresh one for this device.
    sessions.clear()
    await startSession(req, res)
    return send(res, 200, { username: account.username })
  }

  if (action === "setup") {
    const key = "setup:" + clientIp(req) // separate budget from logins; every refused attempt counts
    if (rateLimited(key)) return send(res, 429, { error: "Too many attempts. Try again in a few minutes." })
    if (account) {
      recordFail(key)
      return send(res, 409, { error: "An account already exists." })
    }
    const b = await readBody(req)
    const err = validateCreds(b.username, b.password)
    if (err) {
      recordFail(key)
      return send(res, 400, { error: err })
    }
    const hash = await hashPassword(b.password)
    if (account) return send(res, 409, { error: "An account already exists." }) // lost a race
    account = { username: b.username.trim(), hash, createdAt: new Date().toISOString() }
    await saveAuth()
    fails.delete(key)
    await startSession(req, res)
    return send(res, 201, { username: account.username })
  }

  if (action === "login") {
    const ip = clientIp(req)
    if (rateLimited(ip)) return send(res, 429, { error: "Too many failed attempts. Try again in a few minutes." })
    const b = await readBody(req)
    const known = account && typeof b.username === "string" && b.username.trim().toLowerCase() === account.username.toLowerCase()
    const password = typeof b.password === "string" ? b.password : ""
    const matches = await verifyPassword(password, known ? account.hash : DUMMY_HASH)
    if (!known || !matches) {
      recordFail(ip)
      return send(res, 401, { error: "Invalid username or password." })
    }
    fails.delete(ip)
    await startSession(req, res)
    return send(res, 200, { username: account.username })
  }
  return send(res, 404, { error: "Not found" })
}

async function load() {
  try {
    const parsed = JSON.parse(await fs.readFile(DATA_FILE, "utf8"))
    if (Array.isArray(parsed.habits)) habits = parsed.habits
  } catch (e) {
    if (e.code !== "ENOENT") console.error("Could not read data file:", e)
  }
}

function save() {
  // Serialize writes; write a temp file then rename so a crash never leaves a corrupt file.
  writing = writing
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true })
      const tmp = DATA_FILE + ".tmp"
      await fs.writeFile(tmp, JSON.stringify({ habits }, null, 2))
      await fs.rename(tmp, DATA_FILE)
    })
    .catch((e) => console.error("Save failed:", e))
  return writing
}

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" })
  res.end(body === undefined ? "" : JSON.stringify(body))
}

async function readBody(req, maxBytes = 10_000) {
  let size = 0
  const chunks = []
  for await (const c of req) {
    size += c.length
    if (size > maxBytes) throw Object.assign(new Error("Body too large"), { status: 413 })
    chunks.push(c)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"))
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { status: 400 })
  }
}

const cleanName = (v) => (typeof v === "string" ? v.trim().slice(0, 60) : "")
const cleanNote = (v) => (typeof v === "string" ? v.trim().slice(0, 500) : "")
const cleanEmoji = (v) => (typeof v === "string" ? [...v.trim()].slice(0, 2).join("") : "")

const MAX_IMPORT_HABITS = 500
const MAX_IMPORT_BYTES = 5_000_000

// Rebuild every habit from known fields only, so an imported file can't smuggle in junk. Returns null if unusable.
function sanitizeHabits(list) {
  if (!Array.isArray(list) || list.length > MAX_IMPORT_HABITS) return null
  const latest = maxTickDate()
  const seen = new Set()
  const out = []
  for (const h of list) {
    if (!h || typeof h !== "object") return null
    const name = cleanName(h.name)
    if (!name) return null
    const id = typeof h.id === "string" && /^[\w-]{1,64}$/.test(h.id) && !seen.has(h.id) ? h.id : randomUUID()
    seen.add(id)
    const days = {}
    if (h.days && typeof h.days === "object") {
      for (const k of Object.keys(h.days)) if (h.days[k] && isValidDate(k) && k <= latest) days[k] = true
    }
    out.push({
      id,
      name,
      emoji: cleanEmoji(h.emoji),
      createdAt: isValidDate(h.createdAt) ? h.createdAt : localDate(),
      archived: h.archived === true,
      note: cleanNote(h.note),
      days,
    })
  }
  return out
}

async function backupApi(req, res, kind) {
  if (!currentUser(req)) return send(res, 401, { error: "Not signed in" })
  if (kind === "export" && req.method === "GET") {
    res.writeHead(200, {
      "content-type": "application/json",
      "cache-control": "no-store",
      "content-disposition": `attachment; filename="tick-backup-${localDate()}.json"`,
    })
    return res.end(JSON.stringify({ app: "tick", version: 1, exportedAt: new Date().toISOString(), habits }, null, 2))
  }
  if (kind === "import" && req.method === "POST") {
    const b = await readBody(req, MAX_IMPORT_BYTES)
    const clean = sanitizeHabits(b.habits)
    if (!clean) return send(res, 400, { error: "That doesn't look like a Tick backup." })
    habits = clean // replaces everything
    await save()
    return send(res, 200, { habits })
  }
  return send(res, 405, { error: "Method not allowed" })
}

async function api(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean) // ["api","habits",id,"days",date]
  if (parts[1] === "health") return send(res, 200, { ok: true })
  if (parts[1] === "auth") return authApi(req, res, parts)
  if (parts[1] === "export" || parts[1] === "import") return backupApi(req, res, parts[1])
  if (parts[1] !== "habits") return send(res, 404, { error: "Not found" })
  if (!currentUser(req)) return send(res, 401, { error: "Not signed in" })
  const id = parts[2]
  const habit = id ? habits.find((h) => h.id === id) : undefined

  if (!id) {
    if (req.method === "GET") return send(res, 200, { habits })
    if (req.method === "POST") {
      const b = await readBody(req)
      const name = cleanName(b.name)
      if (!name) return send(res, 400, { error: "Name is required" })
      const h = {
        id: randomUUID(),
        name,
        emoji: cleanEmoji(b.emoji),
        createdAt: isValidDate(b.createdAt) ? b.createdAt : localDate(),
        archived: false,
        note: "",
        days: {},
      }
      habits.push(h)
      await save()
      return send(res, 201, h)
    }
    return send(res, 405, { error: "Method not allowed" })
  }
  if (id === "order" && parts.length === 3 && req.method === "PUT") {
    // Body: { ids: [...] } in the desired order. Habits not listed keep their relative order at the end.
    const b = await readBody(req)
    if (!Array.isArray(b.ids)) return send(res, 400, { error: "ids must be a list" })
    const rank = new Map(b.ids.map((x, i) => [x, i]))
    habits = habits
      .map((h, i) => ({ h, k: rank.has(h.id) ? rank.get(h.id) : b.ids.length + i }))
      .sort((a, z) => a.k - z.k)
      .map((x) => x.h)
    await save()
    return send(res, 200, { habits })
  }
  if (!habit) return send(res, 404, { error: "Habit not found" })

  if (parts.length === 3) {
    if (req.method === "PATCH") {
      const b = await readBody(req)
      if (b.name !== undefined) {
        const n = cleanName(b.name)
        if (!n) return send(res, 400, { error: "Name is required" })
        habit.name = n
      }
      if (b.emoji !== undefined) habit.emoji = cleanEmoji(b.emoji)
      if (b.archived !== undefined) habit.archived = b.archived === true
      if (b.note !== undefined) habit.note = cleanNote(b.note)
      await save()
      return send(res, 200, habit)
    }
    if (req.method === "DELETE") {
      habits = habits.filter((h) => h.id !== id)
      await save()
      return send(res, 204)
    }
  }
  if (parts.length === 5 && parts[3] === "days" && req.method === "PUT") {
    const date = parts[4]
    if (!isValidDate(date)) return send(res, 400, { error: "Bad date" })
    if (date > maxTickDate()) return send(res, 400, { error: "Can't tick days in the future" })
    const b = await readBody(req)
    if (b.done) habit.days[date] = true
    else delete habit.days[date]
    await save()
    return send(res, 200, habit)
  }
  return send(res, 405, { error: "Method not allowed" })
}

const COMPRESSIBLE = new Set([".html", ".js", ".css", ".svg", ".json", ".webmanifest"])
const brotli = promisify(zlib.brotliCompress)
const gzip = promisify(zlib.gzip)
const packed = new Map() // "file:size:encoding" -> Buffer (the build output is small and fixed)

async function compress(file, data, enc) {
  const key = `${file}:${data.length}:${enc}`
  let out = packed.get(key)
  if (!out) {
    out = enc === "br" ? await brotli(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 } }) : await gzip(data, { level: 6 })
    if (packed.size > 200) packed.clear()
    packed.set(key, out)
  }
  return out
}

async function serveStatic(req, res, url) {
  let rel
  try {
    rel = decodeURIComponent(url.pathname)
  } catch {
    res.writeHead(400, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" })
    return res.end(req.method === "HEAD" ? undefined : DEAD_TICK_PAGE)
  }
  let file = path.join(DIST, rel)
  if (file !== DIST && !file.startsWith(DIST + path.sep)) {
    res.writeHead(403)
    return res.end()
  }
  try {
    const st = await fs.stat(file)
    if (st.isDirectory()) file = path.join(file, "index.html")
  } catch {
    file = path.join(DIST, "index.html") // SPA fallback
  }
  try {
    const data = await fs.readFile(file)
    const ext = path.extname(file)
    const immutable = file.includes(`${path.sep}assets${path.sep}`)
    const headers = {
      "content-type": MIME[ext] || "application/octet-stream",
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    }
    let body = data
    if (COMPRESSIBLE.has(ext) && data.length > 1024) {
      headers.vary = "accept-encoding"
      const accept = String(req.headers["accept-encoding"] || "")
      const enc = /\bbr\b/.test(accept) ? "br" : /\bgzip\b/.test(accept) ? "gzip" : null
      if (enc) {
        body = await compress(file, data, enc)
        headers["content-encoding"] = enc
      }
    }
    headers["content-length"] = body.length
    res.writeHead(200, headers)
    res.end(req.method === "HEAD" ? undefined : body)
  } catch {
    res.writeHead(404)
    res.end("Not found")
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost")
    res.setHeader("x-content-type-options", "nosniff")
    res.setHeader("x-frame-options", "DENY")
    res.setHeader("referrer-policy", "no-referrer")
    // Only once the visitor is on HTTPS (as reported by the proxy), so plain-HTTP/LAN installs aren't affected.
    if (req.headers["x-forwarded-proto"] === "https") res.setHeader("strict-transport-security", "max-age=31536000")
    res.setHeader(
      "content-security-policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
    )
    // CSRF defense in depth (the session cookie is also SameSite=Strict): reject cross-origin writes.
    if (req.method !== "GET" && req.method !== "HEAD" && req.headers.origin) {
      // Behind a reverse proxy the Host header may be rewritten (nginx default), so also accept X-Forwarded-Host.
      const hosts = [req.headers.host, String(req.headers["x-forwarded-host"] || "").split(",")[0].trim()].filter(Boolean)
      let sameOrigin = false
      try { sameOrigin = hosts.includes(new URL(req.headers.origin).host) } catch {}
      if (!sameOrigin) return send(res, 403, { error: "Cross-origin request blocked" })
    }
    if (url.pathname.startsWith("/api/")) return await api(req, res, url)
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405)
      return res.end()
    }
    return await serveStatic(req, res, url)
  } catch (e) {
    send(res, e.status || 500, { error: e.status ? e.message : "Server error" })
    if (!e.status) console.error(e)
  }
})

await load()
await loadAuth()
server.listen(PORT, () => console.log(`Tick listening on :${PORT}, data in ${DATA_DIR}`))
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => writing.finally(() => process.exit(0)))
