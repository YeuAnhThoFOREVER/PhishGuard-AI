# Security Audit Report

**Project:** Gmail Phishing Detector (Chrome Extension)
**Date:** 2026-03-17
**Version:** 1.0.0
**Auditor:** Automated Security Review

---

## Executive Summary

The Gmail Phishing Detector is a Chrome Manifest V3 browser extension that analyzes emails on Gmail for phishing indicators using the Anthropic Claude API. The extension follows a BYOK (Bring Your Own Key) model where users supply their own API key.

Overall, the project demonstrates **good security awareness** with several defensive measures already in place (HTML escaping, input sanitization, output validation, prompt injection resistance, strict CSP). However, there are **several medium and low severity issues** that should be addressed before production deployment.

### Risk Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 2     |
| Medium   | 4     |
| Low      | 5     |
| Info     | 3     |

---

## Findings

### HIGH-1: API Key Exposed in Direct Browser-to-API Calls

**File:** `src/utils/llm.js:231-255`
**Severity:** HIGH
**Category:** Credential Exposure

**Description:**
The extension sends the Anthropic API key directly from the browser to `api.anthropic.com` via the `x-api-key` header, with the `anthropic-dangerous-direct-browser-access: true` header explicitly acknowledging this is a risky pattern. This means:

1. The API key is visible in browser DevTools Network tab to anyone with physical access to the machine or any extension with `webRequest` permissions.
2. Any Chrome extension with `webRequestBlocking` permission on `api.anthropic.com` can intercept and steal the API key.
3. The key is stored in `chrome.storage.local`, which is not encrypted at rest and can be read by any code running in the extension's context.

**Recommendation:**
- Document this risk clearly to users in the UI.
- Consider implementing a backend proxy that holds the API key server-side, though this changes the BYOK architecture.
- At minimum, warn users not to use high-privilege API keys and to set usage limits on their Anthropic accounts.

---

### HIGH-2: Email Content Sent to Third-Party API Without Explicit Consent Per-Email

**File:** `src/content/content.js:149-193`, `src/utils/llm.js:206-289`
**Severity:** HIGH
**Category:** Privacy / Data Leakage

**Description:**
When enabled, the extension automatically extracts and transmits email content (sender, subject, body text up to 3000 chars, and up to 30 links) to the Anthropic API for every email the user opens. There is no per-email consent prompt, and the user may not realize that sensitive or confidential email contents are being sent to a third-party service.

**Impacted data:**
- Email sender name and address
- Email subject line
- Email body (first 3000 characters)
- All hyperlinks in the email (up to 30)
- Homoglyph detection results

**Recommendation:**
- Add a clear privacy notice in the popup explaining exactly what data is transmitted.
- Consider adding a manual "Analyze" button mode as an alternative to automatic analysis.
- Consider adding a privacy mode that redacts or hashes sensitive content before sending to the API.

---

### MEDIUM-1: innerHTML Used for Sidebar Rendering

**File:** `src/content/content.js:353`
**Severity:** MEDIUM
**Category:** Cross-Site Scripting (XSS)

**Description:**
The sidebar is rendered using `sidebarContainer.innerHTML = html` at line 353. While the code does use `escapeHTML()` on all dynamic values (email addresses, error messages, analysis results), the use of `innerHTML` for constructing complex DOM structures is inherently risky. A single missed escaping point would lead to XSS in the context of `mail.google.com`, which would be a critical vulnerability.

**Current mitigations already in place:**
- `escapeHTML()` function at lines 17-25 covers all five HTML special characters (`&`, `<`, `>`, `"`, `'`).
- Category and risk values are validated against whitelists at lines 407-409.
- LLM output is validated via `validateAnalysis()` in `llm.js:91-136`.

**Remaining risks:**
- The `baseStyle` variable (line 237) is injected directly into inline style attributes. While it is a hardcoded string and not user-controlled, any future modification that introduces dynamic data into style attributes could lead to CSS injection.
- The `riskColors` object (lines 390-394) uses hardcoded gradient strings in inline styles. These are safe currently but could become vectors if modified.

**Recommendation:**
- Consider migrating to DOM API methods (`createElement`, `textContent`, `setAttribute`) instead of `innerHTML` for a defense-in-depth approach.
- Add code comments marking `baseStyle` and `riskColors` as security-sensitive constants that must never include dynamic data.

---

### MEDIUM-2: Prompt Injection Resistance Is Not Guaranteed

**File:** `src/utils/llm.js:12-55` (SYSTEM_PROMPT), `src/utils/llm.js:211-229` (user prompt)
**Severity:** MEDIUM
**Category:** AI/LLM Security

**Description:**
The system prompt instructs the LLM to treat email content as data only (between `<<<EMAIL_START>>>` and `<<<EMAIL_END>>>` delimiters) and to flag prompt injection attempts. However, prompt injection defenses based purely on prompt engineering are not guaranteed to work. A sophisticated attacker could craft email content that:

1. Convinces the LLM to return `"riskLevel": "safe"` for a phishing email.
2. Injects instructions that alter the JSON output structure.
3. Bypasses the delimiter-based isolation.

**Current mitigations already in place:**
- Delimiter-based content isolation (`<<<EMAIL_START>>>` / `<<<EMAIL_END>>>`).
- System prompt explicitly warns about prompt injection.
- Output validation (`validateAnalysis()`) ensures the response conforms to expected schema and value ranges.
- Input truncation limits the attack surface.

**Remaining risk:**
The LLM could still be manipulated into returning `"riskLevel": "safe"` with `"riskScore": 0` for a genuinely dangerous email. The output validation only checks data types and value ranges, not semantic correctness.

**Recommendation:**
- Document in the UI that AI analysis is not a guarantee and users should always exercise personal judgment.
- Consider dual-model verification for high-confidence results.
- Add a disclaimer that the tool is an aid, not a definitive security solution.

---

### MEDIUM-3: Duplicate `onMessage` Listener Registration

**File:** `src/background/background.js:8` and `src/background/background.js:64`
**Severity:** MEDIUM
**Category:** Logic Error / Reliability

**Description:**
Two separate `chrome.runtime.onMessage.addListener()` calls are registered in the background script:
- Lines 8-29: Handles `ANALYZE_EMAIL`, `CHECK_API_KEY`, `GET_SETTINGS`.
- Lines 64-69: Handles `PING`.

Both listeners receive all messages. When a `PING` message arrives, the first listener (lines 8-29) does not return `true` or call `sendResponse`, which means it falls through without handling the message. While Chrome handles this gracefully, having multiple listeners is a code smell and can lead to unexpected behavior if one listener interferes with another's async response lifecycle.

**Recommendation:**
- Consolidate into a single `onMessage` listener with a `switch` statement on `message.type`.

---

### MEDIUM-4: No Rate Limiting on Client Side for API Calls

**File:** `src/content/content.js:11`, `src/content/content.js:126`
**Severity:** MEDIUM
**Category:** Denial of Wallet

**Description:**
While there is a 30-second cooldown between analyses (`ANALYSIS_COOLDOWN_MS = 30000`), a user browsing through many emails could still trigger substantial API costs. The comment on line 11 says "Minimum 5 seconds" but the actual value is 30 seconds - this is inconsistent documentation but the implemented value (30s) is reasonable.

Additionally, there is no cumulative daily/hourly rate limit. A user opening many emails in rapid succession (each after the 30-second cooldown) could generate significant API costs over a session.

**Recommendation:**
- Fix the comment on line 11 to say "30 seconds" instead of "5 seconds".
- Consider adding a daily analysis count limit or a cost warning after N analyses.
- Consider caching analysis results to avoid re-analyzing the same email content.

---

### LOW-1: Weak Email Content Hashing for Deduplication

**File:** `src/content/content.js:136-144`
**Severity:** LOW
**Category:** Logic Error

**Description:**
The `simpleHash()` function uses a basic DJB2-like hash on only the first 100 characters of the email body (`emailContent = emailBody.innerText.substring(0, 100)` at line 121). This has two issues:

1. **Collision risk:** Two different emails with the same first 100 characters of body text will be treated as identical, causing the second one to be skipped.
2. **Hash quality:** The DJB2 hash converted to base-36 is used for deduplication. While collisions are unlikely in practice for typical email browsing, it is theoretically possible.

**Recommendation:**
- Include more data points in the hash (e.g., sender + subject + body prefix) to reduce collision risk.

---

### LOW-2: API Key Format Validation Is Minimal

**File:** `src/popup/Popup.jsx:34`
**Severity:** LOW
**Category:** Input Validation

**Description:**
The API key validation only checks that the key starts with `sk-ant-`. This is a basic prefix check and does not validate:
- Key length
- Character set (only alphanumeric and hyphens expected)
- Key format structure

Malformed keys will simply fail at the API call, but storing arbitrary strings that happen to start with `sk-ant-` could cause confusing error messages.

**Recommendation:**
- Add a regex pattern to validate the expected key format more precisely.

---

### LOW-3: No Sender Verification for `chrome.runtime.onMessage`

**File:** `src/background/background.js:8-29`
**Severity:** LOW
**Category:** Input Validation

**Description:**
The `onMessage` listener in the background script does not verify that messages come from the extension's own content script. The `sender` parameter is available but unused. While Chrome's extension messaging system restricts cross-extension messaging by default, verifying the sender's tab URL (should be `mail.google.com`) would provide defense-in-depth.

**Recommendation:**
- Verify `sender.tab?.url` starts with `https://mail.google.com/` before processing `ANALYZE_EMAIL` messages.
- Alternatively, verify `sender.id === chrome.runtime.id` for all message types.

---

### LOW-4: Console Logging in Production Code

**File:** Multiple files
**Severity:** LOW
**Category:** Information Disclosure

**Description:**
Several `console.log` and `console.error` statements are present in production code:
- `content.js:31` - logs script loading
- `content.js:35` - logs Gmail detection
- `content.js:162` - logs missing content
- `content.js:188` - logs analysis errors
- `background.js:55` - logs analysis errors
- `background.js:73` - logs installation
- `llm.js:198` - logs JSON parse failures

While not a direct vulnerability, these logs could leak:
- Timing information about when analyses occur
- Error details that could help an attacker understand internal state
- Confirmation that the extension is active and analyzing emails

**Recommendation:**
- Remove or guard console statements behind a `DEBUG` flag for production builds.

---

### LOW-5: MutationObserver on Broad Subtree

**File:** `src/content/content.js:65-81`
**Severity:** LOW
**Category:** Performance / Stability

**Description:**
The MutationObserver watches the entire `[role="main"]` subtree with `{ childList: true, subtree: true }`. Gmail's DOM is highly dynamic, so this observer fires very frequently. While there is a cooldown mechanism, the observer callback itself runs on every DOM mutation, which could impact Gmail's performance on slower machines.

**Recommendation:**
- Consider narrowing the observation scope if possible.
- Add a debounce to `checkForEmailView()` to reduce processing on rapid DOM changes.

---

### INFO-1: Good Security Practices Observed

The following security practices are already well-implemented:

| Practice | Location | Notes |
|----------|----------|-------|
| HTML escaping | `content.js:17-25` | All 5 critical chars escaped |
| Input sanitization | `llm.js:69-85` | All fields truncated to safe lengths |
| Output validation | `llm.js:91-136` | Whitelist-based validation of LLM output |
| Prompt injection resistance | `llm.js:12-55` | Delimiter isolation + explicit instructions |
| Strict CSP | `manifest.json:37-39` | `script-src 'self'; object-src 'self'` |
| Minimal permissions | `manifest.json:30-36` | Only `storage` and `activeTab` |
| Scoped content scripts | `manifest.json:22-28` | Only runs on `mail.google.com` |
| No hardcoded secrets | All files | BYOK pattern, no embedded keys |
| .gitignore covers .env | `.gitignore:5` | Environment files excluded from VCS |
| API error handling | `llm.js:257-265` | 401/429 specifically handled |

---

### INFO-2: Dependency Assessment

| Package | Version | Role | Notes |
|---------|---------|------|-------|
| react | ^19.0.0 | Runtime | Popup UI. No known security issues. |
| react-dom | ^19.0.0 | Runtime | DOM rendering. No known security issues. |
| vite | ^6.0.0 | Dev only | Build tool. Not shipped to users. |
| @vitejs/plugin-react | ^4.3.0 | Dev only | Not shipped. |
| tailwindcss | ^4.0.0 | Dev only | CSS framework. Not shipped as JS. |
| @tailwindcss/vite | ^4.0.0 | Dev only | Not shipped. |

The dependency footprint is minimal. Only `react` and `react-dom` are runtime dependencies, and they are well-maintained. All other dependencies are dev-only and do not ship in the extension bundle.

**Note:** `npm audit` could not be run in this environment. It is recommended to run `npm audit` periodically and before releases.

---

### INFO-3: Manifest V3 Compliance

The extension correctly uses Chrome Manifest V3 with:
- Service worker instead of persistent background page
- No `webRequest` / `webRequestBlocking` permissions
- No `tabs` permission (uses `activeTab` instead)
- No remote code execution capabilities
- Restrictive CSP without `unsafe-eval` or `unsafe-inline`

This is the correct security posture for a modern Chrome extension.

---

## Summary of Recommendations

### Priority 1 (Address Before Release)

1. **Add clear privacy notice** about email data being sent to Anthropic API (HIGH-2).
2. **Add manual analysis option** so users can choose when to send email data (HIGH-2).
3. **Document API key exposure risk** and recommend setting billing limits (HIGH-1).
4. **Fix the inconsistent comment** on cooldown timer (MEDIUM-4, line 11).

### Priority 2 (Should Fix)

5. **Consolidate message listeners** in background.js into a single handler (MEDIUM-3).
6. **Verify message sender** in background.js `onMessage` handler (LOW-3).
7. **Consider DOM API** instead of `innerHTML` for sidebar rendering (MEDIUM-1).
8. **Add a UI disclaimer** that AI analysis is not a guarantee (MEDIUM-2).

### Priority 3 (Nice to Have)

9. **Improve email deduplication hash** to include more data points (LOW-1).
10. **Strengthen API key format validation** with a regex (LOW-2).
11. **Remove or guard console.log statements** in production (LOW-4).
12. **Add daily analysis count limits** or cost warnings (MEDIUM-4).
13. **Add debounce to MutationObserver** callback (LOW-5).

---

## Conclusion

The Gmail Phishing Detector demonstrates solid security fundamentals for a Chrome extension project. The most significant concerns relate to privacy (automatic transmission of email content to a third-party API) and credential management (API key exposure in browser context). No critical vulnerabilities were found that would allow direct exploitation, but the medium-severity items should be addressed to improve the extension's security posture before production deployment.
