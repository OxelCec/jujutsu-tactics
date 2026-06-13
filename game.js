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
const BLEEDING_DAMAGE = 5;
const BLEEDING_DURATION_TURNS = 3;
const TOJI_WEAPON_LOCK_TURNS = 3;
const MAHITO_IDLE_CE_DRAIN = 10;
const MAHITO_TRANSFORM_CE = 150;
const MAHITO_TRANSFORM_TURN_CE_LOSS = 10;
const MAHITO_DEPLETED_STAT_MULTIPLIER = 0.5;
const SUMMON_BASIC_CE_LOSS = 10;
const SUMMON_DISMISS_COOLDOWN_TURNS = 2;
const MEGUMI_MAHORAGA_TURN_REQUIREMENT = 6;
const MEGUMI_MAHORAGA_HP_RATIO = 0.2;
const MEGUMI_MAHORAGA_REQUIRED_MAX_CE = 150;
const MEGUMI_MAHORAGA_REQUIRED_CE = 100;
const MEGUMI_MAHORAGA_DAMAGE_MEMORY_TURNS = 3;
const MEGUMI_MAHORAGA_RITUAL_RANGE = 3;
const MAHORAGA_MAX_ADAPTATION_STACKS = 6;
const MAHORAGA_MAX_DEFENSE_PIERCE_STACKS = 8;
const MAHORAGA_DEFENSE_PIERCE_PER_STACK = 0.05;
const TOJI_WEAPON_ATTACK_MULTIPLIERS = {
  invertedSpear: 0.85,
  splitSoulKatana: 1.25,
  chainWeapon: 1.08,
};
const MEGUMI_SUMMON_TEMPLATES = {
  divineDogWhite: {
    name: "Divine Dog White",
    shape: "triangle",
    maxHp: 46,
    attack: 9,
    defense: 3,
    speed: 1,
    mobility: 3,
    maxCe: 30,
    reservedCe: 30,
    abilityIds: [],
    damageType: "slashing",
    summonAbilityId: "summonDivineDogs",
    summonKind: "divineDog",
  },
  divineDogBlack: {
    name: "Divine Dog Black",
    shape: "triangle",
    maxHp: 46,
    attack: 9,
    defense: 3,
    speed: 1,
    mobility: 3,
    maxCe: 30,
    reservedCe: 30,
    abilityIds: [],
    damageType: "slashing",
    summonAbilityId: "summonDivineDogs",
    summonKind: "divineDog",
  },
  nue: {
    name: "Nue",
    shape: "diamond",
    maxHp: 46,
    attack: 16,
    defense: 3,
    speed: 1,
    mobility: 3,
    maxCe: 20,
    reservedCe: 20,
    abilityIds: ["nueLightningStrike"],
    damageType: "strike",
    statuses: ["flying"],
    summonAbilityId: "summonNue",
    summonKind: "nue",
  },
  maxElephant: {
    name: "Max Elephant",
    shape: "square",
    maxHp: 88,
    attack: 19,
    defense: 7,
    speed: 1,
    mobility: 1,
    maxCe: 40,
    reservedCe: 40,
    abilityIds: [],
    damageType: "strike",
    summonAbilityId: "summonMaxElephant",
    summonKind: "maxElephant",
  },
};
const MAHORAGA_TEMPLATE = {
  name: "Mahoraga",
  shape: "triangle",
  maxHp: 120,
  attack: 28,
  defense: 14,
  speed: 16,
  mobility: 3,
  maxCe: 0,
  abilityIds: ["worldCuttingSlash"],
  damageType: "slashing",
};
const BOARD_MIN_ZOOM = 0.55;
const BOARD_MAX_ZOOM = 1.85;
let initiativeFrameId = null;
let lastInitiativeAt = 0;

const state = {
  units: [],
  currentUnitId: null,
  turnControllerId: null,
  previewLevel: 0,
  selectedAction: "move",
  selectedAbilityId: null,
  abilityMenuOpen: false,
  awaitingSharedActor: false,
  pendingSummon: null,
  pendingTransfer: null,
  pendingSwap: null,
  inspectedTile: null,
  inspectedUnitId: null,
  reachable: new Set(),
  attackable: new Set(),
  abilityTargets: new Set(),
  sharedActorTargets: new Set(),
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
  wikiSection: "characters",
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
const logOverlayEl = document.querySelector("#logOverlay");
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
    weapon: character.defaultWeapon ?? null,
    weaponLocks: {},
    poisonStacks: 0,
    poisonTurnsRemaining: 0,
    bleedingStacks: 0,
    bleedingTurnsRemaining: 0,
    idleTransfigurationTurns: 0,
    mahitoBlackFlashes: 0,
    mahitoUltimateUsed: false,
    mahitoBaseStats: null,
    megumiTurnsTaken: 0,
    megumiDamageMemory: [],
    mustActPersonally: false,
    deadSummons: [],
    sukunaFingers: 0,
    attackedThisTurn: false,
    abilityCooldowns: {},
    activeEffects: {},
    statuses: [...(character.statuses ?? [])],
    isSummon: false,
    summonerId: null,
    summonKind: null,
    summonAbilityId: null,
    reservedCe: 0,
    sharedTurnActed: false,
    isMahoraga: false,
    allowedTargetIds: [],
    adaptations: {},
    defensePierceStacks: 0,
    removed: false,
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
  state.turnControllerId = null;
  state.previewLevel = 0;
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.awaitingSharedActor = false;
  state.pendingSummon = null;
  state.pendingTransfer = null;
  state.pendingSwap = null;
  state.inspectedTile = null;
  state.inspectedUnitId = null;
  state.reachable.clear();
  state.attackable.clear();
  state.abilityTargets.clear();
  state.sharedActorTargets.clear();
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
  state.log = ["The battle begins."];
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
  roundTextEl.textContent = "Preparation";

  if (setup.step === "start") {
    phaseTextEl.textContent = "Ready to prepare battle";
    setupEyebrowEl.textContent = "Main Menu";
    setupTitleEl.textContent = "Jujutsu Tactics";
    setupTextEl.textContent = "Choose where to go.";

    const menu = document.createElement("div");
    menu.className = "main-menu";
    menu.append(setupButton("Start Game", () => {
      setup.step = "blue";
      setup.selectedTeam = "blue";
      renderSetupScreen();
    }, "primary"));
    menu.append(setupButton("Wiki", () => {
      setup.step = "wiki";
      setup.wikiSection = "characters";
      renderSetupScreen();
    }));
    setupContentEl.append(menu);
    return;
  }

  if (setup.step === "wiki") {
    renderWikiSetup();
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

function renderWikiSetup() {
  const sections = [
    { id: "characters", label: "Characters" },
    { id: "maps", label: "Maps" },
    { id: "misc", label: "Misc" },
  ];
  const active = sections.find((section) => section.id === setup.wikiSection) ?? sections[0];
  phaseTextEl.textContent = "Wiki";
  setupEyebrowEl.textContent = "Wiki";
  setupTitleEl.textContent = "Jujutsu Tactics Wiki";
  setupTextEl.textContent = "Reference material will be added later.";

  const wiki = document.createElement("div");
  wiki.className = "wiki-layout";

  const tree = document.createElement("nav");
  tree.className = "wiki-tree";
  for (const section of sections) {
    const button = setupButton(section.label, () => {
      setup.wikiSection = section.id;
      renderSetupScreen();
    });
    button.className = `wiki-node ${section.id === active.id ? "active" : ""}`;
    tree.append(button);
  }

  const content = document.createElement("section");
  content.className = "wiki-content";
  content.innerHTML = `
    <h3>${active.label}</h3>
    <p>Wiki content for ${active.label.toLowerCase()} will be added later.</p>
  `;

  wiki.append(tree, content);
  setupContentEl.append(wiki);
  setupActionsEl.append(setupButton("Back", () => {
    setup.step = "start";
    renderSetupScreen();
  }));
}

function renderTeamSetup(team) {
  const isBlue = team === "blue";
  const used = teamCost(team);
  const remaining = TEAM_BUDGET - used;
  phaseTextEl.textContent = `${isBlue ? "Blue" : "Red"} team selection`;
  setupEyebrowEl.textContent = isBlue ? "Blue Team" : "Red Team";
  setupTitleEl.textContent = `Choose Units (${used}/${TEAM_BUDGET})`;
  setupTextEl.textContent = `Choose any combination that does not exceed ${TEAM_BUDGET} points.`;

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
    cost.textContent = `${character.cost} points`;

    card.append(preview, name, cost);
    roster.append(card);
  }
  setupContentEl.append(roster);

  const backStep = isBlue ? "start" : "blue";
  setupActionsEl.append(setupButton("Back", () => {
    setup.step = backStep;
    setup.selectedTeam = backStep === "blue" ? "blue" : setup.selectedTeam;
    renderSetupScreen();
  }));

  const next = setupButton(isBlue ? "Red Team" : "Choose Map", () => {
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
  phaseTextEl.textContent = "Map selection";
  setupEyebrowEl.textContent = "Map";
  setupTitleEl.textContent = "Choose Stage";
  setupTextEl.textContent = "Only one map is available for now.";

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
    mapButton.innerHTML = `<strong>${map.name}</strong><span>${map.size}x${map.size} - ${map.levels} floors</span>`;
    mapGrid.append(mapButton);
  }
  setupContentEl.append(mapGrid, renderSelectionSummary());

  setupActionsEl.append(setupButton("Back", () => {
    setup.step = "red";
    setup.selectedTeam = "red";
    renderSetupScreen();
  }));
  setupActionsEl.append(setupButton("Start Battle", initBattle, "primary"));
}

function renderSelectionSummary() {
  const summary = document.createElement("div");
  summary.className = "selection-summary";
  for (const team of ["blue", "red"]) {
    const block = document.createElement("div");
    block.className = "summary-team";
    const title = document.createElement("strong");
    title.textContent = `${team === "blue" ? "Blue" : "Red"}: ${teamCost(team)}/${TEAM_BUDGET}`;
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
  return state.units.filter((unit) => !unit.removed && unit.hp > 0);
}

function turnEligibleUnits() {
  return state.units.filter((unit) => !unit.removed && ((unit.hp > 0 && (!unit.isSummon || unit.isMahoraga)) || canDeadYujiTransform(unit)));
}

function currentUnit() {
  return state.units.find((unit) => unit.id === state.currentUnitId);
}

function turnController() {
  return state.units.find((unit) => unit.id === state.turnControllerId) ?? currentUnit();
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
  return state.units.find((unit) => !unit.removed && unit.x === x && unit.y === y && unit.z === z);
}

function livingUnitAt(x, y, z) {
  return livingUnits().find((unit) => !unit.removed && unit.x === x && unit.y === y && unit.z === z);
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
  return hasStatus(unit, "flying");
}

function isAdjacent4To(x, y, targetX, targetY) {
  return Math.abs(x - targetX) + Math.abs(y - targetY) === 1;
}

function facingFromDelta(dx, dy, fallback = "south") {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "east" : "west";
  if (dy) return dy > 0 ? "south" : "north";
  return fallback;
}

function directionVector(facing) {
  return {
    north: { dx: 0, dy: -1 },
    south: { dx: 0, dy: 1 },
    east: { dx: 1, dy: 0 },
    west: { dx: -1, dy: 0 },
  }[facing] ?? { dx: 0, dy: 1 };
}

function canOccupyTile(unit, x, y, z) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE || z < 0 || z >= LEVELS) return false;
  const occupant = unitAt(x, y, z);
  if (occupant && occupant.id !== unit.id) return false;
  if (solidTerrainAt(x, y, z)) return false;
  if (holeAt(x, y, z) && !isFlying(unit)) return false;
  return true;
}

function setFacingToward(unit, x, y) {
  unit.facing = facingFromDelta(x - unit.x, y - unit.y, unit.facing);
}

function addHole(x, y, z) {
  if (z <= 0 || z >= LEVELS || holeAt(x, y, z)) return;
  state.holes.push({ id: `hole-${Date.now()}-${state.holes.length}`, x, y, z });
  addLog(`A hole opens at ${x + 1},${y + 1}, floor ${z + 1}.`);
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
    addLog(`${unit.name} falls through the hole to floor ${unit.z + 1}.`);
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

function clearFingerPiles() {
  state.fingers = [];
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
  addLog(`${yuji.name} consumes ${count} Sukuna Finger${count === 1 ? "" : "s"} (${fingerState.consumed}).`);
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
  addLog(`${unit.name} picks up ${count} Sukuna Finger${count === 1 ? "" : "s"}.`);
}

function dropFingersFromUnit(unit) {
  if (unit.sukunaFingers <= 0) return;
  addFingerPile(unit.x, unit.y, unit.z, unit.sukunaFingers);
  addLog(`${unit.name} drops ${unit.sukunaFingers} Sukuna Finger${unit.sukunaFingers === 1 ? "" : "s"}.`);
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
    .filter((ability) => ability && (isAbilityAvailableForUnit(unit, ability) || (ability.id === "supernova" && activeSupernovaForUnit(unit))));
}

function getPassive(unit) {
  return unit.passiveId ? data.passives?.[unit.passiveId] : null;
}

function isAbilityAvailableInStance(unit, ability) {
  return !ability.requiredStance || unit.stance === ability.requiredStance;
}

function isToji(unit) {
  return unit?.characterId === "toji";
}

function weaponName(weaponId) {
  return {
    invertedSpear: "Inverted Spear of Heaven",
    splitSoulKatana: "Split Soul Katana",
    chainWeapon: "Chain Weapon",
  }[weaponId] ?? weaponId;
}

function ceLabel(unit) {
  return unit.maxCe ? `${unit.ce}/${unit.maxCe}` : "No CE";
}

function weaponLock(unit, weaponId) {
  return unit?.weaponLocks?.[weaponId] ?? 0;
}

function isAbilityAvailableForUnit(unit, ability) {
  if (!isAbilityAvailableInStance(unit, ability)) return false;
  if (ability.requiredWeapon && unit.weapon !== ability.requiredWeapon) return false;
  if (ability.type?.startsWith("summon") && !isMegumi(unit)) return false;
  if (ability.type?.startsWith("summon") && unit.maxCe < ability.ceCost) return false;
  if (ability.id === "summonDivineDogs" && (hasActiveSummonKind(unit, "divineDog") || hasDeadSummonKind(unit, "divineDog"))) return false;
  if (ability.id === "summonNue" && (hasActiveSummonKind(unit, "nue") || hasDeadSummonKind(unit, "nue"))) return false;
  if (ability.id === "summonMaxElephant" && (hasActiveSummonKind(unit, "maxElephant") || hasDeadSummonKind(unit, "maxElephant"))) return false;
  if (ability.type === "summonMahoraga" && !canSummonMahoraga(unit)) return false;
  if (ability.type === "worldCuttingSlash" && !mahoragaCanUseWorldSlash(unit)) return false;
  if (ability.requiredMahitoTransformed === true && !isMahitoTransformed(unit)) return false;
  if (ability.requiredMahitoTransformed === false && isMahitoTransformed(unit)) return false;
  if (ability.mahitoUltimate) {
    if (!mahitoUltimateUnlocked(unit) || unit.mahitoUltimateUsed) return false;
    if (ability.hpRequirement === "above70" && mahitoHpRatio(unit) <= 0.7) return false;
    if (ability.hpRequirement === "below70" && mahitoHpRatio(unit) > 0.7) return false;
  }
  return true;
}

function tojiWeaponAttackMultiplier(unit) {
  if (!isToji(unit)) return 1;
  return TOJI_WEAPON_ATTACK_MULTIPLIERS[unit.weapon] ?? 1;
}

function isChoso(unit) {
  return unit?.characterId === "choso";
}

function stanceLabel(unit) {
  if (unit.stance === "blood") return "Blood Mode";
  if (unit.stance === "combat") return "Combat Mode";
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

function isMahito(unit) {
  return unit?.characterId === "mahito";
}

function isMegumi(unit) {
  return unit?.characterId === "megumi" && !unit.isSummon;
}

function isMegumiSummon(unit) {
  return Boolean(unit?.isSummon && unit.summonerId && !unit.isMahoraga);
}

function summonerFor(unit) {
  return unit?.summonerId ? state.units.find((entry) => entry.id === unit.summonerId) : null;
}

function activeSummonsFor(megumi) {
  if (!megumi) return [];
  return state.units.filter((unit) => !unit.removed && unit.isSummon && !unit.isMahoraga && unit.summonerId === megumi.id && unit.hp > 0);
}

function hasActiveSummonKind(megumi, summonKind) {
  return activeSummonsFor(megumi).some((unit) => unit.summonKind === summonKind);
}

function hasDeadSummonKind(megumi, summonKind) {
  return Boolean(megumi?.deadSummons?.includes(summonKind));
}

function recentMegumiDamagers(megumi) {
  const minTurn = Math.max(0, (megumi?.megumiTurnsTaken ?? 0) - MEGUMI_MAHORAGA_DAMAGE_MEMORY_TURNS);
  return (megumi?.megumiDamageMemory ?? [])
    .filter((entry) => entry.megumiTurn >= minTurn)
    .map((entry) => state.units.find((unit) => unit.id === entry.attackerId))
    .filter((unit) => unit && unit.hp > 0);
}

function mahoragaRitualTargets(megumi) {
  return recentMegumiDamagers(megumi).filter((enemy) =>
    enemy.team !== megumi.team
    && enemy.z === megumi.z
    && distance2d(megumi, enemy.x, enemy.y) <= MEGUMI_MAHORAGA_RITUAL_RANGE,
  );
}

function canSummonMahoraga(megumi) {
  return Boolean(
    isMegumi(megumi)
    && megumi.hp > 0
    && !megumi.moved
    && !megumi.acted
    && megumi.megumiTurnsTaken >= MEGUMI_MAHORAGA_TURN_REQUIREMENT
    && megumi.hp / megumi.maxHp < MEGUMI_MAHORAGA_HP_RATIO
    && megumi.maxCe >= MEGUMI_MAHORAGA_REQUIRED_MAX_CE
    && megumi.ce >= MEGUMI_MAHORAGA_REQUIRED_CE
    && mahoragaRitualTargets(megumi).length > 0
  );
}

function isMegumiSharedTurn(unit = currentUnit()) {
  const controller = turnController();
  return Boolean(controller && isMegumi(controller) && (unit?.id === controller.id || unit?.summonerId === controller.id));
}

function controlledUnitsForMegumi(megumi) {
  return [megumi, ...activeSummonsFor(megumi)].filter(Boolean);
}

function sharedTurnActors(megumi) {
  return [megumi, ...state.units.filter((unit) => unit.summonerId === megumi.id)]
    .filter((unit) => unit && (unit.acted || unit.moved || unit.sharedTurnActed));
}

function canActWithSharedUnit(target) {
  const megumi = turnController();
  if (!isMegumi(megumi) || !target || target.hp <= 0) return false;
  if (target.id !== megumi.id && target.summonerId !== megumi.id) return false;
  if (megumi.mustActPersonally) return target.id === megumi.id;

  const actors = sharedTurnActors(megumi);
  if (!actors.length) return true;
  if (actors.every((unit) => unit.summonKind === "divineDog")) {
    return target.summonKind === "divineDog" && !target.acted && !target.moved;
  }
  return actors.some((unit) => unit.id === target.id);
}

function canDismissSummonNow(megumi) {
  return isMegumi(megumi) && !sharedTurnActors(megumi).length;
}

function sharedActorSelectionOptions(megumi) {
  if (!isMegumi(megumi)) return [];
  return controlledUnitsForMegumi(megumi)
    .filter((unit) => unit.hp > 0 && !unit.acted && !unit.moved && canActWithSharedUnit(unit));
}

function beginSharedActorSelection(megumi) {
  const options = sharedActorSelectionOptions(megumi);
  const needsChoice = options.length > 1 || (options.length === 1 && options[0].id !== state.currentUnitId);
  state.awaitingSharedActor = needsChoice;
  state.sharedActorTargets.clear();
  if (!needsChoice) return false;

  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingSummon = null;
  state.pendingTransfer = null;
  state.pendingSwap = null;
  for (const unit of options) state.sharedActorTargets.add(key(unit.x, unit.y, unit.z));
  return true;
}

function switchSharedActor(targetId) {
  const target = state.units.find((unit) => unit.id === targetId && !unit.removed);
  if (!canActWithSharedUnit(target)) return;
  state.awaitingSharedActor = false;
  state.sharedActorTargets.clear();
  state.currentUnitId = target.id;
  state.previewLevel = target.z;
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  state.pendingSwap = null;
  state.pendingSummon = null;
  calculateRanges();
  render();
}

function isMahitoTransformed(unit) {
  return Boolean(isMahito(unit) && unit.activeEffects.mahitoTransformed);
}

function mahitoUltimateUnlocked(unit) {
  const passive = getPassive(unit);
  return passive?.id === "blackFlashPotential" && unit.mahitoBlackFlashes >= passive.ultimateThreshold;
}

function mahitoHpRatio(unit) {
  return unit.maxHp ? unit.hp / unit.maxHp : 0;
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

function blackFlashChance(attacker, target) {
  const passive = getPassive(attacker);
  if (passive?.id === "focus") return focusChance(attacker);
  if (passive?.id !== "blackFlashPotential" || isMahitoTransformed(attacker) || isTerrainObject(target)) return 0;
  const missingHpRatio = target.maxHp ? (target.maxHp - target.hp) / target.maxHp : 0;
  return passive.baseChance + passive.missingHpChance * missingHpRatio;
}

function blackFlashDamageMultiplier(attacker) {
  const passive = getPassive(attacker);
  if (passive?.id === "focus") return passive.blackFlashDamageMultiplier;
  if (passive?.id === "blackFlashPotential") return passive.damageMultiplier;
  return 1;
}

function resolveBlackFlashAfterAttack(attacker, blackFlash) {
  const passive = getPassive(attacker);
  if (!blackFlash || passive?.id !== "blackFlashPotential") return;
  attacker.mahitoBlackFlashes += 1;
  const before = attacker.ce;
  attacker.ce = Math.min(attacker.maxCe, attacker.ce + passive.ceRestore);
  addLog(`${attacker.name} triggers Black Flash (${attacker.mahitoBlackFlashes}/${passive.ultimateThreshold}) and restores ${attacker.ce - before} CE.`);
  if (attacker.mahitoBlackFlashes === passive.ultimateThreshold) addLog(`${attacker.name} unlocks their Ultimate.`);
}

function distance2d(a, x, y) {
  return Math.abs(a.x - x) + Math.abs(a.y - y);
}

function isAdjacent8(a, b) {
  return a.z === b.z && Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1;
}

function ceStatScale(unit) {
  if (unit.isSummon) return 1;
  if (!unit.maxCe) return 1;
  const ceRatio = Math.max(0, Math.min(1, unit.ce / unit.maxCe));
  return MIN_CE_STAT_SCALE + (1 - MIN_CE_STAT_SCALE) * ceRatio;
}

function divineDogPackActive(unit) {
  if (unit?.summonKind !== "divineDog" || unit.hp <= 0) return false;
  return state.units.some((other) =>
    other.id !== unit.id
    && other.summonerId === unit.summonerId
    && other.summonKind === "divineDog"
    && other.hp > 0
    && other.z === unit.z
    && distance2d(unit, other.x, other.y) <= 2,
  );
}

function effectiveAttack(unit) {
  const packMultiplier = divineDogPackActive(unit) ? 1.25 : 1;
  return Math.max(1, Math.floor(unit.attack * ceStatScale(unit) * tojiWeaponAttackMultiplier(unit) * packMultiplier));
}

function effectiveSpeed(unit) {
  return Math.max(1, Math.floor(unit.speed * ceStatScale(unit)));
}

function effectiveDefense(unit, options = {}) {
  const multiplier = options.ignoreActiveEffects ? 1 : unit.activeEffects.defenseMultiplier ?? 1;
  const packMultiplier = divineDogPackActive(unit) ? 1.25 : 1;
  return Math.max(1, Math.floor(unit.defense * ceStatScale(unit) * multiplier * stanceDefenseMultiplier(unit) * packMultiplier));
}

function defenseLabel(unit) {
  if (isChoso(unit)) return String(effectiveDefense(unit));
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
  for (const [weaponId, remaining] of Object.entries(unit.weaponLocks ?? {})) {
    const next = Math.max(0, remaining - 1);
    if (next) unit.weaponLocks[weaponId] = next;
    else delete unit.weaponLocks[weaponId];
  }
}

function setAbilityCooldown(unit, ability) {
  if (!ability.cooldownTurns) return;
  unit.abilityCooldowns[ability.id] = ability.cooldownTurns + 1;
}

function regenerateTurnCe(unit) {
  if (isMahitoTransformed(unit)) return;
  if (unit.hp <= 0 || unit.ce >= unit.maxCe) return;
  const amount = Math.max(1, Math.ceil(unit.maxCe * TURN_CE_REGEN_RATE));
  const before = unit.ce;
  unit.ce = Math.min(unit.maxCe, unit.ce + amount);
  if (unit.ce !== before) addLog(`${unit.name} restores ${unit.ce - before} CE.`);
}

function applyPoison(target, amount = 1) {
  if (target.hp <= 0) return;
  const before = target.poisonStacks ?? 0;
  target.poisonStacks = Math.min(POISON_MAX_STACKS, before + amount);
  target.poisonTurnsRemaining = POISON_DURATION_TURNS;
  if (target.poisonStacks !== before) {
    addLog(`${target.name} receives Poison (${target.poisonStacks}/${POISON_MAX_STACKS}).`);
    return;
  }
  addLog(`${target.name}'s Poison is refreshed (${target.poisonTurnsRemaining} turns).`);
}

function applyBleeding(target, options = {}) {
  if (target.hp <= 0) return;
  target.bleedingStacks = options.stacking ? Math.max(1, (target.bleedingStacks ?? 0) + 1) : 1;
  target.bleedingTurnsRemaining = BLEEDING_DURATION_TURNS;
  addLog(`${target.name} receives Bleeding ${target.bleedingStacks > 1 ? `(${target.bleedingStacks} stacks, ` : "("}${BLEEDING_DURATION_TURNS} turns).`);
}

function poisonDamageMultiplier(attacker, target) {
  const passive = getPassive(attacker);
  if (passive?.id !== "poisonedBlood") return 1;
  return 1 + (target.poisonStacks ?? 0) * passive.damagePerPoisonStack;
}

function adaptationStackKey(damageType) {
  return damageType || "strike";
}

function adaptedDamage(target, damage, damageType) {
  if (!target?.isMahoraga || !damageType) return damage;
  const stackKey = adaptationStackKey(damageType);
  const stacks = target.adaptations[stackKey] ?? 0;
  const reduced = Math.max(0, Math.floor(damage - damage * stacks * 0.1));
  target.adaptations[stackKey] = Math.min(MAHORAGA_MAX_ADAPTATION_STACKS, stacks + 1);
  addLog(`${target.name} adapts to ${stackKey} (${target.adaptations[stackKey]}/${MAHORAGA_MAX_ADAPTATION_STACKS}).`);
  return reduced;
}

function totalAdaptationStacks(unit) {
  return Object.values(unit?.adaptations ?? {}).reduce((total, value) => total + value, 0);
}

function mahoragaCanUseWorldSlash(unit) {
  return Boolean(unit?.isMahoraga && totalAdaptationStacks(unit) >= 8);
}

function canMahoragaTarget(attacker, target) {
  return !attacker?.isMahoraga || attacker.allowedTargetIds.includes(target.id);
}

function recordMegumiDamage(target, attacker) {
  if (!isMegumi(target) || !attacker || attacker.team === target.team) return;
  target.megumiDamageMemory.push({
    attackerId: attacker.id,
    megumiTurn: target.megumiTurnsTaken,
  });
  target.megumiDamageMemory = target.megumiDamageMemory.slice(-12);
}

function processIdleTransfigurationStartOfTurn(unit) {
  if (unit.hp <= 0 || !unit.idleTransfigurationTurns) return;
  const before = unit.ce;
  unit.ce = Math.max(0, unit.ce - MAHITO_IDLE_CE_DRAIN);
  unit.idleTransfigurationTurns = Math.max(0, unit.idleTransfigurationTurns - 1);
  addLog(`${unit.name} loses ${before - unit.ce} CE from Idle Transfiguration.`);
}

function endMahitoTransformation(unit) {
  if (!isMahitoTransformed(unit)) return;
  const base = unit.mahitoBaseStats;
  unit.activeEffects.mahitoTransformed = false;
  unit.activeEffects.mahitoDepleted = true;
  unit.maxCe = base?.maxCe ?? 100;
  unit.ce = 0;
  unit.attack = Math.max(1, Math.floor((base?.attack ?? unit.attack) * MAHITO_DEPLETED_STAT_MULTIPLIER));
  unit.defense = Math.max(1, Math.floor((base?.defense ?? unit.defense) * MAHITO_DEPLETED_STAT_MULTIPLIER));
  unit.speed = Math.max(1, Math.floor((base?.speed ?? unit.speed) * MAHITO_DEPLETED_STAT_MULTIPLIER));
  addLog(`${unit.name} loses the transformation and is weakened.`);
}

function processMahitoTransformationStartOfTurn(unit) {
  if (!isMahitoTransformed(unit) || unit.hp <= 0) return;
  unit.ce = Math.max(0, unit.ce - MAHITO_TRANSFORM_TURN_CE_LOSS);
  addLog(`${unit.name} spends ${MAHITO_TRANSFORM_TURN_CE_LOSS} CE to maintain their form.`);
  if (unit.ce <= 0) endMahitoTransformation(unit);
}

function processBleedingStartOfTurn(unit) {
  if (unit.hp <= 0 || !unit.bleedingTurnsRemaining) return false;
  const damage = BLEEDING_DAMAGE * Math.max(1, unit.bleedingStacks ?? 1);
  unit.hp = Math.max(0, unit.hp - damage);
  unit.bleedingTurnsRemaining = Math.max(0, unit.bleedingTurnsRemaining - 1);
  if (!unit.bleedingTurnsRemaining) unit.bleedingStacks = 0;
  addLog(`${unit.name} takes ${damage} damage from Bleeding.`);
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

function processPoisonStartOfTurn(unit) {
  if (unit.hp <= 0 || !unit.poisonStacks) return false;
  const damage = unit.poisonStacks * POISON_DAMAGE_PER_STACK;
  unit.hp = Math.max(0, unit.hp - damage);
  addLog(`${unit.name} takes ${damage} damage from Poison.`);
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
  addLog(`${unit.name}'s Poison wears off.`);
}

function selectedAbility() {
  const unit = currentUnit();
  if (!unit || !state.selectedAbilityId) return null;
  const ability = getAbility(unit, state.selectedAbilityId);
  return ability && isAbilityAvailableForUnit(unit, ability) ? ability : null;
}

function abilityDescription(ability) {
  const cooldown = ability.cooldownTurns ? `, CD ${ability.cooldownTurns}` : "";
  if (ability.type === "weaponSwitch") return `${ability.description}${cooldown}`;
  if (ability.type === "teleport") return `Teleport ${ability.range} tiles${cooldown}`;
  if (ability.type === "distortedMove") return `Move ${ability.range} tiles, ${ability.ceCost} CE${cooldown}`;
  if (ability.type === "soulTouch") return `Drains ${ability.ceDrain} CE; executes below ${ability.executionThreshold}/${ability.markedExecutionThreshold} CE, ${ability.ceCost} CE`;
  if (ability.type === "idleTransfiguration") return `Marks for ${ability.markTurns} turns, range ${ability.range}, ${ability.ceCost} CE${cooldown}`;
  if (ability.type === "mahitoDomain") return `Domain radius ${ability.radius}, ${ability.ceCost} CE, once per match`;
  if (ability.type === "mahitoTransform") return "Final transformation, spends current CE and gains 150 CE, once per match";
  if (ability.type === "predatorDash") return `Straight dash ${ability.range} tiles, applies Bleeding${cooldown}`;
  if (ability.type === "blindSpotStrike") return `Teleports beside the target and attacks, range ${ability.range}${cooldown}`;
  if (ability.type === "sweepAttack") return `${ability.description}${cooldown}`;
  if (ability.type === "boogieSwap" || ability.type === "forcedSwap") return `${ability.description}, range ${ability.range}, ${ability.ceCost} CE${cooldown}`;
  if (ability.id === "supernova") return `Places an orb for ${SUPERNOVA_DURATION_TURNS} turns; free activation, ${ability.ceCost} CE${cooldown}`;
  if (ability.type === "unitAreaAttack") return `Target enemy within ${ability.range} tiles; hits units adjacent to the target, ${ability.ceCost} CE${cooldown}`;
  if (ability.description) return `${ability.description}, ${ability.ceCost} CE${cooldown}`;
  if (ability.type === "self") return `Self, ${ability.ceCost} CE${cooldown}`;
  if (ability.type === "areaAttack") return `Area ${ability.radius}, x${ability.attackMultiplier}, ${ability.ceCost} CE${cooldown}`;
  if (ability.type === "attack") return `Attack x${ability.attackMultiplier}, ${ability.ceCost} CE${cooldown}`;
  return `Support/utility, ${ability.ceCost} CE${cooldown}`;
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
  phaseTextEl.textContent = "Action bar advances";
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
  if (processBleedingStartOfTurn(next)) return;
  clearExpiredPoison(next);
  regenerateTurnCe(next);
  processIdleTransfigurationStartOfTurn(next);
  processMahitoTransformationStartOfTurn(next);
  tickAbilityCooldowns(next);
  next.initiative = 0;
  next.acted = false;
  next.moved = false;
  next.attackedThisTurn = false;
  state.currentUnitId = next.id;
  state.turnControllerId = next.id;
  if (isMegumi(next)) {
    next.megumiTurnsTaken += 1;
    next.mustActPersonally = false;
    for (const summon of activeSummonsFor(next)) {
      summon.acted = false;
      summon.moved = false;
      summon.sharedTurnActed = false;
    }
    beginSharedActorSelection(next);
  }
  state.previewLevel = next.z;
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  state.pendingSwap = null;
  state.pendingSummon = null;
  state.inspectedTile = null;
  state.turnCount += 1;
  state.round = Math.floor((state.turnCount - 1) / Math.max(1, turnEligibleUnits().length)) + 1;
  calculateRanges();
  addLog(`${next.name}'s turn (${next.team === "blue" ? "Blue" : "Red"}).`);
  render();
}

function handleDeadYujiTurn(unit) {
  if (!canDeadYujiTransform(unit)) return false;
  const fingerState = yujiFingerState(unit);
  unit.initiative = 0;
  fingerState.deadTurnsReady += 1;

  if (fingerState.deadTurnsReady < 2) {
    addLog(`${unit.name} lies on the ground. Sukuna has not awakened yet.`);
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
  state.turnControllerId = null;
  state.awaitingSharedActor = false;
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingSummon = null;
  state.pendingTransfer = null;
  state.pendingSwap = null;
  state.inspectedTile = null;
  state.reachable.clear();
  state.attackable.clear();
  state.abilityTargets.clear();
  state.sharedActorTargets.clear();
  render();
  startInitiativeClock();
}

function calculateRanges() {
  const unit = currentUnit();
  state.reachable.clear();
  state.attackable.clear();
  state.abilityTargets.clear();
  state.sharedActorTargets.clear();
  if (!unit || unit.hp <= 0 || state.gameOver) return;

  if (state.awaitingSharedActor) {
    const megumi = turnController();
    for (const actor of sharedActorSelectionOptions(megumi)) {
      state.sharedActorTargets.add(key(actor.x, actor.y, actor.z));
    }
    return;
  }

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
      if (!canMahoragaTarget(unit, enemy)) continue;
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
  if (ability.type === "self" || ability.type === "mahitoDomain" || ability.type === "mahitoTransform" || ability.type === "summonMahoraga") {
    state.abilityTargets.add(key(unit.x, unit.y, unit.z));
    return;
  }

  if (ability.type === "summonUnit" || ability.type === "summonPair") {
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (distance2d(unit, x, y) > ability.range) continue;
        if (!canPlaceSummonAt(x, y, unit.z)) continue;
        if (state.pendingSummon?.positions?.some((position) => position.x === x && position.y === y && position.z === unit.z)) continue;
        state.abilityTargets.add(key(x, y, unit.z));
      }
    }
    return;
  }

  if (ability.type === "summonDrop") {
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (distance2d(unit, x, y) > ability.range) continue;
        if (solidTerrainAt(x, y, unit.z) || holeAt(x, y, unit.z)) continue;
        if (!validAdjacentSummonTiles(unit, x, y, unit.z).length) continue;
        state.abilityTargets.add(key(x, y, unit.z));
      }
    }
    return;
  }

  if (ability.type === "distortedMove") {
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        if (distance2d(unit, x, y) > ability.range) continue;
        if (!canOccupyTile(unit, x, y, unit.z)) continue;
        state.abilityTargets.add(key(x, y, unit.z));
      }
    }
    return;
  }

  if (ability.type === "teleport") {
    const minZ = Math.max(0, unit.z - (ability.floorDelta ?? 0));
    const maxZ = Math.min(LEVELS - 1, unit.z + (ability.floorDelta ?? 0));
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let y = 0; y < SIZE; y += 1) {
        for (let x = 0; x < SIZE; x += 1) {
          if (Math.abs(x - unit.x) + Math.abs(y - unit.y) > ability.range) continue;
          if (!canOccupyTile(unit, x, y, z)) continue;
          state.abilityTargets.add(key(x, y, z));
        }
      }
    }
    return;
  }

  if (ability.type === "boogieSwap" || ability.type === "forcedSwap") {
    for (const target of livingUnits()) {
      if (target.id === unit.id || target.z !== unit.z || distance2d(unit, target.x, target.y) > ability.range) continue;
      if (ability.type === "forcedSwap" && target.id === state.pendingSwap?.firstTargetId) continue;
      state.abilityTargets.add(key(target.x, target.y, target.z));
    }
    return;
  }

  if (ability.type === "soulTouch" || ability.type === "idleTransfiguration" || ability.type === "blindSpotStrike") {
    for (const target of livingUnits().filter((entry) => entry.team !== unit.team && entry.z === unit.z)) {
      if (distance2d(unit, target.x, target.y) > ability.range) continue;
      if (ability.type === "blindSpotStrike" && !validBlindSpotTiles(target, unit).length) continue;
      state.abilityTargets.add(key(target.x, target.y, target.z));
    }
    return;
  }

  if (ability.type === "unitAreaAttack") {
    for (const target of livingUnits().filter((entry) => entry.id !== unit.id && entry.team !== unit.team && entry.z === unit.z)) {
      if (distance2d(unit, target.x, target.y) > ability.range) continue;
      state.abilityTargets.add(key(target.x, target.y, target.z));
    }
    return;
  }

  if (ability.type === "predatorDash") {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let step = 1; step <= ability.range; step += 1) {
        const x = unit.x + dx * step;
        const y = unit.y + dy * step;
        if (x < 0 || x >= SIZE || y < 0 || y >= SIZE) break;
        if (!canOccupyTile(unit, x, y, unit.z)) continue;
        state.abilityTargets.add(key(x, y, unit.z));
      }
    }
    return;
  }

  if (ability.type === "worldCuttingSlash") {
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) state.abilityTargets.add(key(x, y, unit.z));
    }
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
    title.textContent = `${team === "red" ? "Red" : "Blue"} Team`;
    section.append(title);

    const teamUnits = state.units.filter((unit) => unit.team === team && !unit.removed);
    if (!teamUnits.length) {
      const empty = document.createElement("p");
      empty.textContent = "No units.";
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
      copy.innerHTML = `<strong>${unit.name}</strong>`;

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
  label.textContent = `F${z + 1}`;
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
  tile.setAttribute("aria-label", `Tile ${x + 1}, ${y + 1}, floor ${z + 1}`);

  if (stairAt(x, y, z)) tile.classList.add("stairs");
  if (hole) tile.classList.add("hole");
  if (terrainObject) tile.classList.add("terrain-tile");
  if (fingerPile) tile.classList.add("finger-tile");
  if (supernova) tile.classList.add("supernova-tile");
  if (state.reachable.has(tileKey)) tile.classList.add("move");
  if (state.abilityTargets.has(tileKey)) tile.classList.add(ability?.type === "attack" ? "skill-attack" : "skill-support");
  if (state.sharedActorTargets.has(tileKey)) tile.classList.add("shared-actor-target");
  if ((occupant && state.attackable.has(occupant.id)) || (terrainObject && state.attackable.has(terrainObject.id))) tile.classList.add("attack");
  if (unit && unit.x === x && unit.y === y && unit.z === z) tile.classList.add("selected");

  if (terrainObject) {
    tile.append(renderTerrainObject(terrainObject));
  }

  if (occupant) {
    const otherFloorUnit = occupant.z !== state.previewLevel;
    const currentTurnUnit = unit && occupant.id === unit.id;
    const sharedActorUnit = state.sharedActorTargets.has(tileKey);
    tile.append(renderUnit(occupant, `${otherFloorUnit ? "other-floor-unit" : ""} ${currentTurnUnit ? "current-turn-unit" : ""} ${sharedActorUnit ? "shared-actor-unit" : ""}`));
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
    finger.title = `${fingerPile.count} Sukuna Finger${fingerPile.count === 1 ? "" : "s"}`;
    tile.append(finger);
  }

  if (supernova) {
    const orb = document.createElement("span");
    orb.className = `supernova-orb ${supernova.team}-orb`;
    orb.textContent = supernova.remainingTurns;
    orb.title = `Supernova: ${supernova.remainingTurns} turn${supernova.remainingTurns === 1 ? "" : "s"}`;
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

function percent(value, max) {
  if (!max) return 100;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function resourceBar(label, value, max, className) {
  const text = max > 0 ? `${value}/${max}` : "No CE";
  return `
    <div class="resource-bar ${className}">
      <span style="width:${percent(value, max)}%"></span>
      <strong>${label}</strong>
      <em>${text}</em>
    </div>
  `;
}

function specialRows(displayUnit, activeUnit) {
  const rows = [];
  const passive = getPassive(displayUnit);
  const locks = Object.entries(displayUnit.weaponLocks ?? {})
    .filter(([, turns]) => turns > 0)
    .map(([weaponId, turns]) => `${weaponName(weaponId)} ${turns}T`);

  if (displayUnit.id !== activeUnit?.id && activeUnit) rows.push(["Turn", activeUnit.name]);
  if (passive) rows.push(["Passive", passive.name]);
  if (displayUnit.stance) rows.push(["Stance", stanceLabel(displayUnit)]);
  if (displayUnit.weapon) rows.push(["Weapon", weaponName(displayUnit.weapon)]);
  if (locks.length) rows.push(["Locks", locks.join(", ")]);
  if (displayUnit.poisonStacks) rows.push(["Poison", `${displayUnit.poisonStacks}/${POISON_MAX_STACKS} - ${displayUnit.poisonTurnsRemaining}T`]);
  if (displayUnit.bleedingTurnsRemaining) rows.push(["Bleeding", `${displayUnit.bleedingStacks || 1} - ${displayUnit.bleedingTurnsRemaining}T`]);
  if (displayUnit.idleTransfigurationTurns) rows.push(["Mark", `${displayUnit.idleTransfigurationTurns}T`]);
  if (displayUnit.focus !== null) rows.push(["Focus", `${displayUnit.focus}/5`]);
  if (isMahito(displayUnit)) rows.push(["Black Flash", `${displayUnit.mahitoBlackFlashes}/2`]);
  if (isMahitoTransformed(displayUnit)) rows.push(["Form", "Transformed"]);
  if (hasYujiInBattle()) {
    rows.push(["Fingers", displayUnit.sukunaFingers]);
    rows.push(["Given", totalFingerContributions(displayUnit)]);
    if (isYuji(displayUnit)) rows.push(["Consumed", yujiFingerState(displayUnit)?.consumed ?? 0]);
  }

  return rows;
}

function renderPanel() {
  const unit = currentUnit();
  const displayUnit = inspectedUnit() ?? unit;
  roundTextEl.textContent = `Round ${state.round}`;

  if (!displayUnit) {
    phaseTextEl.textContent = state.gameOver ? "Battle finished" : "Calculating turn";
    unitCardEl.innerHTML = "";
    abilityMenuEl.classList.add("hidden");
    abilityMenuEl.innerHTML = "";
    return;
  }

  phaseTextEl.textContent = state.awaitingSharedActor
    ? `${turnController().team === "blue" ? "Blue" : "Red"} chooses who acts.`
    : unit
    ? `${unit.team === "blue" ? "Blue" : "Red"} acts with ${unit.name}.`
    : state.gameOver ? "Battle finished" : "Calculating turn";
  const abilities = getAbilities(displayUnit);
  const specialItems = specialRows(displayUnit, unit);
  const teamName = displayUnit.team === "blue" ? "Blue" : "Red";
  unitCardEl.innerHTML = `
    <div class="unit-card-header">
      <div>
        <h2>${displayUnit.name}</h2>
        <p>${teamName} - Floor ${displayUnit.z + 1}${displayUnit.hp <= 0 ? " - Defeated" : ""}</p>
      </div>
      <img class="unit-card-model" src="${portraitUrl(displayUnit)}" alt="" draggable="false" />
    </div>
    <div class="resource-stack">
      <div class="resource-row">
        ${resourceBar("HP", displayUnit.hp, displayUnit.maxHp, "hp-resource")}
        <div class="mov-pill">MOV ${displayUnit.mobility}</div>
      </div>
      <div class="resource-row">
        ${resourceBar("CE", displayUnit.ce, displayUnit.maxCe, "ce-resource")}
      </div>
    </div>
    <div class="stat-grid">
      <div class="stat"><strong>ATK</strong><span>${effectiveAttack(displayUnit)}</span></div>
      <div class="stat"><strong>DEF</strong><span>${defenseLabel(displayUnit)}</span></div>
      <div class="stat"><strong>SPD</strong><span>${effectiveSpeed(displayUnit)}</span></div>
    </div>
    ${specialItems.length ? `<div class="special-grid">${specialItems.map(([label, value]) => `<div><strong>${label}</strong><span>${value}</span></div>`).join("")}</div>` : ""}
    <div class="technique-summary">${abilities.length} available technique${abilities.length === 1 ? "" : "s"}</div>
    <div class="ability-list">${abilities.map((ability) => `<div><strong>${ability.name}</strong></div>`).join("")}</div>
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
  attackBtn.disabled = state.gameOver || state.awaitingSharedActor || unitDefeated || unit.acted || !state.attackable.size;
  attackBtn.classList.toggle("active", state.selectedAction === "attack");
  const turnAbilities = getAbilities(unit);
  const hasFreeSupernova = Boolean(activeSupernovaForUnit(unit));
  const hasFreeWeaponSwitch = turnAbilities.some((ability) => ability.type === "weaponSwitch" && unit.weapon !== ability.weaponId && weaponLock(unit, ability.weaponId) === 0);
  const megumi = isMegumiSharedTurn(unit) ? turnController() : null;
  const hasSharedControls = Boolean(megumi && activeSummonsFor(megumi).some(() => canDismissSummonNow(megumi)));
  skillBtn.disabled = state.gameOver || state.awaitingSharedActor || unitDefeated || (unit.acted && !hasFreeSupernova && !hasFreeWeaponSwitch && !hasSharedControls) || (!turnAbilities.length && !hasSharedControls);
  skillBtn.classList.toggle("active", state.abilityMenuOpen);
  specialBtn.classList.toggle("hidden", !hasYujiInBattle());
  specialBtn.textContent = canTransferFingers(unit) ? "Give Fingers" : "Special";
  specialBtn.disabled = state.gameOver || state.awaitingSharedActor || unitDefeated || !canTransferFingers(unit);
  stairsUpBtn.disabled = state.gameOver || state.awaitingSharedActor || unitDefeated || !canChangeLevel(unit, 1);
  stairsDownBtn.disabled = state.gameOver || state.awaitingSharedActor || unitDefeated || !canChangeLevel(unit, -1);
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
  transferPanelEl.querySelector("label").textContent = `${unit.name} gives fingers to ${yuji.name}`;
  transferAmountInput.max = String(unit.sukunaFingers);
  if (!transferAmountInput.value) transferAmountInput.value = String(unit.sukunaFingers);
}

function abilityCostLine(ability, cooldown, lockedWeaponTurns, activeSupernova) {
  if (activeSupernova) return `CE 0 - CD 0 - Free ${activeSupernova.remainingTurns}T`;
  const parts = [`CE ${ability.ceCost ?? 0}`, `CD ${ability.cooldownTurns ?? 0}`];
  if (lockedWeaponTurns > 0) parts.push(`Locked ${lockedWeaponTurns}T`);
  else if (cooldown > 0) parts.push(`Ready ${cooldown}T`);
  return parts.join(" - ");
}

function bindAbilityDescriptionReveal(button) {
  let holdTimer = null;
  let longPressTriggered = false;
  const showDescription = () => {
    longPressTriggered = true;
    button.classList.add("show-description");
  };
  const clearHold = () => {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
  };

  button.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    button.classList.toggle("show-description");
  });
  button.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    longPressTriggered = false;
    clearHold();
    holdTimer = setTimeout(showDescription, 380);
  });
  button.addEventListener("mouseup", clearHold);
  button.addEventListener("mouseleave", () => {
    clearHold();
    if (longPressTriggered) {
      longPressTriggered = false;
      button.classList.remove("show-description");
    }
  });
  button.addEventListener("touchstart", () => {
    longPressTriggered = false;
    clearHold();
    holdTimer = setTimeout(showDescription, 380);
  }, { passive: true });
  button.addEventListener("touchend", clearHold);
  return () => {
    if (!longPressTriggered) return false;
    longPressTriggered = false;
    button.classList.remove("show-description");
    return true;
  };
}

function renderAbilityMenu(unit, abilities) {
  abilityMenuEl.innerHTML = "";
  abilityMenuEl.classList.toggle("hidden", !state.abilityMenuOpen);
  if (!state.abilityMenuOpen) return;

  renderMegumiControlButtons(unit);

  for (const ability of abilities) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = state.selectedAbilityId === ability.id ? "active" : "";
    const cooldown = abilityCooldown(unit, ability.id);
    const activeSupernova = ability.id === "supernova" ? activeSupernovaForUnit(unit) : null;
    const lockedWeaponTurns = ability.type === "weaponSwitch" ? weaponLock(unit, ability.weaponId) : 0;
    const consumeLongPress = bindAbilityDescriptionReveal(button);
    button.disabled = ability.type === "weaponSwitch"
      ? state.gameOver || unit.hp <= 0 || unit.weapon === ability.weaponId || lockedWeaponTurns > 0
      : activeSupernova
      ? state.gameOver || unit.hp <= 0
      : state.gameOver || unit.acted || unit.ce < ability.ceCost || cooldown > 0;
    button.innerHTML = activeSupernova
      ? `<strong>Detonate Supernova</strong><span class="ability-cost-line">${abilityCostLine(ability, cooldown, lockedWeaponTurns, activeSupernova)}</span><span class="ability-description">${abilityDescription(ability)}</span>`
      : `<strong>${ability.name}</strong><span class="ability-cost-line">${abilityCostLine(ability, cooldown, lockedWeaponTurns, activeSupernova)}</span><span class="ability-description">${abilityDescription(ability)}</span>`;
    button.addEventListener("click", (event) => {
      if (consumeLongPress()) {
        event.preventDefault();
        return;
      }
      if (activeSupernova) {
        activateSupernova(unit);
        return;
      }
      if (ability.type === "weaponSwitch") {
        switchTojiWeapon(unit, ability);
        return;
      }
      if (ability.type === "sweepAttack") {
        useSweepingStrike(unit, ability);
        return;
      }
      if (ability.type === "self") {
        useSelfAbility(ability);
        return;
      }
    state.selectedAction = "skill";
    state.selectedAbilityId = ability.id;
    state.pendingTransfer = null;
    state.pendingSwap = null;
    if (state.pendingSummon?.abilityId !== ability.id) state.pendingSummon = null;
    calculateRanges();
    render();
    });
    abilityMenuEl.append(button);
  }
}

function renderMegumiControlButtons(unit) {
  if (!isMegumiSharedTurn(unit)) return;
  const megumi = turnController();
  for (const summon of activeSummonsFor(megumi)) {
    const button = document.createElement("button");
    button.type = "button";
    button.disabled = !canDismissSummonNow(megumi);
    button.innerHTML = `<strong>Dismiss ${summon.name}</strong><span>Free, restores ${summon.ce} CE and CD ${SUMMON_DISMISS_COOLDOWN_TURNS}</span>`;
    button.addEventListener("click", () => dismissSummon(summon, { forceMegumi: true }));
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

function toggleLogOverlay() {
  const willOpen = logOverlayEl.classList.contains("hidden");
  logOverlayEl.classList.toggle("hidden", !willOpen);
  logOverlayEl.setAttribute("aria-hidden", String(!willOpen));
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
  const tileKind = stair ? "Stairs" : hole ? "Hole" : "Floor";
  const tileState = [
    state.reachable.has(key(x, y, z)) ? "Can move" : "",
    state.abilityTargets.has(key(x, y, z)) ? "Technique target" : "",
    state.sharedActorTargets.has(key(x, y, z)) ? "Can act" : "",
  ].filter(Boolean);

  const title = document.createElement("h3");
  title.textContent = `${tileKind} ${x + 1},${y + 1}, floor ${z + 1}`;
  tileInfoEl.append(title);

  const meta = document.createElement("p");
  const tileDetails = [...tileState];
  if (fingerPile) tileDetails.push(`${fingerPile.count} Sukuna Finger${fingerPile.count === 1 ? "" : "s"}`);
  if (hole) tileDetails.push("Descent to the lower floor");
  if (terrainObject) tileDetails.push(terrainObject.name);
  if (supernova) {
    const owner = state.units.find((unit) => unit.id === supernova.ownerId);
    tileDetails.push(`${owner?.name ?? "Choso"}'s Supernova (${supernova.remainingTurns})`);
  }
  meta.textContent = tileDetails.length ? tileDetails.join(" - ") : "No active marker";
  tileInfoEl.append(meta);

  if (!occupant && !terrainObject) {
    const empty = document.createElement("p");
    empty.textContent = "No unit on this tile.";
    tileInfoEl.append(empty);
    return;
  }

  if (terrainObject) {
    const objectStats = document.createElement("div");
    objectStats.className = "inspect-grid";
    objectStats.innerHTML = `
      <div><strong>Object</strong>${terrainObject.name}</div>
      <div><strong>Type</strong>${terrainObject.type === "pillar" ? "Pillar" : "Cube"}</div>
      <div><strong>Blocks</strong>Movement</div>
    `;
    tileInfoEl.append(objectStats);
  }

  if (!occupant) return;

  const stats = document.createElement("div");
  stats.className = "inspect-grid";
  stats.innerHTML = `
    <div><strong>Unit</strong>${occupant.name}</div>
    <div><strong>Team</strong>${occupant.team === "blue" ? "Blue" : "Red"}</div>
    <div><strong>HP</strong>${occupant.hp}/${occupant.maxHp}</div>
    <div><strong>CE</strong>${ceLabel(occupant)}</div>
    <div><strong>Attack</strong>${effectiveAttack(occupant)}</div>
    <div><strong>Defense</strong>${defenseLabel(occupant)}</div>
    <div><strong>Mobility</strong>${occupant.mobility}</div>
    <div><strong>Speed</strong>${effectiveSpeed(occupant)}</div>
    ${occupant.stance ? `<div><strong>Stance</strong>${stanceLabel(occupant)}</div>` : ""}
    ${occupant.weapon ? `<div><strong>Weapon</strong>${weaponName(occupant.weapon)}</div>` : ""}
    ${occupant.poisonStacks ? `<div><strong>Poison</strong>${occupant.poisonStacks}/${POISON_MAX_STACKS} - ${occupant.poisonTurnsRemaining}t</div>` : ""}
    ${occupant.bleedingTurnsRemaining ? `<div><strong>Bleeding</strong>${occupant.bleedingStacks || 1} - ${occupant.bleedingTurnsRemaining}t</div>` : ""}
    ${occupant.idleTransfigurationTurns ? `<div><strong>Mark</strong>${occupant.idleTransfigurationTurns}t</div>` : ""}
    ${occupant.focus !== null ? `<div><strong>Focus</strong>${occupant.focus}/5</div>` : ""}
    ${isMahito(occupant) ? `<div><strong>Black Flash</strong>${occupant.mahitoBlackFlashes}/2</div>` : ""}
    ${isMahitoTransformed(occupant) ? `<div><strong>Form</strong>Transformed</div>` : ""}
    ${hasYujiInBattle() ? `<div><strong>Fingers</strong>${occupant.sukunaFingers}</div>` : ""}
    ${hasYujiInBattle() ? `<div><strong>Given</strong>${totalFingerContributions(occupant)}</div>` : ""}
    ${hasYujiInBattle() && isYuji(occupant) ? `<div><strong>Consumed</strong>${yujiFingerState(occupant)?.consumed ?? 0}</div>` : ""}
  `;
  tileInfoEl.append(stats);

  const abilities = document.createElement("p");
  abilities.innerHTML = `<strong>Techniques</strong> ${getAbilities(occupant)
    .map((ability) => `${ability.name} (${ability.type === "attack" ? "attack" : "support"})`)
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

  if (state.awaitingSharedActor) {
    if (occupant && state.sharedActorTargets.has(tileKey)) {
      switchSharedActor(occupant.id);
      return;
    }
    render();
    return;
  }

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
    if (ability.type === "unitAreaAttack" && occupant?.team === enemyTeam(unit.team)) {
      useUnitAreaAttackAbility(occupant);
      return;
    }
    if (ability.type === "summonDrop") {
      useMaxElephantSummon(x, y, z);
      return;
    }
    if (ability.type === "summonUnit") {
      useDirectSummon(x, y, z);
      return;
    }
    if (ability.type === "summonPair") {
      usePairSummon(x, y, z);
      return;
    }
    if (ability.type === "worldCuttingSlash") {
      useWorldCuttingSlash(x, y, z);
      return;
    }
    if (ability.type === "teleport") {
      useTeleportAbility(x, y, z);
      return;
    }
    if (ability.type === "distortedMove") {
      useDistortedWorm(x, y, z);
      return;
    }
    if (ability.type === "predatorDash") {
      usePredatorDash(x, y, z);
      return;
    }
    if (ability.type === "boogieSwap" && occupant) {
      useBoogieWoogie(occupant);
      return;
    }
    if (ability.type === "forcedSwap" && occupant) {
      useForcedSwapTarget(occupant);
      return;
    }
    if (ability.type === "soulTouch" && occupant?.team === enemyTeam(unit.team)) {
      useSoulTouch(occupant);
      return;
    }
    if (ability.type === "idleTransfiguration" && occupant?.team === enemyTeam(unit.team)) {
      useIdleTransfiguration(occupant);
      return;
    }
    if (ability.type === "blindSpotStrike" && occupant?.team === enemyTeam(unit.team)) {
      useBlindSpotStrike(occupant);
      return;
    }
    if (ability.type === "mahitoDomain" && occupant?.id === unit.id) {
      useMahitoDomain(ability);
      return;
    }
    if (ability.type === "mahitoTransform" && occupant?.id === unit.id) {
      useMahitoTransformation(ability);
      return;
    }
    if (ability.type === "summonMahoraga" && occupant?.id === unit.id) {
      summonMahoraga(unit, ability);
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
    setFacingToward(unit, x, y);
    unit.x = x;
    unit.y = y;
    settleUnitPosition(unit);
    unit.moved = true;
    queueVisualEvent("move", { unitId: unit.id, from, to: { x: unit.x, y: unit.y, z: unit.z } });
    addLog(`${unit.name} moves to ${unit.x + 1},${unit.y + 1} on floor ${unit.z + 1}.`);
    calculateRanges();
    state.selectedAction = state.attackable.size ? "attack" : "move";
    state.selectedAbilityId = null;
    state.abilityMenuOpen = false;
    state.pendingTransfer = null;
    state.pendingSwap = null;
    state.pendingSummon = null;
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
  if (effects.simpleDomain) addLog(`${unit.name}'s Simple Domain ends.`);
  if (effects.counterattack) addLog(`${unit.name}'s Counterattack ends.`);
  unit.activeEffects = {};
}

function processEndOfTurnReactions(endingUnit) {
  if (endingUnit.hp <= 0) return;

  for (const defender of livingUnits()) {
    if (defender.team === endingUnit.team || !defender.activeEffects.simpleDomain) continue;
    if (!isAdjacent8(defender, endingUnit)) continue;
    performAttack(defender, endingUnit, "Simple Domain", { triggersCounterattack: false });
    if (endingUnit.hp === 0) break;
  }
}

function recoverDedicationCe(unit) {
  if (unit.passiveId !== "dedication" || unit.ce >= unit.maxCe) return;
  const amount = Math.floor(Math.random() * 11) + 5;
  const before = unit.ce;
  unit.ce = Math.min(unit.maxCe, unit.ce + amount);
  addLog(`${unit.name} activates Dedication and restores ${unit.ce - before} CE.`);
}

function gainFocusAfterAttack(unit) {
  const passive = getPassive(unit);
  if (passive?.id !== "focus") return;
  const before = unit.focus;
  unit.focus = Math.min(passive.maxFocus, unit.focus + 1);
  unit.attackedThisTurn = true;
  if (unit.focus !== before) addLog(`${unit.name} gains 1 Focus (${unit.focus}/${passive.maxFocus}).`);
}

function processFocusEndOfTurn(unit) {
  const passive = getPassive(unit);
  if (passive?.id !== "focus" || unit.attackedThisTurn || unit.focus <= 0) return;
  const before = unit.focus;
  unit.focus = Math.max(0, unit.focus - 2);
  addLog(`${unit.name} loses ${before - unit.focus} Focus for not attacking.`);
}

function tickSupernovaDuration(unit) {
  const orb = activeSupernovaForUnit(unit);
  if (!orb || orb.createdTurnCount === state.turnCount) return;

  orb.remainingTurns -= 1;
  if (orb.remainingTurns > 0) return;

  state.supernovas = state.supernovas.filter((entry) => entry.id !== orb.id);
  setAbilityCooldown(unit, data.abilities.supernova);
  addLog(`${unit.name}'s Supernova disappears.`);
}

function transformYujiIntoSukuna(yuji) {
  const fingerState = yujiFingerState(yuji);
  if (!fingerState || fingerState.transformed) return;
  fingerState.transformed = true;
  yuji.defeated = false;
  yuji.hp = Math.max(1, Math.ceil(yuji.maxHp * 0.4));
  yuji.activeEffects.sukuna = true;
  addLog(`${yuji.name} transforms into Sukuna.`);

  const targets = livingUnits().filter((unit) => unit.id !== yuji.id && unit.z === yuji.z);
  for (const target of targets) {
    const contribution = contributionCountForYuji(target, yuji);
    const reduction = Math.min(1, contribution * SUKUNA_FINGER_DAMAGE_REDUCTION);
    const rawDamage = Math.max(1, Math.floor(effectiveAttack(yuji) * SUKUNA_TRANSFORM_ATTACK_MULTIPLIER - effectiveDefense(target)));
    const damage = adaptedDamage(target, Math.max(0, Math.floor(rawDamage * (1 - reduction))), "slashing");
    const wasAlive = target.hp > 0;
    target.hp = Math.max(0, target.hp - damage);
    recordMegumiDamage(target, yuji);
    queueVisualEvent("hit", {
      attackerId: yuji.id,
      targetId: target.id,
      label: "Sukuna Transformation",
      damage,
      sukunaTransformation: true,
    });
    addLog(`Sukuna strikes ${target.name}: ${damage} damage${contribution ? ` (${contribution} fingers given)` : ""}.`);
    if (wasAlive && target.hp === 0) handleUnitDefeated(target);
  }
}

function performAttack(attacker, target, label, options = {}) {
  const attackMultiplier = options.attackMultiplier ?? 1;
  const triggersCounterattack = options.triggersCounterattack ?? true;
  const canBlackFlash = options.canBlackFlash ?? false;
  const blackFlash = canBlackFlash && Math.random() < blackFlashChance(attacker, target);
  const damageMultiplier = blackFlash ? blackFlashDamageMultiplier(attacker) : 1;
  const targetDefenseMultiplier = options.targetDefenseMultiplier ?? 1;
  const defensePierce = attacker?.isMahoraga ? Math.min(MAHORAGA_MAX_DEFENSE_PIERCE_STACKS, attacker.defensePierceStacks ?? 0) * MAHORAGA_DEFENSE_PIERCE_PER_STACK : 0;
  const targetDefense = isTerrainObject(target) ? 0 : Math.floor(effectiveDefense(target, { ignoreActiveEffects: options.ignoreDefensiveEffects }) * targetDefenseMultiplier * (1 - defensePierce));
  const damageType = options.damageType ?? attacker.damageType ?? "strike";
  let damage = Math.max(
    1,
    Math.floor((effectiveAttack(attacker) * attackMultiplier - targetDefense) * damageMultiplier * poisonDamageMultiplier(attacker, target)),
  );
  damage = adaptedDamage(target, damage, damageType);

  const wasAlive = target.hp > 0;
  target.hp = Math.max(0, target.hp - damage);
  recordMegumiDamage(target, attacker);
  if (attacker?.isMahoraga) attacker.defensePierceStacks = Math.min(MAHORAGA_MAX_DEFENSE_PIERCE_STACKS, (attacker.defensePierceStacks ?? 0) + 1);
  queueVisualEvent("hit", {
    attackerId: attacker.id,
    targetId: target.id,
    label,
    damage,
    blackFlash,
    damageType,
  });
  addLog(`${attacker.name} uses ${blackFlash ? "Black Flash" : label} against ${target.name}: ${damage} damage.`);
  resolveBlackFlashAfterAttack(attacker, blackFlash);
  if (wasAlive && target.hp === 0) {
    if (isTerrainObject(target)) handleTerrainDestroyed(target);
    else handleUnitDefeated(target);
    return damage;
  }

  if (options.appliesPoison && !isTerrainObject(target)) applyPoison(target);
  if (options.appliesBleeding && !isTerrainObject(target)) applyBleeding(target, { stacking: Boolean(options.stackingBleeding) });
  if (options.knockback && !isTerrainObject(target)) pushTarget(attacker, target, options.knockback);
  if (isMahitoTransformed(target) && !isTerrainObject(target)) {
    target.ce = Math.max(0, target.ce - damage);
    addLog(`${target.name} loses ${damage} CE to maintain their form.`);
    if (target.ce <= 0) endMahitoTransformation(target);
  }

  if (triggersCounterattack && !isTerrainObject(target)) tryCounterattack(target, attacker);
  return damage;
}

function reserveSummonCe(megumi, amount) {
  megumi.maxCe = Math.max(0, megumi.maxCe - amount);
  megumi.ce = Math.min(megumi.ce, megumi.maxCe);
}

function restoreSummonCe(megumi, summon) {
  megumi.maxCe += summon.reservedCe;
  megumi.ce = Math.min(megumi.maxCe, megumi.ce + Math.max(0, summon.ce));
}

function setSummonDismissCooldown(megumi, summon) {
  if (!summon.summonAbilityId) return;
  megumi.abilityCooldowns[summon.summonAbilityId] = SUMMON_DISMISS_COOLDOWN_TURNS + 1;
}

function releaseSummonReservation(summon, options = {}) {
  const megumi = summonerFor(summon);
  if (!megumi || summon.reservationReleased) return;
  summon.reservationReleased = true;
  restoreSummonCe(megumi, summon);
  if (options.died && !megumi.deadSummons.includes(summon.summonKind)) megumi.deadSummons.push(summon.summonKind);
  if (options.cooldown) setSummonDismissCooldown(megumi, summon);
}

function dismissSummon(summon, options = {}) {
  const megumi = summonerFor(summon);
  if (!megumi || !summon || summon.hp <= 0) return;
  releaseSummonReservation(summon, { cooldown: true, died: false });
  summon.hp = 0;
  summon.defeated = true;
  summon.removed = true;
  megumi.mustActPersonally = options.forceMegumi !== false;
  state.currentUnitId = megumi.id;
  state.previewLevel = megumi.z;
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  addLog(`${megumi.name} dismisses ${summon.name}.`);
  calculateRanges();
  render();
}

function autoDismissDepletedSummon(summon) {
  if (!isMegumiSummon(summon) || summon.ce > 0 || summon.removed) return;
  const megumi = summonerFor(summon);
  releaseSummonReservation(summon, { cooldown: true, died: false });
  summon.hp = 0;
  summon.defeated = true;
  summon.removed = true;
  if (megumi && state.currentUnitId === summon.id) state.currentUnitId = megumi.id;
  addLog(`${summon.name} runs out of CE and disappears.`);
}

function spendSummonCe(summon, amount) {
  if (!isMegumiSummon(summon)) return;
  summon.ce = Math.max(0, summon.ce - amount);
  autoDismissDepletedSummon(summon);
}

function defeatMegumiSummons(megumi) {
  for (const summon of activeSummonsFor(megumi)) {
    summon.hp = 0;
    summon.defeated = true;
    summon.removed = true;
    releaseSummonReservation(summon, { died: true });
    addLog(`${summon.name} dies when ${megumi.name} falls.`);
  }
}

function validAdjacentSummonTiles(megumi, x = megumi.x, y = megumi.y, z = megumi.z) {
  return [[0, -1], [1, 0], [0, 1], [-1, 0]]
    .map(([dx, dy]) => ({ x: x + dx, y: y + dy, z }))
    .filter((tile) =>
      tile.x >= 0 && tile.x < SIZE
      && tile.y >= 0 && tile.y < SIZE
      && tile.z >= 0 && tile.z < LEVELS
      && !unitAt(tile.x, tile.y, tile.z)
      && !solidTerrainAt(tile.x, tile.y, tile.z)
      && !holeAt(tile.x, tile.y, tile.z),
    );
}

function canPlaceSummonAt(x, y, z) {
  return x >= 0
    && x < SIZE
    && y >= 0
    && y < SIZE
    && z >= 0
    && z < LEVELS
    && !unitAt(x, y, z)
    && !solidTerrainAt(x, y, z)
    && !holeAt(x, y, z);
}

function createSummonUnit(megumi, templateKey, position) {
  const template = MEGUMI_SUMMON_TEMPLATES[templateKey];
  const summon = {
    id: `${megumi.id}-${templateKey}-${state.units.length}`,
    characterId: templateKey,
    name: template.name,
    cost: 0,
    model: { shape: template.shape },
    team: megumi.team,
    x: position.x,
    y: position.y,
    z: position.z,
    shape: template.shape,
    facing: "south",
    maxHp: template.maxHp,
    hp: template.maxHp,
    speed: template.speed,
    attack: template.attack,
    defense: template.defense,
    mobility: template.mobility,
    maxCe: template.maxCe,
    ce: template.maxCe,
    focus: null,
    stance: null,
    weapon: null,
    weaponLocks: {},
    poisonStacks: 0,
    poisonTurnsRemaining: 0,
    bleedingStacks: 0,
    bleedingTurnsRemaining: 0,
    idleTransfigurationTurns: 0,
    mahitoBlackFlashes: 0,
    mahitoUltimateUsed: false,
    mahitoBaseStats: null,
    megumiTurnsTaken: 0,
    megumiDamageMemory: [],
    mustActPersonally: false,
    deadSummons: [],
    sukunaFingers: 0,
    attackedThisTurn: false,
    abilityCooldowns: {},
    activeEffects: {},
    statuses: [...(template.statuses ?? [])],
    isSummon: true,
    summonerId: megumi.id,
    summonKind: template.summonKind,
    summonAbilityId: template.summonAbilityId,
    reservedCe: template.reservedCe,
    reservationReleased: false,
    sharedTurnActed: false,
    isMahoraga: false,
    allowedTargetIds: [],
    adaptations: {},
    defensePierceStacks: 0,
    removed: false,
    defeated: false,
    initiative: 0,
    acted: false,
    moved: false,
    abilityIds: [...template.abilityIds],
    damageType: template.damageType,
  };
  reserveSummonCe(megumi, summon.reservedCe);
  state.units.push(summon);
  return summon;
}

function finishMegumiSummonAbility(megumi, ability) {
  setAbilityCooldown(megumi, ability);
  megumi.acted = true;
  megumi.moved = true;
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingSummon = null;
  calculateRanges();
  render();
}

function useDirectSummon(x, y, z) {
  const megumi = currentUnit();
  const ability = selectedAbility();
  if (!megumi || !ability || ability.type !== "summonUnit" || megumi.acted || megumi.ce < ability.ceCost || abilityCooldown(megumi, ability.id) > 0) return;
  if (!state.abilityTargets.has(key(x, y, z)) || !ability.summonTemplate) return;
  createSummonUnit(megumi, ability.summonTemplate, { x, y, z });
  addLog(`${megumi.name} summons ${MEGUMI_SUMMON_TEMPLATES[ability.summonTemplate].name}.`);
  finishMegumiSummonAbility(megumi, ability);
}

function usePairSummon(x, y, z) {
  const megumi = currentUnit();
  const ability = selectedAbility();
  if (!megumi || !ability || ability.type !== "summonPair" || megumi.acted || megumi.ce < ability.ceCost || abilityCooldown(megumi, ability.id) > 0) return;
  if (!state.abilityTargets.has(key(x, y, z)) || !ability.summonTemplates?.length) return;

  const pending = state.pendingSummon?.abilityId === ability.id
    ? state.pendingSummon
    : { abilityId: ability.id, positions: [] };
  pending.positions.push({ x, y, z });
  state.pendingSummon = pending;

  if (pending.positions.length < ability.summonTemplates.length) {
    const template = ability.summonTemplates[pending.positions.length - 1];
    addLog(`${megumi.name} prepares ${MEGUMI_SUMMON_TEMPLATES[template].name}.`);
    calculateRanges();
    render();
    return;
  }

  for (const [index, template] of ability.summonTemplates.entries()) {
    createSummonUnit(megumi, template, pending.positions[index]);
  }
  addLog(`${megumi.name} summons Divine Dogs.`);
  finishMegumiSummonAbility(megumi, ability);
}

function useMaxElephantSummon(x, y, z) {
  const megumi = currentUnit();
  const ability = selectedAbility();
  if (!megumi || !ability || ability.type !== "summonDrop" || megumi.acted || megumi.ce < ability.ceCost || abilityCooldown(megumi, ability.id) > 0) return;
  if (!state.abilityTargets.has(key(x, y, z))) return;
  const landingTiles = validAdjacentSummonTiles(megumi, x, y, z);
  if (!landingTiles.length) return;
  const target = livingUnitAt(x, y, z);
  if (target && target.team !== megumi.team) {
    performAttack(megumi, target, ability.name, {
      attackMultiplier: ability.attackMultiplier,
      damageType: ability.damageType,
      triggersCounterattack: false,
      canBlackFlash: false,
    });
  }
  createSummonUnit(megumi, "maxElephant", landingTiles[Math.floor(Math.random() * landingTiles.length)]);
  addLog(`${megumi.name} summons Max Elephant.`);
  finishMegumiSummonAbility(megumi, ability);
}

function createMahoraga(megumi, allowedTargets) {
  const tiles = validAdjacentSummonTiles(megumi);
  const position = tiles[0] ?? { x: megumi.x, y: megumi.y, z: megumi.z };
  const mahoraga = {
    id: `${megumi.id}-mahoraga`,
    characterId: "mahoraga",
    name: MAHORAGA_TEMPLATE.name,
    cost: 0,
    model: { shape: MAHORAGA_TEMPLATE.shape },
    team: megumi.team,
    x: position.x,
    y: position.y,
    z: position.z,
    shape: MAHORAGA_TEMPLATE.shape,
    facing: "south",
    maxHp: MAHORAGA_TEMPLATE.maxHp,
    hp: MAHORAGA_TEMPLATE.maxHp,
    speed: MAHORAGA_TEMPLATE.speed,
    attack: MAHORAGA_TEMPLATE.attack,
    defense: MAHORAGA_TEMPLATE.defense,
    mobility: MAHORAGA_TEMPLATE.mobility,
    maxCe: 0,
    ce: 0,
    focus: null,
    stance: null,
    weapon: null,
    weaponLocks: {},
    poisonStacks: 0,
    poisonTurnsRemaining: 0,
    bleedingStacks: 0,
    bleedingTurnsRemaining: 0,
    idleTransfigurationTurns: 0,
    sukunaFingers: 0,
    attackedThisTurn: false,
    abilityCooldowns: {},
    activeEffects: {},
    statuses: [],
    isSummon: true,
    summonerId: megumi.id,
    summonKind: "mahoraga",
    summonAbilityId: "summonMahoraga",
    reservedCe: 0,
    reservationReleased: true,
    sharedTurnActed: false,
    isMahoraga: true,
    allowedTargetIds: allowedTargets.map((target) => target.id),
    adaptations: {},
    defensePierceStacks: 0,
    removed: false,
    defeated: false,
    initiative: 0,
    acted: false,
    moved: false,
    abilityIds: [...MAHORAGA_TEMPLATE.abilityIds],
    damageType: MAHORAGA_TEMPLATE.damageType,
  };
  state.units.push(mahoraga);
  return mahoraga;
}

function summonMahoraga(megumi, ability) {
  if (!canSummonMahoraga(megumi)) return;
  const allowedTargets = mahoragaRitualTargets(megumi);
  megumi.ce -= ability.ceCost;
  megumi.hp = 0;
  handleUnitDefeated(megumi);
  const mahoraga = createMahoraga(megumi, allowedTargets);
  mahoraga.initiative = MAX_TURN;
  state.currentUnitId = mahoraga.id;
  state.turnControllerId = mahoraga.id;
  state.previewLevel = mahoraga.z;
  addLog(`${megumi.name} summons Mahoraga.`);
  calculateRanges();
  render();
}

function handleUnitDefeated(unit) {
  if (unit.defeated) return;
  unit.defeated = true;
  unit.activeEffects = {};
  state.supernovas = state.supernovas.filter((orb) => orb.ownerId !== unit.id);
  if (isMegumiSummon(unit)) {
    releaseSummonReservation(unit, { died: true });
    unit.removed = true;
  }
  if (isMegumi(unit)) defeatMegumiSummons(unit);
  dropFingersFromUnit(unit);
  addLog(`${unit.name} is defeated.`);
}

function handleTerrainDestroyed(object) {
  state.terrainObjects = state.terrainObjects.filter((entry) => entry.id !== object.id);
  addLog(`${object.name} breaks.`);
  if (object.type === "pillar") {
    const holeZ = object.z + 1;
    addHole(object.x, object.y, holeZ);
    const unitAbove = unitAt(object.x, object.y, holeZ);
    if (unitAbove) settleUnitPosition(unitAbove);
  }
}

function tryCounterattack(defender, attacker) {
  if (!defender.activeEffects.counterattack || defender.hp <= 0 || attacker.hp <= 0) return;
  performAttack(defender, attacker, "Counterattack", { triggersCounterattack: false });
  recoverDedicationCe(defender);
}

function switchTojiWeapon(unit, ability) {
  if (!isToji(unit) || !ability?.weaponId || unit.weapon === ability.weaponId || weaponLock(unit, ability.weaponId) > 0) return;
  if (unit.weapon) unit.weaponLocks[unit.weapon] = Math.max(weaponLock(unit, unit.weapon), TOJI_WEAPON_LOCK_TURNS);
  unit.weapon = ability.weaponId;
  unit.weaponLocks[ability.weaponId] = TOJI_WEAPON_LOCK_TURNS;
  state.abilityMenuOpen = false;
  state.selectedAbilityId = null;
  addLog(`${unit.name} equips ${weaponName(ability.weaponId)}.`);
  calculateRanges();
  render();
}

function pushTarget(attacker, target, distance = 1) {
  if (!target || isTerrainObject(target) || target.hp <= 0) return;
  const dx = Math.sign(target.x - attacker.x);
  const dy = Math.sign(target.y - attacker.y);
  if (!dx && !dy) return;

  for (let step = 0; step < distance; step += 1) {
    const nextX = target.x + dx;
    const nextY = target.y + dy;
    if (!canOccupyTile(target, nextX, nextY, target.z)) break;
    target.x = nextX;
    target.y = nextY;
    settleUnitPosition(target);
  }
}

function sweepTargetsFor(unit) {
  const { dx, dy } = directionVector(unit.facing);
  const left = { x: unit.x + dx - dy, y: unit.y + dy + dx };
  const center = { x: unit.x + dx, y: unit.y + dy };
  const right = { x: unit.x + dx + dy, y: unit.y + dy - dx };
  return [left, center, right]
    .filter(({ x, y }) => x >= 0 && x < SIZE && y >= 0 && y < SIZE)
    .flatMap(({ x, y }) => {
      const occupant = livingUnitAt(x, y, unit.z);
      const terrainObject = terrainObjectAt(x, y, unit.z);
      return [occupant?.team !== unit.team ? occupant : null, terrainObject].filter(Boolean);
    });
}

function useSweepingStrike(unit, ability) {
  if (!unit || unit.hp <= 0 || unit.acted || abilityCooldown(unit, ability.id) > 0 || unit.weapon !== ability.requiredWeapon) return;
  const targets = sweepTargetsFor(unit);
  if (!targets.length) return;

  setAbilityCooldown(unit, ability);
  for (const target of targets) {
    performAttack(unit, target, ability.name, {
      attackMultiplier: ability.attackMultiplier,
      damageType: ability.damageType,
      triggersCounterattack: false,
      canBlackFlash: false,
    });
  }
  unit.acted = true;
  unit.moved = true;
  state.abilityMenuOpen = false;
  state.selectedAbilityId = null;
  state.pendingTransfer = null;
  state.pendingSwap = null;
  state.pendingSummon = null;

  if (checkVictory()) {
    render();
    return;
  }
  if (beginSharedActorSelection(turnController())) {
    calculateRanges();
    render();
    return;
  }
  calculateRanges();
  render();
}

function useOffense(target) {
  const unit = currentUnit();
  const targetKey = key(target.x, target.y, target.z);
  if (!unit || unit.hp <= 0 || unit.acted || (!state.attackable.has(target.id) && !state.abilityTargets.has(targetKey))) return;
  if (!canMahoragaTarget(unit, target)) return;

  const basicAttack = state.selectedAction !== "skill";
  let label = "basic attack";
  let attackMultiplier = chosoBasicAttackMultiplier(unit, target);
  let canBlackFlash = true;
  let damageType = unit.damageType ?? "strike";
  let targetDefenseMultiplier = 1;
  let appliesPoison = isChoso(unit) && unit.stance === "blood" && !isTerrainObject(target);
  let appliesBleeding = false;
  let stackingBleeding = false;
  let knockback = 0;
  let ignoreDefensiveEffects = false;
  let triggersCounterattack = !(isChoso(unit) && unit.stance === "blood" && distance2d(unit, target.x, target.y) > 1);

  setFacingToward(unit, target.x, target.y);

  if (isChoso(unit)) {
    label = unit.stance === "combat" ? "Hardened Blood" : "Blood Projectile";
    canBlackFlash = false;
    damageType = "strike";
  }
  if (isToji(unit) && unit.weapon === "invertedSpear") {
    label = "Inverted Spear of Heaven";
    targetDefenseMultiplier = 0.5;
    ignoreDefensiveEffects = true;
    canBlackFlash = false;
    damageType = "slashing";
  }
  if (isToji(unit) && unit.weapon === "splitSoulKatana") {
    damageType = "slashing";
  }
  if (isToji(unit) && unit.weapon === "chainWeapon") {
    damageType = "strike";
  }
  if (isMahitoTransformed(unit)) {
    label = "Transfigured Slash";
    canBlackFlash = false;
    appliesBleeding = !isTerrainObject(target);
    stackingBleeding = true;
    damageType = "slashing";
  }

  if (state.selectedAction === "skill") {
    const ability = getAbility(unit, state.selectedAbilityId);
    if (!ability || !isAbilityAvailableForUnit(unit, ability) || unit.ce < ability.ceCost || abilityCooldown(unit, ability.id) > 0) return;
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
    appliesBleeding = Boolean(ability.appliesBleeding);
    stackingBleeding = Boolean(ability.stackingBleeding);
    damageType = ability.damageType ?? damageType;
    knockback = ability.knockback ?? 0;
    ignoreDefensiveEffects = Boolean(ability.ignoreDefensiveEffects);
    triggersCounterattack = false;
  }

  performAttack(unit, target, label, { attackMultiplier, canBlackFlash, targetDefenseMultiplier, appliesPoison, appliesBleeding, stackingBleeding, knockback, ignoreDefensiveEffects, triggersCounterattack, damageType });
  if (basicAttack && isMegumiSummon(unit)) spendSummonCe(unit, SUMMON_BASIC_CE_LOSS);
  gainFocusAfterAttack(unit);
  unit.acted = true;
  unit.moved = true;
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  state.pendingSwap = null;
  state.pendingSummon = null;

  if (checkVictory()) {
    render();
    return;
  }

  if (beginSharedActorSelection(turnController())) {
    calculateRanges();
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
    if ((occupant || terrainObject) && !ability.passesThrough) break;
  }
  return targets;
}

function useLineAttackAbility(unit, target, ability) {
  const targets = lineTargetsFor(unit, target, ability);
  if (!targets.length) return;

  unit.ce -= ability.ceCost;
  setAbilityCooldown(unit, ability);
  setFacingToward(unit, target.x, target.y);
  for (const lineTarget of targets) {
    performAttack(unit, lineTarget, ability.name, {
      attackMultiplier: ability.attackMultiplier,
      targetDefenseMultiplier: ability.defenseMultiplier ?? 1,
      appliesPoison: ability.appliesPoison,
      appliesBleeding: ability.appliesBleeding,
      damageType: ability.damageType,
      knockback: ability.knockback ?? 0,
      ignoreDefensiveEffects: Boolean(ability.ignoreDefensiveEffects),
      triggersCounterattack: false,
      canBlackFlash: false,
    });
  }
  unit.acted = true;
  unit.moved = true;
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  state.pendingSwap = null;
  state.pendingSummon = null;

  if (checkVictory()) {
    render();
    return;
  }

  if (beginSharedActorSelection(turnController())) {
    calculateRanges();
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
      damageType: ability.damageType,
      triggersCounterattack: false,
      canBlackFlash: false,
    });
  }
  if (isMegumiSummon(unit)) autoDismissDepletedSummon(unit);
  unit.acted = true;
  unit.moved = true;
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  state.pendingSwap = null;
  state.pendingSummon = null;

  if (checkVictory()) {
    render();
    return;
  }

  if (beginSharedActorSelection(turnController())) {
    calculateRanges();
    render();
    return;
  }

  calculateRanges();
  render();
}

function useUnitAreaAttackAbility(primaryTarget) {
  const unit = currentUnit();
  const ability = selectedAbility();
  if (!unit || unit.hp <= 0 || !primaryTarget || !ability || ability.type !== "unitAreaAttack" || unit.acted || unit.ce < ability.ceCost || abilityCooldown(unit, ability.id) > 0) return;
  if (!state.abilityTargets.has(key(primaryTarget.x, primaryTarget.y, primaryTarget.z))) return;

  const targets = livingUnits().filter((target) =>
    target.id !== unit.id
    && target.z === primaryTarget.z
    && Math.max(Math.abs(target.x - primaryTarget.x), Math.abs(target.y - primaryTarget.y)) <= ability.radius,
  );
  if (!targets.length) return;

  unit.ce -= ability.ceCost;
  setAbilityCooldown(unit, ability);
  for (const target of targets) {
    performAttack(unit, target, ability.name, {
      attackMultiplier: ability.attackMultiplier,
      damageType: ability.damageType,
      triggersCounterattack: false,
      canBlackFlash: false,
    });
  }
  if (isMegumiSummon(unit)) autoDismissDepletedSummon(unit);
  unit.acted = true;
  unit.moved = true;
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  state.pendingSwap = null;
  state.pendingSummon = null;

  if (checkVictory()) {
    render();
    return;
  }

  if (beginSharedActorSelection(turnController())) {
    calculateRanges();
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
  state.pendingSwap = null;
  addLog(`${unit.name} places Supernova at ${x + 1},${y + 1}, floor ${z + 1}.`);
  calculateRanges();
  render();
}

function detonateSupernova(unit, orb, ability, reason = "detonates") {
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
      damageType: ability.damageType,
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
  state.pendingSwap = null;

  if (checkVictory()) {
    render();
    return;
  }

  calculateRanges();
  render();
}

function useSelfAbility(ability) {
  const unit = currentUnit();
  if (!unit || unit.hp <= 0 || !ability || !isAbilityAvailableForUnit(unit, ability) || unit.acted || unit.ce < ability.ceCost || abilityCooldown(unit, ability.id) > 0) return;

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
  state.pendingSwap = null;
  addLog(`${unit.name} uses ${ability.name}${unit.stance ? `: ${stanceLabel(unit)}` : ""}.`);
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
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  state.pendingSwap = null;
  addLog(`${unit.name} uses ${ability.name} at ${x + 1},${y + 1}, floor ${z + 1}.`);
  calculateRanges();
  render();
}

function useTeleportAbility(x, y, z) {
  const unit = currentUnit();
  const ability = selectedAbility();
  if (!unit || unit.hp <= 0 || !ability || ability.type !== "teleport" || unit.acted || abilityCooldown(unit, ability.id) > 0) return;
  if (!state.abilityTargets.has(key(x, y, z))) return;

  const from = { x: unit.x, y: unit.y, z: unit.z };
  setAbilityCooldown(unit, ability);
  setFacingToward(unit, x, y);
  unit.x = x;
  unit.y = y;
  unit.z = z;
  settleUnitPosition(unit);
  unit.acted = true;
  unit.moved = true;
  state.previewLevel = unit.z;
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  state.pendingSwap = null;
  queueVisualEvent("move", { unitId: unit.id, from, to: { x: unit.x, y: unit.y, z: unit.z } });
  addLog(`${unit.name} uses ${ability.name} to ${unit.x + 1},${unit.y + 1}, floor ${unit.z + 1}.`);
  calculateRanges();
  render();
}

function canSwapInto(unit, x, y, z, swapPartner) {
  if (x < 0 || x >= SIZE || y < 0 || y >= SIZE || z < 0 || z >= LEVELS) return false;
  const occupant = unitAt(x, y, z);
  if (occupant && occupant.id !== unit.id && occupant.id !== swapPartner.id) return false;
  if (solidTerrainAt(x, y, z)) return false;
  if (holeAt(x, y, z) && !isFlying(unit)) return false;
  return true;
}

function canSwapUnits(first, second) {
  if (!first || !second || first.id === second.id || first.hp <= 0 || second.hp <= 0) return false;
  return canSwapInto(first, second.x, second.y, second.z, second)
    && canSwapInto(second, first.x, first.y, first.z, first);
}

function swapUnits(first, second, label) {
  const firstFrom = { x: first.x, y: first.y, z: first.z };
  const secondFrom = { x: second.x, y: second.y, z: second.z };
  first.x = secondFrom.x;
  first.y = secondFrom.y;
  first.z = secondFrom.z;
  second.x = firstFrom.x;
  second.y = firstFrom.y;
  second.z = firstFrom.z;
  settleUnitPosition(first);
  settleUnitPosition(second);
  queueVisualEvent("move", { unitId: first.id, from: firstFrom, to: { x: first.x, y: first.y, z: first.z } });
  queueVisualEvent("move", { unitId: second.id, from: secondFrom, to: { x: second.x, y: second.y, z: second.z } });
  addLog(`${label}: ${first.name} swaps position with ${second.name}.`);
}

function finishSwapAbility(unit, ability) {
  unit.ce -= ability.ceCost;
  setAbilityCooldown(unit, ability);
  unit.acted = true;
  unit.moved = true;
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  state.pendingSwap = null;
  calculateRanges();
  render();
}

function useBoogieWoogie(target) {
  const unit = currentUnit();
  const ability = selectedAbility();
  if (!unit || !target || !ability || ability.type !== "boogieSwap" || unit.acted || unit.ce < ability.ceCost || abilityCooldown(unit, ability.id) > 0) return;
  if (!state.abilityTargets.has(key(target.x, target.y, target.z)) || !canSwapUnits(unit, target)) return;

  setFacingToward(unit, target.x, target.y);
  swapUnits(unit, target, ability.name);
  finishSwapAbility(unit, ability);
}

function useForcedSwapTarget(target) {
  const unit = currentUnit();
  const ability = selectedAbility();
  if (!unit || !target || !ability || ability.type !== "forcedSwap" || unit.acted || unit.ce < ability.ceCost || abilityCooldown(unit, ability.id) > 0) return;
  if (!state.abilityTargets.has(key(target.x, target.y, target.z)) || target.id === unit.id) return;

  if (state.pendingSwap?.abilityId !== ability.id) {
    state.pendingSwap = { abilityId: ability.id, firstTargetId: target.id };
    addLog(`${unit.name} prepares ${ability.name}: choose another unit.`);
    calculateRanges();
    render();
    return;
  }

  const firstTarget = livingUnits().find((entry) => entry.id === state.pendingSwap.firstTargetId);
  if (!firstTarget || firstTarget.id === target.id || !canSwapUnits(firstTarget, target)) return;

  setFacingToward(unit, target.x, target.y);
  swapUnits(firstTarget, target, ability.name);
  finishSwapAbility(unit, ability);
}

function finishMahitoAbility(unit, ability) {
  setAbilityCooldown(unit, ability);
  unit.acted = true;
  unit.moved = true;
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  state.pendingSwap = null;
  if (checkVictory()) {
    render();
    return;
  }
  calculateRanges();
  render();
}

function soulTouchThreshold(target, ability) {
  return target.idleTransfigurationTurns ? ability.markedExecutionThreshold : ability.executionThreshold;
}

function applySoulTouch(user, target, ability, sourceName = ability.name) {
  const threshold = soulTouchThreshold(target, ability);
  if (target.ce < threshold) {
    target.hp = 0;
    handleUnitDefeated(target);
    addLog(`${sourceName} executes ${target.name} below ${threshold} CE.`);
    return;
  }

  const before = target.ce;
  target.ce = Math.max(0, target.ce - ability.ceDrain);
  addLog(`${user.name} uses ${sourceName}: ${target.name} loses ${before - target.ce} CE.`);
}

function useSoulTouch(target) {
  const unit = currentUnit();
  const ability = selectedAbility();
  if (!unit || !target || !ability || ability.type !== "soulTouch" || unit.acted || unit.ce < ability.ceCost || abilityCooldown(unit, ability.id) > 0) return;
  if (!state.abilityTargets.has(key(target.x, target.y, target.z))) return;

  unit.ce -= ability.ceCost;
  setFacingToward(unit, target.x, target.y);
  applySoulTouch(unit, target, ability);
  finishMahitoAbility(unit, ability);
}

function useIdleTransfiguration(target) {
  const unit = currentUnit();
  const ability = selectedAbility();
  if (!unit || !target || !ability || ability.type !== "idleTransfiguration" || unit.acted || unit.ce < ability.ceCost || abilityCooldown(unit, ability.id) > 0) return;
  if (!state.abilityTargets.has(key(target.x, target.y, target.z))) return;

  unit.ce -= ability.ceCost;
  setFacingToward(unit, target.x, target.y);
  target.idleTransfigurationTurns = ability.markTurns;
  addLog(`${unit.name} marks ${target.name} with Idle Transfiguration.`);
  finishMahitoAbility(unit, ability);
}

function useDistortedWorm(x, y, z) {
  const unit = currentUnit();
  const ability = selectedAbility();
  if (!unit || !ability || ability.type !== "distortedMove" || unit.acted || unit.ce < ability.ceCost || abilityCooldown(unit, ability.id) > 0) return;
  if (!state.abilityTargets.has(key(x, y, z))) return;

  const from = { x: unit.x, y: unit.y, z: unit.z };
  unit.ce -= ability.ceCost;
  unit.x = x;
  unit.y = y;
  unit.z = z;
  settleUnitPosition(unit);
  state.previewLevel = unit.z;
  queueVisualEvent("move", { unitId: unit.id, from, to: { x: unit.x, y: unit.y, z: unit.z } });
  addLog(`${unit.name} uses ${ability.name} to ${unit.x + 1},${unit.y + 1}, floor ${unit.z + 1}.`);
  finishMahitoAbility(unit, ability);
}

function useMahitoDomain(ability) {
  const unit = currentUnit();
  if (!unit || !ability || ability.type !== "mahitoDomain" || unit.acted || unit.ce < ability.ceCost || abilityCooldown(unit, ability.id) > 0) return;

  unit.ce -= ability.ceCost;
  unit.mahitoUltimateUsed = true;
  const soulTouch = data.abilities.soulTouch;
  const targets = livingUnits().filter((target) =>
    target.team !== unit.team
    && target.z === unit.z
    && Math.max(Math.abs(target.x - unit.x), Math.abs(target.y - unit.y)) <= ability.radius,
  );
  addLog(`${unit.name} opens Self-Embodiment of Perfection.`);
  for (const target of targets) applySoulTouch(unit, target, soulTouch, ability.name);
  finishMahitoAbility(unit, ability);
}

function useMahitoTransformation(ability) {
  const unit = currentUnit();
  if (!unit || !ability || ability.type !== "mahitoTransform" || unit.acted || abilityCooldown(unit, ability.id) > 0) return;

  if (!unit.mahitoBaseStats) {
    unit.mahitoBaseStats = {
      attack: unit.attack,
      defense: unit.defense,
      speed: unit.speed,
      maxCe: unit.maxCe,
    };
  }
  unit.mahitoUltimateUsed = true;
  unit.maxCe = MAHITO_TRANSFORM_CE;
  unit.ce = MAHITO_TRANSFORM_CE;
  unit.attack = 21;
  unit.defense = 10;
  unit.speed = 28;
  unit.activeEffects.mahitoTransformed = true;
  unit.activeEffects.mahitoDepleted = false;
  addLog(`${unit.name} transforms into Instant Spirit Body of Distorted Killing.`);
  finishMahitoAbility(unit, ability);
}

function pathCellsBetween(unit, x, y) {
  const dx = Math.sign(x - unit.x);
  const dy = Math.sign(y - unit.y);
  if (dx && dy) return [];
  if (!dx && !dy) return [];
  const distance = Math.abs(x - unit.x) + Math.abs(y - unit.y);
  const cells = [];
  for (let step = 1; step <= distance; step += 1) {
    cells.push({ x: unit.x + dx * step, y: unit.y + dy * step, z: unit.z });
  }
  return cells;
}

function usePredatorDash(x, y, z) {
  const unit = currentUnit();
  const ability = selectedAbility();
  if (!unit || !ability || ability.type !== "predatorDash" || unit.acted || abilityCooldown(unit, ability.id) > 0) return;
  if (!state.abilityTargets.has(key(x, y, z))) return;

  const from = { x: unit.x, y: unit.y, z: unit.z };
  const targets = pathCellsBetween(unit, x, y)
    .map((cell) => livingUnitAt(cell.x, cell.y, z))
    .filter((target) => target && target.team !== unit.team);
  setFacingToward(unit, x, y);
  unit.x = x;
  unit.y = y;
  unit.z = z;
  for (const target of targets) {
    performAttack(unit, target, ability.name, {
      attackMultiplier: ability.attackMultiplier,
      appliesBleeding: true,
      stackingBleeding: true,
      damageType: ability.damageType,
      triggersCounterattack: false,
      canBlackFlash: false,
    });
  }
  queueVisualEvent("move", { unitId: unit.id, from, to: { x: unit.x, y: unit.y, z: unit.z } });
  finishMahitoAbility(unit, ability);
}

function useWorldCuttingSlash(x, y, z) {
  const unit = currentUnit();
  const ability = selectedAbility();
  if (!unit || !ability || ability.type !== "worldCuttingSlash" || unit.acted || !mahoragaCanUseWorldSlash(unit)) return;
  if (!state.abilityTargets.has(key(x, y, z))) return;

  const targets = livingUnits().filter((target) =>
    target.team !== unit.team
    && target.z === z
    && canMahoragaTarget(unit, target),
  );
  for (const target of targets) {
    performAttack(unit, target, ability.name, {
      attackMultiplier: ability.attackMultiplier,
      damageType: ability.damageType,
      triggersCounterattack: false,
      canBlackFlash: false,
    });
  }
  unit.acted = true;
  unit.moved = true;
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  if (checkVictory()) {
    render();
    return;
  }
  calculateRanges();
  render();
}

function validBlindSpotTiles(target, unit) {
  return [[0, -1], [0, 1], [-1, 0], [1, 0]]
    .map(([dx, dy]) => ({ x: target.x + dx, y: target.y + dy, z: target.z }))
    .filter((tile) => canOccupyTile(unit, tile.x, tile.y, tile.z));
}

function useBlindSpotStrike(target) {
  const unit = currentUnit();
  const ability = selectedAbility();
  if (!unit || !target || !ability || ability.type !== "blindSpotStrike" || unit.acted || abilityCooldown(unit, ability.id) > 0) return;
  if (!state.abilityTargets.has(key(target.x, target.y, target.z))) return;

  const options = validBlindSpotTiles(target, unit);
  if (!options.length) return;
  const destination = options[Math.floor(Math.random() * options.length)];
  const from = { x: unit.x, y: unit.y, z: unit.z };
  unit.x = destination.x;
  unit.y = destination.y;
  unit.z = destination.z;
  setFacingToward(unit, target.x, target.y);
  queueVisualEvent("move", { unitId: unit.id, from, to: { x: unit.x, y: unit.y, z: unit.z } });
  performAttack(unit, target, ability.name, {
    attackMultiplier: ability.attackMultiplier,
    appliesBleeding: true,
    stackingBleeding: true,
    damageType: ability.damageType,
    triggersCounterattack: false,
    canBlackFlash: false,
  });
  finishMahitoAbility(unit, ability);
}

function transferFingersToYuji(unit, yuji, count) {
  const amount = Math.max(0, Math.min(unit.sukunaFingers, Math.floor(count)));
  if (!amount) return;
  unit.sukunaFingers -= amount;
  consumeFingersForYuji(yuji, amount, unit);
  addLog(`${unit.name} gives ${amount} finger${amount === 1 ? "" : "s"} to ${yuji.name}.`);
  render();
}

function useSpecialAction() {
  const unit = currentUnit();
  const yuji = adjacentYujiForTransfer(unit);
  if (!unit || !yuji) return;
  state.pendingTransfer = { unitId: unit.id, yujiId: yuji.id };
  state.abilityMenuOpen = false;
  state.pendingSwap = null;
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
  state.pendingSwap = null;
  queueVisualEvent("move", { unitId: unit.id, from, to: { x: unit.x, y: unit.y, z: unit.z } });
  addLog(`${unit.name} ${direction < 0 ? "goes down" : "goes up"} to floor ${unit.z + 1}.`);
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
    addLog(`${winner === "blue" ? "Blue" : "Red"} Team wins.`);
    return true;
  }
  return false;
}

attackBtn.addEventListener("click", () => {
  if (state.awaitingSharedActor) return;
  state.selectedAction = state.selectedAction === "attack" ? "move" : "attack";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.pendingTransfer = null;
  state.pendingSwap = null;
  state.pendingSummon = null;
  calculateRanges();
  render();
});

skillBtn.addEventListener("click", () => {
  if (state.awaitingSharedActor) return;
  state.abilityMenuOpen = !state.abilityMenuOpen;
  state.pendingTransfer = null;
  if (!state.abilityMenuOpen && state.selectedAction === "skill") {
    state.selectedAction = "move";
    state.selectedAbilityId = null;
  }
  if (!state.abilityMenuOpen) state.pendingSwap = null;
  if (!state.abilityMenuOpen) state.pendingSummon = null;
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
  const targetTag = event.target?.tagName;
  if (event.key.toLowerCase() === "r" && !event.metaKey && !event.ctrlKey && !event.altKey && !["INPUT", "TEXTAREA", "SELECT"].includes(targetTag)) {
    event.preventDefault();
    toggleLogOverlay();
    return;
  }
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
