# 🛡️ Gmail Phishing Detector

AI 기반 스피어 피싱 탐지 Chrome 확장 프로그램

---

## 📋 프로젝트 소개

Gmail에서 이메일을 열면 **Google Gemini AI**가 자동으로 내용을 분석하여 피싱 여부를 판단하고, 사용자에게 **맞춤형 보안 체크리스트**를 제공하는 Chrome 확장 프로그램입니다.

### 주요 기능

- 🔍 **자동 이메일 분석** — `MutationObserver`로 Gmail SPA에서 메일 열림을 감지하여 자동 분석
- 🛡️ **스피어 피싱 탐지** — 발신자 주소의 호모글리프 문자, 유사 도메인 자동 탐지
- 📋 **보안 체크리스트** — 단순 경고가 아닌, 사용자 판단을 유도하는 체크리스트 UI
- 🔑 **BYOK (Bring Your Own Key)** — API 키를 로컬에만 저장, 외부 서버 전송 없음
- 📊 **실시간 프로그레스 바** — 분석 진행 상황을 3단계로 시각화

---

## 🛠️ 기술 스택

| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19 | UI 컴포넌트 (팝업) |
| Tailwind CSS | 4 | 스타일링 |
| Vite | 6 | 빌드 도구 |
| Chrome Manifest V3 | — | 확장 프로그램 표준 |
| Google Gemini API | 2.5 Flash | 이메일 피싱 분석 |
| MutationObserver | — | Gmail SPA DOM 변화 감지 |

---

## 📁 프로젝트 구조

```
Final project/
├── public/
│   ├── manifest.json              # Chrome Manifest V3
│   └── icons/                     # 확장프로그램 아이콘
│       ├── icon16.png
│       ├── icon48.png
│       └── icon128.png
├── src/
│   ├── background/
│   │   └── background.js          # 서비스 워커 (API 통신 중계)
│   ├── content/
│   │   ├── content.js             # Gmail DOM 감시 + 사이드바 렌더링
│   │   └── content.css            # 사이드바 스타일
│   ├── popup/
│   │   ├── popup.html             # 팝업 HTML 진입점
│   │   ├── main.jsx               # React 진입점
│   │   ├── Popup.jsx              # 팝업 UI (API 키 관리)
│   │   └── popup.css              # Tailwind 스타일
│   └── utils/
│       ├── llm.js                 # Gemini API 연동 + JSON 파싱
│       ├── emailParser.js         # Gmail DOM 파싱 + 호모글리프 탐지
│       └── storage.js             # chrome.storage.local 래퍼
├── build-scripts.js               # content/background IIFE 빌드
├── vite.config.js                 # Vite 빌드 설정
├── package.json
└── .gitignore
```

---

## 🚀 설치 방법

### 1단계: 사전 요구사항 설치

- **Node.js v18 이상** — [https://nodejs.org](https://nodejs.org) 에서 LTS 버전 다운로드
- **Google Gemini API 키** — [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey) 에서 무료 발급

### 2단계: 프로젝트 빌드

```bash
# 프로젝트 폴더로 이동
cd "Final project"

# 의존성 설치
npm install

# 빌드 (dist 폴더 생성)
npm run build
```

빌드가 완료되면 `dist/` 폴더가 생성됩니다.

### 3단계: Chrome에 확장 프로그램 설치

1. Chrome 브라우저에서 `chrome://extensions` 주소 입력
2. 우측 상단 **개발자 모드** 토글 활성화
3. **"압축해제된 확장 프로그램을 로드합니다"** 버튼 클릭
4. `dist` 폴더 선택

### 4단계: API 키 설정

1. Chrome 툴바에서 확장 프로그램 아이콘 (🛡️) 클릭
2. **Google Gemini API 키** 입력 (AIza...로 시작)
3. **"💾 저장"** 버튼 클릭

### 5단계: 사용

1. [Gmail](https://mail.google.com) 접속
2. 아무 이메일을 열면 **자동으로 AI 분석** 시작
3. 우측에 나타나는 **보안 체크리스트** 확인

---

## 🔑 API 키 발급 방법

1. [Google AI Studio](https://aistudio.google.com/apikey) 접속
2. Google 계정으로 로그인
3. **"Create API Key"** 클릭
4. 생성된 키 (`AIza...`) 복사
5. 확장 프로그램 팝업에 붙여넣기 후 저장

---

## 🔒 보안 안내

- API 키는 `chrome.storage.local`에만 저장 (기기 로컬 전용)
- 외부 서버로 전송되지 않음 (BYOK 모델)
- 이메일 내용은 Google Gemini API에만 전달되며 저장되지 않음

---

## 📄 라이센스

MIT License
