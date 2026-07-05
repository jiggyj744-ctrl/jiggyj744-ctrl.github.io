# 지분매입 사이트 검색 등록 이후 실행 계획서 - 2026-07-05

## 현재 상태
- 사이트: `https://jiggyj744-ctrl.github.io/`
- Naver Search Advisor: 소유확인 등록 완료
- 네이버 확인 파일: `https://jiggyj744-ctrl.github.io/naver1d7f4296c8d516b9f9a69a1b4e6c0904.html`
- 네이버 메타 태그: `3bf2b707098dc68bbe5e8db7aad10955cad77bc0`
- sitemap: `https://jiggyj744-ctrl.github.io/sitemap.xml`
- RSS: `https://jiggyj744-ctrl.github.io/feed.xml`
- 블로그 허브: `https://jiggyj744-ctrl.github.io/blog/`
- 최신 글: `https://jiggyj744-ctrl.github.io/blog/address-only-share-consultation/`

## 목표
공유물 지분 매도 의향자가 검색으로 유입되어 상담 폼까지 도달하도록, 검색엔진 등록 이후의 색인 요청, 콘텐츠 확장, 내부 링크 보강, 자동발행 모니터링을 끊기지 않게 운영한다.

## 오늘 처리
1. Naver Search Advisor에 `sitemap.xml` 제출
2. Naver Search Advisor에 `feed.xml` 제출 가능 여부 확인
3. 네이버 웹페이지 수집 요청 우선순위 URL 제출
4. Google Search Console URL-prefix 속성 확인
5. Google Search Console에 `sitemap.xml` 제출
6. 최신 글과 핵심 랜딩 10개 URL을 수동 색인 요청 대상에 등록
7. 자동발행 workflow 다음 실행 예정 시간과 실패 여부 확인
8. `node tools/build_indexing_submission_pack.mjs`로 제출 URL, 라이브 상태, RSS 반영 상태를 한 번에 생성

## 우선 색인 요청 URL
1. `https://jiggyj744-ctrl.github.io/`
2. `https://jiggyj744-ctrl.github.io/blog/`
3. `https://jiggyj744-ctrl.github.io/blog/address-only-share-consultation/`
4. `https://jiggyj744-ctrl.github.io/blog/unreachable-co-owner-share-options/`
5. `https://jiggyj744-ctrl.github.io/blog/sell-co-owned-share-checklist/`
6. `https://jiggyj744-ctrl.github.io/guide/sell-co-owned-share/`
7. `https://jiggyj744-ctrl.github.io/guide/auction-case-number-review/`
8. `https://jiggyj744-ctrl.github.io/guide/inherited-share-sale/`
9. `https://jiggyj744-ctrl.github.io/services/share-purchase/`
10. `https://jiggyj744-ctrl.github.io/services/share-auction/`

## 1-2일 내 처리
1. Search Advisor 수집 현황에서 `수집 성공`, `수집 보류`, `수집 실패`를 분리 기록
2. Google Search Console에서 `발견됨`, `크롤링됨`, `색인 생성됨`, `색인 생성 안 됨` 상태 분리 기록
3. 블로그 글 내부에 홈 상담 섹션, 대표번호, 관련 글 3개 이상을 자연스럽게 연결
4. 카테고리별 허브 페이지의 제목과 설명을 검색 의도 중심으로 재정리
5. FAQ schema 중 반복되는 질문을 정리하고, 상담 전환형 질문을 추가

## 1주 내 처리
1. 지분매입 핵심 주제별 블로그 7개 추가 발행
2. 지역형 키워드 10개 페이지 보강
3. 상속지분, 토지지분, 지분경매, 공유자 연락두절, 주소만 있는 상담 주제의 내부 링크 망 구축
4. 상담 폼 도달 이벤트와 접수 성공 이벤트를 별도 로깅
5. `sitemap.xml`과 `feed.xml` 제출 후 실제 검색 반영 여부를 주 2회 확인

## 콘텐츠 확장 우선순위
| 우선순위 | 주제 | 목적 |
| --- | --- | --- |
| 1 | 주소만 있는 공유지분 상담 | 자료가 부족한 매도자 유입 |
| 2 | 사건번호만 있는 지분경매 상담 | 경매 사건 기반 유입 |
| 3 | 연락 안 되는 공유자 지분 매도 | 갈등 상황 매도자 유입 |
| 4 | 상속지분 매도 상담 | 가족 공동명의 정리 수요 |
| 5 | 토지 공유지분 매도 | 토지/맹지/도로 지분 수요 |
| 6 | 아파트 일부 지분 매도 | 주거 지분 매도 수요 |
| 7 | 공유자 많은 물건 상담 | 복잡한 공유 구조 수요 |

## 자동발행 운영 기준
- 기본 발행량: 하루 블로그 1건
- 발행 방식: GitHub Actions `Hosted Template Blog Fallback`이 VM109 장애 시에도 발행 보조
- 중복 방지: `ops/index-state.json`의 KST 날짜 기준으로 당일 `blog/` 발행이 있으면 추가 발행 중단
- proxy 경로: VM109 runner와 Gemini proxy가 정상일 때 `Continuous Share Blog Publishing`이 우선
- fallback 경로: VM109 runner가 대기 또는 장애이면 GitHub-hosted 템플릿 발행으로 공백 축소

## 모니터링 체크리스트
1. `https://jiggyj744-ctrl.github.io/sitemap.xml` 200
2. `https://jiggyj744-ctrl.github.io/feed.xml` 200
3. 최신 블로그 URL 200
4. `node tools/verify_live.mjs` 통과
5. Pages deployment 최신 커밋 success
6. 자동발행 workflow pending/queued 장기 체류 여부 확인
7. Search Advisor 수집 결과 확인
8. Google Search Console 색인 상태 확인
9. `Search Index Readiness` workflow daily run 성공 여부 확인

## 자동 생성 산출물
- `ops/search-index-submission-urls-YYYY-MM-DD.txt`: 네이버/구글에 순서대로 넣을 핵심 URL 목록
- `ops/search-index-submission-pack-YYYY-MM-DD.json`: sitemap, RSS, 라이브 URL 상태 JSON
- `ops/search-index-submission-report-YYYY-MM-DD.md`: 콘솔 제출용 요약 보고서
- `ops/search-console-status.json`: URL별 네이버/구글 제출 상태 관리 원본
- `ops/search-index-diagnostics-YYYY-MM-DD.md`: 실패/보류 URL 기술 진단 보고서
- `ops/blog-internal-link-report-YYYY-MM-DD.md`: 블로그 내부 링크 보강 점검 보고서

## 성공 기준
- 네이버 소유확인 완료
- 네이버 sitemap 제출 완료
- 구글 sitemap 제출 완료
- 핵심 URL 10개 수동 색인 요청 완료
- 최신 블로그 5개가 sitemap과 RSS에 반영
- 하루 1건 자동발행이 7일 연속 유지
- 상담 폼 접수 후 성공 안내와 메일 전송 경로 정상 유지

## 남은 위험
- 소유확인과 sitemap 제출은 색인 확정을 의미하지 않는다.
- GitHub Pages 무료 도메인은 검색 반영 속도가 느릴 수 있다.
- VM109 runner가 계속 대기 상태이면 proxy 품질 글은 멈추고 템플릿 fallback만 이어진다.
- 자동발행 글이 반복 문장으로 보이면 검색 품질에 불리하므로 주 1회 문장과 내부 링크를 수동 점검한다.
