# ORD Helper 계획서

작성일: 2026-10-23

## 목표

워크래프트 3 리포지드에서 원피스 랜덤 디펜스(원랜디) 2.323 을 플레이할 때,
보유 유닛을 실시간으로 읽어 지금 가능한 조합과 부족한 재료를 보여주는 데스크톱 앱.

## 데이터 흐름

```
TMO.GG Desktop (워크3 프로세스 메모리 읽기, 클로즈드소스)
  └ scripts/ord-export.lua           0.5초마다 state.json 원자적 기록
       └ %LOCALAPPDATA%\ord-helper\state.json
            └ src-tauri watcher (notify + tokio)
                 └ crates/ord-core 조합 엔진
                      └ Svelte 오버레이 UI
```

- 맵 스크립트나 Preload 는 쓰지 않는다 (유저가 맵에 코드를 넣을 방법이 없음).
- 앱 자체는 메모리를 읽지 않는다. 메모리 읽기와 그에 따른 제재 위험은 TMO.GG Desktop 의 것이며, 이를 감수하기로 결정함.
- 조인 키는 워크3 오브젝트 rawcode (4글자).

## 기술 스택

Tauri 2 (Rust) + SvelteKit (adapter-static, SPA) + Cargo 워크스페이스.

## 마일스톤

| 단계 | 내용 | 워크3 필요 |
|---|---|---|
| M0 | 스캐폴딩, 워크스페이스, ord-core 골격, mock-exporter, Lua 스크립트 초안 | 아니오 |
| M1 | 파일 감시 파이프라인 + 이벤트 로그 UI, mock-exporter 로 검증 | 아니오 |
| M2 | 조합 DB 실데이터 (맵 파일 추출), 솔버 완성 | 아니오 (맵 파일 필요) |
| M3 | 오버레이 UI (투명, 항상 위, 조합 목록) | 아니오 |
| M4 | 테스트 PC 실기 연동, rawcode 방향 확정, fixtures 커밋 | 예 |
| M5 | GitHub Actions 빌드, 릴리스 | 아니오 |

## 미결 사항

- 원랜디 2.323 맵 파일 확보 (M2 전까지)
- TMO.GG API 가 돌려주는 rawcode 바이트 순서 (M4 에서 확정)
- GitHub 원격 저장소 (사용자가 나중에 지정)
