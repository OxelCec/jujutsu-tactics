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

  clickButton(document, "Iniciar juego");
  clickRosterCard(document, "Miwa");
  clickRosterCard(document, "Yuji");
  clickButton(document, "Equipo rojo");

  clickRosterCard(document, "Miwa");
  clickRosterCard(document, "Choso");
  clickButton(document, "Elegir mapa");

  clickButton(document, "Edificio destruido");
  clickButton(document, "Empezar batalla");

  assert.equal(document.querySelector("#setupScreen").classList.contains("hidden"), true);
  assert.equal(document.querySelector("#battlefield").classList.contains("hidden"), false);
  assert.equal(document.querySelectorAll(".level-board").length, 3);
  assert.equal(document.querySelectorAll(".tile").length, 300);
  assert.equal(document.querySelectorAll(".unit").length, 4);
  assert.equal(document.querySelectorAll(".unit.image-model, .unit img").length, 0);
  assert.equal(document.querySelectorAll(".unit.blue-unit").length, 2);
  assert.equal(document.querySelectorAll(".unit.red-unit").length, 2);
  assert.equal(document.querySelectorAll(".finger-token").length, 7);
  assert.match(document.querySelector("#teamList").textContent, /Equipo rojo/);
  assert.match(document.querySelector("#teamList").textContent, /Equipo azul/);
  assert.equal(document.querySelectorAll(".team-unit-button").length, 4);

  const chosoButton = [...document.querySelectorAll(".team-unit-button")].find((button) =>
    button.textContent.includes("Choso"),
  );
  assert.ok(chosoButton, "Expected Choso in the team list");
  chosoButton.click();
  assert.equal(document.querySelector("#unitCard h2").textContent, "Choso");
  assert.match(document.querySelector("#unitCard").textContent, /habilidades/);
  assert.doesNotMatch(document.querySelector("#unitCard").textContent, /Velocidad\d+\/100/);
  assert.match(document.querySelector("#log").textContent, /Empieza la batalla/);

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

test("Sukuna Fingers only spawn when Yuji is selected, and only seven spawn with two Yujis", async () => {
  const noYujiDom = await loadGame();
  const noYujiDocument = noYujiDom.window.document;

  clickButton(noYujiDocument, "Iniciar juego");
  clickRosterCard(noYujiDocument, "Miwa");
  clickButton(noYujiDocument, "Equipo rojo");
  clickRosterCard(noYujiDocument, "Choso");
  clickButton(noYujiDocument, "Elegir mapa");
  clickButton(noYujiDocument, "Empezar batalla");
  noYujiDom.window.eval('stopInitiativeClock(); selectNextTurn([livingUnits().find((unit) => unit.team === "blue")]);');

  assert.equal(noYujiDocument.querySelectorAll(".finger-token").length, 0);
  assert.doesNotMatch(noYujiDocument.querySelector("#teamList").textContent, /dedos|consumidos|dados/i);
  assert.doesNotMatch(noYujiDocument.querySelector("#unitCard").textContent, /Dedos|Entregados|Consumidos/);
  assert.equal(noYujiDocument.querySelector("#specialBtn").classList.contains("hidden"), true);
  noYujiDom.window.close();

  const twoYujiDom = await loadGame();
  const twoYujiDocument = twoYujiDom.window.document;

  clickButton(twoYujiDocument, "Iniciar juego");
  clickRosterCard(twoYujiDocument, "Yuji");
  clickButton(twoYujiDocument, "Equipo rojo");
  clickRosterCard(twoYujiDocument, "Yuji");
  clickButton(twoYujiDocument, "Elegir mapa");
  clickButton(twoYujiDocument, "Empezar batalla");

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
    performAttack(blue, red, "ataque normal", { attackMultiplier: 10, triggersCounterattack: false });
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
  clickButton(document, "Iniciar juego");
  clickRosterCard(document, "Miwa");
  clickButton(document, "Equipo rojo");
  clickRosterCard(document, "Miwa");
  clickButton(document, "Elegir mapa");
  clickButton(document, "Empezar batalla");
}

test("Miwa counterattacks and recovers CE with Dedicacion", async () => {
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
    performAttack(red, blue, "ataque normal");
  `);

  assert.equal(afterAbilityCe, 25);
  assert.equal(dom.window.eval("currentUnit().hp"), miwaHpBefore - 16);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").hp'), redHpBefore - 7);
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

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").hp'), redHpBefore - 7);

  dom.window.close();
});

test("Yuji has tuned stats, gains Focus, can Black Flash, and loses Focus without attacking", async () => {
  const dom = await loadGame();
  const { document } = dom.window;

  clickButton(document, "Iniciar juego");
  clickRosterCard(document, "Yuji");
  clickButton(document, "Equipo rojo");
  clickRosterCard(document, "Choso");
  clickButton(document, "Elegir mapa");
  clickButton(document, "Empezar batalla");
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
    maxHp: 55,
    attack: 23,
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
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").hp'), 18);
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

  clickButton(document, "Iniciar juego");
  clickRosterCard(document, "Choso");
  clickButton(document, "Equipo rojo");
  clickRosterCard(document, "Miwa");
  clickButton(document, "Elegir mapa");
  clickButton(document, "Empezar batalla");
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
    maxHp: 58,
    attack: 21,
    defense: 4,
    effectiveDefense: 3,
    speed: 16,
    maxCe: 100,
    stance: "blood",
    passive: "poisonedBlood",
  });
  assert.match(document.querySelector("#unitCard").textContent, /Modo sangre/);

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
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").hp'), 25);
  assert.match(document.querySelector("#log").textContent, /Veneno/);

  dom.window.close();
});

test("Choso can switch to Combat Mode for melee damage and defense", async () => {
  const dom = await loadGame();
  const { document } = dom.window;

  clickButton(document, "Iniciar juego");
  clickRosterCard(document, "Choso");
  clickButton(document, "Equipo rojo");
  clickRosterCard(document, "Miwa");
  clickButton(document, "Elegir mapa");
  clickButton(document, "Empezar batalla");
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

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").hp'), 22);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").poisonStacks'), 0);

  dom.window.close();
});

test("Choso uses Piercing Blood through a line and Supernova in an area", async () => {
  const dom = await loadGame();
  const { document } = dom.window;

  clickButton(document, "Iniciar juego");
  clickRosterCard(document, "Choso");
  clickButton(document, "Equipo rojo");
  clickRosterCard(document, "Miwa");
  clickRosterCard(document, "Choso");
  clickButton(document, "Elegir mapa");
  clickButton(document, "Empezar batalla");
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
  clickAbility(document, "Sangre perforante");
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
  clickAbility(document, "Activar Supernova");

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

  clickButton(document, "Iniciar juego");
  clickRosterCard(document, "Choso");
  clickButton(document, "Equipo rojo");
  clickRosterCard(document, "Miwa");
  clickButton(document, "Elegir mapa");
  clickButton(document, "Empezar batalla");
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
  assert.match(document.querySelector("#log").textContent, /desaparece/);

  dom.window.close();
});

test("attack, defense, and speed scale linearly from CE", async () => {
  const dom = await loadGame();
  const { document } = dom.window;

  clickButton(document, "Iniciar juego");
  clickRosterCard(document, "Yuji");
  clickButton(document, "Equipo rojo");
  clickRosterCard(document, "Choso");
  clickButton(document, "Elegir mapa");
  clickButton(document, "Empezar batalla");
  dom.window.eval('stopInitiativeClock(); selectNextTurn([livingUnits().find((unit) => unit.characterId === "yuji")]); currentUnit().ce = 0; render();');

  assert.deepEqual(JSON.parse(dom.window.eval(`JSON.stringify((() => {
    const yuji = currentUnit();
    return {
      attack: effectiveAttack(yuji),
      defense: effectiveDefense(yuji),
      speed: effectiveSpeed(yuji),
    };
  })())`)), {
    attack: 17,
    defense: 4,
    speed: 13,
  });
  assert.match(document.querySelector("#unitCard").textContent, /Ataque17/);
  assert.match(document.querySelector("#unitCard").textContent, /Velocidad13/);

  dom.window.close();
});

test("Sukuna Fingers can be picked up, transferred to Yuji, and tracked by giver", async () => {
  const dom = await loadGame();
  const { document } = dom.window;

  clickButton(document, "Iniciar juego");
  clickRosterCard(document, "Yuji");
  clickRosterCard(document, "Miwa");
  clickButton(document, "Equipo rojo");
  clickRosterCard(document, "Choso");
  clickButton(document, "Elegir mapa");
  clickButton(document, "Empezar batalla");

  dom.window.eval(`
    stopInitiativeClock();
    const yuji = livingUnits().find((unit) => unit.characterId === "yuji");
    const miwa = livingUnits().find((unit) => unit.characterId === "miwa");
    selectNextTurn([miwa]);
    miwa.x = yuji.x + 1;
    miwa.y = yuji.y;
    miwa.z = yuji.z;
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

  clickButton(document, "Iniciar juego");
  clickRosterCard(document, "Yuji");
  clickButton(document, "Equipo rojo");
  clickRosterCard(document, "Choso");
  clickButton(document, "Elegir mapa");
  clickButton(document, "Empezar batalla");

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

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "yuji").hp'), 22);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "choso").hp'), 65);
  assert.match(document.querySelector("#log").textContent, /Sukuna/);

  dom.window.close();
});
