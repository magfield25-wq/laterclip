# LaterClip

iPhone과 Mac의 Safari에서 함께 쓰는 개인 영상 보관함입니다.

## 구성

- 화면: GitHub Pages의 HTML·CSS·JavaScript
- 저장소: 본인의 비공개 Google Sheets
- 읽기·저장·수정 API: 본인의 Google Apps Script
- 빠른 저장: iPhone과 Mac의 Safari Share에서 실행하는 Shortcuts

공개 웹사이트에 영상 목록이나 개인 인증 키를 포함하지 않습니다. 웹앱은 처음 연결할 때 본인의 API 주소와 개인 키를 입력받습니다. 기본값은 메모리 보관이며, 사용자가 선택하면 해당 탭의 sessionStorage에 연결을 유지합니다. 연결을 해제하면 메모리와 세션의 키를 지웁니다. 다른 사람이 같은 Pages 주소를 열어도 본인의 키 없이는 목록에 접근할 수 없습니다.

## 기능

- 링크 저장, 제목·메모·카테고리 수정, 시청 완료, 삭제 확인
- 제목·링크·메모 검색, 카테고리와 플랫폼 필터
- 가능한 경우 YouTube 제목과 썸네일 조회, 제목 키워드로 자동 분류
- YouTube 일반 주소·짧은 주소·Shorts의 동일 영상 중복 저장 방지
- 앱이 열린 동안 약 60초마다 읽기, 수동 새로고침
- iPhone 폭과 Mac 화면에 대응하며 시스템의 밝은·어두운 화면을 따릅니다.

AI가 영상 내용을 분석하지 않습니다. Facebook이나 비공개 영상의 제목을 가져올 수 없으면 링크를 미분류로 보존합니다. 인터넷 연결이 필요하며, 오프라인 요청 자동 재전송과 네이티브 Share Extension은 없습니다.

## 최초 설정

1. `backend/SETUP.md`의 순서로 시트에 연결된 Apps Script에 `Code.gs`와 `Bridge.html`을 추가합니다.
2. `setupLaterClip_` 함수를 한 번 실행하고 Google 권한을 검토합니다.
3. Script properties의 `WEB_ORIGIN`을 본인 Pages 출처로 설정합니다. 저장소 경로를 제외한 `https://사용자이름.github.io` 형태입니다.
4. 스크립트를 배포하고 발급된 `/exec` 주소와 `API_TOKEN`을 웹앱에서 입력합니다. `API_TOKEN`은 GitHub에 커밋하지 않습니다.
5. `shortcuts/SETUP.md`에 따라 iPhone과 Mac의 저장 단축어를 각각 구성합니다.

`Bridge.html`은 Apps Script HTML Service에서만 실행합니다. Pages에서 직접 로드하지 않습니다. 화면은 Google의 연결 프레임과 출처·메시지 채널을 확인한 뒤 통신하며, 데이터 요청마다 서버에서 키를 검사합니다. 브라우저의 교차 출처 응답을 무시하는 `no-cors` 방식이나 비공개 데이터를 전달하는 JSONP는 사용하지 않습니다.

## GitHub Pages

저장소의 `Settings > Pages`에서 `Source`를 `GitHub Actions`로 선택합니다. `.github/workflows/pages.yml`은 `web/`만 배포합니다. `main`에 웹 파일 변경을 올리거나 `Actions`에서 `Deploy LaterClip web app`을 수동 실행할 수 있습니다.

정적 화면 배포와 실제 저장 기능 연결은 별도 단계입니다. Pages가 열려도 Apps Script 배포·권한 승인·개인 키 입력·단축어 설정이 끝나기 전에는 실제 저장을 사용할 수 없습니다.

## 검증

개발 환경에는 Apple 개발 도구가 필요하지 않습니다. 정적 웹파일은 빌드 없이 배포합니다.

```sh
node backend/test.mjs
node tests/api.test.mjs
```

- backend 모의 테스트: 인증, 잘못된 요청, URL 검사, 제목 조회 실패, 분류, 중복 방지, 수식 실행 방지, 오래된 수정 충돌, 읽기·수정·삭제
- 연결 테스트: 안전한 주소, URL에 비밀 키 미포함, 응답 출처·창·채널 검사, 요청 대응, 연결 종료 시 비밀 키 제거
- 브라우저 QA: 예시 API로 연결·검색·추가·수정·시청 상태·삭제 확인·빈 목록 확인, 375px 화면 확인
- 실제 Google Apps Script 왕복 요청과 iPhone·Mac Safari 실기기 공유 저장은 배포 후 확인해야 합니다.

개발용 QA 데이터와 테스트 서버는 `web/` 밖에 있어 Pages에 배포되지 않습니다.
