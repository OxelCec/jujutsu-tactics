window.GameData = window.GameData || {};

window.GameData.passives = {
  dedication: {
    id: "dedication",
    name: "Dedicacion",
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
    ceCost: 0,
    effect: "simpleDomain",
    description: "Zona de reaccion alrededor de la unidad hasta su siguiente turno",
  },
  counterattack: {
    id: "counterattack",
    name: "Contraataque",
    type: "self",
    ceCost: 0,
    effect: "counterattack",
    defenseMultiplier: 1.3,
    description: "Defensa x1.3 y contraataque si sobrevive a un ataque",
  },
};
