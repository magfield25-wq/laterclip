# iPhone·Mac Safari: LaterClip에 저장

이 문서는 실제 단축어를 만드는 순서입니다. 설치 가능한 서명된 `.shortcut` 파일은 아직 생성하지 않았습니다. Google Apps Script 배포를 먼저 마쳐야 합니다. 액션 이름은 영어 UI 기준이며 iOS 버전에 따라 배치가 다를 수 있습니다.

## 한 번 설정

1. Shortcuts에서 새 단축어를 만들고 이름을 `LaterClip에 저장`으로 지정합니다.
2. 단축어 설정에서 `Show in Share Sheet`를 켜고 입력 형식을 `URLs`와 `Text`로 지정합니다.
3. `Get URLs from Input`을 추가하고 입력은 `Shortcut Input`으로 지정합니다.
4. `Get Item from List`에서 첫 항목을 선택합니다. 공유 내용에 여러 링크가 있어도 첫 링크만 저장합니다.
5. 링크가 없으면 `If`로 분기하여 안내를 표시하고 `Stop This Shortcut`으로 끝냅니다. 중단 액션의 이름은 설치된 iOS에서 확인해 주세요.
6. `Get Contents of URL`에 배포된 Apps Script `/exec` 주소를 입력합니다.
7. `Method`를 `POST`, `Request Body`를 `JSON`으로 설정하고 아래 필드를 추가합니다.

| 키 | 값 | 유형 |
|---|---|---|
| token | Apps Script의 API_TOKEN | Text |
| action | save | Text |
| url | 위에서 추출한 첫 URL 변수 | Text |
| title | 빈 문자열 | Text |
| device | iPhone에서는 iPhone, Mac에서는 Mac | Text |

8. 응답에서 `Get Dictionary Value`로 `ok`를 읽습니다.
9. `If`에서 `ok`가 참일 때만 `Show Notification`으로 `LaterClip에 저장했습니다`를 표시합니다. 거짓이면 응답의 `error`를 안내합니다. 연결 실패로 액션이 중단되면 저장 성공 알림을 띄우지 않습니다.

`title`은 첫 버전에서 비워도 됩니다. 서버가 가능한 경우 YouTube 제목을 가져옵니다. Facebook Reels는 제목 접근이 제한될 수 있으므로 링크만 저장하고 웹앱에서 제목을 수정합니다. 제목을 직접 넣고 싶다면 저장 요청 전에 `Ask for Input`을 넣어 `title`에 연결할 수 있지만 매번 추가 입력이 생깁니다.

Mac의 Shortcuts에도 같은 단축어를 만들고 `Show in Share Sheet`를 켭니다. 입력 형식은 `URLs`와 `Text`로 시작합니다. Safari에서 웹페이지 자체를 전달하는 경우 `Safari Web Pages` 입력도 허용하고 `Get URLs from Input`이 현재 페이지 URL을 추출하는지 확인해야 합니다. 실제 macOS 버전의 공유 메뉴에서 실행 가능 여부를 점검합니다. 두 기기에 동일한 배포 주소와 인증 키를 사용하며 `device` 값만 구분합니다.

## 사용

YouTube 일반 영상, Shorts 또는 Facebook Reels에서 Share 메뉴를 열어 `LaterClip에 저장`을 선택합니다. 호스트 앱 내부 공유 화면에 iOS 공유 메뉴가 바로 보이지 않을 수 있으므로 실제 기기에서 진입 경로를 확인해야 합니다.

처음 실행할 때 연결 도메인 접근 권한을 묻는 경우 허용해야 합니다. 고정된 시트로 보내므로 저장 폴더를 고를 필요는 없습니다. Mac이 꺼져 있어도 Google에 저장됩니다. 인터넷 연결은 필요하며, 오프라인 요청의 자동 재전송은 아직 없습니다.

## 비밀 키

인증 키는 단축어 안에 들어갑니다. 이 단축어를 다른 사람에게 공유하지 마세요. 키를 가진 사람은 연결 API를 통해 목록을 읽고 수정할 수 있습니다. 분실·노출 시 Script properties의 `API_TOKEN`을 새 값으로 바꾸고 iPhone과 Mac에도 갱신합니다. 시트 자체는 공개하지 않습니다.

## 기기 검증

- YouTube 일반 영상, Shorts, Facebook Reels를 각각 하나씩 공유합니다.
- 성공 알림 후 시트에 새 행이 있는지 확인합니다.
- 같은 YouTube 영상을 긴 주소와 짧은 주소로 공유해 중복되지 않는지 확인합니다.
- iPhone과 Mac의 웹앱에서 새로고침하여 같은 항목이 보이는지 확인합니다.
- 잘못된 인증 키와 네트워크 단절에서 성공 알림이 나오지 않는지 확인합니다.

참고: [Apple 공유 메뉴 단축어 안내](https://support.apple.com/guide/shortcuts/launch-a-shortcut-from-another-app-apd163eb9f95/ios).
