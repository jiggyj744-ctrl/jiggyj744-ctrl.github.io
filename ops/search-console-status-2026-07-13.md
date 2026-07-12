# 검색 콘솔 상태 관리 - 2026-07-13

## 현재 상태
- 사이트: `https://jiggyj744-ctrl.github.io`
- 기준 제출팩: `ops/search-index-submission-pack-2026-07-13.json`
- Naver 소유확인: `confirmed`
- Naver sitemap: `ready_to_submit`
- Google 소유확인: `needs_console_confirmation`
- Google sitemap: `ready_to_submit`

## URL별 제출 상태
| 우선순위 | Live | Sitemap | RSS | Naver | Google | URL |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 200 | Y | N | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/ |
| 2 | 200 | Y | N | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/blog/ |
| 3 | 200 | Y | Y | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/blog/address-only-share-consultation/ |
| 4 | 200 | Y | Y | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/blog/unreachable-co-owner-share-options/ |
| 5 | 200 | Y | Y | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/blog/sell-co-owned-share-checklist/ |
| 6 | 200 | Y | N | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/guide/sell-co-owned-share/ |
| 7 | 200 | Y | N | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/guide/auction-case-number-review/ |
| 8 | 200 | Y | N | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/guide/inherited-share-sale/ |
| 9 | 200 | Y | N | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/services/share-purchase/ |
| 10 | 200 | Y | N | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/services/share-auction/ |
| 11 | 200 | Y | Y | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/blog/gyeonggi-share-purchase-documents/ |
| 12 | 200 | Y | Y | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/blog/commercial-share-tenant-review/ |
| 13 | 200 | Y | Y | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/blog/co-owner-refuses-sale-share-review/ |
| 14 | 200 | Y | Y | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/blog/co-owner-dispute-share-sale/ |
| 15 | 200 | Y | Y | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/blog/co-owned-land-share-sale-documents/ |
| 16 | 200 | Y | Y | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/blog/co-owned-apartment-share-sale-documents/ |
| 17 | 200 | Y | Y | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/blog/case-number-only-share-consultation/ |
| 18 | 200 | Y | Y | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/blog/inherited-share-sale-records/ |
| 19 | 200 | Y | Y | ready_to_request | ready_to_request | https://jiggyj744-ctrl.github.io/blog/auction-case-number-share-review/ |

## 업데이트 규칙
- 콘솔에 제출했으면 해당 URL의 `naver.requestStatus` 또는 `google.requestStatus`를 `submitted`로 바꾼다.
- 콘솔 결과 확인 후 `consoleStatus`를 `success`, `pending`, `failed`, `excluded` 중 하나로 바꾼다.
- 실패 URL은 `tools/diagnose_indexing_failures.mjs`로 원인 후보를 다시 점검한다.
