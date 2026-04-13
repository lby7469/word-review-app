const crypto = require("node:crypto");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");

const express = require("express");

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fsSync.existsSync(envPath)) return;

  const content = fsSync.readFileSync(envPath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index <= 0) continue;

    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const DEFAULT_INTERVALS = [0, 1, 2, 4, 7, 15, 30];
const PORT = Number(process.env.PORT || 3000);
const TOKEN_SECRET = process.env.TOKEN_SECRET || "dev-change-this-secret";
const DATABASE_URL = process.env.DATABASE_URL || "";
const DATA_DIR = path.join(__dirname, ".local-data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const STATES_FILE = path.join(DATA_DIR, "states.json");
const YOUDAO_TRANSLATE_API_URL = "https://openapi.youdao.com/api";
const YOUDAO_APP_KEY = process.env.YOUDAO_APP_KEY || "";
const YOUDAO_APP_SECRET = process.env.YOUDAO_APP_SECRET || "";

function nowIso() {
  return new Date().toISOString();
}

function defaultState() {
  return {
    words: [],
    settings: { intervals: DEFAULT_INTERVALS.slice() },
    activity: { checkinDates: [], lastActiveDate: "" },
    updatedAt: nowIso(),
  };
}

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function validateUsername(username) {
  return /^[a-zA-Z0-9_-]{3,32}$/.test(username);
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 72;
}

function encodeBase64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function decodeBase64Url(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signTokenPart(unsigned) {
  return crypto.createHmac("sha256", TOKEN_SECRET).update(unsigned).digest("base64url");
}

function createToken(user) {
  const header = encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = encodeBase64Url(
    JSON.stringify({
      sub: user.id,
      username: user.username,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 14,
    })
  );
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${signTokenPart(unsigned)}`;
}

function verifyToken(token) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    throw new Error("invalid_token");
  }

  const [header, payload, signature] = parts;
  const unsigned = `${header}.${payload}`;
  const expected = signTokenPart(unsigned);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("invalid_signature");
  }

  const parsed = JSON.parse(decodeBase64Url(payload));
  if (!parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("token_expired");
  }

  return parsed;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = String(storedHash || "").split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(candidate, "hex"), Buffer.from(hash, "hex"));
}

function sanitizeIntervals(intervals) {
  const cleaned = Array.isArray(intervals)
    ? intervals
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value >= 0)
    : [];
  return cleaned.length ? Array.from(new Set(cleaned)).sort((a, b) => a - b) : DEFAULT_INTERVALS.slice();
}

function sanitizeActivity(activity) {
  const checkinDates = Array.isArray(activity?.checkinDates)
    ? Array.from(
        new Set(
          activity.checkinDates.filter((value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
        )
      ).sort()
    : [];

  return {
    checkinDates,
    lastActiveDate:
      typeof activity?.lastActiveDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(activity.lastActiveDate)
        ? activity.lastActiveDate
        : "",
  };
}

function sanitizeState(input) {
  return {
    words: Array.isArray(input?.words) ? input.words : [],
    settings: {
      intervals: sanitizeIntervals(input?.settings?.intervals),
    },
    activity: sanitizeActivity(input?.activity),
  };
}

function getYoudaoSignInput(value) {
  const text = String(value || "");
  return text.length <= 20 ? text : `${text.slice(0, 10)}${text.length}${text.slice(-10)}`;
}

async function lookupMeaningWithYoudao(word) {
  const q = String(word || "").trim();
  if (!q) {
    throw new Error("empty_word");
  }
  if (!YOUDAO_APP_KEY || !YOUDAO_APP_SECRET) {
    throw new Error("youdao_not_configured");
  }

  const salt = crypto.randomUUID().replace(/-/g, "");
  const curtime = String(Math.floor(Date.now() / 1000));
  const sign = crypto
    .createHash("sha256")
    .update(`${YOUDAO_APP_KEY}${getYoudaoSignInput(q)}${salt}${curtime}${YOUDAO_APP_SECRET}`)
    .digest("hex");

  const form = new URLSearchParams({
    q,
    from: "en",
    to: "zh-CHS",
    appKey: YOUDAO_APP_KEY,
    salt,
    sign,
    signType: "v3",
    curtime,
  });

  const response = await fetch(YOUDAO_TRANSLATE_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error("youdao_auth_failed");
    }
    throw new Error("youdao_request_failed");
  }

  const data = await response.json();
  if (String(data?.errorCode || "") !== "0") {
    if (String(data?.errorCode || "") === "202") {
      throw new Error("youdao_auth_failed");
    }
    throw new Error("youdao_request_failed");
  }

  const translation = Array.isArray(data?.translation) ? data.translation[0] : "";

  return String(translation || "").trim();
}

async function lookupMeaning(word) {
  const meaning = await lookupMeaningWithYoudao(word);
  return { meaning, provider: "youdao" };
}

class FileStore {
  async init() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await this.#ensureJsonFile(USERS_FILE, []);
    await this.#ensureJsonFile(STATES_FILE, {});
  }

  async #ensureJsonFile(filePath, initialValue) {
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, JSON.stringify(initialValue, null, 2), "utf8");
    }
  }

  async #readJson(filePath, fallback) {
    try {
      return JSON.parse(await fs.readFile(filePath, "utf8"));
    } catch {
      return fallback;
    }
  }

  async #writeJson(filePath, value) {
    await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
  }

  async createUser({ id, username, passwordHash }) {
    const users = await this.#readJson(USERS_FILE, []);
    if (users.some((user) => user.username === username)) {
      return null;
    }

    const record = { id, username, passwordHash, createdAt: nowIso() };
    users.push(record);
    await this.#writeJson(USERS_FILE, users);
    return record;
  }

  async findUserByUsername(username) {
    const users = await this.#readJson(USERS_FILE, []);
    return users.find((user) => user.username === username) || null;
  }

  async findUserById(id) {
    const users = await this.#readJson(USERS_FILE, []);
    return users.find((user) => user.id === id) || null;
  }

  async getStateByUserId(userId) {
    const states = await this.#readJson(STATES_FILE, {});
    return states[userId] || defaultState();
  }

  async saveState(userId, state) {
    const states = await this.#readJson(STATES_FILE, {});
    const nextState = {
      words: state.words,
      settings: state.settings,
      activity: state.activity,
      updatedAt: nowIso(),
    };
    states[userId] = nextState;
    await this.#writeJson(STATES_FILE, states);
    return nextState;
  }
}

class PostgresStore {
  constructor(connectionString) {
    const { Pool } = require("pg");
    const useSsl = process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false };
    this.pool = new Pool({
      connectionString,
      ssl: useSsl,
    });
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id UUID PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS user_states (
        user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
        words JSONB NOT NULL DEFAULT '[]'::jsonb,
        settings JSONB NOT NULL DEFAULT '{"intervals":[0,1,2,4,7,15,30]}'::jsonb,
        activity JSONB NOT NULL DEFAULT '{"checkinDates":[],"lastActiveDate":""}'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await this.pool.query(`
      ALTER TABLE user_states
      ADD COLUMN IF NOT EXISTS activity JSONB NOT NULL DEFAULT '{"checkinDates":[],"lastActiveDate":""}'::jsonb
    `);
  }

  async createUser({ id, username, passwordHash }) {
    const result = await this.pool.query(
      `
        INSERT INTO app_users (id, username, password_hash)
        VALUES ($1, $2, $3)
        ON CONFLICT (username) DO NOTHING
        RETURNING id, username, password_hash AS "passwordHash", created_at AS "createdAt"
      `,
      [id, username, passwordHash]
    );
    return result.rows[0] || null;
  }

  async findUserByUsername(username) {
    const result = await this.pool.query(
      `
        SELECT id, username, password_hash AS "passwordHash", created_at AS "createdAt"
        FROM app_users
        WHERE username = $1
      `,
      [username]
    );
    return result.rows[0] || null;
  }

  async findUserById(id) {
    const result = await this.pool.query(
      `
        SELECT id, username, password_hash AS "passwordHash", created_at AS "createdAt"
        FROM app_users
        WHERE id = $1
      `,
      [id]
    );
    return result.rows[0] || null;
  }

  async getStateByUserId(userId) {
    const result = await this.pool.query(
      `
        SELECT words, settings, activity, updated_at AS "updatedAt"
        FROM user_states
        WHERE user_id = $1
      `,
      [userId]
    );
    return result.rows[0] || defaultState();
  }

  async saveState(userId, state) {
    const result = await this.pool.query(
      `
        INSERT INTO user_states (user_id, words, settings, activity, updated_at)
        VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET
          words = EXCLUDED.words,
          settings = EXCLUDED.settings,
          activity = EXCLUDED.activity,
          updated_at = NOW()
        RETURNING words, settings, activity, updated_at AS "updatedAt"
      `,
      [userId, JSON.stringify(state.words), JSON.stringify(state.settings), JSON.stringify(state.activity)]
    );
    return result.rows[0];
  }
}

async function createStore() {
  if (DATABASE_URL) {
    const store = new PostgresStore(DATABASE_URL);
    await store.init();
    return { store, mode: "postgres" };
  }

  const store = new FileStore();
  await store.init();
  return { store, mode: "file" };
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
  };
}

async function main() {
  const { store, mode } = await createStore();
  const app = express();

  app.use(express.json({ limit: "2mb" }));

  app.get("/", (_req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
  });

  app.get("/login", (_req, res) => {
    res.sendFile(path.join(__dirname, "login.html"));
  });

  app.get("/app", (_req, res) => {
    res.sendFile(path.join(__dirname, "aibinghaosi.html"));
  });

  app.get("/app/review", (_req, res) => {
    res.sendFile(path.join(__dirname, "aibinghaosi.html"));
  });

  app.get("/aibinghaosi.html", (_req, res) => {
    res.redirect("/app");
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, storage: mode, time: nowIso() });
  });

  app.post("/api/auth/register", async (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || "");

    if (!validateUsername(username)) {
      return res.status(400).json({ error: "用户名需为 3-32 位，只能包含字母、数字、下划线或连字符。" });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: "密码长度需在 8-72 位之间。" });
    }

    const user = await store.createUser({
      id: crypto.randomUUID(),
      username,
      passwordHash: hashPassword(password),
    });

    if (!user) {
      return res.status(409).json({ error: "该用户名已存在。" });
    }

    const token = createToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  });

  app.post("/api/auth/login", async (req, res) => {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password || "");

    const user = await store.findUserByUsername(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "用户名或密码错误。" });
    }

    const token = createToken(user);
    res.json({ token, user: publicUser(user) });
  });

  app.post("/api/auth/logout", (_req, res) => {
    res.status(204).end();
  });

  app.use("/api", async (req, res, next) => {
    if (
      req.path === "/health" ||
      req.path === "/auth/login" ||
      req.path === "/auth/register" ||
      req.path === "/auth/logout"
    ) {
      return next();
    }

    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) {
      return res.status(401).json({ error: "missing_token" });
    }

    try {
      const payload = verifyToken(token);
      const user = await store.findUserById(payload.sub);
      if (!user) {
        return res.status(401).json({ error: "user_not_found" });
      }

      req.user = publicUser(user);
      next();
    } catch {
      res.status(401).json({ error: "invalid_token" });
    }
  });

  app.get("/api/auth/me", (req, res) => {
    res.json({ user: req.user });
  });

  app.post("/api/lookup/meaning", async (req, res) => {
    const word = String(req.body?.word || "").trim();
    if (!word) {
      return res.status(400).json({ error: "请输入要查询的单词。" });
    }

    try {
      const result = await lookupMeaning(word);
      const meaning = String(result?.meaning || "").trim();
      if (!meaning) {
        return res.status(404).json({ error: "未查询到简短释义。" });
      }
      res.json({ meaning, provider: result.provider });
    } catch (error) {
      if (error.message === "youdao_auth_failed") {
        return res.status(502).json({ error: "有道翻译鉴权失败，请检查 YOUDAO_APP_KEY 和 YOUDAO_APP_SECRET。" });
      }
      if (error.message === "youdao_request_failed" || error.message === "youdao_not_configured") {
        return res.status(502).json({ error: "有道翻译接口调用失败，请检查环境变量配置和服务状态。" });
      }
      if (error.message === "empty_word") {
        return res.status(400).json({ error: "请输入要查询的单词。" });
      }
      throw error;
    }
  });

  app.get("/api/state", async (req, res) => {
    const state = await store.getStateByUserId(req.user.id);
    res.json(state);
  });

  app.put("/api/state", async (req, res) => {
    const nextState = sanitizeState(req.body);
    const saved = await store.saveState(req.user.id, nextState);
    res.json(saved);
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: "server_error" });
  });

  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Storage mode: ${mode}`);
    if (!DATABASE_URL) {
      console.log("Using local JSON storage. Set DATABASE_URL to enable cloud PostgreSQL.");
    }
  });
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
