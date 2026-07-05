# NVMe 런타임 지분 블로그 자동발행 배치 리포트 - 2026-07-05

## 결론
- CT104 `cliapi-runtime`에 지분 블로그 자동발행 repo를 배치했다.
- 실제 배치 위치는 `/srv/nvme/services/jiggyj744-ctrl.github.io`이며, CT104 내부에서 `nvme-runtime/services` mount로 확인했다.
- systemd timer `jauction-share-blog-publisher.timer`를 활성화했다.
- 서버 재시작 후에도 timer가 다시 실행되며, 선택된 KST 발행 슬롯 전에는 발행하지 않고 종료한다.
- CT104 단독 발행 push는 아직 GitHub credential이 없어 차단된다.

## 반영한 내구성 보강
- `.runtime/` 로그/락 디렉터리를 Git 추적에서 제외했다.
- 로그 위치를 `/srv/nvme/services/jiggyj744-ctrl.github.io/.runtime/logs`로 고정했다.
- systemd service가 `/srv/nvme/services` mount를 조건으로 실행되도록 했다.
- `git fetch`, `git pull`, `git push`에 재시도 로직을 추가했다.
- GitHub push credential이 없으면 생성 단계로 들어가지 않도록 `REQUIRE_GIT_PUSH_READY=1`을 적용했다.
- proxy 장애 시 템플릿 발행으로 전환할 수 있도록 `ALLOW_TEMPLATE_ON_PROXY_FAILURE=1`을 service 기본값으로 둔다.
- `RESPECT_PUBLISH_SLOT=1`을 적용해 systemd가 자주 깨어나도 하루 선택 슬롯 이후에만 발행한다.

## CT104 확인 결과
- 호스트: `cliapi-runtime`
- 런타임 repo: `/srv/nvme/services/jiggyj744-ctrl.github.io`
- Git 상태: `main...origin/main`
- 런타임 커밋: `061ece3 Fix runtime publisher scheduling safety`
- Node: `v18.19.1`
- timer: enabled / active
- 다음 timer: `2026-07-05 15:16:44 KST`
- 수동 실행 결과: `before-selected-slot`로 정상 종료

## 현재 차단 항목
- `/etc/jauction-share-blog-publisher.env`의 `LLM_PROXY_API_KEY`가 비어 있다.
- `GIT_TERMINAL_PROMPT=0 git push --dry-run origin main` 결과 GitHub username을 읽을 수 없어 실패했다.
- 따라서 CT104는 GitHub credential 설정 전까지 글 생성 단계로 들어가지 않고 안전하게 종료한다.
- GitHub Pages repo로 직접 push하려면 HTTPS credential helper 또는 SSH deploy key 설정이 필요하다.

## 운영 기준
- GitHub Actions hosted fallback은 계속 유지한다.
- CT104 systemd publisher는 nvme-runtime 기반 백업/상시 실행 경로로 둔다.
- GitHub credential이 설정되면 CT104도 같은 하루 1건, 랜덤 지연, 중복 방지 기준으로 직접 발행할 수 있다.
- 실제 색인 반영은 Google Search Console과 Naver Search Advisor 로그인 콘솔에서만 확정한다.
