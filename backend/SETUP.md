# 개인 Google Sheets 연결

본인의 비공개 영상 보관함 시트를 사용합니다. 시트 생성, 웹UI 배포, 스크립트 배포와 공유 단축어 설치는 서로 다른 단계입니다. 기존 시트가 있으면 새 시트를 중복 생성하지 않습니다.

## 구성

시트는 비공개로 유지합니다. iPhone·Mac의 Shortcuts는 HTTPS POST로 저장하고, GitHub Pages의 웹화면은 Apps Script의 연결 프레임을 통해 같은 API를 호출합니다. 서버에서 매번 개인 인증 키를 검사합니다. Google Drive for desktop과 iCloud는 필요하지 않습니다.

## 시트와 스크립트

1. 이미 만들어 둔 영상 보관함 Google Sheets를 엽니다. 새 시트를 중복 생성하지 않습니다.
2. 해당 시트의 `Extensions > Apps Script`에서 `Code.gs` 내용을 붙여 넣고 HTML 파일 `Bridge`를 추가하여 `Bridge.html` 내용을 붙여 넣습니다.
3. 함수 선택에서 `initializeLaterClip`을 선택하고 `Run`으로 실행합니다. 본인 계정으로 Google 권한 요청을 확인합니다. 이 함수는 기존 행을 지우지 않으며 헤더가 다르면 오류로 멈춥니다. 최초 설정 성공 후 재실행은 차단됩니다.
4. `Project Settings > Script properties`에서 생성된 `SPREADSHEET_ID`, `API_TOKEN`, `WEB_ORIGIN`을 확인합니다. `WEB_ORIGIN`은 Pages의 출처이며 기본값은 `https://magfield25-wq.github.io`입니다. 저장소 경로를 포함하지 않습니다. 인증 키를 공개 파일이나 채팅에 붙여 넣지 않습니다.
5. `Deploy > New deployment`에서 `Web app`을 선택합니다. `Execute as`는 본인 계정, `Who has access`는 `Anyone`으로 설정합니다. 개인 토큰 인증을 코드에서 별도로 검사하므로 클라이언트에 Google OAuth 로그인을 요구하지 않는 구성입니다. 시트 공유 권한은 변경하지 않습니다. Workspace 정책으로 이 배포 방식이 막혀 있으면 개인 계정 또는 OAuth 방식으로 별도 구성해야 합니다.
6. 배포된 `/exec` 주소를 복사합니다. `/dev` 테스트 주소는 사용하지 않습니다.
7. 웹앱의 연결 설정에 주소와 키를 입력하고 연결을 확인합니다. iPhone과 Mac의 Share 저장은 `shortcuts/SETUP.md`를 따라 구성합니다.

공개 접근 가능한 웹 엔드포인트를 배포하는 단계이므로, 실제 배포 전에 코드와 인증 방식을 검토할 수 있게 준비했습니다. 주소만으로 데이터 접근은 안 되며 인증 키도 필요합니다. 키는 32자 이상이어야 합니다. 설정 함수는 UUID 두 개를 합친 키를 만듭니다. 앱 키의 권한을 읽기/쓰기로 분리하는 기능은 아직 없습니다. 웹화면은 Google OAuth 로그인 대신 이 개인 키로 연결합니다. 키를 HTML에 미리 넣어 배포하지 않습니다.

## 데이터

`Clips`의 헤더 순서: `id, savedAt, title, url, platform, category, watched, note, device, updatedAt, thumbnailURL`.

- ID와 날짜는 서버가 생성합니다. 날짜는 API 호환을 위해 ISO 8601 텍스트로 저장합니다.
- 제목의 키워드로만 자동 분류합니다. AI 내용 분석은 연결하지 않았습니다.
- 제목 조회 실패 시에도 링크를 저장합니다. Facebook은 기본적으로 링크·수동 제목을 사용합니다.
- YouTube 짧은 주소, Shorts 주소와 일반 주소는 영상 ID로 정규화해 중복을 막습니다.
- API의 동시 요청은 ScriptLock으로 직렬화합니다. 앱의 수정·삭제는 `updatedAt`을 비교해 오래된 수정이 덮어쓰지 않게 합니다.
- 사용자가 시트에서 직접 수정하면 bound script의 `onEdit`이 수정 시간을 갱신합니다. 헤더와 ID 열은 변경하지 마세요. 외부 API로 시트를 직접 수정할 경우 이 트리거가 실행되지 않습니다.
- 목록은 웹앱 연결 시, 수동 새로고침 시, 웹앱이 열린 동안 약 60초마다 가져옵니다. 푸시 동기화는 아닙니다.
- 썸네일은 YouTube에서 표시 가능한 경우만 로드합니다. 영상 다운로드·자막 분석은 하지 않습니다.
- 이 구성은 개인용 소규모 목록용이며 Apps Script 사용량 제한과 네트워크 가용성의 영향을 받습니다.

## 코드 수정 후

`Deploy > Manage deployments`에서 새 버전으로 배포해야 `/exec`에 수정 코드가 적용됩니다.

공식 참고: [Web Apps](https://developers.google.com/apps-script/guides/web), [Deployments](https://developers.google.com/apps-script/concepts/deployments).
