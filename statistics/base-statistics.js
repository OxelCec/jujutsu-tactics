window.GameData = window.GameData || {};

window.GameData.statTiers = {
  poco: -2,
  bastantePoco: -1,
  normal: 0,
  bastante: 1,
  mucho: 2,
};

window.GameData.baseStatsForCost = function baseStatsForCost(cost) {
  return {
    maxHp: 20 + cost * 3,
    speed: 10 + cost * 2,
    attack: 10 + cost * 2,
    defense: 4 + cost,
    mobility: 2,
    maxCe: 100,
  };
};

window.GameData.statsFromProfile = function statsFromProfile(cost, profile = {}) {
  const base = window.GameData.baseStatsForCost(cost);
  const tierValue = (stat) => window.GameData.statTiers[profile[stat] ?? "normal"] ?? 0;

  return {
    maxHp: base.maxHp + tierValue("maxHp") * 3,
    speed: base.speed + tierValue("speed") * 2,
    attack: base.attack + tierValue("attack") * 2,
    defense: base.defense + tierValue("defense"),
    mobility: base.mobility,
    maxCe: base.maxCe,
  };
};
