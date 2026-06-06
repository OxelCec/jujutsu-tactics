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
