/** Prefer text that actually contains a checker / WA line, not the first tiny verdict badge. */
function collectTextForFailureParsing() {
  const bodyText = (document.body && document.body.innerText) ? document.body.innerText.trim() : "";
  if (/wrong answer/i.test(bodyText) && /numbers differ/i.test(bodyText)) {
    return bodyText;
  }

  const nodes = document.querySelectorAll("pre, .program-source, .judge-comment, .alert, .error-message");
  for (const node of nodes) {
    const t = node.textContent || "";
    if (/wrong answer/i.test(t) && (/expected/i.test(t) || /found/i.test(t))) {
      return t.trim();
    }
  }

  return bodyText;
}

function looksLikeProgramSource(text) {
  const t = text.slice(0, 2000);
  return /#include|using\s+namespace|int\s+main|^\s*import\s|^\s*from\s+\w+\s+import|^\s*def\s+\w+\s*\(|public\s+class\s+\w+/m.test(
    t
  );
}

/** Codeforces submission view: testcase input is usually under `.input pre`, not `.output pre`. */
function findTestInputBlockText() {
  const directCandidates = document.querySelectorAll(".input pre, .test-input pre, [data-input] pre");
  for (const pre of directCandidates) {
    const trimmed = (pre.textContent || "").trim();
    if (!trimmed) continue;
    if (/wrong answer/i.test(trimmed) && /expected:/i.test(trimmed)) continue;
    if (looksLikeProgramSource(trimmed)) continue;
    return trimmed;
  }

  const pres = Array.from(document.querySelectorAll("pre"));
  let best = "";
  let bestScore = 0;

  for (const pre of pres) {
    if (pre.closest(".output, .answer, .expected-output, .judge-output")) continue;
    const t = pre.textContent || "";
    const trimmed = t.trim();
    if (!trimmed) continue;
    if (/wrong answer/i.test(trimmed) && /expected:\s*['"]/i.test(trimmed)) continue;
    if (looksLikeProgramSource(trimmed)) continue;

    const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 1) continue;

    const numericTokens = trimmed.split(/\s+/).filter((tok) => /^-?\d+$/.test(tok));
    let score = lines.length * 100 + numericTokens.length;
    if (pre.closest(".input, .test-input, [class*='input']")) score += 50000;

    if (score > bestScore) {
      bestScore = score;
      best = trimmed;
    }
  }

  return best || null;
}

function normalizeLinesPerTest(value) {
  if (value == null || value === "") return null;
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

function extractFailureDetails(linesPerTest) {
  const sourceText = collectTextForFailureParsing();
  const parsed = parseFailureText(sourceText);
  const inputBlock = findTestInputBlockText();

  return buildSlimFailurePayload(parsed, {
    inputBlock,
    linesPerTest: normalizeLinesPerTest(linesPerTest)
  });
}

function buildFailureDetailsFromPayload(payload) {
  const rawText = payload?.rawText || "";
  const manualInput = (payload?.manualInput || "").trim();
  const parsed = parseFailureText(rawText);
  const pageInput = findTestInputBlockText();
  const inputBlock = manualInput || pageInput;

  return buildSlimFailurePayload(parsed, {
    inputBlock,
    linesPerTest: normalizeLinesPerTest(payload?.linesPerTest)
  });
}

function textContentList(selector) {
  return Array.from(document.querySelectorAll(selector))
    .map((node) => node.textContent?.trim() || "")
    .filter(Boolean);
}

function scrapeSamples() {
  // Codeforces style
  const cfInputs = textContentList(".sample-test .input pre");
  const cfOutputs = textContentList(".sample-test .output pre");
  if (cfInputs.length && cfOutputs.length) {
    return cfInputs.map((input, idx) => ({
      index: idx + 1,
      input,
      output: cfOutputs[idx] || ""
    }));
  }

  // AtCoder style
  const sections = Array.from(document.querySelectorAll("section"));
  const atcoderInputs = [];
  const atcoderOutputs = [];
  for (const section of sections) {
    const h3 = section.querySelector("h3");
    const pre = section.querySelector("pre");
    if (!h3 || !pre) continue;
    const title = h3.textContent?.toLowerCase() || "";
    if (title.includes("sample input")) atcoderInputs.push(pre.textContent.trim());
    if (title.includes("sample output")) atcoderOutputs.push(pre.textContent.trim());
  }
  if (atcoderInputs.length && atcoderOutputs.length) {
    return atcoderInputs.map((input, idx) => ({
      index: idx + 1,
      input,
      output: atcoderOutputs[idx] || ""
    }));
  }

  // CodeChef style (best effort)
  const codechefPres = textContentList(".problem-statement pre");
  if (codechefPres.length >= 2) {
    const tests = [];
    for (let i = 0; i + 1 < codechefPres.length; i += 2) {
      tests.push({
        index: tests.length + 1,
        input: codechefPres[i],
        output: codechefPres[i + 1]
      });
    }
    if (tests.length) return tests;
  }

  return [];
}

const extApi = globalThis.browser || globalThis.chrome;
extApi.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message.type === "EXTRACT_FAILURE_DETAILS") {
      const details = extractFailureDetails(message.payload?.linesPerTest);
      sendResponse({ ok: true, data: details });
      return;
    }
    if (message.type === "SCRAPE_SAMPLES") {
      const tests = scrapeSamples();
      if (!tests.length) {
        sendResponse({ ok: false, error: "No sample tests found on this page." });
        return;
      }
      sendResponse({
        ok: true,
        data: {
          url: window.location.href,
          title: document.title,
          tests
        }
      });
      return;
    }
    if (message.type === "PARSE_RAW_FAILURE_TEXT") {
      const details = buildFailureDetailsFromPayload(message.payload || {});
      sendResponse({ ok: true, data: details });
    }
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }
});
