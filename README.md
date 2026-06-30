# Jauction 지분매입 GitHub Pages 랜딩

이 저장소는 `https://jiggyj744-ctrl.github.io/`에서 공개할 정적 랜딩 사이트입니다.

## 운영 방향

- 메인 목적: 공유물 지분, 상속 지분, 토지 지분, 지분경매 사건을 보유한 매도 희망자를 유입
- 처리 흐름: 상담 접수 → 등기·사건자료 검토 → 권리·점유·공유자 구조 확인 → 매입 가능성 또는 보류 사유 안내
- 배포 방식: GitHub Pages 루트 정적 파일
- 커스텀 도메인: 사이트 완성 및 검수 후 마지막 단계에서 연결

## 파일 구조

- `index.html`: 메인 랜딩
- `services/*/index.html`: 유형별 세부 랜딩
- `faq/index.html`: FAQ 및 FAQ schema
- `privacy/index.html`: 개인정보 처리방침
- `assets/styles.css`: 공통 스타일
- `assets/main.js`: 문의 폼 검증, honeypot, 1분 rate limit, SMS fallback
- `robots.txt`, `sitemap.xml`: 색인 재등록용 파일
- `tools/build_site.mjs`: 정적 사이트 재생성 빌더

## 문의 폼 상태

상담 폼은 Cloudflare Workers + D1 API로 저장됩니다. API 장애 시에는 문자 전달 또는 내용 복사 fallback이 표시됩니다.

- API: `https://jauction-lead-api.jiggyj.workers.dev/lead`
- Health: `https://jauction-lead-api.jiggyj.workers.dev/health`

## 재생성

```powershell
node tools/build_site.mjs
```
