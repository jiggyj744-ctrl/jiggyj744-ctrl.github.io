# 지분매입 블로그 확장 및 자동발행 구현 기획

## 목적
GitHub Pages 기반 지분매입 랜딩을 지속 색인 가능한 전문 콘텐츠 허브로 확장한다. 블로그는 공유지분 매도, 지분경매, 상속지분, 공유물분할청구, 지역별 지분매입 검색 의도를 받아 상담 접수로 연결한다.

## 구조
- /blog/: 블로그 허브
- /blog/{slug}/: 개별 블로그 글
- /feed.xml: RSS 피드
- content/blog-backlog.json: 발행 대기열
- prompts/share-blog-post.md: DeepSeek 자동 생성 지침
- scripts/seo-content-engine.mjs: guide와 blog를 같은 workflow에서 발행

## 자동발행 방식
GitHub Actions Continuous Share Indexing가 매일 실행된다. 실행 시 content/blog-backlog.json과 content/keyword-backlog.json에서 queued/improve 항목을 우선순위대로 선택하고, DeepSeek API로 글을 생성한다. 생성 품질이 부족하거나 JSON 파싱이 실패하면 템플릿 fallback으로 발행하여 자동발행이 멈추지 않게 한다.

## 색인 장치
- sitemap 자동 추가
- RSS 자동 갱신
- /blog/ 허브 자동 갱신
- 메인 페이지 최신 블로그 링크 자동 갱신
- BlogPosting + FAQPage schema 삽입
- canonical, description, Naver verification 유지

## 검증 기준
- 새 글 200 응답
- H1 1개
- canonical, BlogPosting, FAQPage, RSS link 포함
- 전화번호 1688-0976 포함
- FactoryPro, 공장경매, 기존 개인번호 미포함
- sitemap/feed/main/blog 허브에 자동 반영
