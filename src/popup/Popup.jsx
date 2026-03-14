import React, { useState, useEffect } from 'react';

export default function Popup() {
  const [apiKey, setApiKey] = useState('');
  const [savedKey, setSavedKey] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    // Load saved settings
    chrome.storage.local.get(['gemini_api_key', 'settings'], (result) => {
      if (result.gemini_api_key) {
        setSavedKey(result.gemini_api_key);
        setApiKey(result.gemini_api_key);
      }
      if (result.settings) {
        setEnabled(result.settings.enabled !== false);
      }
    });
  }, []);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSave = async () => {
    if (!apiKey.trim()) {
      showNotification('API 키를 입력해주세요.', 'error');
      return;
    }
    if (!apiKey.startsWith('AIza')) {
      showNotification('유효한 Google Gemini API 키를 입력해주세요. (AIza로 시작)', 'error');
      return;
    }

    setSaving(true);
    try {
      await chrome.storage.local.set({ gemini_api_key: apiKey.trim() });
      setSavedKey(apiKey.trim());
      showNotification('API 키가 안전하게 저장되었습니다!');
    } catch (e) {
      showNotification('저장에 실패했습니다.', 'error');
    }
    setSaving(false);
  };

  const handleClear = async () => {
    await chrome.storage.local.remove(['gemini_api_key']);
    setApiKey('');
    setSavedKey('');
    showNotification('API 키가 삭제되었습니다.');
  };

  const handleToggle = async () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    await chrome.storage.local.set({ settings: { enabled: newEnabled } });
    showNotification(newEnabled ? '보호가 활성화되었습니다.' : '보호가 비활성화되었습니다.', newEnabled ? 'success' : 'warning');
  };

  const maskKey = (key) => {
    if (!key) return '';
    return key.substring(0, 7) + '•'.repeat(20) + key.substring(key.length - 4);
  };

  return (
    <div style={{ padding: '0', minHeight: '500px' }}>
      {/* Header */}
      <div style={{
        padding: '24px 20px 20px',
        background: 'linear-gradient(135deg, #1a1a3e 0%, #2d1b69 100%)',
        borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', boxShadow: '0 8px 20px rgba(99, 102, 241, 0.4)',
          }}>
            🛡️
          </div>
          <div>
            <h1 style={{
              fontSize: '18px', fontWeight: '800', margin: 0,
              background: 'linear-gradient(135deg, #c7d2fe, #e0e7ff)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Gmail Phishing Detector
            </h1>
            <p style={{ fontSize: '12px', color: '#a0a0c0', margin: '2px 0 0' }}>
              AI 기반 스피어 피싱 탐지
            </p>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div style={{
          margin: '12px 16px 0',
          padding: '10px 14px',
          borderRadius: '10px',
          fontSize: '13px',
          fontWeight: '500',
          animation: 'fadeIn 0.2s ease-out',
          background: notification.type === 'success' ? 'rgba(34,197,94,0.1)' :
                      notification.type === 'warning' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
          color: notification.type === 'success' ? '#4ade80' :
                 notification.type === 'warning' ? '#fbbf24' : '#f87171',
          border: `1px solid ${notification.type === 'success' ? 'rgba(34,197,94,0.2)' :
                  notification.type === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'}`,
        }}>
          {notification.type === 'success' ? '✅' : notification.type === 'warning' ? '⚠️' : '❌'} {notification.msg}
        </div>
      )}

      {/* Status Card */}
      <div style={{ padding: '16px' }}>
        <div style={{
          padding: '16px',
          background: 'rgba(34, 34, 64, 0.6)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          marginBottom: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '10px', height: '10px', borderRadius: '50%',
                background: enabled ? '#22c55e' : '#6b7280',
                boxShadow: enabled ? '0 0 10px rgba(34, 197, 94, 0.5)' : 'none',
                animation: enabled ? 'pulse 2s ease-in-out infinite' : 'none',
              }} />
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#e0e0f0' }}>
                {enabled ? '보호 활성화됨' : '보호 비활성화됨'}
              </span>
            </div>
            <button
              onClick={handleToggle}
              style={{
                width: '48px', height: '26px', borderRadius: '13px',
                background: enabled ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#3a3a5a',
                border: 'none', cursor: 'pointer', position: 'relative',
                transition: 'all 0.3s ease',
                boxShadow: enabled ? '0 4px 12px rgba(99, 102, 241, 0.4)' : 'none',
              }}
            >
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%',
                background: 'white',
                position: 'absolute', top: '3px',
                left: enabled ? '25px' : '3px',
                transition: 'left 0.3s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              }} />
            </button>
          </div>
          <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{
              padding: '6px 10px', borderRadius: '8px',
              background: savedKey ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${savedKey ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)'}`,
            }}>
              <span style={{
                fontSize: '11px', fontWeight: '500',
                color: savedKey ? '#4ade80' : '#fbbf24',
              }}>
                {savedKey ? '🔑 API 키 설정됨' : '🔑 API 키 필요'}
              </span>
            </div>
            <div style={{
              padding: '6px 10px', borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
            }}>
              <span style={{ fontSize: '11px', fontWeight: '500', color: '#a5b4fc' }}>
                📧 Gmail 전용
              </span>
            </div>
          </div>
        </div>

        {/* API Key Section */}
        <div style={{
          padding: '16px',
          background: 'rgba(34, 34, 64, 0.6)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px',
          marginBottom: '12px',
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#e0e0f0', marginBottom: '12px' }}>
            🔐 Google Gemini API 키
          </h3>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              style={{
                width: '100%', padding: '12px 40px 12px 14px',
                background: '#1a1a2e', border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '10px', color: '#e0e0f0', fontSize: '13px',
                outline: 'none', transition: 'border-color 0.2s',
                fontFamily: 'monospace',
              }}
              onFocus={(e) => e.target.style.borderColor = 'rgba(99, 102, 241, 0.5)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(99, 102, 241, 0.2)'}
            />
            <button
              onClick={() => setShowKey(!showKey)}
              style={{
                position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '16px', padding: '4px',
              }}
            >
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
          {savedKey && (
            <div style={{
              marginTop: '8px', fontSize: '11px', color: '#808090',
              padding: '6px 10px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px',
              fontFamily: 'monospace',
            }}>
              저장됨: {maskKey(savedKey)}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 1, padding: '10px',
                background: saving ? '#3a3a5a' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white', border: 'none', borderRadius: '10px',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontWeight: '600', fontSize: '13px',
                boxShadow: saving ? 'none' : '0 4px 12px rgba(99, 102, 241, 0.3)',
                transition: 'all 0.2s',
              }}
            >
              {saving ? '저장 중...' : '💾 저장'}
            </button>
            {savedKey && (
              <button
                onClick={handleClear}
                style={{
                  padding: '10px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#f87171',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontWeight: '600', fontSize: '13px',
                  transition: 'all 0.2s',
                }}
              >
                🗑️ 삭제
              </button>
            )}
          </div>
        </div>

        {/* Security Info */}
        <div style={{
          padding: '14px',
          background: 'rgba(34, 34, 64, 0.4)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '14px',
          marginBottom: '12px',
        }}>
          <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#e0e0f0', marginBottom: '10px' }}>
            ℹ️ 보안 안내
          </h3>
          <div style={{ fontSize: '12px', color: '#a0a0b8', lineHeight: '1.7' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <span>🔒</span>
              <span>API 키는 기기에만 로컬로 저장됩니다</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <span>🚫</span>
              <span>외부 서버로 전송되지 않습니다 (BYOK)</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <span>🤖</span>
              <span>Google Gemini API를 통해 직접 분석합니다</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <span>📧</span>
              <span>Gmail에서 메일 열람 시 자동 분석됩니다</span>
            </div>
          </div>
        </div>

        {/* How to Use */}
        <div style={{
          padding: '14px',
          background: 'rgba(34, 34, 64, 0.4)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '14px',
        }}>
          <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#e0e0f0', marginBottom: '10px' }}>
            📖 사용 방법
          </h3>
          <div style={{ fontSize: '12px', color: '#a0a0b8', lineHeight: '1.7' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start' }}>
              <span style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white', borderRadius: '50%', width: '20px', height: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: '700', flexShrink: 0,
              }}>1</span>
              <span>위에서 Google Gemini API 키를 입력하고 저장하세요</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'flex-start' }}>
              <span style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white', borderRadius: '50%', width: '20px', height: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: '700', flexShrink: 0,
              }}>2</span>
              <span>Gmail에서 이메일을 열면 자동으로 분석이 시작됩니다</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <span style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white', borderRadius: '50%', width: '20px', height: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: '700', flexShrink: 0,
              }}>3</span>
              <span>보안 체크리스트를 확인하고 안전하게 이메일을 처리하세요</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          textAlign: 'center', padding: '16px 0 8px',
          fontSize: '11px', color: '#505068',
        }}>
          Gmail Phishing Detector v1.0.0 · Powered by AI
        </div>
      </div>
    </div>
  );
}
