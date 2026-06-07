window.GameData = window.GameData || {};

function normalStats() {
  return {
    maxHp: "normal",
    speed: "normal",
    attack: "normal",
    defense: "normal",
  };
}

const yujiStats = {
  maxHp: "bastantePoco",
  speed: "bastante",
  attack: "mucho",
  defense: "normal",
};

const chosoStats = {
  maxHp: "normal",
  speed: "normal",
  attack: "bastante",
  defense: "poco",
};

window.GameData.characters = [
  {
    id: "megumi",
    name: "Megumi",
    cost: 4,
    model: { shape: "diamond" },
    statProfile: normalStats(),
    stats: window.GameData.statsFromProfile(4, normalStats()),
    abilityIds: ["strike", "guard"],
  },
  {
    id: "toji",
    name: "Toji",
    cost: 4,
    model: { shape: "triangle" },
    statProfile: normalStats(),
    stats: window.GameData.statsFromProfile(4, normalStats()),
    abilityIds: ["strike", "guard"],
  },
  {
    id: "mahito",
    name: "Mahito",
    cost: 5,
    model: { shape: "circle" },
    statProfile: normalStats(),
    stats: window.GameData.statsFromProfile(5, normalStats()),
    abilityIds: ["strike", "guard"],
  },
  {
    id: "yuji",
    name: "Yuji",
    cost: 3,
    model: { shape: "square" },
    statProfile: yujiStats,
    stats: window.GameData.statsFromProfile(3, yujiStats, { mobility: 3, maxCe: 100 }),
    abilityIds: ["strike", "guard"],
    passiveId: "focus",
  },
  {
    id: "miwa",
    name: "Miwa",
    cost: 1,
    model: { shape: "circle" },
    statProfile: normalStats(),
    stats: window.GameData.statsFromProfile(1, normalStats(), { maxCe: 50 }),
    abilityIds: ["simpleDomain", "counterattack"],
    passiveId: "dedication",
  },
  {
    id: "choso",
    name: "Choso",
    cost: 3,
    model: { shape: "square" },
    statProfile: chosoStats,
    stats: window.GameData.statsFromProfile(3, chosoStats, { maxCe: 100 }),
    abilityIds: ["switchChosoStance", "piercingBlood", "supernova"],
    passiveId: "poisonedBlood",
    defaultStance: "blood",
  },
];
