// chrome.storage.local wrapper for API key and settings management

export async function getApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['anthropic_api_key'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('[PhishingDetector] Storage read error:', chrome.runtime.lastError.message);
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(result.anthropic_api_key || null);
    });
  });
}

export async function setApiKey(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ anthropic_api_key: key }, () => {
      if (chrome.runtime.lastError) {
        console.error('[PhishingDetector] Storage write error:', chrome.runtime.lastError.message);
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(true);
    });
  });
}

export async function clearApiKey() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove(['anthropic_api_key'], () => {
      if (chrome.runtime.lastError) {
        console.error('[PhishingDetector] Storage remove error:', chrome.runtime.lastError.message);
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(true);
    });
  });
}

export async function getSettings() {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['settings'], (result) => {
      if (chrome.runtime.lastError) {
        console.error('[PhishingDetector] Storage read error:', chrome.runtime.lastError.message);
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(result.settings || { enabled: true, language: 'ko' });
    });
  });
}

export async function setSettings(settings) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ settings }, () => {
      if (chrome.runtime.lastError) {
        console.error('[PhishingDetector] Storage write error:', chrome.runtime.lastError.message);
        return reject(new Error(chrome.runtime.lastError.message));
      }
      resolve(true);
    });
  });
}
