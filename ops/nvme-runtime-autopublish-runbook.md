# NVMe 런타임 자동발행 운영 Runbook

## 배치 기준
- 자동 실행 위치: `/srv/nvme/services/jiggyj744-ctrl.github.io`
- CT104 기준 실제 mount: `nvme-runtime/services -> /srv/nvme/services`
- 대량 파싱, DB 검사, 임시 복사본 생성은 이 위치에서 하지 않는다.
- 이 위치는 systemd, 발행 스크립트, 로그, Git working tree처럼 서비스 실행에 필요한 파일만 둔다.

## 설치
```bash
cd /srv/nvme/services/jiggyj744-ctrl.github.io
bash ops/install-nvme-runtime-publisher.sh
```

Node가 없으면 먼저 Node.js 22 또는 global `fetch`가 있는 Node 런타임을 설치한다.

## 환경 파일
`/etc/jauction-share-blog-publisher.env`에 실제 키를 둔다.

```bash
LLM_PROXY_BASE_URL=http://127.0.0.1:8302/v1
LLM_PROXY_MODEL=gemini-pro
LLM_PROXY_API_KEY=...
GIT_AUTHOR_NAME=jauction-publisher
GIT_AUTHOR_EMAIL=jauction-publisher@users.noreply.github.com
```

Git push 권한은 HTTPS credential helper 또는 SSH deploy key로 런타임 repo에 설정한다.

## 동작 방식
- systemd timer는 재부팅 후 10분 뒤부터 20분 간격으로 실행된다.
- `RESPECT_PUBLISH_SLOT=1`이므로 오늘 선택된 KST 슬롯 전에는 발행하지 않는다.
- `REQUIRE_GIT_PUSH_READY=1`이므로 GitHub push credential 확인 전에는 생성 단계로 들어가지 않는다.
- 선택 슬롯 이후 서버가 다시 켜지면 같은 날 미발행 상태일 때 1회 catch-up 발행한다.
- `ops/index-state.json`의 KST 날짜 기준으로 하루 1건 중복을 막는다.
- 로그는 `/srv/nvme/services/jiggyj744-ctrl.github.io/.runtime/logs`에 남긴다.

## 확인 명령
```bash
systemctl status jauction-share-blog-publisher.timer --no-pager
systemctl list-timers --all jauction-share-blog-publisher.timer --no-pager
systemctl status jauction-share-blog-publisher.service --no-pager
journalctl -u jauction-share-blog-publisher.service -n 120 --no-pager
```

## 장애 시 기준
- Node 또는 Git이 없으면 service는 `ExecCondition`에서 실행을 건너뛴다.
- proxy가 실패하면 `ALLOW_TEMPLATE_ON_PROXY_FAILURE=1` 기준으로 템플릿 발행으로 전환한다.
- Git push가 일시 실패하면 5회 재시도한다.
- GitHub credential이 없으면 발행물을 만들기 전에 종료하므로 로컬 미반영 변경이 쌓이지 않는다.
- 실제 색인 반영은 Search Console과 Search Advisor 로그인 콘솔에서 별도로 확인한다.
