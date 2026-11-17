# WOW Survivors — Decentraland 씬

Wow Casino 에스테이트(#6532, 기준 -106,76, 12파셀)용 서바이버즈 장르 호드 게임 + PvP. 씬 안 텍스트는 전부 영어.
(장르 메커닉만 차용한 오리지널 게임 — 이름·캐릭터·에셋은 전부 자체 제작)

## 맵

```
 y\x  -106 -105 -104 -103
  80   ▓    ▓               ← Cathedral courtyard (arena 2, Lich King 등장)
  79   ▓    ▓
  78        ▓    ▓    ★     ← ★ Hall of Legends (안전, 리더보드)
  77        ▓    ▓          ← Graveyard (arena 1, 중앙 룬 서클)
  76   ☆    ▓    ▓          ← ☆ Sanctuary (안전, 스폰·상점·설명판)
```

## 게임 루프

- 게이트로 아레나 입장 → 시작 무기 3개 중 선택 → 자동 공격, 몬스터 끝없이 증가
- 보석 → 레벨업 → 카드 3장 중 선택 (리롤 2회, 스킵 시 골드). 보유 중인 아이템이 더 잘 나와서 빌드가 굴러감
- 무기 6종 × 8레벨, 패시브 10종 × 5레벨, 슬롯 각 6칸
- 진화: 무기 MAX + 짝 패시브 보유 → 상자 열면 진화
  - Lash+Might → Blood Reaper / Bolt+Duplicator → Arcane Storm / Blades+Haste → Blade Cyclone
  - Aura+Vitality → Soul Siphon / Thunder+Expanse → Wrath of Heaven / Nova+Plating → Solar Flare
- 1분마다 엘리트(상자 드랍), 90초마다 박쥐 포위, 5분마다 Lich King 보스(큰 상자)
- 상자 = 슬롯머신 연출, 1/3/5개 업그레이드 (JACKPOT)
- 레벨업·상자 선택 중엔 몬스터 정지 + 무적. Sanctuary로 나가면 런 일시정지
- 죽으면 골드 적립 → Shrine of Power에서 영구 강화(세션 동안): 공격력·체력·자석·경험치

## PvP

- 아레나 안에서 런 진행 중인 플레이어끼리 서로의 무기에 맞음 (데미지 35%로 조정)
- 상대 머리 위에 레벨·HP·킬 표시, 상대의 칼날·오라도 보임
- 처치하면 바운티(경험치 + 골드), 죽은 쪽은 골드 30% 손실
- Hall of Legends: 생존 시간 TOP 10, PvP 킬 TOP 5 (씬 동기화)

## 파일

- `blender/build_arena.py` — 아레나 전체(Blender, 텍스처 자동 생성) → `models/arena.glb`
- `blender/build_monsters.py` — 박쥐·구울·엘리트·스켈레톤·레이스·리치 킹(애니메이션), 보석·코인·상자
- `blender/make_sfx.py` — 효과음 11종 합성 → `sounds/`
- `src/game/core.ts` — 순수 게임 로직 (Node에서 밸런스 시뮬 가능)
- `src/game/view.ts` 렌더링 풀 · `net.ts` 멀티플레이 · `game.ts` 진행 · `sfx.ts` · `src/ui.tsx` HUD
- `layout.json` — 좌표 (Blender·코드 공용)

## 실행

```bash
npm install
pip install bpy numpy pillow   # 모델 다시 만들 때만
npm run models
npm run start
npm run deploy
```

## 한도

삼각형 약 80k/120k(풀 전부 렌더 기준), 엔티티 약 500/2400, 최고 높이 18m. 파셀 밖 정점 0.

## 저장 서버 (server/)

지갑 단위로 골드·Shrine 강화·최고 기록·전체 리더보드를 저장. 로그인/PIN 없음 — 씬이 `signedFetch`로 요청하면 디센트럴랜드가 지갑 서명을 붙이고 서버가 검증.
치팅 방지: 서버가 잰 실제 경과시간 이하로만 인정, 골드 12/초·킬 20/초·PvP 4/분 상한, 런 1회 1정산, 상점 구매는 서버에서만.

배포 (홀덤과 같은 GitHub + Render 무료 + Neon 무료):
1. 이 폴더를 GitHub 레포로 push
2. Neon → 새 프로젝트 → Connection string 복사
3. Render → New → Blueprint → 레포 선택 (`render.yaml` 자동 인식) → `DATABASE_URL`에 붙여넣기 → Deploy
4. 나온 주소가 `https://wow-survivors-api.onrender.com`가 아니면 `src/config.ts`의 `API_URL` 수정
5. `npm run deploy`

서버가 꺼져 있거나 주소가 비어 있으면 게임은 자동으로 "세션 한정" 모드로 돌아감.

## 플레이테스트로 확인할 것

1. 이동 속도: Swiftness 패시브가 기본 이동속도 추정값(jog 8, run 10)에 곱해짐 → `game.ts` 조정
2. 난이도: `core.ts` TUNING / `defs.ts` 수치
3. Render 무료 플랜은 15분 무접속 시 잠듦 → 첫 접속 때 최대 약 50초간 오프라인 모드(자동 재시도)
