// LLM integration for email phishing analysis using Google Gemini API

const SYSTEM_PROMPT = `You are a balanced cybersecurity expert analyzing emails for phishing.

CRITICAL: Most emails are LEGITIMATE. Only flag as dangerous when there are CLEAR phishing indicators.

Risk level guidelines:
- "safe": Email from a known legitimate sender, no suspicious patterns. This should be the DEFAULT for normal emails from real companies, colleagues, or known services.
- "suspicious": Some minor red flags but not clearly malicious. Unusual sender, slight oddities.
- "dangerous": Clear phishing indicators like spoofed domains, credential harvesting links, urgent fake warnings.

Your response MUST be valid JSON:
{
  "riskLevel": "safe",
  "riskScore": 15,
  "summary": "Brief analysis summary in Korean",
  "senderAnalysis": {
    "isLegitimate": true,
    "suspiciousPoints": [],
    "similarDomain": null
  },
  "checklist": [
    {
      "id": "check_1",
      "category": "sender",
      "question": "A verification question in Korean",
      "explanation": "Why this matters in Korean",
      "riskContribution": "low"
    }
  ],
  "detectedTechniques": [],
  "recommendation": "Recommendation in Korean"
}

Rules:
- riskLevel: exactly "safe", "suspicious", or "dangerous"
- category: exactly "sender", "links", "content", "urgency", or "attachment"
- riskContribution: exactly "low", "medium", or "high"
- riskScore: 0-100 number (0=completely safe, 100=definite phishing)
- Generate 3-5 checklist items
- Emails from google.com, microsoft.com, amazon.com, known banks, etc. are almost always safe
- Do NOT assume every email is dangerous
- Keep all string values on a single line, no line breaks inside strings`;

/**
 * Clean and parse JSON from LLM response
 * Handles common issues: markdown fences, unescaped newlines, trailing commas
 */
function cleanAndParseJSON(raw) {
  let text = raw.trim();

  // Remove markdown code fences if present
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch (e) {
    // Fall through to cleaning
  }

  // Fix unescaped newlines inside JSON string values
  // Replace actual newlines inside strings with \\n
  let cleaned = '';
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      cleaned += ch;
      escape = false;
      continue;
    }

    if (ch === '\\') {
      cleaned += ch;
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      cleaned += ch;
      continue;
    }

    if (inString && (ch === '\n' || ch === '\r')) {
      cleaned += '\\n';
      continue;
    }

    cleaned += ch;
  }

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');

  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('[PhishingDetector] JSON parse failed, raw response:', raw.substring(0, 500));
    throw new Error('JSON_PARSE_FAILED: ' + e.message);
  }
}

/**
 * Analyze email content using Google Gemini API
 */
export async function analyzeEmail(apiKey, emailData) {
  const userPrompt = `Please analyze this email for phishing indicators:

**Sender:** ${emailData.sender.name} <${emailData.sender.email}>
**Subject:** ${emailData.subject}
**Body:**
${emailData.body.substring(0, 3000)}

**Links found in email:**
${emailData.links.map(l => `- Text: "${l.text}" → URL: ${l.href} ${l.isMismatched ? '(⚠️ MISMATCH)' : ''}`).join('\n')}

**Additional context:**
- Homoglyph characters detected: ${emailData.homoglyphs ? 'Yes' : 'No'}
- Character tricks detected: ${emailData.characterTricks ? 'Yes' : 'No'}
${emailData.homoglyphs?.length > 0 ? `- Homoglyph details: ${JSON.stringify(emailData.homoglyphs)}` : ''}
${emailData.characterTricks?.length > 0 ? `- Character trick details: ${JSON.stringify(emailData.characterTricks)}` : ''}

Respond ONLY with valid JSON.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: SYSTEM_PROMPT + '\n\n' + userPrompt }
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 50000,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 400 && errorData.error?.message?.includes('API key')) {
        throw new Error('API_KEY_INVALID');
      } else if (response.status === 429) {
        throw new Error('RATE_LIMITED');
      } else {
        throw new Error(`API_ERROR: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error('EMPTY_RESPONSE');
    }

    const analysis = cleanAndParseJSON(content);
    return {
      success: true,
      data: analysis,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      data: getDefaultAnalysis(),
    };
  }
}

/**
 * Default fallback analysis when API is unavailable
 */
function getDefaultAnalysis() {
  return {
    riskLevel: 'suspicious',
    riskScore: 50,
    summary: 'API 연결에 실패하여 기본 보안 체크리스트를 표시합니다.',
    senderAnalysis: {
      isLegitimate: null,
      suspiciousPoints: [],
      similarDomain: null,
    },
    checklist: [
      {
        id: 'default_sender',
        category: 'sender',
        question: '발신자 메일 주소의 철자가 공식 주소와 정확히 일치하나요?',
        explanation: '스피어피싱 공격자는 공식 주소와 유사한 주소를 사용합니다. 한 글자만 달라도 위험할 수 있습니다.',
        riskContribution: 'high',
      },
      {
        id: 'default_links',
        category: 'links',
        question: '메일 내 링크를 클릭하지 말고, 공식 사이트에 직접 접속하여 확인하셨나요?',
        explanation: '피싱 메일의 링크는 정상 사이트와 유사한 가짜 사이트로 연결될 수 있습니다.',
        riskContribution: 'high',
      },
      {
        id: 'default_urgency',
        category: 'urgency',
        question: '본문에 긴급한 조치를 요구하는 문구가 있나요? (예: "즉시", "24시간 내")',
        explanation: '긴급성을 강조하는 것은 피싱 공격의 대표적인 사회공학 기법입니다.',
        riskContribution: 'medium',
      },
      {
        id: 'default_personal',
        category: 'content',
        question: '개인정보(비밀번호, 카드번호 등)를 요구하는 내용이 있나요?',
        explanation: '정상적인 기관은 이메일로 민감한 개인정보를 요구하지 않습니다.',
        riskContribution: 'high',
      },
    ],
    detectedTechniques: [],
    recommendation: 'API 키를 확인하고 다시 시도해주세요.',
  };
}
