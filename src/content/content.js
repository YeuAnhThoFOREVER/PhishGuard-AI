// Content script for Gmail Phishing Detector
// Uses MutationObserver to detect email opens in Gmail's SPA

import { extractEmailData, detectHomoglyphs, detectCharacterTricks } from '../utils/emailParser.js';

let currentEmailId = null;
let sidebarContainer = null;
let observer = null;
let analysisInProgress = false;

/**
 * Initialize the content script
 */
function init() {
  console.log('[PhishingDetector] Content script loaded on Gmail');
  
  // Wait for Gmail to fully load
  waitForGmail().then(() => {
    console.log('[PhishingDetector] Gmail detected, starting observer');
    startObserver();
  });
}

/**
 * Wait for Gmail's main interface to load
 */
function waitForGmail() {
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      // Gmail main container
      const mainContent = document.querySelector('[role="main"]');
      if (mainContent) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 1000);

    // Timeout after 30 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      resolve();
    }, 30000);
  });
}

/**
 * Start MutationObserver to watch for email opens
 */
function startObserver() {
  const targetNode = document.querySelector('[role="main"]') || document.body;

  observer = new MutationObserver((mutations) => {
    // Check if an email view has appeared
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        checkForEmailView();
      }
    }
  });

  observer.observe(targetNode, {
    childList: true,
    subtree: true,
  });

  // Listen for URL hash changes (Gmail navigation)
  let lastHash = window.location.hash;
  setInterval(() => {
    if (window.location.hash !== lastHash) {
      lastHash = window.location.hash;
      currentEmailId = null;
      checkForEmailView();
    }
  }, 500);

  // Also check current state in case email is already open
  checkForEmailView();
}

/**
 * Check if we're currently viewing an email
 */
function checkForEmailView() {
  const emailBody = document.querySelector('.a3s.aiL');
  if (!emailBody) {
    // Not viewing an email, remove sidebar if present
    if (sidebarContainer) {
      removeSidebar();
    }
    currentEmailId = null;
    return;
  }

  // Generate a simple ID for this email view based on content hash
  const emailContent = emailBody.innerText.substring(0, 100);
  const emailId = simpleHash(emailContent);

  // Only analyze if it's a new email
  if (emailId !== currentEmailId && !analysisInProgress) {
    currentEmailId = emailId;
    analyzeCurrentEmail();
  }
}

/**
 * Simple hash function for email content identification
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Analyze the currently open email
 */
async function analyzeCurrentEmail() {
  analysisInProgress = true;

  try {
    const emailData = extractEmailData();

    if (!emailData.body && !emailData.subject) {
      console.log('[PhishingDetector] No email content found');
      analysisInProgress = false;
      return;
    }

    // Run local checks
    emailData.homoglyphs = detectHomoglyphs(emailData.sender.email);
    emailData.characterTricks = detectCharacterTricks(emailData.sender.email);

    // Show loading state
    injectSidebar('loading', null, emailData);

    // Send to background for LLM analysis
    const response = await chrome.runtime.sendMessage({
      type: 'ANALYZE_EMAIL',
      data: emailData,
    });

    if (response.success) {
      injectSidebar('result', response.data, emailData);
    } else if (response.error === 'NO_API_KEY') {
      injectSidebar('no-key', null, emailData);
    } else {
      injectSidebar('error', response, emailData);
    }
  } catch (error) {
    console.error('[PhishingDetector] Error analyzing email:', error);
    injectSidebar('error', { error: error.message }, null);
  } finally {
    analysisInProgress = false;
  }
}

/**
 * Inject or update the sidebar into Gmail's DOM
 */
function injectSidebar(state, data, emailData) {
  removeSidebar();

  sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'phishing-detector-sidebar';

  // Find the email view container and inject sidebar
  const emailContainer = document.querySelector('.nH.bkK') || 
                          document.querySelector('[role="main"]');

  if (emailContainer) {
    emailContainer.style.position = 'relative';
    emailContainer.appendChild(sidebarContainer);
  } else {
    document.body.appendChild(sidebarContainer);
  }

  renderSidebar(state, data, emailData);
}

/**
 * Remove the sidebar from DOM
 */
function removeSidebar() {
  if (sidebarContainer) {
    sidebarContainer.remove();
    sidebarContainer = null;
  }
}

/**
 * Render sidebar content based on state
 */
function renderSidebar(state, data, emailData) {
  if (!sidebarContainer) return;

  let html = '';

  const baseStyle = `
    position: fixed;
    top: 80px;
    right: 20px;
    width: 380px;
    max-height: calc(100vh - 120px);
    overflow-y: auto;
    z-index: 9999;
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
    border-radius: 16px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3), 0 0 1px rgba(0, 0, 0, 0.1);
  `;

  if (state === 'loading') {
    html = `
      <div style="${baseStyle} background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%); color: #e0e0e0; padding: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
          <div style="width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 22px; box-shadow: 0 4px 15px rgba(99,102,241,0.4);">🛡️</div>
          <div style="flex: 1;">
            <div style="font-weight: 700; font-size: 16px; color: #fff;">피싱 분석 중...</div>
            <div style="font-size: 12px; color: #a0a0b0;">AI가 이메일을 분석하고 있습니다</div>
          </div>
          <div id="phishing-progress-pct" style="font-size: 20px; font-weight: 800; color: #a5b4fc; font-family: monospace;">0%</div>
        </div>

        <!-- Progress Bar -->
        <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.08); border-radius: 4px; overflow: hidden; margin-bottom: 20px;">
          <div id="phishing-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa); border-radius: 4px; transition: width 0.5s ease; position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent); animation: shimmer 1.5s infinite;"></div>
          </div>
        </div>

        <!-- Analysis Steps -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div id="step-extract" class="progress-step" style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); border-radius: 10px;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0;">
              <div style="width: 16px; height: 16px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>
            </div>
            <div style="flex: 1;">
              <div style="font-size: 13px; font-weight: 600; color: #e0e0f0;">📧 이메일 데이터 추출</div>
              <div style="font-size: 11px; color: #808090; margin-top: 2px;">발신자, 본문, 링크 분석 중...</div>
            </div>
          </div>

          <div id="step-analyze" class="progress-step" style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; opacity: 0.5;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; color: #606070;">②</div>
            <div style="flex: 1;">
              <div style="font-size: 13px; font-weight: 600; color: #808090;">🤖 AI 피싱 분석</div>
              <div style="font-size: 11px; color: #606070; margin-top: 2px;">Gemini AI가 위험도를 평가합니다</div>
            </div>
          </div>

          <div id="step-checklist" class="progress-step" style="display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; opacity: 0.5;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; color: #606070;">③</div>
            <div style="flex: 1;">
              <div style="font-size: 13px; font-weight: 600; color: #808090;">📋 체크리스트 생성</div>
              <div style="font-size: 11px; color: #606070; margin-top: 2px;">맞춤 보안 체크리스트를 작성합니다</div>
            </div>
          </div>
        </div>

        ${emailData?.sender?.email ? `
        <div style="margin-top: 16px; padding: 10px 12px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 11px; color: #606070;">분석 대상</div>
          <div style="font-size: 12px; color: #a0a0b0; margin-top: 2px;">📧 ${emailData.sender.email}</div>
        </div>` : ''}

        <style>
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        </style>
      </div>
    `;

    // Animate progress after rendering
    setTimeout(() => {
      animateProgress();
    }, 100);
  } else if (state === 'no-key') {
    html = `
      <div style="${baseStyle} background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%); color: #e0e0e0; padding: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #f59e0b, #d97706); display: flex; align-items: center; justify-content: center; font-size: 20px;">🔑</div>
          <div>
            <div style="font-weight: 700; font-size: 16px; color: #fff;">API 키 필요</div>
            <div style="font-size: 12px; color: #a0a0b0;">분석을 위해 API 키를 설정해주세요</div>
          </div>
        </div>
        <p style="font-size: 14px; color: #c0c0d0; line-height: 1.6;">
          확장 프로그램 아이콘을 클릭하여<br>Google Gemini API 키를 입력해주세요.
        </p>
        <div style="margin-top: 12px; padding: 12px; background: rgba(245, 158, 11, 0.1); border-radius: 8px; border: 1px solid rgba(245, 158, 11, 0.2);">
          <p style="font-size: 12px; color: #f59e0b; margin: 0;">💡 API 키는 기기에만 로컬로 저장되며 외부 서버로 전송되지 않습니다.</p>
        </div>
        <button id="phishing-close-btn" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #808090; cursor: pointer; font-size: 18px; padding: 4px 8px;">✕</button>
      </div>
    `;
  } else if (state === 'error') {
    html = `
      <div style="${baseStyle} background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%); color: #e0e0e0; padding: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div style="width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, #ef4444, #dc2626); display: flex; align-items: center; justify-content: center; font-size: 20px;">⚠️</div>
          <div>
            <div style="font-weight: 700; font-size: 16px; color: #fff;">분석 오류</div>
            <div style="font-size: 12px; color: #a0a0b0;">이메일 분석 중 문제가 발생했습니다</div>
          </div>
        </div>
        <p style="font-size: 13px; color: #f87171; margin: 8px 0;">${data?.error || '알 수 없는 오류'}</p>
        <button id="phishing-retry-btn" style="width: 100%; padding: 10px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; margin-top: 8px;">다시 시도</button>
        <button id="phishing-close-btn" style="position: absolute; top: 12px; right: 12px; background: none; border: none; color: #808090; cursor: pointer; font-size: 18px; padding: 4px 8px;">✕</button>
      </div>
    `;
  } else if (state === 'result') {
    html = buildResultHTML(baseStyle, data, emailData);
  }

  sidebarContainer.innerHTML = html;

  // Attach event listeners
  setTimeout(() => {
    const closeBtn = document.getElementById('phishing-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', removeSidebar);
    }

    const retryBtn = document.getElementById('phishing-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        currentEmailId = null;
        checkForEmailView();
      });
    }

    // Checklist item toggles
    document.querySelectorAll('.phishing-check-item').forEach((item) => {
      item.addEventListener('click', () => {
        const checkbox = item.querySelector('.phishing-checkbox');
        if (checkbox) {
          const isChecked = checkbox.getAttribute('data-checked') === 'true';
          checkbox.setAttribute('data-checked', (!isChecked).toString());
          checkbox.innerHTML = isChecked ? '☐' : '☑';
          checkbox.style.color = isChecked ? '#6366f1' : '#22c55e';
          item.style.opacity = isChecked ? '1' : '0.7';
        }
      });
    });
  }, 100);
}

/**
 * Build the result HTML for the analysis sidebar
 */
function buildResultHTML(baseStyle, data, emailData) {
  const riskColors = {
    safe: { bg: '#059669', gradient: 'linear-gradient(135deg, #059669, #10b981)', text: '안전' },
    suspicious: { bg: '#d97706', gradient: 'linear-gradient(135deg, #d97706, #f59e0b)', text: '주의' },
    dangerous: { bg: '#dc2626', gradient: 'linear-gradient(135deg, #dc2626, #ef4444)', text: '위험' },
  };

  const risk = riskColors[data.riskLevel] || riskColors.suspicious;

  const categoryIcons = {
    sender: '👤',
    links: '🔗',
    content: '📝',
    urgency: '⏰',
    attachment: '📎',
  };

  const checklistHTML = data.checklist.map((item, index) => `
    <div class="phishing-check-item" style="display: flex; gap: 12px; padding: 14px; background: rgba(255,255,255,0.03); border-radius: 12px; cursor: pointer; transition: all 0.2s; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.06);">
      <div class="phishing-checkbox" data-checked="false" style="font-size: 20px; color: #6366f1; flex-shrink: 0; margin-top: 2px;">☐</div>
      <div style="flex: 1;">
        <div style="font-size: 14px; color: #e0e0e0; font-weight: 500; line-height: 1.5;">
          ${categoryIcons[item.category] || '🔍'} ${item.question}
        </div>
        <div style="font-size: 12px; color: #808090; margin-top: 6px; line-height: 1.4;">${item.explanation}</div>
        <div style="margin-top: 6px;">
          <span style="font-size: 10px; padding: 2px 8px; border-radius: 4px; background: ${
            item.riskContribution === 'high' ? 'rgba(239,68,68,0.15)' :
            item.riskContribution === 'medium' ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.15)'
          }; color: ${
            item.riskContribution === 'high' ? '#f87171' :
            item.riskContribution === 'medium' ? '#fbbf24' : '#4ade80'
          };">${
            item.riskContribution === 'high' ? '높은 위험' :
            item.riskContribution === 'medium' ? '보통 위험' : '낮은 위험'
          }</span>
        </div>
      </div>
    </div>
  `).join('');

  const techniquesHTML = data.detectedTechniques.length > 0 ? `
    <div style="margin-top: 16px; padding: 14px; background: rgba(239, 68, 68, 0.08); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.15);">
      <div style="font-size: 13px; font-weight: 600; color: #f87171; margin-bottom: 8px;">🚨 감지된 피싱 기법:</div>
      ${data.detectedTechniques.map(t => `<div style="font-size: 12px; color: #fca5a5; padding: 2px 0;">• ${t}</div>`).join('')}
    </div>
  ` : '';

  const homoglyphWarning = emailData?.homoglyphs?.length > 0 ? `
    <div style="margin-top: 12px; padding: 12px; background: rgba(239, 68, 68, 0.12); border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2);">
      <div style="font-size: 12px; font-weight: 600; color: #f87171;">⚠️ 호모글리프 문자 감지:</div>
      <div style="font-size: 11px; color: #fca5a5; margin-top: 4px;">발신자 주소에 일반 문자와 유사한 특수문자가 포함되어 있습니다.</div>
    </div>
  ` : '';

  return `
    <div style="${baseStyle} background: linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%); color: #e0e0e0; padding: 0; display: flex; flex-direction: column;">
      <!-- Header -->
      <div style="padding: 20px 24px; background: ${risk.gradient}; position: relative;">
        <button id="phishing-close-btn" style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.2); border: none; color: white; cursor: pointer; font-size: 16px; padding: 4px 8px; border-radius: 6px;">✕</button>
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 48px; height: 48px; border-radius: 14px; background: rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 24px; backdrop-filter: blur(10px);">🛡️</div>
          <div>
            <div style="font-weight: 800; font-size: 20px; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.2);">${risk.text}</div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.85);">위험도 점수: ${data.riskScore}/100</div>
          </div>
        </div>
        <div style="margin-top: 12px; font-size: 13px; color: rgba(255,255,255,0.9); line-height: 1.5;">${data.summary}</div>
      </div>

      <!-- Scrollbar styling -->
      <style>
        #phishing-detector-sidebar .phishing-scroll-content::-webkit-scrollbar { width: 5px; }
        #phishing-detector-sidebar .phishing-scroll-content::-webkit-scrollbar-track { background: transparent; margin: 8px 0; }
        #phishing-detector-sidebar .phishing-scroll-content::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.25); border-radius: 10px; }
        #phishing-detector-sidebar .phishing-scroll-content::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.5); }
      </style>
      <!-- Content (scrollable) -->
      <div class="phishing-scroll-content" style="padding: 20px 24px; overflow-y: auto; flex: 1; scrollbar-width: thin; scrollbar-color: rgba(99,102,241,0.25) transparent;">
        <!-- Sender Info -->
        ${emailData?.sender?.email ? `
        <div style="margin-bottom: 16px; padding: 12px; background: rgba(255,255,255,0.04); border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="font-size: 11px; color: #808090; margin-bottom: 4px;">발신자</div>
          <div style="font-size: 14px; color: #e0e0e0; font-weight: 500;">${emailData.sender.name}</div>
          <div style="font-size: 12px; color: #a0a0b0;">${emailData.sender.email}</div>
          ${data.senderAnalysis?.similarDomain ? `<div style="font-size: 12px; color: #f59e0b; margin-top: 4px;">⚠️ 유사 도메인: ${data.senderAnalysis.similarDomain}</div>` : ''}
        </div>
        ` : ''}

        ${homoglyphWarning}

        <!-- Checklist -->
        <div style="margin-top: 16px;">
          <div style="font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 12px;">📋 보안 체크리스트</div>
          ${checklistHTML}
        </div>

        ${techniquesHTML}

        <!-- Recommendation -->
        <div style="margin-top: 16px; padding: 14px; background: rgba(99, 102, 241, 0.08); border-radius: 12px; border: 1px solid rgba(99, 102, 241, 0.15);">
          <div style="font-size: 13px; font-weight: 600; color: #a5b4fc; margin-bottom: 6px;">💡 권장 사항</div>
          <div style="font-size: 13px; color: #c0c0d0; line-height: 1.5;">${data.recommendation}</div>
        </div>

        <!-- Footer -->
        <div style="margin-top: 16px; text-align: center;">
          <div style="font-size: 11px; color: #606070;">Powered by AI · Gmail Phishing Detector</div>
          <button id="phishing-retry-btn" style="margin-top: 8px; padding: 8px 16px; background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; cursor: pointer; font-size: 12px;">🔄 다시 분석</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Animate the progress bar during loading state
 */
function animateProgress() {
  const bar = document.getElementById('phishing-progress-bar');
  const pct = document.getElementById('phishing-progress-pct');
  const stepExtract = document.getElementById('step-extract');
  const stepAnalyze = document.getElementById('step-analyze');
  const stepChecklist = document.getElementById('step-checklist');

  if (!bar || !pct) return;

  let progress = 0;
  let currentStep = 0;

  const steps = [
    { target: 30, step: stepExtract, next: stepAnalyze, delay: 40 },
    { target: 80, step: stepAnalyze, next: stepChecklist, delay: 60 },
    { target: 95, step: stepChecklist, next: null, delay: 80 },
  ];

  function activateStep(stepEl) {
    if (!stepEl) return;
    stepEl.style.opacity = '1';
    stepEl.style.background = 'rgba(99,102,241,0.1)';
    stepEl.style.border = '1px solid rgba(99,102,241,0.2)';
    const icon = stepEl.querySelector('div > div:first-child');
    if (icon) {
      icon.style.background = 'linear-gradient(135deg, #6366f1, #8b5cf6)';
      icon.innerHTML = '<div style="width: 16px; height: 16px; border: 2px solid white; border-top: 2px solid transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></div>';
    }
    const texts = stepEl.querySelectorAll('div > div:last-child > div');
    if (texts[0]) texts[0].style.color = '#e0e0f0';
    if (texts[1]) texts[1].style.color = '#808090';
  }

  function completeStep(stepEl) {
    if (!stepEl) return;
    stepEl.style.background = 'rgba(34,197,94,0.08)';
    stepEl.style.border = '1px solid rgba(34,197,94,0.15)';
    const icon = stepEl.querySelector('div > div:first-child');
    if (icon) {
      icon.style.background = 'linear-gradient(135deg, #059669, #10b981)';
      icon.innerHTML = '✓';
      icon.style.color = 'white';
      icon.style.fontSize = '14px';
      icon.style.fontWeight = '700';
    }
  }

  function tick() {
    if (!document.getElementById('phishing-progress-bar')) return; // sidebar removed

    const s = steps[currentStep];
    if (!s) return;

    progress += 1;
    bar.style.width = progress + '%';
    pct.textContent = progress + '%';

    if (progress >= s.target) {
      completeStep(s.step);
      currentStep++;
      if (steps[currentStep]) {
        activateStep(steps[currentStep].step);
      }
    }

    if (progress < 95) {
      setTimeout(tick, steps[currentStep]?.delay || 80);
    }
  }

  // Start the animation
  tick();
}

// Initialize when script loads
init();
