# Oval Frame CAM — TwoTrees 450 CNC

> 오벌(타원형) 액자 프레임 CNC 가공용 NC 파일 자동 생성기

![License](https://img.shields.io/badge/license-MIT-green)

## 개요

TwoTrees TTC 450 시리즈 CNC 라우터를 사용하여 타원형 액자 프레임을 가공하기 위한 NC(G-code) 파일을 자동으로 생성하는 웹 애플리케이션입니다. 액자 프레임 가공용 G-code와 유리 재단 가이드(가다) 템플릿 G-code를 동시에 생성합니다.

## 주요 기능

- **즉석 G-code 생성** — 타원 치수, 프레임 폭, 래빗(단턱), 공구 사양 입력만으로 NC 코드 자동 생성
- **듀얼 가공 파일** — 액자 프레임 + 유리 재단 가다 템플릿 동시 생성
- **실시간 미리보기** — 2D 도면(Top View), 3D 회전 뷰, 툴패스 시각화
- **자동 최적화** — 목재 종류/CNC 모델에 따라 RPM, 이송속도, DOC 자동 계산
- **프리셋 시스템** — 자주 쓰는 세팅 저장/불러오기/내보내기(JSON)
- **반응형 디자인** — 데스크탑/태블릿 대응

## 지원 CNC 모델

| 모델 | 스핀들 | 최대 RPM | 작업 영역 |
|------|--------|----------|----------|
| TTC 450 | 775 스핀들 (80W) | 8,000 | 460×460mm |
| TTC 450 Pro | 500W 스핀들 | 12,000 | 460×460mm |
| TTC 450 Ultra | 500W 스핀들 | 30,000 | 460×460mm |

## 사용법

1. 로컬 웹 서버로 `index.html`을 실행합니다.
   ```bash
   # Python 간이 서버
   python3 -m http.server 8765

   # Node.js (npx)
   npx serve .
   ```
2. 브라우저에서 `http://localhost:8765` 접속
3. 좌측 패널에서 치수/공구/머신 설정 조정
4. **GENERATE G-CODE SET** 클릭
5. 프레임 / 가다 NC 파일 개별 다운로드

## 기술 스택

- HTML5 / CSS3 / Vanilla JavaScript
- Canvas API (2D/3D 렌더링)
- 외부 의존성 없음 (No Build Step)

## 파일 구조

```
├── index.html              # 메인 HTML
├── style.css               # The Verge 2024 테마 CSS
├── app.js                  # UI 컨트롤러
├── gcode-generator.js      # G-code 생성 엔진
├── preview-renderer.js     # Canvas 기반 2D/3D 미리보기
├── DESIGN.md               # 디자인 시스템 문서
└── .gitignore
```

## 라이선스

MIT License
