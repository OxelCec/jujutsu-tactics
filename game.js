const data = window.GameData;
let activeMap = data.maps.placeholder;
let SIZE = activeMap.size;
let LEVELS = activeMap.levels;
const MAX_TURN = 100;
const TEAM_BUDGET = 6;
const INITIATIVE_SCALE = 1;
const DIRECTIONS = ["north", "east", "south", "west"];
const TEST_UNIT_MODEL = "assets/characters/yuji-testeo.jpg";
let initiativeFrameId = null;
let lastInitiativeAt = 0;

const state = {
  units: [],
  currentUnitId: null,
  previewLevel: 0,
  selectedAction: "move",
  selectedAbilityId: null,
  abilityMenuOpen: false,
  inspectedTile: null,
  reachable: new Set(),
  attackable: new Set(),
  abilityTargets: new Set(),
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
const initiativeTrackEl = document.querySelector("#initiativeTrack");
const phaseTextEl = document.querySelector("#phaseText");
const roundTextEl = document.querySelector("#roundText");
const unitCardEl = document.querySelector("#unitCard");
const logEl = document.querySelector("#log");
const attackBtn = document.querySelector("#attackBtn");
const skillBtn = document.querySelector("#skillBtn");
const abilityMenuEl = document.querySelector("#abilityMenu");
const tileInfoEl = document.querySelector("#tileInfo");
const stairsUpBtn = document.querySelector("#stairsUpBtn");
const stairsDownBtn = document.querySelector("#stairsDownBtn");
const endBtn = document.querySelector("#endBtn");
const restartBtn = document.querySelector("#restartBtn");

function battleStatsForCost(cost) {
  return {
    maxHp: 18 + cost * 5,
    speed: 10 + cost,
    attack: 5 + cost,
    defense: 1 + Math.floor(cost / 2),
    mobility: cost >= 5 ? 4 : 3,
    maxCe: 100,
  };
}

function teamCost(team) {
  return setup.teams[team].reduce((total, characterId) => {
    const character = data.characters.find((entry) => entry.id === characterId);
    return total + (character?.cost ?? 0);
  }, 0);
}

function createBattleUnit(character, team, index) {
  const stats = battleStatsForCost(character.cost);
  const spawn = activeMap.spawns[team][index];
  return {
    ...character,
    id: `${team}-${character.id}`,
    characterId: character.id,
    team,
    ...spawn,
    shape: character.model.shape,
    facing: "south",
    directionModels: createDirectionModels(character),
    maxHp: stats.maxHp,
    hp: stats.maxHp,
    speed: stats.speed,
    attack: stats.attack,
    defense: stats.defense,
    mobility: stats.mobility,
    maxCe: stats.maxCe,
    ce: stats.maxCe,
    initiative: 0,
    acted: false,
    moved: false,
  };
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
  state.inspectedTile = null;
  state.reachable.clear();
  state.attackable.clear();
  state.abilityTargets.clear();
  state.round = 1;
  state.turnCount = 0;
  state.gameOver = false;
  state.log = ["Empieza la batalla."];
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
    preview.className = `unit-preview ${character.model.shape} ${isBlue ? "blue-unit" : "red-unit"}`;

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

function currentUnit() {
  return state.units.find((unit) => unit.id === state.currentUnitId);
}

function enemyTeam(team) {
  return team === "blue" ? "red" : "blue";
}

function key(x, y, z) {
  return `${x},${y},${z}`;
}

function unitAt(x, y, z) {
  return livingUnits().find((unit) => unit.x === x && unit.y === y && unit.z === z);
}

function stairAt(x, y, z) {
  return activeMap.stairs.find((stair) => stair.x === x && stair.y === y && stair.levels.includes(z));
}

function getAbility(unit, abilityId = "strike") {
  if (!unit.abilityIds.includes(abilityId)) return null;
  return data.abilities[abilityId];
}

function getAbilities(unit) {
  return unit.abilityIds.map((abilityId) => data.abilities[abilityId]).filter(Boolean);
}

function distance2d(a, x, y) {
  return Math.abs(a.x - x) + Math.abs(a.y - y);
}

function selectedAbility() {
  const unit = currentUnit();
  if (!unit || !state.selectedAbilityId) return null;
  return getAbility(unit, state.selectedAbilityId);
}

function abilityDescription(ability) {
  if (ability.type === "attack") return `Ataque x${ability.attackMultiplier}, ${ability.ceCost} CE`;
  return `Apoyo/utilidad, ${ability.ceCost} CE`;
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

  for (const unit of livingUnits()) {
    unit.initiative = Math.min(MAX_TURN, unit.initiative + unit.speed * elapsed * INITIATIVE_SCALE);
  }

  const ready = livingUnits().filter((unit) => unit.initiative >= MAX_TURN);
  if (ready.length) {
    stopInitiativeClock();
    selectNextTurn(ready);
    return;
  }

  renderInitiative();
  initiativeFrameId = requestAnimationFrame(tickInitiative);
}

function selectNextTurn(ready) {
  ready.sort((a, b) => b.initiative - a.initiative || b.speed - a.speed);
  const next = ready[0];
  next.initiative = 0;
  next.acted = false;
  next.moved = false;
  state.currentUnitId = next.id;
  state.previewLevel = next.z;
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  state.inspectedTile = null;
  state.turnCount += 1;
  state.round = Math.floor((state.turnCount - 1) / livingUnits().length) + 1;
  calculateRanges();
  addLog(`Turno de ${next.name} (${next.team === "blue" ? "Azul" : "Rojo"}).`);
  render();
}

function advanceToNextTurn() {
  if (checkVictory()) {
    render();
    return;
  }

  state.currentUnitId = null;
  state.selectedAction = "move";
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
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
  if (!unit || state.gameOver) return;

  if (!unit.moved) {
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const distance = distance2d(unit, x, y);
        const occupied = unitAt(x, y, unit.z);
        if (distance <= unit.mobility && (!occupied || occupied.id === unit.id)) {
          state.reachable.add(key(x, y, unit.z));
        }
      }
    }
  }

  if (!unit.acted) {
    for (const enemy of livingUnits().filter((target) => target.team !== unit.team && target.z === unit.z)) {
      const distance = distance2d(unit, enemy.x, enemy.y);
      if (distance === 1) state.attackable.add(enemy.id);
    }
  }

  const ability = selectedAbility();
  if (!ability || unit.acted || unit.ce < ability.ceCost) return;

  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      if (distance2d(unit, x, y) > ability.range) continue;
      const occupant = unitAt(x, y, unit.z);
      if (ability.type === "attack" && occupant?.team !== unit.team) {
        state.abilityTargets.add(key(x, y, unit.z));
      }
      if (ability.type !== "attack" && (!occupant || occupant.team === unit.team)) {
        state.abilityTargets.add(key(x, y, unit.z));
      }
    }
  }
}

function render() {
  renderBoardStack();
  renderInitiative();
  renderPanel();
  renderTileInfo();
  renderLog();
}

function renderBoardStack() {
  boardEl.innerHTML = "";
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
  const ability = selectedAbility();
  tile.type = "button";
  tile.className = "tile";
  tile.setAttribute("aria-label", `Casilla ${x + 1}, ${y + 1}, nivel ${z + 1}`);

  if (stairAt(x, y, z)) tile.classList.add("stairs");
  if (state.reachable.has(tileKey)) tile.classList.add("move");
  if (state.abilityTargets.has(tileKey)) tile.classList.add(ability?.type === "attack" ? "skill-attack" : "skill-support");
  if (occupant && state.attackable.has(occupant.id)) tile.classList.add("attack");
  if (unit && unit.x === x && unit.y === y && unit.z === z) tile.classList.add("selected");

  if (occupant) {
    const otherFloorUnit = occupant.z !== state.previewLevel;
    const currentTurnUnit = unit && occupant.id === unit.id;
    tile.append(renderUnit(occupant, `${otherFloorUnit ? "other-floor-unit" : ""} ${currentTurnUnit ? "current-turn-unit" : ""}`));
    const hp = document.createElement("span");
    hp.className = `hp ${otherFloorUnit ? "other-floor-unit" : ""}`;
    hp.innerHTML = `<span style="width:${(occupant.hp / occupant.maxHp) * 100}%"></span>`;
    tile.append(hp);
  }

  tile.addEventListener("click", () => handleTileClick(x, y, z));
  return tile;
}

function renderUnit(unit, extraClass = "") {
  const model = unit.directionModels?.[unit.facing] ?? unit.model;
  const el = document.createElement("span");
  el.className = `unit ${model.shape ?? "image-model"} ${unit.team}-unit ${extraClass}`.trim();
  if (model.image) {
    const image = document.createElement("img");
    image.src = model.image;
    image.alt = unit.name;
    image.draggable = false;
    el.append(image);
  }
  el.title = unit.name;
  return el;
}

function createDirectionModels(character) {
  return Object.fromEntries(DIRECTIONS.map((direction) => [direction, { image: TEST_UNIT_MODEL }]));
}

function portraitUrl(unit) {
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
  const compact = window.matchMedia("(max-width: 980px)").matches;

  for (const unit of livingUnits()) {
    const token = document.createElement("div");
    token.className = `initiative-token ${unit.id === state.currentUnitId ? "current" : ""}`;
    const percent = Math.max(6, Math.min(94, unit.initiative));
    if (compact) {
      token.style.left = `${percent}%`;
      token.style.top = "65px";
    } else {
      token.style.top = `${percent}%`;
    }
    const portrait = document.createElement("img");
    portrait.className = "initiative-portrait";
    portrait.src = portraitUrl(unit);
    portrait.alt = "";
    portrait.draggable = false;

    const name = document.createElement("span");
    name.textContent = unit.name;

    token.append(portrait, name);
    initiativeTrackEl.append(token);
  }
}

function renderPanel() {
  const unit = currentUnit();
  roundTextEl.textContent = `Ronda ${state.round}`;

  if (!unit) {
    phaseTextEl.textContent = state.gameOver ? "Batalla terminada" : "Calculando turno";
    unitCardEl.innerHTML = "";
    abilityMenuEl.classList.add("hidden");
    abilityMenuEl.innerHTML = "";
    return;
  }

  const abilities = getAbilities(unit);
  phaseTextEl.textContent = `${unit.team === "blue" ? "Azul" : "Rojo"} juega con ${unit.name}.`;
  unitCardEl.innerHTML = `
    <h2>${unit.name}</h2>
    <div class="stat-grid">
      <div class="stat"><strong>Equipo</strong>${unit.team === "blue" ? "Azul" : "Rojo"}</div>
      <div class="stat"><strong>Nivel</strong>${unit.z + 1}</div>
      <div class="stat"><strong>Vida</strong>${unit.hp}/${unit.maxHp}</div>
      <div class="stat"><strong>CE</strong>${unit.ce}/${unit.maxCe}</div>
      <div class="stat"><strong>Ataque</strong>${unit.attack}</div>
      <div class="stat"><strong>Defensa</strong>${unit.defense}</div>
      <div class="stat"><strong>Movilidad</strong>${unit.mobility}</div>
      <div class="stat"><strong>Velocidad</strong>${unit.speed}/100</div>
    </div>
    <div class="ability-line">${abilities.length} habilidad${abilities.length === 1 ? "" : "es"} disponible${abilities.length === 1 ? "" : "s"}</div>
  `;

  const onStair = stairAt(unit.x, unit.y, unit.z);
  attackBtn.disabled = state.gameOver || unit.acted || !state.attackable.size;
  attackBtn.classList.toggle("active", state.selectedAction === "attack");
  skillBtn.disabled = state.gameOver || unit.acted || !abilities.length;
  skillBtn.classList.toggle("active", state.abilityMenuOpen);
  stairsUpBtn.disabled = state.gameOver || !onStair || !onStair.levels.includes(unit.z + 1) || Boolean(unitAt(unit.x, unit.y, unit.z + 1));
  stairsDownBtn.disabled = state.gameOver || !onStair || !onStair.levels.includes(unit.z - 1) || Boolean(unitAt(unit.x, unit.y, unit.z - 1));
  endBtn.disabled = state.gameOver;
  renderAbilityMenu(unit, abilities);
}

function renderAbilityMenu(unit, abilities) {
  abilityMenuEl.innerHTML = "";
  abilityMenuEl.classList.toggle("hidden", !state.abilityMenuOpen);
  if (!state.abilityMenuOpen) return;

  for (const ability of abilities) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = state.selectedAbilityId === ability.id ? "active" : "";
    button.disabled = state.gameOver || unit.acted || unit.ce < ability.ceCost;
    button.innerHTML = `<strong>${ability.name}</strong><span>${abilityDescription(ability)}</span>`;
    button.addEventListener("click", () => {
      state.selectedAction = "skill";
      state.selectedAbilityId = ability.id;
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
  const stair = stairAt(x, y, z);
  const tileKind = stair ? "Escalera" : "Suelo";
  const tileState = [
    state.reachable.has(key(x, y, z)) ? "Movimiento posible" : "",
    state.abilityTargets.has(key(x, y, z)) ? "Objetivo de habilidad" : "",
  ].filter(Boolean);

  const title = document.createElement("h3");
  title.textContent = `${tileKind} ${x + 1},${y + 1}, nivel ${z + 1}`;
  tileInfoEl.append(title);

  const meta = document.createElement("p");
  meta.textContent = tileState.length ? tileState.join(" - ") : "Sin marcador activo";
  tileInfoEl.append(meta);

  if (!occupant) {
    const empty = document.createElement("p");
    empty.textContent = "No hay unidad en esta casilla.";
    tileInfoEl.append(empty);
    return;
  }

  const stats = document.createElement("div");
  stats.className = "inspect-grid";
  stats.innerHTML = `
    <div><strong>Unidad</strong>${occupant.name}</div>
    <div><strong>Equipo</strong>${occupant.team === "blue" ? "Azul" : "Rojo"}</div>
    <div><strong>Vida</strong>${occupant.hp}/${occupant.maxHp}</div>
    <div><strong>CE</strong>${occupant.ce}/${occupant.maxCe}</div>
    <div><strong>Ataque</strong>${occupant.attack}</div>
    <div><strong>Defensa</strong>${occupant.defense}</div>
    <div><strong>Movilidad</strong>${occupant.mobility}</div>
    <div><strong>Velocidad</strong>${occupant.speed}</div>
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
  if (!unit || state.gameOver) return;

  state.inspectedTile = { x, y, z };
  const occupant = unitAt(x, y, z);
  const tileKey = key(x, y, z);
  const ability = selectedAbility();

  if (state.selectedAction === "attack" && occupant?.team === enemyTeam(unit.team)) {
    useOffense(occupant);
    return;
  }

  if (state.selectedAction === "skill" && ability && state.abilityTargets.has(tileKey)) {
    if (ability.type === "attack" && occupant?.team === enemyTeam(unit.team)) {
      useOffense(occupant);
      return;
    }
    if (ability.type !== "attack") {
      useSupportAbility(x, y, z);
      return;
    }
  }

  if (!unit.moved && z === unit.z && state.reachable.has(tileKey) && (!occupant || occupant.id === unit.id)) {
    unit.x = x;
    unit.y = y;
    unit.moved = true;
    addLog(`${unit.name} se mueve a ${x + 1},${y + 1} en nivel ${z + 1}.`);
    calculateRanges();
    state.selectedAction = state.attackable.size ? "attack" : "move";
    state.selectedAbilityId = null;
    state.abilityMenuOpen = false;
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

function useOffense(target) {
  const unit = currentUnit();
  if (!unit || unit.acted || !state.attackable.has(target.id)) return;

  let damage = Math.max(1, unit.attack - target.defense);
  let label = "ataque normal";

  if (state.selectedAction === "skill") {
    const ability = getAbility(unit, state.selectedAbilityId);
    if (!ability || unit.ce < ability.ceCost) return;
    unit.ce -= ability.ceCost;
    damage = Math.max(1, Math.floor(unit.attack * ability.attackMultiplier - target.defense));
    label = ability.name;
  }

  target.hp = Math.max(0, target.hp - damage);
  unit.acted = true;
  unit.moved = true;
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  addLog(`${unit.name} usa ${label} contra ${target.name}: ${damage} dano.`);
  if (target.hp === 0) addLog(`${target.name} queda fuera.`);

  if (checkVictory()) {
    render();
    return;
  }

  calculateRanges();
  render();
}

function useSupportAbility(x, y, z) {
  const unit = currentUnit();
  const ability = selectedAbility();
  if (!unit || !ability || unit.acted || unit.ce < ability.ceCost) return;

  unit.ce -= ability.ceCost;
  unit.acted = true;
  unit.moved = true;
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  addLog(`${unit.name} usa ${ability.name} en ${x + 1},${y + 1}, nivel ${z + 1}.`);
  calculateRanges();
  render();
}

function changeLevel(direction) {
  const unit = currentUnit();
  if (!unit || state.gameOver) return;
  const stair = stairAt(unit.x, unit.y, unit.z);
  const nextZ = unit.z + direction;
  if (!stair || !stair.levels.includes(nextZ) || unitAt(unit.x, unit.y, nextZ)) return;

  unit.z = nextZ;
  unit.moved = true;
  state.previewLevel = nextZ;
  state.selectedAbilityId = null;
  state.abilityMenuOpen = false;
  addLog(`${unit.name} cambia al nivel ${nextZ + 1}.`);
  calculateRanges();
  render();
}

function checkVictory() {
  const teams = new Set(livingUnits().map((unit) => unit.team));
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
  calculateRanges();
  render();
});

skillBtn.addEventListener("click", () => {
  state.abilityMenuOpen = !state.abilityMenuOpen;
  if (!state.abilityMenuOpen && state.selectedAction === "skill") {
    state.selectedAction = "move";
    state.selectedAbilityId = null;
  }
  if (!state.abilityMenuOpen) calculateRanges();
  render();
});

stairsUpBtn.addEventListener("click", () => changeLevel(1));
stairsDownBtn.addEventListener("click", () => changeLevel(-1));
endBtn.addEventListener("click", advanceToNextTurn);
restartBtn.addEventListener("click", initBattle);
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
