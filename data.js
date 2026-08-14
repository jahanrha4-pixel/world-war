/* ==========================================================================
   WORD WAR — data.js
   داده‌های پایه بازی: کشورها، مناطق، تنگه‌ها و فروشگاه
   ساختار داده‌محور تا افزودن کشور/منطقه جدید در آینده ساده باشد.
   ========================================================================== */

// موقعیت کشورها روی نقشه به صورت درصد (left, top) نسبت به کانتینر نقشه
const COUNTRIES_DATA = {
  germany: {
    id: "germany", name: "آلمان", flag: "🇩🇪", color: "#f1c40f",
    pos: { x: 49, y: 27 },
    money: 12000,
    income: 950, upkeep: 300,
    resources: { iron: 400, oil: 150, coal: 500, uranium: 20, food: 600, parts: 250 },
    military: { infantry: 120, armor: 60, air: 30, navy: 10, defense: 40 },
  },
  france: {
    id: "france", name: "فرانسه", flag: "🇫🇷", color: "#3498db",
    pos: { x: 46, y: 30 },
    money: 11000,
    income: 900, upkeep: 280,
    resources: { iron: 350, oil: 200, coal: 300, uranium: 25, food: 700, parts: 220 },
    military: { infantry: 110, armor: 55, air: 35, navy: 25, defense: 35 },
  },
  britain: {
    id: "britain", name: "بریتانیا", flag: "🇬🇧", color: "#9b59b6",
    pos: { x: 44, y: 24 },
    money: 13000,
    income: 1000, upkeep: 320,
    resources: { iron: 300, oil: 250, coal: 400, uranium: 30, food: 550, parts: 300 },
    military: { infantry: 100, armor: 50, air: 40, navy: 60, defense: 45 },
  },
  usa: {
    id: "usa", name: "آمریکا", flag: "🇺🇸", color: "#2980b9",
    pos: { x: 18, y: 32 },
    money: 25000,
    income: 2000, upkeep: 600,
    resources: { iron: 800, oil: 900, coal: 700, uranium: 60, food: 1200, parts: 600 },
    military: { infantry: 250, armor: 150, air: 120, navy: 100, defense: 90 },
  },
  iran: {
    id: "iran", name: "ایران", flag: "🇮🇷", color: "#27ae60",
    pos: { x: 58, y: 38 },
    money: 8000,
    income: 600, upkeep: 200,
    resources: { iron: 300, oil: 1000, coal: 150, uranium: 40, food: 500, parts: 150 },
    military: { infantry: 180, armor: 70, air: 35, navy: 30, defense: 60 },
    controlsStrait: "hormuz",
  },
  china: {
    id: "china", name: "چین", flag: "🇨🇳", color: "#e74c3c",
    pos: { x: 74, y: 34 },
    money: 20000,
    income: 1800, upkeep: 500,
    resources: { iron: 900, oil: 500, coal: 1000, uranium: 55, food: 1100, parts: 700 },
    military: { infantry: 300, armor: 180, air: 110, navy: 90, defense: 80 },
    controlsStrait: "south_china_sea",
  },
  yemen: {
    id: "yemen", name: "یمن", flag: "🇾🇪", color: "#7f8c8d",
    pos: { x: 60, y: 47 },
    money: 3000,
    income: 200, upkeep: 90,
    resources: { iron: 60, oil: 90, coal: 30, uranium: 2, food: 200, parts: 40 },
    military: { infantry: 60, armor: 15, air: 5, navy: 8, defense: 20 },
    controlsStrait: "bab_el_mandeb",
  },
  russia: {
    id: "russia", name: "روسیه", flag: "🇷🇺", color: "#c0392b",
    pos: { x: 66, y: 20 },
    money: 15000,
    income: 1200, upkeep: 400,
    resources: { iron: 700, oil: 950, coal: 800, uranium: 70, food: 650, parts: 400 },
    military: { infantry: 220, armor: 160, air: 100, navy: 70, defense: 70 },
  },
  japan: {
    id: "japan", name: "ژاپن", flag: "🇯🇵", color: "#e84393",
    pos: { x: 84, y: 33 },
    money: 14000,
    income: 1100, upkeep: 350,
    resources: { iron: 250, oil: 100, coal: 200, uranium: 15, food: 450, parts: 500 },
    military: { infantry: 90, armor: 60, air: 70, navy: 65, defense: 55 },
  },
  india: {
    id: "india", name: "هند", flag: "🇮🇳", color: "#f39c12",
    pos: { x: 65, y: 44 },
    money: 10000,
    income: 850, upkeep: 260,
    resources: { iron: 500, oil: 300, coal: 600, uranium: 35, food: 900, parts: 300 },
    military: { infantry: 260, armor: 100, air: 60, navy: 55, defense: 50 },
  },
};

// تنگه‌ها و مسیرهای دریایی استراتژیک — سیستم داده‌محور
const STRAITS_DATA = {
  hormuz: {
    id: "hormuz", name: "تنگه هرمز", flag: "🌊",
    controllerId: "iran",
    pos: { x: 59, y: 40 },
    blocked: false,
  },
  bab_el_mandeb: {
    id: "bab_el_mandeb", name: "باب‌المندب", flag: "🌊",
    controllerId: "yemen",
    pos: { x: 58, y: 49 },
    blocked: false,
  },
  south_china_sea: {
    id: "south_china_sea", name: "دریای چین جنوبی", flag: "🌊",
    controllerId: "china",
    pos: { x: 76, y: 42 },
    blocked: false,
  },
};

// مناطق قابل تصرف — داده‌محور برای افزودن آسان در آینده
const REGIONS_DATA = [
  { id: "ruhr", name: "منطقه روهر", ownerId: "germany" },
  { id: "alsace", name: "آلزاس", ownerId: "france" },
  { id: "midlands", name: "میدلندز", ownerId: "britain" },
  { id: "texas_belt", name: "کمربند تگزاس", ownerId: "usa" },
  { id: "khuzestan", name: "خوزستان", ownerId: "iran" },
  { id: "guangdong", name: "گوانگ‌دونگ", ownerId: "china" },
  { id: "aden", name: "عدن", ownerId: "yemen" },
  { id: "ural", name: "اورال", ownerId: "russia" },
  { id: "kansai", name: "کانسای", ownerId: "japan" },
  { id: "punjab", name: "پنجاب", ownerId: "india" },
];

// فروشگاه — دسته‌بندی منابع، تجهیزات و تجهیزات استراتژیک (کاملاً انتزاعی)
const SHOP_DATA = {
  resources: [
    { key: "iron", name: "آهن", icon: "⛏", price: 4 },
    { key: "oil", name: "نفت", icon: "🛢", price: 6 },
    { key: "coal", name: "زغال‌سنگ", icon: "🪨", price: 3 },
    { key: "uranium", name: "اورانیوم", icon: "☢", price: 40 },
    { key: "food", name: "مواد غذایی", icon: "🌾", price: 2 },
    { key: "parts", name: "قطعات صنعتی", icon: "⚙", price: 8 },
  ],
  equipment: [
    { key: "infantry", name: "نیروی زمینی", icon: "🪖", price: 15, group: "military" },
    { key: "armor", name: "خودرو زرهی", icon: "🛡", price: 60, group: "military" },
    { key: "air", name: "هواپیما", icon: "✈️", price: 120, group: "military" },
    { key: "navy", name: "ناوگان دریایی", icon: "🚢", price: 150, group: "military" },
    { key: "defense", name: "تجهیزات دفاعی", icon: "🧱", price: 45, group: "military" },
  ],
  strategic: [
    { key: "radar", name: "سامانه رادار استراتژیک", icon: "📡", price: 500, group: "strategic" },
    { key: "satellite", name: "ماهواره نظارتی", icon: "🛰", price: 800, group: "strategic" },
    { key: "command", name: "مرکز فرماندهی سیار", icon: "🚀", price: 1000, group: "strategic" },
  ],
};

const COUNTRY_ORDER = ["germany", "france", "britain", "usa", "iran", "china", "yemen", "russia", "japan", "india"];
