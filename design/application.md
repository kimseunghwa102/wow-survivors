# Creator Success V0 — application kit (owner's working notes, not reviewed)

Form: https://docs.google.com/forms/d/e/1FAIpQLSc2xYxbrn75q2SjX-_MGyWmjQaEVOGVDg8-Uj9iXMMYA_zT_A/viewform
Program page: https://docs.decentraland.org/creator/studio-onboarding
Deadline for the first V0 round: **2026-11-30** (reviewed weekly — earlier is better; you may reapply).

## 제출 전 체크리스트 (순서대로)

1. [ ] **Featured 게임 플레이 (직접 해야 함)** — Decentraland → Discover → Places → Featured 게임 3개 이상, 각 10분 이상, 합계 90분 이상. 그중 2개는 **다른 날** 다시 들어가기. 아래 메모 표를 채워.
2. [ ] **Decentraland NAME 준비** — 지갑에 `xxx.dcl.eth` NAME이 있어야 World 배포 가능 (없으면 마켓플레이스에서 100 MANA로 구매). ENS(.eth)도 되지만 용량 25MB라 이 게임(약 42MB)은 안 됨 → **dcl.eth NAME 필요**.
3. [ ] **테스트 World 배포** — `deploy_world.bat` 실행 → NAME 입력 → 브라우저에서 NAME 가진 지갑으로 서명.
4. [ ] **링크 채우기** — README.md의 Test World `TBD`와 design/gdd.md의 Deployment target / TL;DR status `TBD`를 실제 링크로 교체.
5. [ ] **GDD 마커 정리** — `[OPEN: …]`(본인 작성: Why this game, IP 확인)과 `[agent-decided]`(내가 정한 것: 팀명, Hunt Party V0 범위, 비교 게임)를 확인 → 맞으면 마커만 지우고, 아니면 고치기. Discord/이메일 채우기. 맨 위 이탤릭 두 줄 삭제.
6. [ ] **GitHub 접근 권한** — 폼에 적힌 재단 GitHub 계정들을 레포 `kimseunghwa102/wow-survivors`에 collaborator로 초대 (레포는 이미 public이지만 폼이 요구함).
7. [ ] **폼 제출** — 아래 답변 초안 사용.

## 중요 판단 (내가 정한 것, 바꿔도 됨)

- **라이브 게임 문제**: Creator Success는 "개발 중인 게임"에 돈을 줌. 그래서 지원 대상은 지금 라이브 버전이 아니라 **다음 버전 = Hunt Party(2–4인 협동: 파티, 부활, 보스 금고 분배) + 모바일 최적화**로 잡았어. 라이브 에스테이트는 "playable prototype" 증거로 씀.
- **카지노·유료 골드 제외**: 에스테이트의 홀덤(ETH/MANA로 산 골드로 하는 포커)은 Content Policy 도박 리스크. 테스트 World 빌드는 카지노·골드 상점·레이드 게이트를 **코드에서 끔** (`src/edition.ts`). GDD에 "v1에도 도박 없음"을 standing non-goal로 적었어. ※ 에스테이트(-106,76) 쪽은 그대로임 — Creator Fund도 도박 콘텐츠는 집계 안 하니 카지노를 에스테이트에서 분리할지 따로 결정해.

## Featured 게임 메모 (직접 채우기 — 지어내면 안 됨)

| Game (Featured) | Day 1 minutes | Return day + minutes | Understood in first minute? | How other players changed it | What I'd change | What made me want to return |
|---|---|---|---|---|---|---|
| 1. | | | | | | |
| 2. | | | | | | |
| 3. | | | | | | |

## Form answer drafts (English — edit freely)

**About you / team**
> I'm a solo developer (WOW Automation, an RPA / automation consultancy) based in Hanoi, building with Claude Code and Blender scripts. I shipped WOW Nightswarm to my 12-parcel estate at -106,76 in November 2026 and update it almost daily, with a small save server (wallet-signed saves, quests, streaks, boards) on Render + Postgres.

**What you learned from the Featured games**
> `TBD: write from your own notes above — 3–5 sentences: what you understood fast, what other players changed, what you'd copy or avoid in Nightswarm.`

**Deployed test scene link**
> `TBD: https://decentraland.org/play/?realm=YOURNAME.dcl.eth`

**GitHub repository**
> https://github.com/kimseunghwa102/wow-survivors (GDD at /design/gdd.md)

**What the V0 slice is (if asked)**
> The core loop is already playable. V0 makes it social-first and mobile-ready: a Hunt Party mode where 2–4 hunters link at the gate, revive each other and split boss vaults, plus a phone-first HUD pass. No gambling or paid currency in the funded build.
