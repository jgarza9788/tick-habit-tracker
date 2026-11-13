// Black-box tests: spawn the real server on a random port with a throwaway data dir.
import { test, before, after } from "node:test"
import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import net from "node:net"

const USER = "tester"
const PASS = "correct-horse-battery"
let proc, dir, base, cookie

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer()
    s.listen(0, () => {
      const { port } = s.address()
      s.close(() => resolve(port))
    })
    s.on("error", reject)
  })

const call = (method, path, body, headers = {}) =>
  fetch(base + path, {
    method,
    headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

const pad = (n) => String(n).padStart(2, "0")
const day = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

before(async () => {
  dir = await mkdtemp(join(tmpdir(), "tick-test-"))
  const port = await freePort()
  base = `http://127.0.0.1:${port}`
  proc = spawn(process.execPath, ["server/index.mjs"], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dir, DIST_DIR: join(dir, "dist"), TICK_USERNAME: USER, TICK_PASSWORD: PASS },
    stdio: "ignore",
  })
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base + "/api/health")).ok) break
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 100))
  }
  const res = await call("POST", "/api/auth/login", { username: USER, password: PASS })
  assert.equal(res.status, 200)
  cookie = res.headers.get("set-cookie").split(";")[0]
})

after(async () => {
  proc?.kill()
  await rm(dir, { recursive: true, force: true })
})

test("health needs no auth", async () => {
  const r = await fetch(base + "/api/health")
  assert.equal(r.status, 200)
})

test("data routes require a session", async () => {
  for (const p of ["/api/habits", "/api/export"]) {
    const r = await fetch(base + p)
    assert.equal(r.status, 401, p)
  }
  const imp = await fetch(base + "/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
  assert.equal(imp.status, 401)
})

test("login rejects a wrong password", async () => {
  const r = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: USER, password: "nope-nope-nope" }),
  })
  assert.equal(r.status, 401)
})

test("habit CRUD", async () => {
  let r = await call("POST", "/api/habits", { name: "  Read  ", emoji: "📚", createdAt: "2026-01-01" })
  assert.equal(r.status, 201)
  const h = await r.json()
  assert.equal(h.name, "Read")
  assert.equal(h.emoji, "📚")
  assert.equal(h.createdAt, "2026-01-01")

  assert.equal((await call("POST", "/api/habits", { name: "   " })).status, 400)

  r = await call("PATCH", `/api/habits/${h.id}`, { name: "Read more" })
  assert.equal((await r.json()).name, "Read more")

  r = await call("GET", "/api/habits")
  assert.ok((await r.json()).habits.some((x) => x.id === h.id))

  assert.equal((await call("DELETE", `/api/habits/${h.id}`)).status, 204)
  assert.equal((await call("PATCH", `/api/habits/${h.id}`, { name: "x" })).status, 404)
})

test("createdAt falls back to a valid date when the client value is bad", async () => {
  const h = await (await call("POST", "/api/habits", { name: "Bad date", createdAt: "2024-99-99" })).json()
  assert.match(h.createdAt, /^\d{4}-\d{2}-\d{2}$/)
  assert.notEqual(h.createdAt, "2024-99-99")
})

test("day ticks are validated", async () => {
  const h = await (await call("POST", "/api/habits", { name: "Ticks" })).json()
  const put = (date, done = true) => call("PUT", `/api/habits/${h.id}/days/${date}`, { done })

  assert.equal((await put("2024-99-99")).status, 400)
  assert.equal((await put("2025-02-30")).status, 400)
  assert.equal((await put("not-a-date")).status, 400)
  assert.equal((await put(day(3))).status, 400, "far future")

  assert.equal((await put(day(-5))).status, 200)
  const done = await (await put(day(0))).json()
  assert.equal(done.days[day(0)], true)

  const undone = await (await put(day(0), false)).json()
  assert.equal(undone.days[day(0)], undefined)
})

test("malformed URLs get the dead-tick 400 page", async () => {
  const r = await fetch(base + "/%E0%A4%A")
  assert.equal(r.status, 400)
  assert.match(await r.text(), /This tick is dead/)
})

test("export then import round-trips", async () => {
  const h = await (await call("POST", "/api/habits", { name: "Roundtrip", emoji: "🔁", createdAt: "2026-02-01" })).json()
  await call("PUT", `/api/habits/${h.id}/days/${day(-1)}`, { done: true })

  const exp = await call("GET", "/api/export")
  assert.equal(exp.status, 200)
  assert.match(exp.headers.get("content-disposition"), /attachment; filename="tick-backup-\d{4}-\d{2}-\d{2}\.json"/)
  const backup = await exp.json()
  assert.equal(backup.app, "tick")
  const original = backup.habits.find((x) => x.id === h.id)
  assert.ok(original)

  // Wipe everything, then restore.
  const cur = await (await call("GET", "/api/habits")).json()
  for (const x of cur.habits) await call("DELETE", `/api/habits/${x.id}`)
  assert.equal((await (await call("GET", "/api/habits")).json()).habits.length, 0)

  const imp = await call("POST", "/api/import", backup)
  assert.equal(imp.status, 200)
  const restored = (await (await call("GET", "/api/habits")).json()).habits.find((x) => x.id === h.id)
  assert.deepEqual(restored, original)
})

test("import sanitizes and rejects junk", async () => {
  assert.equal((await call("POST", "/api/import", { habits: "nope" })).status, 400)
  assert.equal((await call("POST", "/api/import", { habits: [{ name: "" }] })).status, 400)
  assert.equal((await call("POST", "/api/import", { habits: [null] })).status, 400)

  const r = await call("POST", "/api/import", {
    habits: [
      {
        id: "../../evil",
        name: "x".repeat(200),
        emoji: "abcdef",
        createdAt: "nope",
        extra: "dropped",
        days: { [day(-1)]: true, "2024-99-99": true, [day(10)]: true, [day(-2)]: false },
      },
    ],
  })
  assert.equal(r.status, 200)
  const [h] = (await r.json()).habits
  assert.notEqual(h.id, "../../evil")
  assert.equal(h.name.length, 60)
  assert.equal([...h.emoji].length, 2)
  assert.equal(h.extra, undefined)
  assert.deepEqual(Object.keys(h.days), [day(-1)])
})

test("archive and note are saved and survive export/import", async () => {
  const h = await (await call("POST", "/api/habits", { name: "Archivable" })).json()
  assert.equal(h.archived, false)
  assert.equal(h.note, "")

  let r = await call("PATCH", `/api/habits/${h.id}`, { archived: true, note: "  keep going  " })
  let u = await r.json()
  assert.equal(u.archived, true)
  assert.equal(u.note, "keep going")

  // Only a real boolean true archives; anything else restores.
  u = await (await call("PATCH", `/api/habits/${h.id}`, { archived: "yes" })).json()
  assert.equal(u.archived, false)

  u = await (await call("PATCH", `/api/habits/${h.id}`, { note: "x".repeat(900) })).json()
  assert.equal(u.note.length, 500)

  await call("PATCH", `/api/habits/${h.id}`, { archived: true })
  const backup = await (await call("GET", "/api/export")).json()
  const imp = await call("POST", "/api/import", backup)
  assert.equal(imp.status, 200)
  const back = (await (await call("GET", "/api/habits")).json()).habits.find((x) => x.id === h.id)
  assert.equal(back.archived, true)
  assert.equal(back.note.length, 500)
})

test("reorder puts habits in the requested order", async () => {
  const ids = []
  for (const name of ["R1", "R2", "R3"]) ids.push((await (await call("POST", "/api/habits", { name })).json()).id)
  const all = (await (await call("GET", "/api/habits")).json()).habits.map((x) => x.id)

  const wanted = [ids[2], ids[0], ids[1]]
  let r = await call("PUT", "/api/habits/order", { ids: wanted })
  assert.equal(r.status, 200)
  let order = (await (await call("GET", "/api/habits")).json()).habits.map((x) => x.id)
  assert.deepEqual(order.slice(0, 3), wanted)
  assert.equal(order.length, all.length, "nothing lost")

  // Unknown ids are ignored and unlisted habits keep their relative order after the listed ones.
  r = await call("PUT", "/api/habits/order", { ids: [ids[1], "does-not-exist"] })
  assert.equal(r.status, 200)
  order = (await (await call("GET", "/api/habits")).json()).habits.map((x) => x.id)
  assert.equal(order[0], ids[1])
  assert.equal(order.length, all.length)

  assert.equal((await call("PUT", "/api/habits/order", { ids: "nope" })).status, 400)
})

test("change password", async () => {
  const NEW = "a-brand-new-passphrase"
  const noAuth = await fetch(base + "/api/auth/password", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ current: PASS, next: NEW }),
  })
  assert.equal(noAuth.status, 401)

  assert.equal((await call("POST", "/api/auth/password", { current: "wrong-wrong-wrong", next: NEW })).status, 403)
  assert.equal((await call("POST", "/api/auth/password", { current: PASS, next: "short" })).status, 400)
  assert.equal((await call("POST", "/api/auth/password", { current: PASS, next: PASS })).status, 400)

  const oldCookie = cookie
  const ok = await call("POST", "/api/auth/password", { current: PASS, next: NEW })
  assert.equal(ok.status, 200)
  const fresh = ok.headers.get("set-cookie").split(";")[0]

  // The old session is signed out, the fresh one works.
  assert.equal((await fetch(base + "/api/habits", { headers: { cookie: oldCookie } })).status, 401)
  assert.equal((await fetch(base + "/api/habits", { headers: { cookie: fresh } })).status, 200)

  const login = (password) =>
    fetch(base + "/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: USER, password }),
    })
  assert.equal((await login(PASS)).status, 401, "old password no longer works")
  assert.equal((await login(NEW)).status, 200)
  cookie = fresh
})

// ---- Phase 4: hardening (each of these starts its own short-lived server) ----

async function withServer(env, fn, { dist = false } = {}) {
  const d = await mkdtemp(join(tmpdir(), "tick-test2-"))
  const port = await freePort()
  const url = `http://127.0.0.1:${port}`
  if (dist) {
    await mkdir(join(d, "dist", "assets"), { recursive: true })
    await writeFile(join(d, "dist", "index.html"), "<!doctype html><title>t</title>" + "<p>hello tick</p>".repeat(300))
    await writeFile(join(d, "dist", "assets", "app.js"), "console.log('x');".repeat(400))
    await writeFile(join(d, "dist", "tiny.css"), "a{}")
  }
  const child = spawn(process.execPath, ["server/index.mjs"], {
    env: { ...process.env, PORT: String(port), DATA_DIR: d, DIST_DIR: join(d, "dist"), ...env },
    stdio: "ignore",
  })
  try {
    for (let i = 0; i < 100; i++) {
      try {
        if ((await fetch(url + "/api/health")).ok) break
      } catch {
        // not up yet
      }
      await new Promise((r) => setTimeout(r, 100))
    }
    return await fn(url, d)
  } finally {
    child.kill()
    await rm(d, { recursive: true, force: true })
  }
}

const post = (url, path, body, headers = {}) =>
  fetch(url + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) })

test("signing out revokes that session on the server, other sessions stay valid", async () => {
  await withServer({ TICK_USERNAME: USER, TICK_PASSWORD: PASS }, async (url) => {
    const login = async () => (await post(url, "/api/auth/login", { username: USER, password: PASS })).headers.get("set-cookie").split(";")[0]
    const phone = await login()
    const laptop = await login()
    const ok = (c) => fetch(url + "/api/habits", { headers: { cookie: c } }).then((r) => r.status)
    assert.equal(await ok(phone), 200)
    assert.equal(await ok(laptop), 200)

    assert.equal((await post(url, "/api/auth/logout", {}, { cookie: phone })).status, 204)
    assert.equal(await ok(phone), 401, "the signed-out cookie is dead even though its signature is valid")
    assert.equal(await ok(laptop), 200, "other devices are untouched")
  })
})

test("a forged or pre-upgrade token without a known session id is rejected", async () => {
  await withServer({ TICK_USERNAME: USER, TICK_PASSWORD: PASS }, async (url) => {
    const good = (await post(url, "/api/auth/login", { username: USER, password: PASS })).headers.get("set-cookie").split(";")[0]
    const [payload, sig] = good.split("=")[1].split(".")
    const body = JSON.parse(Buffer.from(payload, "base64url").toString())
    body.s = "ffffffffffffffffffffffffffffffff"
    const tampered = `tick_session=${Buffer.from(JSON.stringify(body)).toString("base64url")}.${sig}`
    assert.equal((await fetch(url + "/api/habits", { headers: { cookie: tampered } })).status, 401)
  })
})

test("sessions survive a restart (they are stored in the data folder)", async () => {
  const d = await mkdtemp(join(tmpdir(), "tick-test3-"))
  const env = { TICK_USERNAME: USER, TICK_PASSWORD: PASS }
  const run = async (fn) => {
    const port = await freePort()
    const url = `http://127.0.0.1:${port}`
    const child = spawn(process.execPath, ["server/index.mjs"], { env: { ...process.env, PORT: String(port), DATA_DIR: d, ...env }, stdio: "ignore" })
    try {
      for (let i = 0; i < 100; i++) {
        try {
          if ((await fetch(url + "/api/health")).ok) break
        } catch {
          // not up yet
        }
        await new Promise((r) => setTimeout(r, 100))
      }
      return await fn(url)
    } finally {
      child.kill()
      await new Promise((r) => child.once("exit", r))
    }
  }
  try {
    const c = await run(async (url) => (await post(url, "/api/auth/login", { username: USER, password: PASS })).headers.get("set-cookie").split(";")[0])
    const status = await run((url) => fetch(url + "/api/habits", { headers: { cookie: c } }).then((r) => r.status))
    assert.equal(status, 200)
  } finally {
    await rm(d, { recursive: true, force: true })
  }
})

test("account setup is rate limited", async () => {
  await withServer({ TICK_USERNAME: USER, TICK_PASSWORD: PASS }, async (url) => {
    let last
    for (let i = 0; i < 8; i++) {
      last = await post(url, "/api/auth/setup", { username: "x", password: "whatever-pass" })
      assert.equal(last.status, 409)
    }
    last = await post(url, "/api/auth/setup", { username: "x", password: "whatever-pass" })
    assert.equal(last.status, 429)
  })
})

test("TRUST_PROXY gives each forwarded client its own login budget", async () => {
  await withServer({ TICK_USERNAME: USER, TICK_PASSWORD: PASS, TRUST_PROXY: "1" }, async (url) => {
    const bad = (ip) => post(url, "/api/auth/login", { username: USER, password: "wrong-wrong-wrong" }, { "x-forwarded-for": ip })
    for (let i = 0; i < 8; i++) assert.equal((await bad("203.0.113.5")).status, 401)
    assert.equal((await bad("203.0.113.5")).status, 429, "client A is locked out")
    assert.equal((await bad("203.0.113.6")).status, 401, "client B is not")
    // A spoofed leftmost entry doesn't help: only the address the proxy appended (rightmost) counts.
    assert.equal((await bad("198.51.100.99, 203.0.113.5")).status, 429)
  })
})

test("without TRUST_PROXY, X-Forwarded-For is ignored (one shared budget)", async () => {
  await withServer({ TICK_USERNAME: USER, TICK_PASSWORD: PASS }, async (url) => {
    const bad = (ip) => post(url, "/api/auth/login", { username: USER, password: "wrong-wrong-wrong" }, { "x-forwarded-for": ip })
    for (let i = 0; i < 8; i++) await bad(`203.0.113.${i}`)
    assert.equal((await bad("203.0.113.200")).status, 429)
  })
})

test("HSTS is sent only when the proxy says the request was HTTPS", async () => {
  await withServer({}, async (url) => {
    assert.equal((await fetch(url + "/api/health")).headers.get("strict-transport-security"), null)
    const r = await fetch(url + "/api/health", { headers: { "x-forwarded-proto": "https" } })
    assert.match(r.headers.get("strict-transport-security"), /max-age=\d+/)
  })
})

test("static files are compressed when the client accepts it", async () => {
  await withServer({}, async (url) => {
    const get = (path, enc) => fetch(url + path, { headers: enc ? { "accept-encoding": enc } : {} })

    const br = await get("/assets/app.js", "br, gzip")
    assert.equal(br.headers.get("content-encoding"), "br")
    assert.equal(br.headers.get("vary"), "accept-encoding")
    assert.equal(await br.text(), "console.log('x');".repeat(400))
    assert.ok(Number(br.headers.get("content-length")) < 400)

    const gz = await fetch(url + "/", { headers: { "accept-encoding": "gzip" } })
    assert.equal(gz.headers.get("content-encoding"), "gzip")
    // fetch transparently decodes the body, so the text is the original; the wire size shows it was compressed.
    const wire = Number(gz.headers.get("content-length"))
    const text = await gz.text()
    assert.match(text, /hello tick/)
    assert.ok(wire < text.length / 4, `expected a much smaller wire size (${wire} vs ${text.length})`)

    const plain = await get("/assets/app.js", "identity")
    assert.equal(plain.headers.get("content-encoding"), null)
    assert.equal((await plain.text()).length, "console.log('x');".length * 400)

    const tiny = await get("/tiny.css", "br")
    assert.equal(tiny.headers.get("content-encoding"), null, "too small to bother")
  }, { dist: true })
})
