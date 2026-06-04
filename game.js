const data = window.GameData;
const activeMap = data.maps.placeholder;
const SIZE = activeMap.size;
const LEVELS = activeMap.levels;
const MAX_TURN = 100;

const state = {
  units: [],
  currentUnitId: null,
  visibleLevel: 0,
  selectedAction: "move",
  reachable: new Set(),
  attackable: new Set(),
  round: 1,
  turnCount: 0,
  gameOver: false,
  log: [],
};

const boardEl = document.querySelector("#board");
const levelTabsEl = document.querySelector("#levelTabs");
const initiativeTrackEl = document.querySelector("#initiativeTrack");
const phaseTextEl = document.querySelector("#phaseText");
const roundTextEl = document.querySelector("#roundText");
const unitCardEl = document.querySelector("#unitCard");
const logEl = document.querySelector("#log");
const attackBtn = document.querySelector("#attackBtn");
const skillBtn = document.querySelector("#skillBtn");
const stairsUpBtn = document.querySelector("#stairsUpBtn");
const stairsDownBtn = document.querySelector("#stairsDownBtn");
const endBtn = document.querySelector("#endBtn");
const restartBtn = document.querySelector("#restartBtn");

function init() {
  state.units = data.characters.map((character) => {
    const stats = data.statistics[character.statsId];
    const spawn = activeMap.spawns[character.id];
    return {
      ...character,
      ...spawn,
      shape: character.model.shape,
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
  });
  state.currentUnitId = null;
  state.visibleLevel = 0;
  state.selectedAction = "move";
  state.reachable.clear();
  state.attackable.clear();
  state.round = 1;
  state.turnCount = 0;
  state.gameOver = false;
  state.log = ["Empieza la batalla."];
  advanceToNextTurn();
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

function addLog(text) {
  state.log.unshift(text);
  state.log = state.log.slice(0, 12);
}

function advanceToNextTurn() {
  if (checkVictory()) {
    render();
    return;
  }

  state.currentUnitId = null;
  state.reachable.clear();
  state.attackable.clear();

  let ready = livingUnits().filter((unit) => unit.initiative >= MAX_TURN);
  while (!ready.length) {
    for (const unit of livingUnits()) {
      unit.initiative = Math.min(MAX_TURN, unit.initiative + unit.speed);
    }
    ready = livingUnits().filter((unit) => unit.initiative >= MAX_TURN);
  }

  ready.sort((a, b) => b.initiative - a.initiative || b.speed - a.speed);
  const next = ready[0];
  next.initiative = 0;
  next.acted = false;
  next.moved = false;
  state.currentUnitId = next.id;
  state.visibleLevel = next.z;
  state.selectedAction = "move";
  state.turnCount += 1;
  state.round = Math.floor((state.turnCount - 1) / livingUnits().length) + 1;
  calculateRanges();
  addLog(`Turno de ${next.name} (${next.team === "blue" ? "Azul" : "Rojo"}).`);
  render();
}

function calculateRanges() {
  const unit = currentUnit();
  state.reachable.clear();
  state.attackable.clear();
  if (!unit || state.gameOver) return;

  if (!unit.moved) {
    for (let y = 0; y < SIZE; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const distance = Math.abs(unit.x - x) + Math.abs(unit.y - y);
        const occupied = unitAt(x, y, unit.z);
        if (distance <= unit.mobility && (!occupied || occupied.id === unit.id)) {
          state.reachable.add(key(x, y, unit.z));
        }
      }
    }
  }

  for (const enemy of livingUnits().filter((target) => target.team !== unit.team && target.z === unit.z)) {
    const distance = Math.abs(unit.x - enemy.x) + Math.abs(unit.y - enemy.y);
    if (distance === 1) state.attackable.add(enemy.id);
  }
}

function render() {
  renderLevels();
  renderBoardStack();
  renderInitiative();
  renderPanel();
  renderLog();
}

function renderLevels() {
  levelTabsEl.innerHTML = "";
  for (let z = 0; z < LEVELS; z += 1) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `Nivel ${z + 1}`;
    button.className = z === state.visibleLevel ? "active" : "";
    button.addEventListener("click", () => {
      state.visibleLevel = z;
      render();
    });
    levelTabsEl.append(button);
  }
}

function renderBoardStack() {
  boardEl.innerHTML = "";
  for (let z = 0; z < LEVELS; z += 1) {
    const level = document.createElement("div");
    level.className = `level-board level-${z} ${z === state.visibleLevel ? "focus-level" : ""}`;
    level.style.setProperty("--level-index", z);
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
  tile.type = "button";
  tile.className = "tile";
  tile.setAttribute("aria-label", `Casilla ${x + 1}, ${y + 1}, nivel ${z + 1}`);

  if (stairAt(x, y, z)) tile.classList.add("stairs");
  if (state.reachable.has(tileKey)) tile.classList.add("move");
  if (occupant && state.attackable.has(occupant.id)) tile.classList.add("attack");
  if (unit && unit.x === x && unit.y === y && unit.z === z) tile.classList.add("selected");

  if (occupant) {
    tile.append(renderUnit(occupant));
    const hp = document.createElement("span");
    hp.className = "hp";
    hp.innerHTML = `<span style="width:${(occupant.hp / occupant.maxHp) * 100}%"></span>`;
    tile.append(hp);
  }

  tile.addEventListener("click", () => handleTileClick(x, y, z));
  return tile;
}

function renderUnit(unit) {
  const el = document.createElement("span");
  el.className = `unit ${unit.shape} ${unit.team}-unit`;
  el.title = unit.name;
  return el;
}

function renderInitiative() {
  initiativeTrackEl.innerHTML = '<span class="ready-line"></span>';
  const compact = window.matchMedia("(max-width: 980px)").matches;

  for (const unit of livingUnits()) {
    const token = document.createElement("div");
    token.className = `initiative-token ${unit.id === state.currentUnitId ? "current" : ""}`;
    const percent = Math.max(6, Math.min(94, unit.initiative));
    if (compact) {
      token.style.left = `${percent}%`;
      token.style.top = "65px";
    } else {
      token.style.top = `${100 - percent}%`;
    }
    token.innerHTML = `<span class="mini-shape ${unit.shape} ${unit.team}-unit"></span><span>${unit.name}</span>`;
    initiativeTrackEl.append(token);
  }
}

function renderPanel() {
  const unit = currentUnit();
  roundTextEl.textContent = `Ronda ${state.round}`;

  if (!unit) {
    phaseTextEl.textContent = state.gameOver ? "Batalla terminada" : "Calculando turno";
    unitCardEl.innerHTML = "";
    return;
  }

  const strike = getAbility(unit);
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
    <div class="ability-line">${strike.name}: x${strike.attackMultiplier} ataque, ${strike.ceCost} CE</div>
  `;

  const onStair = stairAt(unit.x, unit.y, unit.z);
  attackBtn.disabled = state.gameOver || unit.acted || !state.attackable.size;
  attackBtn.classList.toggle("active", state.selectedAction === "attack");
  skillBtn.disabled = state.gameOver || unit.acted || unit.ce < strike.ceCost || !state.attackable.size;
  skillBtn.classList.toggle("active", state.selectedAction === "skill");
  stairsUpBtn.disabled = state.gameOver || !onStair || !onStair.levels.includes(unit.z + 1) || Boolean(unitAt(unit.x, unit.y, unit.z + 1));
  stairsDownBtn.disabled = state.gameOver || !onStair || !onStair.levels.includes(unit.z - 1) || Boolean(unitAt(unit.x, unit.y, unit.z - 1));
  endBtn.disabled = state.gameOver;
}

function renderLog() {
  logEl.innerHTML = "";
  for (const entry of state.log) {
    const li = document.createElement("li");
    li.textContent = entry;
    logEl.append(li);
  }
}

function handleTileClick(x, y, z) {
  const unit = currentUnit();
  if (!unit || state.gameOver) return;

  const occupant = unitAt(x, y, z);
  if ((state.selectedAction === "attack" || state.selectedAction === "skill") && occupant?.team === enemyTeam(unit.team)) {
    useOffense(occupant, state.selectedAction);
    return;
  }

  const tileKey = key(x, y, z);
  if (!unit.moved && z === unit.z && state.reachable.has(tileKey) && (!occupant || occupant.id === unit.id)) {
    unit.x = x;
    unit.y = y;
    unit.moved = true;
    state.visibleLevel = z;
    addLog(`${unit.name} se mueve a ${x + 1},${y + 1} en nivel ${z + 1}.`);
    calculateRanges();
    state.selectedAction = state.attackable.size ? "attack" : "move";
    render();
  }
}

function useOffense(target, action) {
  const unit = currentUnit();
  if (!unit || unit.acted || !state.attackable.has(target.id)) return;

  let damage = Math.max(1, unit.attack - target.defense);
  let label = "ataque normal";

  if (action === "skill") {
    const ability = getAbility(unit);
    if (!ability || unit.ce < ability.ceCost) return;
    unit.ce -= ability.ceCost;
    damage = Math.max(1, Math.floor(unit.attack * ability.attackMultiplier - target.defense));
    label = ability.name;
  }

  target.hp = Math.max(0, target.hp - damage);
  unit.acted = true;
  addLog(`${unit.name} usa ${label} contra ${target.name}: ${damage} dano.`);
  if (target.hp === 0) addLog(`${target.name} queda fuera.`);

  if (checkVictory()) {
    render();
    return;
  }

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
  state.visibleLevel = nextZ;
  addLog(`${unit.name} cambia al nivel ${nextZ + 1}.`);
  calculateRanges();
  render();
}

function checkVictory() {
  const teams = new Set(livingUnits().map((unit) => unit.team));
  if (teams.size === 1) {
    const winner = [...teams][0];
    state.gameOver = true;
    state.currentUnitId = null;
    addLog(`Victoria del equipo ${winner === "blue" ? "Azul" : "Rojo"}.`);
    return true;
  }
  return false;
}

attackBtn.addEventListener("click", () => {
  state.selectedAction = state.selectedAction === "attack" ? "move" : "attack";
  render();
});

skillBtn.addEventListener("click", () => {
  state.selectedAction = state.selectedAction === "skill" ? "move" : "skill";
  render();
});

stairsUpBtn.addEventListener("click", () => changeLevel(1));
stairsDownBtn.addEventListener("click", () => changeLevel(-1));
endBtn.addEventListener("click", advanceToNextTurn);
restartBtn.addEventListener("click", init);

init();
