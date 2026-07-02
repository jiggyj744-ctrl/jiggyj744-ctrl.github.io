# 지분매입 블로그 장기 자동 발행 보강 보고서

## 적용일
- 2026-07-02

## 처리 목표
- 서버 재시작과 GitHub Actions 재실행에도 하루 1건 랜덤 시간 발행 흐름을 유지한다.
- 발행 글이 늘어나도 검증 목록을 수동 관리하지 않는다.
- 블로그 디자인 재빌드 때 기존 본문이 템플릿 fallback으로 덮이지 않게 한다.
- 발행 후 공개 URL과 sitemap/feed/category 반영까지 확인한다.

## 적용 내용
1. 발행 원본 보존
   - `content/blog-posts/*.json`에 발행 글의 제목, 설명, 본문 섹션, 체크리스트, FAQ, 썸네일을 저장한다.
   - `--rebuild-blog-only`는 저장된 원본 JSON을 우선 사용한다.
   - 원본 JSON이 없는 기존 글은 현재 HTML에서 구조를 추출해 시드한다.

2. 블로그 카테고리 색인 구조
   - 발행 글이 있는 카테고리만 `/blog/category/*/` 페이지로 생성한다.
   - `/blog/` 필터 버튼은 실제 카테고리 URL로 연결한다.
   - 카테고리 URL은 sitemap에 자동 반영한다.

3. 검증 자동화
   - `tools/verify_site.mjs`는 `content/blog-backlog.json`의 published 글 전체를 읽어 HTML, 원본 JSON, RSS, sitemap, 블로그 허브 링크를 확인한다.
   - `tools/verify_live.mjs`는 sitemap과 blog-backlog를 읽어 공개 URL 전체를 검증한다.

4. 장기 실행 보강
   - GitHub Actions는 `[self-hosted, vm109]` 라벨 러너에서만 실행된다.
   - 발행 스크립트는 lock/log 기본 경로를 `/tmp` 기반으로 두어 일반 runner 권한에서도 실패하지 않게 했다.
   - 발행 후 공개 URL 확인에 이어 `node tools/verify_live.mjs`를 최대 5회 재시도한다.

## 현재 생성된 공개 페이지
- `https://jiggyj744-ctrl.github.io/blog/`
- `https://jiggyj744-ctrl.github.io/blog/sell-co-owned-share-checklist/`
- `https://jiggyj744-ctrl.github.io/blog/auction-case-number-share-review/`
- `https://jiggyj744-ctrl.github.io/blog/inherited-share-sale-records/`
- `https://jiggyj744-ctrl.github.io/blog/category/share-sale/`
- `https://jiggyj744-ctrl.github.io/blog/category/share-auction/`
- `https://jiggyj744-ctrl.github.io/blog/category/inherited-share/`

## 완료 기준
- `node --check scripts/seo-content-engine.mjs`
- `node --check tools/verify_site.mjs`
- `node --check tools/verify_live.mjs`
- `node tools/verify_site.mjs`
- 배포 후 `node tools/verify_live.mjs`

## 남은 운영 확인
- VM109 GitHub self-hosted runner에 `vm109` 라벨이 반드시 있어야 한다.
- `LLM_PROXY_API_KEY`, `LLM_PROXY_BASE_URL`, `LLM_PROXY_MODEL` 설정이 GitHub 또는 `/etc/jauction-share-blog-publisher.env`에 있어야 한다.
- 실제 색인은 Google Search Console과 Naver Search Advisor에서 별도 확인해야 한다.
