# M1 설계: 파일 감시 파이프라인

작성일: 2026-10-23 · 계획서: ../01-plan/ord-helper.plan.md

## 범위

state.json 변화가 화면까지 도달하게 한다. 워크3 없이 tools/mock-exporter 로 검증한다.

## 백엔드 (src-tauri/src/watcher.rs)

- 감시 대상: `<dir>/state.json`. 기본 dir 는 `%LOCALAPPDATA%\ord-helper`. 시작 시 폴더가 없으면 만든다.
- 내보내기는 파일 전체를 교체하므로 줄 단위 tail 대신 **스냅샷 교체** 로 처리한다.
- notify(폴더, 비재귀) 이벤트 + 1초 폴링. 한 번의 저장에서 여러 이벤트가 오므로 30ms 모아서 한 번만 읽는다.
- 읽은 바이트의 해시로 중복 갱신을 거른다. JSON 파싱 실패(쓰는 중)는 조용히 넘기고 다음 틱에 재시도한다.
- 파싱되면 ord-core `evaluate` 로 조합을 평가해 `ord://state` 이벤트로 `{ file, state, combos }` 를 보낸다.
- 감시 시작/중지/오류는 `ord://status` 이벤트.
- 커맨드: `default_dir`, `start_watch(dir?)`, `stop_watch`, `get_database`, `simulate(units)`.
- 조합 DB 는 data/recipes.json 을 빌드 시 번들한다.

## 프런트 (src/routes/+page.svelte, src/lib/api.ts)

- 시작 시 DB 를 받고 기본 폴더로 감시를 자동 시작한다.
- 3단 화면: 보유 유닛 표 / 조합 가능 + 진행 중(부족 재료) / 로그.
- 게임 규칙 계산은 프런트에 두지 않는다. 이름 조회만 DB 로 한다.

## 검증

1. `cargo test --workspace`, `npm run check`
2. `cargo run -p mock-exporter -- "" 500` 을 켜 둔 채 앱 실행 → 보유 유닛과 조합 가능 목록이 0.5초마다 바뀌는지 확인
3. 앱을 먼저 켜고 mock-exporter 를 나중에 켜도, 반대 순서여도 동작해야 한다
