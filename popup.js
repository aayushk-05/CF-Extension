let lastExtract = null;
let lastSamples = null;

const output = document.getElementById("output");
const extractBtn = document.getElementById("extract-btn");
const copyBtn = document.getElementById("copy-btn");
const scrapeBtn = document.getElementById("scrape-btn");
const downloadBtn = document.getElementById("download-btn");

function render(data) {
  output.textContent = typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs.length || typeof tabs[0].id !== "number") {
    throw new Error("No active tab found.");
  }
  return tabs[0].id;
}

extractBtn.addEventListener("click", async () => {
  try {
    const tabId = await getActiveTabId();
    const response = await chrome.tabs.sendMessage(tabId, { type: "EXTRACT_FAILURE_DETAILS" });
    if (!response || !response.ok) {
      throw new Error(response?.error || "Could not parse failed test details on this page.");
    }
    lastExtract = response.data;
    copyBtn.disabled = false;
    render(lastExtract);
  } catch (error) {
    render(`Error: ${error.message}`);
  }
});

copyBtn.addEventListener("click", async () => {
  if (!lastExtract) return;
  await navigator.clipboard.writeText(JSON.stringify(lastExtract, null, 2));
  render("Copied failed case JSON to clipboard.");
});

scrapeBtn.addEventListener("click", async () => {
  try {
    const tabId = await getActiveTabId();
    const response = await chrome.tabs.sendMessage(tabId, { type: "SCRAPE_SAMPLES" });
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
  await chrome.downloads.download({
    url: dataUrl,
    filename: "cp-tests/tests.json",
    saveAs: true
  });
  render("Downloaded tests.json. Use scripts/run-tests.js to run all tests locally.");
});
