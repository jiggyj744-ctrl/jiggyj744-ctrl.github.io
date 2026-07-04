# 지분매입 블로그 자동발행 운영 리뷰 - 2026-07-04

## 현재 결론
- 2026-07-04 기준 기존 `Continuous Share Blog Publishing` 자동발행은 정상 발행 중이 아니었다.
- 원인은 콘텐츠 엔진이 아니라 GitHub Actions `self-hosted, vm109` runner 배정 전 대기 상태였다.
- 마지막 실제 블로그 발행은 `2026-07-03 20:47:14 KST`의 `blog/unreachable-co-owner-share-options`이다.
- 2026-07-04에는 운영 점검 시점까지 새 블로그 발행 기록이 없었다.

## 최근 실제 발행 시간
| KST 발행 시간 | 모델 | 경로 |
| --- | --- | --- |
| 2026-07-03 20:47:14 | template-cost-safe | `/blog/unreachable-co-owner-share-options/` |
| 2026-07-02 10:59:04 | proxy:gemini-pro | `/blog/sell-co-owned-share-checklist/` |
| 2026-07-02 05:10:04 | proxy | `/blog/inherited-share-sale-records/` |
| 2026-07-01 18:59:13 | proxy | `/blog/auction-case-number-share-review/` |

## 2026-07-04 GitHub Actions 상태
| KST 생성 시간 | 상태 | 결론 | 비고 |
| --- | --- | --- | --- |
| 2026-07-04 19:58:16 | pending | - | job 0개, runner 배정 전 대기 |
| 2026-07-04 18:07:08 | completed | cancelled | 발행 안 됨 |
| 2026-07-04 16:11:45 | queued | - | runner 대기 |
| 2026-07-04 14:28:10 | completed | cancelled | 발행 안 됨 |
| 2026-07-04 09:16:22 | completed | cancelled | 발행 안 됨 |
| 2026-07-03 23:57:48 | completed | cancelled | 발행 안 됨 |

## 보강한 구조
1. 기본 경로는 VM109 Gemini proxy를 계속 사용한다.
2. 기존 workflow의 slot 선택 job은 GitHub-hosted runner에서 먼저 실행되도록 분리했다.
3. 실제 proxy 발행이 필요한 경우에만 `self-hosted, vm109` job을 요청한다.
4. VM109 runner가 내려가도 GitHub-hosted `Hosted Template Blog Fallback` workflow가 하루 1건 템플릿 발행을 대신 시도한다.
5. fallback workflow는 하루 6개 후보 시간 중 KST 날짜 checksum으로 시작 slot을 고르고, 선택 slot 이후는 catch-up으로 동작한다.
6. 실제 발행 시간은 각 workflow의 `PUBLISH_JITTER_MAX_SECONDS`로 추가 지연되어 매일 같은 시간이 되지 않도록 했다.
7. 발행 스크립트는 `ops/index-state.json` 기준 KST 당일 블로그 발행이 이미 있으면 추가 발행을 중단한다.
8. proxy API 키가 없거나 proxy probe가 실패해도 `ALLOW_TEMPLATE_ON_PROXY_FAILURE=1`이면 템플릿 발행으로 전환한다.
9. systemd timer는 부팅 10분 뒤부터 30분마다 watchdog 방식으로 같은 스크립트를 호출한다.
10. lock 파일과 daily guard가 GitHub Actions, hosted fallback, systemd timer 간 중복 발행을 막는다.
11. 자동발행 스크립트 기본값은 `PUBLISH_SCOPE=blog`라서 키워드 랜딩 대기열이 생겨도 하루 자동발행은 블로그 1건만 처리한다.

## 하루 발행량
- 기본값: 하루 블로그 1건.
- 중복 방지 기준: KST 날짜 기준 `ops/index-state.json`에 `blog/` 경로 발행 기록이 있으면 종료.
- 자동발행 scope: `PUBLISH_SCOPE=blog`.
- 수동으로 `FORCE_PUBLISH=1` 또는 workflow `force=1`을 넣은 경우만 같은 날 추가 발행이 가능하다.

## 운영 우선순위
1. `Hosted Template Blog Fallback` workflow로 VM109 장애 시에도 발행 공백을 줄인다.
2. VM109 runner가 복구되면 `Continuous Share Blog Publishing` workflow가 Gemini proxy 경로를 다시 사용한다.
3. VM109 systemd timer는 서버 재부팅 후 로컬 백업 루프로 동작한다.
4. Search Console과 Naver Search Advisor에서는 새 URL 색인 상태를 별도 확인한다. 공개 200과 실제 색인은 같은 의미가 아니다.

## 확인 링크
- 블로그 허브: `https://jiggyj744-ctrl.github.io/blog/`
- 최신 발행 글: `https://jiggyj744-ctrl.github.io/blog/unreachable-co-owner-share-options/`
- 카테고리 허브: `https://jiggyj744-ctrl.github.io/blog/category/co-owner-issue/`
- 기본 자동발행 workflow: `https://github.com/jiggyj744-ctrl/jiggyj744-ctrl.github.io/actions/workflows/continuous-indexing.yml`
- hosted fallback workflow: `https://github.com/jiggyj744-ctrl/jiggyj744-ctrl.github.io/actions/workflows/hosted-template-fallback.yml`

## 완료 기준
- `node --check scripts/seo-content-engine.mjs` 통과
- `node --check tools/verify_site.mjs` 통과
- `node --check tools/verify_live.mjs` 통과
- `sh -n ops/vm109-share-blog-publisher.sh` 통과
- `node tools/verify_site.mjs` 통과
- 배포 후 `node tools/verify_live.mjs` 통과
- GitHub API에서 새 fallback workflow가 active로 보임
- 최신 Pages deployment가 success로 보임
