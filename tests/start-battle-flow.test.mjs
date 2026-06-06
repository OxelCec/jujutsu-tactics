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
  assert.match(document.querySelector("#log").textContent, /Empieza la batalla/);

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

  assert.equal(noYujiDocument.querySelectorAll(".finger-token").length, 0);
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

  assert.equal(afterAbilityCe, 55);
  assert.equal(dom.window.eval("currentUnit().hp"), miwaHpBefore - 14);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").hp'), redHpBefore - 7);
  assert.equal(dom.window.eval("currentUnit().ce"), 60);

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
    maxHp: 46,
    attack: 20,
    defense: 7,
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
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.team === "red").hp'), 23);
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

  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "yuji").hp'), 19);
  assert.equal(dom.window.eval('livingUnits().find((unit) => unit.characterId === "choso").hp'), 71);
  assert.match(document.querySelector("#log").textContent, /Sukuna/);

  dom.window.close();
});
