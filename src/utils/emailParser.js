// Gmail DOM parsing utilities for email data extraction

/**
 * Extract sender email address from the currently open email
 */
export function extractSenderAddress() {
  // Gmail uses data-hovercard-id or the "from" span with email attribute
  const senderEl = document.querySelector('span[email]');
  if (senderEl) {
    return {
      email: senderEl.getAttribute('email'),
      name: senderEl.textContent.trim(),
    };
  }

  // Fallback: look for the gD class (sender container)
  const gdEl = document.querySelector('.gD');
  if (gdEl) {
    return {
      email: gdEl.getAttribute('email') || '',
      name: gdEl.textContent.trim(),
    };
  }

  return { email: '', name: '' };
}

/**
 * Extract subject line from the currently open email
 */
export function extractSubject() {
  // Gmail subject is in h2 with class hP
  const subjectEl = document.querySelector('h2.hP');
  if (subjectEl) {
    return subjectEl.textContent.trim();
  }

  // Fallback
  const altSubject = document.querySelector('[data-legacy-thread-id] h2');
  if (altSubject) {
    return altSubject.textContent.trim();
  }

  return '';
}

/**
 * Extract email body text from the currently open email
 */
export function extractBodyText() {
  // Gmail email body container class
  const bodyEl = document.querySelector('.a3s.aiL');
  if (bodyEl) {
    return bodyEl.innerText.trim();
  }

  // Fallback: try alternate selectors
  const altBody = document.querySelector('[data-message-id] .ii.gt div');
  if (altBody) {
    return altBody.innerText.trim();
  }

  return '';
}

/**
 * Extract all links from the email body
 */
export function extractLinks() {
  const bodyEl = document.querySelector('.a3s.aiL');
  if (!bodyEl) return [];

  const links = bodyEl.querySelectorAll('a[href]');
  return Array.from(links).map((link) => ({
    text: link.textContent.trim(),
    href: link.getAttribute('href'),
    // Check if displayed text differs from actual href (common phishing technique)
    isMismatched: link.textContent.trim().startsWith('http') &&
      !link.getAttribute('href').includes(link.textContent.trim().replace(/https?:\/\//, '').split('/')[0]),
  }));
}

/**
 * Extract all email data from the currently open email view
 */
export function extractEmailData() {
  const sender = extractSenderAddress();
  const subject = extractSubject();
  const body = extractBodyText();
  const links = extractLinks();

  return {
    sender,
    subject,
    body,
    links,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Homoglyph detection - characters that look similar but are different
 * Common in spear phishing attacks
 */
const HOMOGLYPH_MAP = {
  'а': 'a', // Cyrillic а vs Latin a
  'е': 'e', // Cyrillic е vs Latin e
  'о': 'o', // Cyrillic о vs Latin o
  'р': 'p', // Cyrillic р vs Latin p
  'с': 'c', // Cyrillic с vs Latin c
  'у': 'y', // Cyrillic у vs Latin y
  'х': 'x', // Cyrillic х vs Latin x
  'ѕ': 's', // Cyrillic ѕ vs Latin s
  'і': 'i', // Cyrillic і vs Latin i
  'ј': 'j', // Cyrillic ј vs Latin j
  'ɡ': 'g', // Latin small letter script g
  'ɑ': 'a', // Latin small letter alpha
  'ℊ': 'g', // Script small g
  'ⅰ': 'i', // Roman numeral one
  'ⅱ': 'ii',
  'ℓ': 'l', // Script small l
  '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
  '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
  'ⓐ': 'a', 'ⓑ': 'b', 'ⓒ': 'c', 'ⓓ': 'd', 'ⓔ': 'e',
};

/**
 * Check if an email address contains homoglyph characters
 */
export function detectHomoglyphs(email) {
  const suspicious = [];
  for (let i = 0; i < email.length; i++) {
    const char = email[i];
    if (HOMOGLYPH_MAP[char]) {
      suspicious.push({
        position: i,
        original: char,
        looksLike: HOMOGLYPH_MAP[char],
        context: email.substring(Math.max(0, i - 3), Math.min(email.length, i + 4)),
      });
    }
  }
  return suspicious;
}

/**
 * Check for common character substitution tricks
 * e.g., 'rn' looks like 'm', '1' looks like 'l', '0' looks like 'O'
 */
export function detectCharacterTricks(email) {
  const tricks = [];
  const domain = email.split('@')[1] || '';

  // Check for 'rn' that could be confused with 'm'
  if (domain.includes('rn')) {
    tricks.push({
      type: 'rn_as_m',
      description: '"rn" 이 "m" 과 유사하게 보일 수 있습니다',
      context: domain,
    });
  }

  // Check for '1' vs 'l'
  if (domain.match(/[1l]/)) {
    const hasOne = domain.includes('1');
    const hasL = domain.includes('l');
    if (hasOne) {
      tricks.push({
        type: 'one_as_l',
        description: '숫자 "1" 이 소문자 "l" 과 유사하게 보일 수 있습니다',
        context: domain,
      });
    }
  }

  // Check for '0' vs 'O'
  if (domain.match(/[0O]/)) {
    tricks.push({
      type: 'zero_as_O',
      description: '숫자 "0" 과 대문자 "O" 가 유사하게 보일 수 있습니다',
      context: domain,
    });
  }

  return tricks;
}
