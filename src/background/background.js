// Background service worker for Gmail Phishing Detector
// Handles LLM API calls and coordinates between content script and popup

import { analyzeEmail } from '../utils/llm.js';
import { getApiKey, getSettings } from '../utils/storage.js';

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ANALYZE_EMAIL') {
    handleAnalyzeEmail(message.data)
      .then(sendResponse)
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (message.type === 'CHECK_API_KEY') {
    getApiKey()
      .then((key) => sendResponse({ hasKey: !!key }))
      .catch(() => sendResponse({ hasKey: false }));
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    getSettings()
      .then((settings) => sendResponse({ settings }))
      .catch(() => sendResponse({ settings: { enabled: true } }));
    return true;
  }
});

async function handleAnalyzeEmail(emailData) {
  const apiKey = await getApiKey();

  if (!apiKey) {
    return {
      success: false,
      error: 'NO_API_KEY',
      message: 'API 키가 설정되지 않았습니다. 확장 프로그램 아이콘을 클릭하여 API 키를 입력해주세요.',
    };
  }

  const settings = await getSettings();
  if (!settings.enabled) {
    return {
      success: false,
      error: 'EXTENSION_DISABLED',
      message: '확장 프로그램이 비활성화되어 있습니다.',
    };
  }

  try {
    const result = await analyzeEmail(apiKey, emailData);
    return result;
  } catch (error) {
    console.error('[PhishingDetector] Analysis error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Keep service worker alive
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "PING") {
    sendResponse({ pong: true });
    return true;
  }
});

// Set extension icon badge when installed
chrome.runtime.onInstalled.addListener(() => {
  console.log('[PhishingDetector] Extension installed successfully');
});