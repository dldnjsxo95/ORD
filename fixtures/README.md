# fixtures

테스트 PC 에서 TMO.GG Desktop + scripts/ord-export.lua 로 얻은 **실제 state.json 출력**을 여기에 둔다.

- `state.sample.json`: 커밋 대상. 파서와 조합 엔진 테스트의 입력으로 쓴다 (실기 출력을 얻은 뒤 추가).
- `local/`: 커밋하지 않는 임시 출력 (.gitignore 에 포함).

실기 출력을 얻으면 가장 먼저 확인할 것: rawcode 가 뒤집혀 있는지 (`"100o"` 처럼 보이면 뒤집힌 것).
뒤집혀 있으면 scripts/ord-export.lua 의 `REVERSE_IDS` 를 `true` 로 바꾼다.
