# Jauction 지분매입 공개 사이트

공개 기본 주소는 `https://jiggyj744-ctrl.github.io/`입니다. Cloudflare Pages 보조 주소는 `https://jauction-share-acquisition.pages.dev/`입니다. 공유물 지분, 지분경매, 상속 지분, 토지 지분, 상가·건물 지분을 가진 사람이 상담을 남기도록 만든 정적 랜딩 사이트입니다.

## 운영 범위

- 메인 화면: 지분 매도 상담 유도
- 세부 화면: 공유물 지분 매입, 지분경매, 상속 지분, 토지 지분, 공유자 갈등, 상가·건물 지분
- 상담 접수: Cloudflare Worker와 D1에 저장
- 관리자 화면: `https://jauction-lead-api.jiggyj.workers.dev/admin`
- 검색 등록 자료: `robots.txt`, `sitemap.xml`
- Cloudflare Pages: `https://jauction-share-acquisition.pages.dev/`

## 주요 파일

- `index.html`: 메인 화면
- `services/*/index.html`: 세부 상담 화면
- `faq/index.html`: 자주 묻는 질문
- `privacy/index.html`: 개인정보 안내
- `assets/styles.css`: 화면 스타일
- `assets/main.js`: 상담 접수 화면 동작
- `workers/lead-api/`: 상담 저장과 관리자 화면
- `tools/verify_site.mjs`: 로컬 파일 점검
- `tools/verify_live.mjs`: 공개 주소 점검

## 상담 관리

관리자 화면과 관리자 명령은 별도 열쇠로 보호합니다. 열쇠 파일은 `workers/lead-api/.admin-token.local`에만 두고 GitHub에는 올리지 않습니다.

```powershell
node workers/lead-api/scripts/leads.mjs list
node workers/lead-api/scripts/leads.mjs show 1
node workers/lead-api/scripts/leads.mjs update 1 contacted "전화 상담 완료"
node workers/lead-api/scripts/leads.mjs export --limit 100
```

## 상담 알림

새 상담이 저장되면 이메일 또는 외부 알림 주소로 보낼 수 있도록 준비되어 있습니다. 실제 발송은 Cloudflare에 아래 값이 설정된 뒤 작동합니다.

- 이메일: `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`, `NOTIFY_EMAIL_TO`
- 외부 알림 주소: `NOTIFY_WEBHOOK_URL`, 필요 시 `NOTIFY_WEBHOOK_TOKEN`

알림 설정이 없으면 상담은 정상 저장되고, 관리자 화면에는 `not_configured`로 표시됩니다.

## 검색 등록

현재 공개 주소는 GitHub 무료 주소인 `jiggyj744-ctrl.github.io`입니다. 이 주소는 Cloudflare DNS 소유 확인 방식으로 등록할 수 없고, Google Search Console의 URL 확인 방식으로 등록해야 합니다.

Cloudflare Pages 주소도 열려 있지만, 현재 대표 주소와 sitemap은 GitHub 주소 기준입니다. Cloudflare Pages를 대표 주소로 바꾸려면 canonical, sitemap, robots를 Cloudflare 주소 기준으로 다시 만들어야 합니다.

확인 태그나 확인 파일을 받으면 아래 도구로 반영합니다.

```powershell
node tools/apply_search_verification.mjs --google-meta "구글에서 받은 content 값"
node tools/apply_search_verification.mjs --naver-meta "네이버에서 받은 content 값"
```

나중에 별도 도메인을 Cloudflare에 연결하면, 그때는 Cloudflare DNS에 Google 확인값을 넣는 방식으로 진행합니다.

## 점검

```powershell
node tools/verify_site.mjs
node tools/verify_live.mjs
```
