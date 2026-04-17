function getTextFromSelectors(selectors) {
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    if (node && node.textContent && node.textContent.trim()) {
      return node.textContent.trim();
    }
  }
  return "";
}

function parseFailureText(rawText) {
  const text = rawText.replace(/\r/g, "\n");
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const joined = lines.join(" ");

  const testIndexMatch =
    joined.match(/(?:test|input)\s*#?\s*(\d+)/i) ||
    joined.match(/(\d+)(?:st|nd|rd|th)\s+input/i);
  const expectedMatch =
    joined.match(/(?:expected|answer|correct output)\s*[:=]\s*([^\n;]+)/i) ||
    joined.match(/(?:is|was)\s*([-\d]+(?:\.\d+)?)\s*(?:but|and)\s*(?:my|your|got)/i);
  const actualMatch =
    joined.match(/(?:actual|your output|got)\s*[:=]\s*([^\n;]+)/i) ||
    joined.match(/(?:my|your)\s+output\s*(?:is|was)?\s*([-\d]+(?:\.\d+)?)/i);

  return {
    testIndex: testIndexMatch ? Number(testIndexMatch[1]) : null,
    expected: expectedMatch ? expectedMatch[1].trim() : null,
    actual: actualMatch ? actualMatch[1].trim() : null,
    message: joined
  };
}

function extractFailureDetails() {
  const sourceText = getTextFromSelectors([
    ".verdict-format-judged",
    ".program-source",
    ".judge-comment",
    ".alert",
    ".error-message",
    ".submission-result",
    "body"
  ]);

  const parsed = parseFailureText(sourceText);

  // Try to locate explicit failing test input if page includes it.
  const inputNode = document.querySelector(".input pre, .test-example-line, .sample-test pre");
  const failingInput = inputNode?.textContent?.trim() || null;

  return {
    url: window.location.href,
    title: document.title,
    failingTestIndex: parsed.testIndex,
    failingInput,
    expectedOutput: parsed.expected,
    yourOutput: parsed.actual,
    rawMessage: parsed.message
  };
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
    const tests = cfInputs.map((input, idx) => ({
      index: idx + 1,
      input,
      output: cfOutputs[idx] || ""
    }));
    return tests;
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message.type === "EXTRACT_FAILURE_DETAILS") {
      const details = extractFailureDetails();
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
    }
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
  }
});
