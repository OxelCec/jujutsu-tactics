const data = window.GameData;
let activeMap = data.maps.placeholder;
let SIZE = activeMap.size;
let LEVELS = activeMap.levels;
const MAX_TURN = 100;
const TEAM_BUDGET = 6;
const INITIATIVE_SCALE = 1;
const SUKUNA_FINGER_COUNT = 7;
const SUKUNA_TRANSFORM_FINGERS = 5;
const SUKUNA_TRANSFORM_ATTACK_MULTIPLIER = 4;
const SUKUNA_FINGER_DAMAGE_REDUCTION = 0.2;
const TURN_CE_REGEN_RATE = 0.08;
const MIN_CE_STAT_SCALE = 0.75;
const CHOSO_BLOOD_RANGE = 4;
const CHOSO_BLOOD_MELEE_MULTIPLIER = 0.75;
const CHOSO_BLOOD_RANGED_MULTIPLIER = 1;
const CHOSO_COMBAT_MULTIPLIER = 1.35;
const CHOSO_BLOOD_DEFENSE_MULTIPLIER = 0.85;
const CHOSO_COMBAT_DEFENSE_MULTIPLIER = 1.3;
const POISON_MAX_STACKS = 3;
const POISON_DAMAGE_PER_STACK = 4;
const POISON_DURATION_TURNS = 2;
const SUPERNOVA_DURATION_TURNS = 3;
const BOARD_MIN_ZOOM = 0.55;
const BOARD_MAX_ZOOM = 1.85;
let initiativeFrameId = null;
let lastInitiativeAt = 0;

const state = {
  units: [],
  currentUnitId: null,
  previewLevel: 0,
  selectedAction: "move",
  selectedAbilityId: null,
  abilityMenuOpen: false,
  pendingTransfer: null,
  inspectedTile: null,
  inspectedUnitId: null,
  reachable: new Set(),
  attackable: new Set(),
  abilityTargets: new Set(),
  visualEvents: [],
  fingers: [],
  supernovas: [],
  holes: [],
  terrainObjects: [],
  yujiFingerState: {},
  boardCamera: {
    x: 0,
    y: 0,
    scale: 1,
    panning: false,
    lastX: 0,
    lastY: 0,
  },
  actionBarCamera: {
    x: 0,
    y: 0,
    panning: false,
    lastX: 0,
    lastY: 0,
  },
  round: 1,
  turnCount: 0,
  gameOver: false,
  log: [],
};

const setup = {
  step: "start",
  selectedTeam: "blue",
  selectedMapId: "placeholder",
  teams: {
    blue: [],
    red: [],
  },
};

const battlefieldEl = document.querySelector("#battlefield");
const setupScreenEl = document.querySelector("#setupScreen");
const setupEyebrowEl = document.querySelector("#setupEyebrow");
const setupTitleEl = document.querySelector("#setupTitle");
const setupTextEl = document.querySelector("#setupText");
const setupContentEl = document.querySelector("#setupContent");
const setupActionsEl = document.querySelector("#setupActions");
const boardEl = document.querySelector("#board");
const boardShellEl = document.querySelector(".board-shell");
const teamListEl = document.querySelector("#teamList");
const initiativeTrackEl = document.querySelector("#initiativeTrack");
const phaseTextEl = document.querySelector("#phaseText");
const roundTextEl = document.querySelector("#roundText");
const unitCardEl = document.querySelector("#unitCard");
const logEl = document.querySelector("#log");
const attackBtn = document.querySelector("#attackBtn");
const skillBtn = document.querySelector("#skillBtn");
const specialBtn = document.querySelector("#specialBtn");
const transferPanelEl = document.querySelector("#transferPanel");
const transferAmountInput = document.querySelector("#transferAmount");
const confirmTransferBtn = document.querySelector("#confirmTransferBtn");
const cancelTransferBtn = document.querySelector("#cancelTransferBtn");
const abilityMenuEl = document.querySelector("#abilityMenu");
const tileInfoEl = document.querySelector("#tileInfo");
const stairsUpBtn = document.querySelector("#stairsUpBtn");
const stairsDownBtn = document.querySelector("#stairsDownBtn");
const endBtn = document.querySelector("#endBtn");
const restartBtn = document.querySelector("#restartBtn");

function battleStatsForCharacter(character) {
  return character.stats ?? data.baseStatsForCost(character.cost);
}

function teamCost(team) {
  return setup.teams[team].reduce((total, characterId) => {
    const character = data.characters.find((entry) => entry.id === characterId);
    return total + (character?.cost ?? 0);
  }, 0);
}

function createBattleUnit(character, team, index) {
  const stats = battleStatsForCharacter(character);
  const spawn = activeMap.spawns[team][index];
  return {
    ...character,
    id: `${team}-${character.id}`,
    characterId: character.id,
    team,
    ...spawn,
    shape: character.model.shape,
    facing: "south",
    maxHp: stats.maxHp,
    hp: stats.maxHp,
    speed: stats.speed,
    attack: stats.attack,
    defense: stats.defense,
    mobility: stats.mobility,
    maxCe: stats.maxCe,
    ce: stats.maxCe,
    focus: character.passiveId === "focus" ? 0 : null,
    stance: character.defaultStance ?? null,
    poisonStacks: 0,
    poisonTurnsRemaining: 0,
    sukunaFingers: 0,
    attackedThisTurn: false,
    abilityCooldowns: {},
    activeEffects: {},
    statuses: [...(character.statuses ?? [])],
    defeated: false,
    initiative: 0,
    acted: false,
    moved: false,
  };
}

function modelImageFor(entity) {
  const model = entity?.model;
  if (!model) return null;
  return model.directions?.[entity.facing] ?? model.image ?? null;
}

function resetBoardCamera() {
  state.boardCamera.x = 0;
  state.boardCamera.y = 0;
  state.boardCamera.scale = 1;
  state.boardCamera.panning = false;
  state.boardCamera.lastX = 0;
  state.boardCamera.lastY = 0;
  applyBoardCamera();
}

function resetActionBarCamera() {
  state.actionBarCamera.x = 0;
  state.actionBarCamera.y = 0;
  state.actionBarCamera.panning = false;
  state.actionBarCamera.lastX = 0;
  state.actionBarCamera.lastY = 0;
  applyActionBarCamera();
}

function applyBoardCamera() {
  boardEl.style.transform = `translate(${state.boardCamera.x}px, ${state.boardCamera.y}px) scale(${state.boardCamera.scale})`;
}

function applyActionBarCamera() {
  initiativeTrackEl.style.transform = `translate(${state.actionBarCamera.x}px, ${state.actionBarCamera.y}px)`;
}

function canStartBoardPan(event) {
  if (event.button !== 0) return false;
  return !event.target.closest(".tile, .initiative-track, .initiative-token, button, input, .panel");
}

function startBoardPan(event) {
  if (!canStartBoardPan(event)) return;
  state.boardCamera.panning = true;
  state.boardCamera.lastX = event.clientX;
  state.boardCamera.lastY = event.clientY;
  boardShellEl.classList.add("panning");
  event.preventDefault();
}

function moveBoardPan(event) {
  if (!state.boardCamera.panning) return;
  const dx = event.clientX - state.boardCamera.lastX;
  const dy = event.clientY - state.boardCamera.lastY;
  state.boardCamera.x += dx;
  state.boardCamera.y += dy;
  state.boardCamera.lastX = event.clientX;
  state.boardCamera.lastY = event.clientY;
  applyBoardCamera();
}

function stopBoardPan() {
  state.boardCamera.panning = false;
  boardShellEl.classList.remove("panning");
}

function startActionBarPan(event) {
  if (event.button !== 0) return;
  state.actionBarCamera.panning = true;
  state.actionBarCamera.lastX = event.clientX;
  state.actionBarCamera.lastY = event.clientY;
  initiativeTrackEl.classList.add("panning");
  event.preventDefault();
}

function moveActionBarPan(event) {
  if (!state.actionBarCamera.panning) return;
  const dx = event.clientX - state.actionBarCamera.lastX;
  const dy = event.clientY - state.actionBarCamera.lastY;
  state.actionBarCamera.x += dx;
  state.actionBarCamera.y += dy;
  state.actionBarCamera.lastX = event.clientX;
  state.actionBarCamera.lastY = event.clientY;
  applyActionBarCamera();
}

function stopActionBarPan() {
  state.actionBarCamera.panning = false;
  initiativeTrackEl.classList.remove("panning");
}

function zoomBoard(event) {
  if (battlefieldEl.classList.contains("hidden")) return;
  event.preventDefault();
  const previousScale = state.boardCamera.scale;
  const zoomFactor = event.deltaY < 0 ? 1.08 : 0.92;
  const nextScale = Math.max(BOARD_MIN_ZOOM, Math.min(BOARD_MAX_ZOOM, previousScale * zoomFactor));
  if (nextScale === previousScale) return;

  const rect = boardShellEl.getBoundingClientRect();
  const originX = event.clientX - rect.left - rect.width / 2;
  const originY = event.clientY - rect.top - rect.height / 2;
  const scaleRatio = nextScale / previousScale;
  state.boardCamera.x = originX - (originX - state.boardCamera.x) * scaleRatio;
  state.boardCamera.y = originY - (originY - state.boardCamera.y) * scaleRatio;
  state.boardCamera.scale = nextScale;
  applyBoardCamera();
}

function initBattle() {
  stopInitiativeClock();
  activeMap = data.maps[setup.selectedMapId];
  SIZE = activeMap.size;
  LEVELS = activeMap.levels;
  state.units = ["blue", "red"].flatMap((team) =>
    setup.teams[team].map((characterId, index) => {
      const character = data.characters.find((entry) => entry.id === characterId);
      return createBattleUnit(character, team, index);
    }),
  );
  state.currentUnitId = null;
  state.previewLevel = 0;
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  state.inspectedTile = null;
  state.inspectedUnitId = null;
  state.reachable.clear();
  state.attackable.clear();
  state.abilityTargets.clear();
  state.visualEvents = [];
  state.holes = (activeMap.holes ?? []).map((hole) => ({ ...hole }));
  state.terrainObjects = (activeMap.terrainObjects ?? []).map((object) => ({
    ...object,
    hp: object.maxHp,
  }));
  state.fingers = spawnSukunaFingers();
  state.supernovas = [];
  state.yujiFingerState = Object.fromEntries(
    state.units
      .filter((unit) => unit.characterId === "yuji")
      .map((unit) => [unit.id, { consumed: 0, contributions: {}, deadTurnsReady: 0, transformed: false }]),
  );
  state.round = 1;
  state.turnCount = 0;
  state.gameOver = false;
  state.log = ["Empieza la batalla."];
  resetBoardCamera();
  resetActionBarCamera();
  setupScreenEl.classList.add("hidden");
  battlefieldEl.classList.remove("hidden");
  advanceToNextTurn();
}

function renderSetupScreen() {
  battlefieldEl.classList.add("hidden");
  setupScreenEl.classList.remove("hidden");
  setupContentEl.innerHTML = "";
  setupActionsEl.innerHTML = "";
  roundTextEl.textContent = "Preparacion";

  if (setup.step === "start") {
    phaseTextEl.textContent = "Listo para preparar batalla";
    setupEyebrowEl.textContent = "Inicio";
    setupTitleEl.textContent = "Geometria Tactics";
    setupTextEl.textContent = "Forma dos equipos con 6 puntos cada uno y entra en el mapa.";
    setupActionsEl.append(setupButton("Iniciar juego", () => {
      setup.step = "blue";
      setup.selectedTeam = "blue";
      renderSetupScreen();
    }));
    return;
  }

  if (setup.step === "blue" || setup.step === "red") {
    renderTeamSetup(setup.step);
    return;
  }

  renderMapSetup();
}

function setupButton(text, onClick, className = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = text;
  button.className = className;
  button.addEventListener("click", onClick);
  return button;
}

function renderTeamSetup(team) {
  const isBlue = team === "blue";
  const used = teamCost(team);
  const remaining = TEAM_BUDGET - used;
  phaseTextEl.textContent = `Seleccion del equipo ${isBlue ? "Azul" : "Rojo"}`;
  setupEyebrowEl.textContent = isBlue ? "Equipo azul" : "Equipo rojo";
  setupTitleEl.textContent = `Elige unidades (${used}/${TEAM_BUDGET})`;
  setupTextEl.textContent = `Puedes elegir cualquier combinacion que no pase de ${TEAM_BUDGET} puntos.`;

  const roster = document.createElement("div");
  roster.className = "roster-grid";
  for (const character of data.characters) {
    const selected = setup.teams[team].includes(character.id);
    const overBudget = !selected && character.cost > remaining;
    const card = document.createElement("button");
    card.type = "button";
    card.className = `roster-card ${selected ? "selected" : ""}`;
    card.disabled = overBudget;
    card.addEventListener("click", () => toggleCharacter(team, character.id));

    const preview = document.createElement("span");
    const previewImage = modelImageFor(character);
    preview.className = [
      "unit-preview",
      character.model.shape,
      isBlue ? "blue-unit" : "red-unit",
      previewImage ? "image-model" : "",
    ].filter(Boolean).join(" ");
    if (previewImage) preview.style.backgroundImage = `url("${previewImage}")`;

    const name = document.createElement("strong");
    name.textContent = character.name;

    const cost = document.createElement("span");
    cost.textContent = `${character.cost} puntos`;

    card.append(preview, name, cost);
    roster.append(card);
  }
  setupContentEl.append(roster);

  const backStep = isBlue ? "start" : "blue";
  setupActionsEl.append(setupButton("Atras", () => {
    setup.step = backStep;
    setup.selectedTeam = backStep === "blue" ? "blue" : setup.selectedTeam;
    renderSetupScreen();
  }));

  const next = setupButton(isBlue ? "Equipo rojo" : "Elegir mapa", () => {
    setup.step = isBlue ? "red" : "map";
    setup.selectedTeam = isBlue ? "red" : setup.selectedTeam;
    renderSetupScreen();
  }, "primary");
  next.disabled = used === 0;
  setupActionsEl.append(next);
}

function toggleCharacter(team, characterId) {
  const selected = setup.teams[team];
  if (selected.includes(characterId)) {
    setup.teams[team] = selected.filter((id) => id !== characterId);
    renderSetupScreen();
    return;
  }

  const character = data.characters.find((entry) => entry.id === characterId);
  if (teamCost(team) + character.cost > TEAM_BUDGET) return;
  selected.push(characterId);
  renderSetupScreen();
}

function renderMapSetup() {
  phaseTextEl.textContent = "Seleccion de mapa";
  setupEyebrowEl.textContent = "Mapa";
  setupTitleEl.textContent = "Elige escenario";
  setupTextEl.textContent = "Por ahora solo hay un mapa disponible.";

  const mapGrid = document.createElement("div");
  mapGrid.className = "map-grid";
  for (const map of Object.values(data.maps)) {
    const mapButton = document.createElement("button");
    mapButton.type = "button";
    mapButton.className = `map-card ${setup.selectedMapId === map.id ? "selected" : ""}`;
    mapButton.addEventListener("click", () => {
      setup.selectedMapId = map.id;
      renderSetupScreen();
    });
    mapButton.innerHTML = `<strong>${map.name}</strong><span>${map.size}x${map.size} - ${map.levels} pisos</span>`;
    mapGrid.append(mapButton);
  }
  setupContentEl.append(mapGrid, renderSelectionSummary());

  setupActionsEl.append(setupButton("Atras", () => {
    setup.step = "red";
    setup.selectedTeam = "red";
    renderSetupScreen();
  }));
  setupActionsEl.append(setupButton("Empezar batalla", initBattle, "primary"));
}

function renderSelectionSummary() {
  const summary = document.createElement("div");
  summary.className = "selection-summary";
  for (const team of ["blue", "red"]) {
    const block = document.createElement("div");
    block.className = "summary-team";
    const title = document.createElement("strong");
    title.textContent = `${team === "blue" ? "Azul" : "Rojo"}: ${teamCost(team)}/${TEAM_BUDGET}`;
    const list = document.createElement("span");
    list.textContent = setup.teams[team]
      .map((id) => data.characters.find((character) => character.id === id)?.name)
      .join(", ");
    block.append(title, list);
    summary.append(block);
  }
  return summary;
}

function livingUnits() {
  return state.units.filter((unit) => unit.hp > 0);
}

function turnEligibleUnits() {
  return state.units.filter((unit) => unit.hp > 0 || canDeadYujiTransform(unit));
}

function currentUnit() {
  return state.units.find((unit) => unit.id === state.currentUnitId);
}

function inspectedUnit() {
  return state.units.find((unit) => unit.id === state.inspectedUnitId);
}

function enemyTeam(team) {
  return team === "blue" ? "red" : "blue";
}

function key(x, y, z) {
  return `${x},${y},${z}`;
}

function unitAt(x, y, z) {
  return state.units.find((unit) => unit.x === x && unit.y === y && unit.z === z);
}

function livingUnitAt(x, y, z) {
  return livingUnits().find((unit) => unit.x === x && unit.y === y && unit.z === z);
}

function terrainObjectAt(x, y, z) {
  return state.terrainObjects.find((object) => object.x === x && object.y === y && object.z === z);
}

function solidTerrainAt(x, y, z) {
  return terrainObjectAt(x, y, z);
}

function holeAt(x, y, z) {
  return state.holes.find((hole) => hole.x === x && hole.y === y && hole.z === z);
}

function hasStatus(unit, status) {
  return unit?.statuses?.includes(status);
}

function isFlying(unit) {
  return hasStatus(unit, "volador") || hasStatus(unit, "flying");
}

function isAdjacent4To(x, y, targetX, targetY) {
  return Math.abs(x - targetX) + Math.abs(y - targetY) === 1;
}

function canOccupyTile(unit, x, y, z) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE || z < 0 || z >= LEVELS) return false;
  const occupant = unitAt(x, y, z);
  if (occupant && occupant.id !== unit.id) return false;
  if (solidTerrainAt(x, y, z)) return false;
  if (holeAt(x, y, z) && !isFlying(unit)) return false;
  return true;
}

function addHole(x, y, z) {
  if (z <= 0 || z >= LEVELS || holeAt(x, y, z)) return;
  state.holes.push({ id: `hole-${Date.now()}-${state.holes.length}`, x, y, z });
  addLog(`Se abre un agujero en ${x + 1},${y + 1}, nivel ${z + 1}.`);
}

function levelChangeTarget(unit, direction) {
  if (!unit) return false;
  const nextZ = unit.z + direction;
  if (nextZ < 0 || nextZ >= LEVELS) return null;

  const stair = stairAt(unit.x, unit.y, unit.z);
  if (stair?.levels.includes(nextZ) && canOccupyTile(unit, unit.x, unit.y, nextZ)) {
    return { x: unit.x, y: unit.y, z: nextZ, type: "stairs" };
  }

  if (direction < 0) {
    if (isFlying(unit) && holeAt(unit.x, unit.y, unit.z) && canOccupyTile(unit, unit.x, unit.y, nextZ)) {
      return { x: unit.x, y: unit.y, z: nextZ, type: "hole" };
    }

    const adjacentHole = state.holes.find((hole) =>
      hole.z === unit.z
      && isAdjacent4To(unit.x, unit.y, hole.x, hole.y)
      && canOccupyTile(unit, hole.x, hole.y, nextZ),
    );
    if (adjacentHole) return { x: adjacentHole.x, y: adjacentHole.y, z: nextZ, type: "hole" };
  }

  if (direction > 0 && isFlying(unit) && holeAt(unit.x, unit.y, nextZ) && canOccupyTile(unit, unit.x, unit.y, nextZ)) {
    return { x: unit.x, y: unit.y, z: nextZ, type: "hole" };
  }

  return null;
}

function canChangeLevel(unit, direction) {
  return Boolean(levelChangeTarget(unit, direction));
}

function settleUnitPosition(unit) {
  if (!unit || unit.hp <= 0 || isFlying(unit)) return;

  while (unit.z > 0 && holeAt(unit.x, unit.y, unit.z)) {
    const nextZ = unit.z - 1;
    if (unitAt(unit.x, unit.y, nextZ) || solidTerrainAt(unit.x, unit.y, nextZ)) return;
    unit.z = nextZ;
    state.previewLevel = unit.z;
    addLog(`${unit.name} cae por el agujero hasta el nivel ${unit.z + 1}.`);
  }
}

function settleUnitsOnHoles() {
  for (const unit of state.units) settleUnitPosition(unit);
}

function fingerPileAt(x, y, z) {
  return state.fingers.find((pile) => pile.x === x && pile.y === y && pile.z === z);
}

function supernovaAt(x, y, z) {
  return state.supernovas.find((orb) => orb.x === x && orb.y === y && orb.z === z);
}

function activeSupernovaForUnit(unit) {
  return unit ? state.supernovas.find((orb) => orb.ownerId === unit.id) : null;
}

function isTerrainObject(target) {
  return Boolean(target?.type === "cube" || target?.type === "pillar");
}

function addFingerPile(x, y, z, count) {
  if (count <= 0) return;
  const existing = fingerPileAt(x, y, z);
  if (existing) {
    existing.count += count;
    return;
  }
  state.fingers.push({ id: `finger-${Date.now()}-${state.fingers.length}`, x, y, z, count });
}

function removeFingerPile(pile) {
  state.fingers = state.fingers.filter((entry) => entry.id !== pile.id);
}

function spawnSukunaFingers() {
  if (!hasYujiInBattle()) return [];

  const blocked = new Set([
    ...state.units.map((unit) => key(unit.x, unit.y, unit.z)),
    ...state.terrainObjects.map((object) => key(object.x, object.y, object.z)),
    ...state.holes.map((hole) => key(hole.x, hole.y, hole.z)),
  ]);
  const piles = [];
  let attempts = 0;
  while (piles.length < SUKUNA_FINGER_COUNT && attempts < 1000) {
    attempts += 1;
    const x = Math.floor(Math.random() * SIZE);
    const y = Math.floor(Math.random() * SIZE);
    const z = Math.floor(Math.random() * LEVELS);
    const tileKey = key(x, y, z);
    if (blocked.has(tileKey) || piles.some((pile) => key(pile.x, pile.y, pile.z) === tileKey)) continue;
    piles.push({ id: `finger-start-${piles.length}`, x, y, z, count: 1 });
  }
  return piles;
}

function yujiFingerState(yuji) {
  return yuji ? state.yujiFingerState[yuji.id] : null;
}

function consumeFingersForYuji(yuji, count, giver = null) {
  const fingerState = yujiFingerState(yuji);
  if (!fingerState || count <= 0) return;
  fingerState.consumed += count;
  if (giver) {
    fingerState.contributions[giver.id] = (fingerState.contributions[giver.id] ?? 0) + count;
  }
  addLog(`${yuji.name} consume ${count} dedo${count === 1 ? "" : "s"} de Sukuna (${fingerState.consumed}).`);
}

function pickupFingersAtUnit(unit) {
  if (unit.hp <= 0) return;
  const pile = fingerPileAt(unit.x, unit.y, unit.z);
  if (!pile) return;
  const count = pile.count;
  removeFingerPile(pile);
  if (unit.characterId === "yuji") {
    consumeFingersForYuji(unit, count);
    return;
  }
  unit.sukunaFingers += count;
  addLog(`${unit.name} recoge ${count} dedo${count === 1 ? "" : "s"} de Sukuna.`);
}

function dropFingersFromUnit(unit) {
  if (unit.sukunaFingers <= 0) return;
  addFingerPile(unit.x, unit.y, unit.z, unit.sukunaFingers);
  addLog(`${unit.name} deja caer ${unit.sukunaFingers} dedo${unit.sukunaFingers === 1 ? "" : "s"} de Sukuna.`);
  unit.sukunaFingers = 0;
}

function stairAt(x, y, z) {
  return activeMap.stairs.find((stair) => stair.x === x && stair.y === y && stair.levels.includes(z));
}

function getAbility(unit, abilityId = "strike") {
  if (!unit.abilityIds.includes(abilityId)) return null;
  return data.abilities[abilityId];
}

function getAbilities(unit) {
  return unit.abilityIds
    .map((abilityId) => data.abilities[abilityId])
    .filter((ability) => ability && (isAbilityAvailableInStance(unit, ability) || (ability.id === "supernova" && activeSupernovaForUnit(unit))));
}

function getPassive(unit) {
  return unit.passiveId ? data.passives?.[unit.passiveId] : null;
}

function isAbilityAvailableInStance(unit, ability) {
  return !ability.requiredStance || unit.stance === ability.requiredStance;
}

function isChoso(unit) {
  return unit?.characterId === "choso";
}

function stanceLabel(unit) {
  if (unit.stance === "blood") return "Modo sangre";
  if (unit.stance === "combat") return "Modo combate";
  return "";
}

function basicAttackRange(unit) {
  return isChoso(unit) && unit.stance === "blood" ? CHOSO_BLOOD_RANGE : 1;
}

function stanceDefenseMultiplier(unit) {
  if (!isChoso(unit)) return 1;
  return unit.stance === "combat" ? CHOSO_COMBAT_DEFENSE_MULTIPLIER : CHOSO_BLOOD_DEFENSE_MULTIPLIER;
}

function chosoBasicAttackMultiplier(unit, target) {
  if (!isChoso(unit)) return 1;
  if (unit.stance === "combat") return CHOSO_COMBAT_MULTIPLIER;
  return distance2d(unit, target.x, target.y) === 1 ? CHOSO_BLOOD_MELEE_MULTIPLIER : CHOSO_BLOOD_RANGED_MULTIPLIER;
}

function isYuji(unit) {
  return unit?.characterId === "yuji";
}

function hasYujiInBattle() {
  return state.units.some((unit) => isYuji(unit));
}

function canDeadYujiTransform(unit) {
  if (!isYuji(unit) || unit.hp > 0) return false;
  const fingerState = yujiFingerState(unit);
  return Boolean(fingerState && fingerState.consumed >= SUKUNA_TRANSFORM_FINGERS && !fingerState.transformed);
}

function contributionCountForYuji(unit, yuji) {
  return yujiFingerState(yuji)?.contributions[unit.id] ?? 0;
}

function totalFingerContributions(unit) {
  return Object.values(state.yujiFingerState).reduce((total, fingerState) => total + (fingerState.contributions[unit.id] ?? 0), 0);
}

function adjacentYujiForTransfer(unit) {
  if (!unit || unit.sukunaFingers <= 0) return null;
  return state.units.find((candidate) => {
    if (!isYuji(candidate)) return false;
    if (!isAdjacent8(unit, candidate)) return false;
    if (candidate.hp > 0) return candidate.team === unit.team;
    return true;
  });
}

function canTransferFingers(unit) {
  return Boolean(adjacentYujiForTransfer(unit));
}

function focusChance(unit) {
  const passive = getPassive(unit);
  if (passive?.id !== "focus") return 0;
  return passive.blackFlashBaseChance + passive.blackFlashChancePerFocus * unit.focus;
}

function distance2d(a, x, y) {
  return Math.abs(a.x - x) + Math.abs(a.y - y);
}

function isAdjacent8(a, b) {
  return a.z === b.z && Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;
}

function ceStatScale(unit) {
  if (!unit.maxCe) return 1;
  const ceRatio = Math.max(0, Math.min(1, unit.ce / unit.maxCe));
  return MIN_CE_STAT_SCALE + (1 - MIN_CE_STAT_SCALE) * ceRatio;
}

function effectiveAttack(unit) {
  return Math.max(1, Math.floor(unit.attack * ceStatScale(unit)));
}

function effectiveSpeed(unit) {
  return Math.max(1, Math.floor(unit.speed * ceStatScale(unit)));
}

function effectiveDefense(unit) {
  const multiplier = unit.activeEffects.defenseMultiplier ?? 1;
  return Math.max(1, Math.floor(unit.defense * ceStatScale(unit) * multiplier * stanceDefenseMultiplier(unit)));
}

function defenseLabel(unit) {
  const multiplier = (unit.activeEffects.defenseMultiplier ?? 1) * stanceDefenseMultiplier(unit);
  if (multiplier === 1) return String(effectiveDefense(unit));
  return `${effectiveDefense(unit)} (${unit.defense} x${multiplier})`;
}

function abilityCooldown(unit, abilityId) {
  return unit.abilityCooldowns[abilityId] ?? 0;
}

function tickAbilityCooldowns(unit) {
  for (const [abilityId, remaining] of Object.entries(unit.abilityCooldowns)) {
    const next = Math.max(0, remaining - 1);
    if (next) unit.abilityCooldowns[abilityId] = next;
    else delete unit.abilityCooldowns[abilityId];
  }
}

function setAbilityCooldown(unit, ability) {
  if (!ability.cooldownTurns) return;
  unit.abilityCooldowns[ability.id] = ability.cooldownTurns + 1;
}

function regenerateTurnCe(unit) {
  if (unit.hp <= 0 || unit.ce >= unit.maxCe) return;
  const amount = Math.max(1, Math.ceil(unit.maxCe * TURN_CE_REGEN_RATE));
  const before = unit.ce;
  unit.ce = Math.min(unit.maxCe, unit.ce + amount);
  if (unit.ce !== before) addLog(`${unit.name} recupera ${unit.ce - before} CE.`);
}

function applyPoison(target, amount = 1) {
  if (target.hp <= 0) return;
  const before = target.poisonStacks ?? 0;
  target.poisonStacks = Math.min(POISON_MAX_STACKS, before + amount);
  target.poisonTurnsRemaining = POISON_DURATION_TURNS;
  if (target.poisonStacks !== before) {
    addLog(`${target.name} recibe Veneno (${target.poisonStacks}/${POISON_MAX_STACKS}).`);
    return;
  }
  addLog(`Veneno de ${target.name} se mantiene (${target.poisonTurnsRemaining} turnos).`);
}

function poisonDamageMultiplier(attacker, target) {
  const passive = getPassive(attacker);
  if (passive?.id !== "poisonedBlood") return 1;
  return 1 + (target.poisonStacks ?? 0) * passive.damagePerPoisonStack;
}

function processPoisonStartOfTurn(unit) {
  if (unit.hp <= 0 || !unit.poisonStacks) return false;
  const damage = unit.poisonStacks * POISON_DAMAGE_PER_STACK;
  unit.hp = Math.max(0, unit.hp - damage);
  addLog(`${unit.name} sufre ${damage} dano por Veneno.`);
  unit.poisonTurnsRemaining = Math.max(0, (unit.poisonTurnsRemaining ?? POISON_DURATION_TURNS) - 1);
  if (unit.hp > 0) return false;
  handleUnitDefeated(unit);
  if (checkVictory()) {
    render();
    return true;
  }
  state.currentUnitId = null;
  render();
  startInitiativeClock();
  return true;
}

function clearExpiredPoison(unit) {
  if (unit.hp <= 0 || !unit.poisonStacks || unit.poisonTurnsRemaining > 0) return;
  unit.poisonStacks = 0;
  unit.poisonTurnsRemaining = 0;
  addLog(`Veneno de ${unit.name} se disipa.`);
}

function selectedAbility() {
  const unit = currentUnit();
  if (!unit || !state.selectedAbilityId) return null;
  const ability = getAbility(unit, state.selectedAbilityId);
  return ability && isAbilityAvailableInStance(unit, ability) ? ability : null;
}

function abilityDescription(ability) {
  const cooldown = ability.cooldownTurns ? `, CD ${ability.cooldownTurns}` : "";
  if (ability.id === "supernova") return `Coloca un orbe ${SUPERNOVA_DURATION_TURNS} turnos; activacion gratis, ${ability.ceCost} CE${cooldown}`;
  if (ability.description) return `${ability.description}, ${ability.ceCost} CE${cooldown}`;
  if (ability.type === "self") return `Personal, ${ability.ceCost} CE${cooldown}`;
  if (ability.type === "areaAttack") return `Area ${ability.radius}, x${ability.attackMultiplier}, ${ability.ceCost} CE${cooldown}`;
  if (ability.type === "attack") return `Ataque x${ability.attackMultiplier}, ${ability.ceCost} CE${cooldown}`;
  return `Apoyo/utilidad, ${ability.ceCost} CE${cooldown}`;
}

function queueVisualEvent(type, payload = {}) {
  state.visualEvents.push({
    id: `${Date.now()}-${state.visualEvents.length}`,
    type,
    ...payload,
  });
  state.visualEvents = state.visualEvents.slice(-20);
}

function addLog(text) {
  state.log.unshift(text);
  state.log = state.log.slice(0, 12);
}

function stopInitiativeClock() {
  if (initiativeFrameId) cancelAnimationFrame(initiativeFrameId);
  initiativeFrameId = null;
  lastInitiativeAt = 0;
}

function startInitiativeClock() {
  if (state.gameOver || state.currentUnitId || initiativeFrameId) return;
  phaseTextEl.textContent = "La barra de accion avanza";
  lastInitiativeAt = performance.now();
  initiativeFrameId = requestAnimationFrame(tickInitiative);
}

function tickInitiative(now) {
  if (state.gameOver || state.currentUnitId) {
    stopInitiativeClock();
    return;
  }

  const elapsed = Math.min(0.08, (now - lastInitiativeAt) / 1000);
  lastInitiativeAt = now;

  for (const unit of turnEligibleUnits()) {
    unit.initiative = Math.min(MAX_TURN, unit.initiative + effectiveSpeed(unit) * elapsed * INITIATIVE_SCALE);
  }

  const ready = turnEligibleUnits().filter((unit) => unit.initiative >= MAX_TURN);
  if (ready.length) {
    stopInitiativeClock();
    selectNextTurn(ready);
    return;
  }

  renderInitiative();
  initiativeFrameId = requestAnimationFrame(tickInitiative);
}

function selectNextTurn(ready) {
  const ordered = ready
    .map((unit) => ({ unit, tieBreaker: Math.random() }))
    .sort((a, b) => b.unit.initiative - a.unit.initiative || effectiveSpeed(b.unit) - effectiveSpeed(a.unit) || a.tieBreaker - b.tieBreaker);
  const next = ordered[0].unit;
  if (handleDeadYujiTurn(next)) return;
  expireTurnEffects(next);
  if (processPoisonStartOfTurn(next)) return;
  clearExpiredPoison(next);
  regenerateTurnCe(next);
  tickAbilityCooldowns(next);
  next.initiative = 0;
  next.acted = false;
  next.moved = false;
  next.attackedThisTurn = false;
  state.currentUnitId = next.id;
  state.previewLevel = next.z;
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  state.inspectedTile = null;
  state.turnCount += 1;
  state.round = Math.floor((state.turnCount - 1) / Math.max(1, turnEligibleUnits().length)) + 1;
  calculateRanges();
  addLog(`Turno de ${next.name} (${next.team === "blue" ? "Azul" : "Rojo"}).`);
  render();
}

function handleDeadYujiTurn(unit) {
  if (!canDeadYujiTransform(unit)) return false;
  const fingerState = yujiFingerState(unit);
  unit.initiative = 0;
  fingerState.deadTurnsReady += 1;

  if (fingerState.deadTurnsReady < 2) {
    addLog(`${unit.name} yace en el suelo. Sukuna aun no despierta.`);
    state.currentUnitId = null;
    render();
    startInitiativeClock();
    return true;
  }

  transformYujiIntoSukuna(unit);
  checkVictory();
  render();
  if (!state.gameOver) startInitiativeClock();
  return true;
}

function advanceToNextTurn() {
  const endingUnit = currentUnit();
  if (endingUnit) {
    pickupFingersAtUnit(endingUnit);
    processFocusEndOfTurn(endingUnit);
    processEndOfTurnReactions(endingUnit);
    tickSupernovaDuration(endingUnit);
  }

  if (checkVictory()) {
    render();
    return;
  }

  state.currentUnitId = null;
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  state.inspectedTile = null;
  state.reachable.clear();
  state.attackable.clear();
  state.abilityTargets.clear();
  render();
  startInitiativeClock();
}

function calculateRanges() {
  const unit = currentUnit();
  state.reachable.clear();
  state.attackable.clear();
  state.abilityTargets.clear();
  if (!unit || unit.hp <= 0 || state.gameOver) return;

  if (!unit.moved) {
    const queue = [{ x: unit.x, y: unit.y, distance: 0 }];
    const visited = new Set([key(unit.x, unit.y, unit.z)]);
    while (queue.length) {
      const current = queue.shift();
      state.reachable.add(key(current.x, current.y, unit.z));
      if (current.distance >= unit.mobility) continue;

      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = current.x + dx;
        const y = current.y + dy;
        const tileKey = key(x, y, unit.z);
        if (x < 0 || x >= SIZE || y < 0 || y >= SIZE || visited.has(tileKey)) continue;
        if (!canOccupyTile(unit, x, y, unit.z)) continue;
        visited.add(tileKey);
        queue.push({ x, y, distance: current.distance + 1 });
      }
    }
  }

  if (!unit.acted) {
    for (const enemy of livingUnits().filter((target) => target.team !== unit.team && target.z === unit.z)) {
      const distance = distance2d(unit, enemy.x, enemy.y);
      if (distance > 0 && distance <= basicAttackRange(unit)) state.attackable.add(enemy.id);
    }
    for (const object of state.terrainObjects.filter((target) => target.z === unit.z)) {
      const distance = distance2d(unit, object.x, object.y);
      if (distance > 0 && distance <= basicAttackRange(unit)) state.attackable.add(object.id);
    }
  }

  const ability = selectedAbility();
  if (!ability || unit.acted || unit.ce < ability.ceCost || abilityCooldown(unit, ability.id) > 0 || (ability.id === "supernova" && activeSupernovaForUnit(unit))) return;
  if (ability.type === "self") {
    state.abilityTargets.add(key(unit.x, unit.y, unit.z));
    return;
  }

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (distance2d(unit, x, y) > ability.range) continue;
      const occupant = livingUnitAt(x, y, unit.z);
      const terrainObject = terrainObjectAt(x, y, unit.z);
      const validLine = ability.pattern !== "line" || unit.x === x || unit.y === y;
      if (ability.type === "attack" && ((occupant && occupant.team !== unit.team) || terrainObject) && validLine) {
        state.abilityTargets.add(key(x, y, unit.z));
      }
      if (ability.type === "areaAttack") {
        state.abilityTargets.add(key(x, y, unit.z));
      }
      if (ability.type !== "attack" && (!occupant || occupant.team === unit.team)) {
        state.abilityTargets.add(key(x, y, unit.z));
      }
    }
  }
}

function render() {
  settleUnitsOnHoles();
  renderBoardStack();
  renderTeamList();
  renderInitiative();
  renderPanel();
  renderTileInfo();
  renderLog();
}

function clearTransferPanel() {
  state.pendingTransfer = null;
  transferPanelEl.classList.add("hidden");
  transferAmountInput.value = "";
}

function renderTeamList() {
  teamListEl.innerHTML = "";
  for (const team of ["red", "blue"]) {
    const section = document.createElement("section");
    section.className = "team-list-section";
    const title = document.createElement("h3");
    title.textContent = `Equipo ${team === "red" ? "rojo" : "azul"}`;
    section.append(title);

    const teamUnits = state.units.filter((unit) => unit.team === team);
    if (!teamUnits.length) {
      const empty = document.createElement("p");
      empty.textContent = "Sin unidades.";
      section.append(empty);
    }

    for (const unit of teamUnits) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = [
        "team-unit-button",
        unit.hp <= 0 ? "defeated" : "",
        unit.id === state.currentUnitId ? "current" : "",
        unit.id === state.inspectedUnitId ? "inspected" : "",
      ].filter(Boolean).join(" ");
      button.addEventListener("click", () => inspectUnit(unit.id));

      const portrait = document.createElement("img");
      portrait.src = portraitUrl(unit);
      portrait.alt = "";
      portrait.draggable = false;

      const copy = document.createElement("span");
      const fingerInfo = hasYujiInBattle()
        ? ` - ${unit.sukunaFingers} dedos${isYuji(unit) ? ` - ${yujiFingerState(unit)?.consumed ?? 0} consumidos` : ""}${totalFingerContributions(unit) ? ` - ${totalFingerContributions(unit)} dados` : ""}`
        : "";
      const statusInfo = `${unit.stance ? ` - ${stanceLabel(unit)}` : ""}${unit.poisonStacks ? ` - Veneno ${unit.poisonStacks} (${unit.poisonTurnsRemaining})` : ""}`;
      copy.innerHTML = `<strong>${unit.name}</strong><small>${unit.hp}/${unit.maxHp} vida - ${unit.ce}/${unit.maxCe} CE${statusInfo}${fingerInfo}</small>`;

      button.append(portrait, copy);
      section.append(button);
    }
    teamListEl.append(section);
  }
}

function inspectUnit(unitId) {
  const unit = state.units.find((entry) => entry.id === unitId);
  if (!unit) return;
  state.inspectedUnitId = unit.id;
  state.inspectedTile = { x: unit.x, y: unit.y, z: unit.z };
  state.abilityMenuOpen = false;
  state.selectedAbilityId = null;
  render();
}

function renderBoardStack() {
  boardEl.innerHTML = "";
  applyBoardCamera();
  const unit = currentUnit();
  const turnLevel = unit?.z ?? 0;
  const previewLevel = state.previewLevel;
  for (let z = 0; z < LEVELS; z += 1) {
    const level = document.createElement("div");
    level.className = `level-board level-${z} ${z === turnLevel ? "turn-level" : ""} ${z === previewLevel ? "focus-level" : ""} ${z !== previewLevel ? "other-turn-level" : ""}`;
    level.style.setProperty("--level-index", z);
    level.style.zIndex = z === previewLevel ? "30" : z === turnLevel ? "20" : String(10 + z);
    level.append(renderLevelLabel(z));

    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        level.append(renderTile(x, y, z));
      }
    }
    boardEl.append(level);
  }
}

function renderLevelLabel(z) {
  const label = document.createElement("div");
  label.className = "level-label";
  label.textContent = `N${z + 1}`;
  return label;
}

function renderTile(x, y, z) {
  const unit = currentUnit();
  const tile = document.createElement("button");
  const tileKey = key(x, y, z);
  const occupant = unitAt(x, y, z);
  const terrainObject = terrainObjectAt(x, y, z);
  const hole = holeAt(x, y, z);
  const fingerPile = fingerPileAt(x, y, z);
  const supernova = supernovaAt(x, y, z);
  const ability = selectedAbility();
  tile.type = "button";
  tile.className = "tile";
  tile.setAttribute("aria-label", `Casilla ${x + 1}, ${y + 1}, nivel ${z + 1}`);

  if (stairAt(x, y, z)) tile.classList.add("stairs");
  if (hole) tile.classList.add("hole");
  if (terrainObject) tile.classList.add("terrain-tile");
  if (fingerPile) tile.classList.add("finger-tile");
  if (supernova) tile.classList.add("supernova-tile");
  if (state.reachable.has(tileKey)) tile.classList.add("move");
  if (state.abilityTargets.has(tileKey)) tile.classList.add(ability?.type === "attack" ? "skill-attack" : "skill-support");
  if ((occupant && state.attackable.has(occupant.id)) || (terrainObject && state.attackable.has(terrainObject.id))) tile.classList.add("attack");
  if (unit && unit.x === x && unit.y === y && unit.z === z) tile.classList.add("selected");

  if (terrainObject) {
    tile.append(renderTerrainObject(terrainObject));
    const hp = document.createElement("span");
    hp.className = "terrain-hp";
    hp.innerHTML = `<span style="width:${(terrainObject.hp / terrainObject.maxHp) * 100}%"></span>`;
    tile.append(hp);
  }

  if (occupant) {
    const otherFloorUnit = occupant.z !== state.previewLevel;
    const currentTurnUnit = unit && occupant.id === unit.id;
    tile.append(renderUnit(occupant, `${otherFloorUnit ? "other-floor-unit" : ""} ${currentTurnUnit ? "current-turn-unit" : ""}`));
    if (occupant.hp > 0) {
      const hp = document.createElement("span");
      hp.className = `hp ${otherFloorUnit ? "other-floor-unit" : ""}`;
      hp.innerHTML = `<span style="width:${(occupant.hp / occupant.maxHp) * 100}%"></span>`;
      tile.append(hp);
    }
  }

  if (fingerPile) {
    const finger = document.createElement("span");
    finger.className = "finger-token";
    finger.textContent = fingerPile.count > 1 ? String(fingerPile.count) : "";
    finger.title = `${fingerPile.count} dedo${fingerPile.count === 1 ? "" : "s"} de Sukuna`;
    tile.append(finger);
  }

  if (supernova) {
    const orb = document.createElement("span");
    orb.className = `supernova-orb ${supernova.team}-orb`;
    orb.textContent = supernova.remainingTurns;
    orb.title = `Supernova: ${supernova.remainingTurns} turno${supernova.remainingTurns === 1 ? "" : "s"}`;
    tile.append(orb);
  }

  tile.addEventListener("click", () => handleTileClick(x, y, z));
  return tile;
}

function renderUnit(unit, extraClass = "") {
  const el = document.createElement("span");
  const image = modelImageFor(unit);
  el.className = [
    "unit",
    unit.shape,
    unit.team ? `${unit.team}-unit` : "",
    image ? "image-model" : "",
    unit.hp <= 0 ? "dead-unit" : "",
    extraClass,
  ].filter(Boolean).join(" ");
  if (image) el.style.backgroundImage = `url("${image}")`;
  el.title = unit.name;
  return el;
}

function renderTerrainObject(object) {
  const el = document.createElement("span");
  el.className = `terrain-object ${object.type}`;
  el.title = `${object.name}: ${object.hp}/${object.maxHp}`;
  return el;
}

function portraitUrl(unit) {
  const image = modelImageFor(unit);
  if (image) return image;

  const color = unit.team === "blue" ? "#55a6d9" : "#df6b67";
  const shape = {
    circle: `<circle cx="32" cy="32" r="18" fill="${color}" />`,
    square: `<rect x="15" y="15" width="34" height="34" rx="7" fill="${color}" />`,
    triangle: `<path d="M32 12 52 50H12Z" fill="${color}" />`,
    diamond: `<rect x="17" y="17" width="30" height="30" rx="5" fill="${color}" transform="rotate(45 32 32)" />`,
  }[unit.shape];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="18" fill="#1d1f17" />
      <circle cx="32" cy="32" r="25" fill="rgba(240,239,229,0.08)" />
      ${shape}
      <path d="M18 48c7 5 21 5 28 0" fill="none" stroke="rgba(255,255,255,0.28)" stroke-width="3" stroke-linecap="round" />
    </svg>
  `;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function renderInitiative() {
  initiativeTrackEl.innerHTML = '<span class="finish-marker" aria-hidden="true"></span>';
  applyActionBarCamera();

  for (const unit of turnEligibleUnits()) {
    const token = document.createElement("div");
    token.className = `initiative-token ${unit.id === state.currentUnitId ? "current" : ""}`;
    const shownInitiative = unit.id === state.currentUnitId ? MAX_TURN : unit.initiative;
    const percent = Math.max(6, Math.min(94, shownInitiative));
    token.style.left = `${percent}%`;
    token.style.top = "50%";
    const portrait = document.createElement("img");
    portrait.className = "initiative-portrait";
    portrait.src = portraitUrl(unit);
    portrait.alt = "";
    portrait.draggable = false;

    token.title = unit.name;
    token.append(portrait);
    initiativeTrackEl.append(token);
  }
}

function renderPanel() {
  const unit = currentUnit();
  const displayUnit = inspectedUnit() ?? unit;
  roundTextEl.textContent = `Ronda ${state.round}`;

  if (!displayUnit) {
    phaseTextEl.textContent = state.gameOver ? "Batalla terminada" : "Calculando turno";
    unitCardEl.innerHTML = "";
    abilityMenuEl.classList.add("hidden");
    abilityMenuEl.innerHTML = "";
    return;
  }

  const abilities = getAbilities(displayUnit);
  phaseTextEl.textContent = unit
    ? `${unit.team === "blue" ? "Azul" : "Rojo"} juega con ${unit.name}.`
    : state.gameOver ? "Batalla terminada" : "Calculando turno";
  unitCardEl.innerHTML = `
    <h2>${displayUnit.name}</h2>
    <div class="stat-grid">
      <div class="stat"><strong>Equipo</strong>${displayUnit.team === "blue" ? "Azul" : "Rojo"}</div>
      <div class="stat"><strong>Nivel</strong>${displayUnit.z + 1}</div>
      <div class="stat"><strong>Vida</strong>${displayUnit.hp}/${displayUnit.maxHp}</div>
      <div class="stat"><strong>CE</strong>${displayUnit.ce}/${displayUnit.maxCe}</div>
      <div class="stat"><strong>Ataque</strong>${effectiveAttack(displayUnit)}</div>
      <div class="stat"><strong>Defensa</strong>${defenseLabel(displayUnit)}</div>
      <div class="stat"><strong>Movilidad</strong>${displayUnit.mobility}</div>
      <div class="stat"><strong>Velocidad</strong>${effectiveSpeed(displayUnit)}</div>
      ${displayUnit.stance ? `<div class="stat"><strong>Postura</strong>${stanceLabel(displayUnit)}</div>` : ""}
      ${displayUnit.poisonStacks ? `<div class="stat"><strong>Veneno</strong>${displayUnit.poisonStacks}/${POISON_MAX_STACKS} - ${displayUnit.poisonTurnsRemaining}t</div>` : ""}
      ${displayUnit.focus !== null ? `<div class="stat"><strong>Focus</strong>${displayUnit.focus}/5</div>` : ""}
      ${hasYujiInBattle() ? `<div class="stat"><strong>Dedos</strong>${displayUnit.sukunaFingers}</div>` : ""}
      ${hasYujiInBattle() ? `<div class="stat"><strong>Entregados</strong>${totalFingerContributions(displayUnit)}</div>` : ""}
      ${hasYujiInBattle() && isYuji(displayUnit) ? `<div class="stat"><strong>Consumidos</strong>${yujiFingerState(displayUnit)?.consumed ?? 0}</div>` : ""}
    </div>
    ${displayUnit.id !== unit?.id && unit ? `<div class="ability-line">Turno actual: ${unit.name}</div>` : ""}
    ${getPassive(displayUnit) ? `<div class="ability-line">Pasiva: ${getPassive(displayUnit).name}</div>` : ""}
    ${displayUnit.stance ? `<div class="ability-line">${displayUnit.stance === "blood" ? "Ataque basico a distancia, aplica Veneno." : "Ataque basico cuerpo a cuerpo mejorado, mas defensa."}</div>` : ""}
    <div class="ability-line">${abilities.length} habilidad${abilities.length === 1 ? "" : "es"} disponible${abilities.length === 1 ? "" : "s"}</div>
    <div class="ability-list">${abilities.map((ability) => `<div><strong>${ability.name}</strong><span>${abilityDescription(ability)}</span></div>`).join("")}</div>
  `;

  if (!unit) {
    attackBtn.disabled = true;
    skillBtn.disabled = true;
    specialBtn.disabled = true;
    specialBtn.classList.toggle("hidden", !hasYujiInBattle());
    stairsUpBtn.disabled = true;
    stairsDownBtn.disabled = true;
    endBtn.disabled = state.gameOver;
    clearTransferPanel();
    abilityMenuEl.classList.add("hidden");
    abilityMenuEl.innerHTML = "";
    return;
  }

  const unitDefeated = unit.hp <= 0;
  attackBtn.disabled = state.gameOver || unitDefeated || unit.acted || !state.attackable.size;
  attackBtn.classList.toggle("active", state.selectedAction === "attack");
  const turnAbilities = getAbilities(unit);
  const hasFreeSupernova = Boolean(activeSupernovaForUnit(unit));
  skillBtn.disabled = state.gameOver || unitDefeated || (unit.acted && !hasFreeSupernova) || !turnAbilities.length;
  skillBtn.classList.toggle("active", state.abilityMenuOpen);
  specialBtn.classList.toggle("hidden", !hasYujiInBattle());
  specialBtn.textContent = canTransferFingers(unit) ? "Dar dedos" : "Especial";
  specialBtn.disabled = state.gameOver || unitDefeated || !canTransferFingers(unit);
  stairsUpBtn.disabled = state.gameOver || unitDefeated || !canChangeLevel(unit, 1);
  stairsDownBtn.disabled = state.gameOver || unitDefeated || !canChangeLevel(unit, -1);
  endBtn.disabled = state.gameOver;
  renderAbilityMenu(unit, turnAbilities);
  renderTransferPanel(unit);
}

function renderTransferPanel(unit) {
  if (!state.pendingTransfer || state.pendingTransfer.unitId !== unit.id || !canTransferFingers(unit)) {
    transferPanelEl.classList.add("hidden");
    return;
  }

  const yuji = adjacentYujiForTransfer(unit);
  transferPanelEl.classList.remove("hidden");
  transferPanelEl.querySelector("label").textContent = `${unit.name} entrega dedos a ${yuji.name}`;
  transferAmountInput.max = String(unit.sukunaFingers);
  if (!transferAmountInput.value) transferAmountInput.value = String(unit.sukunaFingers);
}

function renderAbilityMenu(unit, abilities) {
  abilityMenuEl.innerHTML = "";
  abilityMenuEl.classList.toggle("hidden", !state.abilityMenuOpen);
  if (!state.abilityMenuOpen) return;

  for (const ability of abilities) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = state.selectedAbilityId === ability.id ? "active" : "";
    const cooldown = abilityCooldown(unit, ability.id);
    const activeSupernova = ability.id === "supernova" ? activeSupernovaForUnit(unit) : null;
    button.disabled = activeSupernova
      ? state.gameOver || unit.hp <= 0
      : state.gameOver || unit.acted || unit.ce < ability.ceCost || cooldown > 0;
    button.innerHTML = activeSupernova
      ? `<strong>Activar Supernova</strong><span>Gratis, ${activeSupernova.remainingTurns} turno${activeSupernova.remainingTurns === 1 ? "" : "s"}</span>`
      : `<strong>${ability.name}</strong><span>${cooldown > 0 ? `CD ${cooldown} turno${cooldown === 1 ? "" : "s"}` : abilityDescription(ability)}</span>`;
    button.addEventListener("click", () => {
      if (activeSupernova) {
        activateSupernova(unit);
        return;
      }
      if (ability.type === "self") {
        useSelfAbility(ability);
        return;
      }
    state.selectedAction = "skill";
    state.selectedAbilityId = ability.id;
    state.pendingTransfer = null;
    calculateRanges();
    render();
    });
    abilityMenuEl.append(button);
  }
}

function renderLog() {
  logEl.innerHTML = "";
  for (const entry of state.log) {
    const li = document.createElement("li");
    li.textContent = entry;
    logEl.append(li);
  }
}

function renderTileInfo() {
  tileInfoEl.innerHTML = "";
  tileInfoEl.classList.toggle("hidden", !state.inspectedTile);
  if (!state.inspectedTile) return;

  const { x, y, z } = state.inspectedTile;
  const occupant = unitAt(x, y, z);
  const terrainObject = terrainObjectAt(x, y, z);
  const stair = stairAt(x, y, z);
  const hole = holeAt(x, y, z);
  const fingerPile = fingerPileAt(x, y, z);
  const supernova = supernovaAt(x, y, z);
  const tileKind = stair ? "Escalera" : hole ? "Agujero" : "Suelo";
  const tileState = [
    state.reachable.has(key(x, y, z)) ? "Movimiento posible" : "",
    state.abilityTargets.has(key(x, y, z)) ? "Objetivo de habilidad" : "",
  ].filter(Boolean);

  const title = document.createElement("h3");
  title.textContent = `${tileKind} ${x + 1},${y + 1}, nivel ${z + 1}`;
  tileInfoEl.append(title);

  const meta = document.createElement("p");
  const tileDetails = [...tileState];
  if (fingerPile) tileDetails.push(`${fingerPile.count} dedo${fingerPile.count === 1 ? "" : "s"} de Sukuna`);
  if (hole) tileDetails.push("Bajada al nivel inferior");
  if (terrainObject) tileDetails.push(`${terrainObject.name}: ${terrainObject.hp}/${terrainObject.maxHp} vida`);
  if (supernova) {
    const owner = state.units.find((unit) => unit.id === supernova.ownerId);
    tileDetails.push(`Supernova de ${owner?.name ?? "Choso"} (${supernova.remainingTurns})`);
  }
  meta.textContent = tileDetails.length ? tileDetails.join(" - ") : "Sin marcador activo";
  tileInfoEl.append(meta);

  if (!occupant && !terrainObject) {
    const empty = document.createElement("p");
    empty.textContent = "No hay unidad en esta casilla.";
    tileInfoEl.append(empty);
    return;
  }

  if (terrainObject) {
    const objectStats = document.createElement("div");
    objectStats.className = "inspect-grid";
    objectStats.innerHTML = `
      <div><strong>Objeto</strong>${terrainObject.name}</div>
      <div><strong>Tipo</strong>${terrainObject.type === "pillar" ? "Pilar" : "Cubo"}</div>
      <div><strong>Vida</strong>${terrainObject.hp}/${terrainObject.maxHp}</div>
      <div><strong>Bloquea</strong>Movimiento</div>
    `;
    tileInfoEl.append(objectStats);
  }

  if (!occupant) return;

  const stats = document.createElement("div");
  stats.className = "inspect-grid";
  stats.innerHTML = `
    <div><strong>Unidad</strong>${occupant.name}</div>
    <div><strong>Equipo</strong>${occupant.team === "blue" ? "Azul" : "Rojo"}</div>
    <div><strong>Vida</strong>${occupant.hp}/${occupant.maxHp}</div>
    <div><strong>CE</strong>${occupant.ce}/${occupant.maxCe}</div>
    <div><strong>Ataque</strong>${effectiveAttack(occupant)}</div>
    <div><strong>Defensa</strong>${defenseLabel(occupant)}</div>
    <div><strong>Movilidad</strong>${occupant.mobility}</div>
    <div><strong>Velocidad</strong>${effectiveSpeed(occupant)}</div>
    ${occupant.stance ? `<div><strong>Postura</strong>${stanceLabel(occupant)}</div>` : ""}
    ${occupant.poisonStacks ? `<div><strong>Veneno</strong>${occupant.poisonStacks}/${POISON_MAX_STACKS} - ${occupant.poisonTurnsRemaining}t</div>` : ""}
    ${occupant.focus !== null ? `<div><strong>Focus</strong>${occupant.focus}/5</div>` : ""}
    ${hasYujiInBattle() ? `<div><strong>Dedos</strong>${occupant.sukunaFingers}</div>` : ""}
    ${hasYujiInBattle() ? `<div><strong>Entregados</strong>${totalFingerContributions(occupant)}</div>` : ""}
    ${hasYujiInBattle() && isYuji(occupant) ? `<div><strong>Consumidos</strong>${yujiFingerState(occupant)?.consumed ?? 0}</div>` : ""}
  `;
  tileInfoEl.append(stats);

  const abilities = document.createElement("p");
  abilities.innerHTML = `<strong>Habilidades</strong> ${getAbilities(occupant)
    .map((ability) => `${ability.name} (${ability.type === "attack" ? "ataque" : "apoyo"})`)
    .join(", ")}`;
  tileInfoEl.append(abilities);
}

function handleTileClick(x, y, z) {
  const unit = currentUnit();
  if (!unit || unit.hp <= 0 || state.gameOver) return;

  state.inspectedTile = { x, y, z };
  const occupant = unitAt(x, y, z);
  const terrainObject = terrainObjectAt(x, y, z);
  const tileKey = key(x, y, z);
  const ability = selectedAbility();

  if (occupant) state.inspectedUnitId = occupant.id;

  if (state.selectedAction === "attack" && occupant?.team === enemyTeam(unit.team)) {
    useOffense(occupant);
    return;
  }

  if (state.selectedAction === "attack" && terrainObject && state.attackable.has(terrainObject.id)) {
    useOffense(terrainObject);
    return;
  }

  if (state.selectedAction === "skill" && ability && state.abilityTargets.has(tileKey)) {
    if (ability.type === "attack" && occupant?.team === enemyTeam(unit.team)) {
      useOffense(occupant);
      return;
    }
    if (ability.type === "attack" && terrainObject) {
      useOffense(terrainObject);
      return;
    }
    if (ability.type === "areaAttack") {
      useAreaAttackAbility(x, y, z);
      return;
    }
    if (ability.type === "self" && occupant?.id === unit.id) {
      useSelfAbility(ability);
      return;
    }
    if (ability.type !== "attack") {
      useSupportAbility(x, y, z);
      return;
    }
  }

  if (!unit.moved && z === unit.z && state.reachable.has(tileKey) && canOccupyTile(unit, x, y, z)) {
    const from = { x: unit.x, y: unit.y, z: unit.z };
    unit.x = x;
    unit.y = y;
    settleUnitPosition(unit);
    unit.moved = true;
    queueVisualEvent("move", { unitId: unit.id, from, to: { x: unit.x, y: unit.y, z: unit.z } });
    addLog(`${unit.name} se mueve a ${unit.x + 1},${unit.y + 1} en nivel ${unit.z + 1}.`);
    calculateRanges();
    state.selectedAction = state.attackable.size ? "attack" : "move";
    state.selectedAbilityId = null;
    state.abilityMenuOpen = false;
    state.pendingTransfer = null;
    render();
    return;
  }

  render();
}

function changePreviewLevel(direction) {
  const nextLevel = Math.max(0, Math.min(LEVELS - 1, state.previewLevel + direction));
  if (nextLevel === state.previewLevel) return;
  state.previewLevel = nextLevel;
  render();
}

function expireTurnEffects(unit) {
  const effects = unit.activeEffects;
  if (effects.simpleDomain) addLog(`Dominio simple de ${unit.name} termina.`);
  if (effects.counterattack) addLog(`Contraataque de ${unit.name} termina.`);
  unit.activeEffects = {};
}

function processEndOfTurnReactions(endingUnit) {
  if (endingUnit.hp <= 0) return;

  for (const defender of livingUnits()) {
    if (defender.team === endingUnit.team || !defender.activeEffects.simpleDomain) continue;
    if (!isAdjacent8(defender, endingUnit)) continue;
    performAttack(defender, endingUnit, "Dominio simple", { triggersCounterattack: false });
    if (endingUnit.hp === 0) break;
  }
}

function recoverDedicationCe(unit) {
  if (unit.passiveId !== "dedication" || unit.ce >= unit.maxCe) return;
  const amount = Math.floor(Math.random() * 11) + 5;
  const before = unit.ce;
  unit.ce = Math.min(unit.maxCe, unit.ce + amount);
  addLog(`${unit.name} activa Dedicacion y recupera ${unit.ce - before} CE.`);
}

function gainFocusAfterAttack(unit) {
  const passive = getPassive(unit);
  if (passive?.id !== "focus") return;
  const before = unit.focus;
  unit.focus = Math.min(passive.maxFocus, unit.focus + 1);
  unit.attackedThisTurn = true;
  if (unit.focus !== before) addLog(`${unit.name} gana 1 Focus (${unit.focus}/${passive.maxFocus}).`);
}

function processFocusEndOfTurn(unit) {
  const passive = getPassive(unit);
  if (passive?.id !== "focus" || unit.attackedThisTurn || unit.focus <= 0) return;
  const before = unit.focus;
  unit.focus = Math.max(0, unit.focus - 2);
  addLog(`${unit.name} pierde ${before - unit.focus} Focus por no atacar.`);
}

function tickSupernovaDuration(unit) {
  const orb = activeSupernovaForUnit(unit);
  if (!orb || orb.createdTurnCount === state.turnCount) return;

  orb.remainingTurns -= 1;
  if (orb.remainingTurns > 0) return;

  state.supernovas = state.supernovas.filter((entry) => entry.id !== orb.id);
  setAbilityCooldown(unit, data.abilities.supernova);
  addLog(`Supernova de ${unit.name} desaparece.`);
}

function transformYujiIntoSukuna(yuji) {
  const fingerState = yujiFingerState(yuji);
  if (!fingerState || fingerState.transformed) return;
  fingerState.transformed = true;
  yuji.defeated = false;
  yuji.hp = Math.max(1, Math.ceil(yuji.maxHp * 0.4));
  yuji.activeEffects.sukuna = true;
  addLog(`${yuji.name} se transforma en Sukuna.`);

  const targets = livingUnits().filter((unit) => unit.id !== yuji.id && unit.z === yuji.z);
  for (const target of targets) {
    const contribution = contributionCountForYuji(target, yuji);
    const reduction = Math.min(1, contribution * SUKUNA_FINGER_DAMAGE_REDUCTION);
    const rawDamage = Math.max(1, Math.floor(effectiveAttack(yuji) * SUKUNA_TRANSFORM_ATTACK_MULTIPLIER - effectiveDefense(target)));
    const damage = Math.max(0, Math.floor(rawDamage * (1 - reduction)));
    const wasAlive = target.hp > 0;
    target.hp = Math.max(0, target.hp - damage);
    queueVisualEvent("hit", {
      attackerId: yuji.id,
      targetId: target.id,
      label: "Transformacion de Sukuna",
      damage,
      sukunaTransformation: true,
    });
    addLog(`Sukuna golpea a ${target.name}: ${damage} dano${contribution ? ` (${contribution} dedos entregados)` : ""}.`);
    if (wasAlive && target.hp === 0) handleUnitDefeated(target);
  }
}

function performAttack(attacker, target, label, options = {}) {
  const attackMultiplier = options.attackMultiplier ?? 1;
  const triggersCounterattack = options.triggersCounterattack ?? true;
  const canBlackFlash = options.canBlackFlash ?? false;
  const blackFlash = canBlackFlash && getPassive(attacker)?.id === "focus" && Math.random() < focusChance(attacker);
  const damageMultiplier = blackFlash ? getPassive(attacker).blackFlashDamageMultiplier : 1;
  const targetDefenseMultiplier = options.targetDefenseMultiplier ?? 1;
  const targetDefense = isTerrainObject(target) ? 0 : Math.floor(effectiveDefense(target) * targetDefenseMultiplier);
  const damage = Math.max(
    1,
    Math.floor((effectiveAttack(attacker) * attackMultiplier - targetDefense) * damageMultiplier * poisonDamageMultiplier(attacker, target)),
  );

  const wasAlive = target.hp > 0;
  target.hp = Math.max(0, target.hp - damage);
  queueVisualEvent("hit", {
    attackerId: attacker.id,
    targetId: target.id,
    label,
    damage,
    blackFlash,
  });
  addLog(`${attacker.name} usa ${blackFlash ? "Black Flash" : label} contra ${target.name}: ${damage} dano.`);
  if (wasAlive && target.hp === 0) {
    if (isTerrainObject(target)) handleTerrainDestroyed(target);
    else handleUnitDefeated(target);
    return damage;
  }

  if (options.appliesPoison && !isTerrainObject(target)) applyPoison(target);

  if (triggersCounterattack && !isTerrainObject(target)) tryCounterattack(target, attacker);
  return damage;
}

function handleUnitDefeated(unit) {
  if (unit.defeated) return;
  unit.defeated = true;
  unit.activeEffects = {};
  state.supernovas = state.supernovas.filter((orb) => orb.ownerId !== unit.id);
  dropFingersFromUnit(unit);
  addLog(`${unit.name} queda fuera.`);
}

function handleTerrainDestroyed(object) {
  state.terrainObjects = state.terrainObjects.filter((entry) => entry.id !== object.id);
  addLog(`${object.name} se rompe.`);
  if (object.type === "pillar") {
    const holeZ = object.z + 1;
    addHole(object.x, object.y, holeZ);
    const unitAbove = unitAt(object.x, object.y, holeZ);
    if (unitAbove) settleUnitPosition(unitAbove);
  }
}

function tryCounterattack(defender, attacker) {
  if (!defender.activeEffects.counterattack || defender.hp <= 0 || attacker.hp <= 0) return;
  performAttack(defender, attacker, "Contraataque", { triggersCounterattack: false });
  recoverDedicationCe(defender);
}

function useOffense(target) {
  const unit = currentUnit();
  const targetKey = key(target.x, target.y, target.z);
  if (!unit || unit.hp <= 0 || unit.acted || (!state.attackable.has(target.id) && !state.abilityTargets.has(targetKey))) return;

  let label = "ataque normal";
  let attackMultiplier = chosoBasicAttackMultiplier(unit, target);
  let canBlackFlash = true;
  let targetDefenseMultiplier = 1;
  let appliesPoison = isChoso(unit) && unit.stance === "blood" && !isTerrainObject(target);
  let triggersCounterattack = !(isChoso(unit) && unit.stance === "blood" && distance2d(unit, target.x, target.y) > 1);

  if (isChoso(unit)) {
    label = unit.stance === "combat" ? "sangre endurecida" : "proyectil de sangre";
    canBlackFlash = false;
  }

  if (state.selectedAction === "skill") {
    const ability = getAbility(unit, state.selectedAbilityId);
    if (!ability || !isAbilityAvailableInStance(unit, ability) || unit.ce < ability.ceCost || abilityCooldown(unit, ability.id) > 0) return;
    if (ability.pattern === "line") {
      useLineAttackAbility(unit, target, ability);
      return;
    }
    unit.ce -= ability.ceCost;
    setAbilityCooldown(unit, ability);
    attackMultiplier = ability.attackMultiplier;
    label = ability.name;
    canBlackFlash = false;
    targetDefenseMultiplier = ability.defenseMultiplier ?? 1;
    appliesPoison = Boolean(ability.appliesPoison);
    triggersCounterattack = false;
  }

  performAttack(unit, target, label, { attackMultiplier, canBlackFlash, targetDefenseMultiplier, appliesPoison, triggersCounterattack });
  gainFocusAfterAttack(unit);
  unit.acted = true;
  unit.moved = true;
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;

  if (checkVictory()) {
    render();
    return;
  }

  calculateRanges();
  render();
}

function lineTargetsFor(unit, target, ability) {
  const dx = Math.sign(target.x - unit.x);
  const dy = Math.sign(target.y - unit.y);
  if (dx && dy) return [];
  if (!dx && !dy) return [];

  const targets = [];
  for (let step = 1; step <= ability.range; step += 1) {
    const x = unit.x + dx * step;
    const y = unit.y + dy * step;
    if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) break;
    const occupant = livingUnitAt(x, y, unit.z);
    const terrainObject = terrainObjectAt(x, y, unit.z);
    if (occupant && occupant.team !== unit.team) targets.push(occupant);
    if (terrainObject) targets.push(terrainObject);
  }
  return targets;
}

function useLineAttackAbility(unit, target, ability) {
  const targets = lineTargetsFor(unit, target, ability);
  if (!targets.length) return;

  unit.ce -= ability.ceCost;
  setAbilityCooldown(unit, ability);
  for (const lineTarget of targets) {
    performAttack(unit, lineTarget, ability.name, {
      attackMultiplier: ability.attackMultiplier,
      targetDefenseMultiplier: ability.defenseMultiplier ?? 1,
      appliesPoison: ability.appliesPoison,
      triggersCounterattack: false,
      canBlackFlash: false,
    });
  }
  unit.acted = true;
  unit.moved = true;
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;

  if (checkVictory()) {
    render();
    return;
  }

  calculateRanges();
  render();
}

function useAreaAttackAbility(x, y, z) {
  const unit = currentUnit();
  const ability = selectedAbility();
  if (!unit || unit.hp <= 0 || !ability || ability.type !== "areaAttack" || unit.acted || unit.ce < ability.ceCost || abilityCooldown(unit, ability.id) > 0) return;

  if (ability.id === "supernova") {
    placeSupernova(unit, ability, x, y, z);
    return;
  }

  const targets = [
    ...livingUnits().filter((target) =>
      target.team !== unit.team
      && target.z === z
      && Math.max(Math.abs(target.x - x), Math.abs(target.y - y)) <= ability.radius,
    ),
    ...state.terrainObjects.filter((target) =>
      target.z === z
      && Math.max(Math.abs(target.x - x), Math.abs(target.y - y)) <= ability.radius,
    ),
  ];
  if (!targets.length) return;

  unit.ce -= ability.ceCost;
  setAbilityCooldown(unit, ability);
  for (const target of targets) {
    performAttack(unit, target, ability.name, {
      attackMultiplier: ability.attackMultiplier,
      appliesPoison: ability.appliesPoison,
      triggersCounterattack: false,
      canBlackFlash: false,
    });
  }
  unit.acted = true;
  unit.moved = true;
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;

  if (checkVictory()) {
    render();
    return;
  }

  calculateRanges();
  render();
}

function placeSupernova(unit, ability, x, y, z) {
  if (activeSupernovaForUnit(unit)) return;
  unit.ce -= ability.ceCost;
  state.supernovas.push({
    id: `supernova-${unit.id}-${Date.now()}-${state.supernovas.length}`,
    ownerId: unit.id,
    team: unit.team,
    x,
    y,
    z,
    remainingTurns: SUPERNOVA_DURATION_TURNS,
    createdTurnCount: state.turnCount,
  });
  unit.acted = true;
  unit.moved = true;
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  addLog(`${unit.name} coloca Supernova en ${x + 1},${y + 1}, nivel ${z + 1}.`);
  calculateRanges();
  render();
}

function detonateSupernova(unit, orb, ability, reason = "activa") {
  const targets = [
    ...livingUnits().filter((target) =>
      target.team !== unit.team
      && target.z === orb.z
      && Math.max(Math.abs(target.x - orb.x), Math.abs(target.y - orb.y)) <= ability.radius,
    ),
    ...state.terrainObjects.filter((target) =>
      target.z === orb.z
      && Math.max(Math.abs(target.x - orb.x), Math.abs(target.y - orb.y)) <= ability.radius,
    ),
  ];

  state.supernovas = state.supernovas.filter((entry) => entry.id !== orb.id);
  setAbilityCooldown(unit, ability);
  addLog(`${unit.name} ${reason} Supernova.`);
  for (const target of targets) {
    performAttack(unit, target, ability.name, {
      attackMultiplier: ability.attackMultiplier,
      appliesPoison: ability.appliesPoison,
      triggersCounterattack: false,
      canBlackFlash: false,
    });
  }
}

function activateSupernova(unit) {
  const orb = activeSupernovaForUnit(unit);
  const ability = data.abilities.supernova;
  if (!unit || unit.hp <= 0 || !orb || !ability) return;

  detonateSupernova(unit, orb, ability);
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;

  if (checkVictory()) {
    render();
    return;
  }

  calculateRanges();
  render();
}

function useSelfAbility(ability) {
  const unit = currentUnit();
  if (!unit || unit.hp <= 0 || !ability || !isAbilityAvailableInStance(unit, ability) || unit.acted || unit.ce < ability.ceCost || abilityCooldown(unit, ability.id) > 0) return;

  unit.ce -= ability.ceCost;
  setAbilityCooldown(unit, ability);
  if (ability.effect === "simpleDomain") {
    unit.activeEffects.simpleDomain = true;
  }
  if (ability.effect === "counterattack") {
    unit.activeEffects.counterattack = true;
    unit.activeEffects.defenseMultiplier = ability.defenseMultiplier;
  }
  if (ability.effect === "switchChosoStance") {
    unit.stance = unit.stance === "blood" ? "combat" : "blood";
  }

  unit.acted = true;
  unit.moved = true;
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  addLog(`${unit.name} usa ${ability.name}${unit.stance ? `: ${stanceLabel(unit)}` : ""}.`);
  recoverDedicationCe(unit);
  calculateRanges();
  render();
}

function useSupportAbility(x, y, z) {
  const unit = currentUnit();
  const ability = selectedAbility();
  if (!unit || unit.hp <= 0 || !ability || unit.acted || unit.ce < ability.ceCost || abilityCooldown(unit, ability.id) > 0) return;

  unit.ce -= ability.ceCost;
  setAbilityCooldown(unit, ability);
  unit.acted = true;
  unit.moved = true;
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  addLog(`${unit.name} usa ${ability.name} en ${x + 1},${y + 1}, nivel ${z + 1}.`);
  calculateRanges();
  render();
}

function transferFingersToYuji(unit, yuji, count) {
  const amount = Math.max(0, Math.min(unit.sukunaFingers, Math.floor(count)));
  if (!amount) return;
  unit.sukunaFingers -= amount;
  consumeFingersForYuji(yuji, amount, unit);
  addLog(`${unit.name} entrega ${amount} dedo${amount === 1 ? "" : "s"} a ${yuji.name}.`);
  render();
}

function useSpecialAction() {
  const unit = currentUnit();
  const yuji = adjacentYujiForTransfer(unit);
  if (!unit || !yuji) return;
  state.pendingTransfer = { unitId: unit.id, yujiId: yuji.id };
  state.abilityMenuOpen = false;
  render();
  transferAmountInput.focus();
  transferAmountInput.select();
}

function confirmTransfer() {
  const unit = currentUnit();
  if (!unit || state.pendingTransfer?.unitId !== unit.id) return;
  const yuji = adjacentYujiForTransfer(unit);
  if (!yuji || yuji.id !== state.pendingTransfer.yujiId) {
    clearTransferPanel();
    render();
    return;
  }
  const amount = Number.parseInt(transferAmountInput.value, 10);
  if (Number.isNaN(amount)) return;
  transferFingersToYuji(unit, yuji, amount);
  clearTransferPanel();
  render();
}

function changeLevel(direction) {
  const unit = currentUnit();
  if (!unit || unit.hp <= 0 || state.gameOver) return;
  const target = levelChangeTarget(unit, direction);
  if (!target) return;

  const from = { x: unit.x, y: unit.y, z: unit.z };
  unit.x = target.x;
  unit.y = target.y;
  unit.z = target.z;
  settleUnitPosition(unit);
  unit.moved = true;
  state.previewLevel = unit.z;
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  queueVisualEvent("move", { unitId: unit.id, from, to: { x: unit.x, y: unit.y, z: unit.z } });
  addLog(`${unit.name} ${direction < 0 ? "baja" : "sube"} al nivel ${unit.z + 1}.`);
  calculateRanges();
  render();
}

function checkVictory() {
  const teams = new Set(
    state.units
      .filter((unit) => unit.hp > 0 || canDeadYujiTransform(unit))
      .map((unit) => unit.team),
  );
  if (teams.size === 1) {
    const winner = [...teams][0];
    stopInitiativeClock();
    state.gameOver = true;
    state.currentUnitId = null;
    addLog(`Victoria del equipo ${winner === "blue" ? "Azul" : "Rojo"}.`);
    return true;
  }
  return false;
}

attackBtn.addEventListener("click", () => {
  state.selectedAction = state.selectedAction === "attack" ? "move" : "attack";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  calculateRanges();
  render();
});

skillBtn.addEventListener("click", () => {
  state.abilityMenuOpen = !state.abilityMenuOpen;
  state.pendingTransfer = null;
  if (!state.abilityMenuOpen && state.selectedAction === "skill") {
    state.selectedAction = "move";
    state.selectedAbilityId = null;
  }
  if (!state.abilityMenuOpen) calculateRanges();
  render();
});

stairsUpBtn.addEventListener("click", () => changeLevel(1));
stairsDownBtn.addEventListener("click", () => changeLevel(-1));
specialBtn.addEventListener("click", useSpecialAction);
confirmTransferBtn.addEventListener("click", confirmTransfer);
cancelTransferBtn.addEventListener("click", () => {
  clearTransferPanel();
  render();
});
endBtn.addEventListener("click", advanceToNextTurn);
restartBtn.addEventListener("click", initBattle);
boardShellEl.addEventListener("mousedown", startBoardPan);
initiativeTrackEl.addEventListener("mousedown", startActionBarPan);
window.addEventListener("wheel", zoomBoard, { passive: false });
window.addEventListener("mousemove", moveBoardPan);
window.addEventListener("mousemove", moveActionBarPan);
window.addEventListener("mouseup", stopBoardPan);
window.addEventListener("mouseup", stopActionBarPan);
window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowUp") {
    event.preventDefault();
    changePreviewLevel(1);
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    changePreviewLevel(-1);
  }
});

renderSetupScreen();
