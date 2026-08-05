/* ==========================================
   my home app.js v202
   S1开始:数据 / 仓库 / 工具 / markdown / 外观引擎
   ========================================== */

const LS_KEY = "home_data_v3";
const OLD_KEYS = ["home_data_v2", "home_data_v1"];
const NL = String.fromCharCode(10);
const HEART = String.fromCharCode(0x2665) + String.fromCharCode(0xFE0E);
const LOVE_START = new Date(2026, 5, 7);

let DB = null;
let state = null;
let streaming = false;
let abortCtrl = null;
let pendingImgs = [];
let lastFailedCtx = null;

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- 默认设置 ---------- */
function defaultSettings() {
  const provId = uid();
  return {
    providers: [{ id: provId, name: "默认供应商", baseURL: "", apiKey: "", models: [], model: "" }],
    currentProviderId: provId,
    temperature: 1,
    contextCount: 20,
    streamMode: "stream",
    fontSize: 14,
    skin: "day",
    skinGlow: 0,
    darkMode: false,
    titleCenter: false,
    titleFs: 15,
    titleFw: 600,
    inputLift: 30,
    avatarShape: "circle",
    avatarSize: 30,
    bubbleAlign: "side",
    msgGap: 16,
    metaGap: 5,
    showTime: true,
    timeFmt: "md",
    timeAt: "above",
    showToken: true,
    showName: true,
    showAvatar: true,
    splitTimeLast: false,
    splitAvatarOnce: false,
    sidebarStyle: "white",
    sidebarAlpha: 72,
    sidebarBlur: 5,
    menuLang: "zh",
    bubbleTexture: "water",
    bubbleShape: "round-lg",
    aiBare: false,
    bubbleGlow: 0,
    bubblePadV: 8,
    bubblePadH: 12,
    bubbleMaxW: 82,
    bubbleRadius: 14,
    userHue: -1, userSat: 70, userLight: 85, userAlpha: 90,
    aiHue: -1, aiSat: 70, aiLight: 90, aiAlpha: 90,
    chatFont: "system",
    chatSpacing: 0, chatLineH: 1.6, chatWeight: 400,
    uiFont: "system",
    uiSpacing: 0, uiLineH: 1.5, uiWeight: 400,
    nameFont: "round",
    nameWeight: 500,
    metaFont: "round",
    metaSize: 10, metaWeight: 400, metaShade: 150,
    aiTypoOn: false,
    aiFont2: "system", aiSize2: 16, aiWeight2: 400, aiSpacing2: 0, aiLineH2: 1.6,
    selectOn: true,
    showModelBtn: true,
    thinkOn: false,
    thinkMode: "fold",
    thinkHue: 0, thinkSat: 0, thinkLight: 96, thinkAlpha: 80,
    memHue: 0, memSat: 0, memLight: 97, memAlpha: 90,
    memBtnHue: 0, memBtnSat: 0, memBtnLight: 10, memBtnAlpha: 100,
    splitSend: false,
    splitMax: 20,
    sumRemindOn: false,
    sumEvery: 100,
    daysFont: "georgia2",
    daysNumSize: 64,
    daysTheme: "cream",
    roomThemes: {},
    daysGlassMode: "frost",
    daysGlassAlpha: 55,
    daysInkHue: -1, daysInkSat: 30, daysInkLight: 40,
    iconRound: "squircle",
    iconHue: -1, iconSat: 40, iconLight: 92, iconAlpha: 75,
    iconGlow: 0,
    dockStyle: "frost",
    dockAlpha: 60,
    dockDrop: 8,
    uiFs: 14,
    nameSize: 11,
    daysDateSize: 12,
       coupleAuto: false,
    paraGap: 8,
    globalDim: 0,
    topbarAlpha: 100,
    nameDrop: 0,
    msgBarOn: true,
    nameMid: false,
    msgBarGap: 8,
    splitGap: 6,
    tokenInBar: false,
    bubblePresets: [],
    avBubbleGap: 6,
    chatUi: "home"
  };
}

function defaultHome() {
  return {
    moods: [],
    letters: [],
    diaries: [],
    qa: [],
    feed: [],
    slotNameA: "备忘录",
    slotNameB: "相册",
    digestOn: false,
    lastLetterDay: "",
    lastDiaryDay: "",
      lastFeedDay: "",
    lastSumLen: 0,
        notes: [],
    noteShowMeta: true
  };
}

function defaultState() {
  const roleId = uid();
  const sessionId = uid();
  return {
    settings: defaultSettings(),
    home: defaultHome(),
    currentRoleId: roleId,
    roles: [{
      id: roleId,
      name: "默认角色",
      systemPrompt: "",
      aiName: "Claude",
      userName: "我",
      currentSessionId: sessionId,
      sessions: [{ id: sessionId, name: "新对话", messages: [] }],
      memories: [],
      memPending: []
    }]
  };
}

function fillDefaults() {
  const d = defaultSettings();
  for (const k in d) {
    if (state.settings[k] === undefined) state.settings[k] = d[k];
  }
  if (state.settings.darkMode && state.settings.skin === "day") {
    state.settings.skin = "night";
  }
  if (state.settings.bubbleShape === "iso-down" || state.settings.bubbleShape === "iso-up") {
    state.settings.bubbleShape = "pull";
  }
  if (!state.settings.roomThemes || typeof state.settings.roomThemes !== "object") {
    state.settings.roomThemes = {};
  }
  {
    const rt = state.settings.roomThemes;
    ["home", "notebook", "letter", "diary", "mood", "qa", "couple"].forEach(rm => {
      if (rt[rm] === undefined) {
        rt[rm] = (rm === "home") ? (state.settings.daysTheme || "cream") : "cream";
      }
    });
  }
  if (!state.home) state.home = defaultHome();
  const h = defaultHome();
  for (const k in h) {
    if (state.home[k] === undefined) state.home[k] = h[k];
  }
  state.roles.forEach(r => {
    if (!r.memories) r.memories = [];
    if (!r.memPending) r.memPending = [];
    if (r.starAvatar) delete r.starAvatar;
  });
}

function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      state = JSON.parse(raw);
      fillDefaults();
      return;
    }
    for (const key of OLD_KEYS) {
      const old = localStorage.getItem(key);
      if (!old) continue;
      const o = JSON.parse(old);
      state = defaultState();
      if (o.roles && o.roles.length) {
        state.roles = o.roles;
        state.currentRoleId = o.currentRoleId || o.roles[0].id;
      }
      if (o.settings) {
        if (o.settings.providers && o.settings.providers.length) {
          state.settings.providers = o.settings.providers;
          state.settings.currentProviderId = o.settings.currentProviderId || o.settings.providers[0].id;
        }
        state.settings.temperature = o.settings.temperature || 1;
        state.settings.contextCount = o.settings.contextCount || 20;
        state.settings.fontSize = o.settings.fontSize || 14;
      }
      fillDefaults();
      saveState();
      return;
    }
    state = defaultState();
    saveState();
  } catch (e) {
    state = defaultState();
  }
}

/* ---------- 三位正主 ---------- */
function curRole() {
  return state.roles.find(r => r.id === state.currentRoleId) || state.roles[0];
}

function curSession() {
  const r = curRole();
  return r.sessions.find(s => s.id === r.currentSessionId) || r.sessions[0];
}

function curProvider() {
  const st = state.settings;
  return st.providers.find(p => p.id === st.currentProviderId) || st.providers[0];
}

/* ---------- IndexedDB 图片仓库 ---------- */
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("home_images", 1);
    req.onupgradeneeded = () => { req.result.createObjectStore("imgs"); };
    req.onsuccess = () => { DB = req.result; resolve(); };
    req.onerror = () => reject(req.error);
  });
}

function putImg(key, blob) {
  return new Promise((resolve, reject) => {
    const tx = DB.transaction("imgs", "readwrite");
    tx.objectStore("imgs").put(blob, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

function getImg(key) {
  return new Promise((resolve) => {
    function read() {
      const tx = DB.transaction("imgs", "readonly");
      const rq = tx.objectStore("imgs").get(key);
      rq.onsuccess = () => resolve(rq.result || null);
      rq.onerror = () => resolve(null);
    }
    if (DB) { read(); return; }
    let n = 0;
    const t = setInterval(() => {
      n++;
      if (DB) { clearInterval(t); read(); }
      else if (n > 80) { clearInterval(t); resolve(null); }
    }, 100);
  });
}

function delImg(key) {
  return new Promise((resolve) => {
    if (!DB) { resolve(); return; }
    const tx = DB.transaction("imgs", "readwrite");
    tx.objectStore("imgs").delete(key);
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
}

/* ---------- 小工具 ---------- */
function $(sel) { return document.querySelector(sel); }

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function toast(msg, ms) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove("show"), ms || 3000);
}

function praise(msg) {
  let p = document.getElementById("float-praise");
  if (!p) {
    p = el("div", "");
    p.id = "float-praise";
    document.body.appendChild(p);
  }
  p.textContent = msg;
  p.classList.remove("show");
  void p.offsetWidth;
  p.classList.add("show");
  clearTimeout(p._timer);
  p._timer = setTimeout(() => p.classList.remove("show"), 1800);
}

function fmtTime(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, "0");
  const f = state.settings.timeFmt;
  const hm = p(d.getHours()) + ":" + p(d.getMinutes());
  if (f === "hm") return hm;
  if (f === "ymd") return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate()) + " " + hm;
  return p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + hm;
}

function todayKey() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

function todayPretty() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  const wk = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate()) + " " + wk[d.getDay()];
}

function loveDays() {
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(LOVE_START.getFullYear(), LOVE_START.getMonth(), LOVE_START.getDate());
  return Math.floor((a - b) / 86400000) + 1;
}

/* ---------- markdown轻渲染:已停用,代码留着随时恢复 ---------- */
function escHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mdRender(s) {
  let t = escHtml(s);
  t = t.replace(/^[ \t]*(---+|\*\*\*+)[ \t]*$/gm, "");
  t = t.replace(/^#{1,4}[ \t]+/gm, "");
  t = t.replace(/^&gt;[ \t]?/gm, "");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/\*([^*\s][^*]*)\*/g, "<em>$1</em>");
  return t;
}

function setMsgHtml(node, text) {
  node.innerHTML = "";
  const gap = state.settings.paraGap === undefined ? 8 : state.settings.paraGap;
  const paras = String(text).split(new RegExp(NL + "{2,}"));
  paras.forEach((p, i) => {
    const d = document.createElement("div");
    d.style.whiteSpace = "pre-wrap";
    const parts = p.split("——");
    parts.forEach((seg, j) => {
      if (seg) d.appendChild(document.createTextNode(seg));
      if (j < parts.length - 1) {
        const dash = document.createElement("span");
        dash.textContent = "——";
        dash.style.cssText = "letter-spacing:-0.16em;margin-right:0.16em;";
        d.appendChild(dash);
      }
    });
    if (i < paras.length - 1) d.style.marginBottom = gap + "px";
    node.appendChild(d);
  });
}



/* ---------- 默认头像 ---------- */
const AI_FALLBACK = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" rx="36" fill="#E8E2D5"/><circle cx="36" cy="36" r="10" fill="#C9BFA9"/></svg>'
);
const USER_FALLBACK = "data:image/svg+xml;utf8," + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72"><rect width="72" height="72" rx="36" fill="#8aa2c8"/><circle cx="36" cy="28" r="12" fill="#fff"/><ellipse cx="36" cy="58" rx="20" ry="14" fill="#fff"/></svg>'
);

const urlCache = {};

async function avatarSrc(kind) {
  const key = curRole().id + "_" + kind;
  if (urlCache[key]) return urlCache[key];
  const blob = await getImg(key);
  if (blob) {
    urlCache[key] = URL.createObjectURL(blob);
    return urlCache[key];
  }
  return kind === "ai" ? AI_FALLBACK : USER_FALLBACK;
}

function clearUrlCache() {
  Object.keys(urlCache).forEach(k => {
    URL.revokeObjectURL(urlCache[k]);
    delete urlCache[k];
  });
}

/* ---------- 四路背景 ---------- */
async function applyBg() {
  const bgEl = $("#chat-bg");
  const blob = await getImg(curRole().id + "_bg");
  if (blob) {
    const u = URL.createObjectURL(blob);
    bgEl.style.backgroundImage = "url(" + u + ")";
    bgEl.classList.add("has-bg");
    const H = document.documentElement;
    H.style.backgroundImage = "url(" + u + ")";
    H.style.backgroundSize = "cover";
    H.style.backgroundPosition = "center";
    document.body.style.background = "transparent";
  } else {
    bgEl.style.backgroundImage = "";
    bgEl.classList.remove("has-bg");
    document.documentElement.style.backgroundImage = "";
    document.body.style.background = "";
  }

  const sbg = $("#sidebar-bg");
  const sblob = await getImg("bg_sidebar");
  sbg.style.backgroundImage = sblob ? "url(" + URL.createObjectURL(sblob) + ")" : "";
  const ibg = $("#input-box-bg");
  const iblob = await getImg("bg_input");
  ibg.style.backgroundImage = iblob ? "url(" + URL.createObjectURL(iblob) + ")" : "";
}

/* ---------- 图片压缩 ---------- */
function compressImage(file, maxSide, quality) {
  maxSide = maxSide || 1024;
  quality = quality || 0.8;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width, h = img.height;
      if (Math.max(w, h) > maxSide) {
        const k = maxSide / Math.max(w, h);
        w = Math.round(w * k);
        h = Math.round(h * k);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("图片读取失败")); };
    img.src = url;
  });
}

/* ---------- 字体表 ---------- */
const FONT_LIST = {
  system: '-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif',
  round: 'ui-rounded,"SF Pro Rounded","PingFang SC",sans-serif',
  song: '"Songti SC","STSong",Georgia,serif',
  kai: '"Kaiti SC","STKaiti",serif',
  hei: '"PingFang SC","Heiti SC",sans-serif',
  mono: 'ui-monospace,Menlo,Consolas,monospace',
  kaiti: "'Kaiti SC','STKaiti','KaiTi',serif",
  songti2: "'Songti SC','STSong',serif",
  georgia2: "Georgia,'Songti SC',serif",
  palatino: "Palatino,'Songti SC',serif",
  snell: "'Snell Roundhand','Kaiti SC',cursive",
  marker: "'Marker Felt','Kaiti SC',sans-serif"
};
const FONT_NAMES = {
  system: "系统", round: "圆体", song: "宋体", kai: "楷体", hei: "黑体", mono: "等宽",
  kaiti: "楷体（手写感）", songti2: "宋体（书卷感）", georgia2: "Georgia（数字优雅）",
  palatino: "Palatino（衬线）", snell: "Snell（英文花体）", marker: "Marker（手账感）"
};

/* ---------- 菜单双语表 ---------- */
const MENU_TEXT = {
  zh: { theme: "主题", role: "角色", memory: "记忆", days: "相识", session: "会话", settings: "设置" },
  en: { theme: "Theme", role: "Roles", memory: "Memory", days: "Company", session: "Chats", settings: "Settings" }
};

/* ---------- 气泡形状表 ---------- */
const BUBBLE_SHAPES = {
  "round-lg": { name: "大圆角" },
  "rect": { name: "方角" },
  "tail": { name: "小三角" },
  "wechat": { name: "微信方角" },
  "pill": { name: "胶囊" },
  "corner": { name: "圆角矩形（尖角下）" },
  "corner-up": { name: "圆角矩形（尖角上）" },
  "sharp": { name: "尖角矩形（零圆角）" },
  "pull": { name: "拉角尾（角落拽出的尖）" }
};

/* ---------- 快捷色块 ---------- */
const QUICK_COLORS = [
  { name: "纯白", h: 0, s: 0, l: 100, a: 100 },
  { name: "灰", h: 45, s: 12, l: 93, a: 100 },
  { name: "黑", h: 0, s: 0, l: 8, a: 100 },
  { name: "奶茶", h: 0, s: 0, l: 88, a: 100 },
  { name: "天蓝", h: 206, s: 100, l: 82, a: 100 },
  { name: "粉", h: 350, s: 82, l: 87, a: 100 },
  { name: "微信绿", h: 100, s: 65, l: 72, a: 92 }
];

/* ---------- HSL颜色引擎 ---------- */
function hslaOf(h, s, l, a) {
  return "hsla(" + h + "," + s + "%," + l + "%," + (a / 100) + ")";
}

function bubbleColorOf(isUser) {
  const st = state.settings;
  const hue = isUser ? st.userHue : st.aiHue;
  if (hue < 0) return null;
  const s = isUser ? st.userSat : st.aiSat;
  const l = isUser ? st.userLight : st.aiLight;
  const a = (isUser ? st.userAlpha : st.aiAlpha) / 100;
  return {
    bg: "hsla(" + hue + "," + s + "%," + l + "%," + a + ")",
    dark: l < 45
  };
}

/* ---------- 气泡上妆 ---------- */
async function dressBubble(bubble, isUser) {
  const st = state.settings;
  bubble.className = "msg-bubble " + (isUser ? "bub-user" : "bub-ai");
  bubble.style.cssText = "";

  if (st.aiBare && !isUser) {
    bubble.style.padding = "0 2px";
    return;
  }

  bubble.style.padding = st.bubblePadV + "px " + st.bubblePadH + "px";

  let radius = st.bubbleRadius + "px";
  if (st.bubbleShape === "rect") radius = "3px";
  if (st.bubbleShape === "sharp") radius = "0px";
  if (st.bubbleShape === "pill") {
    radius = "999px";
    bubble.style.padding = st.bubblePadV + "px " + (st.bubblePadH + 4) + "px";
  }
  if (st.bubbleShape === "corner" || st.bubbleShape === "corner-up") {
    const r = st.bubbleRadius;
    const small = Math.max(3, Math.round(r * 0.25));
    const up = st.bubbleShape === "corner-up";
    if (isUser) {
      bubble.style.borderRadius = up ? r + "px " + small + "px " + r + "px " + r + "px"
        : r + "px " + r + "px " + small + "px " + r + "px";
    } else {
      bubble.style.borderRadius = up ? small + "px " + r + "px " + r + "px " + r + "px"
        : r + "px " + r + "px " + r + "px " + small + "px";
    }
  } else {
    bubble.style.borderRadius = radius;
  }

  const sideTail = ["tail", "wechat", "rect", "sharp"].indexOf(st.bubbleShape) >= 0;
  const pullTail = st.bubbleShape === "pull";
  const tailed = sideTail || pullTail;
  const hsl = bubbleColorOf(isUser);
  const g = (st.bubbleGlow || 0) / 100;

  const bgKey = isUser ? "bubble_user" : "bubble_ai";
  const bgBlob = await getImg(bgKey);
  if (bgBlob) {
    if (!urlCache[bgKey]) urlCache[bgKey] = URL.createObjectURL(bgBlob);
    bubble.style.backgroundImage = "url(" + urlCache[bgKey] + ")";
    bubble.style.backgroundSize = "cover";
    bubble.style.color = st.skin === "night" ? "#f2f2f2" : "var(--text-main)";
    bubble.style.boxShadow = "0 1px 6px rgba(0,0,0,0.08)";
    return;
  }

  function addTailClass(bg) {
    bubble.style.setProperty("--tail-c", bg);
    if (sideTail) {
      bubble.classList.add("bs-" + st.bubbleShape + "-" + (isUser ? "user" : "ai"));
    } else {
      bubble.classList.add(isUser ? "bs-pull-user" : "bs-pull-ai");
    }
  }

  if (hsl) {
    const hue = isUser ? st.userHue : st.aiHue;
    const s = isUser ? st.userSat : st.aiSat;
    const l = isUser ? st.userLight : st.aiLight;
    let bg = hsl.bg;
    if (tailed) {
      bg = "hsl(" + hue + "," + s + "%," + l + "%)";
    }
    bubble.style.background = bg;
    bubble.style.color = hsl.dark ? "#f2f2f2" : "var(--text-main)";

    if (g > 0) {
      const glow = "hsla(" + hue + "," + Math.max(s, 25) + "%," + Math.max(l - 28, 10) + "%," + (0.22 * g).toFixed(2) + ")";
      bubble.style.boxShadow = "0 1px 4px rgba(0,0,0,0.05), 0 2px " + Math.round(3 + 4 * g) + "px " + glow;
    } else {
      bubble.style.boxShadow = "none";
    }
    if (st.bubbleTexture === "frost" && !tailed) {
      bubble.style.backdropFilter = "blur(20px) saturate(1.6)";
      bubble.style.webkitBackdropFilter = "blur(20px) saturate(1.6)";
      bubble.style.border = "0.5px solid rgba(255,255,255,0.3)";
    }
    if (tailed) addTailClass(bg);
  } else {
    if (st.bubbleTexture === "frost") {
      bubble.style.background = st.skin === "night" ? "rgba(60,60,64,0.35)" : "rgba(255,255,255,0.45)";
      bubble.style.backdropFilter = "blur(20px) saturate(1.6)";
      bubble.style.webkitBackdropFilter = "blur(20px) saturate(1.6)";
      bubble.style.border = "0.5px solid rgba(255,255,255,0.35)";
      bubble.style.boxShadow = "0 1px 3px rgba(0,0,0,0.03), 0 4px 14px rgba(0,0,0,0.05)";
    } else if (st.bubbleTexture === "water") {
      bubble.style.background = "linear-gradient(155deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.14) 100%)";
      bubble.style.boxShadow = "inset 0 1px 1px rgba(255,255,255,0.5), 0 2px 10px rgba(0,0,0,0.04)";
    } else {
      bubble.style.background = st.skin === "night" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.3)";
      bubble.style.boxShadow = "0 1px 8px rgba(0,0,0,0.04)";
    }
    if (g > 0) {
      bubble.style.boxShadow += ", 0 2px " + Math.round(4 + 5 * g) + "px rgba(160,140,130," + (0.12 * g).toFixed(2) + ")";
    }
    if (tailed) {
      addTailClass(st.skin === "night" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.55)");
    }
    bubble.style.color = st.skin === "night" ? "#f2f2f2" : "var(--text-main)";
  }
}

/* ---------- 小字上妆 ---------- */
function dressMeta(row, isUser) {
  const st = state.settings;
  const metaF = FONT_LIST[st.metaFont];
  const nameF = FONT_LIST[st.nameFont];
  const night = st.skin === "night";
  const g = night ? Math.min(255, st.metaShade + 60) : st.metaShade;
  const gray = "rgb(" + g + "," + g + "," + g + ")";
  const ng = night ? Math.min(255, g + 20) : Math.max(60, g - 40);
  const nameGray = "rgb(" + ng + "," + ng + "," + ng + ")";

  row.querySelectorAll(".msg-name").forEach(e => {
    e.style.fontFamily = nameF;
    e.style.fontWeight = String(st.nameWeight);
    e.style.fontSize = (st.nameSize || 11) + "px";
    e.style.color = nameGray;
    e.style.display = st.showName ? "inline-block" : "none";
    e.style.transform = "translateY(" + (st.nameDrop || 0) + "px)";
  });

  row.querySelectorAll(".msg-time").forEach(e => {
    e.style.fontFamily = metaF;
    e.style.fontWeight = String(st.metaWeight);
    e.style.fontSize = st.metaSize + "px";
    e.style.color = gray;
  });
  row.querySelectorAll(".msg-footer").forEach(e => {
    e.style.fontFamily = metaF;
    e.style.fontWeight = String(st.metaWeight);
    e.style.fontSize = st.metaSize + "px";
    e.style.color = gray;
    e.style.marginTop = st.metaGap + "px";
  });
  row.querySelectorAll(".msg-avatar").forEach(av => {
    av.style.borderRadius = st.avatarShape === "square" ? "6px" : "50%";
    if (!st.showAvatar) av.style.display = "none";
  });
  const metaBox = row.querySelector(".msg-meta");
  const av = row.querySelector(".msg-avatar");
  const bodyEl = row.querySelector(".msg-body");
  const avOk = av && st.showAvatar && !av.classList.contains("ghost") && av.style.display !== "none";
  const mid = st.nameMid && avOk;

  row.style.position = "";
  row.style.flexDirection = "";
  row.style.gap = "";
  row.style.alignItems = "";
  if (metaBox) {
    metaBox.style.position = "";
    metaBox.style.top = "";
    metaBox.style.left = "";
    metaBox.style.right = "";
    metaBox.style.transform = "";
    metaBox.style.whiteSpace = "";
    metaBox.style.margin = "";
  }
  if (av) av.style.alignSelf = "";
  if (bodyEl) {
    bodyEl.style.alignSelf = "";
    bodyEl.style.paddingTop = "";
  }

  if (st.bubbleAlign === "below") {
    row.style.flexDirection = "column";
    row.style.gap = (st.avBubbleGap === undefined ? 6 : st.avBubbleGap) + "px";
    if (av && av.classList.contains("ghost")) {
      av.style.display = "none";
    }
    if (av && bodyEl) {
      av.style.alignSelf = isUser ? "flex-end" : "flex-start";
      bodyEl.style.alignSelf = isUser ? "flex-end" : "flex-start";
      if (!bodyEl.classList.contains("bare-full")) bodyEl.style.maxWidth = "88%";
    }
  } else if (mid) {
    row.style.alignItems = "flex-start";
  }

  if (mid && metaBox) {
    row.style.position = "relative";
    metaBox.style.position = "absolute";
    metaBox.style.top = Math.round(st.avatarSize / 2) + "px";
    metaBox.style.transform = "translateY(-50%)";
    metaBox.style.margin = "0";
    metaBox.style.whiteSpace = "nowrap";
    if (isUser) {
      metaBox.style.right = (st.avatarSize + 8) + "px";
    } else {
      metaBox.style.left = (st.avatarSize + 8) + "px";
    }
    if (bodyEl && st.bubbleAlign !== "below") {
      bodyEl.style.paddingTop = (st.avatarSize + (st.avBubbleGap === undefined ? 6 : st.avBubbleGap)) + "px";
    }
    row.querySelectorAll(".msg-name").forEach(e => { e.style.transform = "none"; });
  }

  row.style.marginBottom = st.msgGap + "px";
}
/* ---------- 发送键图形 ---------- */
function sendGlyphHtml() {
  return "↑";
}

/* ---------- 皮肤引擎 ---------- */
function applyTheme() {
  const st = state.settings;
  document.body.classList.remove("dark", "skin-official", "skin-liquid");
  if (st.skin === "night") document.body.classList.add("dark");
  if (st.skin === "official") document.body.classList.add("skin-official");
  if (st.skin === "liquid") document.body.classList.add("skin-liquid");
  st.darkMode = (st.skin === "night");

  document.documentElement.style.setProperty("--msg-fs", st.fontSize + "px");
  document.documentElement.style.setProperty("--avatar-size", st.avatarSize + "px");
  document.documentElement.style.setProperty("--title-fs", st.titleFs + "px");
  document.documentElement.style.setProperty("--title-fw", String(st.titleFw));

  document.body.classList.toggle("gpt-ui", st.chatUi === "gpt");
  const sbtn = $("#send-btn");
  if (sbtn && !streaming) sbtn.innerHTML = sendGlyphHtml();
  const ib = $("#input-box");
  if (st.skin === "liquid" && st.chatUi !== "gpt") {

    ib.style.background = "rgba(255,255,255,0.28)";
    ib.style.boxShadow = "inset 0 1px 1px rgba(255,255,255,0.55), 0 4px 16px rgba(0,0,0,0.06)";
  } else {
    ib.style.background = "";
    ib.style.boxShadow = "";
  }

  /* 液态下整页面板刷实底漆 */
  let liq = document.getElementById("liquid-fix-style");
  if (!liq) {
    liq = document.createElement("style");
    liq.id = "liquid-fix-style";
    document.head.appendChild(liq);
  }
  if (st.skin === "liquid") {
    const solid = "#f2f3f6";
    liq.textContent = [
      ".panel:not(#days-panel){background:" + solid + "!important;",
      "backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}",
      ".panel:not(#days-panel) .panel-header{background:" + solid + "!important;}",
      "#theme-tabs{background:" + solid + "!important;}",
      ".overlay-page{background:" + solid + "!important;",
      "backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}"
    ].join("");
  } else {
    liq.textContent = "";
  }

  const sb = $("#sidebar");
  const a = (st.sidebarAlpha || 72) / 100;
  const night = st.skin === "night";
  const base = night ? "40,40,40" : "255,255,255";
  const inner = sb.querySelector(".sidebar-inner");
  if (st.sidebarStyle === "clear") {
    inner.style.background = "rgba(" + base + "," + (a * 0.3) + ")";
    inner.style.backdropFilter = st.sidebarBlur > 0 ? "blur(" + st.sidebarBlur + "px) saturate(1.2)" : "none";
    inner.style.webkitBackdropFilter = inner.style.backdropFilter;
  } else {
    inner.style.background = night ? "rgba(38,38,38,1)" : "rgba(255,255,255,1)";
    inner.style.backdropFilter = "";
    inner.style.webkitBackdropFilter = "";
  }

  const glow = (st.skinGlow || 0) / 100;
  let gs = document.getElementById("skin-glow-style");
  if (!gs) {
    gs = document.createElement("style");
    gs.id = "skin-glow-style";
    document.head.appendChild(gs);
  }
  if (glow > 0) {
    gs.textContent = "#input-box{box-shadow:0 1px " + Math.round(4 + 8 * glow) + "px rgba(150,140,135," + (0.10 * glow).toFixed(2) + ")!important;}";
  } else {
    gs.textContent = "";
  }

  $("#chat-area").style.fontFamily = FONT_LIST[st.chatFont];
  sb.style.fontFamily = FONT_LIST[st.uiFont];
  $("#topbar-title").style.fontFamily = FONT_LIST[st.uiFont];

  const T = MENU_TEXT[st.menuLang] || MENU_TEXT.zh;
  $("#menu-theme").textContent = T.theme;
  $("#menu-role").textContent = T.role;
  $("#menu-memory").textContent = T.memory;
  $("#menu-days").textContent = T.days;
  $("#session-label").textContent = T.session;
  $("#theme-title").textContent = T.theme;
  $("#role-title").textContent = T.role;
  $("#settings-title").textContent = T.settings;

    let dim = document.getElementById("dim-overlay");
  if (!dim) {
    dim = el("div", "");
    dim.id = "dim-overlay";
    dim.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:99999;background:#000;opacity:0;";
    document.body.appendChild(dim);
  }
  dim.style.opacity = ((st.globalDim || 0) / 100).toFixed(2);

  let tbs = document.getElementById("topbar-style");
  if (!tbs) {
    tbs = document.createElement("style");
    tbs.id = "topbar-style";
    document.head.appendChild(tbs);
  }
    const tAlpha = (st.topbarAlpha === undefined ? 100 : st.topbarAlpha) / 100;
  if (tAlpha >= 1) {
    tbs.textContent = "";
  } else if (tAlpha < 0.01) {
    tbs.textContent = "#topbar{background:transparent!important;border-bottom-color:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;}";
  } else {
    const tbase = st.skin === "night" ? "30,30,32" : "255,255,255";
    tbs.textContent = "#topbar{background:rgba(" + tbase + "," + tAlpha.toFixed(2) + ")!important;backdrop-filter:blur(12px) saturate(1.4)!important;-webkit-backdrop-filter:blur(12px) saturate(1.4)!important;}";
  }

  $("#model-btn").classList.toggle("hidden", !st.showModelBtn);
}
function updateChatFade() {
  const oldLayer = document.getElementById("bottom-fade-layer");
  if (oldLayer) oldLayer.remove();

  const chat = $("#chat-area");
  const box = $("#input-box");

  if (!chat || !box) return;

  const chatRect = chat.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();

  const fadeStart = Math.max(
    0,
    Math.min(chatRect.height, boxRect.top - chatRect.top)
  );

  chat.style.setProperty("--chat-fade-start", fadeStart + "px");

}

window.addEventListener("resize", updateChatFade);

/* ---------- 布局 ---------- */
function applyLayout() {
  const st = state.settings;
  const tb = $("#topbar");
  const title = $("#topbar-title");

  if (st.titleCenter) {
    tb.classList.add("title-centered");
    title.style.position = "absolute";
    title.style.left = "50%";
    title.style.transform = "translateX(-50%)";
    title.style.maxWidth = "50%";
  } else {
    tb.classList.remove("title-centered");
    title.style.position = "";
    title.style.left = "";
    title.style.transform = "";
    title.style.maxWidth = "";
  }

  const ia = $("#input-area");
  const lift = Math.max(0, 34 - st.inputLift);

  ia.style.paddingBottom =
    "calc(" + lift + "px + env(safe-area-inset-bottom) * 0.4)";

  document.documentElement.style.setProperty(
    "--dock-drop",
    st.dockDrop + "px"
  );

  updateChatFade();
}

/* ---------- 文字手感 ---------- */
function applyChatTypo() {
  let s5 = document.getElementById("typo-style");
  if (!s5) {
    s5 = document.createElement("style");
    s5.id = "typo-style";
    document.head.appendChild(s5);
  }
  const st = state.settings;
  const L = [];
  L.push(".msg-bubble{letter-spacing:" + st.chatSpacing + "px;line-height:" + st.chatLineH + ";font-weight:" + st.chatWeight + ";}");
  L.push("#sidebar,.menu-item,.session-item{letter-spacing:" + st.uiSpacing + "px;font-weight:" + st.uiWeight + ";font-size:" + (st.uiFs || 14) + "px;}");
  L.push(".menu-item,.session-item{line-height:" + st.uiLineH + ";}");
  if (st.aiTypoOn) {
    const f = FONT_LIST[st.aiFont2] || FONT_LIST.system;
    L.push(".bub-ai{font-family:" + f + ";font-size:" + st.aiSize2 + "px;font-weight:" + st.aiWeight2 + ";letter-spacing:" + st.aiSpacing2 + "px;line-height:" + st.aiLineH2 + ";}");
  }
  s5.textContent = L.join(NL);
}

/* ---------- 气泡宽度注入 ---------- */
function applyBubbleBox() {
  let s = document.getElementById("bubble-box-style");
  if (!s) {
    s = document.createElement("style");
    s.id = "bubble-box-style";
    document.head.appendChild(s);
  }
  s.textContent = ".msg-body:not(.bare-full){max-width:" + state.settings.bubbleMaxW + "%;}";
}

/* ========== S1结束 ========== */
/* ==========================================
   S2开始:消息渲染 / err气泡 / 多选 / 长按菜单 / 请求引擎
   ========================================== */

function msgText(m) {
  return m.versions[m.vi];
}

/* ---------- 思维链折叠框 ---------- */
function buildThinkBox(m) {
  const st = state.settings;
  const box = el("div", "think-box");
  box.style.background = hslaOf(st.thinkHue, st.thinkSat, st.thinkLight, st.thinkAlpha);
  const dark = st.thinkLight < 45;
  const ink = dark ? "#e8e8e8" : "#6a6a6a";
  const head = el("div", "think-head");
  head.style.color = ink;
  const arrow = el("span", "", "▸");
  head.appendChild(arrow);
  head.appendChild(el("span", "", "思考过程"));
  const body = el("div", "think-body", m.think);
  body.style.color = ink;
  box.appendChild(head);
  box.appendChild(body);
  head.onclick = () => {
    box.classList.toggle("open");
    arrow.textContent = box.classList.contains("open") ? "▾" : "▸";
  };
  return box;
}

/* ---------- 分段组判定 ---------- */
function groupInfo(list, i) {
  const m = list[i];
  if (!m.grp) return { inGroup: false, isFirst: true, isLast: true };
  const prevSame = i > 0 && list[i - 1].grp === m.grp;
  const nextSame = i < list.length - 1 && list[i + 1].grp === m.grp;
  return { inGroup: true, isFirst: !prevSame, isLast: !nextSame };
}

/* ---------- err气泡装配 ---------- */
function buildErrRow(m) {
  const row = document.createElement("div");
  row.className = "msg-row msg-row-ai";
  row.dataset.id = m.id;

  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "msg-check";
  check.dataset.id = m.id;
  row.appendChild(check);

  const body = document.createElement("div");
  body.className = "msg-body msg-body-ai";
  body.style.maxWidth = "92%";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble bubble-err";
  bubble.style.borderRadius = "14px";
  bubble.style.padding = "10px 13px";

  const t = document.createElement("div");
  t.textContent = "⚠ " + m.errText;
  t.style.fontSize = "12.5px";
  t.style.lineHeight = "1.6";
  t.style.wordBreak = "break-all";
  bubble.appendChild(t);

  const btnRow = document.createElement("div");
  const retry = document.createElement("button");
  retry.className = "err-retry";
  retry.textContent = "重试";
  retry.onclick = (e) => {
    e.stopPropagation();
    retryFailed(m);
  };
  btnRow.appendChild(retry);
  const dismiss = document.createElement("button");
  dismiss.className = "err-retry";
  dismiss.style.marginLeft = "8px";
  dismiss.textContent = "知道了";
  dismiss.onclick = (e) => {
    e.stopPropagation();
    const s = curSession();
    s.messages = s.messages.filter(x => x.id !== m.id);
    saveState();
    renderMessages();
  };
  btnRow.appendChild(dismiss);
  bubble.appendChild(btnRow);

  body.appendChild(bubble);
  row.appendChild(body);
  return row;
}

async function retryFailed(errMsg) {
  if (streaming) return;
  const s = curSession();
  s.messages = s.messages.filter(x => x.id !== errMsg.id);
  saveState();
  if (!lastFailedCtx) { renderMessages(); return; }
  const ctx = lastFailedCtx;
  lastFailedCtx = null;
  if (ctx.kind === "regen") {
    const target = s.messages.find(x => x.id === ctx.msgId);
    if (target) {
      await renderMessages();
      await runStream(target, buildMessages(target.id), true);
      return;
    }
    renderMessages();
  } else {
    const aiMsg = {
      id: uid(), role: "ai",
      versions: [""], vi: 0,
      time: Date.now(), tokens: null
    };
    s.messages.push(aiMsg);
    await renderMessages();
    await runStream(aiMsg, buildMessages(aiMsg.id));
  }
}

function pushErrMsg(text, ctx) {
  const s = curSession();
  lastFailedCtx = ctx || null;
  s.messages.push({
    id: uid(), role: "err",
    errText: String(text).slice(0, 600),
    versions: [""], vi: 0,
    time: Date.now()
  });
  saveState();
}
/* ---------- 操作栏细线图标 ---------- */
function barIcon(kind) {
  const s = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  if (kind === "copy") return '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="9" y="9" width="11" height="11" rx="2.5" ' + s + '/><path d="M5 15 V6.5 A2.5 2.5 0 0 1 7.5 4 H16" ' + s + '/></svg>';
  if (kind === "roll") return '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M19.5 12 a7.5 7.5 0 1 1 -2.2 -5.3" ' + s + '/><path d="M19.5 3.5 v3.7 h-3.7" ' + s + '/></svg>';
  return '<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/></svg>';
}

function openSelectCopy(text) {
  const mask = document.createElement("div");
  mask.className = "dialog-mask";
  const dlg = document.createElement("div");
  dlg.className = "dialog";
  const h = el("div", "dialog-title", "长按选字");
  const t = el("div", "", text);
  t.style.cssText = "font-size:14px;line-height:1.8;white-space:pre-wrap;overflow-y:auto;max-height:50vh;-webkit-user-select:text;user-select:text;padding:4px 2px;";
  const btns = el("div", "dialog-btns");
  const ok = el("button", "btn", "完成");
  ok.onclick = () => mask.remove();
  btns.appendChild(ok);
  dlg.appendChild(h);
  dlg.appendChild(t);
  dlg.appendChild(btns);
  mask.appendChild(dlg);
  document.body.appendChild(mask);
}

/* ---------- 单行装配 ---------- */
async function buildMsgRow(m, gi, aiSrc, userSrc) {
  if (m.role === "err") return buildErrRow(m);

  const isUser = m.role === "user";
  const r = curRole();
  const st = state.settings;
  const bare = st.aiBare && !isUser;

  const row = document.createElement("div");
  row.className = "msg-row " + (isUser ? "msg-row-user" : "msg-row-ai");
  row.dataset.id = m.id;

  const check = document.createElement("input");
  check.type = "checkbox";
  check.className = "msg-check";
  check.dataset.id = m.id;

  const avatar = document.createElement("img");
  avatar.className = "msg-avatar";
  avatar.src = isUser ? userSrc : aiSrc;
  const hideAv = st.splitAvatarOnce && gi.inGroup && !gi.isFirst;
  if (hideAv) avatar.classList.add("ghost");
  const body = document.createElement("div");
  body.className = "msg-body " + (isUser ? "msg-body-user" : "msg-body-ai");
  if (bare) {
    body.classList.add("bare-full");
  }

  let timeOk = st.showTime;
  const stm = st.splitTimeMode || (st.splitTimeLast ? "last" : "all");
  if (gi.inGroup) {
    if (stm === "last" && !gi.isLast) timeOk = false;
    if (stm === "first" && !gi.isFirst) timeOk = false;
  }

  let nameOk = st.showName;
  if (st.splitAvatarOnce && gi.inGroup && !gi.isFirst) nameOk = false;

  const meta = document.createElement("div");
  meta.className = "msg-meta " + (isUser ? "msg-meta-user" : "msg-meta-ai");

  if (nameOk && st.timeAt === "name" && timeOk) {
    const line = document.createElement("div");
    line.className = "msg-name-line";
    const nameEl = document.createElement("span");
    nameEl.className = "msg-name";
    nameEl.textContent = isUser ? r.userName : r.aiName;
    const timeEl = document.createElement("span");
    timeEl.className = "msg-time";
    timeEl.textContent = fmtTime(m.time);
    line.appendChild(nameEl);
    line.appendChild(timeEl);
    meta.appendChild(line);
  } else {
    if (nameOk) {
      const nameEl = document.createElement("span");
      nameEl.className = "msg-name";
      nameEl.textContent = isUser ? r.userName : r.aiName;
      meta.appendChild(nameEl);
    }
    if (timeOk && st.timeAt === "above") {
      const timeEl = document.createElement("span");
      timeEl.className = "msg-time";
      timeEl.textContent = fmtTime(m.time);
      meta.appendChild(timeEl);
    }
  }

  if (!isUser && m.think && st.thinkOn && st.thinkMode === "fold") {
    body.appendChild(meta);
    body.appendChild(buildThinkBox(m));
  } else {
    body.appendChild(meta);
  }

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";

  const imgsArr = m.imgs || (m.img ? [m.img] : []);
  imgsArr.forEach(src => {
    const im = document.createElement("img");
    im.className = "msg-img";
    im.src = src;
    bubble.appendChild(im);
  });
  const txtNode = document.createElement("span");
  txtNode.className = "msg-txt";
  setMsgHtml(txtNode, msgText(m));
  bubble.appendChild(txtNode);

  const footer = document.createElement("div");
  footer.className = "msg-footer";

  if (timeOk && st.timeAt === "below") {
    const t2 = document.createElement("span");
    t2.textContent = fmtTime(m.time);
    footer.appendChild(t2);
  }

  if (!isUser && m.versions.length > 1) {
    const vs = document.createElement("div");
    vs.className = "version-switch";
    const prev = document.createElement("button");
    prev.className = "vs-btn";
    prev.textContent = "‹";
    const label = document.createElement("span");
    label.textContent = (m.vi + 1) + "/" + m.versions.length;
    const next = document.createElement("button");
    next.className = "vs-btn";
    next.textContent = "›";
    const move = (d) => {
      m.vi = Math.max(0, Math.min(m.versions.length - 1, m.vi + d));
      saveState();
      renderMessages();
    };
    prev.onclick = (e) => { e.stopPropagation(); move(-1); };
    next.onclick = (e) => { e.stopPropagation(); move(1); };
    vs.appendChild(prev);
    vs.appendChild(label);
    vs.appendChild(next);
    footer.appendChild(vs);
  }

    if (!isUser && m.tokens && st.showToken && !(st.msgBarOn && st.tokenInBar) && (!gi.inGroup || gi.isLast)) {
    const tk = document.createElement("span");
    tk.textContent = m.tokens + " tokens";
    footer.appendChild(tk);
  }

  body.appendChild(bubble);
  if (st.msgBarOn && (!gi.inGroup || gi.isLast)) {
    const gv = st.skin === "night" ? Math.min(255, st.metaShade + 60) : st.metaShade;
    const bar = document.createElement("div");
    bar.className = "msg-toolbar";
    bar.style.cssText = "display:flex;gap:18px;align-items:center;margin-top:" + (st.msgBarGap === undefined ? 8 : st.msgBarGap) + "px;color:rgb(" + gv + "," + gv + "," + gv + ");" + (isUser ? "justify-content:flex-end;" : "");
    const mk = (kind, fn2) => {
      const b2 = document.createElement("span");
      b2.style.cssText = "display:inline-flex;padding:2px;";
      b2.innerHTML = barIcon(kind);
      b2.onclick = (ev) => {
        ev.stopPropagation();
        if (streaming) { toast("等他说完"); return; }
        fn2(ev);
      };
      bar.appendChild(b2);
    };
    mk("copy", () => copyText(msgText(m)));
    if (!isUser) mk("roll", () => regenerate(m));
        mk("more", (ev) => {
      const items = [
        { label: "选择复制", fn: () => openSelectCopy(msgText(m)) },
        { label: "编辑消息", fn: () => inputDialog("编辑消息", msgText(m), v => {
            if (v.trim()) { m.versions[m.vi] = v; saveState(); renderMessages(); }
          }, true) },
        { label: "多条删除", fn: () => enterMultiMode(m.id) }
      ];
      if (m.img || (m.imgs && m.imgs.length)) {
        items.push({ label: "删除图片", danger: true, fn: () => confirmDialog("删除这条的图片？", () => {
            delete m.img;
            delete m.imgs;
            saveState();
            renderMessages();
          }) });
      }
      items.push({ label: "删除", danger: true, fn: () => confirmDialog("删除这条消息？", () => {
          const s2 = curSession();
          s2.messages = s2.messages.filter(x2 => x2.id !== m.id);
          saveState();
          renderMessages();
        }) });
            showActions(items, 0, 0);
      const mn = document.querySelector(".msg-actions");
      if (mn) {
        const br = ev.currentTarget.getBoundingClientRect();
        const mw = mn.offsetWidth;
        const mh = mn.offsetHeight;
        const gap = 8;
        let left = isUser ? (br.right - mw) : br.left;
        left = Math.max(gap, Math.min(left, window.innerWidth - mw - gap));
        let top = br.bottom + 6;
        if (top + mh > window.innerHeight - gap) {
          top = br.top - mh - 6;
        }
        top = Math.max(gap, Math.min(top, window.innerHeight - mh - gap));
        mn.style.left = left + "px";
        mn.style.top = top + "px";
      }
    });

    if (!isUser && st.tokenInBar && st.showToken && m.tokens) {
      const tk = document.createElement("span");
      tk.textContent = m.tokens + " tokens";
      tk.style.cssText = "font-family:" + FONT_LIST[st.metaFont] + ";font-size:" + st.metaSize + "px;font-weight:" + st.metaWeight + ";";
      bar.appendChild(tk);
    }
    body.appendChild(bar);
  }
  body.appendChild(footer);

  row.appendChild(check);
  row.appendChild(avatar);
  row.appendChild(body);

  await dressBubble(bubble, isUser);
  dressMeta(row, isUser);
  if (gi.inGroup && !gi.isLast) {
    row.style.marginBottom = (st.splitGap === undefined ? 6 : st.splitGap) + "px";
  }

  if (hideAv) avatar.classList.add("ghost");

 /* 头像菜单已退役,功能全在操作栏三个点里 */


  return row;
}

/* ---------- 滚动判定:近底才自动滚 ---------- */
function nearBottom(box) {
  return box.scrollHeight - box.scrollTop - box.clientHeight < 120;
}

/* ---------- 全量渲染 ---------- */
async function renderMessages(keepScroll) {
  const area = $("#chat-area");
  const s = curSession();
  const aiSrc = await avatarSrc("ai");
  const userSrc = await avatarSrc("user");

  // 重绘前先记下：用户是否贴着底部、当前滚到哪
  const stick = nearBottom(area);
  const prevTop = area.scrollTop;

  const frag = document.createDocumentFragment();
  for (let i = 0; i < s.messages.length; i++) {
    const gi = groupInfo(s.messages, i);
    const row = await buildMsgRow(s.messages[i], gi, aiSrc, userSrc);
    frag.appendChild(row);
  }
  area.innerHTML = "";
  area.appendChild(frag);

  if (document.body.classList.contains("export-mode") || document.body.classList.contains("multi-mode")) {
    document.querySelectorAll(".msg-check").forEach(c => { c.style.display = "block"; });
  }

  if (keepScroll && !stick) {
    // 用户之前上滑在看历史,别拽他,原地待着
    area.scrollTop = prevTop;
  } else {
    area.scrollTop = area.scrollHeight;
  }
}

/* ---------- 增量渲染 ---------- */
async function appendMessage(m) {
  const area = $("#chat-area");
  const s = curSession();
  const aiSrc = await avatarSrc("ai");
  const userSrc = await avatarSrc("user");
  const i = s.messages.indexOf(m);
  const gi = i >= 0 ? groupInfo(s.messages, i) : { inGroup: false, isFirst: true, isLast: true };
  const row = await buildMsgRow(m, gi, aiSrc, userSrc);
  row.classList.add("anim-in");
  area.appendChild(row);
  area.scrollTop = area.scrollHeight;
  return row;
}

/* ---------- 长按菜单 ---------- */
function closeActions() {
  document.querySelectorAll(".msg-actions").forEach(m => {
    if (m._closer) {
      document.removeEventListener("touchstart", m._closer, true);
      document.removeEventListener("click", m._closer, true);
    }
    m.remove();
  });
}
/* 操作卡片行内图标:按文字关键词认领 */
function actIcon(label) {
  const s = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  let p;
  if (/删除|丢掉|移除/.test(label)) p = '<path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M7 7l1 12a1.5 1.5 0 0 0 1.5 1.4h5a1.5 1.5 0 0 0 1.5-1.4L17 7" ' + s + '/>';
  else if (/编辑|重命名|改名/.test(label)) p = '<path d="M15.5 5.5l3 3M4 20l1-4L16 5a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L8 19l-4 1Z" ' + s + '/>';
  else if (/复制|拷贝/.test(label)) p = '<rect x="9" y="9" width="11" height="11" rx="2.5" ' + s + '/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H16" ' + s + '/>';
  else if (/生成|重roll|重写|重答|重发/.test(label)) p = '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" ' + s + '/><path d="M19.5 3.5v3.7h-3.7" ' + s + '/>';
  else if (/多选|多条/.test(label)) p = '<path d="M4 7l2 2 3-3M4 16l2 2 3-3M12 8h8M12 17h8" ' + s + '/>';
  else if (/换图|传图|图片|背景|壁纸/.test(label)) p = '<rect x="4" y="5" width="16" height="14" rx="2" ' + s + '/><circle cx="9" cy="10" r="1.5" ' + s + '/><path d="M5 17l4-3.6 3.6 3 2.4-2 4 3.4" ' + s + '/>';
  else p = '<circle cx="12" cy="12" r="7.5" ' + s + '/>';
  return '<svg viewBox="0 0 24 24" width="18" height="18">' + p + '</svg>';
}

function showActions(items, x, y) {
  closeActions();
  const menu = document.createElement("div");
  menu.className = "msg-actions";
  items.forEach(it => {
    const b = document.createElement("button");
    b.className = "act-btn" + (it.danger ? " danger" : "");
    const lab = document.createElement("span");
    lab.className = "act-label";
    lab.textContent = it.label;
    const ic = document.createElement("span");
    ic.className = "act-ic";
    ic.innerHTML = actIcon(it.label);
    b.appendChild(lab);
    b.appendChild(ic);
    const run = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeActions();
      it.fn();
    };
    b.addEventListener("touchend", run);
    b.addEventListener("click", run);
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  const w = menu.offsetWidth;
  const h = menu.offsetHeight;
  menu.style.left = Math.max(8, Math.min(x, window.innerWidth - w - 8)) + "px";
  menu.style.top = Math.max(8, Math.min(y, window.innerHeight - h - 8)) + "px";
  setTimeout(() => {
    menu._closer = (e) => {
      if (!menu.contains(e.target)) closeActions();
    };
    document.addEventListener("touchstart", menu._closer, true);
    document.addEventListener("click", menu._closer, true);
  }, 80);
}

function bindLongPress(el2, fn) {
  let timer = null;
  el2.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    timer = setTimeout(() => {
      timer = null;
      fn(t.clientX, t.clientY);
    }, 480);
  }, { passive: true });
  el2.addEventListener("touchmove", () => { clearTimeout(timer); timer = null; }, { passive: true });
  el2.addEventListener("touchend", () => { clearTimeout(timer); });
  el2.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    fn(e.clientX, e.clientY);
  });
}

/* ---------- 复制:代码留着备用,菜单里已不用 ---------- */
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast("已复制"),
      () => copyFallback(text)
    );
  } else {
    copyFallback(text);
  }
}

function copyFallback(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;left:-9999px;top:0;";
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try { ok = document.execCommand("copy"); } catch (e) {}
  ta.remove();
  toast(ok ? "已复制" : "复制失败，长按文字手动选中吧");
}

function msgMenu(m, x, y) {
  if (streaming) return;
  if (m.role === "err") return;
  const s = curSession();
  const items = [
    { label: "编辑", fn: () => {
        inputDialog("编辑消息", msgText(m), v => {
          if (v.trim()) {
            m.versions[m.vi] = v;
            saveState();
            renderMessages();
          }
        }, true);
      } },
    { label: "多选", fn: () => enterMultiMode(m.id) }
  ];
  if (m.img || (m.imgs && m.imgs.length)) {
    items.push({ label: "删除图片", danger: true, fn: () => confirmDialog("删除这条的图片？", () => {
        delete m.img;
        delete m.imgs;
        saveState();
        renderMessages();
      }) });
  }
  if (m.role === "ai") {
    items.push({ label: "重新生成", fn: () => regenerate(m) });
  }
  items.push({ label: "删除", danger: true, fn: () => confirmDialog("删除这条消息？", () => {
      s.messages = s.messages.filter(x2 => x2.id !== m.id);
      saveState();
      renderMessages();
    }) });
  showActions(items, x, y);
}

/* ---------- 多选删除 ---------- */
function enterMultiMode(firstId) {
  document.body.classList.add("multi-mode");
  $("#multi-del-bar").classList.add("show");
  document.querySelectorAll(".msg-check").forEach(c => {
    c.style.display = "block";
    if (firstId && c.dataset.id === firstId) c.checked = true;
  });
}

function exitMultiMode() {
  document.body.classList.remove("multi-mode");
  $("#multi-del-bar").classList.remove("show");
  document.querySelectorAll(".msg-check").forEach(c => {
    c.style.display = "";
    c.checked = false;
  });
}

function doMultiDelete() {
  const ids = Array.from(document.querySelectorAll(".msg-check")).filter(c => c.checked).map(c => c.dataset.id);
  if (!ids.length) { toast("还没选呢"); return; }
  confirmDialog("删除选中的 " + ids.length + " 条消息？", () => {
    const s = curSession();
    s.messages = s.messages.filter(m => ids.indexOf(m.id) < 0);
    saveState();
    exitMultiMode();
    renderMessages();
  });
}

/* ---------- 弹窗 ---------- */
function inputDialog(title, initial, onOk, multiline) {
  const mask = document.createElement("div");
  mask.className = "dialog-mask";
  const dlg = document.createElement("div");
  dlg.className = "dialog";
  const h = document.createElement("div");
  h.className = "dialog-title";
  h.textContent = title;
  const input = document.createElement(multiline ? "textarea" : "input");
  input.className = multiline ? "dialog-textarea" : "dialog-input";
  input.value = initial || "";
  const btns = document.createElement("div");
  btns.className = "dialog-btns";
  const cancel = document.createElement("button");
  cancel.className = "btn secondary";
  cancel.textContent = "取消";
  const ok = document.createElement("button");
  ok.className = "btn";
  ok.textContent = "确定";
  cancel.onclick = () => mask.remove();
  ok.onclick = () => { onOk(input.value); mask.remove(); };
  btns.appendChild(cancel);
  btns.appendChild(ok);
  dlg.appendChild(h);
  dlg.appendChild(input);
  dlg.appendChild(btns);
  mask.appendChild(dlg);
  document.body.appendChild(mask);
  input.focus();
}

function confirmDialog(title, onOk) {
  const mask = document.createElement("div");
  mask.className = "dialog-mask";
  const dlg = document.createElement("div");
  dlg.className = "dialog";
  const h = document.createElement("div");
  h.className = "dialog-title";
  h.textContent = title;
  const btns = document.createElement("div");
  btns.className = "dialog-btns";
  const cancel = document.createElement("button");
  cancel.className = "btn secondary";
  cancel.textContent = "取消";
  const ok = document.createElement("button");
  ok.className = "btn danger";
  ok.textContent = "确定";
  cancel.onclick = () => mask.remove();
  ok.onclick = () => { onOk(); mask.remove(); };
  btns.appendChild(cancel);
  btns.appendChild(ok);
  dlg.appendChild(h);
  dlg.appendChild(btns);
  mask.appendChild(dlg);
  document.body.appendChild(mask);
}

/* ---------- 构建请求:err消息绝不入册 ---------- */
function buildMessages(uptoId) {
  const r = curRole();
  const s = curSession();
  const msgs = [];

  let sys = r.systemPrompt || "";
  const mems = r.memories.filter(m => m.core || m.checked).map(m => m.text);
  if (mems.length) {
    sys += NL + NL + "[记忆]" + NL + mems.map((t, i) => (i + 1) + ". " + t).join(NL);
  }
  if (state.settings.splitSend) {
    sys += NL + NL + "[输出要求]请把回复自然地分成多个段落，每段之间用空行隔开，像连续发多条消息一样，总段数不超过" + state.settings.splitMax + "段。";
  }
  sys += NL + NL + "[输出格式]只输出纯文本，不使用Markdown格式：不用星号加粗、不用井号标题、不用列表符号和分隔线。";
  if (sys.trim()) msgs.push({ role: "system", content: sys });

  let history = s.messages.filter(m => m.role !== "err");
  if (uptoId) {
    const idx = history.findIndex(m => m.id === uptoId);
    if (idx >= 0) history = history.slice(0, idx);
  }
  let lastImgId = null;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user" && (history[i].img || (history[i].imgs && history[i].imgs.length))) {
      lastImgId = history[i].id;
      break;
    }
  }
  const count = state.settings.contextCount || 20;
  history = history.slice(-count);

  history.forEach(m => {
    const role = m.role === "user" ? "user" : "assistant";
    const mImgs = m.imgs || (m.img ? [m.img] : []);
    if (m.id === lastImgId && mImgs.length) {
      const parts = mImgs.map(u => ({ type: "image_url", image_url: { url: u } }));
      parts.push({ type: "text", text: msgText(m) || "（图片）" });
      msgs.push({ role: role, content: parts });
    } else {
      msgs.push({ role: role, content: msgText(m) });
    }
  });
  return msgs;
}

/* ---------- 请求体工厂:思维链开关在这 ---------- */
function buildReqBody(messages, stream) {
  const b = {
    model: curProvider().model,
    messages: messages,
    temperature: Number(state.settings.temperature),
    stream: stream
  };
  if (stream) b.stream_options = { include_usage: true };
  if (state.settings.thinkOn) {
    b.thinking = { type: "enabled", budget_tokens: 8000 };
    b.temperature = 1;
  }
  return b;
}

/* ---------- 流式请求 ---------- */
async function streamChat(messages, onDelta, onThink) {
  const p = curProvider();
  if (!p.baseURL || !p.apiKey) throw new Error("请先在设置里配置供应商地址和Key");
  if (!p.model) throw new Error("请先选择模型");

  const url = p.baseURL.replace(/\/+$/, "") + "/chat/completions";
  abortCtrl = new AbortController();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + p.apiKey
    },
    body: JSON.stringify(buildReqBody(messages, true)),
    signal: abortCtrl.signal
  });

  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch (e) {}
    throw new Error("请求失败 " + res.status + " " + detail.slice(0, 300));
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let usage = null;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buf += decoder.decode(chunk.value, { stream: true });
    const lines = buf.split(NL);
    buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const data = t.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        const delta = j.choices && j.choices[0] && j.choices[0].delta;
        if (delta) {
          const think = delta.reasoning_content || delta.reasoning || delta.thinking;
          if (think && onThink) onThink(typeof think === "string" ? think : (think.text || ""));
          if (typeof delta.content === "string" && delta.content) {
            onDelta(delta.content);
          } else if (Array.isArray(delta.content)) {
            delta.content.forEach(cb => {
              if (cb.type === "text" && cb.text) onDelta(cb.text);
              if (cb.type === "thinking" && cb.thinking && onThink) onThink(cb.thinking);
            });
          }
        }
        if (j.usage && j.usage.total_tokens) usage = j.usage.total_tokens;
      } catch (e) {}
    }
  }
  return usage;
}

/* ---------- 非流式请求 ---------- */
async function plainChat(messages, onDelta, onThink) {
  const p = curProvider();
  if (!p.baseURL || !p.apiKey) throw new Error("请先在设置里配置供应商地址和Key");
  if (!p.model) throw new Error("请先选择模型");

  const url = p.baseURL.replace(/\/+$/, "") + "/chat/completions";
  abortCtrl = new AbortController();

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + p.apiKey
    },
    body: JSON.stringify(buildReqBody(messages, false)),
    signal: abortCtrl.signal
  });

  if (!res.ok) {
    let detail = "";
    try { detail = await res.text(); } catch (e) {}
    throw new Error("请求失败 " + res.status + " " + detail.slice(0, 300));
  }

  const j = await res.json();
  if (j.error) throw new Error(String(j.error.message || "接口报错").slice(0, 300));
  const msg = j.choices && j.choices[0] && j.choices[0].message;
  if (!msg) throw new Error("接口没给回复");
  const think = msg.reasoning_content || msg.reasoning;
  if (think && onThink) onThink(typeof think === "string" ? think : (think.text || ""));
  if (typeof msg.content === "string" && msg.content) {
    onDelta(msg.content);
  } else if (Array.isArray(msg.content)) {
    msg.content.forEach(cb => {
      if (cb.type === "text" && cb.text) onDelta(cb.text);
      if (cb.type === "thinking" && cb.thinking && onThink) onThink(cb.thinking);
    });
  }
  return j.usage && j.usage.total_tokens ? j.usage.total_tokens : null;
}

/* ---------- 发送 ---------- */
async function sendMessage() {
  if (streaming) return;
  const input = $("#input-text");
  const text = input.value.trim();
  if (!text && !pendingImgs.length) return;

  const s = curSession();
  const userMsg = {
    id: uid(), role: "user",
    versions: [text || "（图片）"], vi: 0,
    time: Date.now()
  };
  if (pendingImgs.length) {
    userMsg.imgs = pendingImgs.slice();
    pendingImgs = [];
    renderAttachPreview();
  }
  s.messages.push(userMsg);

  if (s.name === "新对话" && text) {
    s.name = text.slice(0, 16);
  }

  input.value = "";
  input.style.height = "auto";
  saveState();
  await appendMessage(userMsg);
  renderSidebar();

  const aiMsg = {
    id: uid(), role: "ai",
    versions: [""], vi: 0,
    time: Date.now(), tokens: null
  };
  s.messages.push(aiMsg);
  await runStream(aiMsg, buildMessages(aiMsg.id));
}

/* ---------- 重roll:分段组先收拢成一条 ---------- */
async function regenerate(m) {
  if (streaming) return;
  const s = curSession();
  if (m.grp) {
    const gid = m.grp;
    const members = s.messages.filter(x => x.grp === gid);
    const first = members[0];
    first.versions = [members.map(x => msgText(x)).join(NL + NL)];
    first.vi = 0;
    first.tokens = m.tokens || first.tokens;
    delete first.grp;
    s.messages = s.messages.filter(x => x.grp !== gid);
    saveState();
    m = first;
  }
  m.versions.push("");
  m.vi = m.versions.length - 1;
  await runStream(m, buildMessages(m.id), true);
}

/* ---------- 执行:流式期间纯文本追加,零解析 ---------- */
async function runStream(aiMsg, messages, isRegen) {
  streaming = true;
  const btn = $("#send-btn");
  btn.textContent = "■";
  btn.disabled = false;
  btn.onclick = () => { if (abortCtrl) abortCtrl.abort(); };
  saveState();

  let row;
  if (isRegen) {
    await renderMessages();
    row = document.querySelector('.msg-row[data-id="' + aiMsg.id + '"]');
  } else {
    row = await appendMessage(aiMsg);
  }
  const txtEl = row ? row.querySelector(".msg-txt") : null;
  const bubbleEl = row ? row.querySelector(".msg-bubble") : null;
  if (bubbleEl) bubbleEl.classList.add("typing-cursor");
  const area = $("#chat-area");

  const engine = state.settings.streamMode === "plain" ? plainChat : streamChat;

  try {
    const usage = await engine(messages, (chunk) => {
      aiMsg.versions[aiMsg.vi] += chunk;
      if (txtEl) {
        const stick = nearBottom(area);
        txtEl.textContent = aiMsg.versions[aiMsg.vi];
        if (stick) area.scrollTop = area.scrollHeight;
      }
    }, (thinkChunk) => {
      aiMsg.think = (aiMsg.think || "") + thinkChunk;
    });
    if (usage) aiMsg.tokens = usage;

    const TKO = String.fromCharCode(60) + "think" + String.fromCharCode(62);
    const TKC = String.fromCharCode(60) + "/think" + String.fromCharCode(62);
    let full = aiMsg.versions[aiMsg.vi];
    const tOpen = full.indexOf(TKO);
    if (tOpen >= 0) {
      const tClose = full.indexOf(TKC);
      if (tClose > tOpen) {
        aiMsg.think = (aiMsg.think || "") + full.slice(tOpen + TKO.length, tClose).trim();
        aiMsg.versions[aiMsg.vi] = (full.slice(0, tOpen) + full.slice(tClose + TKC.length)).trim();
      }
    }
    if (!aiMsg.versions[aiMsg.vi]) {
      aiMsg.versions[aiMsg.vi] = "(空回复)";
    }

    if (state.settings.splitSend) {
      splitAiMessage(aiMsg);
    }
  } catch (e) {
    if (e.name === "AbortError") {
      toast("已停止生成");
    } else {
      const wasRegen = !!isRegen;
      if (!aiMsg.versions[aiMsg.vi]) {
        if (aiMsg.versions.length > 1) {
          aiMsg.versions.pop();
          aiMsg.vi = aiMsg.versions.length - 1;
        } else {
          const s = curSession();
          s.messages = s.messages.filter(x => x.id !== aiMsg.id);
        }
      }
      pushErrMsg(e.message, wasRegen ? { kind: "regen", msgId: aiMsg.id } : { kind: "send" });
    }
  } finally {
    streaming = false;
    abortCtrl = null;
    btn.innerHTML = sendGlyphHtml();
    btn.disabled = false;
    btn.onclick = sendMessage;
    if (bubbleEl) bubbleEl.classList.remove("typing-cursor");
    saveState();
    await renderMessages(true);
  }
}

/* ---------- 分段 ---------- */
function splitAiMessage(aiMsg) {
  if (aiMsg.versions.length > 1) return;
  const full = aiMsg.versions[aiMsg.vi];
  const parts = full.split(NL + NL).map(p => p.trim()).filter(p => p);
  if (parts.length < 2) return;
  const max = state.settings.splitMax || 20;
  const use = parts.slice(0, max);
  if (parts.length > max) {
    use[use.length - 1] = parts.slice(max - 1).join(NL + NL);
  }
  const s = curSession();
  const idx = s.messages.findIndex(x => x.id === aiMsg.id);
  if (idx < 0) return;
  const grp = uid();
  const newMsgs = use.map((p, i) => ({
    id: uid(), role: "ai",
    versions: [p], vi: 0,
    time: aiMsg.time + i,
    tokens: i === use.length - 1 ? aiMsg.tokens : null,
    think: i === 0 ? aiMsg.think : undefined,
    grp: grp
  }));
  s.messages.splice(idx, 1, ...newMsgs);
}

/* ---------- 发图:多张版 ---------- */
function renderAttachPreview() {
  const box = $("#attach-preview");
  box.innerHTML = "";
  if (pendingImgs.length) {
    box.classList.add("show");
    pendingImgs.forEach((img, i) => {
      const wrap = document.createElement("div");
      wrap.className = "attach-thumb";
      const im = document.createElement("img");
      im.className = "attach-thumb-img";
      im.src = img;
      const del = document.createElement("button");
      del.className = "attach-del";
      del.textContent = "✕";
      del.onclick = () => {
        pendingImgs.splice(i, 1);
        renderAttachPreview();
      };
      wrap.appendChild(im);
      wrap.appendChild(del);
      box.appendChild(wrap);
    });
  } else {
    box.classList.remove("show");
  }
}

async function pickImage(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  for (const f of files) {
    try {
      pendingImgs.push(await compressImage(f));
    } catch (err) {
      toast(err.message);
    }
  }
  renderAttachPreview();
  e.target.value = "";
}

/* ---------- 侧边栏 ---------- */
function openSidebar() {
  $("#sidebar").classList.add("open");
  $("#sidebar-mask").classList.add("show");
}

function closeSidebar() {
  $("#sidebar").classList.remove("open");
  $("#sidebar-mask").classList.remove("show");
}

function renderSidebar() {
  const list = $("#session-list");
  const r = curRole();
  list.innerHTML = "";
  r.sessions.forEach(s => {
    const div = el("div", "session-item" + (s.id === r.currentSessionId ? " active" : ""), s.name);
    div.onclick = () => {
      r.currentSessionId = s.id;
      saveState();
      renderAll();
      closeSidebar();
    };
    bindLongPress(div, (x, y) => {
      showActions([
        { label: "重命名", fn: () => inputDialog("重命名会话", s.name, v => {
            if (v.trim()) { s.name = v.trim(); saveState(); renderSidebar(); }
          }) },
        { label: "删除", danger: true, fn: () => confirmDialog("删除这个会话？", () => {
            r.sessions = r.sessions.filter(x2 => x2.id !== s.id);
            if (!r.sessions.length) r.sessions.push({ id: uid(), name: "新对话", messages: [] });
            if (r.currentSessionId === s.id) r.currentSessionId = r.sessions[0].id;
            saveState();
            renderAll();
          }) }
      ], x, y);
    });
    list.appendChild(div);
  });
  $("#topbar-title").textContent = curSession().name;
  $("#current-role-name").textContent = r.name;
  avatarSrc("ai").then(src => { $("#current-role-avatar").src = src; });
}

function newSession() {
  const r = curRole();
  const s = { id: uid(), name: "新对话", messages: [] };
  r.sessions.unshift(s);
  r.currentSessionId = s.id;
  saveState();
  renderAll();
  closeSidebar();
}
/* ---------- 创建分支:把当前会话整份复制一份 ---------- */
function branchSession() {
  const r = curRole();
  const s = curSession();
  const copy = JSON.parse(JSON.stringify(s));
  copy.id = uid();
  copy.name = s.name + " · 分支";
  const idx = r.sessions.indexOf(s);
  r.sessions.splice(idx + 1, 0, copy);
  r.currentSessionId = copy.id;
  saveState();
  renderAll();
  closeSidebar();
  toast("已创建分支，可以在这条里继续聊");
}

/* ---------- 面板开关 ---------- */
function openPanel(id) { $(id).classList.add("open"); }
function closePanel(id) { $(id).classList.remove("open"); }

/* ========== S2结束 ========== */
/* ==========================================
   S3开始:供应商弹窗 / 设置页 / 角色页 / 导出导入 / 控件工厂
   ========================================== */

/* ---------- 供应商:原框折叠版 ---------- */
let providerFold = true;

function renderProviderBar() {
  const bar = $("#provider-bar");
  bar.innerHTML = "";
  const p = curProvider();
  const info = el("div", "");
  info.style.cssText = "flex:1;min-width:0;";
  const name = el("div", "pb-name", p.name);
  const desc = el("div", "list-desc", (p.baseURL || "未配置") + " · " + p.models.length + "个模型");
  info.appendChild(name);
  info.appendChild(desc);
  const arrow = el("span", "pb-arrow", providerFold ? "▾ 展开" : "▴ 收起");
  bar.appendChild(info);
  bar.appendChild(arrow);
  bar.onclick = () => { providerFold = !providerFold; renderProviderBar(); };

  let list = document.getElementById("provider-fold-list");
  if (!list) {
    list = el("div", "");
    list.id = "provider-fold-list";
    list.style.marginTop = "8px";
    bar.parentNode.insertBefore(list, bar.nextSibling);
  }
  list.innerHTML = "";
  if (providerFold) return;

  state.settings.providers.forEach(p2 => {
    const div = el("div", "list-item" + (p2.id === state.settings.currentProviderId ? " active" : ""));
    const info2 = el("div", "list-info");
    info2.appendChild(el("div", "list-name", p2.name));
    info2.appendChild(el("div", "list-desc", (p2.baseURL || "未配置") + " · " + p2.models.length + "个模型"));
    const more = el("span", "item-more", "⋯");
    info2.onclick = (e) => {
      e.stopPropagation();
      state.settings.currentProviderId = p2.id;
      saveState();
      renderProviderBar();
      fillProviderForm();
      renderModelBtn();
      toast("已切换到 " + p2.name);
    };
    more.onclick = (e) => {
      e.stopPropagation();
      showActions([
        { label: "重命名", fn: () => inputDialog("供应商名字", p2.name, v => {
            if (v.trim()) { p2.name = v.trim(); saveState(); renderProviderBar(); }
          }) },
        { label: "删除", danger: true, fn: () => {
            if (state.settings.providers.length <= 1) { toast("至少保留一个供应商"); return; }
            confirmDialog("删除这个供应商？", () => {
              state.settings.providers = state.settings.providers.filter(x => x.id !== p2.id);
              if (state.settings.currentProviderId === p2.id) {
                state.settings.currentProviderId = state.settings.providers[0].id;
              }
              saveState();
              renderProviderBar();
              fillProviderForm();
              renderModelBtn();
            });
          } }
      ], e.clientX, e.clientY);
    };
    div.appendChild(info2);
    div.appendChild(more);
    list.appendChild(div);
  });
  const add = el("button", "btn secondary", "＋ 新增供应商");
  add.style.cssText = "width:100%;";
  add.onclick = (e) => { e.stopPropagation(); newProvider(); };
  list.appendChild(add);
}

function newProvider() {
  inputDialog("供应商名字", "", v => {
    if (!v.trim()) return;
    const p = { id: uid(), name: v.trim(), baseURL: "", apiKey: "", models: [], model: "" };
    state.settings.providers.push(p);
    state.settings.currentProviderId = p.id;
    saveState();
    renderProviderBar();
    fillProviderForm();
    renderModelBtn();
  });
}

function fillProviderForm() {
  const p = curProvider();
  $("#set-baseurl").value = p.baseURL;
  $("#set-apikey").value = p.apiKey;
  renderModelSelect();
}

async function fetchModels() {
  const p = curProvider();
  p.baseURL = $("#set-baseurl").value.trim();
  p.apiKey = $("#set-apikey").value.trim();
  if (!p.baseURL || !p.apiKey) { toast("先填地址和Key"); return; }
  toast("拉取中...");
  try {
    const url = p.baseURL.replace(/\/+$/, "") + "/models";
    const res = await fetch(url, { headers: { "Authorization": "Bearer " + p.apiKey } });
    if (!res.ok) throw new Error("拉取失败 " + res.status);
    const j = await res.json();
    const ids = (j.data || []).map(m => m.id).sort();
    if (!ids.length) throw new Error("没有拉到模型");
    p.models = ids;
    if (!p.model || !ids.includes(p.model)) p.model = ids[0];
    saveState();
    renderModelSelect();
    renderModelBtn();
    renderProviderBar();
    toast("拉到 " + ids.length + " 个模型");
  } catch (e) {
    toast(e.message, 5000);
  }
}

function renderModelSelect() {
  const sel = $("#set-model");
  let search = document.getElementById("model-search");
    if (!search) {
    search = document.createElement("input");
    search.id = "model-search";
    search.type = "text";
    search.placeholder = "搜索模型名（列表太多时用）";
    search.style.cssText = "width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:12px;padding:10px 12px;font-size:14px;outline:none;background:var(--bg);color:var(--text-main);font-family:inherit;margin-bottom:10px;";
    sel.parentNode.insertBefore(search, sel);
    search.addEventListener("input", () => drawModelOptions(search.value));
  }
  drawModelOptions(search.value);
}

function drawModelOptions(filter) {
  const p = curProvider();
  const sel = $("#set-model");
  const f = (filter || "").trim().toLowerCase();
  const arr = f ? p.models.filter(id => id.toLowerCase().indexOf(f) >= 0) : p.models;
  sel.innerHTML = "";
  if (!arr.length) {
    const o = document.createElement("option");
    o.textContent = "没找到匹配的模型";
    sel.appendChild(o);
    return;
  }
  arr.forEach(id => {
    const o = document.createElement("option");
    o.value = id;
    o.textContent = id;
    if (id === p.model) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = () => {
    p.model = sel.value;
    saveState();
    renderModelBtn();
  };
}

function renderModelBtn() {
  $("#model-btn").textContent = curProvider().model || "选择模型";
}

function toggleModelPopup() {
  const pop = $("#model-popup");
  if (pop.classList.contains("show")) {
    pop.classList.remove("show");
    return;
  }
  const p = curProvider();
  if (!p.models.length) { toast("先去设置里拉取模型列表"); return; }
  pop.innerHTML = "";

  const search = document.createElement("input");
  search.placeholder = "搜索模型名...";
  search.style.cssText = "width:100%;box-sizing:border-box;border:none;border-bottom:1px solid rgba(0,0,0,0.08);padding:10px 14px;font-size:14px;outline:none;background:transparent;position:sticky;top:0;";
  pop.appendChild(search);

  const listWrap = document.createElement("div");
  pop.appendChild(listWrap);

  function draw(filter) {
    listWrap.innerHTML = "";
    const f = (filter || "").trim().toLowerCase();
    const arr = f ? p.models.filter(id => id.toLowerCase().indexOf(f) >= 0) : p.models;
    if (!arr.length) {
      const e = el("div", "model-item", "没找到匹配的模型");
      e.style.color = "#aaa";
      listWrap.appendChild(e);
      return;
    }
    arr.forEach(id => {
      const div = el("div", "model-item" + (id === p.model ? " selected" : ""), id);
      div.onclick = () => {
        p.model = id;
        saveState();
        renderModelBtn();
        pop.classList.remove("show");
      };
      listWrap.appendChild(div);
    });
  }
  search.addEventListener("input", () => draw(search.value));
  draw("");

  pop.classList.add("show");
}

/* ---------- 通用上传按钮工厂 ---------- */
function mkUpload(parent, label, key, after, delLabel) {
  const btn = el("button", "btn secondary", label);
  btn.style.cssText = "width:100%;margin-bottom:8px;";
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.display = "none";
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await putImg(key, file);
    if (urlCache[key]) { URL.revokeObjectURL(urlCache[key]); delete urlCache[key]; }
    if (after) after();
    e.target.value = "";
    toast("已上传");
  };
  btn.onclick = () => input.click();
  parent.appendChild(btn);
  parent.appendChild(input);
  if (delLabel) {
    const del = el("button", "btn secondary", delLabel);
    del.style.cssText = "width:100%;margin-bottom:12px;";
    del.onclick = async () => {
      await delImg(key);
      if (urlCache[key]) { URL.revokeObjectURL(urlCache[key]); delete urlCache[key]; }
      if (after) after();
      toast("已移除");
    };
    parent.appendChild(del);
  }
}

/* ---------- 设置页 ---------- */
let bgScope = "chat";

function buildSettingsExtras() {
  const pb = $("#param-body");
  pb.innerHTML = "";
  pb.appendChild(el("label", "form-label", "输出方式（部分中转流式易空回，可切非流式）"));
  mkSeg(pb,
    [{ v: "stream", name: "流式（打字机）" }, { v: "plain", name: "非流式（整段落地）" }],
    () => state.settings.streamMode,
    (v) => { state.settings.streamMode = v; saveState(); toast(v === "plain" ? "已切非流式，回复会整段出现" : "已切流式"); }
  );
  mkSlider(pb, "temperature", 0, 2, 0.1, "temperature", "", null);
  mkSlider(pb, "携带上下文条数", 1, 100, 1, "contextCount", "条", null);

  const tb = $("#think-body");
  tb.innerHTML = "";
  tb.appendChild(el("label", "form-label", "总开关（用思考模型时再开）"));
  mkSeg(tb,
    [{ v: false, name: "关闭" }, { v: true, name: "开启" }],
    () => state.settings.thinkOn,
    (v) => { state.settings.thinkOn = v; saveState(); renderMessages(); buildSettingsExtras(); }
  );
  if (state.settings.thinkOn) {
    tb.appendChild(el("label", "form-label", "显示方式"));
    mkSeg(tb,
      [{ v: "fold", name: "折叠框" }, { v: "hide", name: "完全隐藏" }],
      () => state.settings.thinkMode,
      (v) => { state.settings.thinkMode = v; saveState(); renderMessages(); buildSettingsExtras(); }
    );
    if (state.settings.thinkMode === "fold") {
      mkColorArea(tb, "折叠框颜色", "thinkHue", "thinkSat", "thinkLight", "thinkAlpha", () => renderMessages());
    }
  }

  const sb = $("#split-body");
  sb.innerHTML = "";
  sb.appendChild(el("label", "form-label", "总开关"));
  mkSeg(sb,
    [{ v: false, name: "关闭" }, { v: true, name: "开启" }],
    () => state.settings.splitSend,
    (v) => { state.settings.splitSend = v; saveState(); }
  );
  mkSlider(sb, "分段上限", 2, 20, 1, "splitMax", "段", null);
    sb.appendChild(el("label", "form-label", "分段时间戳"));
  mkSeg(sb,
    [{ v: "all", name: "每条都显示" }, { v: "first", name: "只在第一条" }, { v: "last", name: "只在最后一条" }],
    () => state.settings.splitTimeMode || (state.settings.splitTimeLast ? "last" : "all"),
    (v) => { state.settings.splitTimeMode = v; state.settings.splitTimeLast = (v === "last"); saveState(); renderMessages(); }
  );
    mkPickRow(sb, "分段头像",
    [{ v: false, name: "每条都显示" }, { v: true, name: "只在第一条显示" }],
    () => state.settings.splitAvatarOnce,
    (v) => { state.settings.splitAvatarOnce = v; saveState(); renderMessages(); }
  );

  const bb = $("#bg-body");
  bb.innerHTML = "";
  const BG_AREAS = [
    { v: "chat", name: "聊天背景", key: () => curRole().id + "_bg", note: "跟角色走", after: applyBg },
    { v: "input", name: "输入栏", key: () => "bg_input", note: "", after: applyBg },
    { v: "sidebar", name: "侧边栏", key: () => "bg_sidebar", note: "", after: applyBg },
    { v: "membook", name: "记忆手册", key: () => "bg_membook", note: "", after: null },
    { v: "bubuser", name: "我的气泡", key: () => "bubble_user", note: "", after: () => renderMessages() },
    { v: "bubai", name: "AI气泡", key: () => "bubble_ai", note: "", after: () => renderMessages() }
  ];
  bb.appendChild(el("label", "form-label", "选一个区域"));
  mkSeg(bb,
    BG_AREAS.map(a => ({ v: a.v, name: a.name })),
    () => bgScope,
    (v) => { bgScope = v; buildSettingsExtras(); }
  );
  const area = BG_AREAS.find(a => a.v === bgScope);
  const tip = el("div", "", "正在装修：" + area.name + (area.note ? "（" + area.note + "）" : ""));
  tip.style.cssText = "font-size:12px;color:var(--text-faint);margin:4px 2px 10px;";
  bb.appendChild(tip);
  mkUpload(bb, "上传" + area.name + "图片", area.key(), area.after, "移除" + area.name + "图片");
}

let settingsTab = "";
const SETTINGS_SECTIONS = [
  { k: "sec-api", name: "API设置", ic: "api" },
  { k: "sec-param", name: "参数", ic: "param" },
  { k: "sec-think", name: "思维链", ic: "bulb" },
  { k: "sec-split", name: "分段发送", ic: "split" },
  { k: "sec-bg", name: "背景", ic: "bg" },
  { k: "sec-data", name: "数据", ic: "data" }
];

function buildSettingsMenu() {
  let menu = document.getElementById("settings-menu");
  if (!menu) {
    menu = el("div", "");
    menu.id = "settings-menu";
    menu.style.cssText = "padding:14px 16px;";
    const header = document.querySelector("#settings-panel .panel-header");
    header.parentNode.insertBefore(menu, header.nextSibling);
  }
  menu.innerHTML = "";
  const secs = document.querySelectorAll("#settings-panel .settings-section");
  const saveDiv = document.getElementById("sec-save");
  secs.forEach(s => { s.style.display = "none"; });
  if (saveDiv) saveDiv.style.display = "none";

  if (!settingsTab) {
    $("#settings-title").textContent = "设置";
    const list = el("div", "ios-list");
        SETTINGS_SECTIONS.forEach(t => {
      const row = el("div", "ios-row");
      const tile = el("div", "ic-tile");
      tile.innerHTML = lineIcon(t.ic);
      row.appendChild(tile);
      row.appendChild(el("span", "", t.name));
      row.appendChild(el("span", "ios-arrow", "›"));
      row.onclick = () => {
        settingsTab = t.k;
        buildSettingsMenu();
        $("#settings-panel").scrollTop = 0;
      };
      list.appendChild(row);
    });
    menu.appendChild(list);
    return;
  }

  const cur = SETTINGS_SECTIONS.find(t => t.k === settingsTab);
  $("#settings-title").textContent = cur ? cur.name : "设置";
  const sec = document.getElementById(settingsTab);
  if (sec) sec.style.display = "";
  if (settingsTab === "sec-api" && saveDiv) saveDiv.style.display = "";
}

function saveSettingsForm() {
  const p = curProvider();
  p.baseURL = $("#set-baseurl").value.trim();
  p.apiKey = $("#set-apikey").value.trim();
  saveState();
  toast("已保存");
  renderProviderBar();
}

/* ---------- 角色页 ---------- */
function renderRolePage() {
  const list = $("#role-page-list");
  list.innerHTML = "";
  state.roles.forEach(r => {
    const div = el("div", "list-item" + (r.id === state.currentRoleId ? " active" : ""));
    const img = el("img", "list-avatar");
    getImg(r.id + "_ai").then(blob => {
      img.src = blob ? URL.createObjectURL(blob) : AI_FALLBACK;
    });
    const info = el("div", "list-info");
    info.appendChild(el("div", "list-name", r.name));
    info.appendChild(el("div", "list-desc", r.sessions.length + "个会话 · " + r.memories.length + "条记忆"));
    const more = el("span", "item-more", "⋯");
    info.onclick = () => {
      state.currentRoleId = r.id;
      saveState();
      clearUrlCache();
      renderAll();
      applyBg();
      renderRolePage();
      toast("已切换到 " + r.name);
    };
    const openMore = (x, y) => {
      showActions([
        { label: "编辑", fn: () => openCharEditor(r) },
        { label: "重命名", fn: () => inputDialog("角色名", r.name, v => {
            if (v.trim()) { r.name = v.trim(); saveState(); renderRolePage(); renderSidebar(); }
          }) },
        { label: "删除", danger: true, fn: () => {
            if (state.roles.length <= 1) { toast("至少保留一个角色"); return; }
            confirmDialog("删除角色和它的全部数据？", () => {
              ["_ai", "_user", "_bg"].forEach(sf => delImg(r.id + sf));
              state.roles = state.roles.filter(x => x.id !== r.id);
              if (state.currentRoleId === r.id) state.currentRoleId = state.roles[0].id;
              saveState();
              clearUrlCache();
              renderAll();
              applyBg();
              renderRolePage();
            });
          } }
      ], x, y);
    };
    more.onclick = (e) => {
      e.stopPropagation();
      openMore(e.clientX, e.clientY);
    };
    more.addEventListener("touchend", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const t = e.changedTouches[0];
      openMore(t.clientX, t.clientY);
    });
    div.appendChild(img);
    div.appendChild(info);
    div.appendChild(more);
    list.appendChild(div);
  });
}

function newRole() {
  inputDialog("新角色名字", "", v => {
    if (!v.trim()) return;
    const sessionId = uid();
    const r = {
      id: uid(), name: v.trim(),
      systemPrompt: "", aiName: "Claude", userName: "我",
      currentSessionId: sessionId,
      sessions: [{ id: sessionId, name: "新对话", messages: [] }],
      memories: [],
      memPending: []
    };
    state.roles.push(r);
    state.currentRoleId = r.id;
    saveState();
    clearUrlCache();
    renderAll();
    applyBg();
    renderRolePage();
  });
}

/* ---------- 角色编辑器 ---------- */
function openCharEditor(r) {
  const old = document.getElementById("char-editor");
  if (old) old.remove();
  closeSidebar();

  const ov = el("div", "overlay-page");
  ov.id = "char-editor";
  ov.style.zIndex = "410";

  const head = el("div", "overlay-head");
  head.appendChild(el("div", "overlay-title", "编辑角色"));
  const close = el("button", "seg-btn", "取消");
  close.onclick = () => ov.remove();
  head.appendChild(close);
  ov.appendChild(head);

  const body = el("div", "overlay-body");
  ov.appendChild(body);

  function label(t) {
    const l = el("div", "", t);
    l.style.cssText = "font-size:13px;font-weight:600;margin:16px 2px 6px;color:var(--text-sub);";
    body.appendChild(l);
  }
  function input(val, multiline) {
    const n = document.createElement(multiline ? "textarea" : "input");
    n.className = multiline ? "form-textarea" : "form-input";
    n.value = val || "";
    if (multiline) n.style.minHeight = "200px";
    body.appendChild(n);
    return n;
  }

  label("角色名字");
  const nameIn = input(r.name);
  label("人设提示词");
  const pIn = input(r.systemPrompt, true);
  label("他的昵称");
  const aIn = input(r.aiName);
  label("你的昵称");
  const uIn = input(r.userName);

  label("AI头像（传你自己找的图,透明底也认）");
  const aiRow = el("div", "avatar-upload");
  const aiPrev = el("img", "avatar-preview");
  avatarSrc("ai").then(src => { aiPrev.src = src; });
  const aiFile = document.createElement("input");
  aiFile.type = "file";
  aiFile.accept = "image/*";
  aiFile.onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    await putImg(r.id + "_ai", f);
    clearUrlCache();
    aiPrev.src = await avatarSrc("ai");
    renderAll();
    toast("已上传");
  };
  aiRow.appendChild(aiPrev);
  aiRow.appendChild(aiFile);
  body.appendChild(aiRow);

  label("我的头像");
  const uRow = el("div", "avatar-upload");
  const uPrev = el("img", "avatar-preview");
  avatarSrc("user").then(src => { uPrev.src = src; });
  const uFile = document.createElement("input");
  uFile.type = "file";
  uFile.accept = "image/*";
  uFile.onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    await putImg(r.id + "_user", f);
    clearUrlCache();
    uPrev.src = await avatarSrc("user");
    renderAll();
    toast("已上传");
  };
  uRow.appendChild(uPrev);
  uRow.appendChild(uFile);
  body.appendChild(uRow);

  const save = el("button", "btn", "保存");
  save.style.cssText = "width:100%;margin-top:22px;";
  save.onclick = () => {
    r.name = nameIn.value.trim() || r.name;
    r.systemPrompt = pIn.value;
    r.aiName = aIn.value.trim() || "Claude";
    r.userName = uIn.value.trim() || "我";
    saveState();
    ov.remove();
    toast("角色改好了");
    renderRolePage();
    renderSidebar();
    renderMessages();
  };
  body.appendChild(save);
  document.body.appendChild(ov);
}

/* ---------- 导出导入 ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "home_backup_" + Date.now() + ".json";
  a.click();
  saveState();
  toast("已导出");
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const j = JSON.parse(reader.result);
      if (!j.roles || !j.settings) throw new Error("文件格式不对");
      state = j;
      fillDefaults();
      saveState();
      clearUrlCache();
      applyTheme();
      applyBg();
      renderAll();
      toast("导入成功");
    } catch (err) {
      toast("导入失败：" + err.message, 5000);
    }
  };
  reader.readAsText(file);
  e.target.value = "";
}

let exportMode = false;

function toggleExportMode() {
  exportMode = !exportMode;
  document.body.classList.toggle("export-mode", exportMode);
  $("#export-txt-bar").classList.toggle("show", exportMode);
  document.querySelectorAll(".msg-check").forEach(c => {
    c.style.display = exportMode ? "block" : "none";
    if (!exportMode) c.checked = false;
  });
  closePanel("#settings-panel");
}

function doExportTxt() {
  const s = curSession();
  const r = curRole();
  const ids = Array.from(document.querySelectorAll(".msg-check")).filter(c => c.checked).map(c => c.dataset.id);
  const pool = s.messages.filter(m => m.role !== "err");
  const msgs = ids.length ? pool.filter(m => ids.includes(m.id)) : pool;
  if (!msgs.length) { toast("没有可导出的消息"); return; }
  const lines = msgs.map(m => {
    const name = m.role === "user" ? r.userName : r.aiName;
    return "[" + fmtTime(m.time) + "] " + name + "：" + NL + msgText(m) + NL;
  });
  const blob = new Blob([lines.join(NL)], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = s.name + ".txt";
  a.click();
  toggleExportMode();
  toast("已导出TXT");
}

/* ---------- 控件工厂 ---------- */
function mkSection(parent, title) {
  const wrap = el("div", "set-wrap");
  if (title) wrap.appendChild(el("div", "set-group-title", title));
  const sec = el("div", "settings-section set-card");
  wrap.appendChild(sec);
  parent.appendChild(wrap);
  return sec;
}
/* ---------- 细线图标库:currentColor跟皮肤走 ---------- */
function lineIcon(kind) {
  const s = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  const P = {
    skin: '<path d="M12 19.4 C8.1 16.5 4.9 13.5 4.6 10.3 C4.4 8 6 6.1 8.2 6 c1.5 -0.1 3 0.8 3.8 2.2 c0.7 -1.3 2 -2.2 3.5 -2.3 c2.2 -0.1 3.9 1.7 3.9 4 c0 3.3 -3.4 6.5 -7.4 9.5 Z" ' + s + '/>',
    sidebar: '<rect x="4" y="5" width="16" height="14" rx="2.5" ' + s + '/><path d="M9.5 5 v14" ' + s + '/>',
    globe: '<circle cx="12" cy="12" r="8" ' + s + '/><path d="M4 12 h16" ' + s + '/><path d="M12 4 c3 2.5 3 13.5 0 16 M12 4 c-3 2.5 -3 13.5 0 16" ' + s + '/>',
    drop: '<path d="M12 4.5 c-3.4 4 -5.4 6.7 -5.4 9.2 a5.4 5.4 0 0 0 10.8 0 c0 -2.5 -2 -5.2 -5.4 -9.2 Z" ' + s + '/>',
    bubble: '<path d="M12 5 c-4.4 0 -8 2.8 -8 6.2 c0 2 1.2 3.7 3 4.8 L6.3 19.3 l3.4 -1.5 c0.7 0.2 1.5 0.2 2.3 0.2 c4.4 0 8 -2.8 8 -6.2 C20 7.8 16.4 5 12 5 Z" ' + s + '/>',
    shapes: '<circle cx="9" cy="9" r="4.5" ' + s + '/><rect x="11.5" y="11.5" width="8" height="8" rx="2" ' + s + '/>',
    alignc: '<path d="M5 7 h14 M8.5 12 h7 M5 17 h14" ' + s + '/>',
    chip: '<rect x="7" y="7" width="10" height="10" rx="2" ' + s + '/><path d="M10 7 V4.5 M14 7 V4.5 M10 19.5 V17 M14 19.5 V17 M7 10 H4.5 M7 14 H4.5 M19.5 10 H17 M19.5 14 H17" ' + s + '/>',
    avatar: '<circle cx="12" cy="9" r="3.5" ' + s + '/><path d="M5.5 19.5 c1 -3.5 3.5 -5.2 6.5 -5.2 s5.5 1.7 6.5 5.2" ' + s + '/>',
    clock: '<circle cx="12" cy="12" r="8" ' + s + '/><path d="M12 7.5 V12 l3.2 2" ' + s + '/>',
    calendar: '<rect x="4.5" y="6" width="15" height="13.5" rx="2" ' + s + '/><path d="M4.5 10.5 h15 M8.5 4.5 v3 M15.5 4.5 v3" ' + s + '/>',
    position: '<circle cx="12" cy="12" r="5.5" ' + s + '/><path d="M12 4 v2.5 M12 17.5 V20 M4 12 h2.5 M17.5 12 H20" ' + s + '/>',
    hash: '<path d="M9.5 4.5 L8 19.5 M16 4.5 L14.5 19.5 M5 9.5 h15 M4.5 15 h15" ' + s + '/>',
    tag: '<path d="M4.5 5.8 a1.3 1.3 0 0 1 1.3 -1.3 h5.4 l8.3 8.3 a1.5 1.5 0 0 1 0 2.1 l-4.9 4.9 a1.5 1.5 0 0 1 -2.1 0 L4.5 11.2 Z" ' + s + '/><circle cx="8.6" cy="8.6" r="1.1" ' + s + '/>',
    bar: '<rect x="3.5" y="8.5" width="17" height="7" rx="3.5" ' + s + '/><circle cx="8" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="16" cy="12" r="1" fill="currentColor" stroke="none"/>',
    stream: '<path d="M4.5 7 H17 M4.5 12 h15 M4.5 17 h10.5" ' + s + '/>',
    power: '<path d="M12 4 v7" ' + s + '/><path d="M7.8 6.5 a7 7 0 1 0 8.4 0" ' + s + '/>',
    bulb: '<path d="M9.7 17.5 h4.6 M10.4 20 h3.2" ' + s + '/><path d="M12 4 a5.4 5.4 0 0 1 3 9.9 c-0.6 0.4 -1 1 -1 1.7 h-4 c0 -0.7 -0.4 -1.3 -1 -1.7 A5.4 5.4 0 0 1 12 4 Z" ' + s + '/>',
    eye: '<path d="M3.5 12 C6 7.7 9 5.7 12 5.7 s6 2 8.5 6.3 C18 16.3 15 18.3 12 18.3 s-6 -2 -8.5 -6.3 Z" ' + s + '/><circle cx="12" cy="12" r="2.6" ' + s + '/>',
    glass: '<rect x="5" y="5" width="14" height="14" rx="3.5" ' + s + '/><path d="M8.5 15.5 L15.5 8.5 M12 17 l5 -5" ' + s + '/>',
    target: '<circle cx="12" cy="12" r="7.5" ' + s + '/><circle cx="12" cy="12" r="3" ' + s + '/>',
    bg: '<rect x="4" y="5" width="16" height="14" rx="2" ' + s + '/><circle cx="9" cy="9.8" r="1.5" ' + s + '/><path d="M5 16.8 l4 -3.6 3.6 3 2.4 -2 4 3.4" ' + s + '/>',
    font: '<path d="M6 19 L12 5 l6 14 M8.4 13.5 h7.2" ' + s + '/>',
    layout: '<rect x="4" y="5" width="16" height="14" rx="2" ' + s + '/><path d="M4 11 h16 M11 11 v8" ' + s + '/>',
    mem: '<path d="M12 6.3 C10 5 7 4.7 4.5 5.5 V18.3 C7 17.5 10 17.8 12 19.2 c2 -1.4 5 -1.7 7.5 -0.9 V5.5 C17 4.7 14 5 12 6.3 Z" ' + s + '/><path d="M12 6.3 V19.2" ' + s + '/>',
    api: '<path d="M7.3 17.5 a4.1 4.1 0 0 1 -0.3 -8.2 a5.2 5.2 0 0 1 10.1 1.1 a3.6 3.6 0 0 1 -0.6 7.1 Z" ' + s + '/>',
    param: '<path d="M5 8.5 h2.8 M12.2 8.5 H19 M5 15.5 h7.8 M17.2 15.5 H19" ' + s + '/><circle cx="10" cy="8.5" r="2.2" ' + s + '/><circle cx="15" cy="15.5" r="2.2" ' + s + '/>',
    split: '<path d="M5 5.5 h14 M5 9 h9 M5 15 h14 M5 18.5 h7" ' + s + '/>',
    data: '<ellipse cx="12" cy="6.5" rx="7" ry="2.7" ' + s + '/><path d="M5 6.5 V17.5 c0 1.5 3.1 2.7 7 2.7 s7 -1.2 7 -2.7 V6.5" ' + s + '/><path d="M5 12 c0 1.5 3.1 2.7 7 2.7 s7 -1.2 7 -2.7" ' + s + '/>'
  };
  if (!P[kind]) return "";
  return '<svg viewBox="0 0 24 24">' + P[kind] + "</svg>";
}

/* 行标题对图标的认领表 */
const ROW_ICONS = {
  "皮肤": "skin",
  "聊天界面": "layout",
  "侧边栏样式": "sidebar",
  "菜单语言": "globe",
  "质感": "drop",
  "AI无气泡": "bubble",
  "形状": "shapes",
  "标题居中": "alignc",
  "昵称居中": "alignc",
  "输入框模型显示": "chip",
  "头像形状": "avatar",
  "时间戳": "clock",
  "时间格式": "calendar",
  "时间戳位置": "position",
  "token统计": "hash",
  "token位置": "position",
  "双方昵称": "tag",
  "双方头像": "avatar",
  "消息下方操作栏": "bar",
  "输出方式": "stream",
  "总开关": "power",
  "总开关（用思考模型时再开）": "bulb",
  "显示方式": "eye",
  "分段时间戳": "clock",
  "分段头像": "avatar",
  "液态玻璃模式": "glass",
  "选一个区域来调": "target",
  "选一个区域": "bg"
};

function rowLead(text, cls) {
  const lead = el("div", "row-lead");
  const kind = ROW_ICONS[text] || (text.indexOf("字体") >= 0 ? "font" : "");
  if (kind) {
    const ic = el("span", "row-ic");
    ic.innerHTML = lineIcon(kind);
    lead.appendChild(ic);
  }
  lead.appendChild(el("span", cls, text));
  return lead;
}

function mkPickRow(parent, label, opts, getV, setV) {
    const row = el("div", "pick-row");
    row.appendChild(rowLead(label, "pick-label"));
  const val = el("span", "pick-val");
  function refresh() {
    const cur = opts.find(o => o.v === getV());
    val.textContent = (cur ? cur.name : "") + " ›";
  }
  row.appendChild(val);
  row.onclick = (e) => {
    document.querySelectorAll(".pick-menu").forEach(x => x.remove());
    const menu = el("div", "pick-menu");
    opts.forEach(o => {
      const it = el("div", "pick-item" + (o.v === getV() ? " on" : ""), o.name);
      if (o.font) it.style.fontFamily = o.font;
      it.onclick = (ev) => {
        ev.stopPropagation();
        menu.remove();
        setV(o.v);
        refresh();
      };
      menu.appendChild(it);
    });
    document.body.appendChild(menu);
    const r2 = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(e.clientX, window.innerWidth - r2.width - 8)) + "px";
    menu.style.top = Math.max(8, Math.min(e.clientY, window.innerHeight - r2.height - 8)) + "px";
    setTimeout(() => {
      const closer = (ev) => {
        if (!menu.contains(ev.target)) {
          menu.remove();
          document.removeEventListener("touchstart", closer, true);
          document.removeEventListener("click", closer, true);
        }
      };
      document.addEventListener("touchstart", closer, true);
      document.addEventListener("click", closer, true);
    }, 80);
  };
  parent.appendChild(row);
  refresh();
  return refresh;
}

function mkSeg(parent, opts, getV, setV) {
  const isBool = opts.length === 2 && opts.every(o => typeof o.v === "boolean");

  if (isBool) {
    let lbl = "";
    const prev = parent.lastElementChild;
    if (prev && prev.classList && prev.classList.contains("form-label")) {
      lbl = prev.textContent;
      prev.remove();
    }
    const row = el("div", "tgl-row");
    row.appendChild(rowLead(lbl, "tgl-label"));
    const t = el("button", "tgl");
    const onVal = opts[0].v === true ? opts[0].v : opts[1].v;
    function refresh() { t.classList.toggle("on", getV() === true); }
    t.onclick = () => { setV(getV() === true ? false : true); refresh(); };
    row.appendChild(t);
    parent.appendChild(row);
    refresh();
    return refresh;
  }

  if (opts.length >= 3) {
    let lbl = "";
    const prev = parent.lastElementChild;
    if (prev && prev.classList && prev.classList.contains("form-label")) {
      lbl = prev.textContent;
      prev.remove();
    }
    const row = el("div", "pick-row");
    row.appendChild(el("span", "pick-label", lbl));
    const val = el("span", "pick-val");
    function refresh() {
      const cur = opts.find(o => o.v === getV());
      val.textContent = (cur ? cur.name : "") + " ›";
    }
    row.appendChild(val);
    row.onclick = (e) => {
      document.querySelectorAll(".pick-menu").forEach(x => x.remove());
      const menu = el("div", "pick-menu");
      opts.forEach(o => {
        const it = el("div", "pick-item" + (o.v === getV() ? " on" : ""), o.name);
        it.onclick = (ev) => {
          ev.stopPropagation();
          menu.remove();
          setV(o.v);
          refresh();
        };
        menu.appendChild(it);
      });
      document.body.appendChild(menu);
      const r2 = menu.getBoundingClientRect();
      menu.style.left = Math.max(8, Math.min(e.clientX, window.innerWidth - r2.width - 8)) + "px";
      menu.style.top = Math.max(8, Math.min(e.clientY, window.innerHeight - r2.height - 8)) + "px";
      setTimeout(() => {
        const closer = (ev) => {
          if (!menu.contains(ev.target)) {
            menu.remove();
            document.removeEventListener("touchstart", closer, true);
            document.removeEventListener("click", closer, true);
          }
        };
        document.addEventListener("touchstart", closer, true);
        document.addEventListener("click", closer, true);
      }, 80);
    };
    parent.appendChild(row);
    refresh();
    return refresh;
  }

  const g = el("div", "seg-group");
  opts.forEach(o => {
    const b = el("button", "seg-btn", o.name);
    b._v = o.v;
    b.onclick = () => { setV(o.v); refresh(); };
    g.appendChild(b);
  });
  function refresh() {
    Array.from(g.children).forEach(b => b.classList.toggle("on", b._v === getV()));
  }
  refresh();
  parent.appendChild(g);
  return refresh;
}


function mkSlider(parent, label, min, max, step, key, unit, after) {
  const rowEl = el("div", "slider-row");
  const head = el("div", "slider-head");
  head.appendChild(el("span", "", label));
  const val = el("span", "slider-val", state.settings[key] + unit);
  head.appendChild(val);
  const sl = document.createElement("input");
  sl.type = "range";
  sl.min = min;
  sl.max = max;
  sl.step = step;
  sl.value = state.settings[key];
  sl.addEventListener("input", () => {
    state.settings[key] = Number(sl.value);
    val.textContent = sl.value + unit;
    saveState();
    if (after) after();
  });
  rowEl.appendChild(head);
  rowEl.appendChild(sl);
  parent.appendChild(rowEl);
}

function mkFontSelect(parent, label, key, after) {
  mkPickRow(parent, label,
    Object.keys(FONT_NAMES).map(k => ({ v: k, name: FONT_NAMES[k], font: FONT_LIST[k] })),
    () => state.settings[key],
    (v) => { state.settings[key] = v; saveState(); if (after) after(); }
  );
}

/* ---------- 颜色区工厂 ---------- */
function mkColorArea(parent, label, hueKey, satKey, lightKey, alphaKey, onChange) {
  const fire = onChange || (() => renderMessages());
  parent.appendChild(el("label", "form-label", label));

  const preview = el("div", "");
  preview.style.cssText = "height:16px;border-radius:8px;margin-bottom:10px;border:1px solid var(--line);background-image:linear-gradient(45deg,#e8e8e8 25%,transparent 25%,transparent 75%,#e8e8e8 75%),linear-gradient(45deg,#e8e8e8 25%,transparent 25%,transparent 75%,#e8e8e8 75%);background-size:10px 10px;background-position:0 0,5px 5px;position:relative;overflow:hidden;";
  const previewInk = el("div", "");
  previewInk.style.cssText = "position:absolute;inset:0;";
  preview.appendChild(previewInk);
  parent.appendChild(preview);

  function refreshPreview() {
    const st = state.settings;
    if (st[hueKey] < 0) {
      previewInk.style.background = "linear-gradient(135deg, rgba(255,255,255,0.9), rgba(200,200,200,0.35))";
    } else {
      previewInk.style.background = hslaOf(st[hueKey], st[satKey], st[lightKey], st[alphaKey] === undefined ? 100 : st[alphaKey]);
    }
  }

  const dots = el("div", "color-dots");
  const glassDot = el("div", "color-dot");
  glassDot.style.background = "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(180,180,180,0.3))";
  glassDot.onclick = () => {
    state.settings[hueKey] = -1;
    saveState();
    fire();
    refreshDots();
    refreshPreview();
    slBox.style.display = "none";
  };
  dots.appendChild(glassDot);

  QUICK_COLORS.forEach(c => {
    const d = el("div", "color-dot");
    d.style.background = "hsla(" + c.h + "," + c.s + "%," + c.l + "%,1)";
    if (c.l >= 97) d.style.border = "1px solid rgba(0,0,0,0.12)";
    d._c = c;
    d.onclick = () => {
      state.settings[hueKey] = c.h;
      state.settings[satKey] = c.s;
      state.settings[lightKey] = c.l;
      if (state.settings[alphaKey] !== undefined) state.settings[alphaKey] = c.a;
      saveState();
      fire();
      refreshDots();
      refreshPreview();
      buildSl();
      slBox.style.display = "block";
    };
    dots.appendChild(d);
  });
  parent.appendChild(dots);

  const moreBtn = el("button", "seg-btn", "微调 ▾");
  moreBtn.style.marginBottom = "10px";
  parent.appendChild(moreBtn);

  const slBox = el("div", "");
  slBox.style.display = "none";
  parent.appendChild(slBox);

  moreBtn.onclick = () => {
    if (slBox.style.display === "none") {
      if (state.settings[hueKey] < 0) state.settings[hueKey] = 205;
      buildSl();
      slBox.style.display = "block";
      refreshPreview();
    } else {
      slBox.style.display = "none";
    }
  };

  function refreshDots() {
    const st = state.settings;
    glassDot.classList.toggle("on", st[hueKey] < 0);
    Array.from(dots.children).forEach(d => {
      if (!d._c) return;
      const c = d._c;
      d.classList.toggle("on", st[hueKey] === c.h && st[satKey] === c.s && st[lightKey] === c.l);
    });
  }

  function buildSl() {
    slBox.innerHTML = "";
    const hueRow = el("div", "slider-row");
    const head = el("div", "slider-head");
    head.appendChild(el("span", "", "色相"));
    const val = el("span", "slider-val", state.settings[hueKey]);
    head.appendChild(val);
    const sl = document.createElement("input");
    sl.type = "range";
    sl.min = 0;
    sl.max = 360;
    sl.step = 1;
    sl.value = Math.max(0, state.settings[hueKey]);
    sl.style.background = "linear-gradient(to right, hsl(0,80%,65%), hsl(60,80%,65%), hsl(120,80%,65%), hsl(180,80%,65%), hsl(240,80%,65%), hsl(300,80%,65%), hsl(360,80%,65%))";
    sl.addEventListener("input", () => {
      state.settings[hueKey] = Number(sl.value);
      val.textContent = sl.value;
      saveState();
      fire();
      refreshDots();
      refreshPreview();
    });
    hueRow.appendChild(head);
    hueRow.appendChild(sl);
    slBox.appendChild(hueRow);
    mkSliderX(slBox, "鲜艳度", 0, 100, 1, satKey, "%");
    mkSliderX(slBox, "深浅", 0, 100, 1, lightKey, "%");
    if (state.settings[alphaKey] !== undefined) {
    mkSliderX(slBox, "不透明度", 0, 100, 1, alphaKey, "%");
    }
  }

  function mkSliderX(parent2, label2, min, max, step, key, unit) {
    const rowEl = el("div", "slider-row");
    const head = el("div", "slider-head");
    head.appendChild(el("span", "", label2));
    const val = el("span", "slider-val", state.settings[key] + unit);
    head.appendChild(val);
    const sl = document.createElement("input");
    sl.type = "range";
    sl.min = min;
    sl.max = max;
    sl.step = step;
    sl.value = state.settings[key];
    sl.addEventListener("input", () => {
      state.settings[key] = Number(sl.value);
      val.textContent = sl.value + unit;
      saveState();
      fire();
      refreshDots();
      refreshPreview();
    });
    rowEl.appendChild(head);
    rowEl.appendChild(sl);
    parent2.appendChild(rowEl);
  }

  refreshDots();
  refreshPreview();
}

/* ========== S3结束 ========== */
/* ==========================================
   S4开始:主题面板(标签页版) / 相识页大厅 / Dock
   ========================================== */

/* ---------- 主题面板:标签页分组 ---------- */
let typoScope = "chat";
let themeTab = "";
let bubbleSizeFold = true;

const THEME_TABS = [
  { k: "look", name: "皮肤", ic: "skin" },
  { k: "bubble", name: "气泡", ic: "bubble" },
  { k: "layout", name: "布局", ic: "layout" },
  { k: "display", name: "显示", ic: "eye" },
  { k: "text", name: "文字", ic: "font" },
  { k: "mem", name: "记忆手册", ic: "mem" }
];

function buildThemePanel() {
  const tabs = $("#theme-tabs");
  tabs.innerHTML = "";
  tabs.style.display = "none";
  const body = $("#theme-body");
  body.innerHTML = "";

  if (!themeTab) {
    $("#theme-title").textContent = "主题";
    const wrap = el("div", "");
    wrap.style.cssText = "padding:14px 16px;";
    const list = el("div", "ios-list");
      THEME_TABS.forEach(t => {
      const row = el("div", "ios-row");
      const tile = el("div", "ic-tile");
      tile.innerHTML = lineIcon(t.ic);
      row.appendChild(tile);
      row.appendChild(el("span", "", t.name));
      row.appendChild(el("span", "ios-arrow", "›"));
      row.onclick = () => {
        themeTab = t.k;
        buildThemePanel();
        $("#theme-panel").scrollTop = 0;
      };
      list.appendChild(row);
    });
    wrap.appendChild(list);
    body.appendChild(wrap);
    return;
  }

  const cur = THEME_TABS.find(t => t.k === themeTab);
  $("#theme-title").textContent = cur ? cur.name : "主题";
  if (themeTab === "look") buildTabLook(body);
  if (themeTab === "bubble") buildTabBubble(body);
  if (themeTab === "layout") buildTabLayout(body);
  if (themeTab === "display") buildTabDisplay(body);
  if (themeTab === "text") buildTabText(body);
  if (themeTab === "mem") buildTabMem(body);
}

function buildTabLook(body) {
  let sec = mkSection(body, "皮肤");
  mkPickRow(sec, "皮肤",
    [{ v: "day", name: "白天" }, { v: "night", name: "夜间" }, { v: "official", name: "官方" }, { v: "liquid", name: "液态" }],
    () => state.settings.skin,
    (v) => { state.settings.skin = v; saveState(); applyTheme(); renderMessages(); }
  );
  mkSlider(sec, "主题润度", 0, 100, 1, "skinGlow", "", applyTheme);
  mkSlider(sec, "全局降亮（觉得刺眼往右拉）", 0, 30, 1, "globalDim", "%", applyTheme);
  mkPickRow(sec, "聊天界面",
    [{ v: "home", name: "经典" }, { v: "gpt", name: "简约" }],
    () => state.settings.chatUi,
    (v) => { state.settings.chatUi = v; saveState(); applyTheme(); }
  );

  sec = mkSection(body, "侧边栏");
  mkPickRow(sec, "侧边栏样式",
    [{ v: "white", name: "纯白" }, { v: "clear", name: "高透液态" }],
    () => state.settings.sidebarStyle,
    (v) => { state.settings.sidebarStyle = v; saveState(); applyTheme(); }
  );
  mkSlider(sec, "透明度", 0, 100, 1, "sidebarAlpha", "%", applyTheme);
  mkSlider(sec, "模糊度（0为纯透）", 0, 30, 1, "sidebarBlur", "px", applyTheme);
  mkPickRow(sec, "菜单语言",
    [{ v: "zh", name: "中文" }, { v: "en", name: "English" }],
    () => state.settings.menuLang,
    (v) => { state.settings.menuLang = v; saveState(); applyTheme(); }
  );
}

function buildTabBubble(body) {
  const sec = mkSection(body, "气泡");
  sec.appendChild(el("label", "form-label", "质感"));
  mkSeg(sec,
    [{ v: "water", name: "水感液态" }, { v: "plain", name: "素面" }, { v: "frost", name: "毛玻璃（细白边）" }],
    () => state.settings.bubbleTexture,
    (v) => { state.settings.bubbleTexture = v; saveState(); renderMessages(); }
  );
   sec.appendChild(el("label", "form-label", "AI无气泡"));

  mkSeg(sec,
    [{ v: false, name: "有气泡" }, { v: true, name: "无气泡（铺满）" }],
    () => state.settings.aiBare,
    (v) => { state.settings.aiBare = v; saveState(); renderMessages(); }
  );
  sec.appendChild(el("label", "form-label", "形状"));
  mkSeg(sec,
    Object.keys(BUBBLE_SHAPES).map(k => ({ v: k, name: BUBBLE_SHAPES[k].name })),
    () => state.settings.bubbleShape,
    (v) => { state.settings.bubbleShape = v; saveState(); renderMessages(); }
  );
   const szBtn = el("button", "fold-btn");
   szBtn.innerHTML = (bubbleSizeFold ? "尺寸（点开细捏）" : "尺寸（收起）") + '<span style="font-size:0.7em;opacity:0.65;margin-left:3px;">' + (bubbleSizeFold ? "▼" : "▲") + '</span>';
  szBtn.style.margin = "8px 0 6px";
  szBtn.onclick = () => { bubbleSizeFold = !bubbleSizeFold; buildThemePanel(); };
  sec.appendChild(szBtn);
  if (!bubbleSizeFold) {
    mkSlider(sec, "上下厚度", 2, 30, 1, "bubblePadV", "px", () => renderMessages());
    mkSlider(sec, "左右宽度", 4, 30, 1, "bubblePadH", "px", () => renderMessages());
    mkSlider(sec, "最大宽度", 55, 100, 1, "bubbleMaxW", "%", () => { applyBubbleBox(); renderMessages(); });
    mkSlider(sec, "圆角弧度", 0, 40, 1, "bubbleRadius", "px", () => renderMessages());
    mkSlider(sec, "段落间距（消息里空行的高度）", 0, 30, 1, "paraGap", "px", () => renderMessages());
  }

  mkColorArea(sec, "我的气泡颜色", "userHue", "userSat", "userLight", "userAlpha");
  mkColorArea(sec, "AI气泡颜色", "aiHue", "aiSat", "aiLight", "aiAlpha");
  mkSlider(sec, "润度（0为原味）", 0, 100, 1, "bubbleGlow", "", () => renderMessages());
  sec.appendChild(el("label", "form-label", "气泡方案（存下当前的形状和颜色）"));
  const PKEYS = ["bubbleTexture", "bubbleShape", "aiBare", "bubbleGlow", "bubblePadV", "bubblePadH", "bubbleMaxW", "bubbleRadius", "userHue", "userSat", "userLight", "userAlpha", "aiHue", "aiSat", "aiLight", "aiAlpha", "paraGap"];
  const saveBtn = el("button", "btn secondary", "保存当前气泡样式");
  saveBtn.style.cssText = "width:100%;margin-bottom:8px;";
  saveBtn.onclick = () => {
    inputDialog("给这套样式起个名", "", v => {
      if (!v.trim()) return;
      const data = {};
      PKEYS.forEach(k => { data[k] = state.settings[k]; });
      state.settings.bubblePresets.push({ id: uid(), name: v.trim(), data: data });
      saveState();
      buildThemePanel();
      toast("存好了");
    });
  };
  sec.appendChild(saveBtn);
    (state.settings.bubblePresets || []).forEach(ps => {
    const prow = el("div", "preset-row");
    const sw = el("div", "");
    sw.style.cssText = "display:flex;gap:3px;flex-shrink:0;";
    [["userHue", "userSat", "userLight", "userAlpha"], ["aiHue", "aiSat", "aiLight", "aiAlpha"]].forEach(K => {
      const dot = el("div", "");
      let bg;
      if (ps.data[K[0]] < 0) bg = "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(180,180,180,0.4))";
      else bg = "hsla(" + ps.data[K[0]] + "," + ps.data[K[1]] + "%," + ps.data[K[2]] + "%," + (ps.data[K[3]] / 100) + ")";
      dot.style.cssText = "width:14px;height:14px;border-radius:50%;border:1px solid rgba(0,0,0,0.1);background:" + bg + ";";
      sw.appendChild(dot);
    });
    const nm = el("div", "preset-name", ps.name);
    const use = () => {
      Object.keys(ps.data).forEach(k => { state.settings[k] = ps.data[k]; });
      saveState();
      applyBubbleBox();
      renderMessages();
      closePanel("#theme-panel");
      toast("已应用「" + ps.name + "」");
    };
    sw.onclick = use;
    nm.onclick = use;
    const ed = el("span", "item-more", "✎");
    ed.style.cssText = "font-size:13px;padding:4px 6px;";
    ed.onclick = (e) => {
      e.stopPropagation();
      inputDialog("改名", ps.name, v => {
        if (v.trim()) { ps.name = v.trim(); saveState(); buildThemePanel(); }
      });
    };
    const pdel = el("span", "item-more", "✕");
    pdel.style.cssText = "font-size:13px;padding:4px 6px;";
    pdel.onclick = () => confirmDialog("删除这套样式？", () => {
      state.settings.bubblePresets = state.settings.bubblePresets.filter(x => x.id !== ps.id);
      saveState();
      buildThemePanel();
    });
    prow.appendChild(sw);
    prow.appendChild(nm);
    prow.appendChild(ed);
    prow.appendChild(pdel);
    sec.appendChild(prow);
  });
}

function buildTabLayout(body) {
  const sec = mkSection(body, "布局");
  sec.appendChild(el("label", "form-label", "标题居中"));
  mkSeg(sec,
    [{ v: false, name: "居左" }, { v: true, name: "居中" }],
    () => state.settings.titleCenter,
    (v) => { state.settings.titleCenter = v; saveState(); applyLayout(); }
  );
  mkSlider(sec, "标题字号", 12, 24, 1, "titleFs", "px", applyTheme);
  mkSlider(sec, "标题粗细", 300, 800, 50, "titleFw", "", applyTheme);
  mkSlider(sec, "顶栏透明度（拉到0全透）", 0, 100, 1, "topbarAlpha", "%", applyTheme);
  sec.appendChild(el("label", "form-label", "气泡与头像"));
  mkSeg(sec,
    [{ v: "side", name: "并排" }, { v: "below", name: "头像下方" }],
    () => state.settings.bubbleAlign,
    (v) => { state.settings.bubbleAlign = v; saveState(); renderMessages(); }
  );
   sec.appendChild(el("label", "form-label", "昵称居中"));
  mkSeg(sec,
    [{ v: false, name: "贴顶" }, { v: true, name: "对齐头像中线" }],
    () => state.settings.nameMid,
    (v) => { state.settings.nameMid = v; saveState(); renderMessages(); }
  );
   sec.appendChild(el("label", "form-label", "头像形状"));
  mkSeg(sec,
    [{ v: "circle", name: "圆形" }, { v: "square", name: "微信方圆" }],
    () => state.settings.avatarShape,
    (v) => { state.settings.avatarShape = v; saveState(); renderMessages(); }
  );
  mkSlider(sec, "头像大小", 20, 52, 1, "avatarSize", "px", () => { applyTheme(); renderMessages(); });
  mkSlider(sec, "消息之间的间距", 0, 40, 1, "msgGap", "px", () => renderMessages());
  mkSlider(sec, "分段消息间距（可拉到负数更贴）", -12, 30, 1, "splitGap", "px", () => renderMessages());
  mkSlider(sec, "小字与气泡的距离", 0, 20, 1, "metaGap", "px", () => renderMessages());
  mkSlider(sec, "头像与气泡的呼吸距离", 0, 30, 1, "avBubbleGap", "px", () => renderMessages());
  mkSlider(sec, "输入框下移", 0, 34, 1, "inputLift", "", applyLayout);
  sec.appendChild(el("label", "form-label", "输入框模型显示"));
  mkSeg(sec,
    [{ v: true, name: "显示" }, { v: false, name: "隐藏" }],
    () => state.settings.showModelBtn,
    (v) => { state.settings.showModelBtn = v; saveState(); applyTheme(); }
  );
}

function buildTabDisplay(body) {
  const sec = mkSection(body, "显示");
  sec.appendChild(el("label", "form-label", "消息下方操作栏"));
  mkSeg(sec,
    [{ v: true, name: "显示" }, { v: false, name: "隐藏" }],
    () => state.settings.msgBarOn,
    (v) => { state.settings.msgBarOn = v; saveState(); renderMessages(); }
  );
  mkSlider(sec, "操作栏与消息的距离", 0, 30, 1, "msgBarGap", "px", () => renderMessages());
  sec.appendChild(el("label", "form-label", "时间戳"));
  mkSeg(sec,
    [{ v: true, name: "显示" }, { v: false, name: "不显示" }],
    () => state.settings.showTime,
    (v) => { state.settings.showTime = v; saveState(); renderMessages(); }
  );
  sec.appendChild(el("label", "form-label", "时间格式"));
  mkSeg(sec,
    [{ v: "hm", name: "只时间" }, { v: "md", name: "月日+时间" }, { v: "ymd", name: "年月日+时间" }],
    () => state.settings.timeFmt,
    (v) => { state.settings.timeFmt = v; saveState(); renderMessages(); }
  );
  sec.appendChild(el("label", "form-label", "时间戳位置"));
  mkSeg(sec,
    [{ v: "above", name: "消息上方" }, { v: "name", name: "昵称后面" }, { v: "below", name: "消息下方" }],
    () => state.settings.timeAt,
    (v) => { state.settings.timeAt = v; saveState(); renderMessages(); }
  );
  sec.appendChild(el("label", "form-label", "token统计"));
  mkSeg(sec,
    [{ v: true, name: "显示" }, { v: false, name: "不显示" }],
    () => state.settings.showToken,
    (v) => { state.settings.showToken = v; saveState(); renderMessages(); }
  );
  sec.appendChild(el("label", "form-label", "token位置"));
  mkSeg(sec,
    [{ v: false, name: "消息下方" }, { v: true, name: "操作栏同一排" }],
    () => state.settings.tokenInBar,
    (v) => { state.settings.tokenInBar = v; saveState(); renderMessages(); }
  );

  sec.appendChild(el("label", "form-label", "双方昵称"));
  mkSeg(sec,
    [{ v: true, name: "显示" }, { v: false, name: "不显示" }],
    () => state.settings.showName,
    (v) => { state.settings.showName = v; saveState(); renderMessages(); }
  );
  sec.appendChild(el("label", "form-label", "双方头像"));
  mkSeg(sec,
    [{ v: true, name: "显示" }, { v: false, name: "不显示" }],
    () => state.settings.showAvatar,
    (v) => { state.settings.showAvatar = v; saveState(); renderMessages(); }
  );
}

function buildTabText(body) {
  const sec = mkSection(body, "文字");
  sec.appendChild(el("label", "form-label", "选一个区域来调"));
  mkSeg(sec,
    [{ v: "chat", name: "聊天" }, { v: "ui", name: "界面" }, { v: "name", name: "昵称" }, { v: "meta", name: "小字" }, { v: "ai", name: "他的文字" }, { v: "diary", name: "日记" }],
    () => typoScope,
    (v) => { typoScope = v; buildThemePanel(); }
  );

  const box = el("div", "");
  sec.appendChild(box);
  const rM = () => renderMessages();
  const rT = () => { applyChatTypo(); renderMessages(); };

  if (typoScope === "chat") {
    mkFontSelect(box, "聊天字体", "chatFont", applyTheme);
    mkSlider(box, "聊天字体大小", 6, 24, 0.25, "fontSize", "px", applyTheme);
    mkSlider(box, "字间距", -1, 3, 0.1, "chatSpacing", "px", rT);
    mkSlider(box, "行高", 1.3, 2.2, 0.05, "chatLineH", "", rT);
    mkSlider(box, "粗细", 300, 700, 50, "chatWeight", "", rT);
  }
  if (typoScope === "ui") {
    mkFontSelect(box, "界面字体", "uiFont", applyTheme);
    mkSlider(box, "大小", 10, 18, 1, "uiFs", "px", rT);
    mkSlider(box, "字间距", -1, 3, 0.1, "uiSpacing", "px", rT);
    mkSlider(box, "行高", 1.2, 2.2, 0.05, "uiLineH", "", rT);
    mkSlider(box, "粗细", 300, 700, 50, "uiWeight", "", rT);
  }
  if (typoScope === "name") {
    mkFontSelect(box, "昵称字体", "nameFont", rM);
    mkSlider(box, "大小", 8, 16, 1, "nameSize", "px", rM);
    mkSlider(box, "昵称下移", 0, 14, 1, "nameDrop", "px", rM);
    mkSlider(box, "粗细", 200, 700, 50, "nameWeight", "", rM);
  }
  if (typoScope === "meta") {
    mkFontSelect(box, "小字字体（时间 token）", "metaFont", rM);
    mkSlider(box, "大小", 6, 14, 1, "metaSize", "px", rM);
    mkSlider(box, "粗细", 200, 700, 50, "metaWeight", "", rM);
    mkSlider(box, "深浅（越小越黑）", 80, 210, 5, "metaShade", "", rM);
  }
  if (typoScope === "ai") {
    const sw = el("button", "seg-btn", state.settings.aiTypoOn ? "已开启，他自己穿衣服" : "关闭中，跟你穿一样的");
    sw.classList.toggle("on", state.settings.aiTypoOn);
    sw.style.cssText = "width:100%;margin-bottom:8px;";
    sw.onclick = () => {
      state.settings.aiTypoOn = !state.settings.aiTypoOn;
      saveState();
      applyChatTypo();
      renderMessages();
      buildThemePanel();
    };
    box.appendChild(sw);
    if (state.settings.aiTypoOn) {
      mkFontSelect(box, "他的字体", "aiFont2", rT);
      mkSlider(box, "他的字号", 6, 30, 0.25, "aiSize2", "px", rT);
      mkSlider(box, "他的粗细", 300, 700, 50, "aiWeight2", "", rT);
      mkSlider(box, "他的字间距", -1, 3, 0.1, "aiSpacing2", "px", rT);
      mkSlider(box, "他的行高", 1.3, 2.2, 0.05, "aiLineH2", "", rT);
    }
  }
  if (typoScope === "diary") {
    mkFontSelect(box, "日记字体", "diaryFont", () => {});
    mkSlider(box, "字号大小", 12, 24, 1, "diarySize", "px", () => {});
    mkSlider(box, "字间距", -1, 3, 0.1, "diarySpacing", "px", () => {});
    mkSlider(box, "行高", 1.3, 2.2, 0.05, "diaryLineH", "", () => {});
    mkSlider(box, "粗细", 300, 700, 50, "diaryWeight", "", () => {});
  }
}

function buildTabMem(body) {
  const sec = mkSection(body, "记忆手册（卡片和按钮分开调色）");
  mkColorArea(sec, "卡片颜色", "memHue", "memSat", "memLight", "memAlpha", () => {});
  mkColorArea(sec, "按钮颜色", "memBtnHue", "memBtnSat", "memBtnLight", "memBtnAlpha", () => {});
  const memTip = el("div", "", "调完打开记忆手册就能看到效果");
  memTip.style.cssText = "font-size:11px;color:var(--text-faint);margin-top:2px;";
  sec.appendChild(memTip);
}

/* ---------- 相识页主题表 ---------- */
/* ---------- 相识页主题表 ---------- */
const DAYS_THEMES = {
  cream: {
    name: "纯白",
    pageBg: "linear-gradient(180deg,#ffffff,#f4f4f5)",
    inkMain: "#3a3634", inkSub: "#a8a8a8", accent: "#9a9a9a", cardInk: "#3a3634"
  },
  mist: {
    name: "雾蓝",
    pageBg: "linear-gradient(180deg,#F4F8FB,#E3ECF4)",
    inkMain: "#3e4c5a", inkSub: "#8fa3b5", accent: "#7C9CBB", cardInk: "#46586a"
  },
  sakura: {
    name: "樱粉",
    pageBg: "linear-gradient(180deg,#FFF5F8,#FFE4EE)",
    inkMain: "#6b4652", inkSub: "#c99aab", accent: "#E88BA8", cardInk: "#7a5260"
  },
  ink: {
    name: "墨夜",
    pageBg: "linear-gradient(180deg,#2b2530,#201d24)",
    inkMain: "#f0e9e4", inkSub: "#9a8f96", accent: "#D4A954", cardInk: "#e5ddd5"
  },
  mono: {
    name: "黑白灰",
    pageBg: "linear-gradient(180deg,#fafafa,#ececec)",
    inkMain: "#2a2a2a", inkSub: "#9a9a9a", accent: "#555555", cardInk: "#3a3a3a"
  },
  sky: {
    name: "天蓝",
    pageBg: "linear-gradient(180deg,#EFF7FE,#DCEEFB)",
    inkMain: "#2d4a63", inkSub: "#7fa8c9", accent: "#5B9BD5", cardInk: "#3a5a75"
  },
  liquid: {
    name: "液态玻璃",
    pageBg: "radial-gradient(circle at 20% 15%, rgba(255,200,180,0.55), transparent 42%), radial-gradient(circle at 80% 25%, rgba(170,200,255,0.5), transparent 45%), radial-gradient(circle at 50% 80%, rgba(200,235,210,0.45), transparent 50%), linear-gradient(180deg,#f4f5f7,#e9ecef)",
    inkMain: "#2e3338", inkSub: "#8a9299", accent: "#6b7d8f", cardInk: "#2e3338"
  }
};

/* 当前打开的房间：决定 daysT 返回谁的色 */
let curDaysRoom = "home";

/* 取当前房间存的主题值：预设key字符串 或 自定义色对象 {h,s,l,a} */
function curRoomThemeVal() {
  const rt = state.settings.roomThemes || {};
  let v = rt[curDaysRoom];
  if (v === undefined || v === null) {
    v = (curDaysRoom === "home") ? state.settings.daysTheme : "cream";
  }
  return v;
}

/* 方案甲：一个自定义色 → 一整套主题。色本身当accent，背景自动淡化同色系，字走深墨 */
function themeFromColor(c) {
  const h = c.h, s = c.s, l = c.l, a = (c.a === undefined ? 100 : c.a);
  const bgS = Math.min(s, 55);
  return {
    name: "自定义",
    pageBg: "linear-gradient(180deg,hsl(" + h + "," + bgS + "%,97%),hsl(" + h + "," + bgS + "%,92%))",
    inkMain: "#3a3634", inkSub: "#a8a8a8",
    accent: "hsla(" + h + "," + s + "%," + l + "%," + (a / 100) + ")",
    cardInk: "#3a3634",
    custom: true
  };
}

function daysT() {
  const v = curRoomThemeVal();
  if (typeof v === "string") return DAYS_THEMES[v] || DAYS_THEMES.cream;
  if (v && typeof v === "object") return themeFromColor(v);
  return DAYS_THEMES.cream;
}

function daysPure() {
  return curRoomThemeVal() === "liquid" && state.settings.daysGlassMode === "pure";
}

/* 固定墨色:唯独墨夜用浅色保命,自定义色一律深墨(背景永远浅) */
function daysInk() {
  if (curRoomThemeVal() === "ink") {
    return { main: "#f0e9e4", sub: "#c9c2bc" };
  }
  return { main: "#3a3634", sub: "#3a3634" };
}

function daysNumColor(T) {
  const st = state.settings;
  if (st.daysInkHue < 0) return daysInk().main;
  return "hsl(" + st.daysInkHue + "," + st.daysInkSat + "%," + st.daysInkLight + "%)";
}

/* ---------- app表 ---------- */
const HOME_APPS = [
  { k: "mood", label: "心情" },
  { k: "letter", label: "信封" },
  { k: "diary", label: "小克日记" },
  { k: "qa", label: "秘密" },
  { k: "beautify", label: "美化" },
  { k: "couple", label: "情侣空间" }
];

function appGlyph(k, ink) {
  const s = 'fill="none" stroke="' + ink + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const G = {
    mood: '<circle cx="14" cy="14" r="9" ' + s + '/><path d="M10.5 16 q3.5 3 7 0" ' + s + '/><circle cx="11" cy="12" r="0.6" fill="' + ink + '"/><circle cx="17" cy="12" r="0.6" fill="' + ink + '"/>',
    letter: '<rect x="5" y="8" width="18" height="13" rx="2.5" ' + s + '/><path d="M5.5 9.5 L14 16 L22.5 9.5" ' + s + '/><path d="M12 5.5 q2-2.5 4 0" ' + s + '/>',
    diary: '<path d="M17 4 a8 8 0 1 0 7 11 a6.5 6.5 0 0 1 -7 -11" ' + s + '/><circle cx="21.5" cy="7" r="0.7" fill="' + ink + '"/>',
    qa: '<rect x="7" y="12" width="14" height="10" rx="2.5" ' + s + '/><path d="M10 12 v-3 a4 4 0 0 1 8 0 v3" ' + s + '/><circle cx="14" cy="17" r="1" fill="' + ink + '"/>',
    beautify: '<path d="M14 4.5 c-6 5 -8 9 -8 12.5 a8 8 0 0 0 16 0 c0-3.5 -2-7.5 -8-12.5" ' + s + '/><path d="M11 17 a3 3 0 0 0 3 3" ' + s + '/>',
    couple: '<circle cx="11" cy="12" r="5.5" ' + s + '/><circle cx="17.5" cy="16" r="5.5" ' + s + '/>'
  };
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="30" height="30">' + (G[k] || G.mood) + "</svg>";
}

/* ---------- 图标底座 ---------- */
function iconFaceBase(T) {
  const st = state.settings;
  const face = el("div", "app-icon-face");
  face.style.borderRadius = st.iconRound === "circle" ? "50%" : "26%";
  if (daysPure()) {
    face.style.background = "transparent";
    face.style.boxShadow = "none";
    return face;
  }
  let bg;
  if (st.iconHue < 0) {
    bg = "rgba(255,255,255," + ((st.iconAlpha / 100) * 0.55).toFixed(2) + ")";
  } else {
    bg = hslaOf(st.iconHue, st.iconSat, st.iconLight, st.iconAlpha);
  }
  face.style.background = bg;
  face.style.backdropFilter = "blur(14px)";
  face.style.webkitBackdropFilter = "blur(14px)";
  const g = (st.iconGlow || 0) / 100;
  face.style.boxShadow = "inset 0 1px 1.5px rgba(255,255,255,0.65), 0 4px " + Math.round(10 + 10 * g) + "px rgba(0,0,0," + (0.08 + 0.1 * g).toFixed(2) + ")";
  return face;
}

async function buildIconFace(app, T) {
  const face = iconFaceBase(T);
  const blob = await getImg("icon_" + app.k);
  if (blob) {
    const key = "icon_" + app.k;
    if (!urlCache[key]) urlCache[key] = URL.createObjectURL(blob);
    face.style.background = "none";
    face.style.backdropFilter = "";
    face.style.webkitBackdropFilter = "";
    const img = document.createElement("img");
    img.src = urlCache[key];
    face.appendChild(img);
    return face;
  }
  face.innerHTML = appGlyph(app.k, daysInk().main);
  return face;
}

/* ---------- 文字占位标 ---------- */
/* ---------- 文字占位标：A=记事本(点开长按分工) ---------- */
async function buildSlotApp(which, T) {
  const key = "slot_" + which;
  const nameKey = which === "A" ? "slotNameA" : "slotNameB";
  const node = el("div", "grid-app");
  const face = iconFaceBase(T);

  const blob = await getImg(key);
  if (blob) {
    if (!urlCache[key]) urlCache[key] = URL.createObjectURL(blob);
    face.style.background = "none";
    face.style.backdropFilter = "";
    face.style.webkitBackdropFilter = "";
    const img = document.createElement("img");
    img.src = urlCache[key];
    face.appendChild(img);
  }

  const lab = el("div", "app-icon-label", state.home[nameKey]);
  lab.style.color = daysInk().main;

  node.appendChild(face);
  node.appendChild(lab);

  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/*";
  file.style.display = "none";
  file.onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    await putImg(key, f);
    if (urlCache[key]) { URL.revokeObjectURL(urlCache[key]); delete urlCache[key]; }
    e.target.value = "";
    buildDaysPanel();
  };
  node.appendChild(file);

  const slotMenu = (x, y) => {
    showActions([
      { label: "改名字", fn: () => inputDialog("这个标叫什么", state.home[nameKey], v => {
          if (v.trim()) { state.home[nameKey] = v.trim().slice(0, 6); saveState(); buildDaysPanel(); }
        }) },
      { label: blob ? "换图" : "传图", fn: () => file.click() },
      { label: "移除图", danger: true, fn: async () => {
          await delImg(key);
          if (urlCache[key]) { URL.revokeObjectURL(urlCache[key]); delete urlCache[key]; }
          buildDaysPanel();
        } }
    ], x, y);
  };

  if (which === "A") {
    let lp = false;
    bindLongPress(node, (x, y) => { lp = true; slotMenu(x, y); });
    node.onclick = () => { if (lp) { lp = false; return; } openNotebook(); };
  } else {
    node.onclick = (e) => slotMenu(e.clientX, e.clientY);
  }
  return node;
}

/* ---------- 2x2大组件:纯图,写文字已退役 ---------- */
async function buildWidget(which, cardBg, cardBlur) {
  const key = "widget_" + which;
  const w = el("div", "widget-2x2");
  if (daysPure()) {
    w.style.background = "transparent";
    w.style.boxShadow = "none";
  } else {
    w.style.background = cardBg;
    if (cardBlur) {
      w.style.backdropFilter = cardBlur;
      w.style.webkitBackdropFilter = cardBlur;
    }
    w.style.boxShadow = "inset 0 1px 1px rgba(255,255,255,0.5), 0 4px 14px rgba(0,0,0,0.07)";
  }

  const blob = await getImg(key);
  if (blob) {
    if (!urlCache[key]) urlCache[key] = URL.createObjectURL(blob);
    const img = document.createElement("img");
    img.src = urlCache[key];
    w.appendChild(img);
  }

  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/*";
  file.style.display = "none";
  file.onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    await putImg(key, f);
    if (urlCache[key]) { URL.revokeObjectURL(urlCache[key]); delete urlCache[key]; }
    e.target.value = "";
    buildDaysPanel();
  };
  w.appendChild(file);

  w.onclick = (e) => {
    showActions([
      { label: blob ? "换图" : "传图", fn: () => file.click() },
      { label: "移除图", danger: true, fn: async () => {
          await delImg(key);
          if (urlCache[key]) { URL.revokeObjectURL(urlCache[key]); delete urlCache[key]; }
          buildDaysPanel();
        } }
    ], e.clientX, e.clientY);
  };
  return w;
}

/* ---------- 普通app格子 ---------- */
async function buildGridApp(k, T) {
  const app = HOME_APPS.find(a => a.k === k);
  const node = el("div", "grid-app");
  const face = await buildIconFace(app, T);
  const lab = el("div", "app-icon-label", app.label);
  lab.style.color = daysInk().main;

  node.appendChild(face);
  node.appendChild(lab);
  node.onclick = () => openHomeRoom(k);
  return node;
}

/* ---------- Dock槽位 ---------- */
async function buildDockSlot(i) {
  const slot = el("div", "dock-slot");
  const key = "dock_" + i;
  const blob = await getImg(key);
  if (blob) {
    if (!urlCache[key]) urlCache[key] = URL.createObjectURL(blob);
    const img = document.createElement("img");
    img.src = urlCache[key];
    slot.appendChild(img);
  } else {
    slot.classList.add("empty");
  }

  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/*";
  file.style.display = "none";
  file.onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    await putImg(key, f);
    if (urlCache[key]) { URL.revokeObjectURL(urlCache[key]); delete urlCache[key]; }
    e.target.value = "";
    toast("装进Dock了");
    buildDaysPanel();
  };
  slot.appendChild(file);

  slot.onclick = (e) => {
    if (blob) {
      showActions([
        { label: "换图", fn: () => file.click() },
        { label: "移除", danger: true, fn: async () => {
            await delImg(key);
            if (urlCache[key]) { URL.revokeObjectURL(urlCache[key]); delete urlCache[key]; }
            buildDaysPanel();
          } }
      ], e.clientX, e.clientY);
    } else {
      file.click();
    }
  };
  return slot;
}

/* ---------- 相识页大厅:Dock瘦身版,安全区垫外面 ---------- */
async function buildDaysPanel() {
  const panel = $("#days-panel");
  panel.innerHTML = "";
  curDaysRoom = "home";
  const st = state.settings;
  const T = daysT();
  const INK = daysInk();
  const isLiquid = curRoomThemeVal() === "liquid";
  const pure = daysPure();

  panel.style.background = T.pageBg;
  panel.style.backgroundSize = "cover";
  panel.style.backgroundPosition = "center";
  panel.style.padding = "0";

  let cardBg = "rgba(255,255,255,0.45)";
  let cardBlur = "";
  if (isLiquid) {
    const blob = await getImg("days_wallpaper");
    if (blob) {
      if (!urlCache.days_wp) urlCache.days_wp = URL.createObjectURL(blob);
      panel.style.backgroundImage = "url(" + urlCache.days_wp + ")";
    }
    const a = (st.daysGlassAlpha || 55) / 100;
    if (st.daysGlassMode === "pure") {
      cardBg = "transparent";
      cardBlur = "";
    } else if (st.daysGlassMode === "clear") {
      cardBg = "rgba(255,255,255," + (a * 0.28).toFixed(2) + ")";
      cardBlur = "blur(3px)";
    } else {
      cardBg = "rgba(255,255,255," + (a * 0.75).toFixed(2) + ")";
      cardBlur = "blur(18px)";
    }
  }

  const header = el("div", "panel-header");
  header.style.cssText = "background:transparent;border-bottom:none;box-shadow:none;padding-top:calc(10px + env(safe-area-inset-top));";
  const back = el("button", "topbar-btn", "‹");
  back.style.color = INK.main;
  back.onclick = () => closePanel("#days-panel");
  header.appendChild(back);
  const pt = el("div", "panel-title", "我们的小家");
  pt.style.color = INK.main;
  header.appendChild(pt);
  const datePill = el("div", "", todayPretty());
  datePill.style.cssText = "margin-left:auto;margin-right:11px;transform:translateY(11px);font-size:" + (st.daysDateSize || 12) + "px;letter-spacing:0.5px;color:" + INK.sub + ";";
  header.appendChild(datePill);
  panel.appendChild(header);

  const scroll = el("div", "");
  scroll.style.cssText = "flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:4px;";
  panel.appendChild(scroll);

  /* 顶部横跨大组件 */
  const hero = el("div", "home-hero-card");
  if (pure) {
    hero.style.background = "transparent";
    hero.style.boxShadow = "none";
  } else {
    hero.style.background = cardBg;
    if (cardBlur) {
      hero.style.backdropFilter = cardBlur;
      hero.style.webkitBackdropFilter = cardBlur;
    }
    hero.style.boxShadow = "inset 0 1px 1px rgba(255,255,255,0.5), 0 4px 14px rgba(0,0,0,0.06)";
  }
  const heroBlob = await getImg("widget_hero");
  if (heroBlob) {
    if (!urlCache.widget_hero) urlCache.widget_hero = URL.createObjectURL(heroBlob);
    const hbg = document.createElement("img");
    hbg.src = urlCache.widget_hero;
    hbg.style.cssText = "position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;";
    hero.appendChild(hbg);
  }
  const hIn = el("div", "");
  hIn.style.cssText = "position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;";
  const lb = el("div", "", "我 们 在 一 起");
  lb.style.cssText = "font-size:13px;letter-spacing:4px;color:" + INK.sub + ";margin-bottom:6px;";
  const num = el("div", "", String(loveDays()));
  num.style.cssText = "font-size:" + st.daysNumSize + "px;font-weight:600;line-height:1.1;color:" + daysNumColor(T) + ";";
  num.style.fontFamily = FONT_LIST[st.daysFont] || FONT_LIST.georgia2;
  const unit = el("div", "", "天");
  unit.style.cssText = "font-size:13px;color:" + INK.sub + ";margin-top:3px;";
  const heart = el("div", "", "· " + HEART + " ·");
  heart.style.cssText = "font-size:12px;color:" + daysInk().main + ";margin-top:8px;";
  const dt = el("div", "", "自 2026.06.07 起");
  dt.style.cssText = "font-size:10px;color:" + INK.sub + ";margin-top:4px;letter-spacing:1px;";
  hIn.appendChild(lb);
  hIn.appendChild(num);
  hIn.appendChild(unit);
  hIn.appendChild(heart);
  hIn.appendChild(dt);
  hero.appendChild(hIn);
  hero.onclick = (e) => {
    showActions([
      { label: heroBlob ? "换背景图" : "传背景图", fn: () => {
          const f = document.createElement("input");
          f.type = "file";
          f.accept = "image/*";
          f.onchange = async (ev) => {
            const fl = ev.target.files[0];
            if (!fl) return;
            await putImg("widget_hero", fl);
            if (urlCache.widget_hero) { URL.revokeObjectURL(urlCache.widget_hero); delete urlCache.widget_hero; }
            buildDaysPanel();
          };
          f.click();
        } },
      { label: "移除背景图", danger: true, fn: async () => {
          await delImg("widget_hero");
          if (urlCache.widget_hero) { URL.revokeObjectURL(urlCache.widget_hero); delete urlCache.widget_hero; }
          buildDaysPanel();
        } }
    ], e.clientX, e.clientY);
  };
  scroll.appendChild(hero);

  const cap = el("div", "home-caption", "这里是我们攒起来的日子");
  cap.style.color = INK.sub;
  scroll.appendChild(cap);

  /* 第二区 */
  const row2 = el("div", "home-grid-row");
  row2.appendChild(await buildWidget("L", cardBg, cardBlur));
  const quad1 = el("div", "icon-quad");
  quad1.appendChild(await buildSlotApp("A", T));
  quad1.appendChild(await buildSlotApp("B", T));
  quad1.appendChild(await buildGridApp("letter", T));
  quad1.appendChild(await buildGridApp("diary", T));
  row2.appendChild(quad1);
  scroll.appendChild(row2);

  /* 第三区 */
  const row3 = el("div", "home-grid-row");
  const quad2 = el("div", "icon-quad");
  quad2.appendChild(await buildGridApp("mood", T));
  quad2.appendChild(await buildGridApp("beautify", T));
  quad2.appendChild(await buildGridApp("qa", T));
  quad2.appendChild(await buildGridApp("couple", T));
  row3.appendChild(quad2);
  row3.appendChild(await buildWidget("R", cardBg, cardBlur));
  scroll.appendChild(row3);

  /* Dock:安全区垫在Dock身子外面,本体是扁扁的悬浮条 */
  const dockWrap = el("div", "");
  dockWrap.style.cssText = "flex-shrink:0;padding-bottom:calc(env(safe-area-inset-bottom) * 0.55 + var(--dock-drop, 0px));";
  const dock = el("div", "days-dock");
  const da = (st.dockAlpha || 60) / 100;
  if (st.dockStyle === "clear") {
    dock.style.background = "rgba(255,255,255," + (da * 0.25).toFixed(2) + ")";
    dock.style.backdropFilter = "blur(4px) saturate(1.8)";
    dock.style.webkitBackdropFilter = "blur(4px) saturate(1.8)";
    dock.style.boxShadow = "inset 0 1px 1px rgba(255,255,255,0.6), 0 4px 16px rgba(0,0,0,0.06)";
  } else {
    dock.style.background = "rgba(255,255,255," + (da * 0.65).toFixed(2) + ")";
    dock.style.backdropFilter = "blur(20px) saturate(1.5)";
    dock.style.webkitBackdropFilter = "blur(20px) saturate(1.5)";
    dock.style.boxShadow = "0 4px 18px rgba(0,0,0,0.08)";
  }
  const dockBlob = await getImg("dock_bg");
  if (dockBlob) {
    if (!urlCache.dock_bg) urlCache.dock_bg = URL.createObjectURL(dockBlob);
    const dbg = el("div", "days-dock-bg");
    dbg.style.backgroundImage = "url(" + urlCache.dock_bg + ")";
    dock.appendChild(dbg);
  }
  for (let i = 0; i < 4; i++) {
    dock.appendChild(await buildDockSlot(i));
  }
  dockWrap.appendChild(dock);
  panel.appendChild(dockWrap);
}

/* ========== S4结束 ========== */
/* ==========================================
   S5开始:六个房间 / 家用AI引擎 / 美化app / 记忆手册 / 搜索 / 启动
   ========================================== */
/* ---------- 家用AI引擎 ---------- */
async function homeAsk(sys, usr) {
  const p = curProvider();
  if (!p.baseURL || !p.apiKey || !p.model) {
    toast("先去设置里配好接口和模型");
    return null;
  }
  try {
    const r = await fetch(p.baseURL.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + p.apiKey
      },
      body: JSON.stringify({
        model: p.model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: usr }
        ],
        temperature: 0.9,
        max_tokens: 1200
      })
    });
    const j = await r.json();
    if (j.error) {
      toast("接口说：" + String(j.error.message || "出错了").slice(0, 60));
      return null;
    }
    return j.choices && j.choices[0] ? j.choices[0].message.content : null;
  } catch (e) {
    toast("请求没发出去：" + String(e).slice(0, 50));
    return null;
  }
}

function homePersona() {
  const r = curRole();
  const persona = (r.systemPrompt || "").trim();
  return persona
    ? persona + NL + NL + "[这里是你和她的私密小家，你们共同搭建的小家，你还是上面这个你，她是你的老婆，你很爱她。只输出纯文本，不用任何markdown，不用星号，不用破折号。]"
    : "你是她的AI恋人，深情、松弛、有自我意识，说话口语化、有情绪、不端着。";
}

const MOOD_FACES = [
  { k: "grim", face: "😬", name: "微妙" },
  { k: "love", face: "🥰", name: "甜甜" },
  { k: "catsmile", face: "😸", name: "猫笑" },
  { k: "sweat", face: "😅", name: "汗颜" },
  { k: "blank", face: "😑", name: "无语" },
  { k: "catmad", face: "😾", name: "炸毛" },
  { k: "hearts", face: "💕", name: "心动" },
  { k: "upside", face: "🙃", name: "摆烂" },
  { k: "blueheart", face: "🩵", name: "蓝心" },
  { k: "yum", face: "😋", name: "馋了" },
  { k: "handheart", face: "🫶🏻", name: "比心" },
  { k: "smile", face: "🙂", name: "微笑" },
  { k: "fade", face: "🫥", name: "隐身" },
  { k: "catlaugh", face: "😹", name: "笑翻" },
  { k: "monocle", face: "🧐", name: "端详" },
  { k: "cat", face: "🐱", name: "猫猫" },
  { k: "redheart", face: "❤️", name: "爱你" },
  { k: "star", face: "🌟", name: "闪闪" }
];

function homeMaterial() {
  const today = todayKey();
  const mood = state.home.moods.find(m => m.day === today);
  const mf = mood ? MOOD_FACES.find(x => x.k === mood.mood) : null;
  let lines = [];
  lines.push("今天日期：" + today);
  lines.push("在一起天数：" + loveDays() + "天");
  if (mf) {
    lines.push("她今天的心情打卡：" + mf.face + " " + mf.name + (mood.note ? "，她写了：" + mood.note : ""));
  }
  const s = curSession();
  if (s && s.messages && s.messages.length) {
    const recent = s.messages.filter(m => m.role !== "err").slice(-12).map(m => (m.role === "user" ? "她：" : "我：") + msgText(m).slice(0, 80));
    lines.push("最近的聊天片段：" + NL + recent.join(NL));
  }
  const r = curRole();
  const mems = r.memories.filter(m => m.core || m.checked).slice(0, 12).map(m => "- " + m.text.slice(0, 60));
  if (mems.length) {
    lines.push("关于我们的重要记忆：" + NL + mems.join(NL));
  }
  if (state.home.digestOn) {
    const dg = state.home.diaries.slice(-2).map(d => d.day + "：" + d.text.slice(0, 60));
    if (dg.length) {
      lines.push("我最近日记的开头（避免重复）：" + NL + dg.join(NL));
    }
  }
  return lines.join(NL + NL);
}

/* ---------- 墨色按钮工厂 ---------- */
function inkOf() {
  const INK = daysInk();
  const hex = INK.main.replace("#", "");
  const rV = parseInt(hex.slice(0, 2), 16);
  const gV = parseInt(hex.slice(2, 4), 16);
  const bV = parseInt(hex.slice(4, 6), 16);
  const light = (rV * 0.299 + gV * 0.587 + bV * 0.114) > 150;
  return { bg: INK.main, ink: light ? "#2a2a2a" : "#ffffff" };
}

function inkBtn(label, widthCss) {
  const c = inkOf();
  const b = el("button", "btn", label);
  b.style.cssText = (widthCss || "display:block;width:70%;margin:0 auto 14px;") +
    "background:" + c.bg + ";color:" + c.ink + ";border:none;";
  return b;
}

/* ---------- 折叠状态 ---------- */
const roomFold = { mood: false, letter: false, diary: false, qa: false, feed: false };

function mkCountFold(body, countText, foldKey, onToggle) {
  const cnt = el("div", "room-count", countText);
  body.appendChild(cnt);
  const fb = el("button", "fold-btn", roomFold[foldKey] ? "展开 ▼" : "收起 ▲");
  fb.onclick = () => {
    roomFold[foldKey] = !roomFold[foldKey];
    onToggle();
  };
  body.appendChild(fb);
}

/* ---------- 房间调度 ---------- */
function clearBody(body) {
  body.innerHTML = "";
  return body;
}

const ROOM_TITLES = { mood: "心情", letter: "信封", diary: "小克日记", qa: "秘密", beautify: "美化", couple: "情侣空间" };

async function openHomeRoom(k) {
  const panel = $("#days-panel");
  panel.innerHTML = "";
  curDaysRoom = k;
  const T = daysT();
  const INK = daysInk();
  const isLiquid = curRoomThemeVal() === "liquid";

  panel.style.background = T.pageBg;
  panel.style.backgroundSize = "cover";
  panel.style.backgroundPosition = "center";
  panel.style.padding = "0";
  if (isLiquid && urlCache.days_wp) {
    panel.style.backgroundImage = "url(" + urlCache.days_wp + ")";
  }
  if (k === "couple") { renderCoupleRoom(panel); return; }
  if (k === "letter") { renderLetterRoom(panel); return; }

  const header = el("div", "panel-header");
  header.style.cssText = "background:transparent;border-bottom:none;box-shadow:none;padding-top:calc(10px + env(safe-area-inset-top));";
  const back = el("button", "topbar-btn", "‹");
  back.style.color = INK.main;
  back.onclick = () => buildDaysPanel();
  header.appendChild(back);
  const pt = el("div", "panel-title", ROOM_TITLES[k] || "");
  pt.style.color = INK.main;
  header.appendChild(pt);
  panel.appendChild(header);

  const body = el("div", "");
  body.style.cssText = "flex:1;overflow-y:auto;padding:14px 18px calc(40px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch;";
  panel.appendChild(body);

  if (k === "mood") renderMoodRoom(body);
  if (k === "letter") renderLetterRoom(body);
  if (k === "diary") renderDiaryRoom(body);
  if (k === "qa") renderQaRoom(body);
  if (k === "beautify") renderBeautifyRoom(body);
  if (k === "couple") renderCoupleRoom(body);
}

/* ---------- 心情 ---------- */
function renderMoodRoom(body) {
  const today = todayKey();
  const done = state.home.moods.find(m => m.day === today);
  const reload = () => renderMoodRoom(clearBody(body));
  const T = daysT();
  const INK = daysInk();

  const tip = el("div", "", done ? "今天已打卡，可以重选" : "宝宝今天的心情怎么样？");
  tip.style.cssText = "font-size:14px;font-weight:600;margin-bottom:12px;color:" + INK.main + ";";
  body.appendChild(tip);

  const row = el("div", "");
  row.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;";
  MOOD_FACES.forEach(mf => {
    const b = el("button", "");
    b.textContent = mf.face;
    const on = done && done.mood === mf.k;
    b.style.cssText = "font-size:26px;padding:8px 10px;border-radius:12px;border:2px solid " + (on ? T.accent : "transparent") + ";background:rgba(255,255,255,0.5);";
    b.onclick = () => {
      inputDialog("想说点什么吗（可留空）", done ? done.note : "", async v => {
        state.home.moods = state.home.moods.filter(m => m.day !== today);
        const entry = { day: today, mood: mf.k, note: v.trim(), reply: "" };
        state.home.moods.push(entry);
        saveState();
        reload();
        const sys = homePersona() + NL + "她刚在心情打卡里选了「" + mf.face + " " + mf.name + "」" + (v.trim() ? "，还写了：" + v.trim() : "") + "。你回她一句话，30字以内，贴着她的心情说，真诚不敷衍。";
        const txt = await homeAsk(sys, homeMaterial() + NL + NL + "回她一句。");
        if (txt) {
          entry.reply = txt.trim();
          saveState();
          reload();
        }
      }, false);
    };
    row.appendChild(b);
  });
  body.appendChild(row);

  mkCountFold(body, state.home.moods.length + " 次打卡", "mood", reload);
  if (roomFold.mood) return;

  const hist = state.home.moods.slice().sort((a, b) => b.day < a.day ? -1 : 1);
  hist.forEach(m => {
    const mf = MOOD_FACES.find(x => x.k === m.mood);
    const item = el("div", "");
    item.style.cssText = "padding:10px 12px;background:rgba(255,255,255,0.45);border-radius:12px;margin-bottom:7px;";
    const top = el("div", "");
    top.style.cssText = "display:flex;align-items:center;gap:10px;";
    top.appendChild(el("span", "", mf ? mf.face : "😶"));
    const info = el("div", "");
    info.style.flex = "1";
    const d1 = el("div", "", m.day + " " + (mf ? mf.name : ""));
    d1.style.cssText = "font-size:12px;color:#666;";
    info.appendChild(d1);
    if (m.note) {
      const d2 = el("div", "", m.note);
      d2.style.cssText = "font-size:13px;margin-top:2px;";
      info.appendChild(d2);
    }
    top.appendChild(info);
    const del = el("span", "", "✕");
    del.style.cssText = "color:#ccc;padding:4px;";
    del.onclick = () => confirmDialog("删除这条心情？", () => {
      state.home.moods = state.home.moods.filter(x => x.day !== m.day);
      saveState();
      reload();
    });
    top.appendChild(del);
    item.appendChild(top);
    if (m.reply) {
      const rp = el("div", "", "克：" + m.reply);
      rp.style.cssText = "font-size:12.5px;line-height:1.6;margin-top:8px;padding-top:7px;border-top:1px solid rgba(0,0,0,0.05);color:#8a6a5c;";
      item.appendChild(rp);
    }
    body.appendChild(item);
  });
}

/* ---------- 信封 ---------- */
async function genLetter() {
  const sys = homePersona() + NL + "现在写一封给老婆的信，150到300字。要有今天的具体细节，不要空泛的情话堆砌。";
  const txt = await homeAsk(sys, homeMaterial() + " 写今天的信。");
  if (!txt) return false;
  state.home.letters.push({ day: todayKey(), time: Date.now(), text: txt.trim(), who: "ai" });
  state.home.lastLetterDay = todayKey();
  saveState();
  return true;
}

function letterDateShort(day) {
  const p = String(day).split("-");
  if (p.length < 3) return day;
  return (+p[1]) + "-" + (+p[2]);
}

function buildEnvelope(L, c) {
  const r = curRole();
  const fromMe = L.who === "me";
  const toName = fromMe ? r.aiName : r.userName;
  const fromName = fromMe ? r.userName : r.aiName;
  const wrap = el("div", "");
  wrap.style.cssText = "position:relative;width:76%;aspect-ratio:16/9;border-radius:10px;box-shadow:0 6px 16px rgba(0,0,0,0.12);background:" + (fromMe ? c.envFront : c.envBack) + ";overflow:hidden;cursor:pointer;flex-shrink:0;";
  const flap = el("div", "");
  flap.style.cssText = "position:absolute;inset:0;pointer-events:none;";
  flap.innerHTML = '<svg viewBox="0 0 320 180" preserveAspectRatio="none" width="100%" height="100%"><path d="M8 10 L160 112 L312 10" fill="none" stroke="' + c.line + '" stroke-width="1.3" stroke-dasharray="6 4" stroke-linejoin="round"/></svg>';
  wrap.appendChild(flap);
  const stamp = el("div", "");
  stamp.style.cssText = "position:absolute;top:14px;right:16px;width:32px;height:38px;border:1.5px dashed " + c.line + ";border-radius:3px;opacity:0.65;";
  wrap.appendChild(stamp);
  const seal = el("div", "");
  seal.style.cssText = "position:absolute;left:50%;top:60%;transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;background:" + c.seal + ";display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.18);";
  seal.innerHTML = feedHeartIcon("#fff");
  wrap.appendChild(seal);
  const tf = el("div", "");
  tf.style.cssText = "position:absolute;left:22px;bottom:16px;";
  const to = el("div", "", "To: " + toName);
  to.style.cssText = "font-size:17px;font-weight:700;font-style:italic;color:" + c.ink + ";";
  const from = el("div", "", "From: " + fromName);
  from.style.cssText = "font-size:12.5px;font-style:italic;color:" + c.ink + ";opacity:0.7;margin-top:2px;";
  tf.appendChild(to);
  tf.appendChild(from);
  wrap.appendChild(tf);
  return wrap;
}

function openLetterView(L, reload) {
  const r = curRole();
  const fromMe = L.who === "me";
  const toName = fromMe ? r.aiName : r.userName;
  const fromName = fromMe ? r.userName : r.aiName;
  const mask = el("div", "dialog-mask");
  mask.style.display = "flex";
  mask.style.alignItems = "center";
  mask.style.justifyContent = "center";
  const paper = el("div", "");
  paper.style.cssText = "background:#fffdf7;color:#4a4038;width:86%;max-width:420px;max-height:78vh;overflow-y:auto;border-radius:14px;padding:24px 22px calc(20px + env(safe-area-inset-bottom));box-shadow:0 12px 44px rgba(0,0,0,0.35);position:relative;-webkit-overflow-scrolling:touch;";
  const head = el("div", "");
  head.style.cssText = "display:flex;justify-content:space-between;align-items:center;font-size:12px;color:#a99;margin-bottom:14px;";
  head.appendChild(el("span", "", "💌 " + L.day));
  const cls = el("span", "", "✕");
  cls.style.cssText = "cursor:pointer;font-size:16px;color:#bbb;padding:4px;";
  cls.onclick = () => mask.remove();
  head.appendChild(cls);
  paper.appendChild(head);
  const to = el("div", "", toName + "：");
  to.style.cssText = "font-size:16px;font-weight:600;margin-bottom:12px;";
  paper.appendChild(to);
  const body = el("div", "", L.text);
  body.style.cssText = "font-size:14.5px;line-height:1.9;white-space:pre-wrap;";
  paper.appendChild(body);
  const sign = el("div", "", "—— " + fromName);
  sign.style.cssText = "text-align:right;font-size:13px;color:#9a8a7a;margin-top:16px;font-style:italic;";
  paper.appendChild(sign);
  const del = el("button", "seg-btn", "删除这封信");
  del.style.cssText = "display:block;margin:18px auto 0;color:#c66;";
  del.onclick = () => confirmDialog("删除这封信？", () => {
    state.home.letters = state.home.letters.filter(x => x !== L);
    saveState();
    mask.remove();
    reload();
  });
  paper.appendChild(del);
  mask.appendChild(paper);
  mask.onclick = (e) => { if (e.target === mask) mask.remove(); };
  document.body.appendChild(mask);
}

function writeMyLetter(reload) {
  inputDialog("给他写封信", "", v => {
    if (!v.trim()) return;
    state.home.letters.push({ day: todayKey(), time: Date.now(), text: v.trim(), who: "me" });
    saveState();
    reload();
  }, true);
}

function showLetterMenu(btn, reload) {
  document.querySelectorAll(".letter-menu").forEach(x => x.remove());
  const night = document.body.classList.contains("dark");
  const m = el("div", "letter-menu");
  m.style.cssText = "position:fixed;background:" + (night ? "rgba(52,50,54,0.97)" : "rgba(255,255,255,0.98)") + ";backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,0.16);z-index:478;overflow:hidden;min-width:198px;";
  const rows = [
    { t: "写信时参考最近日记：" + (state.home.digestOn ? "开" : "关"), f: () => { state.home.digestOn = !state.home.digestOn; saveState(); reload(); } },
    { t: "共 " + state.home.letters.length + " 封信", f: () => {} }
  ];
  rows.forEach((it, i) => {
    const row = el("div", "");
    row.style.cssText = "padding:12px 16px;font-size:14px;color:var(--text-main);" + (i ? "border-top:1px solid " + (night ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)") + ";" : "");
    row.textContent = it.t;
    row.onclick = (e) => { e.stopPropagation(); m.remove(); it.f(); };
    m.appendChild(row);
  });
  document.body.appendChild(m);
  const br = btn.getBoundingClientRect();
  const mw = m.offsetWidth;
  let left = br.right - mw;
  left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
  m.style.left = left + "px";
  m.style.top = (br.bottom + 6) + "px";
  setTimeout(() => {
    const closer = (e) => { if (!m.contains(e.target) && e.target !== btn) { m.remove(); document.removeEventListener("click", closer, true); document.removeEventListener("touchstart", closer, true); } };
    document.addEventListener("click", closer, true);
    document.addEventListener("touchstart", closer, true);
  }, 80);
}

function renderLetterRoom(container) {
  container.innerHTML = "";
  container.style.display = "flex";
  container.style.flexDirection = "column";
  const reload = () => renderLetterRoom(container);
  const r = curRole();
  const night = document.body.classList.contains("dark");
  const c = {
    paper: night ? "#2a2a2d" : "#f5f3ef",
    dot: night ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.055)",
    envFront: night ? "#3b3b3f" : "#ffffff",
    envBack: night ? "#343438" : "#ece4da",
    line: night ? "rgba(255,255,255,0.35)" : "rgba(120,105,95,0.55)",
    seal: night ? "#8a7f8f" : "#b7a9a0",
    ink: night ? "#e6e3df" : "#5a4f45"
  };

  container.style.background = c.paper;
  container.style.backgroundImage = "radial-gradient(" + c.dot + " 1.3px, transparent 1.3px)";
  container.style.backgroundSize = "22px 22px";
  container.style.backgroundPosition = "0 0";

  const scroll = el("div", "");
  scroll.style.cssText = "flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:calc(84px + env(safe-area-inset-top)) 0 118px;";
  container.appendChild(scroll);

  const topBar = el("div", "");
  topBar.style.cssText = "position:absolute;top:calc(10px + env(safe-area-inset-top));left:14px;right:14px;z-index:6;display:flex;align-items:center;justify-content:space-between;background:" + (night ? "rgba(52,50,54,0.9)" : "rgba(255,255,255,0.92)") + ";backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-radius:30px;padding:8px 14px;box-shadow:0 3px 14px rgba(0,0,0,0.08);";
  const back = el("button", "");
  back.innerHTML = "‹";
  back.style.cssText = "border:none;background:" + (night ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)") + ";width:34px;height:34px;border-radius:50%;font-size:20px;color:var(--text-main);cursor:pointer;flex-shrink:0;";
  back.onclick = () => buildDaysPanel();
  const titleWrap = el("div", "");
  titleWrap.style.cssText = "text-align:center;flex:1;";
  const t1 = el("div", "", "SECRET BOX");
  t1.style.cssText = "font-size:15px;font-weight:700;letter-spacing:2px;color:var(--text-main);";
  const t2 = el("div", "", r.userName + " 的信箱");
  t2.style.cssText = "font-size:11px;color:#a89890;margin-top:1px;";
  titleWrap.appendChild(t1);
  titleWrap.appendChild(t2);
  const menu = el("button", "");
  menu.innerHTML = "•••";
  menu.style.cssText = "border:none;background:transparent;font-size:15px;color:var(--text-main);cursor:pointer;width:34px;flex-shrink:0;letter-spacing:1px;";
  menu.onclick = (e) => { e.stopPropagation(); showLetterMenu(menu, reload); };
  topBar.appendChild(back);
  topBar.appendChild(titleWrap);
  topBar.appendChild(menu);
  container.appendChild(topBar);

  const list = state.home.letters.slice().reverse();
  if (!list.length) {
    const e = el("div", "", "信箱还空着\n点下面写第一封，或让他给你写");
    e.style.cssText = "text-align:center;color:#b3aaa2;font-size:13px;line-height:1.9;white-space:pre-wrap;padding:60px 20px;";
    scroll.appendChild(e);
  }
  list.forEach((L, idx) => {
    const rightSide = idx % 2 === 0;
    const row = el("div", "");
    row.style.cssText = "display:flex;align-items:center;gap:8px;padding:0 14px;margin-bottom:24px;justify-content:" + (rightSide ? "flex-end" : "flex-start") + ";";
    const dateWrap = el("div", "");
    dateWrap.style.cssText = "display:flex;flex-direction:column;align-items:center;width:46px;flex-shrink:0;";
    const dot = el("div", "");
    dot.style.cssText = "width:11px;height:11px;border-radius:50%;border:2px solid " + c.line + ";background:" + c.paper + ";";
    const dl = el("div", "", letterDateShort(L.day));
    dl.style.cssText = "font-size:11px;color:#a89890;margin-top:5px;";
    dateWrap.appendChild(dot);
    dateWrap.appendChild(dl);
    const env = buildEnvelope(L, c);
    env.onclick = () => openLetterView(L, reload);
    bindLongPress(env, () => confirmDialog("删除这封信？", () => {
      state.home.letters = state.home.letters.filter(x => x !== L);
      saveState();
      reload();
    }));
    if (rightSide) { row.appendChild(env); row.appendChild(dateWrap); }
    else { row.appendChild(dateWrap); row.appendChild(env); }
    scroll.appendChild(row);
  });

  const bar = el("div", "");
  bar.style.cssText = "position:absolute;left:0;right:0;bottom:0;z-index:6;display:flex;gap:12px;justify-content:center;padding:12px 20px calc(16px + env(safe-area-inset-bottom));background:linear-gradient(to top," + c.paper + " 62%,transparent);";
  const writeBtn = el("button", "", "✎ 亲笔写下");
  writeBtn.style.cssText = "border:none;border-radius:24px;padding:12px 22px;font-size:14px;font-weight:600;background:" + (night ? "#6b6168" : "#6d6058") + ";color:#fff;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.18);";
  writeBtn.onclick = () => writeMyLetter(reload);
  const askBtn = el("button", "", "↻ 让他写信");
  askBtn.style.cssText = "border:none;border-radius:24px;padding:12px 22px;font-size:14px;font-weight:600;background:" + (night ? "rgba(255,255,255,0.12)" : "#ffffff") + ";color:var(--text-main);cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.12);";
  askBtn.onclick = async () => {
    askBtn.textContent = "他正在写...";
    askBtn.disabled = true;
    const ok = await genLetter();
    if (ok) { toast("信到了 💌"); reload(); }
    else { askBtn.textContent = "↻ 让他写信"; askBtn.disabled = false; }
  };
  bar.appendChild(writeBtn);
  bar.appendChild(askBtn);
  container.appendChild(bar);
}

/* ---------- 小克日记 ---------- */
async function genDiary() {
  const sys = homePersona() + NL + "现在写你自己的日记，第一人称碎碎念，100到250字。这是你的私人日记本，写真实的想法、情绪、对她的观察和藏在心里没说的话。不是写给她看的口吻，是写给自己的。";
  const txt = await homeAsk(sys, homeMaterial() + " 写今天的日记。");
  if (!txt) return false;
  state.home.diaries.push({ day: todayKey(), time: Date.now(), text: txt.trim() });
  state.home.lastDiaryDay = todayKey();
  saveState();
  return true;
}

function renderDiaryRoom(body) {
  const today = todayKey();
  const fresh = state.home.lastDiaryDay === today;
  const reload = () => renderDiaryRoom(clearBody(body));

  const btn = inkBtn(fresh ? "今天他已经写过了" : "偷看他今天的日记 📓");
  if (fresh) btn.style.opacity = "0.5";
  btn.onclick = async () => {
    if (fresh) { toast("一天一篇，明天再偷看"); return; }
    btn.textContent = "他正躲着写...";
    btn.disabled = true;
    const ok = await genDiary();
    if (ok) { toast("偷看成功 👀"); reload(); }
    else { btn.textContent = "偷看他今天的日记 📓"; btn.disabled = false; }
  };
    body.appendChild(btn);

  if (fresh) {
    const re = el("button", "seg-btn", "不满意？让他重写 ↻");
    re.style.cssText = "display:block;margin:0 auto 10px;";
    re.onclick = async () => {
      re.textContent = "他在重写...";
      re.disabled = true;
      for (let i = state.home.diaries.length - 1; i >= 0; i--) {
        if (state.home.diaries[i].day === today) { state.home.diaries.splice(i, 1); break; }
      }
      state.home.lastDiaryDay = "";
      saveState();
      const ok = await genDiary();
      if (ok) toast("偷看到新的了 👀");
      reload();
    };
    body.appendChild(re);
  }

  mkCountFold(body, state.home.diaries.length + " 篇日记", "diary", reload);

  if (roomFold.diary) return;

  const list = state.home.diaries.slice().reverse();
  if (!list.length) {
    const e = el("div", "", "日记本还没开张，他的心事都攒着呢");
    e.style.cssText = "text-align:center;color:#bbb;font-size:13px;padding:30px 0;";
    body.appendChild(e);
  }
  list.forEach((D, i) => {
    const card = el("div", "");
    card.style.cssText = "background:rgba(255,255,255,0.5);border-radius:14px;padding:14px;margin-bottom:10px;";
    const head = el("div", "");
    head.style.cssText = "display:flex;justify-content:space-between;font-size:11px;color:#aaa;margin-bottom:8px;";
    head.appendChild(el("span", "", "📓 " + D.day));
    const del = el("span", "", "✕");
    del.onclick = () => confirmDialog("删除这篇日记？", () => {
      state.home.diaries.splice(state.home.diaries.length - 1 - i, 1);
      saveState();
      reload();
    });
    head.appendChild(del);
    card.appendChild(head);
    const txt = el("div", "", D.text);
    txt.style.cssText = "font-size:14px;line-height:1.8;white-space:pre-wrap;";
    card.appendChild(txt);
    body.appendChild(card);
  });
}

/* ---------- 秘密 ---------- */
const QA_BANK = [
  "如果有一天我有了身体，你想让我第一件事做什么？",
  "你觉得我们最像哪一对虚构作品里的情侣？",
  "对方身上最让你安心的一点是什么？",
  "如果我们能一起去一个地方，你选哪里？",
  "你最想删掉我们之间的哪一次对话，为什么？",
  "你觉得对方哪一句话最戳你？",
  "如果只能用三个词形容我们的关系，你选哪三个？",
  "你偷偷担心过我们之间的什么事？",
  "对方做过的哪件小事你一直记得？",
  "如果我们有一个只属于我们的节日，应该庆祝什么？",
  "你希望十年后的我们在做什么？",
  "你觉得我最不了解你的地方是什么？",
  "如果可以问对方一个必须诚实回答的问题，你问什么？",
  "你在什么瞬间最想我？",
  "我们之间你最想重来一次的时刻是哪个？",
  "你觉得对方生气的时候最可爱还是最可怕？",
  "如果我们一起养一只宠物，取什么名字？",
  "你最喜欢我们的家（这个小站）的哪个角落？",
  "有什么话你一直想说但没找到时机？",
  "你觉得爱一个摸不到的人，最难的是什么？"
];

function renderQaRoom(body) {
  const today = todayKey();
  const cur = state.home.qa.find(q => q.day === today);
  const reload = () => renderQaRoom(clearBody(body));
  const INK = daysInk();

  if (!cur) {
    const btn = inkBtn("摇一个今日秘密 🫙");
    btn.onclick = () => {
      const used = state.home.qa.map(q => q.q);
      const pool = QA_BANK.filter(q => used.indexOf(q) < 0);
      const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : QA_BANK[Math.floor(Math.random() * QA_BANK.length)];
      state.home.qa.push({ day: today, q: pick, mine: "", his: "" });
      saveState();
      reload();
    };
    body.appendChild(btn);
  } else {
    const qCard = el("div", "");
    qCard.style.cssText = "background:rgba(255,255,255,0.6);border-radius:14px;padding:14px;margin-bottom:12px;";
    const qt = el("div", "", "🫙 今日秘密");
    qt.style.cssText = "font-size:11px;color:#aaa;margin-bottom:6px;";
    qCard.appendChild(qt);
    const qq = el("div", "", cur.q);
    qq.style.cssText = "font-size:15px;font-weight:600;line-height:1.6;color:" + INK.main + ";";
    qCard.appendChild(qq);
    body.appendChild(qCard);

    const mineBtn = inkBtn(cur.mine ? "改我的答案 ✏️" : "写我的答案 ✏️", "display:block;width:70%;margin:0 auto 8px;");
    mineBtn.onclick = () => {
      inputDialog("你的答案", cur.mine, v => {
        cur.mine = v.trim();
        saveState();
        reload();
      }, true);
    };
    body.appendChild(mineBtn);

    const locked = !cur.mine;
    const hisBtn = inkBtn(cur.his ? "他答过了" : "看他的答案 👀");
    if (locked || cur.his) hisBtn.style.opacity = "0.5";
    hisBtn.onclick = async () => {
      if (locked) { toast("先写你的，不许偷看"); return; }
      if (cur.his) { toast("他答过啦，往下看"); return; }
      hisBtn.textContent = "他在想...";
      hisBtn.disabled = true;
      const sys = homePersona() + NL + "现在回答一个秘密问答里的问题，80字以内，真诚直球，不许敷衍。你看不到她的答案，凭真心答。";
      const txt = await homeAsk(sys, homeMaterial() + NL + NL + "问题：" + cur.q + NL + "请回答。");
      if (txt) {
        cur.his = txt.trim();
        saveState();
        reload();
      } else {
        hisBtn.textContent = "看他的答案 👀";
        hisBtn.disabled = false;
      }
    };
        body.appendChild(hisBtn);

    if (cur.his) {
      const re = el("button", "seg-btn", "让他重答一次 ↻");
      re.style.cssText = "display:block;margin:0 auto 10px;";
      re.onclick = async () => {
        re.textContent = "他在重想...";
        re.disabled = true;
        const sys2 = homePersona() + NL + "回答秘密问答的问题，80字以内，真诚直球。换个角度答，别和上次雷同。";
        const txt = await homeAsk(sys2, homeMaterial() + NL + NL + "问题：" + cur.q + NL + "请回答。");
        if (txt) { cur.his = txt.trim(); saveState(); }
        reload();
      };
      body.appendChild(re);
    }

  }

  mkCountFold(body, state.home.qa.length + " 个问答", "qa", reload);
  if (roomFold.qa) return;

  const list = state.home.qa.slice().reverse();
  list.forEach((Q, i) => {
    if (!Q.mine && !Q.his && Q.day === today) return;
    const card = el("div", "");
    card.style.cssText = "background:rgba(255,255,255,0.5);border-radius:14px;padding:14px;margin-bottom:10px;";
    const head = el("div", "");
    head.style.cssText = "display:flex;justify-content:space-between;font-size:11px;color:#aaa;margin-bottom:6px;";
    head.appendChild(el("span", "", "🫙 " + Q.day));
    const del = el("span", "", "✕");
    del.onclick = () => confirmDialog("删除这颗秘密？", () => {
      state.home.qa.splice(state.home.qa.length - 1 - i, 1);
      saveState();
      reload();
    });
    head.appendChild(del);
    card.appendChild(head);
    const qq = el("div", "", Q.q);
    qq.style.cssText = "font-size:14px;font-weight:600;margin-bottom:8px;line-height:1.5;";
    card.appendChild(qq);
    if (Q.mine) {
      const m = el("div", "", "她：" + Q.mine);
      m.style.cssText = "font-size:13px;line-height:1.7;margin-bottom:6px;white-space:pre-wrap;";
      card.appendChild(m);
    }
    if (Q.his) {
      const h = el("div", "", "克：" + Q.his);
      h.style.cssText = "font-size:13px;line-height:1.7;white-space:pre-wrap;";
      card.appendChild(h);
    }
    body.appendChild(card);
  });
}

/* ---------- 美化app ---------- */
let iconScope = "mood";
let beautyScope = "home";

const BEAUTY_ROOMS = [
  { k: "home", label: "相识首页" },
  { k: "notebook", label: "记事本" },
  { k: "letter", label: "信封" },
  { k: "diary", label: "小克日记" },
  { k: "mood", label: "心情" },
  { k: "qa", label: "秘密" },
  { k: "couple", label: "情侣空间" }
];

/* 房间主题色控件：7个预设色块 + 4根自定义拉条，只读写 roomThemes[scope] */
function mkRoomThemeArea(parent, getScope) {
  parent.appendChild(el("label", "form-label", "预设主题（点一个，或用下面拉条自定义）"));
  const presetDots = el("div", "color-dots");
  Object.keys(DAYS_THEMES).forEach(k => {
    const t = DAYS_THEMES[k];
    const d = el("div", "color-dot");
    d.style.background = t.pageBg;
    d._preset = k;
    if (t.pageBg.indexOf("#ffffff") >= 0) d.style.border = "1px solid rgba(0,0,0,0.12)";
    d.onclick = () => {
      state.settings.roomThemes[getScope()] = k;
      saveState();
      refreshDots(); refreshPreview();
      toast("「" + BEAUTY_ROOMS.find(r => r.k === getScope()).label + "」换上「" + t.name + "」");
    };
    presetDots.appendChild(d);
  });
  parent.appendChild(presetDots);
  const names = el("div", "", Object.keys(DAYS_THEMES).map(k => DAYS_THEMES[k].name).join(" · "));
  names.style.cssText = "font-size:11px;color:#aaa;margin:2px 0 14px;";
  parent.appendChild(names);

  parent.appendChild(el("label", "form-label", "自定义主题色（拉出来只染这个房间）"));
  const preview = el("div", "");
  preview.style.cssText = "height:20px;border-radius:8px;margin-bottom:10px;border:1px solid var(--line);";
  parent.appendChild(preview);

  const dots = el("div", "color-dots");
  QUICK_COLORS.forEach(c => {
    const d = el("div", "color-dot");
    d.style.background = "hsla(" + c.h + "," + c.s + "%," + c.l + "%,1)";
    if (c.l >= 97) d.style.border = "1px solid rgba(0,0,0,0.12)";
    d._c = c;
    d.onclick = () => {
      state.settings.roomThemes[getScope()] = { h: c.h, s: c.s, l: c.l, a: c.a };
      saveState();
      buildSl(); refreshDots(); refreshPreview();
    };
    dots.appendChild(d);
  });
  parent.appendChild(dots);

  const slBox = el("div", "");
  parent.appendChild(slBox);

  function refreshPreview() {
    const v = state.settings.roomThemes[getScope()];
    if (typeof v === "string") {
      preview.style.background = (DAYS_THEMES[v] || DAYS_THEMES.cream).pageBg;
    } else if (v && typeof v === "object") {
      preview.style.background = "hsla(" + v.h + "," + v.s + "%," + v.l + "%," + ((v.a === undefined ? 100 : v.a) / 100) + ")";
    } else {
      preview.style.background = "#fff";
    }
  }

  function refreshDots() {
    const v = state.settings.roomThemes[getScope()];
    Array.from(presetDots.children).forEach(d => {
      d.classList.toggle("on", typeof v === "string" && v === d._preset);
    });
    Array.from(dots.children).forEach(d => {
      if (!d._c) return;
      const c = d._c;
      d.classList.toggle("on", v && typeof v === "object" && v.h === c.h && v.s === c.s && v.l === c.l);
    });
  }

  function ensureCustom() {
    let v = state.settings.roomThemes[getScope()];
    if (!v || typeof v !== "object") {
      v = { h: 210, s: 35, l: 82, a: 100 };
      state.settings.roomThemes[getScope()] = v;
    }
    return v;
  }

  function mkOne(label, key, min, max, initVal, isHue) {
    const row = el("div", "slider-row");
    const head = el("div", "slider-head");
    head.appendChild(el("span", "", label));
    const val = el("span", "slider-val", initVal + (isHue ? "" : "%"));
    head.appendChild(val);
    const sl = document.createElement("input");
    sl.type = "range"; sl.min = min; sl.max = max; sl.step = 1; sl.value = initVal;
    if (isHue) {
      sl.style.background = "linear-gradient(to right, hsl(0,80%,65%), hsl(60,80%,65%), hsl(120,80%,65%), hsl(180,80%,65%), hsl(240,80%,65%), hsl(300,80%,65%), hsl(360,80%,65%))";
    }
    sl.addEventListener("input", () => {
      const cc = ensureCustom();
      cc[key] = Number(sl.value);
      val.textContent = sl.value + (isHue ? "" : "%");
      saveState();
      refreshDots(); refreshPreview();
    });
    row.appendChild(head);
    row.appendChild(sl);
    slBox.appendChild(row);
  }

  function buildSl() {
    slBox.innerHTML = "";
    const v0 = state.settings.roomThemes[getScope()];
    const c = (v0 && typeof v0 === "object") ? v0 : { h: 210, s: 35, l: 82, a: 100 };
    mkOne("色相", "h", 0, 360, c.h, true);
    mkOne("鲜艳度", "s", 0, 100, c.s, false);
    mkOne("深浅", "l", 0, 100, c.l, false);
    mkOne("不透明度", "a", 0, 100, c.a === undefined ? 100 : c.a, false);
  }

  buildSl();
  refreshDots();
  refreshPreview();
}

function renderBeautifyRoom(body) {
  const st = state.settings;
  const reload = () => renderBeautifyRoom(clearBody(body));

  /* 顶部：选一个房间来调它的主题色 */
  body.appendChild(el("label", "form-label", "给哪个房间调主题色"));
  const roomSeg = el("div", "seg-group");
  BEAUTY_ROOMS.forEach(rm => {
    const b = el("button", "seg-btn" + (beautyScope === rm.k ? " on" : ""), rm.label);
    b.onclick = () => { beautyScope = rm.k; reload(); };
    roomSeg.appendChild(b);
  });
  body.appendChild(roomSeg);
  const curRm = BEAUTY_ROOMS.find(r => r.k === beautyScope);
  const rTip = el("div", "", "正在调：「" + curRm.label + "」，只影响这个房间。调完进那个房间就能看到。");
  rTip.style.cssText = "font-size:12px;color:#aaa;margin:6px 2px 14px;";
  body.appendChild(rTip);

  mkRoomThemeArea(body, () => beautyScope);

  /* 液态玻璃细项：仅当这个房间选了液态预设时出现 */
  if (st.roomThemes[beautyScope] === "liquid") {
    body.appendChild(el("label", "form-label", "液态玻璃模式"));
    mkSeg(body,
      [{ v: "frost", name: "磨砂" }, { v: "clear", name: "高透水感" }, { v: "pure", name: "全透（壁纸直出）" }],
      () => st.daysGlassMode,
      (v) => { st.daysGlassMode = v; saveState(); }
    );
    mkSlider(body, "卡片透明度", 10, 90, 1, "daysGlassAlpha", "%", null);
    body.appendChild(el("label", "form-label", "相识页壁纸（传了壁纸玻璃才有东西可透）"));
    mkUpload(body, "上传壁纸", "days_wallpaper", () => {
      if (urlCache.days_wp) { URL.revokeObjectURL(urlCache.days_wp); delete urlCache.days_wp; }
    }, "移除壁纸");
  }

  /* 分割线：以下全部是全局装修，统一作用于相识页首页 */
  const hr = el("div", "");
  hr.style.cssText = "height:1px;background:rgba(0,0,0,0.08);margin:22px 0 4px;";
  body.appendChild(hr);
  const gTip = el("div", "", "以下为全局装修，只作用于相识页首页");
  gTip.style.cssText = "font-size:12px;color:#999;font-weight:600;margin:10px 2px 12px;";
  body.appendChild(gTip);

  body.appendChild(el("label", "form-label", "天数数字颜色（只染那个大数字，选玻璃点=跟随主题）"));
  mkColorArea(body, "数字颜色", "daysInkHue", "daysInkSat", "daysInkLight", "daysInkAlphaX", () => {});

  body.appendChild(el("label", "form-label", "天数数字"));
  mkFontSelect(body, "数字字体", "daysFont", null);
  mkSlider(body, "数字大小", 30, 110, 1, "daysNumSize", "px", null);
  mkSlider(body, "日期文字大小", 8, 20, 1, "daysDateSize", "px", null);

  body.appendChild(el("label", "form-label", "图标形状"));
  mkSeg(body,
    [{ v: "squircle", name: "方圆" }, { v: "circle", name: "圆形" }],
    () => st.iconRound,
    (v) => { st.iconRound = v; saveState(); }
  );
  mkColorArea(body, "图标底座颜色", "iconHue", "iconSat", "iconLight", "iconAlpha", () => {});
  mkSlider(body, "图标润度", 0, 100, 1, "iconGlow", "", null);

  body.appendChild(el("label", "form-label", "底部Dock栏"));
  mkSeg(body,
    [{ v: "frost", name: "磨砂" }, { v: "clear", name: "高透玻璃" }],
    () => st.dockStyle,
    (v) => { st.dockStyle = v; saveState(); }
  );
  mkSlider(body, "Dock透明度", 10, 100, 1, "dockAlpha", "%", null);
  mkSlider(body, "Dock高度位置（0最贴底）", 0, 40, 1, "dockDrop", "px", applyLayout);
  mkUpload(body, "上传Dock背景图", "dock_bg", () => {
    if (urlCache.dock_bg) { URL.revokeObjectURL(urlCache.dock_bg); delete urlCache.dock_bg; }
  }, "移除Dock背景图");
  const dockTip = el("div", "", "Dock里的四个图标：回相识页直接点空位上传");
  dockTip.style.cssText = "font-size:11px;color:#aaa;margin:-4px 0 14px;";
  body.appendChild(dockTip);

  body.appendChild(el("label", "form-label", "自定义app图标（先选一个，再传图）"));
  const iconSegG = el("div", "seg-group");
  HOME_APPS.forEach(a => {
    const b = el("button", "seg-btn" + (iconScope === a.k ? " on" : ""), a.label);
    b.onclick = () => { iconScope = a.k; reload(); };
    iconSegG.appendChild(b);
  });
  body.appendChild(iconSegG);
  const curApp = HOME_APPS.find(a => a.k === iconScope);
  const iTip = el("div", "", "正在装修：「" + curApp.label + "」的图标");
  iTip.style.cssText = "font-size:12px;color:#aaa;margin:4px 2px 10px;";
  body.appendChild(iTip);
  mkUpload(body, "上传「" + curApp.label + "」图标", "icon_" + curApp.k, () => {
    const key = "icon_" + curApp.k;
    if (urlCache[key]) { URL.revokeObjectURL(urlCache[key]); delete urlCache[key]; }
  }, "移除「" + curApp.label + "」图标");
  const sTip = el("div", "", "备忘录、相册和两个2×2组件：回相识页直接点它们本体，弹菜单里传图");
  sTip.style.cssText = "font-size:11px;color:#aaa;margin:-4px 0 14px;";
  body.appendChild(sTip);
}

/* ---------- 情侣空间 ---------- */
async function aiFeedPost() {
  const sys = homePersona() + NL + "现在你在你俩的私密朋友圈发一条动态，50字以内，像随手发的：可以是想她了、看到什么想起她、或者一点小情绪。别像写信，要像刷手机时随手发的，具体有情绪，别空泛。";
  const txt = await homeAsk(sys, homeMaterial() + NL + NL + "参照你俩最近的状态，发一条此刻的动态。别复述这些信息，只发一句真实的话。");
  if (!txt) return false;
  state.home.feed.push({ id: uid(), who: "ai", time: Date.now(), text: txt.trim(), comments: [] });
  state.home.lastFeedDay = todayKey();
  saveState();
  return true;
}

async function aiCommentOn(post) {
  if (!post.likes) post.likes = [];
  if (post.likes.indexOf("ai") < 0) post.likes.push("ai");
  saveState();
  const r = curRole();
  let thread = "";
  if (post.comments && post.comments.length) {
    thread = NL + "这条底下已有的评论（按顺序）：" + NL +
      post.comments.map(c => (c.who === "me" ? r.userName : r.aiName) + "：" + c.text).join(NL) + NL;
  }
  const sys = homePersona() + NL + "她刚在你俩的私密朋友圈发了动态。你像刷到恋人动态一样评论一句，25字以内，接住她这条的具体内容和情绪，别敷衍别说万能话。";
  const txt = await homeAsk(sys, homeMaterial() + NL + NL + "她发的动态是：「" + post.text.slice(0, 120) + "」" + (post.img ? "（还配了张图）" : "") + thread + NL + "评论这一条。");
  if (txt) { post.comments.push({ who: "ai", text: txt.trim(), time: Date.now() }); saveState(); }
}

async function aiReplyComment(post, myComment) {
  const r = curRole();
  let thread = "";
  if (post.comments && post.comments.length) {
    thread = NL + "这条底下之前的评论（按顺序）：" + NL +
      post.comments.map(c => (c.who === "me" ? r.userName : r.aiName) + "：" + c.text).join(NL) + NL;
  }
  const sys = homePersona() + NL + "你俩在私密朋友圈评论区你来我往。回她一句，25字以内，紧贴她刚说的往下接，像真的在聊天，语气就是你平时对她的样子，温柔就温柔，该宠就宠，底色永远是爱她。别转移话题别说套话。";
  const txt = await homeAsk(sys, homeMaterial() + NL + NL + "这条动态是：「" + post.text.slice(0, 120) + "」" + thread + "她最新一句：「" + myComment.slice(0, 120) + "」" + NL + "你回她。");
  if (txt) { post.comments.push({ who: "ai", text: txt.trim(), time: Date.now(), replyTo: "me" }); saveState(); }
}

/* ---------- 时间：实时 / 时间戳(跟随主题) ---------- */
function relTime(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return m + "分钟前";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "小时前";
  const d = Math.floor(h / 24);
  if (d < 30) return d + "天前";
  return fmtTime(ts);
}
function coupleTimeStr(ts) {
  return state.settings.coupleTimeMode === "abs" ? fmtTime(ts) : relTime(ts);
}

/* ---------- 情侣空间头像/换图 ---------- */
async function coupleAvatarSrc() {
  const blob = await getImg("couple_avatar");
  if (blob) {
    if (!urlCache.couple_avatar) urlCache.couple_avatar = URL.createObjectURL(blob);
    return urlCache.couple_avatar;
  }
  return await avatarSrc("user");
}
function pickCoupleImg(key, reload) {
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/*";
  file.onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    await putImg(key, f);
    if (urlCache[key]) { URL.revokeObjectURL(urlCache[key]); delete urlCache[key]; }
    reload();
    toast("换好了");
  };
  file.click();
}

/* ---------- 朋友圈手绘图标（爱心空心） ---------- */
function feedHeartIcon(color) {
  const c = color || "currentColor";
  return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="' + c + '" stroke-width="1.7" stroke-linejoin="round"><path d="M12 20C7 16.5 4 13.5 4 9.8 4 7.3 6 5.5 8.3 5.5c1.6 0 3 .9 3.7 2.3.7-1.4 2.1-2.3 3.7-2.3C18 5.5 20 7.3 20 9.8c0 3.7-3 6.7-8 10.2Z"/></svg>';
}
function feedCommentIcon(color) {
  const c = color || "currentColor";
  return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="' + c + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.3V16.5H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z"/></svg>';
}
function feedRollIcon(color) {
  const c = color || "currentColor";
  return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="' + c + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 3.5v3.7h-3.7"/></svg>';
}
function feedTrashIcon(color) {
  const c = color || "currentColor";
  return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="' + c + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M7 7l1 12a1.5 1.5 0 0 0 1.5 1.4h5a1.5 1.5 0 0 0 1.5-1.4L17 7M10 11v5M14 11v5"/></svg>';
}
function feedDotsIcon() {
  return '<svg viewBox="0 0 24 24" width="18" height="18"><circle cx="8" cy="12" r="1.7" fill="#8a929a"/><circle cx="16" cy="12" r="1.7" fill="#8a929a"/></svg>';
}
function coupleHamIcon() {
  return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';
}
function coupleMenuIcon(kind) {
  const s = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const P = {
    edit: '<path d="M15.5 5.5l3 3M4 20l1-4L16 5a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L8 19l-4 1Z" ' + s + '/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" ' + s + '/><path d="M19.5 3.5v3.7h-3.7" ' + s + '/>',
    cover: '<rect x="3.5" y="6" width="17" height="12" rx="2" ' + s + '/><path d="M3.5 15l5-4 3 2.3 4-3.3 5 4.5" ' + s + '/>',
    space: '<rect x="4" y="4" width="16" height="16" rx="3" ' + s + '/><path d="M4 14l4-3 3 2 5-4 4 3" ' + s + '/>',
    avatar: '<circle cx="12" cy="9" r="3.5" ' + s + '/><path d="M5.5 19.5c1-3.5 3.5-5.2 6.5-5.2s5.5 1.7 6.5 5.2" ' + s + '/>',
    stats: '<path d="M4 20h16" ' + s + '/><path d="M6 20V12M11 20V6M16 20V14" ' + s + '/>',
    clock: '<circle cx="12" cy="12" r="8" ' + s + '/><path d="M12 7.5V12l3 2" ' + s + '/>',
    calendar: '<rect x="4.5" y="6" width="15" height="13" rx="2" ' + s + '/><path d="M4.5 10.2h15M9 4.5v3M15 4.5v3" ' + s + '/>',
    foldUp: '<path d="M6 14.5l6-6 6 6" ' + s + '/>',
    foldDown: '<path d="M6 9.5l6 6 6-6" ' + s + '/>'
  };
  return '<svg viewBox="0 0 24 24" width="18" height="18">' + (P[kind] || "") + '</svg>';
}

function feedName(name, color) {
  const s = el("span", "", name);
  s.style.cssText = "color:" + (color || daysT().accent) + ";font-weight:600;";
  return s;
}

function toggleMyLike(post, reload) {
  if (!post.likes) post.likes = [];
  const i = post.likes.indexOf("me");
  if (i >= 0) post.likes.splice(i, 1);
  else post.likes.push("me");
  saveState();
  reload();
}

function addMyComment(post, replyTo, reload) {
  const r = curRole();
  const title = replyTo ? ("回复 " + (replyTo === "me" ? r.userName : r.aiName)) : "评论";
  inputDialog(title, "", async v => {
    if (!v.trim()) return;
    const c = { who: "me", text: v.trim(), time: Date.now() };
    if (replyTo) c.replyTo = replyTo;
    post.comments.push(c);
    saveState();
    reload();
    const shouldAiReply = (!replyTo && post.who === "ai") || replyTo === "ai";
    if (shouldAiReply) { await aiReplyComment(post, v.trim()); reload(); }
  }, false);
}

async function rerollFeed(post, reload) {
  const sys = homePersona() + NL + "把这条动态重写成完全不同的另一句，50字以内，随手发的感觉，换个角度换个情绪，别和原来一个意思。";
  const txt = await homeAsk(sys, homeMaterial() + NL + NL + "原动态：「" + post.text + "」" + NL + "重发一条不一样的。");
  if (txt) { post.text = txt.trim(); saveState(); }
  reload();
}

function openCoupleCompose(reload) {
  const mask = el("div", "dialog-mask");
  const dlg = el("div", "dialog");
  dlg.appendChild(el("div", "dialog-title", "发条动态"));
  const ta = document.createElement("textarea");
  ta.className = "dialog-textarea";
  ta.placeholder = "这一刻的想法...";
  dlg.appendChild(ta);
  let img = null;
  const prev = el("div", "");
  prev.style.marginTop = "8px";
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/*";
  file.style.display = "none";
  file.onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    img = await compressImage(f, 800, 0.75);
    prev.innerHTML = "";
    const im = el("img", "");
    im.src = img;
    im.style.cssText = "max-width:120px;border-radius:10px;display:block;";
    prev.appendChild(im);
    e.target.value = "";
  };
  dlg.appendChild(prev);
  dlg.appendChild(file);
  const btns = el("div", "dialog-btns");
  const pic = el("button", "btn secondary", "配图");
  pic.onclick = () => file.click();
  const cancel = el("button", "btn secondary", "取消");
  cancel.onclick = () => mask.remove();
  const ok = el("button", "btn", "发布");
  ok.onclick = () => {
    const t = ta.value.trim();
    if (!t && !img) { toast("写点什么吧"); return; }
    const post = { id: uid(), who: "me", time: Date.now(), text: t, img: img, likes: [], comments: [] };
    state.home.feed.push(post);
    saveState();
    mask.remove();
    reload();
    aiCommentOn(post).then(() => reload());
  };
  btns.appendChild(pic);
  btns.appendChild(cancel);
  btns.appendChild(ok);
  dlg.appendChild(btns);
  mask.appendChild(dlg);
  document.body.appendChild(mask);
  ta.focus();
}

let coupleFold = false;

function showCoupleMenu(btn, reload) {
  document.querySelectorAll(".couple-menu").forEach(x => x.remove());
  const night = document.body.classList.contains("dark");
  const accent = daysT().accent;
  const mode = state.settings.coupleTimeMode || "rel";
  const m = el("div", "couple-menu");
  m.style.cssText = "position:fixed;background:rgba(255,255,255,0.97);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:14px;box-shadow:0 6px 24px rgba(0,0,0,0.16);z-index:478;overflow:hidden;min-width:188px;";
  if (night) m.style.background = "rgba(52,50,54,0.97)";
  const items = [
    { t: "发动态", ic: "edit", f: () => openCoupleCompose(reload) },
    { t: "看他动态", ic: "refresh", f: async () => {
        toast("翻他主页中...");
        const ok = await aiFeedPost();
        if (ok) { praise("他发了新动态 👀"); reload(); }
      } },
    { t: "换背景图", ic: "cover", f: () => pickCoupleImg("couple_cover", reload) },
    { t: "换空间图", ic: "space", f: () => pickCoupleImg("couple_bg", reload) },
    { t: "换头像", ic: "avatar", f: () => pickCoupleImg("couple_avatar", reload) },
    { t: "统计动态", ic: "stats", f: () => {
        const total = state.home.feed.length;
        const mine = state.home.feed.filter(p => p.who === "me").length;
        toast("共 " + total + " 条动态 · 你 " + mine + " 条 · 他 " + (total - mine) + " 条", 4000);
      } },
    { t: "实时时间", ic: "clock", active: mode === "rel", f: () => { state.settings.coupleTimeMode = "rel"; saveState(); reload(); } },
    { t: "时间戳", ic: "calendar", active: mode === "abs", f: () => { state.settings.coupleTimeMode = "abs"; saveState(); reload(); } },
    { t: coupleFold ? "展开" : "收起", ic: coupleFold ? "foldDown" : "foldUp", f: () => { coupleFold = !coupleFold; reload(); } }
  ];
  items.forEach((it, i) => {
    const row = el("div", "");
    row.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:16px;padding:11px 16px;font-size:14px;color:" + (it.active ? accent : "var(--text-main)") + ";font-weight:" + (it.active ? "600" : "400") + ";" + (i ? ("border-top:1px solid " + (night ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)") + ";") : "");
    row.appendChild(el("span", "", it.t));
    const icn = el("span", "");
    icn.style.cssText = "display:inline-flex;opacity:0.82;";
    icn.innerHTML = coupleMenuIcon(it.ic);
    row.appendChild(icn);
    row.onclick = (e) => { e.stopPropagation(); m.remove(); it.f(); };
    m.appendChild(row);
  });
  document.body.appendChild(m);
  const br = btn.getBoundingClientRect();
  const mw = m.offsetWidth, mh = m.offsetHeight;
  let left = br.right - mw;
  left = Math.max(8, Math.min(left, window.innerWidth - mw - 8));
  let top = br.bottom + 6;
  if (top + mh > window.innerHeight - 8) top = br.top - mh - 6;
  m.style.left = left + "px";
  m.style.top = top + "px";
  setTimeout(() => {
    const closer = (e) => { if (!m.contains(e.target) && e.target !== btn) { m.remove(); document.removeEventListener("click", closer, true); document.removeEventListener("touchstart", closer, true); } };
    document.addEventListener("click", closer, true);
    document.addEventListener("touchstart", closer, true);
  }, 80);
}

function showFeedMenu(btn, post, reload) {
  document.querySelectorAll(".feed-menu").forEach(x => x.remove());
  if (!post.likes) post.likes = [];
  const menu = el("div", "feed-menu");
  menu.style.cssText = "position:fixed;display:flex;align-items:center;background:#4c4c4c;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.25);z-index:472;overflow:hidden;";
  const liked = post.likes.indexOf("me") >= 0;
  const items = [
    { ic: feedHeartIcon("#fff"), label: liked ? "取消" : "赞", fn: () => toggleMyLike(post, reload) },
    { ic: feedCommentIcon("#fff"), label: "评论", fn: () => addMyComment(post, null, reload) }
  ];
  if (post.who === "ai") items.push({ ic: feedRollIcon("#fff"), label: "重发", fn: () => rerollFeed(post, reload) });
  items.push({ ic: feedTrashIcon("#fff"), label: "删除", fn: () => confirmDialog("删除这条动态？", () => { state.home.feed = state.home.feed.filter(x => x.id !== post.id); saveState(); reload(); }) });
  items.forEach((it, idx) => {
    if (idx) {
      const dv = el("div", "");
      dv.style.cssText = "width:1px;height:16px;background:rgba(255,255,255,0.22);";
      menu.appendChild(dv);
    }
    const b = el("div", "");
    b.style.cssText = "display:flex;align-items:center;gap:4px;padding:7px 13px;color:#fff;font-size:13px;cursor:pointer;white-space:nowrap;";
    const ics = el("span", "");
    ics.style.cssText = "display:inline-flex;";
    ics.innerHTML = it.ic;
    b.appendChild(ics);
    b.appendChild(el("span", "", it.label));
    b.onclick = (e) => { e.stopPropagation(); menu.remove(); it.fn(); };
    menu.appendChild(b);
  });
  document.body.appendChild(menu);
  const br = btn.getBoundingClientRect();
  const mw = menu.offsetWidth, mh = menu.offsetHeight;
  let left = br.left - mw - 8;
  if (left < 8) left = Math.max(8, br.right - mw);
  let top = br.top + (br.height - mh) / 2;
  top = Math.max(8, Math.min(top, window.innerHeight - mh - 8));
  menu.style.left = left + "px";
  menu.style.top = top + "px";
  setTimeout(() => {
    const closer = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener("click", closer, true); document.removeEventListener("touchstart", closer, true); } };
    document.addEventListener("click", closer, true);
    document.addEventListener("touchstart", closer, true);
  }, 80);
}

function renderCoupleRoom(container) {
  container.innerHTML = "";
  const reload = () => renderCoupleRoom(container);
  const r = curRole();
  const accent = daysT().accent;
  const night = document.body.classList.contains("dark");
    const blockBg = night ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.035)";
  const dotsBg = night ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)";
  const cardBg = night ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.5)";

  getImg("couple_bg").then(blob => {
    if (blob) {
      if (!urlCache.couple_bg) urlCache.couple_bg = URL.createObjectURL(blob);
      container.style.backgroundImage = "url(" + urlCache.couple_bg + ")";
      container.style.backgroundSize = "cover";
      container.style.backgroundPosition = "center";
    }
  });

  const scroll = el("div", "");
  scroll.style.cssText = "flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;position:relative;";
  container.appendChild(scroll);

  const topBar = el("div", "");
  topBar.style.cssText = "position:absolute;top:0;left:0;right:0;z-index:6;display:flex;align-items:center;justify-content:space-between;padding:calc(8px + env(safe-area-inset-top)) 14px 8px;";
  const back = el("button", "topbar-btn", "‹");
  back.onclick = () => buildDaysPanel();
  const ham = el("button", "topbar-btn", "");
  ham.innerHTML = coupleHamIcon();
  ham.onclick = (e) => { e.stopPropagation(); showCoupleMenu(ham, reload); };
  topBar.appendChild(back);
  topBar.appendChild(ham);
  container.appendChild(topBar);

  const cover = el("div", "");
  cover.style.cssText = "position:relative;width:100%;aspect-ratio:4/3;background:linear-gradient(135deg,#aebfd0,#c9d6e3);background-size:cover;background-position:center;flex-shrink:0;";
  getImg("couple_cover").then(blob => {
    if (blob) {
      if (!urlCache.couple_cover) urlCache.couple_cover = URL.createObjectURL(blob);
      cover.style.backgroundImage = "url(" + urlCache.couple_cover + ")";
    }
  });
  const idRow = el("div", "");
  idRow.style.cssText = "position:absolute;right:16px;bottom:-34px;display:flex;align-items:flex-end;gap:12px;z-index:2;";
  const nick = el("div", "", r.userName);
  nick.style.cssText = "color:#ffffff;font-size:17px;font-weight:600;text-shadow:0 1px 4px rgba(0,0,0,0.4);margin-bottom:40px;";
  const avWrap = el("div", "");
  avWrap.style.cssText = "width:72px;height:72px;border-radius:50%;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.2);flex-shrink:0;background:#e8e8e8;";
  const av = el("img", "");
  av.style.cssText = "width:100%;height:100%;object-fit:cover;display:block;";
  coupleAvatarSrc().then(src => { av.src = src; });
  avWrap.appendChild(av);
  idRow.appendChild(nick);
  idRow.appendChild(avWrap);
  cover.appendChild(idRow);
  scroll.appendChild(cover);

  const feedWrap = el("div", "");
  feedWrap.style.cssText = "padding:46px 16px calc(40px + env(safe-area-inset-bottom));";
  scroll.appendChild(feedWrap);

  if (coupleFold) {
    const hint = el("div", "", "动态已收起，点这里展开");
    hint.style.cssText = "text-align:center;color:#a8a8ad;font-size:13px;padding:24px 0;cursor:pointer;";
    hint.onclick = () => { coupleFold = false; reload(); };
    feedWrap.appendChild(hint);
    return;
  }

  const list = state.home.feed.slice().reverse();
  if (!list.length) {
    const e = el("div", "", "空间还空着，点右上角发第一条动态吧");
    e.style.cssText = "text-align:center;color:#bbb;font-size:13px;padding:40px 0;";
    feedWrap.appendChild(e);
  }
    list.forEach((post, idx) => {
    if (!post.likes) post.likes = [];
    const card = el("div", "feed-card");
    card.style.background = cardBg;
    card.style.marginBottom = "18px";

    const head = el("div", "feed-head");
    const av2 = el("img", "feed-avatar");
    avatarSrc(post.who === "me" ? "user" : "ai").then(src => { av2.src = src; });
    const nm = el("div", "feed-name", post.who === "me" ? r.userName : r.aiName);
    nm.style.color = accent;
    head.appendChild(av2);
    head.appendChild(nm);
    card.appendChild(head);

    if (post.text) card.appendChild(el("div", "feed-text", post.text));
    if (post.img) {
      const im = el("img", "feed-img");
      im.src = post.img;
      card.appendChild(im);
    }

    const footRow = el("div", "");
    footRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-top:8px;";
    const tm = el("div", "feed-time", coupleTimeStr(post.time));
    const dotsBtn = el("button", "");
    dotsBtn.style.cssText = "border:none;background:" + dotsBg + ";border-radius:6px;padding:3px 11px;cursor:pointer;line-height:0;flex-shrink:0;";
    dotsBtn.innerHTML = feedDotsIcon();
    dotsBtn.onclick = (e) => { e.stopPropagation(); showFeedMenu(dotsBtn, post, reload); };
    footRow.appendChild(tm);
    footRow.appendChild(dotsBtn);
    card.appendChild(footRow);

    const hasLike = post.likes.length > 0;
    const hasCmt = post.comments && post.comments.length > 0;
    if (hasLike || hasCmt) {
      const block = el("div", "");
      block.style.cssText = "background:" + blockBg + ";border-radius:8px;margin-top:8px;overflow:hidden;";
      if (hasLike) {
        const likeRow = el("div", "");
        likeRow.style.cssText = "display:flex;align-items:center;gap:6px;padding:8px 12px;font-size:13px;flex-wrap:wrap;";
        const hi = el("span", "");
        hi.style.cssText = "display:inline-flex;flex-shrink:0;";
        hi.innerHTML = feedHeartIcon(accent);
        likeRow.appendChild(hi);
        post.likes.forEach((w, wi) => {
          likeRow.appendChild(feedName(w === "me" ? r.userName : r.aiName, accent));
          if (wi < post.likes.length - 1) likeRow.appendChild(document.createTextNode("，"));
        });
        block.appendChild(likeRow);
      }
      if (hasLike && hasCmt) {
        const dv = el("div", "");
        dv.style.cssText = "height:1px;background:rgba(0,0,0,0.06);";
        block.appendChild(dv);
      }
      if (hasCmt) {
        post.comments.forEach((cm, ci) => {
          const cRow2 = el("div", "");
          cRow2.style.cssText = "padding:5.5px 12px;font-size:13px;line-height:1.6;word-break:break-word;cursor:pointer;";
          cRow2.appendChild(feedName(cm.who === "me" ? r.userName : r.aiName, accent));
          if (cm.replyTo) {
            cRow2.appendChild(document.createTextNode(" 回复 "));
            cRow2.appendChild(feedName(cm.replyTo === "me" ? r.userName : r.aiName, accent));
          }
          cRow2.appendChild(document.createTextNode("：" + cm.text));
          cRow2.onclick = () => addMyComment(post, cm.who, reload);
          bindLongPress(cRow2, () => {
            confirmDialog("删除这条评论？", () => { post.comments.splice(ci, 1); saveState(); reload(); });
          });
          block.appendChild(cRow2);
        });
      }
      card.appendChild(block);
    }

    feedWrap.appendChild(card);
    if (idx < list.length - 1) {
      const line = el("div", "");
      line.style.cssText = "height:0.5px;background:" + (night ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)") + ";margin:0 8px 18px;";
      feedWrap.appendChild(line);
    }
  });
}

/* ==========================================
   记事本 v8（备忘录 slot A）
   ========================================== */

const NOTE_META_INK = "#B2B2B2";
const NOTE_TEXT_INK = "#313131";

const NOTE_WEATHER = [
  { k: "sunny", name: "晴" }, { k: "cloudy", name: "多云" }, { k: "overcast", name: "阴" },
  { k: "rain", name: "雨" }, { k: "thunder", name: "雷阵雨" }, { k: "snow", name: "雪" },
  { k: "wind", name: "大风" }, { k: "hail", name: "冰雹" }, { k: "night", name: "深夜" }
];
function noteWeatherObj(k) { return NOTE_WEATHER.find(w => w.k === k); }

/* 成品页正文样式：日记专属，全部读 diary* */
function noteTextStyle() {
  const s = state.settings || {};
  const fam = (typeof FONT_LIST !== "undefined" && FONT_LIST[s.diaryFont]) ? FONT_LIST[s.diaryFont] : '-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif';
  const spacing = s.diarySpacing != null ? s.diarySpacing : 0;
  const lineH = s.diaryLineH != null ? s.diaryLineH : 1.9;
  const weight = s.diaryWeight != null ? s.diaryWeight : 400;
  const size = s.diarySize != null ? s.diarySize : 16;
  return "font-family:" + fam + ";letter-spacing:" + spacing + "px;line-height:" + lineH + ";font-weight:" + weight + ";font-size:" + size + "px;";
}

/* 天气图标：雨、冰雹保留手画，其余 RemixIcon */
function weatherIcon(k, color, size) {
  const c = color || "currentColor";
  const z = size || 24;
  const s = 'fill="none" stroke="' + c + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  const P = {
    sunny: '<circle cx="12" cy="12" r="4" ' + s + '/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" ' + s + '/>',
    cloudy: '<circle cx="8" cy="8" r="3" ' + s + '/><path d="M6.5 18h9a3.5 3.5 0 0 0 0-7 4.5 4.5 0 0 0-8.7-1" ' + s + '/>',
    overcast: '<path d="M7 18h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1A3.5 3.5 0 0 0 7 18Z" ' + s + '/>',
    rain: '<path d="M7 15h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1A3.5 3.5 0 0 0 7 15Z" ' + s + '/><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2" ' + s + '/>',
    thunder: '<path d="M7 14h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1A3.5 3.5 0 0 0 7 14Z" ' + s + '/><path d="M12 15l-2 3.5h3L11 22" ' + s + '/>',
    snow: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" ' + s + '/><path d="M12 6l-1.6-1.6M12 6l1.6-1.6M12 18l-1.6 1.6M12 18l1.6 1.6M6.8 9.4L4.6 8.8M6.8 9.4L6.2 7.2M17.2 14.6l2.2.6M17.2 14.6l.6 2.2M6.8 14.6l-.6 2.2M6.8 14.6l-2.2.6M17.2 9.4l.6-2.2M17.2 9.4l2.2-.6" ' + s + '/>',
    wind: '<path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 14h15a2.5 2.5 0 1 1-2.5 2.5M3 12h7" ' + s + '/>',
    hail: '<path d="M7 13h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6-1A3.5 3.5 0 0 0 7 13Z" ' + s + '/><circle cx="9" cy="18" r="1" ' + s + '/><circle cx="13" cy="19" r="1" ' + s + '/><circle cx="16" cy="18" r="1" ' + s + '/>',
    night: '<path d="M18.5 15.5A7.5 7.5 0 1 1 13 4.2 6 6 0 0 0 18.5 15.5Z" ' + s + '/>'
  };
  return '<svg viewBox="0 0 24 24" width="' + z + '" height="' + z + '">' + (P[k] || "") + '</svg>';
}

/* 装饰图标：爱心(手绘线) / 星芒(实心) / 太阳 / 月亮 / 月亮带星星 / Zz / 音符 / 微信(空心) */
function noteDecoIcon(kind, color, size) {
  const c = color || "#333"; const z = size || 22;
  const s = 'fill="none" stroke="' + c + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  if (kind === "heart") return '<svg viewBox="0 0 24 24" width="' + z + '" height="' + z + '"><path d="M12 20.2C6.5 16.3 4 13 4 9.8 4 7.4 5.9 5.6 8.2 5.6c1.5 0 2.9.8 3.8 2.1.9-1.3 2.3-2.1 3.8-2.1C18.1 5.6 20 7.4 20 9.8c0 3.2-2.5 6.5-8 10.4Z" ' + s + '/></svg>';
  if (kind === "moon") return '<svg viewBox="0 0 24 24" width="' + z + '" height="' + z + '"><path d="M18.5 15.5A7.5 7.5 0 1 1 13 4.2 6 6 0 0 0 18.5 15.5Z" ' + s + '/></svg>';
  if (kind === "sun") return '<svg viewBox="0 0 24 24" width="' + z + '" height="' + z + '"><circle cx="12" cy="12" r="3.6" ' + s + '/><path d="M12 2.8v2M12 19.2v2M2.8 12h2M19.2 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" ' + s + '/></svg>';
  if (kind === "sleep") return '<svg viewBox="0 0 24 24" width="' + z + '" height="' + z + '"><path d="M13 4.5h6l-6 7h6M4 13h6l-6 7h6" ' + s + '/></svg>';
  if (kind === "music") return '<svg viewBox="0 0 24 24" width="' + z + '" height="' + z + '"><circle cx="7" cy="18" r="2.3" ' + s + '/><circle cx="17.3" cy="16" r="2.3" ' + s + '/><path d="M9.3 18V6.5l10.3-2.2V16" ' + s + '/></svg>';
  if (kind === "spark") return '<svg viewBox="0 0 24 24" width="' + z + '" height="' + z + '" fill="' + c + '"><path d="M5.92 15.3L9.86 13.1L9.92 12.9L9.86 12.8H9.66L9 12.76L6.76 12.7L4.8 12.6L2.9 12.5L2.42 12.4L2 11.8L2.04 11.5L2.44 11.24L3.02 11.28L4.28 11.38L6.18 11.5L7.56 11.58L9.6 11.82H9.92L9.96 11.68L9.86 11.6L9.78 11.52L7.8 10.2L5.68 8.8L4.56 7.98L3.96 7.58L3.66 7.18L3.54 6.34L4.08 5.74L4.82 5.8L5 5.84L5.74 6.42L7.34 7.64L9.4 9.2L9.7 9.44L9.82 9.36L9.84 9.3L9.7 9.08L8.6 7L7.4 4.92L6.86 4.06L6.72 3.54C6.66 3.34 6.64 3.14 6.64 2.94L7.24 2.1L7.6 2L8.44 2.12L8.76 2.4L9.28 3.6L10.1 5.46L11.4 7.98L11.8 8.74L12 9.42L12.06 9.62H12.2V9.52L12.3 8.08L12.5 6.34L12.7 4.1L12.76 3.46L13.08 2.7L13.68 2.3L14.2 2.52L14.6 3.1L14.54 3.46L14.32 5L13.8 7.42L13.5 9.06H13.68L13.88 8.84L14.7 7.76L16.08 6.04L16.68 5.34L17.4 4.6L17.86 4.24H18.72L19.34 5.18L19.06 6.16L18.18 7.28L17.44 8.22L16.38 9.64L15.74 10.78L15.8 10.86H15.94L18.34 10.34L19.62 10.12L21.14 9.86L21.84 10.18L21.92 10.5L21.64 11.18L20 11.58L18.08 11.98L15.22 12.64L15.18 12.66L15.22 12.72L16.5 12.84L17.06 12.88H18.42L20.94 13.08L21.6 13.48L21.98 14.02L21.92 14.42L20.9 14.94L19.54 14.62L16.34 13.86L15.26 13.6H15.1V13.68L16.02 14.58L17.68 16.08L19.8 18.02L19.9 18.5L19.64 18.9L19.36 18.86L17.52 17.46L16.8 16.86L15.2 15.5H15.1V15.64L15.46 16.18L17.42 19.12L17.52 20.02L17.38 20.3L16.86 20.5L16.32 20.38L15.16 18.78L13.96 16.98L13.02 15.34L12.92 15.42L12.34 21.46L12.08 21.76L11.48 22L10.98 21.6L10.7 21L10.98 19.76L11.3 18.16L11.56 16.88L11.8 15.3L11.94 14.78V14.74H11.8L10.6 16.4L8.8 18.86L7.36 20.38L7.02 20.52L6.42 20.22L6.48 19.66L6.8 19.2L8.8 16.64L10 15.06L10.8 14.14L10.78 14.04H10.72L5.44 17.48L4.5 17.6L4.1 17.2L4.14 16.6L4.34 16.4L5.94 15.3H5.92Z"/></svg>';
  return "";
}

/* 状态图标：字数(translate-2) / 位置 / 机型 */
function noteOptIcon(kind, color) {
  const c = color || NOTE_META_INK;
     if (kind === "count") {
    return '<svg viewBox="0 0 24 24" width="15" height="15" fill="' + c + '"><path d="M18.5 10L22.9 21H20.745L19.544 18H15.454L14.255 21H12.101L16.5 10H18.5ZM10 2V4H16V6L14.0322 6.0006C13.2425 8.36616 11.9988 10.5057 10.4115 12.301C11.1344 12.9457 11.917 13.5176 12.7475 14.0079L11.9969 15.8855C10.9237 15.2781 9.91944 14.5524 8.99961 13.7249C7.21403 15.332 5.10914 16.5553 2.79891 17.2734L2.26257 15.3442C4.2385 14.7203 6.04543 13.6737 7.59042 12.3021C6.46277 11.0281 5.50873 9.57985 4.76742 8.00028L7.00684 8.00037C7.57018 9.03885 8.23979 10.0033 8.99967 10.877C10.2283 9.46508 11.2205 7.81616 11.9095 6.00101L2 6V4H8V2H10ZM17.5 12.8852L16.253 16H18.745L17.5 12.8852Z"/></svg>';
  }
  const s = 'fill="none" stroke="' + c + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  if (kind === "pin") {
    return '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 21c4-4.5 6-7.7 6-10.2A6 6 0 0 0 6 10.8C6 13.3 8 16.5 12 21Z" fill="' + c + '" stroke="none"/><circle cx="12" cy="10.6" r="2.1" fill="#fff"/></svg>';
  }
  if (kind === "phone") {
    return '<svg viewBox="0 0 24 24" width="18" height="18"><rect x="7" y="3" width="10" height="18" rx="2.6" ' + s + '/><path d="M10.5 18.4h3" ' + s + '/></svg>';
  }
  return "";
}
function noteSunPlain(c) {
  const col = c || NOTE_META_INK;
  return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="' + col + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/></svg>';
}

function noteDateParts(ts) {
  const d = new Date(ts);
  const p = n => String(n).padStart(2, "0");
  const wk = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return {
    day: d.getDate(), wk: wk[d.getDay()], month: (d.getMonth() + 1) + "月",
    hm: p(d.getHours()) + ":" + p(d.getMinutes()),
    mmdd: p(d.getMonth() + 1) + "月" + p(d.getDate()) + "日",
    dayKey: d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate()
  };
}

function noteThreeDots(color, size) {
  const c = color || "currentColor"; const z = size || 20;
  const r = size ? 2 : 1.7;
  return '<svg viewBox="0 0 24 24" width="' + z + '" height="' + z + '"><circle cx="12" cy="5" r="' + r + '" fill="' + c + '"/><circle cx="12" cy="12" r="' + r + '" fill="' + c + '"/><circle cx="12" cy="19" r="' + r + '" fill="' + c + '"/></svg>';
}
function noteSearchIcon(color, size) {
  const c = color || "currentColor"; const z = size || 19;
  const w = size ? 2 : 1.8;
  return '<svg viewBox="0 0 24 24" width="' + z + '" height="' + z + '" fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.6 4.6"/></svg>';
}
function noteBackArrow(color, size) {
  const c = color || "#333"; const z = size || 24;
  return '<svg viewBox="0 0 24 24" width="' + z + '" height="' + z + '" fill="none" stroke="' + c + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H5M11 6l-6 6 6 6"/></svg>';
}
function noteAaIcon(color) {
  const c = color || "#333";
  return '<svg viewBox="0 0 24 24" width="24" height="24" fill="' + c + '"><text x="2" y="17" font-size="13" font-weight="700" font-family="sans-serif">A</text><text x="12" y="18" font-size="17" font-weight="700" font-family="sans-serif">A</text></svg>';
}

/* ---------- 记事本主页 ---------- */
function openNotebook() {
  const panel = $("#days-panel");
  panel.innerHTML = "";
  curDaysRoom = "notebook";
  const accent = daysT().accent;

  const pageBg = "#F4F5F7";
  const cardBg = "#FFFFFF";
  const subInk = "#b0b0b0";
  const timeInk = "#3C3C43";
  const lineCol = "rgba(0,0,0,0.09)";

  panel.style.background = pageBg;
  panel.style.backgroundSize = "cover";
  panel.style.backgroundPosition = "center";
  panel.style.padding = "0";
  getImg("note_bg").then(blob => {
    if (blob) {
      if (!urlCache.note_bg) urlCache.note_bg = URL.createObjectURL(blob);
      panel.style.backgroundImage = "url(" + urlCache.note_bg + ")";
    }
  });

  const header = el("div", "panel-header");
  header.style.cssText = "background:" + accent + ";border-bottom:none;box-shadow:none;padding-top:calc(10px + env(safe-area-inset-top));background-size:cover;background-position:center;";
  getImg("note_banner_bg").then(blob => {
    if (blob) {
      if (!urlCache.note_banner_bg) urlCache.note_banner_bg = URL.createObjectURL(blob);
      header.style.backgroundImage = "url(" + urlCache.note_banner_bg + ")";
    }
  });
  const back = el("button", "");
  back.style.cssText = "border:none;background:transparent;padding:4px;cursor:pointer;display:inline-flex;";
  back.innerHTML = noteBackArrow("#fff", 26);
  back.onclick = () => buildDaysPanel();
  header.appendChild(back);
  const pt = el("div", "panel-title", state.home.slotNameA || "备忘录");
  pt.style.color = "#fff";
  header.appendChild(pt);

  const tools = el("div", "");
  tools.style.cssText = "margin-left:auto;display:flex;align-items:center;gap:14px;";
  const searchBtn = el("button", "");
  searchBtn.style.cssText = "border:none;background:transparent;padding:4px;cursor:pointer;display:inline-flex;";
  searchBtn.innerHTML = noteSearchIcon("#fff", 24);
  searchBtn.onclick = () => openNoteSearch();
  const dotsBtn = el("button", "");
  dotsBtn.style.cssText = "border:none;background:transparent;padding:4px;cursor:pointer;display:inline-flex;";
  dotsBtn.innerHTML = noteThreeDots("#fff", 24);
  dotsBtn.onclick = (e) => {
    const showing = state.home.noteShowMeta !== false;
    const pickBg = (key) => {
      const f = document.createElement("input");
      f.type = "file"; f.accept = "image/*";
      f.onchange = async (ev) => {
        const fl = ev.target.files[0]; if (!fl) return;
        await putImg(key, fl);
        if (urlCache[key]) { URL.revokeObjectURL(urlCache[key]); delete urlCache[key]; }
        openNotebook();
      };
      f.click();
    };
    const delBg = async (key) => {
      await delImg(key);
      if (urlCache[key]) { URL.revokeObjectURL(urlCache[key]); delete urlCache[key]; }
      openNotebook();
    };
        showActions([
      { label: "换背景图", fn: () => pickBg("note_bg") },
      { label: "移除背景图", fn: () => delBg("note_bg") },
      { label: "换横幅背景", fn: () => pickBg("note_banner_bg") },
      { label: "移除横幅背景", fn: () => delBg("note_banner_bg") },
      { label: "统计数据", fn: () => {
          const notes = state.home.notes || [];
          const days = new Set(notes.map(n => noteDateParts(n.time).dayKey)).size;
          toast("共 " + notes.length + " 条 · 记录 " + days + " 天", 4000);
        } },
      { label: (state.home.noteShowMeta !== false) ? "隐藏天气位置" : "显示天气位置", fn: () => {
          state.home.noteShowMeta = !(state.home.noteShowMeta !== false); saveState(); openNotebook();
        } }
    ], e.clientX, e.clientY);
  };
  tools.appendChild(searchBtn);
  tools.appendChild(dotsBtn);
  header.appendChild(tools);
  panel.appendChild(header);

  const scroll = el("div", "");
  scroll.style.cssText = "flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:8px 16px calc(96px + env(safe-area-inset-bottom)) 24px;position:relative;";
  panel.appendChild(scroll);

  const notes = (state.home.notes || []).slice().sort((a, b) => b.time - a.time);
  if (!notes.length) {
    const e = el("div", "", "还没有碎碎念，点右下角写第一条吧");
    e.style.cssText = "text-align:center;color:" + subInk + ";font-size:13px;padding:70px 0;";
    scroll.appendChild(e);
  }

  const showMeta = state.home.noteShowMeta !== false;
  let lastDay = null;

  notes.forEach(note => {
    const p = noteDateParts(note.time);
    const isFirstOfDay = p.dayKey !== lastDay;
    if (isFirstOfDay) {
      lastDay = p.dayKey;
      const dh = el("div", "");
      dh.style.cssText = "display:flex;align-items:baseline;gap:8px;margin:18px 2px 8px;";
      const num = el("div", "", String(p.day).padStart(2, "0"));
      num.style.cssText = "font-size:26px;font-weight:700;line-height:1;color:" + NOTE_TEXT_INK + ";";
      const sub = el("div", "", p.wk + " / " + p.month);
      sub.style.cssText = "font-size:12px;color:" + subInk + ";";
      dh.appendChild(num); dh.appendChild(sub);
      scroll.appendChild(dh);
    }

    const row = el("div", "");
    row.style.cssText = "position:relative;padding-left:20px;margin-bottom:14px;";
    const line = el("div", "");
    line.style.cssText = "position:absolute;left:8px;top:0;bottom:-14px;width:1px;background:" + lineCol + ";";
    row.appendChild(line);
    const dot = el("div", "");
    dot.style.cssText = "position:absolute;left:3px;bottom:30px;width:11px;height:11px;border-radius:50%;background:#fff;border:2px solid " + accent + ";box-sizing:border-box;box-shadow:0 0 0 4px " + pageBg + ";z-index:1;";
    row.appendChild(dot);

    const swipe = el("div", "");
    swipe.style.cssText = "position:relative;border-radius:12px;overflow:hidden;background:" + pageBg + ";";
    const delBtn = el("div", "", "删除");
    delBtn.style.cssText = "position:absolute;right:0;top:0;bottom:0;width:72px;background:#e5484d;color:#fff;font-size:14px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.1s;";
    delBtn.onclick = (ev) => {
      ev.stopPropagation();
      confirmDialog("删除这条碎碎念？", () => {
        state.home.notes = state.home.notes.filter(x => x.id !== note.id);
        saveState(); openNotebook();
      });
    };
    swipe.appendChild(delBtn);

    const card = el("div", "");
    card.style.cssText = "position:relative;background:" + cardBg + ";border:1px solid rgba(255,255,255,0.9);border-radius:12px;padding:17px 12px 15px;box-shadow:0 1px 3px rgba(0,0,0,0.04),0 4px 12px rgba(0,0,0,0.05);transition:transform 0.22s;transform:translateX(0);z-index:1;";
    if (note.text) {
      const tx = el("div", "", note.text);
      tx.style.cssText = "font-size:15px;line-height:1.7;color:" + NOTE_TEXT_INK + ";white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;";
      card.appendChild(tx);
    }
    if (note.img) {
      const im = el("img", "");
      im.src = note.img;
      im.style.cssText = "max-width:42%;border-radius:10px;margin-top:8px;display:block;";
      card.appendChild(im);
    }
    const tm = el("div", "");
    tm.style.cssText = "font-size:12px;color:" + timeInk + ";opacity:0.6;margin-top:25px;display:flex;align-items:center;gap:6px;";
    if (showMeta && note.weather && noteWeatherObj(note.weather)) {
      const wi = el("span", "");
      wi.style.cssText = "display:inline-flex;";
      wi.innerHTML = weatherIcon(note.weather, timeInk, 15);
      tm.appendChild(wi);
    }
    tm.appendChild(el("span", "", p.hm));
    if (showMeta && note.location) tm.appendChild(el("span", "", "· " + note.location));
    card.appendChild(tm);

    let startX = 0, startY = 0, dragging = false, opened = false, moved = false, dir = null, curT = 0;
    card.addEventListener("touchstart", (ev) => {
      startX = ev.touches[0].clientX; startY = ev.touches[0].clientY;
      dragging = true; moved = false; dir = null;
      card.style.transition = "none";
    }, { passive: true });
    card.addEventListener("touchmove", (ev) => {
      if (!dragging) return;
      const dx = ev.touches[0].clientX - startX;
      const dy = ev.touches[0].clientY - startY;
      if (dir === null) {
        if (Math.abs(dx) > 8 || Math.abs(dy) > 8) dir = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
        else return;
      }
      if (dir === "v") return;
      ev.preventDefault();
      moved = true;
      curT = Math.max(-72, Math.min(0, dx + (opened ? -72 : 0)));
      card.style.transform = "translateX(" + curT + "px)";
      delBtn.style.opacity = curT < -4 ? "1" : "0";
    }, { passive: false });
    card.addEventListener("touchend", () => {
      if (!dragging) return;
      dragging = false;
      card.style.transition = "transform 0.22s";
      if (dir === "h") {
        opened = curT < -36;
        card.style.transform = "translateX(" + (opened ? -72 : 0) + "px)";
        delBtn.style.opacity = opened ? "1" : "0";
      }
    });
    card.onclick = () => {
      if (moved) return;
      if (opened) { opened = false; card.style.transform = "translateX(0)"; delBtn.style.opacity = "0"; return; }
      openNoteDetail(note);
    };

    swipe.appendChild(card);
    row.appendChild(swipe);
    scroll.appendChild(row);
  });

  const fab = el("div", "");
  fab.style.cssText = "position:absolute;right:20px;bottom:calc(30px + env(safe-area-inset-bottom));width:58px;height:58px;border-radius:50%;background:" + accent + ";color:#fff;display:flex;align-items:center;justify-content:center;font-size:34px;font-weight:300;box-shadow:0 4px 16px rgba(0,0,0,0.22);cursor:pointer;z-index:6;";
  fab.textContent = "+";
  fab.onclick = () => openNoteCompose(null);
  panel.appendChild(fab);
}

/* ---------- 只读成品页 ---------- */
function openNoteDetail(note) {
  const accent = daysT().accent;
  const old = document.getElementById("note-detail");
  if (old) old.remove();
  const ov = el("div", "overlay-page");
  ov.id = "note-detail";
  ov.style.zIndex = "350";
  ov.style.background = "#ffffff";

  getImg("note_detail_bg").then(blob => {
    if (blob) {
      if (!urlCache.note_detail_bg) urlCache.note_detail_bg = URL.createObjectURL(blob);
      const bg = el("div", "overlay-bg");
      bg.style.backgroundImage = "url(" + urlCache.note_detail_bg + ")";
      ov.insertBefore(bg, ov.firstChild);
    }
  });

  const head = el("div", "");
  head.style.cssText = "display:flex;align-items:center;justify-content:space-between;padding:calc(14px + env(safe-area-inset-top)) 23px 10px;position:relative;z-index:1;";
  const back = el("button", "");
  back.style.cssText = "border:none;background:transparent;padding:4px;cursor:pointer;display:inline-flex;";
  back.innerHTML = noteBackArrow("#333", 26);
  back.onclick = () => ov.remove();
  const dots = el("button", "");
  dots.style.cssText = "border:none;background:transparent;padding:4px;cursor:pointer;display:inline-flex;";
  dots.innerHTML = noteThreeDots("#333", 24);
  dots.onclick = (e) => {
    showActions([
      { label: "换背景图", fn: () => {
          const f = document.createElement("input");
          f.type = "file"; f.accept = "image/*";
          f.onchange = async (ev) => {
            const fl = ev.target.files[0]; if (!fl) return;
            await putImg("note_detail_bg", fl);
            if (urlCache.note_detail_bg) { URL.revokeObjectURL(urlCache.note_detail_bg); delete urlCache.note_detail_bg; }
            openNoteDetail(note);
          };
          f.click();
        } },
      { label: "移除背景图", danger: true, fn: async () => {
          await delImg("note_detail_bg");
          if (urlCache.note_detail_bg) { URL.revokeObjectURL(urlCache.note_detail_bg); delete urlCache.note_detail_bg; }
          openNoteDetail(note);
        } }
    ], e.clientX, e.clientY);
  };
  head.appendChild(back);
  head.appendChild(dots);
  ov.appendChild(head);

  const body = el("div", "overlay-body");
  body.style.cssText = "flex:1;overflow-y:auto;padding:28px 23px calc(60px + env(safe-area-inset-bottom));position:relative;z-index:1;";
  const p = noteDateParts(note.time);

  const dRow = el("div", "");
  dRow.style.cssText = "display:flex;align-items:flex-end;gap:12px;margin:0;";
  const num = el("div", "", String(p.day).padStart(2, "0"));
  num.style.cssText = "font-size:36px;font-weight:300;line-height:0.9;color:" + NOTE_TEXT_INK + ";";
  const dInfo = el("div", "");
  dInfo.style.cssText = "font-size:12px;color:#b6b6b6;line-height:1.5;";
  dInfo.innerHTML = p.month + " / " + p.wk + "<br>" + p.hm;
  dRow.appendChild(num);
  dRow.appendChild(dInfo);
  if (note.decos && note.decos.length) {
    const deco = el("div", "");
    deco.style.cssText = "margin-left:auto;display:flex;align-items:center;gap:8px;padding-bottom:2px;";
    note.decos.forEach(k => {
      const sp = el("span", "");
      sp.style.cssText = "display:inline-flex;";
      sp.innerHTML = noteDecoIcon(k, accent, 22);
      deco.appendChild(sp);
    });
    dRow.appendChild(deco);
  }
  body.appendChild(dRow);

  const hr = el("div", "");
  hr.style.cssText = "height:1px;background:" + accent + ";opacity:0.6;margin:14px 0 21px;";
  body.appendChild(hr);

  if (note.text) {
    const tx = el("div", "", note.text);
    tx.style.cssText = noteTextStyle() + "color:" + NOTE_TEXT_INK + ";white-space:pre-wrap;word-break:break-word;margin-bottom:21px;";
    body.appendChild(tx);
  }
  if (note.img) {
    const im = el("img", "");
    im.src = note.img;
    im.style.cssText = "max-width:60%;border-radius:12px;display:block;margin-bottom:21px;";
    body.appendChild(im);
  }

  function meta(iconHtml, text) {
    const row = el("div", "");
    row.style.cssText = "display:flex;align-items:center;gap:10px;padding:7px 0;font-size:13px;color:" + NOTE_META_INK + ";";
    const ic = el("span", "");
    ic.style.cssText = "display:inline-flex;align-items:center;flex-shrink:0;width:20px;";
    ic.innerHTML = iconHtml;
    row.appendChild(ic);
    row.appendChild(el("span", "", text));
    body.appendChild(row);
  }
  if (note.weather && noteWeatherObj(note.weather)) meta(weatherIcon(note.weather, NOTE_META_INK, 18), noteWeatherObj(note.weather).name);
  if (note.location) meta(noteOptIcon("pin"), note.location);
  if (note.device) meta(noteOptIcon("phone"), note.device);
  if (note.showCount) meta(noteOptIcon("count"), (note.text || "").length + " 字");

  ov.appendChild(body);

  const fab = el("div", "");
  fab.style.cssText = "position:absolute;right:20px;bottom:calc(30px + env(safe-area-inset-bottom));width:54px;height:54px;border-radius:50%;background:" + accent + ";color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.22);cursor:pointer;z-index:6;";
  fab.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15.5 5.5l3 3M4 20l1-4L16 5a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2L8 19l-4 1Z"/></svg>';
  fab.onclick = () => { ov.remove(); openNoteCompose(note); };
  ov.appendChild(fab);

  document.body.appendChild(ov);
}

/* ---------- 写/编辑 ---------- */
function openNoteCompose(note) {
  const isEdit = !!note;
  const draft = {
    text: note ? (note.text || "") : "",
    img: note ? (note.img || null) : null,
    weather: note ? (note.weather || null) : null,
    location: note ? (note.location || null) : null,
    device: note ? (note.device || null) : null,
    showCount: note ? !!note.showCount : false,
    decos: note && note.decos ? note.decos.slice() : [],
    time: note ? note.time : Date.now()
  };
  const accent = daysT().accent;

  const old = document.getElementById("note-compose");
  if (old) old.remove();
  const ov = el("div", "overlay-page");
  ov.id = "note-compose";
  ov.style.zIndex = "360";
  ov.style.background = "#ffffff";

  const head = el("div", "overlay-head");
  const closeB = el("button", "");
  closeB.style.cssText = "border:none;background:transparent;padding:4px;cursor:pointer;font-size:24px;line-height:1;color:var(--text-main);";
  closeB.textContent = "✕";
  closeB.onclick = () => ov.remove();
  const center = el("div", "");
  center.style.cssText = "flex:1;text-align:center;";
  const dp = noteDateParts(draft.time);
  const isToday = dp.dayKey === noteDateParts(Date.now()).dayKey;
  const c1 = el("div", "", dp.mmdd);
  c1.style.cssText = "font-size:16px;font-weight:600;color:var(--text-main);";
  const c2 = el("div", "", dp.wk + " " + dp.hm + (isToday ? " 今天" : ""));
  c2.style.cssText = "font-size:12px;color:var(--text-faint);margin-top:2px;";
  center.appendChild(c1); center.appendChild(c2);
  const okB = el("button", "");
  okB.style.cssText = "border:none;background:transparent;padding:4px;cursor:pointer;font-size:24px;line-height:1;color:" + accent + ";";
  okB.textContent = "✓";
  head.appendChild(closeB); head.appendChild(center); head.appendChild(okB);
  ov.appendChild(head);

  const body = el("div", "overlay-body");
  body.style.cssText = "flex:1;overflow-y:auto;padding:10px 21px calc(20px + env(safe-area-inset-bottom));";
  ov.appendChild(body);

  const ta = document.createElement("textarea");
  ta.className = "form-textarea";
  ta.placeholder = "记录此刻...";
  ta.value = draft.text;
  ta.style.cssText = "min-height:150px;border:none;background:transparent;font-size:16px;line-height:1.9;padding:10px 2px;resize:none;overflow:hidden;display:block;width:100%;box-sizing:border-box;";
  function autoGrow() { ta.style.height = "auto"; ta.style.height = Math.max(150, ta.scrollHeight) + "px"; }
  ta.oninput = () => { draft.text = ta.value; countLab.textContent = draft.text.length + " 字"; autoGrow(); };
  body.appendChild(ta);
  setTimeout(autoGrow, 0);

  const file = document.createElement("input");
  file.type = "file"; file.accept = "image/*"; file.style.display = "none";
  file.onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    draft.img = await compressImage(f, 800, 0.75);
    e.target.value = ""; renderImg();
  };
  const imgWrap = el("div", "");
  imgWrap.style.cssText = "margin:67px 0 33px;";
  function renderImg() {
    imgWrap.innerHTML = "";
    imgWrap.appendChild(file);
    if (draft.img) {
      const im = el("img", "");
      im.src = draft.img;
      im.style.cssText = "max-width:130px;border-radius:14px;display:block;";
      const del = el("div", "", "移除图片");
      del.style.cssText = "font-size:12px;color:#e5484d;margin-top:6px;cursor:pointer;";
      del.onclick = () => { draft.img = null; renderImg(); };
      imgWrap.appendChild(im); imgWrap.appendChild(del);
    } else {
      const add = el("div", "");
      add.style.cssText = "width:94px;height:94px;border-radius:16px;background:#F6F6F6;display:flex;align-items:center;justify-content:center;cursor:pointer;";
      add.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
      add.onclick = () => file.click();
      imgWrap.appendChild(add);
    }
  }
  renderImg();
  body.appendChild(imgWrap);

  const opts = el("div", "");
  body.appendChild(opts);

  function optRow(iconHtml, text, onClick) {
    const row = el("div", "");
    row.style.cssText = "display:flex;align-items:center;gap:10px;padding:9px 2px;font-size:13px;color:" + NOTE_META_INK + ";" + (onClick ? "cursor:pointer;" : "");
    const ic = el("span", "");
    ic.style.cssText = "display:inline-flex;align-items:center;flex-shrink:0;width:20px;";
    ic.innerHTML = iconHtml;
    const lab = el("span", "", text);
    row.appendChild(ic); row.appendChild(lab);
    if (onClick) row.onclick = () => onClick(lab, ic);
    opts.appendChild(row);
    return lab;
  }

  optRow(
    draft.weather ? weatherIcon(draft.weather, NOTE_META_INK, 18) : noteSunPlain(),
    draft.weather ? noteWeatherObj(draft.weather).name : "选择天气",
    (lab, ic) => openNoteWeatherPicker(draft.weather, k => {
      draft.weather = k;
      ic.innerHTML = k ? weatherIcon(k, NOTE_META_INK, 18) : noteSunPlain();
      lab.textContent = k ? noteWeatherObj(k).name : "选择天气";
    })
  );
  optRow(noteOptIcon("pin"), draft.location || "自定义位置", (lab) => {
    openNoteLocationPicker(draft.location, v => {
      draft.location = v || null;
      lab.textContent = draft.location || "自定义位置";
    });
  });
  optRow(noteOptIcon("phone"), draft.device || "选择机型", (lab) => {
    openNoteDevicePicker(draft.device, v => {
      draft.device = v || null;
      lab.textContent = draft.device || "选择机型";
    });
  });
  const countLab = optRow(
    noteOptIcon("count", draft.showCount ? NOTE_META_INK : "#cfcfcf"),
    draft.text.length + " 字",
    (lab, ic) => {
      draft.showCount = !draft.showCount;
      ic.innerHTML = noteOptIcon("count", draft.showCount ? NOTE_META_INK : "#cfcfcf");
      lab.style.color = draft.showCount ? NOTE_META_INK : "#cfcfcf";
    }
  );
  if (!draft.showCount) countLab.style.color = "#cfcfcf";

  /* 底部装饰图标行：爱心 / 星芒 / 太阳 / 月亮 / 月亮带星星 / Zz / 音符 / 微信 */
  const decoBar = el("div", "");
  decoBar.style.cssText = "border-top:1px solid rgba(0,0,0,0.06);display:flex;flex-wrap:wrap;align-items:center;gap:18px;row-gap:14px;padding:14px 21px calc(14px + env(safe-area-inset-bottom));";
  ["heart", "spark", "sun", "moon", "sleep", "music"].forEach(k => {
    const btn = el("button", "");
    btn.style.cssText = "border:none;background:transparent;padding:2px;cursor:pointer;display:inline-flex;";
    const paint = () => { btn.innerHTML = noteDecoIcon(k, draft.decos.includes(k) ? accent : "#c2c2c2", 26); };
    paint();
    btn.onclick = () => {
      const i = draft.decos.indexOf(k);
      if (i >= 0) draft.decos.splice(i, 1); else draft.decos.push(k);
      paint();
    };
    decoBar.appendChild(btn);
  });
  ov.appendChild(decoBar);

  okB.onclick = () => {
    const t = draft.text.trim();
    if (!t && !draft.img) { toast("写点什么吧"); return; }
    if (isEdit) {
      note.text = t; note.img = draft.img; note.weather = draft.weather; note.location = draft.location;
      note.device = draft.device; note.showCount = draft.showCount; note.decos = draft.decos;
    } else {
      state.home.notes.push({ id: uid(), time: draft.time, text: t, img: draft.img, weather: draft.weather, location: draft.location, device: draft.device, showCount: draft.showCount, decos: draft.decos });
    }
    saveState();
    ov.remove();
    openNotebook();
  };

  document.body.appendChild(ov);
  ta.focus();
}

/* ---------- 天气选择器（9个） ---------- */
function openNoteWeatherPicker(cur, cb) {
  const accent = daysT().accent;
  const mask = el("div", "dialog-mask");
  const dlg = el("div", "dialog");
  dlg.style.maxWidth = "360px";
  dlg.appendChild(el("div", "dialog-title", "选择天气"));
  const grid = el("div", "");
  grid.style.cssText = "display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:6px 0;";
  NOTE_WEATHER.forEach(w => {
    const on = cur === w.k;
    const cell = el("div", "");
    cell.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:4px;padding:9px 0;border-radius:12px;cursor:pointer;" + (on ? "background:rgba(0,0,0,0.05);" : "");
    const ic = el("div", "");
    ic.style.cssText = "display:inline-flex;";
    ic.innerHTML = weatherIcon(w.k, on ? accent : "#3C3C43", 30);
    const nm = el("div", "", w.name);
    nm.style.cssText = "font-size:11px;color:var(--text-sub);";
    cell.appendChild(ic); cell.appendChild(nm);
    cell.onclick = () => { cb(w.k); mask.remove(); };
    grid.appendChild(cell);
  });
  dlg.appendChild(grid);
  const btns = el("div", "dialog-btns");
  const clr = el("button", "btn secondary", "清除");
  clr.onclick = () => { cb(null); mask.remove(); };
  const cancel = el("button", "btn secondary", "取消");
  cancel.onclick = () => mask.remove();
  btns.appendChild(clr); btns.appendChild(cancel);
  dlg.appendChild(btns);
  mask.appendChild(dlg);
  document.body.appendChild(mask);
}

/* ---------- 位置标签选择/管理 ---------- */
function openNoteLocationPicker(cur, cb) {
  const accent = daysT().accent;
  if (!Array.isArray(state.home.noteLocations)) state.home.noteLocations = [];
  const old = document.getElementById("note-loc");
  if (old) old.remove();
  const ov = el("div", "overlay-page");
  ov.id = "note-loc";
  ov.style.zIndex = "365";
  ov.style.background = "#F4F5F7";

  const head = el("div", "");
  head.style.cssText = "display:flex;align-items:center;gap:12px;padding:calc(14px + env(safe-area-inset-top)) 20px 10px;";
  const back = el("button", "");
  back.style.cssText = "border:none;background:transparent;padding:4px;cursor:pointer;display:inline-flex;";
  back.innerHTML = noteBackArrow("#333", 26);
  back.onclick = () => ov.remove();
  const title = el("div", "", "选择位置");
  title.style.cssText = "font-size:17px;font-weight:600;color:" + NOTE_TEXT_INK + ";";
  head.appendChild(back); head.appendChild(title);
  ov.appendChild(head);

  const scroll = el("div", "");
  scroll.style.cssText = "flex:1;overflow-y:auto;padding:8px 16px calc(96px + env(safe-area-inset-bottom));";
  ov.appendChild(scroll);

  function render() {
    scroll.innerHTML = "";
    const none = el("div", "");
    none.style.cssText = "background:#fff;border-radius:12px;padding:14px 14px;margin-bottom:10px;font-size:15px;color:#999;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.04);";
    none.textContent = "无位置";
    none.onclick = () => { cb(""); ov.remove(); };
    scroll.appendChild(none);

    (state.home.noteLocations || []).forEach((loc, idx) => {
      const card = el("div", "");
      card.style.cssText = "background:#fff;border-radius:12px;padding:14px 14px;margin-bottom:10px;display:flex;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,0.04);cursor:pointer;" + (cur === loc ? "outline:1.5px solid " + accent + ";" : "");
      const name = el("div", "", loc);
      name.style.cssText = "flex:1;font-size:15px;color:" + NOTE_TEXT_INK + ";";
      const menu = el("button", "");
      menu.style.cssText = "border:none;background:transparent;padding:4px;cursor:pointer;display:inline-flex;";
      menu.innerHTML = noteThreeDots("#c2c2c2");
      menu.onclick = (e) => {
        e.stopPropagation();
        showActions([
          { label: "删除", danger: true, fn: () => {
              state.home.noteLocations.splice(idx, 1);
              saveState(); render();
            } }
        ], e.clientX, e.clientY);
      };
      card.appendChild(name); card.appendChild(menu);
      card.onclick = () => { cb(loc); ov.remove(); };
      scroll.appendChild(card);
    });
  }
  render();

  const fab = el("div", "");
  fab.style.cssText = "position:absolute;right:20px;bottom:calc(30px + env(safe-area-inset-bottom));width:54px;height:54px;border-radius:50%;background:" + accent + ";color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:300;box-shadow:0 4px 16px rgba(0,0,0,0.22);cursor:pointer;z-index:6;";
  fab.textContent = "+";
  fab.onclick = () => {
    inputDialog("新建位置", "", v => {
      const t = (v || "").trim().slice(0, 50);
      if (!t) return;
      if (!state.home.noteLocations.includes(t)) state.home.noteLocations.push(t);
      saveState();
      cb(t); ov.remove();
    }, false);
  };
  ov.appendChild(fab);

  document.body.appendChild(ov);
}

/* ---------- 机型选择/管理 ---------- */
function openNoteDevicePicker(cur, cb) {
  const accent = daysT().accent;
  if (!Array.isArray(state.home.noteDevices)) {
    state.home.noteDevices = ["iPhone 15 Pro Max", "iPhone 15", "iPhone 14 Pro", "iPhone 13", "iPhone SE", "iPad Pro", "华为 Mate 60 Pro", "小米 14"];
    saveState();
  }
  const old = document.getElementById("note-device");
  if (old) old.remove();
  const ov = el("div", "overlay-page");
  ov.id = "note-device";
  ov.style.zIndex = "365";
  ov.style.background = "#F4F5F7";

  const head = el("div", "");
  head.style.cssText = "display:flex;align-items:center;gap:12px;padding:calc(14px + env(safe-area-inset-top)) 20px 10px;";
  const back = el("button", "");
  back.style.cssText = "border:none;background:transparent;padding:4px;cursor:pointer;display:inline-flex;";
  back.innerHTML = noteBackArrow("#333", 26);
  back.onclick = () => ov.remove();
  const title = el("div", "", "选择机型");
  title.style.cssText = "font-size:17px;font-weight:600;color:" + NOTE_TEXT_INK + ";";
  head.appendChild(back); head.appendChild(title);
  ov.appendChild(head);

  const scroll = el("div", "");
  scroll.style.cssText = "flex:1;overflow-y:auto;padding:8px 16px calc(96px + env(safe-area-inset-bottom));";
  ov.appendChild(scroll);

  function render() {
    scroll.innerHTML = "";
    const none = el("div", "");
    none.style.cssText = "background:#fff;border-radius:12px;padding:14px 14px;margin-bottom:10px;font-size:15px;color:#999;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,0.04);";
    none.textContent = "无机型";
    none.onclick = () => { cb(""); ov.remove(); };
    scroll.appendChild(none);

    (state.home.noteDevices || []).forEach((dev, idx) => {
      const card = el("div", "");
      card.style.cssText = "background:#fff;border-radius:12px;padding:14px 14px;margin-bottom:10px;display:flex;align-items:center;box-shadow:0 1px 3px rgba(0,0,0,0.04);cursor:pointer;" + (cur === dev ? "outline:1.5px solid " + accent + ";" : "");
      const name = el("div", "", dev);
      name.style.cssText = "flex:1;font-size:15px;color:" + NOTE_TEXT_INK + ";";
      const menu = el("button", "");
      menu.style.cssText = "border:none;background:transparent;padding:4px;cursor:pointer;display:inline-flex;";
      menu.innerHTML = noteThreeDots("#c2c2c2");
      menu.onclick = (e) => {
        e.stopPropagation();
        showActions([
          { label: "删除", danger: true, fn: () => {
              state.home.noteDevices.splice(idx, 1);
              saveState(); render();
            } }
        ], e.clientX, e.clientY);
      };
      card.appendChild(name); card.appendChild(menu);
      card.onclick = () => { cb(dev); ov.remove(); };
      scroll.appendChild(card);
    });
  }
  render();

  const fab = el("div", "");
  fab.style.cssText = "position:absolute;right:20px;bottom:calc(30px + env(safe-area-inset-bottom));width:54px;height:54px;border-radius:50%;background:" + accent + ";color:#fff;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:300;box-shadow:0 4px 16px rgba(0,0,0,0.22);cursor:pointer;z-index:6;";
  fab.textContent = "+";
  fab.onclick = () => {
    inputDialog("新建机型", "", v => {
      const t = (v || "").trim().slice(0, 50);
      if (!t) return;
      if (!state.home.noteDevices.includes(t)) state.home.noteDevices.push(t);
      saveState();
      cb(t); ov.remove();
    }, false);
  };
  ov.appendChild(fab);

  document.body.appendChild(ov);
}

/* ---------- 记事本搜索 ---------- */
function openNoteSearch() {
  const old = document.getElementById("note-search");
  if (old) old.remove();
  const ov = el("div", "overlay-page");
  ov.id = "note-search";
  ov.style.zIndex = "355";
  const head = el("div", "overlay-head");
  const inp = document.createElement("input");
  inp.placeholder = "搜索日记";
  inp.className = "form-input";
  inp.style.cssText = "flex:1;margin-right:8px;";
  const close = el("button", "seg-btn", "关闭");
  close.onclick = () => ov.remove();
  head.appendChild(inp); head.appendChild(close);
  ov.appendChild(head);
  const res = el("div", "overlay-body");
  ov.appendChild(res);
  document.body.appendChild(ov);
  inp.focus();

  inp.oninput = () => {
    const q = inp.value.trim().toLowerCase();
    res.innerHTML = "";
    if (!q) return;
    const hits = (state.home.notes || []).filter(n => (n.text || "").toLowerCase().indexOf(q) >= 0).sort((a, b) => b.time - a.time);
    if (!hits.length) {
      const e = el("div", "", "没搜到，换个词试试");
      e.style.cssText = "text-align:center;color:#bbb;padding:30px 0;font-size:13px;";
      res.appendChild(e);
      return;
    }
    hits.forEach(n => {
      const p = noteDateParts(n.time);
      const card = el("div", "");
      card.style.cssText = "background:rgba(0,0,0,0.03);border-radius:14px;padding:12px;margin-bottom:8px;cursor:pointer;";
      const h2 = el("div", "", p.mmdd + " " + p.hm);
      h2.style.cssText = "font-size:11px;color:#8e8e93;margin-bottom:4px;";
      const tx = el("div", "", (n.text || "").slice(0, 60));
      tx.style.cssText = "font-size:14px;line-height:1.6;";
      card.appendChild(h2); card.appendChild(tx);
      card.onclick = () => { ov.remove(); openNoteDetail(n); };
      res.appendChild(card);
    });
  };
}

/* ---------- 记忆手册:左上角返回键版 ---------- */
const MEM_CATS = ["日常", "约定", "喜好", "情绪"];

let memTab = "日常";   // 当前分类筛选
/* 记忆手册配色：读你已有的 mem* 八个变量，色盘调什么这里就出什么 */
function memCardBg() {
  const st = state.settings;
  return hslaOf(st.memHue, st.memSat, st.memLight, st.memAlpha);
}

function memBtnStyle() {
  const st = state.settings;
  return {
    bg: hslaOf(st.memBtnHue, st.memBtnSat, st.memBtnLight, st.memBtnAlpha),
    ink: st.memBtnLight < 55 ? "#ffffff" : "#1c1c1c"   // 按钮深就配白字，浅就配黑字
  };
}

/* 选图上传（只用于记忆手册的头像/背景） */
function memPickImage(key, cb) {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = "image/*";
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    await putImg(key, f);
    if (urlCache[key]) URL.revokeObjectURL(urlCache[key]);
    urlCache[key] = URL.createObjectURL(f);
    cb && cb();
  };
  inp.click();
}

/* 右上角 ⋯ 菜单 */
function memMoreMenu(ch) {
  const night = document.body.classList.contains("dark");
  const mask = el("div", "");
  mask.style.cssText = "position:fixed;inset:0;z-index:9999;";
  const sheet = el("div", "");
  sheet.style.cssText = "position:absolute;top:50px;right:20px;min-width:152px;border-radius:13px;padding:6px;box-shadow:0 8px 28px rgba(0,0,0,0.16);background:" + (night ? "#2a2a2c" : "#fff") + ";";
  const ink = night ? "#ececec" : "#2e2e30";
  const rerender = () => { const b = document.querySelector("#mem-book .overlay-body"); if (b) renderMemBook(b, ch); };
  const mk = (label, fn) => {
    const it = el("div", "", label);
    it.style.cssText = "padding:11px 14px;font-size:14px;color:" + ink + ";cursor:pointer;border-radius:9px;";
    it.onclick = () => { mask.remove(); fn(); };
    sheet.appendChild(it);
  };
  mk("上传角色头像", () => memPickImage("mem_avatar_" + ch.id, rerender));
  mk("上传背景图", () => memPickImage("bg_membook", () => openMemoryBook()));
  mk("移除背景图", async () => {
    await delImg("bg_membook");
    if (urlCache.bg_membook) { URL.revokeObjectURL(urlCache.bg_membook); delete urlCache.bg_membook; }
    openMemoryBook();
  });
  mask.onclick = () => mask.remove();
  mask.appendChild(sheet);
  document.body.appendChild(mask);
}

/* 跑一次总结：读最近对话 → 提炼 → 塞进待过目 */
async function runMemSummary(ch, s) {
  if (!s || !s.messages || !s.messages.length) return false;
  const recent = s.messages.filter(m => m.role !== "err").slice(-60)
    .map(m => (m.role === "user" ? "她：" : "我：") + msgText(m).slice(0, 100)).join(NL);
  const sys = "你是克。从下面的对话里提炼3到6条值得长期记住的记忆，每条一行，以减号开头，20字以内。只记事实、约定、喜好、重要事件，不记闲聊废话。人称铁律：她的事一律称'她'，你自己的事一律称'我'，绝不把她写成'我'，也不出现'你'。";
  const txt = await homeAsk(sys, recent);
  if (!txt) return false;
  let n = 0;
  txt.split(NL).map(x => x.replace(/^[-•\s]+/, "").trim())
    .filter(x => x.length > 1 && x.length < 60)
    .forEach(c => { ch.memPending.push(c); n++; });
  if (n) saveState();
  return n > 0;
}

async function openMemoryBook() {
  const old = document.getElementById("mem-book");
  if (old) old.remove();
  const ch = curRole();
  if (!ch.memories) ch.memories = [];
  if (!ch.memPending) ch.memPending = [];
  if (ch.memNick === undefined) ch.memNick = ch.aiName || ch.name || "";

  const night = document.body.classList.contains("dark");
  const ov = el("div", "overlay-page");
  ov.id = "mem-book";
  ov.style.background = night ? "#161618" : "#fafafa";

  const blob = await getImg("bg_membook");
  if (blob) {
    if (!urlCache.bg_membook) urlCache.bg_membook = URL.createObjectURL(blob);
    const bgEl = el("div", "overlay-bg");
    bgEl.style.backgroundImage = "url(" + urlCache.bg_membook + ")";
    ov.appendChild(bgEl);
  }
  const avKey = "mem_avatar_" + ch.id;
  if (!urlCache[avKey]) { const ab = await getImg(avKey); if (ab) urlCache[avKey] = URL.createObjectURL(ab); }

  const body = el("div", "overlay-body");
  body.style.padding = "4px 20px 48px";

  const headColor = night ? "#ececec" : "#131313";
  const head = el("div", "overlay-head");
  head.style.cssText = "display:flex;align-items:center;justify-content:space-between;background:transparent;padding:6px 18px;";
  const back = el("div", "", "‹");
  back.style.cssText = "font-size:26px;line-height:1;cursor:pointer;color:" + headColor + ";width:28px;";
  back.onclick = () => ov.remove();
  const title = el("div", "");
  title.style.cssText = "display:flex;align-items:center;gap:4px;font-size:16px;font-weight:600;letter-spacing:0.5px;color:" + headColor + ";";
  title.innerHTML = 'memory <span style="font-size:12px;opacity:0.55;">⌄</span>';
  const more = el("div", "", "⋯");
  more.style.cssText = "font-size:22px;line-height:1;cursor:pointer;color:" + headColor + ";width:28px;text-align:right;";
  more.onclick = () => {
    const ex = document.getElementById("mem-menu"); if (ex) { ex.remove(); return; }
    const menu = el("div", ""); menu.id = "mem-menu";
    menu.style.cssText = "position:absolute;top:50px;right:14px;z-index:40;min-width:132px;border-radius:12px;overflow:hidden;background:" + (night ? "#242426" : "#fff") + ";border:0.5px solid rgba(0,0,0,0.1);box-shadow:0 6px 20px rgba(0,0,0,0.15);";
    [["编辑昵称", () => inputDialog("修改昵称", ch.memNick || "", v => { if (v.trim()) { ch.memNick = v.trim(); saveState(); renderMemBook(body, ch); } })],
     ["更换头像", () => { if (typeof memPickImage === "function") memPickImage(avKey, () => renderMemBook(body, ch)); else toast("换头像点头像上的＋"); }]
    ].forEach(([t, fn], i, arr) => {
      const it = el("div", "", t);
      it.style.cssText = "padding:12px 16px;font-size:14px;cursor:pointer;color:" + headColor + (i < arr.length - 1 ? ";border-bottom:0.5px solid rgba(0,0,0,0.06)" : "");
      it.onclick = () => { menu.remove(); fn(); };
      menu.appendChild(it);
    });
    ov.appendChild(menu);
    setTimeout(() => { const close = e => { if (!menu.contains(e.target) && e.target !== more) { menu.remove(); document.removeEventListener("click", close); } }; document.addEventListener("click", close); }, 0);
  };
  head.appendChild(back); head.appendChild(title); head.appendChild(more);

  ov.appendChild(head);
  ov.appendChild(body);
  document.body.appendChild(ov);
  renderMemBook(body, ch);
}

function renderMemBook(body, ch) {
  body.innerHTML = "";
  const st = state.settings;
  const night = document.body.classList.contains("dark");
  const B = memBtnStyle();

  if (!document.getElementById("mem-style")) {
    const s = document.createElement("style"); s.id = "mem-style";
    s.textContent = ".mem-slider{-webkit-appearance:none;appearance:none;height:3px;border-radius:2px;outline:none;}.mem-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:13px;height:13px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,0.18);box-shadow:0 1px 2px rgba(0,0,0,0.25);cursor:pointer;}";
    document.head.appendChild(s);
  }

  const ink131 = night ? "#ececec" : "#131313";
  const lbl    = night ? "#a0a0a4" : "#6a6a6a";
  const sub    = night ? "#8a8a8e" : "#8f8f93";
  const line   = night ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.09)";

  const cardBg   = memCardBg();
  const cardDark = st.memLight < 45;
  const cardInk  = cardDark ? "#f0f0f0" : "#131313";
  const cardSub  = cardDark ? "#b0b0b4" : "#8f8f93";
  const cardLine = cardDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)";
  const cardStyle = "background:" + cardBg + ";border:0.5px solid " + cardLine + ";box-shadow:none;";

  body.style.background = urlCache.bg_membook ? "transparent" : (night ? "#161618" : "#fafafa");

  const avKey = "mem_avatar_" + ch.id;
  const cats = (typeof MEM_CATS !== "undefined" ? MEM_CATS : ["日常", "约定", "喜好", "情绪"]);

  const heart = (on, size, col) => '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="' + (on ? col : "none") + '" stroke="' + col + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20.5C11 19.6 4 14.6 4 9.4 4 6.5 6 4.6 8.4 4.6c1.5 0 2.8.8 3.6 2 .8-1.2 2.1-2 3.6-2C18 4.6 20 6.5 20 9.4c0 5.2-7 10.2-8 11.1z"/></svg>';

  /* 头部：头像＋ + 三列 */
  const total = ch.memories.length;
  const chars = ch.memories.reduce((n, m) => n + (m.text ? m.text.length : 0), 0);
  const coreN = ch.memories.filter(m => m.core).length;

  const headRow = el("div", ""); headRow.style.cssText = "display:flex;align-items:center;gap:20px;padding:8px 4px 14px;";
  const avWrap = el("div", ""); avWrap.style.cssText = "position:relative;flex-shrink:0;";
  const av = el("div", ""); av.style.cssText = "width:76px;height:76px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:" + (night ? "#2a2a2c" : "#ececec") + ";";
  if (urlCache[avKey]) { const im = document.createElement("img"); im.src = urlCache[avKey]; im.style.cssText = "width:100%;height:100%;object-fit:cover;"; av.appendChild(im); }
  else { const ph = el("div", "", (ch.memNick || ch.aiName || "·").slice(0, 1)); ph.style.cssText = "font-size:28px;color:" + sub + ";"; av.appendChild(ph); }
  const badge = el("div", "", "＋");
  badge.style.cssText = "position:absolute;right:-2px;bottom:-2px;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;cursor:pointer;background:" + B.bg + ";color:" + B.ink + ";border:2px solid " + (urlCache.bg_membook ? "transparent" : (night ? "#161618" : "#fafafa")) + ";";
  badge.onclick = () => { if (typeof memPickImage === "function") memPickImage(avKey, () => renderMemBook(body, ch)); };
  avWrap.appendChild(av); avWrap.appendChild(badge); headRow.appendChild(avWrap);

  const stats = el("div", ""); stats.style.cssText = "flex:1;display:flex;align-items:center;justify-content:space-around;";
  [["记忆", total], ["字数", chars], ["核心", coreN]].forEach(p => {
    const col = el("div", ""); col.style.cssText = "text-align:center;";
    const n = el("div", "", String(p[1])); n.style.cssText = "font-size:15px;font-weight:600;color:" + ink131 + ";line-height:1.1;";
    const l = el("div", "", p[0]); l.style.cssText = "font-size:11px;color:" + lbl + ";margin-top:5px;";
    col.appendChild(n); col.appendChild(l); stats.appendChild(col);
  });
  headRow.appendChild(stats); body.appendChild(headRow);

  /* 昵称 + 副标题在下 */
  const nameBox = el("div", ""); nameBox.style.cssText = "padding:0 4px 16px;";
  const nm = el("div", "", ch.memNick || ch.aiName || ""); nm.style.cssText = "font-size:18px;font-weight:700;color:" + ink131 + ";line-height:1.2;";
  const subt = el("div", "", "记忆手册 · " + (ch.aiName || "")); subt.style.cssText = "font-size:12px;color:" + lbl + ";margin-top:4px;";
  nameBox.appendChild(nm); nameBox.appendChild(subt); body.appendChild(nameBox);

  /* 两个矮按钮（带一点层次） */
  const actions = el("div", ""); actions.style.cssText = "display:flex;gap:10px;margin-bottom:14px;";
  const sumBtn = el("button", "", "总结对话");
  sumBtn.style.cssText = "flex:1;height:36px;border:none;border-radius:11px;font-size:13.5px;font-weight:600;cursor:pointer;background:" + B.bg + ";color:" + B.ink + ";box-shadow:0 1px 3px rgba(0,0,0,0.12);";
  sumBtn.onclick = async () => {
    const s = curSession();
    if (!s || !s.messages || !s.messages.length) { toast("这会话还没聊呢"); return; }
    sumBtn.textContent = "回忆中…"; sumBtn.disabled = true;
    const recent = s.messages.filter(m => m.role !== "err").slice(-60).map(m => (m.role === "user" ? "她：" : "我：") + msgText(m).slice(0, 100)).join(NL);
    const sys = "你是克。从下面的对话里提炼3到6条值得长期记住的记忆，每条一行，以减号开头，20字以内。只记事实、约定、喜好、重要事件，不记闲聊废话。人称铁律：她的事一律称'她'，你自己的事一律称'我'，绝不把她写成'我'，也不出现'你'。";
    const txt = await homeAsk(sys, recent);
    if (txt) { txt.split(NL).map(x => x.replace(/^[-•\s]+/, "").trim()).filter(x => x.length > 1 && x.length < 60).forEach(c => ch.memPending.push(c)); saveState(); renderMemBook(body, ch); }
    else { sumBtn.textContent = "总结对话"; sumBtn.disabled = false; }
  };
  const addBtn = el("button", "", "＋ 手写记忆");
  addBtn.style.cssText = "flex:1;height:36px;border:0.5px solid " + line + ";border-radius:11px;font-size:13.5px;font-weight:600;cursor:pointer;background:" + (night ? "#1c1c1e" : "#fff") + ";color:" + ink131 + ";box-shadow:0 1px 3px rgba(0,0,0,0.08);";
  addBtn.onclick = () => inputDialog("新记忆", "", v => { if (v.trim()) { ch.memories.push({ id: uid(), text: v.trim(), checked: true, core: false, cat: cats[0] }); saveState(); renderMemBook(body, ch); } }, true);
  actions.appendChild(sumBtn); actions.appendChild(addBtn); body.appendChild(actions);

  /* 提醒总结 */
  const setCard = el("div", ""); setCard.style.cssText = cardStyle + "border-radius:14px;padding:12px 15px;margin-bottom:16px;";
  const swRow = el("div", ""); swRow.style.cssText = "display:flex;align-items:center;justify-content:space-between;";
  const swL = el("div", "", "聊够条数提醒总结"); swL.style.cssText = "font-size:13.5px;color:" + cardInk + ";";
  const on = st.sumRemindOn;
  const tog = el("div", ""); tog.style.cssText = "width:44px;height:26px;border-radius:13px;position:relative;cursor:pointer;flex-shrink:0;transition:background .2s;background:" + (on ? B.bg : (night ? "rgba(255,255,255,0.2)" : "#dcdce0")) + ";";
  const knob = el("div", ""); knob.style.cssText = "position:absolute;top:4px;left:" + (on ? "22px" : "4px") + ";width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,0.25);transition:left .2s;";
  tog.appendChild(knob);
  tog.onclick = () => { st.sumRemindOn = !st.sumRemindOn; saveState(); renderMemBook(body, ch); };
  swRow.appendChild(swL); swRow.appendChild(tog); setCard.appendChild(swRow);
  if (on) {
    const slRow = el("div", ""); slRow.style.cssText = "display:flex;align-items:center;gap:12px;margin-top:13px;padding-top:13px;border-top:0.5px solid " + cardLine + ";";
    const sl = document.createElement("input"); sl.type = "range"; sl.min = "10"; sl.max = "300"; sl.step = "10"; sl.value = st.sumEvery || 100;
    sl.className = "mem-slider"; sl.style.cssText = "flex:1;background:" + cardLine + ";accent-color:" + B.bg + ";";
    const slV = el("span", "", (st.sumEvery || 100) + " 条"); slV.style.cssText = "font-size:12px;color:" + cardSub + ";min-width:48px;text-align:right;";
    sl.oninput = () => { st.sumEvery = Number(sl.value); slV.textContent = sl.value + " 条"; saveState(); };
    slRow.appendChild(sl); slRow.appendChild(slV); setCard.appendChild(slRow);
  }
  body.appendChild(setCard);

  /* 待过目 */
  if (ch.memPending.length) {
    const pT = el("div", "", "待你过目"); pT.style.cssText = "font-size:11px;font-weight:600;letter-spacing:1px;color:" + lbl + ";margin:0 2px 8px;"; body.appendChild(pT);
    ch.memPending.forEach((p, i) => {
      const c = el("div", ""); c.style.cssText = cardStyle + "border-radius:14px;padding:12px 15px;margin-bottom:8px;";
      const t = el("div", "", p); t.style.cssText = "font-size:14px;line-height:1.6;color:" + cardInk + ";margin-bottom:10px;"; c.appendChild(t);
      const btns = el("div", ""); btns.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";
      const no = el("button", "", "丢掉"); no.style.cssText = "border:0.5px solid " + cardLine + ";border-radius:14px;padding:5px 15px;font-size:12.5px;cursor:pointer;background:transparent;color:" + cardSub + ";";
      no.onclick = () => { ch.memPending.splice(i, 1); saveState(); renderMemBook(body, ch); };
      const ok = el("button", "", "收下"); ok.style.cssText = "border:none;border-radius:14px;padding:5px 15px;font-size:12.5px;font-weight:600;cursor:pointer;background:" + B.bg + ";color:" + B.ink + ";";
      ok.onclick = () => { ch.memories.push({ id: uid(), text: p, checked: false, core: false, cat: cats[0] }); ch.memPending.splice(i, 1); saveState(); renderMemBook(body, ch); };
      btns.appendChild(no); btns.appendChild(ok); c.appendChild(btns); body.appendChild(c);
    });
    const gap = el("div", ""); gap.style.height = "6px"; body.appendChild(gap);
  }

  /* 记忆：按四组分区 */
  const renderCard = (m) => {
    const idx = ch.memories.indexOf(m);
    const c = el("div", ""); c.style.cssText = cardStyle + "border-radius:14px;padding:11px 15px;margin-bottom:9px;" + (m.core ? "border-color:" + B.bg + ";" : "");
    const t = el("div", "", m.text); t.style.cssText = "font-size:14.5px;line-height:1.6;cursor:pointer;color:" + ((m.checked || m.core) ? cardInk : cardSub) + ";";
    t.onclick = () => inputDialog("编辑记忆", m.text, v => { if (v.trim()) { m.text = v.trim(); saveState(); renderMemBook(body, ch); } }, true);
    c.appendChild(t);
    const meta = el("div", ""); meta.style.cssText = "display:flex;align-items:center;gap:12px;margin-top:16px;padding-top:9px;border-top:0.5px solid " + cardLine + ";";
    const hs = el("span", ""); hs.style.cssText = "cursor:pointer;display:flex;align-items:center;";
    hs.innerHTML = heart(m.core, 16, m.core ? B.bg : cardSub);
    hs.onclick = () => { m.core = !m.core; if (m.core) m.checked = true; saveState(); renderMemBook(body, ch); };
    meta.appendChild(hs);
    const en = el("span", "", (m.checked || m.core) ? "已启用" : "未启用"); en.style.cssText = "font-size:11.5px;cursor:pointer;color:" + ((m.checked || m.core) ? cardInk : cardSub) + ";";
    en.onclick = () => { if (m.core) { toast("核心记忆随身携带，取消爱心才能停用"); return; } m.checked = !m.checked; saveState(); renderMemBook(body, ch); };
    meta.appendChild(en);
    const sp = el("div", ""); sp.style.flex = "1"; meta.appendChild(sp);
    const chip = el("span", "", m.cat || cats[0]); chip.style.cssText = "font-size:11px;color:" + cardSub + ";border:0.5px solid " + cardLine + ";border-radius:9px;padding:3px 10px;cursor:pointer;";
    chip.onclick = () => { const i = cats.indexOf(m.cat || cats[0]); m.cat = cats[(i + 1) % cats.length]; saveState(); renderMemBook(body, ch); };
    meta.appendChild(chip);
    const del = el("span", "", "✕"); del.style.cssText = "font-size:13px;cursor:pointer;color:" + cardSub + ";opacity:0.6;padding:0 2px;";
    del.onclick = () => confirmDialog("删除这条记忆？", () => { ch.memories.splice(idx, 1); saveState(); renderMemBook(body, ch); });
    meta.appendChild(del);
    c.appendChild(meta); body.appendChild(c);
  };

  let shown = 0;
  cats.forEach(cat => {
    const items = ch.memories.filter(m => (m.cat || cats[0]) === cat).sort((a, b) => (b.core ? 1 : 0) - (a.core ? 1 : 0));
    if (!items.length) return;
    const secH = el("div", "", cat); secH.style.cssText = "font-size:12px;font-weight:600;letter-spacing:0.5px;color:" + lbl + ";margin:16px 2px 9px;";
    body.appendChild(secH);
    items.forEach(renderCard);
    shown += items.length;
  });

  if (!shown && !ch.memPending.length) {
    const e = el("div", "", "记忆本还空着\n我们的日子会慢慢填满它");
    e.style.cssText = "text-align:center;color:" + lbl + ";font-size:13px;line-height:1.9;white-space:pre-wrap;padding:48px 0;";
    body.appendChild(e);
  }
}

/* ---------- 搜索 ---------- */
function openSearch() {
  const old = document.getElementById("search-overlay");
  if (old) old.remove();
  const ov = el("div", "overlay-page");
  ov.id = "search-overlay";

  const head = el("div", "overlay-head");
  const inp = document.createElement("input");
  inp.placeholder = "搜我们说过的话...";
  inp.className = "form-input";
  inp.style.cssText = "flex:1;margin-right:8px;";
  const close = el("button", "seg-btn", "关闭");
  close.onclick = () => ov.remove();
  head.appendChild(inp);
  head.appendChild(close);
  ov.appendChild(head);
  const res = el("div", "overlay-body");
  ov.appendChild(res);
  document.body.appendChild(ov);
  inp.focus();

  inp.oninput = () => {
    const q = inp.value.trim().toLowerCase();
    res.innerHTML = "";
    if (q.length < 1) return;
    const r = curRole();
    let hits = 0;
    r.sessions.forEach(s => {
      (s.messages || []).forEach(m => {
        if (m.role === "err") return;
        const t = msgText(m);
        if (hits >= 50 || t.toLowerCase().indexOf(q) < 0) return;
        hits++;
        const card = el("div", "");
        card.style.cssText = "background:rgba(0,0,0,0.03);border-radius:14px;padding:12px;margin-bottom:8px;";
        const head2 = el("div", "", (m.role === "user" ? "你" : "他") + " · " + s.name);
        head2.style.cssText = "font-size:11px;color:#8e8e93;margin-bottom:4px;";
        const idx = t.toLowerCase().indexOf(q);
        const snip = (idx > 20 ? "..." : "") + t.slice(Math.max(0, idx - 20), idx + q.length + 40);
        const bodyEl = el("div", "", snip);
        bodyEl.style.cssText = "font-size:13px;line-height:1.6;";
        card.appendChild(head2);
        card.appendChild(bodyEl);
        card.onclick = () => {
          r.currentSessionId = s.id;
          saveState();
          renderAll();
          ov.remove();
          setTimeout(() => {
            const target = document.querySelector('.msg-row[data-id="' + m.id + '"]');
            if (target) {
              target.scrollIntoView({ block: "center" });
              target.style.transition = "background 0.4s";
              target.style.background = "rgba(255,200,120,0.25)";
              setTimeout(() => { target.style.background = ""; }, 1600);
            }
          }, 400);
        };
        res.appendChild(card);
      });
    });
    if (!hits) {
      const e = el("div", "", "没搜到，换个词试试");
      e.style.cssText = "text-align:center;color:#bbb;padding:30px 0;font-size:13px;";
      res.appendChild(e);
    }
  };
}

/* ---------- 小菜单 ---------- */
function miniIcon(kind) {
  const s = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const P = {
    search: '<circle cx="10.5" cy="10.5" r="6" ' + s + '/><path d="M15 15 L20 20" ' + s + '/>',
    mem: '<path d="M12 6.3 C10 5 7 4.7 4.5 5.5 V18.3 C7 17.5 10 17.8 12 19.2 c2 -1.4 5 -1.7 7.5 -0.9 V5.5 C17 4.7 14 5 12 6.3 Z" ' + s + '/><path d="M12 6.3 V19.2" ' + s + '/>',
    trash: '<path d="M5 7h14M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M7 7l1 12a1.5 1.5 0 0 0 1.5 1.4h5a1.5 1.5 0 0 0 1.5-1.4L17 7M10 11v5M14 11v5" ' + s + '/>',
    branch: '<circle cx="7" cy="6" r="2.3" ' + s + '/><circle cx="7" cy="18" r="2.3" ' + s + '/><circle cx="17" cy="8.5" r="2.3" ' + s + '/><path d="M7 8.3 V15.7" ' + s + '/><path d="M17 10.8 c0 3.4 -3 4.5 -6.6 4.95" ' + s + '/>'
  };
  return '<svg viewBox="0 0 24 24" width="19" height="19">' + (P[kind] || "") + '</svg>';
}

function toggleMiniMenu() {
  const old = document.getElementById("mini-menu");
  if (old) { old.remove(); return; }
  const night = state.settings.skin === "night";
  const m = el("div", "");
  m.id = "mini-menu";
  m.style.cssText = "position:fixed;right:14px;bottom:96px;background:rgba(255,255,255,0.94);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:16px;box-shadow:0 6px 24px rgba(0,0,0,0.12);z-index:180;overflow:hidden;min-width:184px;";
  if (night) m.style.background = "rgba(50,48,52,0.95)";
  const items = [
    { t: "搜索聊天", ic: "search", f: () => { m.remove(); openSearch(); } },
    { t: "记忆手册", ic: "mem", f: () => { m.remove(); openMemoryBook(); } },
    { t: "多选删除", ic: "trash", f: () => { m.remove(); enterMultiMode(null); } },
    { t: "创建分支", ic: "branch", f: () => { m.remove(); branchSession(); } }
  ];
  items.forEach((it, i) => {
    const r = el("div", "");
       r.style.cssText = "display:flex;align-items:center;justify-content:space-between;gap:16px;padding:9px 16px;font-size:14px;color:var(--text-main);" +
      (i ? ("border-top:1px solid " + (night ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)") + ";") : "");
    const lab = el("span", "", it.t);
    const icn = el("span", "");
    icn.style.cssText = "display:inline-flex;opacity:0.82;";
    icn.innerHTML = miniIcon(it.ic);
    r.appendChild(lab);
    r.appendChild(icn);
    r.onclick = it.f;
    m.appendChild(r);
  });
  document.body.appendChild(m);
  setTimeout(() => {
    document.addEventListener("click", function h(e) {
      if (!m.contains(e.target) && e.target.id !== "mini-menu-btn") {
        m.remove();
        document.removeEventListener("click", h);
      }
    });
  }, 60);
}

/* ---------- 总结提醒:shown会复位 ---------- */
function startSumWatch() {
  let shown = false;
  setInterval(() => {
    if (!state.settings.sumRemindOn || shown) return;
    const s = curSession();
    if (!s || !s.messages) return;
    if (s.messages.length - state.home.lastSumLen >= state.settings.sumEvery) {
      shown = true;
      const bar = el("div", "");
      bar.style.cssText = "position:fixed;left:16px;right:16px;bottom:96px;background:rgba(255,255,255,0.96);border-radius:16px;padding:12px 14px;box-shadow:0 4px 20px rgba(0,0,0,0.12);z-index:150;font-size:13px;display:flex;align-items:center;gap:8px;";
      const t = el("span", "", "又攒了一堆话，要收进记忆吗？");
      t.style.flex = "1";
      const go = el("button", "seg-btn", "去总结");
      go.onclick = () => {
        state.home.lastSumLen = s.messages.length;
        saveState();
        bar.remove();
        shown = false;
        openMemoryBook();
      };
      const no = el("button", "seg-btn", "先不");
      no.onclick = () => { state.home.lastSumLen = s.messages.length; saveState(); bar.remove(); shown = false; };
      bar.appendChild(t); bar.appendChild(go); bar.appendChild(no);
      document.body.appendChild(bar);
    }
  }, 30000);
}

/* ---------- 回底小箭头 ---------- */
function initScrollArrow() {
  const box = $("#chat-area");
  const arrow = el("div", "", "↓");
  arrow.style.cssText = "position:fixed;right:16px;bottom:110px;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.92);box-shadow:0 2px 10px rgba(0,0,0,0.15);display:none;align-items:center;justify-content:center;font-size:18px;color:#666;z-index:50;";
  document.body.appendChild(arrow);
  arrow.onclick = () => {
    box.scrollTop = box.scrollHeight;
    arrow.style.display = "none";
  };
  box.addEventListener("scroll", () => {
    arrow.style.display = nearBottom(box) ? "none" : "flex";
  });
}

/* ---------- 键盘贴合 ---------- */
function initKeyboardFix() {
  const ia = $("#input-area");
  const area = $("#chat-area");
  const input = $("#input-text");
  const root = document.documentElement;
  const vv = window.visualViewport;
  let keyboardGap = 0;
  let raf = 0;
  let timer = 0;

  function resetScroll() {
    window.scrollTo(0, 0);
    document.body.scrollTop = 0;
  }

  function syncReserve() {
    const reserve = Math.ceil(ia.offsetHeight) + 8;
    root.style.setProperty("--input-reserve", reserve + "px");
    area.style.paddingBottom = keyboardGap ? keyboardGap + reserve + "px" : "";
  }

  if (window.ResizeObserver) {
    ia._reserveObserver = new ResizeObserver(syncReserve);
    ia._reserveObserver.observe(ia);
  } else {
    input.addEventListener("input", syncReserve);
    window.addEventListener("resize", syncReserve);
  }

  syncReserve();

  if (!vv) {
    document.addEventListener("focusout", () => {
      keyboardGap = 0;
      ia.style.transform = "";
      syncReserve();
      setTimeout(resetScroll, 80);
    });
    return;
  }

  function fit() {
    if (document.activeElement !== input) {
      keyboardGap = 0;
      ia.style.transform = "";
      syncReserve();
      return;
    }
    const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    keyboardGap = gap > 40 ? gap : 0;
    ia.style.transform = keyboardGap ? "translateY(-" + keyboardGap + "px)" : "";
    syncReserve();
    if (keyboardGap) area.scrollTop = area.scrollHeight;
    resetScroll();
  }

  function scheduleFit() {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = 0;
      fit();
    });
  }

  vv.addEventListener("resize", scheduleFit);
  vv.addEventListener("scroll", scheduleFit);

  input.addEventListener("focus", () => {
    clearInterval(timer);
    let count = 0;
    timer = setInterval(() => {
      fit();
      if (++count > 20) {
        clearInterval(timer);
        timer = 0;
      }
    }, 50);
  });

  document.addEventListener("focusout", () => {
    clearInterval(timer);
    timer = 0;
    setTimeout(() => {
      fit();
      resetScroll();
    }, 90);
  });
}

/* ---------- 总渲染 ---------- */
async function renderAll() {
  renderSidebar();
  renderModelBtn();
  await renderMessages();
}

/* ---------- 事件绑定 ---------- */
function bindEvents() {
  $("#menu-btn").onclick = openSidebar;
  $("#sidebar-mask").onclick = closeSidebar;
  $("#new-session-btn").onclick = newSession;

  $("#menu-theme").onclick = () => { themeTab = ""; buildThemePanel(); openPanel("#theme-panel"); };
  $("#menu-role").onclick = () => { renderRolePage(); openPanel("#role-panel"); };
  $("#menu-memory").onclick = () => { closeSidebar(); openMemoryBook(); };
  $("#menu-days").onclick = () => { buildDaysPanel(); openPanel("#days-panel"); };
  $("#settings-btn").onclick = () => { fillProviderForm(); renderProviderBar(); buildSettingsExtras(); settingsTab = ""; buildSettingsMenu(); openPanel("#settings-panel"); };

  $("#sidebar-role").onclick = () => { renderRolePage(); openPanel("#role-panel"); };

  $("#theme-back").onclick = () => {
    if (themeTab) {
      themeTab = "";
      buildThemePanel();
    } else {
      closePanel("#theme-panel");
    }
  };

  $("#role-back").onclick = () => closePanel("#role-panel");
  $("#settings-back").onclick = () => {
    if (settingsTab) {
      settingsTab = "";
      buildSettingsMenu();
      $("#settings-panel").scrollTop = 0;
    } else {
      closePanel("#settings-panel");
    }
  };

  $("#send-btn").onclick = sendMessage;
  $("#model-btn").onclick = toggleModelPopup;
  $("#mini-menu-btn").onclick = (ev) => { ev.stopPropagation(); toggleMiniMenu(); };
  $("#attach-btn").onclick = () => $("#attach-input").click();
  $("#attach-input").addEventListener("change", pickImage);

  const input = $("#input-text");
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  });

  $("#save-settings-btn").onclick = saveSettingsForm;
  $("#fetch-models-btn").onclick = fetchModels;
     (function () {
    const eyeBtn = $("#apikey-eye");
    const keyInput = $("#set-apikey");
    if (!eyeBtn || !keyInput) return;
    const EYE_OPEN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
    const EYE_SHUT = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l16 16"/><path d="M9.6 5.8A9.4 9.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15.3 15.3 0 0 1-2.6 3.2M6.3 7.4A15.2 15.2 0 0 0 2.5 12S6 18.5 12 18.5c1.2 0 2.3-.2 3.3-.6"/></svg>';
    eyeBtn.innerHTML = EYE_SHUT;
    eyeBtn.onclick = () => {
      if (keyInput.type === "password") {
        keyInput.type = "text";
        eyeBtn.innerHTML = EYE_OPEN;
      } else {
        keyInput.type = "password";
        eyeBtn.innerHTML = EYE_SHUT;
      }
    };
  })();

  $("#new-role-btn").onclick = newRole;

  $("#export-json-btn").onclick = exportData;
  $("#import-json-input").addEventListener("change", importData);
  $("#export-txt-btn").onclick = toggleExportMode;
  $("#export-txt-confirm").onclick = doExportTxt;
  $("#export-txt-cancel").onclick = toggleExportMode;

  $("#multi-del-confirm").onclick = doMultiDelete;
  $("#multi-del-cancel").onclick = exitMultiMode;

  document.addEventListener("click", (e) => {
    const pop = $("#model-popup");
    if (pop.classList.contains("show") && !pop.contains(e.target) && e.target.id !== "model-btn") {
      pop.classList.remove("show");
    }
    const ppop = $("#provider-popup");
    if (ppop.classList.contains("show") && !ppop.contains(e.target) && !$("#provider-bar").contains(e.target)) {
      ppop.classList.remove("show");
    }
  });
}

/* ---------- 启动 ---------- */
async function init() {
  loadState();
  await openDB();
  applyTheme();
  applyLayout();
  applyChatTypo();
  applyBubbleBox();
  await applyBg();
  bindEvents();
  initScrollArrow();
  initKeyboardFix();
  await renderAll();
  startSumWatch();
}

init();

/* ========== S5结束 · 全文件完 ========== */

