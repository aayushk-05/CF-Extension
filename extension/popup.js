let lastExtract = null;
let lastSamples = null;
const extApi = globalThis.browser || globalThis.chrome;
const MODE_STORAGE_KEY = "cpHelperParseMode";

const output = document.getElementById("output");
const panelAuto = document.getElementById("panel-auto");
const panelManual = document.getElementById("panel-manual");
const modeAutoBtn = document.getElementById("mode-auto");
const modeManualBtn = document.getElementById("mode-manual");
const extractBtn = document.getElementById("extract-btn");
const copyBtn = document.getElementById("copy-btn");
const manualErrorText = document.getElementById("manual-error-text");
const manualInputText = document.getElementById("manual-input-text");
const parseManualBtn = document.getElementById("parse-manual-btn");
const scrapeBtn = document.getElementById("scrape-btn");
const downloadBtn = document.getElementById("download-btn");
const fieldCopyRow = document.getElementById("field-copy-row");
const linesPerTestInput = document.getElementById("lines-per-test-input");

/** Turn literal \\n, \\t, \\r, \\\\ in strings into real newlines/tabs (and keep real newlines as-is). */
function unescapeCommonSequences(s) {
  if (typeof s !== "string") return s;
  return s
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\\\/g, "\\");
}

const FAILURE_DISPLAY_KEY_ORDER = [
  "checkerLine",
  "nthIndex",
  "linesPerTest",
  "nthInput",
  "nthExpectedOutput",
  "nthYourOutput"
];

function isFailureExtractShape(obj) {
  return obj != null && typeof obj === "object" && ("checkerLine" in obj || "nthIndex" in obj);
}

function formatFailureExtractForDisplay(data) {
  const seen = new Set();
  const out = [];

  const append = (key, v) => {
    if (v === null || v === undefined) {
      out.push(`${key}: null`);
      return;
    }
    if (typeof v === "string") {
      const expanded = unescapeCommonSequences(v);
      if (/[\n\t]/.test(expanded)) {
        out.push(`${key}:`);
        out.push(
          expanded
            .split("\n")
            .map((line) => `  ${line}`)
            .join("\n")
        );
      } else {
        out.push(`${key}: ${expanded}`);
      }
      return;
    }
    out.push(`${key}: ${v}`);
  };

  for (const key of FAILURE_DISPLAY_KEY_ORDER) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      append(key, data[key]);
      seen.add(key);
    }
  }
  for (const key of Object.keys(data)) {
    if (!seen.has(key)) append(key, data[key]);
  }
  return out.join("\n");
}

function readLinesPerTest() {
  const raw = linesPerTestInput.value.trim();
  if (!raw) return null;
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

function applyParseMode(mode) {
  const isAuto = mode === "auto";
  panelAuto.classList.toggle("panel-hidden", !isAuto);
  panelManual.classList.toggle("panel-hidden", isAuto);
  modeAutoBtn.classList.toggle("is-active", isAuto);
  modeManualBtn.classList.toggle("is-active", !isAuto);
  modeAutoBtn.setAttribute("aria-selected", String(isAuto));
  modeManualBtn.setAttribute("aria-selected", String(!isAuto));
}

function persistParseMode(mode) {
  extApi.storage.local.set({ [MODE_STORAGE_KEY]: mode });
}

function render(data) {
  if (typeof data === "string") {
    output.textContent = data;
    return;
  }
  if (isFailureExtractShape(data)) {
    output.textContent = formatFailureExtractForDisplay(data);
    return;
  }
  output.textContent = JSON.stringify(data, null, 2);
}

function refreshFieldCopyButtons() {
  const buttons = document.querySelectorAll(".copy-field-btn");
  if (!lastExtract) {
    buttons.forEach((b) => {
      b.disabled = true;
    });
    return;
  }
  buttons.forEach((b) => {
    const field = b.dataset.field;
    const v = lastExtract[field];
    b.disabled = v == null || v === "";
  });
}

async function getActiveTabId() {
  const tabs = await extApi.tabs.query({ active: true, currentWindow: true });
  if (!tabs.length || typeof tabs[0].id !== "number") {
    throw new Error("No active tab found.");
  }
  return tabs[0].id;
}

modeAutoBtn.addEventListener("click", () => {
  applyParseMode("auto");
  persistParseMode("auto");
});

modeManualBtn.addEventListener("click", () => {
  applyParseMode("manual");
  persistParseMode("manual");
});

extractBtn.addEventListener("click", async () => {
  try {
    const tabId = await getActiveTabId();
    const response = await extApi.tabs.sendMessage(tabId, {
      type: "EXTRACT_FAILURE_DETAILS",
      payload: { linesPerTest: readLinesPerTest() }
    });
    if (!response || !response.ok) {
      throw new Error(response?.error || "Could not parse failed test details on this page.");
    }
    lastExtract = response.data;
    copyBtn.disabled = false;
    refreshFieldCopyButtons();
    render(lastExtract);
  } catch (error) {
    render(`Error: ${error.message}`);
  }
});

parseManualBtn.addEventListener("click", () => {
  try {
    const verdict = manualErrorText.value.trim();
    if (!verdict) {
      throw new Error("Paste the checker / verdict line first.");
    }
    const parsed = parseFailureText(verdict);
    const manualIn = manualInputText.value.trim() || null;

    lastExtract = buildSlimFailurePayload(parsed, {
      inputBlock: manualIn,
      linesPerTest: readLinesPerTest()
    });

    copyBtn.disabled = false;
    refreshFieldCopyButtons();
    render(lastExtract);
  } catch (error) {
    render(`Error: ${error.message}`);
  }
});

fieldCopyRow.addEventListener("click", async (e) => {
  const btn = e.target.closest(".copy-field-btn");
  if (!btn || btn.disabled || !lastExtract) return;
  const field = btn.dataset.field;
  const val = lastExtract[field];
  if (val == null || val === "") return;
  const toCopy = typeof val === "string" ? unescapeCommonSequences(val) : String(val);
  await navigator.clipboard.writeText(toCopy);
  render(`Copied: ${field}`);
});

copyBtn.addEventListener("click", async () => {
  if (!lastExtract) return;
  await navigator.clipboard.writeText(formatFailureExtractForDisplay(lastExtract));
  render("Copied result to clipboard.");
});

scrapeBtn.addEventListener("click", async () => {
  try {
    const tabId = await getActiveTabId();
    const response = await extApi.tabs.sendMessage(tabId, { type: "SCRAPE_SAMPLES" });
    if (!response || !response.ok) {
      throw new Error(response?.error || "Could not scrape sample tests on this page.");
    }
    lastSamples = response.data;
    downloadBtn.disabled = false;
    render(lastSamples);
  } catch (error) {
    render(`Error: ${error.message}`);
  }
});

downloadBtn.addEventListener("click", async () => {
  if (!lastSamples) return;
  const payload = {
    exportedAt: new Date().toISOString(),
    testCount: lastSamples.tests.length,
    source: lastSamples.url,
    tests: lastSamples.tests
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const dataUrl = URL.createObjectURL(blob);
  await extApi.downloads.download({
    url: dataUrl,
    filename: "cp-tests/tests.json",
    saveAs: true
  });
  render("Downloaded tests.json. Use scripts/run-tests.js to run all tests locally.");
});

applyParseMode("auto");
extApi.storage.local.get(MODE_STORAGE_KEY).then((r) => {
  if (r[MODE_STORAGE_KEY] === "manual") {
    applyParseMode("manual");
  }
}, () => {});

refreshFieldCopyButtons();
