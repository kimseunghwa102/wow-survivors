# 맥북으로 옮기기 (WOW Nightswarm 개발 환경)

모든 씬이 이 레포 하나에 들어 있음:

| 폴더 | 씬 | 좌표 | 배포 (맥에서 더블클릭) |
|---|---|---|---|
| `/` | WOW Nightswarm 에스테이트 | -106,76 (12파셀) | `deploy.command` · 막히면 `deploy_alt.command` |
| `/casino-scene` | WOW Casino | -76,-48 | `casino-scene/deploy.command` |
| `/raid` | Reaper Raid | -91,71 | `raid/deploy.command` |
| `/server` | 저장 서버 (Render: wow-survivors-api) | — | Render 대시보드 → Manual Deploy |

홀덤 웹앱 서버는 별도 레포 `kimseunghwa102/holdem-online`.

## 처음 한 번
1. Node.js LTS 설치: https://nodejs.org (macOS Installer)
2. 터미널에서:
   ```bash
   cd ~/Desktop
   git clone https://github.com/kimseunghwa102/wow-survivors.git
   ```
   (git이 없다고 나오면 뜨는 창에서 "설치" — Xcode Command Line Tools)
3. Finder에서 `wow-survivors/deploy.command` 더블클릭.
   "확인되지 않은 개발자" 경고가 뜨면: 파일 우클릭 → 열기 → 열기 (한 번만).

## 평소
- 배포: `deploy.command` 더블클릭 → 브라우저에서 지갑 연결 → Sign and Deploy
- 미리보기: `preview.command`
- `.bat` 파일은 윈도우용 (맥에서는 `.command` 사용)
