# SolaEver Wallet Chrome Extension

![SolaEver Logo](public/logo.png)

SolaEver 전용 크롬 확장 프로그램 지갑입니다. 모바일 환경의 보안성과 편리함을 브라우저 환경으로 이식하여, PC에서도 안전하게 자산을 관리할 수 있도록 설계되었습니다.

## 🛠 Tech Stack
- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, Lucide React (Icons)
- **Blockchain**: @solana/web3.js, @solana/spl-token
- **Cryptography**: BIP39, ed25519-hd-key, Buffer Polyfill
- **Build Tool**: CRXJS (Vite Plugin for Chrome Extension)
- **CI/CD**: GitHub Actions (Automatic Build & Packaging)

## 🚀 Key Features
### 1. 지갑 관리 (Wallet Management)
- BIP39 니모닉 기반 다중 지갑 생성 및 복구.
- 지갑별 별칭(Alias) 설정 및 비밀번호 기반 보안 시스템.
- 로그아웃(잠금) 기능을 통한 다중 계정 전환 용이성 제공.

### 2. 자산 관리 (Asset Management)
- **Native SLE**: 실시간 잔액 조회 및 전송.
- **SPL Token**: 사용자 정의 토큰 추가 및 관리.
- **온체인 메타데이터**: Metaplex Metadata PDA 조회를 통해 토큰 이름/심볼 자동 인식.
- **거래 내역**: 익스플로러와 연동된 최근 트랜잭션 리스트 확인.

### 3. 사용자 경험 (UX/UI)
- **Auto-Sync**: 5초 주기로 잔액 및 히스토리 자동 갱신.
- **Expand View**: 브라우저 새 탭에서 시원하게 지갑을 볼 수 있는 확장 보기 기능.
- **Smart Toast**: 알림 팝업 3초 후 자동 소멸 로직 적용.
- **Keyboard Friendly**: 모든 입력 폼 엔터(Enter) 키 지원.
- **QR Support**: 수신용 QR 코드 생성 및 주소 복사 기능.

## 📅 Remaining Tasks
- [ ] **보유 토큰 자동 스캔**: Mint 주소 입력 없이 보유 중인 모든 토큰 자동 리스트업.
- [ ] **상세 로그 보강**: 트랜잭션의 상세 데이터(전송자/수신자 등) 정보 보강.
- [ ] **보안 강화**: `chrome.storage.local` 내 중요 데이터 암호화 저장 레이어 추가.
- [ ] **최종 배포 테스트**: 다양한 브라우저 환경에서의 최종 안정성 점검.

## 📦 How to Install (Local Build)
1. GitHub 저장소 클론.
2. `npm install` 및 `npm run build`.
3. 크롬 브라우저에서 `chrome://extensions/` 접속.
4. '개발자 모드' 활성화 후 `dist` 폴더 로드.
