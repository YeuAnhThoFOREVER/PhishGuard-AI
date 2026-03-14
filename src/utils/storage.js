// chrome.storage.local wrapper for API key and settings management

export async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['gemini_api_key'], (result) => {
      resolve(result.gemini_api_key || null);
    });
  });
}

export async function setApiKey(key) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ gemini_api_key: key }, () => {
      resolve(true);
    });
  });
}

export async function clearApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['gemini_api_key'], () => {
      resolve(true);
    });
  });
}

export async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (result) => {
      resolve(result.settings || { enabled: true, language: 'ko' });
    });
  });
}

export async function setSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings }, () => {
      resolve(true);
    });
  });
}
