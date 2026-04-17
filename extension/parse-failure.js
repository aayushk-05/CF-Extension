/** 1-based index: Nth token in whitespace-separated text (fallback when test-case blocks do not apply). */
function extractNthTokenFromInput(inputBlock, n) {
  if (!inputBlock || !n || n < 1) return null;
  const tokens = inputBlock.trim().split(/\s+/).filter(Boolean);
  if (n > tokens.length) return null;
  return tokens[n - 1];
}

function normalizeNonEmptyLines(inputBlock) {
  return inputBlock
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * Codeforces-style batch input: first line is T ( lone integer ), remaining lines split into T equal chunks.
 * When the checker says "kth numbers differ" and k <= T, chunk k is very often the failing test's input (one scalar per test output).
 * If k > T or layout does not fit, returns null and caller falls back to Nth token over stdin **after** the header line (see `bodyTextAfterBatchHeader`).
 */
function tryNthUniformTestCaseInput(lines, caseIndex1Based) {
  if (!caseIndex1Based || caseIndex1Based < 1 || lines.length < 2) return null;
  const header = lines[0];
  if (!/^-?\d+$/.test(header)) return null;
  const t = parseInt(header, 10);
  if (!Number.isFinite(t) || t < 1) return null;
  const restCount = lines.length - 1;
  if (restCount % t !== 0) return null;
  const k = restCount / t;
  if (caseIndex1Based > t) return null;
  const start = 1 + (caseIndex1Based - 1) * k;
  return lines.slice(start, start + k).join("\n");
}

/** Smallest k such that the first two blocks of k lines match (detects lines-per-test when input is truncated). */
function inferChunkSizeFromRepeatedPrefix(bodyLines, maxK = 48) {
  const m = bodyLines.length;
  if (m < 2) return null;
  for (let k = 1; k <= maxK && 2 * k <= m; k++) {
    let ok = true;
    for (let i = 0; i < k; i++) {
      if (bodyLines[i] !== bodyLines[k + i]) {
        ok = false;
        break;
      }
    }
    if (ok) return k;
  }
  return null;
}

/**
 * When the full stdin is not in the DOM, uniform split fails. Infer k from repeating testcase pattern,
 * or treat visible tail as one testcase (T===1 or first case only in view).
 */
function tryNthTruncatedOrPeriodicBatchInput(lines, caseIndex1Based) {
  if (!caseIndex1Based || caseIndex1Based < 1 || lines.length < 2) return null;
  const header = lines[0];
  if (!/^-?\d+$/.test(header)) return null;
  const t = parseInt(header, 10);
  if (!Number.isFinite(t) || t < 1) return null;
  if (caseIndex1Based > t) return null;

  const body = lines.slice(1);
  const m = body.length;
  if (m < 1) return null;

  const kPeriodic = inferChunkSizeFromRepeatedPrefix(body);
  if (kPeriodic != null) {
    const start = (caseIndex1Based - 1) * kPeriodic;
    if (start >= m) return null;
    const end = Math.min(start + kPeriodic, m);
    return body.slice(start, end).join("\n");
  }

  if (caseIndex1Based !== 1) return null;

  if (t === 1) {
    return body.slice(0, m).join("\n");
  }

  /** Truncated UI often shows only the start of test 1; cap avoids swallowing many different cases when pattern never repeats. */
  const maxFirstCaseLinesWhenTGreaterThanOne = 24;
  if (m <= maxFirstCaseLinesWhenTGreaterThanOne) {
    return body.slice(0, m).join("\n");
  }

  return null;
}

/** First line is never part of a test case on CF batch: lone integer T then all testcase data. */
function bodyTextAfterBatchHeader(lines) {
  if (lines.length >= 2 && /^-?\d+$/.test(lines[0])) {
    return lines.slice(1).join("\n");
  }
  return lines.join("\n");
}

/**
 * User-specified k lines per test. After a lone-integer T line, body is the rest; otherwise the whole stdin is body.
 * Test case c (1-based) uses body lines [(c-1)*k, c*k).
 */
function tryNthExplicitLinesPerTest(lines, caseIndex1Based, linesPerTest) {
  if (!caseIndex1Based || caseIndex1Based < 1 || linesPerTest == null) return null;
  const k = Math.floor(Number(linesPerTest));
  if (!Number.isFinite(k) || k < 1) return null;
  if (!lines.length) return null;

  const hasBatchHeader = /^-?\d+$/.test(lines[0]);
  const body = hasBatchHeader ? lines.slice(1) : lines;
  const start = (caseIndex1Based - 1) * k;
  if (start >= body.length) return null;
  return body.slice(start, start + k).join("\n");
}

function extractNthInputFromStdin(inputBlock, nthIndex, linesPerTest) {
  if (!inputBlock || !nthIndex || nthIndex < 1) return null;
  const trimmed = String(inputBlock).trim();
  const lines = normalizeNonEmptyLines(trimmed);

  const explicit = tryNthExplicitLinesPerTest(lines, nthIndex, linesPerTest);
  if (explicit != null) return explicit;

  const fromUniform = tryNthUniformTestCaseInput(lines, nthIndex);
  if (fromUniform != null) return fromUniform;
  const fromTruncated = tryNthTruncatedOrPeriodicBatchInput(lines, nthIndex);
  if (fromTruncated != null) return fromTruncated;
  const tokenSource = bodyTextAfterBatchHeader(lines);
  return extractNthTokenFromInput(tokenSource, nthIndex);
}

/** Last line that mentions wrong answer (checker log is usually the final WA line). */
function findLastWrongAnswerLine(rawText) {
  if (!rawText) return "";
  const lines = rawText.replace(/\r/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
  const wa = lines.filter((l) => /wrong answer/i.test(l));
  return wa.length ? wa[wa.length - 1] : "";
}

function parseNumbersDifferLine(line) {
  const compact = line.replace(/\s+/g, " ").trim();
  let numbersDifferMatch = compact.match(
    /wrong answer(?:\s+(\d+)(?:st|nd|rd|th))?\s+numbers differ\s*-\s*expected:\s*'([^']*)',\s*found:\s*'([^']*)'/i
  );
  if (!numbersDifferMatch) {
    numbersDifferMatch = compact.match(
      /wrong answer(?:\s+(\d+)(?:st|nd|rd|th))?\s+numbers differ\s*-\s*expected:\s*"([^"]*)",\s*found:\s*"([^"]*)"/i
    );
  }
  if (!numbersDifferMatch) return null;
  return {
    testIndex: numbersDifferMatch[1] ? Number(numbersDifferMatch[1]) : null,
    expected: numbersDifferMatch[2].trim(),
    actual: numbersDifferMatch[3].trim(),
    checkerLine: line.trim()
  };
}

function parseFailureText(rawText) {
  const text = rawText.replace(/\r/g, "\n");
  const lastWaLine = findLastWrongAnswerLine(text);

  if (lastWaLine) {
    const fromChecker = parseNumbersDifferLine(lastWaLine);
    if (fromChecker) {
      return {
        testIndex: fromChecker.testIndex,
        expected: fromChecker.expected,
        actual: fromChecker.actual,
        checkerLine: fromChecker.checkerLine
      };
    }
  }

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const joined = lines.join(" ");

  const fromJoined = parseNumbersDifferLine(joined);
  if (fromJoined) {
    return {
      testIndex: fromJoined.testIndex,
      expected: fromJoined.expected,
      actual: fromJoined.actual,
      checkerLine: lastWaLine || fromJoined.checkerLine
    };
  }

  const testIndexMatch =
    joined.match(/(?:test|input)\s*#?\s*(\d+)/i) ||
    joined.match(/(\d+)(?:st|nd|rd|th)\s+input/i);
  const expectedMatch =
    joined.match(/(?:expected|answer|correct output)\s*[:=]\s*['"]?([^'"\n;,]+)['"]?/i) ||
    joined.match(/(?:is|was)\s*([-\d]+(?:\.\d+)?)\s*(?:but|and)\s*(?:my|your|got)/i);
  const actualMatch =
    joined.match(/(?:actual|your output|got|found)\s*[:=]\s*['"]?([^'"\n;,]+)['"]?/i) ||
    joined.match(/(?:my|your)\s+output\s*(?:is|was)?\s*([-\d]+(?:\.\d+)?)/i);

  return {
    testIndex: testIndexMatch ? Number(testIndexMatch[1]) : null,
    expected: expectedMatch ? expectedMatch[1].trim() : null,
    actual: actualMatch ? actualMatch[1].trim() : null,
    checkerLine: lastWaLine || null
  };
}

/**
 * @param {object} parsed - from parseFailureText
 * @param {{ inputBlock: string | null, linesPerTest?: number | null }} options
 */
function buildSlimFailurePayload(parsed, options) {
  const inputBlock = options.inputBlock || null;
  const linesPerTest =
    options.linesPerTest != null && Number(options.linesPerTest) >= 1
      ? Math.floor(Number(options.linesPerTest))
      : null;
  const n = parsed.testIndex;
  const nthInput =
    n && inputBlock && String(inputBlock).trim()
      ? extractNthInputFromStdin(String(inputBlock).trim(), n, linesPerTest)
      : null;

  const out = {
    checkerLine: parsed.checkerLine || null,
    nthIndex: n,
    nthInput,
    nthExpectedOutput: parsed.expected,
    nthYourOutput: parsed.actual
  };
  if (linesPerTest != null) {
    out.linesPerTest = linesPerTest;
  }
  return out;
}
