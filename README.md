# CP Failed Case Helper

This project gives you:

1. A browser extension to:
   - extract failed-case details: **last** `wrong answer` checker line, **Nth input** token, and **Nth output** pair (`expected` / `found` from that line)
   - scrape sample tests from CP problem pages and download them as `tests.json`
2. A local test runner script that behaves like CPH-style testing:
   - runs all tests against your program
   - prints pass/fail per test
   - prints full JSON of first failing test with `input`, `expected`, `actual`

## 1) Load the extension

### Chrome / Edge

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select folder: `cp-helper-extension/extension`

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select `cp-helper-extension/extension/manifest.json`

Supported websites (best effort):
- Codeforces
- AtCoder
- CodeChef

## 2) Extract failed details

Open the extension popup and choose **From page** or **Manual paste** at the top (your choice is remembered).

**Lines per test input** (optional number field below the mode tabs): set this to `k` when each testcase uses exactly `k` lines after the lone `T` line (or `k` lines from the start of stdin if there is no `T` line). The extension then takes **those `k` lines** for the failing index from the checker (e.g. 1st / 26th). If you leave it empty, it keeps using automatic detection. When set, the result includes `linesPerTest`.

Then:

### From page

Open your submission/error page and click the extension icon:

- **Extract failed case**: finds the **last** line containing `wrong answer` (e.g. Codeforces checker log), parses `Nth numbers differ`, then copies **only**:
  - `checkerLine` — that full line
  - `nthIndex` — e.g. `26` from `26th`
  - `nthInput` — **line 1 (T) is never part of a test case.** If the full input is in the page, uses **T equal line-blocks**. If Codeforces **truncates** the textarea so the line count no longer divides **T**, the extension tries **repeating blocks** (two identical k-line prefixes) to learn **k**, then slices the **k** lines for the failing case. If there is no repeat but you are on **case 1** and only a short prefix is visible, it returns that prefix (up to 24 lines when **T > 1**, or all visible lines when **T === 1**). Otherwise it falls back to the **k-th token** after the **T** line. Non-numeric checker values (`YES` / `NO`) work when quoted with `'` or `"` in the verdict line.
  - `nthExpectedOutput` / `nthYourOutput` — from `expected: '…', found: '…'` on that line (the Nth output values the checker reports)
- Example line: `wrong answer 26th numbers differ - expected: '8', found: '9'`
- **Copy result**: copies the same **human-readable** summary as the popup (real newlines and tabs; literal `\n`, `\t`, `\r`, `\\` in strings are expanded). Per-field copy buttons do the same for that value.
### Manual paste

Switch to **Manual paste** to show the textareas (hidden in **From page** mode). **Manual parse** (works on any tab, no Codeforces page required):
  - Paste the **checker line** (e.g. `wrong answer 26th numbers differ - expected: '8', found: '9'`).
  - Optionally paste **full test input** to compute **`nthInput`** (the Nth whitespace-separated token).
  - Use **Copy checker line**, **Copy Nth input**, **Copy expected**, **Copy found** for one-click clipboard copies (each button enables only when that field is present).

## 3) Export sample tests

On a problem page:

- Click **Scrape sample tests**
- Click **Download tests.json**

## 4) Run all tests in VS Code terminal

From `cp-helper-extension`:

```bash
node scripts/run-tests.js tests.json "python3 solution.py"
```

or C++:

```bash
node scripts/run-tests.js tests.json "./a.out"
```

Output includes the first failing case in machine-readable JSON:

```json
{
  "index": 26,
  "input": "...",
  "expected": "8",
  "actual": "9"
}
```

## 5) VS Code task

A task is included at:

- `.vscode/tasks.json`

You can run it with **Run Task**:

- `CP: Run all tests from tests.json`

Edit command in that file to match your language/run command.

## Notes

- This extension is intentionally best-effort because each judge website formats verdict text differently.
- If a site blocks direct extraction of hidden failing input, you still get parsed index/expected/actual from the visible error message.

### Why extraction used to show `rawMessage: "3"` on Codeforces Status

The old logic took the **first** matching CSS selector (e.g. `.verdict-format-judged`). On the status page that node can be a **tiny** snippet (like a single digit), not the checker line. The fix is to read **page text that contains the checker message** (`wrong answer … numbers differ`), take the **last** such line, and to locate the **large `pre`** that holds the test input only long enough to read the **Nth token** (nothing else is copied).
