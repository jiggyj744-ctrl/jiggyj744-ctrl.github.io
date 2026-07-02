# 지분매입 블로그 자동발행 및 색인 확장 계획서

## 목표
GitHub Pages 기반 지분매입 랜딩 사이트를 공유지분 매도자 유입용 콘텐츠 허브로 확장한다. 블로그 글은 공유지분 매도, 지분경매 사건번호 상담, 상속지분 정리, 토지·상가·주거 지분, 지역별 지분매입 검색 의도를 받아 `/` 상담 접수 폼으로 연결한다.

자동발행은 직접 OpenAI API 과금 호출이 아니라 VM109의 Antigravity/Gemini CLI 프록시를 OpenAI-compatible API처럼 호출하는 구조로 운영한다.

## 현재 확인 상태
- VM104 `cliapi-runtime`: 실행 중. `192.168.0.23:8300` 프록시 `/health` 응답 정상, provider 목록에 `gemini` 포함.
- VM109 `automation-runtime`: 실행 중. `naver-automation-cliproxy-gemini-1` 컨테이너가 `8302` 포트로 정상 실행 중.
- VM109 Gemini 프록시: `gemini-pro` 기준 실제 `/v1/chat/completions` HTTP 200 응답 확인.
- VM109 Git 상태: `git`은 있으나 외부 GitHub push용 deploy key/global identity는 별도 확인 필요.
- 기존 저장소 상태: 자동발행 엔진은 프록시 호출, JSON 파싱 보정, 템플릿 fallback, sitemap/feed/blog hub 갱신, 저수량 백로그 자동 보충을 지원한다.

## 운영 구조
1. `content/blog-backlog.json`에 발행 대기 키워드를 쌓는다.
2. `.github/workflows/continuous-indexing.yml`이 매일 06:12 KST에 실행된다.
3. 실행 위치는 GitHub hosted runner가 아니라 VM109 self-hosted runner를 기준으로 한다.
4. VM109 runner는 `http://127.0.0.1:8302/v1`로 Gemini CLI 프록시를 호출한다.
5. `scripts/seo-content-engine.mjs`가 우선순위가 높은 queued/improve 항목을 선택해 글을 생성한다.
6. queued/improve 블로그 항목이 20개 미만이면 지역·상황 조합 후보를 40개 수준까지 자동 보충한다.
7. 생성 결과가 JSON 형식을 어기거나 금지 문구 검수에 걸리면 템플릿 fallback으로 발행해 루프가 멈추지 않게 한다.
8. 발행 후 `/blog/`, `/feed.xml`, `sitemap.xml`, 메인 최신 블로그 링크를 갱신하고 커밋·푸시한다.

## 필수 설정
- GitHub Actions runner: VM109에 self-hosted runner 등록.
- GitHub Actions secret: `LLM_PROXY_API_KEY`
- GitHub Actions variable: `LLM_PROXY_BASE_URL=http://127.0.0.1:8302/v1`
- GitHub Actions variable: `LLM_PROXY_MODEL=gemini-pro`
- fallback 운영: 프록시 응답이 깨지면 자동 템플릿 발행으로 전환하되, `ops/index-state.json`에 실행 기록을 남긴다.
- backlog refill: queued/improve 항목이 20개 미만이면 안전한 지역·상황 조합 키워드를 자동 추가한다.

## 키워드 확장 구조
검색 의도는 단일 키워드 반복이 아니라 아래 묶음을 조합해 확장한다.

- 매도 의도: 공유지분 매도, 지분 팔고 싶을 때, 소액 지분 매도, 1/2 지분 매도, 1/8 지분 매도
- 사건번호 의도: 지분경매 사건번호, 매각물건명세서 지분, 사건번호만 있는 지분 상담
- 상속 의도: 상속지분 매도, 형제 공동명의 지분, 부모님 부동산 지분 정리
- 공유자 문제: 연락 안 되는 공유자, 매도 반대 공유자, 공유자 갈등, 공유자 수가 많은 물건
- 점유·임대차 의도: 점유자 있는 공유지분, 임차인 있는 상가 지분, 실거주자 있는 주택 지분
- 물건 유형: 아파트, 빌라, 단독주택, 토지, 임야, 농지, 맹지, 도로, 상가, 오피스텔
- 지역 의도: 서울, 경기, 인천, 부산, 대구, 대전, 광주, 울산, 수원, 용인, 성남, 고양, 부천, 화성, 김포, 남양주, 천안, 청주, 제주
- 상담 준비 의도: 주소만 있는 상담, 지분율 모를 때, 등기부등본 확인, 공유자 수 확인, 매도 가능·보류 사유 확인

## 문구 원칙
- 공개 글은 매도자가 상담을 접수하게 하는 정보까지만 제공한다.
- 입찰가, 입찰 일정, 공유물분할 방법, 소송 절차, 가격 산정, 협상 전략, 권리 행사 방법은 공개하지 않는다.
- “단독 소유권 확보 가능성”, “분할 방법”, “예상 기간”처럼 매도 의사를 흔들 수 있는 표현은 블로그 본문에서 제외한다.
- 핵심 메시지는 “주소나 사건번호만 있어도 등기, 지분율, 공유자 수, 점유 상태, 경매 진행 여부를 기준으로 1차 검토”로 통일한다.
- 대표번호는 `1688-0976`만 사용한다.

## 색인 전략
- 모든 신규 글은 canonical, BlogPosting schema, FAQPage schema, RSS, sitemap에 자동 반영한다.
- `/blog/` 허브와 메인 페이지에 최신 글 링크를 반영해 내부 링크를 만든다.
- Naver Search Advisor에는 `sitemap.xml`과 `feed.xml`을 제출하고, 신규 글은 색인 요청 대상으로 묶는다.
- Google Search Console에는 URL-prefix 속성 기준으로 `sitemap.xml`을 제출하고, 초반 2주간 핵심 글을 수동 URL 검사 대상으로 지정한다.
- 실제 색인 여부는 공개 200 응답이 아니라 Search Console/Search Advisor 쪽 상태로 판정한다.

## 우선 실행안
1. VM109 self-hosted runner 등록 및 `LLM_PROXY_API_KEY` secret 입력.
2. 수동 workflow 1회 실행으로 Gemini proxy health, completion, 글 생성, 사이트 검증, 커밋·푸시 확인.
3. 첫 7일은 1일 1건 발행으로 품질과 색인 반응을 본다.
4. 오류율이 낮으면 1일 2건으로 올리되, 유사 키워드 중복 발행은 피한다.
5. queued 항목이 20개 아래로 내려가면 스크립트가 40개 수준까지 자동 보충한다.

## 검증 기준
- workflow에서 Gemini proxy `/health`와 `/chat/completions`가 모두 성공해야 한다.
- `node tools/verify_site.mjs`가 통과해야 한다.
- 신규 글에 금지 브랜드, 이전 전화번호, 레거시 목적 문구가 없어야 한다.
- 신규 글은 상담 폼, 대표번호 `1688-0976`, RSS, sitemap, `/blog/` 허브에 연결되어야 한다.
- Search Console/Search Advisor에서 색인 상태는 별도로 추적한다.

## 남은 운영 리스크
- VM109 self-hosted runner 또는 deploy credential이 없으면 자동 커밋·푸시가 멈춘다.
- Antigravity/Gemini CLI 응답은 지시문을 완전히 따르지 않을 수 있어 JSON 파싱 보정과 fallback이 필요하다.
- 검색엔진 색인은 즉시 반영되지 않으며, 제출 후에도 플랫폼 쪽 보류가 발생할 수 있다.
