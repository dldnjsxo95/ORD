-- TMO.GG Desktop 용 내보내기 스크립트.
-- 설치 위치: <TMO.GG Desktop 설치 폴더>\games\warcraft3\scripts\ord-export.lua
-- 역할: 내 보유 유닛을 0.5초마다 %LOCALAPPDATA%\ord-helper\state.json 에 기록한다.
-- 출력 형식은 crates/ord-core/src/model.rs 의 GameState 와 같다.

local OUT_DIR     = os.getenv("LOCALAPPDATA") .. "\\ord-helper"
local OUT         = OUT_DIR .. "\\state.json"
local TMP         = OUT .. ".tmp"
local INTERVAL    = 0.5     -- 초. 전체 유닛 순회를 매 틱 하지 말라는 TMO 문서 권고 반영
local REVERSE_IDS = false   -- 출력의 rawcode 가 뒤집혀 보이면 true 로 바꾼다 (예: "100o" -> "o001")
local SCHEMA_V    = 1

os.execute('mkdir "' .. OUT_DIR .. '" 2>nul')

local function norm(id)
  if REVERSE_IDS then return id:reverse() end
  return id
end

local function jsonStr(s)
  return '"' .. s:gsub('[%c"\\]', function(c)
    return string.format("\\u%04x", c:byte())
  end) .. '"'
end

local function snapshot()
  if not (war3.isRunning() and war3.hasWorld()) then return nil end
  local me = war3.getLocalPlayer()
  if me < 0 then return nil end

  local counts = {}
  for _, h in ipairs(war3.getUnitHandle() or {}) do
    local u = war3.getUnit(h)
    -- AddOn.ORD.lua 와 같은 기준으로 숨김 유닛(vertexColor 0x262626) 제외
    if u and u.owner == me and (u.vertexColor & 0x00FFFFFF) ~= 0x00262626 then
      local id = norm(u.typeId)
      counts[id] = (counts[id] or 0) + 1
    end
  end

  local parts = {}
  for id, n in pairs(counts) do
    parts[#parts + 1] = jsonStr(id) .. ":" .. n
  end
  table.sort(parts)

  return string.format(
    '{"v":%d,"t":%.3f,"map":%s,"player":%d,"gold":%d,"wood":%d,"units":{%s}}',
    SCHEMA_V, os.clock(), jsonStr(war3.getMapName() or ""), me,
    war3.getPlayerState(me, PLAYER_STATE_RESOURCE_GOLD) or 0,
    war3.getPlayerState(me, PLAYER_STATE_RESOURCE_LUMBER) or 0,
    table.concat(parts, ","))
end

local function writeAtomic(text)
  local f = io.open(TMP, "wb")
  if not f then return end
  f:write(text, "\n")
  f:close()
  os.remove(OUT)          -- Windows 의 rename 은 대상이 있으면 실패한다
  os.rename(TMP, OUT)
end

local last, lastText = 0, nil
callbacks.bind("OnTick", function()
  local now = os.clock()
  if now - last < INTERVAL then return end
  last = now
  local ok, text = pcall(snapshot)
  if not ok then
    print("ord-export 오류: " .. tostring(text))
    return
  end
  if text and text ~= lastText then
    lastText = text
    writeAtomic(text)
  end
end)

print("ord-export 시작: " .. OUT)
