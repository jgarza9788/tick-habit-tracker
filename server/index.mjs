// Tiny dependency-free API + static server. Data lives in a JSON file (mount DATA_DIR as a volume).
import http from "node:http"
import fs from "node:fs/promises"
import path from "node:path"
import { createHash, createHmac, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const PORT = Number(process.env.PORT || 3000)
const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data")
const DATA_FILE = path.join(DATA_DIR, "habits.json")
const DIST = path.resolve(process.env.DIST_DIR || "./dist")
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".json": "application/json",
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

function makeToken() {
  const payload = Buffer.from(JSON.stringify({ u: account.username, e: Date.now() + SESSION_MS, f: fingerprint() })).toString("base64url")
  return `${payload}.${sign(payload)}`
}

function currentUser(req) {
  if (!account) return null
  const raw = (req.headers.cookie || "").split(";").map((c) => c.trim()).find((c) => c.startsWith(COOKIE + "="))
  if (!raw) return null
  const [payload, sig] = raw.slice(COOKIE.length + 1).split(".")
  if (!payload || !sig) return null
  const expected = Buffer.from(sign(payload))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  try {
    const t = JSON.parse(Buffer.from(payload, "base64url").toString())
    return t.e > Date.now() && t.u === account.username && t.f === fingerprint() ? account.username : null
  } catch {
    return null
  }
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
    setSession(req, res, "", 0)
    return send(res, 204)
  }

  if (action === "setup") {
    if (account) return send(res, 409, { error: "An account already exists." })
    const b = await readBody(req)
    const err = validateCreds(b.username, b.password)
    if (err) return send(res, 400, { error: err })
    const hash = await hashPassword(b.password)
    if (account) return send(res, 409, { error: "An account already exists." }) // lost a race
    account = { username: b.username.trim(), hash, createdAt: new Date().toISOString() }
    await saveAuth()
    setSession(req, res, makeToken(), SESSION_MS / 1000)
    return send(res, 201, { username: account.username })
  }

  if (action === "login") {
    const ip = req.socket.remoteAddress || "?"
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
    setSession(req, res, makeToken(), SESSION_MS / 1000)
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

async function readBody(req) {
  let size = 0
  const chunks = []
  for await (const c of req) {
    size += c.length
    if (size > 10_000) throw Object.assign(new Error("Body too large"), { status: 413 })
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
const cleanEmoji = (v) => (typeof v === "string" ? [...v.trim()].slice(0, 2).join("") : "")

async function api(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean) // ["api","habits",id,"days",date]
  if (parts[1] === "health") return send(res, 200, { ok: true })
  if (parts[1] === "auth") return authApi(req, res, parts)
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
        createdAt: DATE_RE.test(b.createdAt) ? b.createdAt : new Date().toISOString().slice(0, 10),
        days: {},
      }
      habits.push(h)
      await save()
      return send(res, 201, h)
    }
    return send(res, 405, { error: "Method not allowed" })
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
    if (!DATE_RE.test(date)) return send(res, 400, { error: "Bad date" })
    const b = await readBody(req)
    if (b.done) habit.days[date] = true
    else delete habit.days[date]
    await save()
    return send(res, 200, habit)
  }
  return send(res, 405, { error: "Method not allowed" })
}

async function serveStatic(req, res, url) {
  const rel = decodeURIComponent(url.pathname)
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
    const immutable = file.includes(`${path.sep}assets${path.sep}`)
    res.writeHead(200, {
      "content-type": MIME[path.extname(file)] || "application/octet-stream",
      "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache",
    })
    res.end(req.method === "HEAD" ? undefined : data)
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
