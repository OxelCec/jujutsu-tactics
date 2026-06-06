window.GameData = window.GameData || {};

window.GameData.passives = {
  dedication: {
    id: "dedication",
    name: "Dedicacion",
  },
  focus: {
    id: "focus",
    name: "Focus",
    maxFocus: 5,
    blackFlashBaseChance: 0.1,
    blackFlashChancePerFocus: 0.05,
    blackFlashDamageMultiplier: 2,
  },
};

window.GameData.abilities = {
  strike: {
    id: "strike",
    name: "Strike",
    type: "attack",
    ceCost: 20,
    attackMultiplier: 1.5,
    range: 1,
  },
  guard: {
    id: "guard",
    name: "Guardia",
    type: "support",
    ceCost: 10,
    range: 1,
  },
  simpleDomain: {
    id: "simpleDomain",
    name: "Dominio simple",
    type: "self",
    ceCost: 30,
    cooldownTurns: 1,
    effect: "simpleDomain",
    description: "Zona de reaccion alrededor de la unidad hasta su siguiente turno",
  },
  counterattack: {
    id: "counterattack",
    name: "Contraataque",
    type: "self",
    ceCost: 30,
    cooldownTurns: 1,
    effect: "counterattack",
    defenseMultiplier: 1.3,
    description: "Defensa x1.3 y contraataque si sobrevive a un ataque",
  },
};
