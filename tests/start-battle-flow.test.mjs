import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadGame() {
  const html = await readFile(path.join(rootDir, "index.html"), "utf8");
  const virtualConsole = new VirtualConsole();
  const consoleErrors = [];
  virtualConsole.on("jsdomError", (error) => consoleErrors.push(error));
  virtualConsole.on("error", (error) => consoleErrors.push(error));

  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: "outside-only",
    url: "http://localhost:5173/",
    virtualConsole,
  });
  dom.window.addEventListener("error", (event) => consoleErrors.push(event.error ?? event.message));

  dom.window.matchMedia = () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  });

  const scripts = [...dom.window.document.querySelectorAll("script[src]")];
  for (const script of scripts) {
    const scriptSrc = new URL(script.getAttribute("src"), "http://localhost:5173/").pathname;
    const scriptPath = path.join(rootDir, scriptSrc);
    const source = await readFile(scriptPath, "utf8");
    dom.window.eval(`${source}\n//# sourceURL=${scriptPath}`);
  }

  assert.deepEqual(consoleErrors, []);
  return dom;
}

function clickButton(document, text) {
  const button = [...document.querySelectorAll("button")].find((entry) =>
    entry.textContent.trim().includes(text),
  );
  assert.ok(button, `Expected button containing "${text}"`);
  assert.equal(button.disabled, false, `Expected "${text}" button to be enabled`);
  button.click();
}

function clickRosterCard(document, characterName) {
  const card = [...document.querySelectorAll(".roster-card")].find((entry) =>
    entry.textContent.includes(characterName),
  );
  assert.ok(card, `Expected roster card for ${characterName}`);
  assert.equal(card.disabled, false, `Expected ${characterName} to be selectable`);
  card.click();
}

function clickAbility(document, abilityName) {
  const button = [...document.querySelectorAll("#abilityMenu button")].find((entry) =>
    entry.textContent.includes(abilityName),
  );
  assert.ok(button, `Expected ability button for ${abilityName}`);
  assert.equal(button.disabled, false, `Expected ${abilityName} to be usable`);
  button.click();
}

test("can select both teams, choose the map, and start a battle", async () => {
  const dom = await loadGame();
  const { document } = dom.window;

  assert.equal(document.querySelector("#setupTitle").textContent, "Jujutsu Tactics");
  clickButton(document, "Wiki");
  assert.match(document.querySelector(".wiki-tree").textContent, /Characters/);
  assert.match(document.querySelector(".wiki-tree").textContent, /Maps/);
  assert.match(document.querySelector(".wiki-tree").textContent, /Misc/);
  clickButton(document, "Maps");
  assert.match(document.querySelector(".wiki-content h3").textContent, /Maps/);
  clickButton(document, "Back");

  clickButton(document, "Start Game");
  clickRosterCard(document, "Miwa");
  clickRosterCard(document, "Yuji");
  clickButton(document, "Red Team");

  clickRosterCard(document, "Miwa");
  clickRosterCard(document, "Choso");
  clickButton(document, "Choose Map");

  clickButton(document, "Edificio destruido");
  clickButton(document, "Start Battle");

  assert.equal(document.querySelector("#setupScreen").classList.contains("hidden"), true);
  assert.equal(document.querySelector("#battlefield").classList.contains("hidden"), false);
  assert.equal(document.querySelectorAll(".level-board").length, 3);
  assert.equal(document.querySelectorAll(".tile").length, 300);
  assert.equal(document.querySelectorAll(".unit").length, 4);
  assert.equal(document.querySelectorAll(".unit.image-model").length, 4);
  assert.match(document.querySelector("#teamList").innerHTML, /yuji-itadori\.png/);
  assert.match(document.querySelector("#teamList").innerHTML, /miwa\.png/);
  assert.match(document.querySelector("#teamList").innerHTML, /choso\.png/);
  assert.equal(document.querySelectorAll(".unit.blue-unit").length, 2);
  assert.equal(document.querySelectorAll(".unit.red-unit").length, 2);
  assert.equal(document.querySelectorAll(".terrain-object").length, 5);
  assert.equal(document.querySelectorAll(".terrain-object.pillar").length, 2);
  assert.equal(document.querySelectorAll(".terrain-hp").length, 0);
  assert.equal(document.querySelectorAll(".tile.hole").length, 2);
  assert.equal(document.querySelectorAll(".finger-token").length, 7);
  assert.match(document.querySelector("#teamList").textContent, /Red Team/);
  assert.match(document.querySelector("#teamList").textContent, /Blue Team/);
  assert.equal(document.querySelectorAll(".team-unit-button").length, 4);
  assert.equal(document.querySelector(".roster-panel #log"), null);
  assert.ok(document.querySelector(".roster-panel #tileInfo"));

  const chosoButton = [...document.querySelectorAll(".team-unit-button")].find((button) =>
    button.textContent.includes("Choso"),
  );
  assert.ok(chosoButton, "Expected Choso in the team list");
  chosoButton.click();
  assert.equal(document.querySelector("#unitCard h2").textContent, "Choso");
  assert.equal(document.querySelector(".roster-panel #tileInfo").classList.contains("hidden"), false);
  assert.match(document.querySelector("#unitCard").textContent, /available techniques/);
  assert.doesNotMatch(document.querySelector("#unitCard").textContent, /SPD\d+\/100/);
  assert.match(document.querySelector("#log").textContent, /The battle begins/);
  assert.equal(document.querySelector("#logOverlay").classList.contains("hidden"), true);
  dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "r" }));
  assert.equal(document.querySelector("#logOverlay").classList.contains("hidden"), false);
  dom.window.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "r" }));
  assert.equal(document.querySelector("#logOverlay").classList.contains("hidden"), true);

  dom.window.close();
});

test("map terrain blocks movement, can be destroyed, and holes allow one-way descent", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  startMiwaMirrorBattle(document);

  dom.window.eval(`
    stopInitiativeClock();
    const miwa = livingUnits().find((unit) => unit.team === "blue");
    selectNextTurn([miwa]);
    miwa.x = 3;
    miwa.y = 4;
    miwa.z = 1;
    calculateRanges();
  `);

  assert.equal(dom.window.eval('terrainObjectAt(4, 4, 1).type'), "cube");
  assert.equal(dom.window.eval('Boolean(solidTerrainAt(4, 4, 1))'), true);
  assert.equal(document.querySelectorAll(".terrain-object").length, 5);

  dom.window.eval("handleTileClick(4, 4, 1)");
  assert.equal(dom.window.eval("currentUnit().x"), 3);
  assert.equal(dom.window.eval("currentUnit().y"), 4);
  dom.window.eval("handleTileClick(5, 4, 1)");
  assert.equal(dom.window.eval("currentUnit().x"), 3);
  assert.equal(dom.window.eval("currentUnit().y"), 4);
  dom.window.eval("handleTileClick(3, 3, 1)");
  assert.equal(dom.window.eval("currentUnit().x"), 3);
  assert.equal(dom.window.eval("currentUnit().y"), 4);

  dom.window.eval(`
    for (let hit = 0; hit < 3; hit += 1) {
      const cube = terrainObjectAt(4, 4, 1);
      currentUnit().acted = false;
      currentUnit().moved = false;
      calculateRanges();
      useOffense(cube);
    }
    currentUnit().acted = false;
    currentUnit().moved = false;
    calculateRanges();
    handleTileClick(4, 4, 1);
  `);
  assert.equal(dom.window.eval("terrainObjectAt(4, 4, 1)"), undefined);
  assert.equal(dom.window.eval("currentUnit().x"), 4);
  assert.equal(dom.window.eval("currentUnit().y"), 4);

  dom.window.eval(`
    const miwa = currentUnit();
    miwa.x = 3;
    miwa.y = 2;
    miwa.z = 1;
    miwa.moved = false;
    calculateRanges();
    changeLevel(-1);
  `);
  assert.equal(dom.window.eval("currentUnit().x"), 3);
  assert.equal(dom.window.eval("currentUnit().y"), 3);
  assert.equal(dom.window.eval("currentUnit().z"), 0);
  assert.equal(dom.window.eval("canChangeLevel(currentUnit(), 1)"), false);

  dom.window.eval(`
    const miwa = currentUnit();
    miwa.x = 3;
    miwa.y = 3;
    miwa.z = 1;
    settleUnitPosition(miwa);
  `);
  assert.equal(dom.window.eval("currentUnit().z"), 0);

  dom.window.eval(`
    const miwa = currentUnit();
    miwa.statuses.push("flying");
    miwa.x = 3;
    miwa.y = 3;
    miwa.z = 0;
    miwa.moved = false;
    calculateRanges();
  `);
  assert.equal(dom.window.eval("canChangeLevel(currentUnit(), 1)"), true);
  dom.window.eval("changeLevel(1)");
  assert.equal(dom.window.eval("currentUnit().z"), 1);
  assert.equal(dom.window.eval("currentUnit().x"), 3);
  assert.equal(dom.window.eval("currentUnit().y"), 3);
  dom.window.eval("currentUnit().moved = false; calculateRanges(); changeLevel(-1);");
  assert.equal(dom.window.eval("currentUnit().z"), 0);

  dom.window.eval(`
    const miwa = currentUnit();
    miwa.x = 2;
    miwa.y = 5;
    miwa.z = 0;
    const pillar = terrainObjectAt(3, 5, 0);
    performAttack(miwa, pillar, "test attack", { attackMultiplier: 10, triggersCounterattack: false });
  `);
  assert.equal(dom.window.eval("terrainObjectAt(3, 5, 0)"), undefined);
  assert.equal(dom.window.eval("Boolean(holeAt(3, 5, 1))"), true);

  dom.window.close();
});

test("current unit stays at the end of the initiative bar", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  startMiwaMirrorBattle(document);

  dom.window.eval(`
    stopInitiativeClock();
    selectNextTurn([livingUnits().find((unit) => unit.team === "blue")]);
  `);

  assert.equal(document.querySelector(".initiative-token.current").style.left, "94%");

  dom.window.close();
});

test("board background supports pan and zoom without changing battle flow", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  startMiwaMirrorBattle(document);

  const board = document.querySelector("#board");
  const tile = document.querySelector(".tile");
  assert.match(board.getAttribute("style"), /scale\(1\)/);

  dom.window.dispatchEvent(new dom.window.WheelEvent("wheel", { deltaY: -100, clientX: 0, clientY: 0, bubbles: true, cancelable: true }));
  assert.match(board.getAttribute("style"), /scale\(1\.08\)/);

  board.dispatchEvent(new dom.window.MouseEvent("mousedown", { button: 0, clientX: 100, clientY: 100, bubbles: true, cancelable: true }));
  dom.window.dispatchEvent(new dom.window.MouseEvent("mousemove", { clientX: 130, clientY: 118, bubbles: true }));
  dom.window.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true }));
  assert.match(board.getAttribute("style"), /translate\([^,]*30px, [^)]*18px\)/);

  tile.dispatchEvent(new dom.window.MouseEvent("mousedown", { button: 0, clientX: 100, clientY: 100, bubbles: true, cancelable: true }));
  dom.window.dispatchEvent(new dom.window.MouseEvent("mousemove", { clientX: 160, clientY: 160, bubbles: true }));
  dom.window.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true }));
  assert.doesNotMatch(board.getAttribute("style"), /translate\([^,]*90px, [^)]*78px\)/);

  dom.window.close();
});

test("initiative bar can be dragged independently from the board", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  startMiwaMirrorBattle(document);

  const board = document.querySelector("#board");
  const track = document.querySelector("#initiativeTrack");
  const initialBoardTransform = board.getAttribute("style");

  track.dispatchEvent(new dom.window.MouseEvent("mousedown", { button: 0, clientX: 200, clientY: 500, bubbles: true, cancelable: true }));
  dom.window.dispatchEvent(new dom.window.MouseEvent("mousemove", { clientX: 245, clientY: 488, bubbles: true }));
  dom.window.dispatchEvent(new dom.window.MouseEvent("mouseup", { bubbles: true }));

  assert.match(track.getAttribute("style"), /translate\(45px, -12px\)/);
  assert.equal(board.getAttribute("style"), initialBoardTransform);

  dom.window.close();
});

test("Sukuna Fingers only spawn when Yuji is selected, and only seven spawn with two Yujis", async () => {
  const noYujiDom = await loadGame();
  const noYujiDocument = noYujiDom.window.document;

  clickButton(noYujiDocument, "Start Game");
  clickRosterCard(noYujiDocument, "Miwa");
  clickButton(noYujiDocument, "Red Team");
  clickRosterCard(noYujiDocument, "Choso");
  clickButton(noYujiDocument, "Choose Map");
  clickButton(noYujiDocument, "Start Battle");
  noYujiDom.window.eval('stopInitiativeClock(); selectNextTurn([livingUnits().find((unit) => unit.team === "blue")]);');

  assert.equal(noYujiDocument.querySelectorAll(".finger-token").length, 0);
  assert.doesNotMatch(noYujiDocument.querySelector("#teamList").textContent, /fingers|consumed|given/i);
  assert.doesNotMatch(noYujiDocument.querySelector("#unitCard").textContent, /Fingers|Given|Consumed/);
  assert.equal(noYujiDocument.querySelector("#specialBtn").classList.contains("hidden"), true);
  noYujiDom.window.close();

  const twoYujiDom = await loadGame();
  const twoYujiDocument = twoYujiDom.window.document;

  clickButton(twoYujiDocument, "Start Game");
  clickRosterCard(twoYujiDocument, "Yuji");
  clickButton(twoYujiDocument, "Red Team");
  clickRosterCard(twoYujiDocument, "Yuji");
  clickButton(twoYujiDocument, "Choose Map");
  clickButton(twoYujiDocument, "Start Battle");

  assert.equal(twoYujiDocument.querySelectorAll(".finger-token").length, 7);
  twoYujiDom.window.close();
});

test("defeated units remain on the board and block movement", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  startMiwaMirrorBattle(document);

  dom.window.eval(`
    stopInitiativeClock();
    const blue = livingUnits().find((unit) => unit.team === "blue");
    const red = livingUnits().find((unit) => unit.team === "red");
    selectNextTurn([blue]);
    red.x = blue.x + 1;
    red.y = blue.y;
    red.z = blue.z;
    performAttack(blue, red, "basic attack", { attackMultiplier: 10, triggersCounterattack: false });
    calculateRanges();
    handleTileClick(red.x, red.y, red.z);
  `);

  assert.equal(dom.window.eval('unitAt(2, 1, 1).hp'), 0);
  assert.equal(dom.window.eval('livingUnitAt(2, 1, 1)'), undefined);
  assert.equal(dom.window.eval("currentUnit().x"), 1);
  assert.ok(document.querySelector(".unit.dead-unit"), "Expected defeated unit model to remain rendered");

  dom.window.close();
});

function startMiwaMirrorBattle(document) {
  clickButton(document, "Start Game");
  clickRosterCard(document, "Miwa");
  clickButton(document, "Red Team");
  clickRosterCard(document, "Miwa");
  clickButton(document, "Choose Map");
  clickButton(document, "Start Battle");
}

function startTojiVsMiwaBattle(document) {
  clickButton(document, "Start Game");
  clickRosterCard(document, "Toji");
  clickButton(document, "Red Team");
  clickRosterCard(document, "Miwa");
  clickButton(document, "Choose Map");
  clickButton(document, "Start Battle");
}

function startTodoControlBattle(document) {
  clickButton(document, "Start Game");
  clickRosterCard(document, "Aoi Todo");
  clickRosterCard(document, "Miwa");
  clickButton(document, "Red Team");
  clickRosterCard(document, "Choso");
  clickButton(document, "Choose Map");
  clickButton(document, "Start Battle");
}

function startMahitoVsChosoBattle(document) {
  clickButton(document, "Start Game");
  clickRosterCard(document, "Mahito");
  clickButton(document, "Red Team");
  clickRosterCard(document, "Choso");
  clickButton(document, "Choose Map");
  clickButton(document, "Start Battle");
}

function startMegumiVsChosoBattle(document) {
  clickButton(document, "Start Game");
  clickRosterCard(document, "Megumi");
  clickButton(document, "Red Team");
  clickRosterCard(document, "Choso");
  clickButton(document, "Choose Map");
  clickButton(document, "Start Battle");
}

test("Aoi Todo has controller stats and swaps units with Boogie Woogie", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  startTodoControlBattle(document);

  dom.window.eval(`
    stopInitiativeClock();
    const todo = livingUnits().find((unit) => unit.characterId === "todo");
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    selectNextTurn([todo]);
    todo.x = 1;
    todo.y = 1;
    todo.z = 1;
    choso.x = 3;
    choso.y = 1;
    choso.z = 1;
    calculateRanges();
  `);

  assert.deepEqual(JSON.parse(dom.window.eval(`JSON.stringify((() => {
    const todo = currentUnit();
    return {
      maxHp: todo.maxHp,
      attack: todo.attack,
      defense: todo.defense,
      speed: todo.speed,
      maxCe: todo.maxCe,
    };
  })())`)), {
    maxHp: 84,
    attack: 16,
    defense: 7,
    speed: 16,
    maxCe: 100,
  });
  assert.match(document.querySelector("#unitCard").textContent, /Boogie Woogie/);
  assert.match(document.querySelector("#unitCard").textContent, /Forced Swap/);

  document.querySelector("#skillBtn").click();
  clickAbility(document, "Boogie Woogie");
  dom.window.eval("handleTileClick(3, 1, 1)");

  assert.equal(dom.window.eval("currentUnit().x"), 3);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "choso").x'), 1);
  assert.equal(dom.window.eval("currentUnit().ce"), 80);
  assert.equal(dom.window.eval('abilityCooldown(currentUnit(), "boogieWoogie")'), 5);
  assert.equal(dom.window.eval("currentUnit().acted"), true);

  dom.window.eval(`
    const todo = currentUnit();
    const miwa = livingUnits().find((unit) => unit.characterId === "miwa");
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    todo.x = 1;
    todo.y = 1;
    todo.z = 1;
    todo.ce = 100;
    todo.acted = false;
    todo.moved = false;
    todo.abilityCooldowns = {};
    miwa.x = 2;
    miwa.y = 1;
    miwa.z = 1;
    choso.x = 4;
    choso.y = 1;
    choso.z = 1;
    calculateRanges();
    render();
  `);
  document.querySelector("#skillBtn").click();
  clickAbility(document, "Forced Swap");
  dom.window.eval("handleTileClick(2, 1, 1)");

  assert.equal(dom.window.eval("currentUnit().acted"), false);
  assert.equal(dom.window.eval("currentUnit().ce"), 100);
  assert.match(document.querySelector("#log").textContent, /choose another unit/);

  dom.window.eval("handleTileClick(4, 1, 1)");

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "miwa").x'), 4);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "choso").x'), 2);
  assert.equal(dom.window.eval("currentUnit().x"), 1);
  assert.equal(dom.window.eval("currentUnit().ce"), 65);
  assert.equal(dom.window.eval('abilityCooldown(currentUnit(), "forcedSwap")'), 5);
  assert.equal(dom.window.eval("currentUnit().acted"), true);

  dom.window.close();
});

test("Mahito drains CE, marks targets, and executes with Soul Touch", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  startMahitoVsChosoBattle(document);

  dom.window.eval(`
    stopInitiativeClock();
    const mahito = livingUnits().find((unit) => unit.characterId === "mahito");
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    selectNextTurn([mahito]);
    mahito.x = 1;
    mahito.y = 1;
    mahito.z = 1;
    choso.x = 2;
    choso.y = 1;
    choso.z = 1;
    calculateRanges();
  `);

  assert.deepEqual(JSON.parse(dom.window.eval(`JSON.stringify((() => {
    const mahito = currentUnit();
    return {
      maxHp: mahito.maxHp,
      attack: mahito.attack,
      defense: mahito.defense,
      speed: mahito.speed,
      maxCe: mahito.maxCe,
      passive: getPassive(mahito).id,
    };
  })())`)), {
    maxHp: 102,
    attack: 16,
    defense: 8,
    speed: 16,
    maxCe: 100,
    passive: "blackFlashPotential",
  });

  document.querySelector("#skillBtn").click();
  clickAbility(document, "Soul Touch");
  dom.window.eval("handleTileClick(2, 1, 1)");

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "choso").ce'), 70);
  assert.equal(dom.window.eval("currentUnit().ce"), 55);
  assert.equal(dom.window.eval("currentUnit().acted"), true);

  dom.window.eval(`
    const mahito = currentUnit();
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    mahito.ce = 100;
    mahito.acted = false;
    mahito.moved = false;
    choso.ce = 100;
    choso.x = mahito.x + 3;
    choso.y = mahito.y;
    choso.z = mahito.z;
    calculateRanges();
    render();
  `);
  document.querySelector("#skillBtn").click();
  clickAbility(document, "Idle Transfiguration");
  dom.window.eval("handleTileClick(4, 1, 1)");

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "choso").idleTransfigurationTurns'), 2);
  assert.equal(dom.window.eval("currentUnit().ce"), 75);

  dom.window.eval(`
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    selectNextTurn([choso]);
  `);

  assert.equal(dom.window.eval("currentUnit().ce"), 90);
  assert.equal(dom.window.eval("currentUnit().idleTransfigurationTurns"), 1);

  dom.window.eval(`
    const mahito = livingUnits().find((unit) => unit.characterId === "mahito");
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    selectNextTurn([mahito]);
    mahito.ce = 100;
    choso.ce = 35;
    choso.x = mahito.x + 1;
    choso.y = mahito.y;
    choso.z = mahito.z;
    calculateRanges();
    render();
  `);
  document.querySelector("#skillBtn").click();
  clickAbility(document, "Soul Touch");
  dom.window.eval("handleTileClick(2, 1, 1)");

  assert.equal(dom.window.eval('unitAt(2, 1, 1).hp'), 0);
  assert.match(document.querySelector("#log").textContent, /executes/);

  dom.window.close();
});

test("Megumi reserves CE for Divine Dogs and shares his turn with summons", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  startMegumiVsChosoBattle(document);

  dom.window.eval(`
    stopInitiativeClock();
    const megumi = livingUnits().find((unit) => unit.characterId === "megumi");
    selectNextTurn([megumi]);
  `);

  assert.deepEqual(JSON.parse(dom.window.eval(`JSON.stringify((() => {
    const megumi = currentUnit();
    return {
      maxHp: megumi.maxHp,
      attack: megumi.attack,
      defense: megumi.defense,
      speed: megumi.speed,
      maxCe: megumi.maxCe,
      damageType: megumi.damageType,
    };
  })())`)), {
    maxHp: 78,
    attack: 16,
    defense: 8,
    speed: 18,
    maxCe: 150,
    damageType: "strike",
  });

  dom.window.eval(`
    const megumi = currentUnit();
    megumi.x = 1;
    megumi.y = 1;
    megumi.z = 1;
    calculateRanges();
  `);
  document.querySelector("#skillBtn").click();
  clickAbility(document, "Divine Dogs");
  dom.window.eval("handleTileClick(2, 1, 1)");

  assert.equal(dom.window.eval("activeSummonsFor(currentUnit()).length"), 0);
  assert.equal(dom.window.eval("currentUnit().acted"), false);
  assert.ok(document.querySelectorAll(".tile.skill-support").length > 0);

  dom.window.eval("handleTileClick(1, 2, 1)");

  assert.equal(dom.window.eval("currentUnit().maxCe"), 90);
  assert.equal(dom.window.eval("currentUnit().ce"), 90);
  assert.equal(dom.window.eval("activeSummonsFor(currentUnit()).length"), 2);
  assert.equal(dom.window.eval("turnEligibleUnits().some((unit) => unit.summonKind === 'divineDog')"), false);

  dom.window.eval(`
    const megumi = currentUnit();
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    const dogs = activeSummonsFor(megumi);
    selectNextTurn([megumi]);
    choso.hp = 100;
    dogs[0].x = 1;
    dogs[0].y = 2;
    dogs[0].z = 1;
    dogs[1].x = 1;
    dogs[1].y = 3;
    dogs[1].z = 1;
    choso.x = 2;
    choso.y = 2;
    choso.z = 1;
    calculateRanges();
    handleTileClick(dogs[0].x, dogs[0].y, dogs[0].z);
    useOffense(choso);
  `);

  assert.equal(dom.window.eval("currentUnit().ce"), 20);
  assert.equal(dom.window.eval("currentUnit().damageType"), "slashing");
  assert.ok(document.querySelectorAll(".tile.shared-actor-target").length > 0);

  dom.window.eval(`
    const megumi = turnController();
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    const secondDog = activeSummonsFor(megumi).find((unit) => !unit.acted);
    secondDog.x = 2;
    secondDog.y = 3;
    secondDog.z = 1;
    choso.x = 2;
    choso.y = 2;
    choso.z = 1;
    calculateRanges();
    handleTileClick(secondDog.x, secondDog.y, secondDog.z);
    useOffense(choso);
  `);

  assert.equal(dom.window.eval("currentUnit().ce"), 20);
  assert.equal(dom.window.eval("turnController().id.includes('megumi')"), true);

  dom.window.close();
});

test("Megumi summons Nue on a chosen free tile and Lightning Strike hits around the target", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  startMegumiVsChosoBattle(document);

  dom.window.eval(`
    stopInitiativeClock();
    const megumi = livingUnits().find((unit) => unit.characterId === "megumi");
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    selectNextTurn([megumi]);
    megumi.x = 1;
    megumi.y = 1;
    megumi.z = 1;
    choso.x = 3;
    choso.y = 1;
    choso.z = 1;
    calculateRanges();
  `);

  document.querySelector("#skillBtn").click();
  clickAbility(document, "Nue");
  dom.window.eval("handleTileClick(3, 1, 1)");

  assert.equal(dom.window.eval("activeSummonsFor(currentUnit()).length"), 0);
  assert.equal(dom.window.eval("currentUnit().acted"), false);

  dom.window.eval("handleTileClick(3, 2, 1)");

  assert.deepEqual(JSON.parse(dom.window.eval(`JSON.stringify((() => {
    const megumi = currentUnit();
    const nue = activeSummonsFor(megumi).find((unit) => unit.summonKind === "nue");
    return {
      megumiMaxCe: megumi.maxCe,
      megumiCe: megumi.ce,
      nueX: nue.x,
      nueY: nue.y,
      nueZ: nue.z,
      nueAttack: nue.attack,
      flying: nue.statuses.includes("flying"),
    };
  })())`)), {
    megumiMaxCe: 130,
    megumiCe: 130,
    nueX: 3,
    nueY: 2,
    nueZ: 1,
    nueAttack: 16,
    flying: true,
  });

  dom.window.eval(`
    const megumi = currentUnit();
    const nue = activeSummonsFor(megumi).find((unit) => unit.summonKind === "nue");
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    selectNextTurn([megumi]);
    nue.x = 2;
    nue.y = 1;
    nue.z = 1;
    megumi.x = 4;
    megumi.y = 1;
    megumi.z = 1;
    megumi.hp = 100;
    choso.x = 3;
    choso.y = 1;
    choso.z = 1;
    choso.hp = 100;
    calculateRanges();
    handleTileClick(nue.x, nue.y, nue.z);
  `);

  assert.equal(dom.window.eval("currentUnit().summonKind"), "nue");
  document.querySelector("#skillBtn").click();
  clickAbility(document, "Lightning Strike");
  dom.window.eval("handleTileClick(3, 1, 1)");

  assert.ok(dom.window.eval('livingUnits().find((unit) => unit.characterId === "choso").hp') <= 80);
  assert.ok(dom.window.eval('livingUnits().find((unit) => unit.characterId === "megumi").hp') < 100);
  assert.equal(dom.window.eval("currentUnit().characterId"), "megumi");
  assert.equal(dom.window.eval("activeSummonsFor(currentUnit()).length"), 0);

  dom.window.close();
});

test("Megumi can summon Mahoraga, who adapts to damage and unlocks World Cutting Slash", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  startMegumiVsChosoBattle(document);

  dom.window.eval(`
    stopInitiativeClock();
    const megumi = livingUnits().find((unit) => unit.characterId === "megumi");
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    selectNextTurn([megumi]);
    megumi.megumiTurnsTaken = 6;
    megumi.hp = Math.floor(megumi.maxHp * 0.19);
    megumi.ce = 150;
    megumi.maxCe = 150;
    megumi.x = 1;
    megumi.y = 1;
    megumi.z = 1;
    choso.x = 3;
    choso.y = 1;
    choso.z = 1;
    megumi.megumiDamageMemory = [{ attackerId: choso.id, megumiTurn: 6 }];
    calculateRanges();
    summonMahoraga(megumi, getAbility(megumi, "summonMahoraga"));
  `);

  assert.equal(dom.window.eval('unitAt(1, 1, 1).characterId'), "megumi");
  assert.equal(dom.window.eval('unitAt(1, 1, 1).hp'), 0);
  assert.equal(dom.window.eval("currentUnit().isMahoraga"), true);
  assert.equal(dom.window.eval("currentUnit().allowedTargetIds.length"), 1);
  assert.equal(dom.window.eval("currentUnit().allowedTargetIds[0].includes('choso')"), true);

  dom.window.eval(`
    const mahoraga = currentUnit();
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    performAttack(choso, mahoraga, "test slash", { attackMultiplier: 1, damageType: "slashing", triggersCounterattack: false, canBlackFlash: false });
  `);

  assert.equal(dom.window.eval("currentUnit().adaptations.slashing"), 1);

  dom.window.eval(`
    const mahoraga = currentUnit();
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    mahoraga.adaptations = { slashing: 6, strike: 2 };
    mahoraga.acted = false;
    mahoraga.moved = false;
    choso.hp = 100;
    choso.x = mahoraga.x + 1;
    choso.y = mahoraga.y;
    choso.z = mahoraga.z;
    calculateRanges();
    render();
  `);

  assert.equal(dom.window.eval("getAbilities(currentUnit()).some((ability) => ability.id === 'worldCuttingSlash')"), true);
  document.querySelector("#skillBtn").click();
  clickAbility(document, "World Cutting Slash");
  dom.window.eval("handleTileClick(currentUnit().x, currentUnit().y, currentUnit().z)");
  assert.ok(dom.window.eval('livingUnits().find((unit) => unit.characterId === "choso").hp') < 100);

  dom.window.close();
});

test("Mahito unlocks his Ultimate, transforms, stacks bleeding, and loses form at 0 CE", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  dom.window.Math.random = () => 0;
  startMahitoVsChosoBattle(document);

  dom.window.eval(`
    stopInitiativeClock();
    const mahito = livingUnits().find((unit) => unit.characterId === "mahito");
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    selectNextTurn([mahito]);
    mahito.x = 1;
    mahito.y = 1;
    mahito.z = 1;
    choso.x = 2;
    choso.y = 1;
    choso.z = 1;
    choso.hp = 100;
    choso.maxHp = 100;
    calculateRanges();
    useOffense(choso);
    mahito.acted = false;
    mahito.moved = false;
    choso.hp = 100;
    calculateRanges();
    useOffense(choso);
  `);

  assert.equal(dom.window.eval("currentUnit().mahitoBlackFlashes"), 2);
  assert.equal(dom.window.eval("mahitoUltimateUnlocked(currentUnit())"), true);
  assert.match(document.querySelector("#log").textContent, /unlocks their Ultimate/);

  dom.window.eval(`
    const mahito = currentUnit();
    mahito.hp = Math.floor(mahito.maxHp * 0.6);
    mahito.ce = 80;
    mahito.acted = false;
    mahito.moved = false;
    calculateRanges();
    render();
  `);
  document.querySelector("#skillBtn").click();
  clickAbility(document, "Instant Spirit Body");
  dom.window.eval("handleTileClick(1, 1, 1)");

  assert.deepEqual(JSON.parse(dom.window.eval(`JSON.stringify((() => {
    const mahito = currentUnit();
    return {
      transformed: Boolean(mahito.activeEffects.mahitoTransformed),
      ce: mahito.ce,
      maxCe: mahito.maxCe,
      attack: mahito.attack,
      defense: mahito.defense,
      speed: mahito.speed,
      abilities: getAbilities(mahito).map((ability) => ability.id),
    };
  })())`)), {
    transformed: true,
    ce: 150,
    maxCe: 150,
    attack: 21,
    defense: 10,
    speed: 28,
    abilities: ["predatorDash", "blindSpotStrike"],
  });

  dom.window.eval(`
    const mahito = currentUnit();
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    mahito.acted = false;
    mahito.moved = false;
    choso.hp = 100;
    choso.x = mahito.x + 1;
    choso.y = mahito.y;
    choso.z = mahito.z;
    calculateRanges();
    useOffense(choso);
    mahito.acted = false;
    mahito.moved = false;
    calculateRanges();
    useOffense(choso);
  `);

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "choso").bleedingStacks'), 2);

  dom.window.eval(`
    const mahito = currentUnit();
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    mahito.ce = 5;
    mahito.hp = 50;
    performAttack(choso, mahito, "test strike", { attackMultiplier: 1, triggersCounterattack: false, canBlackFlash: false });
  `);

  assert.equal(dom.window.eval("Boolean(currentUnit().activeEffects.mahitoTransformed)"), false);
  assert.equal(dom.window.eval("currentUnit().ce"), 0);
  assert.equal(dom.window.eval("currentUnit().attack"), 8);
  assert.equal(dom.window.eval("currentUnit().defense"), 4);
  assert.equal(dom.window.eval("currentUnit().speed"), 8);

  dom.window.close();
});

test("Toji has no CE, weapon locks, spear thrust knockback, and katana bleeding", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  startTojiVsMiwaBattle(document);

  dom.window.eval(`
    stopInitiativeClock();
    const toji = livingUnits().find((unit) => unit.characterId === "toji");
    const miwa = livingUnits().find((unit) => unit.characterId === "miwa");
    selectNextTurn([toji]);
    toji.x = 1;
    toji.y = 1;
    toji.z = 1;
    miwa.x = 3;
    miwa.y = 1;
    miwa.z = 1;
    calculateRanges();
  `);

  assert.equal(dom.window.eval("currentUnit().maxCe"), 0);
  assert.equal(dom.window.eval("currentUnit().maxHp"), 72);
  assert.equal(dom.window.eval("currentUnit().defense"), 5);
  assert.equal(dom.window.eval("currentUnit().mobility"), 3);
  assert.equal(dom.window.eval("currentUnit().weapon"), "invertedSpear");
  assert.match(document.querySelector("#unitCard").textContent, /No CE/);

  document.querySelector("#skillBtn").click();
  clickAbility(document, "Spear Thrust");
  dom.window.eval("handleTileClick(3, 1, 1)");
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "miwa").x'), 4);
  assert.equal(dom.window.eval('abilityCooldown(livingUnits().find((unit) => unit.characterId === "toji"), "spearThrust")'), 3);

  dom.window.eval(`
    const toji = livingUnits().find((unit) => unit.characterId === "toji");
    const miwa = livingUnits().find((unit) => unit.characterId === "miwa");
    selectNextTurn([toji]);
    toji.acted = false;
    toji.moved = false;
    miwa.x = 2;
    miwa.y = 1;
    miwa.z = 1;
    miwa.hp = 100;
    calculateRanges();
  `);
  document.querySelector("#skillBtn").click();
  clickAbility(document, "Equip Split Soul Katana");
  assert.equal(dom.window.eval("currentUnit().weapon"), "splitSoulKatana");
  assert.equal(dom.window.eval('weaponLock(currentUnit(), "invertedSpear")'), 3);
  assert.equal(dom.window.eval('weaponLock(currentUnit(), "splitSoulKatana")'), 3);
  assert.equal(dom.window.eval("currentUnit().acted"), false);

  document.querySelector("#skillBtn").click();
  clickAbility(document, "Deep Cut");
  dom.window.eval("handleTileClick(2, 1, 1)");
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "miwa").bleedingTurnsRemaining'), 3);

  dom.window.close();
});

test("Toji can use Chain Weapon sweep and Phantom Step between floors", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  startTojiVsMiwaBattle(document);

  dom.window.eval(`
    stopInitiativeClock();
    const toji = livingUnits().find((unit) => unit.characterId === "toji");
    const miwa = livingUnits().find((unit) => unit.characterId === "miwa");
    selectNextTurn([toji]);
    toji.weapon = "chainWeapon";
    toji.weaponLocks = {};
    toji.x = 1;
    toji.y = 1;
    toji.z = 1;
    toji.facing = "south";
    miwa.x = 1;
    miwa.y = 2;
    miwa.z = 1;
    calculateRanges();
  `);

  const hpBefore = dom.window.eval('livingUnits().find((unit) => unit.characterId === "miwa").hp');
  document.querySelector("#skillBtn").click();
  clickAbility(document, "Sweeping Strike");
  assert.ok(dom.window.eval('livingUnits().find((unit) => unit.characterId === "miwa").hp') < hpBefore);
  assert.equal(dom.window.eval('abilityCooldown(livingUnits().find((unit) => unit.characterId === "toji"), "sweepingStrike")'), 4);

  dom.window.eval(`
    const toji = livingUnits().find((unit) => unit.characterId === "toji");
    toji.acted = false;
    toji.moved = false;
    toji.abilityCooldowns = {};
    toji.x = 1;
    toji.y = 1;
    toji.z = 1;
    calculateRanges();
  `);
  document.querySelector("#skillBtn").click();
  clickAbility(document, "Phantom Step");
  dom.window.eval("handleTileClick(1, 1, 2)");
  assert.equal(dom.window.eval("currentUnit().z"), 2);
  assert.equal(dom.window.eval('abilityCooldown(currentUnit(), "phantomStep")'), 5);

  dom.window.close();
});

test("Miwa counterattacks and recovers CE with Dedication", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  dom.window.Math.random = () => 0;
  startMiwaMirrorBattle(document);

  dom.window.eval("stopInitiativeClock()");
  dom.window.eval('selectNextTurn([livingUnits().find((unit) => unit.team === "blue")])');
  dom.window.eval("currentUnit().ce = 50");
  dom.window.eval('useSelfAbility(getAbility(currentUnit(), "counterattack"))');

  const afterAbilityCe = dom.window.eval("currentUnit().ce");
  const miwaHpBefore = dom.window.eval("currentUnit().hp");
  const redHpBefore = dom.window.eval('livingUnits().find((unit) => unit.team === "red").hp');

  dom.window.eval(`
    const blue = currentUnit();
    const red = livingUnits().find((unit) => unit.team === "red");
    red.x = blue.x + 1;
    red.y = blue.y;
    red.z = blue.z;
    red.attack = 20;
    performAttack(red, blue, "basic attack");
  `);

  assert.equal(afterAbilityCe, 25);
  assert.equal(dom.window.eval("currentUnit().hp"), miwaHpBefore - 16);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").hp'), redHpBefore - 6);
  assert.equal(dom.window.eval("currentUnit().ce"), 30);

  dom.window.close();
});

test("Miwa has 50 CE, 30 CE skills, one-turn cooldowns, and regenerates CE on turn start", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  dom.window.Math.random = () => 0;
  startMiwaMirrorBattle(document);

  dom.window.eval(`
    stopInitiativeClock();
    const miwa = livingUnits().find((unit) => unit.team === "blue");
    selectNextTurn([miwa]);
    miwa.ce = 40;
    selectNextTurn([miwa]);
  `);

  assert.equal(dom.window.eval("currentUnit().maxCe"), 50);
  assert.equal(dom.window.eval("currentUnit().ce"), 44);
  assert.match(dom.window.eval('abilityDescription(getAbility(currentUnit(), "counterattack"))'), /30 CE, CD 1/);
  document.querySelector("#skillBtn").click();
  const counterButton = [...document.querySelectorAll("#abilityMenu button")].find((button) =>
    button.textContent.includes("Counterattack"),
  );
  assert.ok(counterButton);
  assert.match(counterButton.textContent, /CE 30 - CD 1/);
  assert.equal(counterButton.classList.contains("show-description"), false);
  counterButton.dispatchEvent(new dom.window.MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  assert.equal(counterButton.classList.contains("show-description"), true);

  dom.window.eval('useSelfAbility(getAbility(currentUnit(), "counterattack"))');

  assert.equal(dom.window.eval("currentUnit().ce"), 19);
  assert.equal(dom.window.eval('abilityCooldown(currentUnit(), "counterattack")'), 2);

  dom.window.eval("selectNextTurn([currentUnit()])");
  assert.equal(dom.window.eval('abilityCooldown(currentUnit(), "counterattack")'), 1);

  dom.window.eval("selectNextTurn([currentUnit()])");
  assert.equal(dom.window.eval('abilityCooldown(currentUnit(), "counterattack")'), 0);

  dom.window.close();
});

test("Miwa simple domain hits an enemy ending turn in the surrounding zone", async () => {
  const dom = await loadGame();
  const { document } = dom.window;
  dom.window.Math.random = () => 0;
  startMiwaMirrorBattle(document);

  dom.window.eval("stopInitiativeClock()");
  dom.window.eval('selectNextTurn([livingUnits().find((unit) => unit.team === "blue")])');
  dom.window.eval("currentUnit().ce = 50");
  dom.window.eval('useSelfAbility(getAbility(currentUnit(), "simpleDomain"))');

  const redHpBefore = dom.window.eval('livingUnits().find((unit) => unit.team === "red").hp');
  dom.window.eval(`
    const blue = livingUnits().find((unit) => unit.team === "blue");
    const red = livingUnits().find((unit) => unit.team === "red");
    red.x = blue.x + 1;
    red.y = blue.y + 1;
    red.z = blue.z;
    selectNextTurn([red]);
    advanceToNextTurn();
    stopInitiativeClock();
  `);

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").hp'), redHpBefore - 6);

  dom.window.close();
});

test("Yuji has tuned stats, gains Focus, can Black Flash, and loses Focus without attacking", async () => {
  const dom = await loadGame();
  const { document } = dom.window;

  clickButton(document, "Start Game");
  clickRosterCard(document, "Yuji");
  clickButton(document, "Red Team");
  clickRosterCard(document, "Choso");
  clickButton(document, "Choose Map");
  clickButton(document, "Start Battle");
  dom.window.eval('stopInitiativeClock(); selectNextTurn([livingUnits().find((unit) => unit.characterId === "yuji")]);');

  assert.deepEqual(JSON.parse(dom.window.eval(`JSON.stringify((() => {
    const yuji = currentUnit();
    return {
      maxHp: yuji.maxHp,
      attack: yuji.attack,
      defense: yuji.defense,
      speed: yuji.speed,
      mobility: yuji.mobility,
      maxCe: yuji.maxCe,
      focus: yuji.focus,
    };
  })())`)), {
    maxHp: 72,
    attack: 20,
    defense: 6,
    speed: 18,
    mobility: 3,
    maxCe: 100,
    focus: 0,
  });

  dom.window.Math.random = () => 0;
  dom.window.eval(`
    const yuji = currentUnit();
    const target = livingUnits().find((unit) => unit.team === "red");
    target.x = yuji.x + 1;
    target.y = yuji.y;
    target.z = yuji.z;
    calculateRanges();
  `);
  document.querySelector("#attackBtn").click();
  dom.window.eval(`
    const target = livingUnits().find((unit) => unit.team === "red");
    useOffense(target);
  `);

  assert.equal(dom.window.eval("currentUnit().focus"), 1);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").hp'), 44);
  assert.match(document.querySelector("#log").textContent, /Black Flash/);

  dom.window.eval(`
    const yuji = currentUnit();
    yuji.focus = 5;
    yuji.attackedThisTurn = false;
    advanceToNextTurn();
    stopInitiativeClock();
  `);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "yuji").focus'), 3);

  dom.window.close();
});

test("Choso starts in Blood Mode, attacks at range, applies Poison, and poison ticks on turn start", async () => {
  const dom = await loadGame();
  const { document } = dom.window;

  clickButton(document, "Start Game");
  clickRosterCard(document, "Choso");
  clickButton(document, "Red Team");
  clickRosterCard(document, "Miwa");
  clickButton(document, "Choose Map");
  clickButton(document, "Start Battle");
  dom.window.eval('stopInitiativeClock(); selectNextTurn([livingUnits().find((unit) => unit.characterId === "choso")]);');

  assert.deepEqual(JSON.parse(dom.window.eval(`JSON.stringify((() => {
    const choso = currentUnit();
    return {
      maxHp: choso.maxHp,
      attack: choso.attack,
      defense: choso.defense,
      effectiveDefense: effectiveDefense(choso),
      speed: choso.speed,
      maxCe: choso.maxCe,
      stance: choso.stance,
      passive: getPassive(choso).id,
    };
  })())`)), {
    maxHp: 78,
    attack: 18,
    defense: 4,
    effectiveDefense: 3,
    speed: 16,
    maxCe: 100,
    stance: "blood",
    passive: "poisonedBlood",
  });
  assert.match(document.querySelector("#unitCard").textContent, /DEF3/);
  assert.doesNotMatch(document.querySelector("#unitCard").textContent, /DEF3\s*\(4 x0\.85\)/);
  assert.match(document.querySelector("#unitCard").textContent, /Blood Mode/);

  dom.window.eval(`
    const choso = currentUnit();
    const target = livingUnits().find((unit) => unit.team === "red");
    target.x = choso.x + 3;
    target.y = choso.y;
    target.z = choso.z;
    calculateRanges();
    useOffense(target);
    selectNextTurn([target]);
  `);

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").poisonStacks'), 1);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").poisonTurnsRemaining'), 1);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").hp'), 48);
  assert.match(document.querySelector("#log").textContent, /Poison/);

  dom.window.eval(`
    const target = currentUnit();
    selectNextTurn([target]);
  `);

  assert.equal(dom.window.eval("currentUnit().poisonStacks"), 0);
  assert.equal(dom.window.eval("currentUnit().poisonTurnsRemaining"), 0);
  assert.equal(dom.window.eval("currentUnit().hp"), 44);
  assert.match(document.querySelector("#log").textContent, /Poison wears off/);

  dom.window.close();
});

test("Choso can switch to Combat Mode for melee damage and defense", async () => {
  const dom = await loadGame();
  const { document } = dom.window;

  clickButton(document, "Start Game");
  clickRosterCard(document, "Choso");
  clickButton(document, "Red Team");
  clickRosterCard(document, "Miwa");
  clickButton(document, "Choose Map");
  clickButton(document, "Start Battle");
  dom.window.eval('stopInitiativeClock(); selectNextTurn([livingUnits().find((unit) => unit.characterId === "choso")]);');

  dom.window.eval('useSelfAbility(getAbility(currentUnit(), "switchChosoStance"))');

  assert.equal(dom.window.eval("currentUnit().stance"), "combat");
  assert.equal(dom.window.eval("currentUnit().acted"), true);
  assert.equal(dom.window.eval("effectiveDefense(currentUnit())"), 5);
  assert.deepEqual(JSON.parse(dom.window.eval("JSON.stringify(getAbilities(currentUnit()).map((ability) => ability.id))")), ["switchChosoStance"]);

  dom.window.eval(`
    const choso = currentUnit();
    const target = livingUnits().find((unit) => unit.team === "red");
    choso.acted = false;
    choso.moved = false;
    target.x = choso.x + 1;
    target.y = choso.y;
    target.z = choso.z;
    calculateRanges();
    useOffense(target);
  `);

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").hp'), 46);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").poisonStacks'), 0);

  dom.window.close();
});

test("Choso uses Piercing Blood through a line and Supernova in an area", async () => {
  const dom = await loadGame();
  const { document } = dom.window;

  clickButton(document, "Start Game");
  clickRosterCard(document, "Choso");
  clickButton(document, "Red Team");
  clickRosterCard(document, "Miwa");
  clickRosterCard(document, "Choso");
  clickButton(document, "Choose Map");
  clickButton(document, "Start Battle");
  dom.window.eval('stopInitiativeClock(); selectNextTurn([livingUnits().find((unit) => unit.team === "blue" && unit.characterId === "choso")]);');

  dom.window.eval(`
    const choso = currentUnit();
    const targets = livingUnits().filter((unit) => unit.team === "red");
    targets[0].x = choso.x + 2;
    targets[0].y = choso.y;
    targets[0].z = choso.z;
    targets[1].x = choso.x + 4;
    targets[1].y = choso.y;
    targets[1].z = choso.z;
    calculateRanges();
  `);
  document.querySelector("#skillBtn").click();
  clickAbility(document, "Piercing Blood");
  dom.window.eval(`
    const target = livingUnits().find((unit) => unit.team === "red" && unit.characterId === "miwa");
    useOffense(target);
  `);

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "blue" && unit.characterId === "choso").ce'), 75);
  assert.equal(dom.window.eval('abilityCooldown(livingUnits().find((unit) => unit.team === "blue" && unit.characterId === "choso"), "piercingBlood")'), 3);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red" && unit.characterId === "miwa").poisonStacks'), 1);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red" && unit.characterId === "choso").poisonStacks'), 1);

  dom.window.eval(`
    const choso = livingUnits().find((unit) => unit.team === "blue" && unit.characterId === "choso");
    const target = livingUnits().find((unit) => unit.team === "red" && unit.characterId === "miwa");
    choso.acted = false;
    choso.moved = false;
    choso.ce = 100;
    choso.abilityCooldowns = {};
    selectNextTurn([choso]);
    calculateRanges();
  `);
  document.querySelector("#skillBtn").click();
  clickAbility(document, "Supernova");
  dom.window.eval(`
    const target = livingUnits().find((unit) => unit.team === "red" && unit.characterId === "miwa");
    useAreaAttackAbility(target.x, target.y, target.z);
  `);

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "blue" && unit.characterId === "choso").ce'), 65);
  assert.equal(dom.window.eval('abilityCooldown(livingUnits().find((unit) => unit.team === "blue" && unit.characterId === "choso"), "supernova")'), 0);
  assert.equal(dom.window.eval("activeSupernovaForUnit(currentUnit()).remainingTurns"), 3);
  assert.equal(document.querySelectorAll(".supernova-orb").length, 1);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red" && unit.characterId === "miwa").poisonStacks'), 1);

  dom.window.eval("currentUnit().acted = true; currentUnit().moved = true; render();");
  document.querySelector("#skillBtn").click();
  clickAbility(document, "Detonate Supernova");

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "blue" && unit.characterId === "choso").ce'), 65);
  assert.equal(dom.window.eval('abilityCooldown(livingUnits().find((unit) => unit.team === "blue" && unit.characterId === "choso"), "supernova")'), 5);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red" && unit.characterId === "miwa").poisonStacks'), 2);
  assert.equal(dom.window.eval("currentUnit().acted"), true);
  assert.equal(dom.window.eval("currentUnit().moved"), true);
  assert.equal(dom.window.eval("activeSupernovaForUnit(currentUnit())"), undefined);
  assert.equal(document.querySelectorAll(".supernova-orb").length, 0);
  assert.match(document.querySelector("#log").textContent, /Supernova/);

  dom.window.close();
});

test("Choso Supernova expires after three own turns and then starts cooldown", async () => {
  const dom = await loadGame();
  const { document } = dom.window;

  clickButton(document, "Start Game");
  clickRosterCard(document, "Choso");
  clickButton(document, "Red Team");
  clickRosterCard(document, "Miwa");
  clickButton(document, "Choose Map");
  clickButton(document, "Start Battle");
  dom.window.eval('stopInitiativeClock(); selectNextTurn([livingUnits().find((unit) => unit.characterId === "choso")]);');

  document.querySelector("#skillBtn").click();
  clickAbility(document, "Supernova");
  dom.window.eval(`
    const choso = currentUnit();
    useAreaAttackAbility(choso.x + 2, choso.y, choso.z);
    advanceToNextTurn();
    stopInitiativeClock();
  `);

  assert.equal(document.querySelectorAll(".supernova-orb").length, 1);

  dom.window.eval(`
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    for (let index = 0; index < 3; index += 1) {
      selectNextTurn([choso]);
      advanceToNextTurn();
      stopInitiativeClock();
    }
  `);

  assert.equal(dom.window.eval('activeSupernovaForUnit(livingUnits().find((unit) => unit.characterId === "choso"))'), undefined);
  assert.equal(dom.window.eval('abilityCooldown(livingUnits().find((unit) => unit.characterId === "choso"), "supernova")'), 5);
  assert.equal(document.querySelectorAll(".supernova-orb").length, 0);
  assert.match(document.querySelector("#log").textContent, /disappears/);

  dom.window.close();
});

test("attack, defense, and speed scale linearly from CE", async () => {
  const dom = await loadGame();
  const { document } = dom.window;

  clickButton(document, "Start Game");
  clickRosterCard(document, "Yuji");
  clickButton(document, "Red Team");
  clickRosterCard(document, "Choso");
  clickButton(document, "Choose Map");
  clickButton(document, "Start Battle");
  dom.window.eval('stopInitiativeClock(); selectNextTurn([livingUnits().find((unit) => unit.characterId === "yuji")]); currentUnit().ce = 0; render();');

  assert.deepEqual(JSON.parse(dom.window.eval(`JSON.stringify((() => {
    const yuji = currentUnit();
    return {
      attack: effectiveAttack(yuji),
      defense: effectiveDefense(yuji),
      speed: effectiveSpeed(yuji),
    };
  })())`)), {
    attack: 15,
    defense: 4,
    speed: 13,
  });
  assert.match(document.querySelector("#unitCard").textContent, /ATK15/);
  assert.match(document.querySelector("#unitCard").textContent, /SPD13/);

  dom.window.close();
});

test("Sukuna Fingers can be picked up, transferred to Yuji, and tracked by giver", async () => {
  const dom = await loadGame();
  const { document } = dom.window;

  clickButton(document, "Start Game");
  clickRosterCard(document, "Yuji");
  clickRosterCard(document, "Miwa");
  clickButton(document, "Red Team");
  clickRosterCard(document, "Choso");
  clickButton(document, "Choose Map");
  clickButton(document, "Start Battle");

  dom.window.eval(`
    stopInitiativeClock();
    const yuji = livingUnits().find((unit) => unit.characterId === "yuji");
    const miwa = livingUnits().find((unit) => unit.characterId === "miwa");
    selectNextTurn([miwa]);
    miwa.x = yuji.x + 1;
    miwa.y = yuji.y;
    miwa.z = yuji.z;
    clearFingerPiles();
    addFingerPile(miwa.x, miwa.y, miwa.z, 3);
    advanceToNextTurn();
    stopInitiativeClock();
    selectNextTurn([miwa]);
  `);
  dom.window.prompt = () => {
    throw new Error("Native prompt should not be used for finger transfer");
  };
  document.querySelector("#specialBtn").click();
  assert.equal(document.querySelector("#transferPanel").classList.contains("hidden"), false);
  document.querySelector("#transferAmount").value = "2";
  document.querySelector("#confirmTransferBtn").click();

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "miwa").sukunaFingers'), 1);
  assert.equal(dom.window.eval('yujiFingerState(livingUnits().find((unit) => unit.characterId === "yuji")).consumed'), 2);
  assert.equal(dom.window.eval(`
    const yuji = livingUnits().find((unit) => unit.characterId === "yuji");
    const miwa = livingUnits().find((unit) => unit.characterId === "miwa");
    contributionCountForYuji(miwa, yuji);
  `), 2);

  dom.window.close();
});

test("dead Yuji transforms into Sukuna on the second eligible turn with finger mitigation", async () => {
  const dom = await loadGame();
  const { document } = dom.window;

  clickButton(document, "Start Game");
  clickRosterCard(document, "Yuji");
  clickButton(document, "Red Team");
  clickRosterCard(document, "Choso");
  clickButton(document, "Choose Map");
  clickButton(document, "Start Battle");

  dom.window.eval(`
    stopInitiativeClock();
    const yuji = livingUnits().find((unit) => unit.characterId === "yuji");
    const choso = livingUnits().find((unit) => unit.characterId === "choso");
    choso.x = yuji.x + 1;
    choso.y = yuji.y;
    choso.z = yuji.z;
    choso.hp = 100;
    choso.sukunaFingers = 3;
    transferFingersToYuji(choso, yuji, 3);
    consumeFingersForYuji(yuji, 2);
    yuji.hp = 0;
    handleUnitDefeated(yuji);
    selectNextTurn([yuji]);
    selectNextTurn([yuji]);
  `);

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "yuji").hp'), 29);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "choso").hp'), 70);
  assert.match(document.querySelector("#log").textContent, /Sukuna/);

  dom.window.close();
});
