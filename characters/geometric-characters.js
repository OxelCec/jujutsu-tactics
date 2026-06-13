window.GameData = window.GameData || {};

function normalStats() {
  return {
    maxHp: "normal",
    speed: "normal",
    attack: "normal",
    defense: "normal",
  };
}

function imageModel(src, fallbackShape = "square") {
  return {
    shape: fallbackShape,
    image: src,
    directions: {
      north: src,
      south: src,
      east: src,
      west: src,
    },
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

const tojiStats = {
  maxHp: "poco",
  speed: "mucho",
  attack: "mucho",
  defense: "poco",
};

const todoStats = {
  maxHp: "bastante",
  speed: "normal",
  attack: "normal",
  defense: "bastante",
};

const mahitoStats = {
  maxHp: "mucho",
  speed: "poco",
  attack: "poco",
  defense: "normal",
};

const megumiStats = {
  maxHp: "poco",
  speed: "bastantePoco",
  attack: "poco",
  defense: "normal",
};

window.GameData.characters = [
  {
    id: "megumi",
    name: "Megumi",
    cost: 5,
    model: { shape: "diamond" },
    statProfile: megumiStats,
    stats: window.GameData.statsFromProfile(5, megumiStats, { maxCe: 150 }),
    abilityIds: ["summonDivineDogs", "summonNue", "summonMaxElephant", "summonMahoraga"],
    damageType: "strike",
  },
  {
    id: "toji",
    name: "Toji",
    cost: 4,
    model: { shape: "triangle" },
    statProfile: tojiStats,
    stats: window.GameData.statsFromProfile(4, tojiStats, { mobility: 3, maxCe: 0 }),
    abilityIds: [
      "equipInvertedSpear",
      "equipSplitSoulKatana",
      "equipChainWeapon",
      "spearThrust",
      "deepCut",
      "sweepingStrike",
      "phantomStep",
    ],
    defaultWeapon: "invertedSpear",
    damageType: "slashing",
  },
  {
    id: "mahito",
    name: "Mahito",
    cost: 5,
    model: { shape: "circle" },
    statProfile: mahitoStats,
    stats: window.GameData.statsFromProfile(5, mahitoStats, { maxCe: 100 }),
    abilityIds: [
      "soulTouch",
      "distortedWorm",
      "idleTransfiguration",
      "selfEmbodiment",
      "instantSpiritBody",
      "predatorDash",
      "blindSpotStrike",
    ],
    passiveId: "blackFlashPotential",
    damageType: "strike",
  },
  {
    id: "yuji",
    name: "Yuji",
    cost: 3,
    model: imageModel("assets/characters/yuji-itadori.png", "square"),
    statProfile: yujiStats,
    stats: window.GameData.statsFromProfile(3, yujiStats, { mobility: 3, maxCe: 100 }),
    abilityIds: ["strike", "guard"],
    passiveId: "focus",
    damageType: "strike",
  },
  {
    id: "miwa",
    name: "Miwa",
    cost: 1,
    model: imageModel("assets/characters/miwa.png", "circle"),
    statProfile: normalStats(),
    stats: window.GameData.statsFromProfile(1, normalStats(), { maxCe: 50 }),
    abilityIds: ["simpleDomain", "counterattack"],
    passiveId: "dedication",
    damageType: "slashing",
  },
  {
    id: "choso",
    name: "Choso",
    cost: 3,
    model: imageModel("assets/characters/choso.png", "square"),
    statProfile: chosoStats,
    stats: window.GameData.statsFromProfile(3, chosoStats, { maxCe: 100 }),
    abilityIds: ["switchChosoStance", "piercingBlood", "supernova"],
    passiveId: "poisonedBlood",
    defaultStance: "blood",
    damageType: "strike",
  },
  {
    id: "todo",
    name: "Aoi Todo",
    cost: 3,
    model: { shape: "diamond" },
    statProfile: todoStats,
    stats: window.GameData.statsFromProfile(3, todoStats, { maxCe: 100 }),
    abilityIds: ["boogieWoogie", "forcedSwap"],
    damageType: "strike",
  },
];
