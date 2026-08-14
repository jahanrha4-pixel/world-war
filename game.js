/* ==========================================================================
   WORD WAR — game.js
   منطق اصلی بازی — ماژولار بر اساس سیستم‌های مستقل
   ========================================================================== */

"use strict";

const SAVE_KEY = "wordwar_save_v1";

/* ==========================================================================
   STATE — وضعیت کلی بازی (در حافظه)
   ========================================================================== */
const State = {
  playerCountryId: null,
  countries: {},      // کپی زنده از COUNTRIES_DATA + وضعیت پویا
  straits: {},         // کپی زنده از STRAITS_DATA
  regions: [],          // کپی زنده از REGIONS_DATA
  alliances: [],         // {id,name,flag,rules,leaderId,members:[]}
  groups: [],             // {id,name,desc,leaderId,members:[],level,invites:[]}
  wars: [],                 // {id,a,b,status,startTick}
  statements: [],             // {id,countryId,issuer,subject,location,text,lang,time}
  news: [],                     // {id,text,time}
  purchaseHistory: [],           // {id,itemName,qty,cost,time}
  playerStatus: "peace",          // peace | tension | war | siege | ceasefire
  inShelter: false,
  tick: 0,
};

function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}

/* ==========================================================================
   INIT / NEW GAME
   ========================================================================== */
function initFreshState(playerId) {
  State.playerCountryId = playerId;
  State.countries = {};
  Object.keys(COUNTRIES_DATA).forEach((id) => {
    const c = COUNTRIES_DATA[id];
    State.countries[id] = {
      ...c,
      resources: { ...c.resources },
      military: { ...c.military },
      money: c.money,
      status: "peace",       // peace | tension | war | siege | ceasefire
      allies: [],
      enemies: [],
      allianceId: null,
      controlledRegions: REGIONS_DATA.filter(r => r.ownerId === id).map(r => r.id),
    };
  });
  State.straits = {};
  Object.keys(STRAITS_DATA).forEach((id) => {
    State.straits[id] = { ...STRAITS_DATA[id], blocked: false };
  });
  State.regions = REGIONS_DATA.map(r => ({ ...r }));
  State.alliances = [];
  State.groups = [];
  State.wars = [];
  State.statements = [];
  State.news = [];
  State.purchaseHistory = [];
  State.playerStatus = "peace";
  State.inShelter = false;
  State.tick = 0;

  NewsSystem.push(`🪖🚀 بازی آغاز شد. فرمانده ${player().flag} ${player().name} کنترل را در دست گرفت.`);
}

function player() { return State.countries[State.playerCountryId]; }
function countryList() { return COUNTRY_ORDER.map(id => State.countries[id]); }
function otherCountries() { return countryList().filter(c => c.id !== State.playerCountryId); }

/* ==========================================================================
   NEWS SYSTEM
   ========================================================================== */
const NewsSystem = {
  push(text) {
    State.news.unshift({ id: uid("news"), text, time: Date.now() });
    if (State.news.length > 200) State.news.length = 200;
    UI.renderNewsStrip();
    UI.renderNewsPanel();
    UI.showToast(text);
  },
};

/* ==========================================================================
   ECONOMY / INVENTORY SYSTEM
   ========================================================================== */
const EconomySystem = {
  tickIncome() {
    countryList().forEach(c => {
      c.money += c.income - c.upkeep;
      if (c.money < 0) c.money = 0;
    });
  },
  buy(itemKey, qty, category) {
    const p = player();
    let def;
    if (category === "resources") def = SHOP_DATA.resources.find(i => i.key === itemKey);
    if (category === "equipment") def = SHOP_DATA.equipment.find(i => i.key === itemKey);
    if (category === "strategic") def = SHOP_DATA.strategic.find(i => i.key === itemKey);
    if (!def || qty <= 0) return { ok: false, msg: "مورد نامعتبر است." };

    const cost = def.price * qty;
    if (p.money < cost) return { ok: false, msg: "پول کافی نیست." };

    p.money -= cost;
    if (category === "resources") {
      p.resources[itemKey] = (p.resources[itemKey] || 0) + qty;
    } else if (category === "equipment") {
      p.military[itemKey] = (p.military[itemKey] || 0) + qty;
    } else if (category === "strategic") {
      p.resources["strategic_" + itemKey] = (p.resources["strategic_" + itemKey] || 0) + qty;
    }

    InventorySystem.logPurchase(def.name, qty, cost);
    return { ok: true };
  },
};

const InventorySystem = {
  logPurchase(itemName, qty, cost) {
    State.purchaseHistory.unshift({
      id: uid("buy"), itemName, qty, cost, time: Date.now(),
    });
    if (State.purchaseHistory.length > 100) State.purchaseHistory.length = 100;
  },
};

/* ==========================================================================
   DIPLOMACY SYSTEM
   ========================================================================== */
const DiplomacySystem = {
  relation(aId, bId) {
    const a = State.countries[aId];
    if (a.allies.includes(bId)) return "ally";
    if (a.enemies.includes(bId)) return "enemy";
    return "neutral";
  },
  setAllies(aId, bId) {
    const a = State.countries[aId], b = State.countries[bId];
    if (!a.allies.includes(bId)) a.allies.push(bId);
    if (!b.allies.includes(aId)) b.allies.push(aId);
    a.enemies = a.enemies.filter(x => x !== bId);
    b.enemies = b.enemies.filter(x => x !== aId);
  },
  setEnemies(aId, bId) {
    const a = State.countries[aId], b = State.countries[bId];
    if (!a.enemies.includes(bId)) a.enemies.push(bId);
    if (!b.enemies.includes(aId)) b.enemies.push(aId);
    a.allies = a.allies.filter(x => x !== bId);
    b.allies = b.allies.filter(x => x !== aId);
  },
};

/* ==========================================================================
   ALLIANCE SYSTEM
   ========================================================================== */
const AllianceSystem = {
  create(name, flag, rules, inviteIds) {
    const p = player();
    if (p.allianceId) return { ok: false, msg: "کشور شما همین حالا عضو یک اتحاد است." };
    const alliance = {
      id: uid("alliance"),
      name, flag: flag || "🛡️", rules: rules || "",
      leaderId: p.id,
      members: [p.id, ...inviteIds],
    };
    State.alliances.push(alliance);
    p.allianceId = alliance.id;
    inviteIds.forEach(id => {
      State.countries[id].allianceId = alliance.id;
      DiplomacySystem.setAllies(p.id, id);
    });
    NewsSystem.push(`🤝 اتحاد جدید «${alliance.flag} ${alliance.name}» توسط ${p.flag} ${p.name} تشکیل شد.`);
    return { ok: true, alliance };
  },
  invite(allianceId, countryId) {
    const alliance = State.alliances.find(a => a.id === allianceId);
    if (!alliance) return;
    if (!alliance.members.includes(countryId)) {
      alliance.members.push(countryId);
      State.countries[countryId].allianceId = alliance.id;
      DiplomacySystem.setAllies(alliance.leaderId, countryId);
      NewsSystem.push(`🤝 ${State.countries[countryId].flag} ${State.countries[countryId].name} به اتحاد «${alliance.name}» پیوست.`);
    }
  },
  remove(allianceId, countryId) {
    const alliance = State.alliances.find(a => a.id === allianceId);
    if (!alliance) return;
    alliance.members = alliance.members.filter(id => id !== countryId);
    State.countries[countryId].allianceId = null;
    NewsSystem.push(`⚠️ ${State.countries[countryId].flag} ${State.countries[countryId].name} از اتحاد «${alliance.name}» اخراج/خارج شد.`);
  },
  leaderAlliance() {
    return State.alliances.find(a => a.id === player().allianceId);
  },
};

/* ==========================================================================
   GROUP SYSTEM (گروه بازیکنان)
   ========================================================================== */
const GroupSystem = {
  create(name, desc, inviteIds) {
    const p = player();
    const group = {
      id: uid("group"), name, desc: desc || "",
      leaderId: p.id, members: [p.id], invites: [...inviteIds], level: 1,
    };
    State.groups.push(group);
    NewsSystem.push(`👤 گروه جدید «${group.name}» توسط ${p.flag} ${p.name} تأسیس شد.`);
    return group;
  },
  acceptInvite(groupId, countryId) {
    const g = State.groups.find(g => g.id === groupId);
    if (!g) return;
    g.invites = g.invites.filter(id => id !== countryId);
    if (!g.members.includes(countryId)) g.members.push(countryId);
    NewsSystem.push(`👤 ${State.countries[countryId].flag} ${State.countries[countryId].name} به گروه «${g.name}» پیوست.`);
  },
  myGroup() {
    return State.groups.find(g => g.members.includes(State.playerCountryId));
  },
  myInvites() {
    return State.groups.filter(g => g.invites.includes(State.playerCountryId));
  },
};

/* ==========================================================================
   WAR SYSTEM
   ========================================================================== */
const WarSystem = {
  declare(aId, bId) {
    if (aId === bId) return;
    const existing = State.wars.find(w => w.status === "active" &&
      ((w.a === aId && w.b === bId) || (w.a === bId && w.b === aId)));
    if (existing) return;

    const war = { id: uid("war"), a: aId, b: bId, status: "active", startTick: State.tick };
    State.wars.push(war);
    DiplomacySystem.setEnemies(aId, bId);
    State.countries[aId].status = "war";
    State.countries[bId].status = "war";
    if (aId === State.playerCountryId || bId === State.playerCountryId) {
      State.playerStatus = "war";
    }
    const A = State.countries[aId], B = State.countries[bId];
    NewsSystem.push(`⚔️ ${A.flag} ${A.name} علیه ${B.flag} ${B.name} اعلام جنگ کرد.`);
  },
  requestAllyHelp(warId) {
    const war = State.wars.find(w => w.id === warId);
    if (!war) return;
    const p = player();
    const side = war.a === p.id ? p.id : war.b === p.id ? p.id : null;
    if (!side) return;
    p.allies.forEach(allyId => {
      const enemyId = war.a === p.id ? war.b : war.a;
      if (!State.countries[allyId].enemies.includes(enemyId)) {
        DiplomacySystem.setEnemies(allyId, enemyId);
        State.countries[allyId].status = "war";
        NewsSystem.push(`📣 ${State.countries[allyId].flag} ${State.countries[allyId].name} به کمک متحد خود ${p.flag} ${p.name} وارد جنگ شد.`);
      }
    });
  },
  proposeCeasefire(warId) {
    const war = State.wars.find(w => w.id === warId);
    if (!war) return;
    war.status = "ceasefire";
    const A = State.countries[war.a], B = State.countries[war.b];
    A.status = "ceasefire"; B.status = "ceasefire";
    if (war.a === State.playerCountryId || war.b === State.playerCountryId) State.playerStatus = "ceasefire";
    NewsSystem.push(`🏳️ ${A.flag} ${A.name} درخواست آتش‌بس با ${B.flag} ${B.name} داد.`);
  },
  makePeace(warId) {
    const war = State.wars.find(w => w.id === warId);
    if (!war) return;
    war.status = "ended";
    const A = State.countries[war.a], B = State.countries[war.b];
    A.enemies = A.enemies.filter(x => x !== B.id);
    B.enemies = B.enemies.filter(x => x !== A.id);
    if (!State.wars.some(w => w.status === "active" && (w.a === A.id || w.b === A.id))) A.status = "peace";
    if (!State.wars.some(w => w.status === "active" && (w.a === B.id || w.b === B.id))) B.status = "peace";
    if (A.id === State.playerCountryId || B.id === State.playerCountryId) {
      const stillAtWar = State.wars.some(w => w.status === "active" && (w.a === State.playerCountryId || w.b === State.playerCountryId));
      State.playerStatus = stillAtWar ? "war" : "peace";
    }
    NewsSystem.push(`🕊️ صلح میان ${A.flag} ${A.name} و ${B.flag} ${B.name} برقرار شد.`);
  },
};

/* ==========================================================================
   TERRITORY SYSTEM
   ========================================================================== */
const TerritorySystem = {
  capture(regionId, newOwnerId) {
    const region = State.regions.find(r => r.id === regionId);
    if (!region) return;
    const oldOwnerId = region.ownerId;
    if (oldOwnerId) {
      const old = State.countries[oldOwnerId];
      old.controlledRegions = old.controlledRegions.filter(id => id !== regionId);
    }
    region.ownerId = newOwnerId;
    State.countries[newOwnerId].controlledRegions.push(regionId);
    const newOwner = State.countries[newOwnerId];
    NewsSystem.push(`🏙 منطقه «${region.name}» تحت کنترل ${newOwner.flag} ${newOwner.name} درآمد.`);
  },
};

/* ==========================================================================
   STRAIT / BLOCKADE SYSTEM
   ========================================================================== */
const StraitSystem = {
  toggleBlock(straitId) {
    const s = State.straits[straitId];
    if (!s) return;
    s.blocked = !s.blocked;
    const controller = State.countries[s.controllerId];
    if (s.blocked) {
      NewsSystem.push(`🌊🚫 ${controller.flag} ${controller.name} اعلام کرد که ${s.name} را مسدود کرده است! قیمت منابع افزایش یافت.`);
      EconomySystem_applyBlockadeEffect(true);
    } else {
      NewsSystem.push(`🌊✅ محاصره ${s.name} توسط ${controller.flag} ${controller.name} رفع شد.`);
      EconomySystem_applyBlockadeEffect(false);
    }
  },
};
function EconomySystem_applyBlockadeEffect(active) {
  const factor = active ? 1.35 : 1 / 1.35;
  [...SHOP_DATA.resources].forEach(item => {
    item.price = Math.max(1, Math.round(item.price * factor));
  });
}

/* ==========================================================================
   STATEMENT SYSTEM
   ========================================================================== */
const StatementSystem = {
  publish(issuer, subject, location, text, lang) {
    const p = player();
    const st = { id: uid("st"), countryId: p.id, issuer, subject, location, text, lang, time: Date.now() };
    State.statements.unshift(st);
    NewsSystem.push(`📰 ${p.flag} ${p.name} بیانیه‌ای درباره «${subject}» صادر کرد.`);
    return st;
  },
};

/* ==========================================================================
   SHELTER SYSTEM
   ========================================================================== */
const ShelterSystem = {
  enter() {
    State.inShelter = true;
    NewsSystem.push(`🛡️ ${player().flag} ${player().name} وارد پناهگاه امن شد.`);
  },
  exit() {
    State.inShelter = false;
  },
};

/* ==========================================================================
   SAVE SYSTEM
   ========================================================================== */
const SaveSystem = {
  save() {
    const payload = {
      playerCountryId: State.playerCountryId,
      countries: State.countries,
      straits: State.straits,
      regions: State.regions,
      alliances: State.alliances,
      groups: State.groups,
      wars: State.wars,
      statements: State.statements,
      news: State.news,
      purchaseHistory: State.purchaseHistory,
      playerStatus: State.playerStatus,
      inShelter: State.inShelter,
      tick: State.tick,
      shopPrices: {
        resources: SHOP_DATA.resources.map(i => ({ key: i.key, price: i.price })),
      },
      savedAt: Date.now(),
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      return true;
    } catch (e) {
      console.error("Save failed", e);
      return false;
    }
  },
  hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  },
  load() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      const payload = JSON.parse(raw);
      State.playerCountryId = payload.playerCountryId;
      State.countries = payload.countries;
      State.straits = payload.straits;
      State.regions = payload.regions;
      State.alliances = payload.alliances || [];
      State.groups = payload.groups || [];
      State.wars = payload.wars || [];
      State.statements = payload.statements || [];
      State.news = payload.news || [];
      State.purchaseHistory = payload.purchaseHistory || [];
      State.playerStatus = payload.playerStatus || "peace";
      State.inShelter = payload.inShelter || false;
      State.tick = payload.tick || 0;
      if (payload.shopPrices) {
        payload.shopPrices.resources.forEach(saved => {
          const item = SHOP_DATA.resources.find(i => i.key === saved.key);
          if (item) item.price = saved.price;
        });
      }
      return true;
    } catch (e) {
      console.error("Load failed", e);
      return false;
    }
  },
  clear() {
    localStorage.removeItem(SAVE_KEY);
  },
};

/* ==========================================================================
   UI — رندر و رویدادها
   ========================================================================== */
const UI = {
  activePanel: null,

  /* -------- بوت‌استرپ -------- */
  boot() {
    this.buildCountryPickGrid();
    if (SaveSystem.hasSave()) {
      document.getElementById("continue-box").classList.remove("hidden");
    }
    document.getElementById("btn-continue").addEventListener("click", () => {
      if (SaveSystem.load()) this.enterGame();
    });
    document.getElementById("btn-newgame").addEventListener("click", () => {
      document.getElementById("continue-box").classList.add("hidden");
    });

    this.bindNav();
    this.bindPanelClosers();
    this.bindMenu();
    this.bindCountryTabs();
    this.bindDiplomacyTabs();
    this.bindShopTabs();
    this.bindWarPanel();
    this.bindStatementForm();
    this.bindAllianceModal();
    this.bindGroupModal();
    this.bindShelter();
  },

  buildCountryPickGrid() {
    const grid = document.getElementById("country-pick-grid");
    grid.innerHTML = "";
    COUNTRY_ORDER.forEach(id => {
      const c = COUNTRIES_DATA[id];
      const card = document.createElement("button");
      card.className = "country-pick-card";
      card.innerHTML = `<span class="flag">${c.flag}</span><span class="name">${c.name}</span><span class="desc">💰 ${c.money.toLocaleString("fa-IR")}</span>`;
      card.addEventListener("click", () => {
        initFreshState(id);
        this.enterGame();
      });
      grid.appendChild(card);
    });
  },

  enterGame() {
    document.getElementById("screen-select").classList.remove("active");
    document.getElementById("screen-game").classList.add("active");
    this.renderAll();
  },

  renderAll() {
    this.renderTopbar();
    this.renderMap();
    this.renderNewsStrip();
    this.renderCountryPanel();
    this.renderDiplomacyPanel();
    this.renderWarPanel();
    this.renderShop();
    this.renderNewsPanel();
    this.renderShelter();
  },

  /* -------- Top bar -------- */
  renderTopbar() {
    const p = player();
    document.getElementById("pb-flag").textContent = p.flag;
    document.getElementById("pb-name").textContent = p.name;
    const dot = document.getElementById("pb-status");
    dot.className = "status-dot " + statusClass(State.playerStatus);

    const ticker = document.getElementById("resource-ticker");
    ticker.innerHTML = `
      <span class="rt-item">💰 <b>${p.money.toLocaleString("fa-IR")}</b></span>
      <span class="rt-item">⛏ <b>${p.resources.iron}</b></span>
      <span class="rt-item">🛢 <b>${p.resources.oil}</b></span>
      <span class="rt-item">🪨 <b>${p.resources.coal}</b></span>
      <span class="rt-item">☢ <b>${p.resources.uranium}</b></span>
      <span class="rt-item">🌾 <b>${p.resources.food}</b></span>
      <span class="rt-item">⚙ <b>${p.resources.parts}</b></span>
    `;
  },

  /* -------- نقشه -------- */
  renderMap() {
    const map = document.getElementById("world-map");
    map.querySelectorAll(".map-node").forEach(n => n.remove());

    countryList().forEach(c => {
      const node = document.createElement("div");
      let statusCls = "status-peace";
      if (c.status === "war") statusCls = "status-war";
      else if (c.status === "tension") statusCls = "status-tension";
      else if (c.status === "ceasefire") statusCls = "status-alliance";
      if (c.allianceId) statusCls = "status-alliance";
      node.className = `map-node ${statusCls} ${c.id === State.playerCountryId ? "player" : ""}`;
      node.style.left = c.pos.x + "%";
      node.style.top = c.pos.y + "%";
      node.innerHTML = `<div class="node-dot">${c.flag}</div><div class="node-label">${c.name}</div>`;
      node.addEventListener("click", () => this.showCountryOnMap(c.id));
      map.appendChild(node);
    });

    Object.values(State.straits).forEach(s => {
      const node = document.createElement("div");
      node.className = `map-node strait ${s.blocked ? "blocked" : ""}`;
      node.style.left = s.pos.x + "%";
      node.style.top = s.pos.y + "%";
      node.innerHTML = `<div class="node-dot">${s.blocked ? "🚫" : "🌊"}</div><div class="node-label">${s.name}</div>`;
      node.addEventListener("click", () => this.openStraitModal(s.id));
      map.appendChild(node);
    });
  },

  showCountryOnMap(id) {
    const c = State.countries[id];
    const body = document.getElementById("map-info-body");
    const rel = DiplomacySystem.relation(State.playerCountryId, id);
    body.innerHTML = `
      <div class="list-item" style="margin-bottom:12px;">
        <div class="li-main">
          <div class="li-title">${c.flag} ${c.name}</div>
          <div class="li-sub">وضعیت: ${statusLabel(c.status)}</div>
        </div>
        <span class="badge ${rel}">${relLabel(rel)}</span>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="label">💰 پول</div><div class="value">${c.money.toLocaleString("fa-IR")}</div></div>
        <div class="stat-card"><div class="label">🪖 نیرو</div><div class="value">${c.military.infantry}</div></div>
        <div class="stat-card"><div class="label">🌍 مناطق</div><div class="value">${c.controlledRegions.length}</div></div>
        <div class="stat-card"><div class="label">🤝 اتحاد</div><div class="value">${c.allianceId ? (State.alliances.find(a => a.id === c.allianceId)?.name || "—") : "ندارد"}</div></div>
      </div>
      ${id !== State.playerCountryId ? `
        <div class="row gap wrap" style="margin-top:12px;">
          ${rel !== "enemy" ? `<button class="btn btn-danger" data-act="war" data-id="${id}">🔴 اعلام جنگ</button>` : ""}
          ${rel === "neutral" ? `<button class="btn btn-primary" data-act="ally" data-id="${id}">🤝 پیشنهاد اتحاد</button>` : ""}
        </div>` : `<p class="muted">این کشور شماست.</p>`}
    `;
    body.querySelectorAll("[data-act]").forEach(btn => {
      btn.addEventListener("click", () => {
        const act = btn.dataset.act, targetId = btn.dataset.id;
        if (act === "war") { WarSystem.declare(State.playerCountryId, targetId); }
        if (act === "ally") { DiplomacySystem.setAllies(State.playerCountryId, targetId); NewsSystem.push(`🤝 ${player().flag} ${player().name} و ${State.countries[targetId].flag} ${State.countries[targetId].name} متحد شدند.`); }
        this.renderAll();
        this.showCountryOnMap(id);
      });
    });
    this.openPanel("panel-map");
  },

  openStraitModal(id) {
    const s = State.straits[id];
    const controller = State.countries[s.controllerId];
    document.getElementById("strait-modal-title").textContent = `${s.flag} ${s.name}`;
    const body = document.getElementById("strait-modal-body");
    body.innerHTML = `
      <p class="muted">کنترل‌کننده: ${controller.flag} ${controller.name}</p>
      <p class="muted">وضعیت: ${s.blocked ? "🚫 مسدود شده" : "✅ باز"}</p>
      ${controller.id === State.playerCountryId
        ? `<button class="btn ${s.blocked ? "btn-primary" : "btn-danger"} block" id="strait-toggle-btn">
             ${s.blocked ? "✅ رفع محاصره" : "🚫 بستن مسیر دریایی"}
           </button>`
        : `<p class="muted">فقط کشور کنترل‌کننده می‌تواند این مسیر را ببندد یا باز کند.</p>`}
    `;
    const toggleBtn = document.getElementById("strait-toggle-btn");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        StraitSystem.toggleBlock(id);
        this.closeModal();
        this.renderAll();
      });
    }
    this.openModal("modal-strait");
  },

  /* -------- نوار اخبار -------- */
  renderNewsStrip() {
    const track = document.getElementById("news-strip-track");
    const latest = State.news.slice(0, 6).map(n => n.text).join("   •   ");
    track.textContent = latest || "در انتظار رویدادهای جهانی…";
  },
  renderNewsPanel() {
    const list = document.getElementById("news-full-list");
    list.innerHTML = "";
    if (!State.news.length) {
      list.innerHTML = `<p class="muted">هنوز خبری ثبت نشده است.</p>`;
      return;
    }
    State.news.forEach(n => {
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `<div class="li-main"><div class="li-title">${n.text}</div><div class="li-sub">${new Date(n.time).toLocaleTimeString("fa-IR")}</div></div>`;
      list.appendChild(div);
    });
  },

  /* -------- پنل کشور -------- */
  renderCountryPanel() {
    const p = player();
    document.getElementById("economy-stats").innerHTML = `
      <div class="stat-card accent-green"><div class="label">💰 موجودی</div><div class="value">${p.money.toLocaleString("fa-IR")}</div></div>
      <div class="stat-card accent-blue"><div class="label">📈 درآمد</div><div class="value">+${p.income}</div></div>
      <div class="stat-card accent-red"><div class="label">📉 هزینه‌ها</div><div class="value">-${p.upkeep}</div></div>
      <div class="stat-card"><div class="label">⛏ آهن</div><div class="value">${p.resources.iron}</div></div>
      <div class="stat-card"><div class="label">🛢 نفت</div><div class="value">${p.resources.oil}</div></div>
      <div class="stat-card"><div class="label">🪨 زغال‌سنگ</div><div class="value">${p.resources.coal}</div></div>
      <div class="stat-card"><div class="label">☢ اورانیوم</div><div class="value">${p.resources.uranium}</div></div>
      <div class="stat-card"><div class="label">🌾 مواد غذایی</div><div class="value">${p.resources.food}</div></div>
      <div class="stat-card"><div class="label">⚙ قطعات صنعتی</div><div class="value">${p.resources.parts}</div></div>
    `;
    const hist = document.getElementById("purchase-history");
    hist.innerHTML = "";
    if (!State.purchaseHistory.length) {
      hist.innerHTML = `<li class="muted">هنوز خریدی ثبت نشده.</li>`;
    } else {
      State.purchaseHistory.slice(0, 15).forEach(h => {
        const li = document.createElement("li");
        li.textContent = `🧾 ${h.itemName} × ${h.qty} — هزینه: ${h.cost.toLocaleString("fa-IR")}`;
        hist.appendChild(li);
      });
    }

    document.getElementById("military-stats").innerHTML = `
      <div class="stat-card accent-green"><div class="label">🪖 نیروی زمینی</div><div class="value">${p.military.infantry}</div></div>
      <div class="stat-card"><div class="label">🛡 خودرو زرهی</div><div class="value">${p.military.armor}</div></div>
      <div class="stat-card"><div class="label">✈️ هواپیما</div><div class="value">${p.military.air}</div></div>
      <div class="stat-card accent-blue"><div class="label">🚢 ناوگان دریایی</div><div class="value">${p.military.navy}</div></div>
      <div class="stat-card accent-red"><div class="label">🧱 تجهیزات دفاعی</div><div class="value">${p.military.defense}</div></div>
    `;

    const controlled = p.controlledRegions.map(id => State.regions.find(r => r.id === id));
    const disputed = State.regions.filter(r => {
      const original = REGIONS_DATA.find(rd => rd.id === r.id);
      return original && original.ownerId !== r.ownerId;
    });
    document.getElementById("territory-stats").innerHTML = `
      <div class="stat-card accent-green"><div class="label">🌍 مناطق تحت کنترل</div><div class="value">${controlled.length}</div></div>
      <div class="stat-card accent-yellow"><div class="label">⚡ مناطق مورد مناقشه</div><div class="value">${disputed.length}</div></div>
    ` + controlled.map(r => `<div class="stat-card"><div class="label">📍</div><div class="value" style="font-size:0.85rem;">${r ? r.name : "—"}</div></div>`).join("");

    document.getElementById("status-stats").innerHTML = `
      <div class="stat-card ${statusAccent(State.playerStatus)}"><div class="label">🚨 وضعیت فعلی</div><div class="value">${statusLabel(State.playerStatus)}</div></div>
      <div class="stat-card"><div class="label">🤝 متحدان</div><div class="value">${p.allies.length}</div></div>
      <div class="stat-card accent-red"><div class="label">⚔️ دشمنان</div><div class="value">${p.enemies.length}</div></div>
      <div class="stat-card"><div class="label">🛡️ پناهگاه</div><div class="value">${State.inShelter ? "داخل پناهگاه" : "خارج"}</div></div>
    `;
  },

  bindCountryTabs() { bindTabGroup("country-tabs"); },

  /* -------- پنل دیپلماسی -------- */
  renderDiplomacyPanel() {
    const relList = document.getElementById("relations-list");
    relList.innerHTML = "";
    otherCountries().forEach(c => {
      const rel = DiplomacySystem.relation(State.playerCountryId, c.id);
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <div class="li-main"><div class="li-title">${c.flag} ${c.name}</div><div class="li-sub">وضعیت: ${statusLabel(c.status)}</div></div>
        <span class="badge ${rel}">${relLabel(rel)}</span>
      `;
      relList.appendChild(div);
    });

    const currentAllianceBox = document.getElementById("alliance-current");
    const myAlliance = State.alliances.find(a => a.id === player().allianceId);
    if (myAlliance) {
      currentAllianceBox.innerHTML = `
        <div class="list-item" style="margin-bottom:12px;">
          <div class="li-main">
            <div class="li-title">${myAlliance.flag} ${myAlliance.name}</div>
            <div class="li-sub">رهبر: ${State.countries[myAlliance.leaderId].flag} ${State.countries[myAlliance.leaderId].name} • اعضا: ${myAlliance.members.length}</div>
          </div>
        </div>
        <div class="list-block">
          ${myAlliance.members.map(id => `
            <div class="list-item">
              <span>${State.countries[id].flag} ${State.countries[id].name}</span>
              ${myAlliance.leaderId === State.playerCountryId && id !== State.playerCountryId
                ? `<button class="btn btn-ghost" data-remove="${id}" data-alliance="${myAlliance.id}">حذف</button>` : ""}
            </div>`).join("")}
        </div>
        ${myAlliance.rules ? `<p class="muted" style="margin-top:8px;">📜 قوانین: ${myAlliance.rules}</p>` : ""}
      `;
      currentAllianceBox.querySelectorAll("[data-remove]").forEach(btn => {
        btn.addEventListener("click", () => {
          AllianceSystem.remove(btn.dataset.alliance, btn.dataset.remove);
          this.renderAll();
        });
      });
    } else {
      currentAllianceBox.innerHTML = `<p class="muted">شما هنوز عضو هیچ اتحادی نیستید.</p>`;
    }
    document.getElementById("btn-create-alliance").disabled = !!player().allianceId;

    const allianceList = document.getElementById("alliance-list");
    allianceList.innerHTML = "";
    if (!State.alliances.length) {
      allianceList.innerHTML = `<p class="muted">هنوز هیچ اتحادی تشکیل نشده.</p>`;
    } else {
      State.alliances.forEach(a => {
        const div = document.createElement("div");
        div.className = "list-item";
        div.innerHTML = `<div class="li-main"><div class="li-title">${a.flag} ${a.name}</div><div class="li-sub">اعضا: ${a.members.map(id => State.countries[id].flag).join(" ")}</div></div>`;
        allianceList.appendChild(div);
      });
    }

    const groupBox = document.getElementById("group-current");
    const myGroup = GroupSystem.myGroup();
    if (myGroup) {
      groupBox.innerHTML = `
        <div class="list-item" style="margin-bottom:12px;">
          <div class="li-main">
            <div class="li-title">${myGroup.name} <span class="badge neutral">سطح ${myGroup.level}</span></div>
            <div class="li-sub">${myGroup.desc || "بدون توضیحات"}</div>
          </div>
        </div>
        <p class="muted">رهبر: ${State.countries[myGroup.leaderId].flag} ${State.countries[myGroup.leaderId].name}</p>
        <div class="list-block">
          ${myGroup.members.map(id => `<div class="list-item"><span>${State.countries[id].flag} ${State.countries[id].name}</span></div>`).join("")}
        </div>
      `;
    } else {
      groupBox.innerHTML = `<p class="muted">شما هنوز عضو هیچ گروهی نیستید.</p>`;
    }
    document.getElementById("btn-create-group").disabled = !!myGroup;

    const invitesBox = document.getElementById("group-invites");
    const invites = GroupSystem.myInvites();
    invitesBox.innerHTML = "";
    if (!invites.length) {
      invitesBox.innerHTML = `<p class="muted">دعوت‌نامه‌ای وجود ندارد.</p>`;
    } else {
      invites.forEach(g => {
        const div = document.createElement("div");
        div.className = "list-item";
        div.innerHTML = `<div class="li-main"><div class="li-title">${g.name}</div><div class="li-sub">رهبر: ${State.countries[g.leaderId].name}</div></div>
          <button class="btn btn-primary" data-accept="${g.id}">✔ پیوستن</button>`;
        invitesBox.appendChild(div);
      });
      invitesBox.querySelectorAll("[data-accept]").forEach(btn => {
        btn.addEventListener("click", () => {
          GroupSystem.acceptInvite(btn.dataset.accept, State.playerCountryId);
          this.renderAll();
        });
      });
    }
  },

  bindDiplomacyTabs() { bindTabGroup("diplo-tabs"); },

  bindStatementForm() {
    document.getElementById("statement-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const issuer = document.getElementById("st-issuer").value.trim();
      const subject = document.getElementById("st-subject").value.trim();
      const location = document.getElementById("st-location").value.trim();
      const text = document.getElementById("st-body").value.trim();
      const lang = document.getElementById("st-lang").value;
      if (!issuer || !subject || !location || !text) return;
      StatementSystem.publish(issuer, subject, location, text, lang);
      e.target.reset();
      this.renderAll();
      this.openPanel("panel-news");
    });
  },

  bindAllianceModal() {
    document.getElementById("btn-create-alliance").addEventListener("click", () => {
      const list = document.getElementById("al-invite-list");
      list.innerHTML = otherCountries().map(c => `
        <label><input type="checkbox" value="${c.id}" /> ${c.flag} ${c.name}</label>
      `).join("");
      this.openModal("modal-alliance");
    });
    document.getElementById("alliance-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("al-name").value.trim();
      const flag = document.getElementById("al-flag").value.trim();
      const rules = document.getElementById("al-rules").value.trim();
      const invited = Array.from(document.querySelectorAll("#al-invite-list input:checked")).map(i => i.value);
      const res = AllianceSystem.create(name, flag, rules, invited);
      if (res.ok) {
        e.target.reset();
        this.closeModal();
        this.renderAll();
      }
    });
  },

  bindGroupModal() {
    document.getElementById("btn-create-group").addEventListener("click", () => {
      const list = document.getElementById("gr-invite-list");
      list.innerHTML = otherCountries().map(c => `
        <label><input type="checkbox" value="${c.id}" /> ${c.flag} ${c.name}</label>
      `).join("");
      this.openModal("modal-group");
    });
    document.getElementById("group-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("gr-name").value.trim();
      const desc = document.getElementById("gr-desc").value.trim();
      const invited = Array.from(document.querySelectorAll("#gr-invite-list input:checked")).map(i => i.value);
      GroupSystem.create(name, desc, invited);
      e.target.reset();
      this.closeModal();
      this.renderAll();
    });
  },

  /* -------- پنل جنگ -------- */
  bindWarPanel() {
    const select = document.getElementById("war-target-select");
    otherCountries().forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id; opt.textContent = `${c.flag} ${c.name}`;
      select.appendChild(opt);
    });
    document.getElementById("btn-declare-war").addEventListener("click", () => {
      WarSystem.declare(State.playerCountryId, select.value);
      this.renderAll();
    });
    document.getElementById("btn-request-allies").addEventListener("click", () => {
      const activeWar = State.wars.find(w => w.status === "active" && (w.a === State.playerCountryId || w.b === State.playerCountryId));
      if (activeWar) WarSystem.requestAllyHelp(activeWar.id);
      this.renderAll();
    });
  },
  renderWarPanel() {
    const list = document.getElementById("war-list");
    list.innerHTML = "";
    const relevant = State.wars.filter(w => w.status !== "ended");
    if (!relevant.length) {
      list.innerHTML = `<p class="muted">هیچ جنگ جاری‌ای وجود ندارد.</p>`;
    } else {
      relevant.forEach(w => {
        const A = State.countries[w.a], B = State.countries[w.b];
        const div = document.createElement("div");
        div.className = "list-item";
        div.innerHTML = `
          <div class="li-main">
            <div class="li-title">${A.flag} ${A.name} ⚔️ ${B.flag} ${B.name}</div>
            <div class="li-sub">وضعیت: ${w.status === "active" ? "🔴 در حال جنگ" : "🔵 آتش‌بس"}</div>
          </div>
          <div class="row gap">
            ${(w.a === State.playerCountryId || w.b === State.playerCountryId) ? `
              <button class="btn btn-ghost" data-ceasefire="${w.id}">🏳️ آتش‌بس</button>
              <button class="btn btn-primary" data-peace="${w.id}">🕊️ صلح</button>
            ` : ""}
          </div>
        `;
        list.appendChild(div);
      });
      list.querySelectorAll("[data-ceasefire]").forEach(btn => btn.addEventListener("click", () => { WarSystem.proposeCeasefire(btn.dataset.ceasefire); this.renderAll(); }));
      list.querySelectorAll("[data-peace]").forEach(btn => btn.addEventListener("click", () => { WarSystem.makePeace(btn.dataset.peace); this.renderAll(); }));
    }

    const straitList = document.getElementById("strait-list");
    straitList.innerHTML = "";
    Object.values(State.straits).forEach(s => {
      const controller = State.countries[s.controllerId];
      const div = document.createElement("div");
      div.className = "list-item";
      div.innerHTML = `
        <div class="li-main">
          <div class="li-title">${s.flag} ${s.name}</div>
          <div class="li-sub">کنترل‌کننده: ${controller.flag} ${controller.name} — ${s.blocked ? "🚫 مسدود" : "✅ باز"}</div>
        </div>
        ${controller.id === State.playerCountryId ? `<button class="btn ${s.blocked ? "btn-primary" : "btn-danger"}" data-strait="${s.id}">${s.blocked ? "رفع محاصره" : "بستن مسیر"}</button>` : ""}
      `;
      straitList.appendChild(div);
    });
    straitList.querySelectorAll("[data-strait]").forEach(btn => btn.addEventListener("click", () => { StraitSystem.toggleBlock(btn.dataset.strait); this.renderAll(); }));
  },

  /* -------- فروشگاه -------- */
  bindShopTabs() { bindTabGroup("shop-tabs"); },
  renderShop() {
    renderShopCategory("shop-resources", SHOP_DATA.resources, "resources");
    renderShopCategory("shop-equipment", SHOP_DATA.equipment, "equipment");
    renderShopCategory("shop-strategic", SHOP_DATA.strategic, "strategic");
  },

  /* -------- پناهگاه -------- */
  bindShelter() {
    document.getElementById("btn-enter-shelter").addEventListener("click", () => {
      ShelterSystem.enter();
      this.renderShelter();
    });
    document.getElementById("btn-exit-shelter").addEventListener("click", () => {
      ShelterSystem.exit();
      this.renderShelter();
    });
  },
  renderShelter() {
    document.getElementById("shelter-entry").classList.toggle("hidden", State.inShelter);
    document.getElementById("shelter-inside").classList.toggle("hidden", !State.inShelter);
    if (!State.inShelter) return;
    const p = player();
    document.getElementById("shelter-country-status").innerHTML = `
      <div class="stat-card ${statusAccent(State.playerStatus)}"><div class="label">🚨 وضعیت</div><div class="value">${statusLabel(State.playerStatus)}</div></div>
      <div class="stat-card"><div class="label">🌍 مناطق</div><div class="value">${p.controlledRegions.length}</div></div>
    `;
    const newsBox = document.getElementById("shelter-news");
    newsBox.innerHTML = State.news.slice(0, 5).map(n => `<div class="list-item"><div class="li-title">${n.text}</div></div>`).join("") || `<p class="muted">خبری ثبت نشده.</p>`;
    const warBox = document.getElementById("shelter-war");
    const myWars = State.wars.filter(w => w.status === "active" && (w.a === p.id || w.b === p.id));
    warBox.innerHTML = myWars.map(w => {
      const other = State.countries[w.a === p.id ? w.b : w.a];
      return `<div class="list-item"><div class="li-title">⚔️ در حال جنگ با ${other.flag} ${other.name}</div></div>`;
    }).join("") || `<p class="muted">درگیری فعالی ندارید.</p>`;
    document.getElementById("shelter-resources").innerHTML = `
      <div class="stat-card"><div class="label">⛏ آهن</div><div class="value">${p.resources.iron}</div></div>
      <div class="stat-card"><div class="label">🛢 نفت</div><div class="value">${p.resources.oil}</div></div>
      <div class="stat-card"><div class="label">🌾 غذا</div><div class="value">${p.resources.food}</div></div>
      <div class="stat-card"><div class="label">⚙ قطعات</div><div class="value">${p.resources.parts}</div></div>
    `;
    const emergencyBox = document.getElementById("shelter-emergency");
    const emergencyMsgs = State.news.filter(n => n.text.includes("جنگ") || n.text.includes("مسدود")).slice(0, 4);
    emergencyBox.innerHTML = emergencyMsgs.map(n => `<div class="list-item"><div class="li-title">🚨 ${n.text}</div></div>`).join("") || `<p class="muted">پیام اضطراری‌ای وجود ندارد.</p>`;
    const alliesBox = document.getElementById("shelter-allies");
    alliesBox.innerHTML = p.allies.map(id => {
      const a = State.countries[id];
      return `<div class="list-item"><span>${a.flag} ${a.name}</span><span class="badge ${statusClass(a.status)}">${statusLabel(a.status)}</span></div>`;
    }).join("") || `<p class="muted">متحدی ندارید.</p>`;
  },

  /* -------- ناوبری / پنل‌ها -------- */
  bindNav() {
    document.querySelectorAll(".nav-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        this.openPanel(btn.dataset.panel);
      });
    });
  },
  bindPanelClosers() {
    document.querySelectorAll(".panel-close").forEach(btn => {
      btn.addEventListener("click", () => this.closeAllPanels());
    });
    document.getElementById("overlay").addEventListener("click", () => this.closeAllPanels());
  },
  bindMenu() {
    document.getElementById("btn-menu").addEventListener("click", () => this.openPanel("panel-menu"));
    document.getElementById("btn-save").addEventListener("click", () => {
      const ok = SaveSystem.save();
      this.showToast(ok ? "💾 بازی ذخیره شد." : "⚠️ خطا در ذخیره‌سازی.");
    });
    document.getElementById("btn-restart").addEventListener("click", () => {
      if (confirm("آیا مطمئن هستید؟ بازی فعلی پاک می‌شود.")) {
        SaveSystem.clear();
        location.reload();
      }
    });
  },
  openPanel(id) {
    this.closeAllPanels(false);
    const panel = document.getElementById(id);
    panel.classList.add("open");
    document.getElementById("overlay").classList.add("show");
    this.activePanel = id;
  },
  closeAllPanels(resetNav = true) {
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("open"));
    document.getElementById("overlay").classList.remove("show");
    if (resetNav) {
      document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
      const mapBtn = document.querySelector('.nav-btn[data-panel="panel-map"]');
      if (mapBtn) mapBtn.classList.add("active");
    }
  },
  openModal(id) {
    document.querySelectorAll(".modal").forEach(m => m.classList.remove("show"));
    document.getElementById(id).classList.add("show");
    document.getElementById("modal-backdrop").classList.add("show");
  },
  closeModal() {
    document.getElementById("modal-backdrop").classList.remove("show");
    document.querySelectorAll(".modal").forEach(m => m.classList.remove("show"));
  },

  /* -------- Toast -------- */
  showToast(text) {
    const wrap = document.getElementById("toast-wrap");
    const toast = document.createElement("div");
    toast.className = "toast" + (text.includes("جنگ") || text.includes("مسدود") ? " alert" : "");
    toast.textContent = text;
    wrap.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  },
};

/* ==========================================================================
   کمک‌تابع‌های نمایشی
   ========================================================================== */
function statusLabel(s) {
  return { peace: "🟢 صلح", tension: "🟡 تنش", war: "🔴 جنگ", siege: "🟠 محاصره", ceasefire: "🔵 آتش‌بس" }[s] || s;
}
function statusClass(s) {
  return { peace: "peace", tension: "tension", war: "war", siege: "siege", ceasefire: "ceasefire" }[s] || "peace";
}
function statusAccent(s) {
  return { peace: "accent-green", tension: "accent-yellow", war: "accent-red", siege: "accent-red", ceasefire: "accent-blue" }[s] || "";
}
function relLabel(r) {
  return { ally: "🤝 متحد", enemy: "⚔️ دشمن", neutral: "⚪ بی‌طرف" }[r] || r;
}

function bindTabGroup(containerId) {
  const container = document.getElementById(containerId);
  container.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const panelBody = container.closest(".panel-body");
      panelBody.querySelectorAll(".tab-content").forEach(tc => tc.classList.remove("active"));
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });
}

function renderShopCategory(containerId, items, category) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "shop-item";
    row.innerHTML = `
      <div class="si-info">
        <span class="si-icon">${item.icon}</span>
        <div>
          <div class="si-name">${item.name}</div>
          <div class="si-price">قیمت واحد: ${item.price.toLocaleString("fa-IR")}💰</div>
        </div>
      </div>
      <div class="si-buy">
        <input type="number" class="qty-input" min="1" value="1" id="qty-${category}-${item.key}" />
        <button class="buy-btn" data-key="${item.key}" data-cat="${category}">خرید</button>
      </div>
    `;
    container.appendChild(row);
  });
  container.querySelectorAll(".buy-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key, cat = btn.dataset.cat;
      const qtyInput = document.getElementById(`qty-${cat}-${key}`);
      const qty = Math.max(1, parseInt(qtyInput.value, 10) || 1);
      const res = EconomySystem.buy(key, qty, cat);
      if (res.ok) {
        UI.showToast(`🧾 خرید موفق: ${qty} واحد`);
        UI.renderTopbar();
        UI.renderCountryPanel();
        UI.renderShop();
      } else {
        UI.showToast("⚠️ " + res.msg);
      }
    });
  });
}

/* ==========================================================================
   حلقه اقتصادی (هر چند ثانیه یک بار)
   ========================================================================== */
setInterval(() => {
  if (!State.playerCountryId) return;
  State.tick++;
  EconomySystem.tickIncome();
  UI.renderTopbar();
  UI.renderCountryPanel();
}, 15000);

/* ==========================================================================
   شروع
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  UI.boot();
});
