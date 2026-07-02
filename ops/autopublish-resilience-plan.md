# 지분매입 블로그 무중단 정기 발행 운영 계획

## 목표
VM109 또는 호스트가 재시작되어도 지분매입 블로그 발행이 자동으로 재개되게 한다. 발행 루프는 Gemini CLI 프록시, 백로그 자동 보충, 정적 사이트 검증, 커밋·푸시, 공개 URL 확인까지 통과한 경우만 성공으로 본다.

## 현재 기준
- 발행 저장소: `jiggyj744-ctrl/jiggyj744-ctrl.github.io`
- 공개 주소: `https://jiggyj744-ctrl.github.io/`
- 발행 엔진: `scripts/seo-content-engine.mjs`
- 대기열: `content/blog-backlog.json`
- 현재 블로그 상태: 58건 중 3건 발행, 55건 대기
- 백로그 자동 보충: queued/improve 항목이 20개 미만이면 40개 수준까지 자동 보충
- 모델 경로: VM109 `http://127.0.0.1:8302/v1` Gemini CLI proxy, model `gemini-pro`

## 무중단 구조
1. VM109 Docker/cliproxy가 먼저 살아난다.
2. VM109에 GitHub Actions self-hosted runner를 systemd 서비스로 등록한다.
3. GitHub Actions schedule은 하루 6개 후보 시간 중 KST 날짜 해시로 선택된 1개 슬롯만 통과시킨 뒤 같은 발행 스크립트를 실행한다.
4. GitHub Actions 예약 실행은 선택 슬롯 안에서 최대 30분 지터를 추가해 실제 발행 분 단위가 고정되지 않게 한다.
5. 별도 systemd timer는 07:00 이후 최대 14시간 랜덤 지연으로 같은 스크립트를 백업 경로에서 실행한다.
6. `ops/index-state.json`의 KST 날짜 기준으로 당일 블로그 발행이 이미 있으면 추가 발행을 건너뛴다.
7. lock 파일로 GitHub Actions와 timer가 동시에 발행하지 못하게 막는다.
8. 발행 전 Gemini proxy health와 실제 completion을 확인한다.
9. 발행 후 `node tools/verify_site.mjs`, git diff, sitemap/feed/blog hub 반영, 공개 URL 200 확인을 수행한다.
10. 실패하면 다음 timer 또는 다음 schedule에서 같은 대기열을 다시 처리한다.

## 재부팅 복구 기준
- Docker proxy 컨테이너: `restart: unless-stopped` 또는 Docker restart policy 적용
- GitHub runner: systemd `actions.runner...service` enabled
- 백업 발행 timer: `jauction-share-blog-publisher.timer` enabled
- systemd timer: `Persistent=true`로 재부팅 중 놓친 실행을 부팅 후 보정
- daily guard: KST 날짜 기준 같은 날 블로그 글이 이미 발행됐으면 종료
- 발행 스크립트: `After=network-online.target docker.service` 이후 실행

## 실행 계층
### 1순위: GitHub Actions self-hosted runner
- 장점: GitHub 커밋 권한은 `GITHUB_TOKEN`으로 처리되어 별도 deploy key 부담이 작다.
- 필요 조건: VM109 runner 등록 토큰, repo secret `LLM_PROXY_API_KEY`, repo variable `LLM_PROXY_BASE_URL`, `LLM_PROXY_MODEL`
- 현재 workflow: `.github/workflows/continuous-indexing.yml`

### 2순위: VM109 systemd timer fallback
- 장점: GitHub Actions runner가 멈춰도 VM109 자체 cron 성격으로 실행된다.
- 필요 조건: `/etc/jauction-share-blog-publisher.env`에 프록시 키와 repo 경로 설정, GitHub push 가능한 deploy key 또는 PAT
- 템플릿: `ops/vm109-share-blog-publisher.sh`, `ops/systemd/jauction-share-blog-publisher.service`, `ops/systemd/jauction-share-blog-publisher.timer`

## 환경 파일 예시
`/etc/jauction-share-blog-publisher.env`는 GitHub에 올리지 않는다.

```bash
JAUCTION_REPO_DIR=/srv/jiggyj744-ctrl.github.io
SITE_BASE=https://jiggyj744-ctrl.github.io
GENERATION_MODE=proxy
LLM_PROXY_BASE_URL=http://127.0.0.1:8302/v1
LLM_PROXY_MODEL=gemini-pro
LLM_PROXY_API_KEY=REPLACE_WITH_PROXY_KEY
PUBLISH_LIMIT=1
PUBLISH_JITTER_MAX_SECONDS=0
```

권한:

```bash
chmod 600 /etc/jauction-share-blog-publisher.env
```

## 설치 순서
1. VM109에 저장소를 `/srv/jiggyj744-ctrl.github.io`로 clone한다.
2. Git push 가능한 deploy key 또는 GitHub Actions runner를 설정한다.
3. `/etc/jauction-share-blog-publisher.env`를 만들고 proxy key를 넣는다.
4. `ops/vm109-share-blog-publisher.sh`를 실행 가능하게 한다.
5. systemd service/timer 템플릿을 `/etc/systemd/system/`으로 배치한다.
6. `systemctl daemon-reload`
7. `systemctl enable --now jauction-share-blog-publisher.timer`
8. `systemctl start jauction-share-blog-publisher.service`로 1회 수동 검증한다.

## 성공 기준
- `systemctl status jauction-share-blog-publisher.timer`가 active
- `systemctl status jauction-share-blog-publisher.service`가 마지막 실행 성공
- 신규 글 URL이 200
- `/blog/`, `/feed.xml`, `/sitemap.xml`에 신규 URL 반영
- GitHub 원격 main에 커밋 반영
- `ops/index-state.json`에 실행 기록 저장
- 같은 KST 날짜에 블로그 발행 기록이 이미 있으면 두 번째 실행은 글을 추가하지 않고 종료

## 장애 처리
- Gemini proxy health 실패: Docker 컨테이너 상태, `8302` 포트, proxy key 확인
- completion 실패: Gemini CLI 로그인/쿨다운/컨테이너 env 확인
- git push 실패: deploy key, PAT, repo 권한 확인
- QA 실패: proxy 생성물은 QA 피드백으로 1회 재생성되어야 하며, 재시도 후 fallback도 실패하면 금지어 규칙 확인
- 공개 URL 404: GitHub Pages 배포 지연이면 재시도, 5분 이상 지속되면 Pages 설정과 커밋 파일 확인

## 운영 원칙
- 하루 1건을 기본으로 한다.
- 발행 시간은 고정하지 않고 GitHub Actions 후보 슬롯과 지터 또는 systemd 랜덤 지연으로 분산한다.
- 발행 품질과 색인 반응이 안정되면 하루 2건으로 늘린다.
- 공개 글에는 매도 의사를 흔들 수 있는 세부 실행 정보, 내부 판단 기준, 상대방 대응 방향을 넣지 않는다.
- 실제 색인은 공개 200이 아니라 Google Search Console/Naver Search Advisor에서 확인한다.
