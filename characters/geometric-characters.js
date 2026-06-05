window.GameData = window.GameData || {};

function normalStats() {
  return {
    maxHp: "normal",
    speed: "normal",
    attack: "normal",
    defense: "normal",
  };
}

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
    statProfile: normalStats(),
    stats: window.GameData.statsFromProfile(3, normalStats()),
    abilityIds: ["strike", "guard"],
  },
  {
    id: "miwa",
    name: "Miwa",
    cost: 1,
    model: { shape: "circle" },
    statProfile: normalStats(),
    stats: window.GameData.statsFromProfile(1, normalStats()),
    abilityIds: ["strike", "guard"],
  },
  {
    id: "choso",
    name: "Choso",
    cost: 3,
    model: { shape: "square" },
    statProfile: normalStats(),
    stats: window.GameData.statsFromProfile(3, normalStats()),
    abilityIds: ["strike", "guard"],
  },
];
