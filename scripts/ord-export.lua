-- TMO.GG Desktop 용 내보내기 스크립트.
-- 설치 위치: <TMO.GG Desktop 설치 폴더>\games\warcraft3\scripts\ord-export.lua
-- 역할: 내 보유 유닛·기록지침(아이템)·진화체·오로성을 0.5초마다 %LOCALAPPDATA%\ord-helper\state.json 에 기록한다.
-- 출력 형식은 crates/ord-core/src/model.rs 의 GameState 와 같다.
-- 감지 기준은 TMO.GG 공식 애드온(desktop-release/scripts/AddOn.ORD.lua)과 같다:
--   기록지침  = 플레이어 어빌리티 AI00~AI21 또는 내 유닛 인벤토리의 아이템(I000~I003)
--   진화체    = 내 시작 위치에 있는 중립(플레이어 15/27) 유닛 중 어빌리티 Ane2 를 가진 것의 유닛 타입
--   오로성    = 소유자와 무관하게 맵에 있으면 보유로 본다

local OUT_DIR     = os.getenv("LOCALAPPDATA") .. "\\ord-helper"
local OUT         = OUT_DIR .. "\\state.json"
local TMP         = OUT .. ".tmp"
local INTERVAL    = 0.5     -- 초. 전체 유닛 순회를 매 틱 하지 말라는 TMO 문서 권고 반영
local REVERSE_IDS = true    -- 출력의 rawcode 가 뒤집혀 보이면 true 로 바꾼다 (예: "100o" -> "o001")
local SCHEMA_V    = 1

local EVO_ABILITY = "Ane2"
-- 난이도: JASS 전역 변수 이름과 값 → 표기. 변수 이름을 모르면 nil 로 두면 "difficulty":null 로 나간다.
-- (맵 스크립트의 변수명은 war3.jass.variables() 로 덤프해서 찾는다. 스크랩: scripts/ord-probe.lua)
local DIFF_VAR    = nil
local DIFF_MAP    = { }   -- 예: { [1] = "신", [2] = "악몽" } 또는 { ["God"] = "신" }
local GOROSEI     = { o02E = true, o031 = true, o032 = true }
local INV_ITEMS   = { I001 = "AI00", I000 = "AI01", I002 = "AI02", I003 = "AI03" }
local ITEM_ABILS  = {}
for i = 0, 21 do ITEM_ABILS[#ITEM_ABILS + 1] = string.format("AI%02d", i) end

os.execute('mkdir "' .. OUT_DIR .. '" 2>nul')

-- API 가 돌려주는 코드 -> 정방향
local function norm(id)
  if REVERSE_IDS then return id:reverse() end
  return id
end
-- 정방향 코드 -> API 에 넘길 때
local function toApi(id)
  if REVERSE_IDS then return id:reverse() end
  return id
end

local function jsonStr(s)
  return '"' .. s:gsub('[%c"\\]', function(c)
    return string.format("\\u%04x", c:byte())
  end) .. '"'
end

-- 유닛 타입 이름은 바뀌지 않으므로 한 번만 읽는다
local nameCache = {}
local function nameOf(id)
  local n = nameCache[id]
  if n == nil then
    local ok, v = pcall(war3.getObjectName, toApi(id))
    n = (ok and type(v) == "string") and v or ""
    nameCache[id] = n
  end
  return n
end

local function sortedKeys(t)
  local keys = {}
  for k in pairs(t) do keys[#keys + 1] = k end
  table.sort(keys)
  return keys
end

local function difficultyName()
  if not DIFF_VAR then return nil end
  local ok, v = pcall(war3.jass.get, DIFF_VAR)
  if not ok or v == nil then return nil end
  return DIFF_MAP[v] or DIFF_MAP[tostring(v)]
end

local function snapshot()
  if not (war3.isRunning() and war3.hasWorld()) then return nil end
  local me = war3.getLocalPlayer()
  if me < 0 then return nil end
  local difficulty = difficultyName()
  local sx, sy = war3.getPlayerStartLocation(me)

  local counts, items = {}, {}
  local evolution = nil
  for _, h in ipairs(war3.getUnitHandle() or {}) do
    local u = war3.getUnit(h)
    if u then
      local id = norm(u.typeId)
      if u.owner == me then
        -- AddOn.ORD.lua 와 같은 기준으로 숨김 유닛(vertexColor 0x262626) 제외
        if (u.vertexColor & 0x00FFFFFF) ~= 0x00262626 then
          counts[id] = (counts[id] or 0) + 1
          -- 인벤토리 아이템형 기록지침
          local okInv, hasInv = pcall(war3.getUnitHasInventory, h)
          if okInv and hasInv then
            for slot = 0, 5 do
              local okItem, it = pcall(war3.getUnitItem, h, slot)
              local code = okItem and type(it) == "string" and INV_ITEMS[norm(it)]
              if code then items[code] = 1 end
            end
          end
        end
      elseif GOROSEI[id] then
        counts[id] = math.max(counts[id] or 0, 1)
      elseif evolution == nil and (u.owner == 27 or u.owner == 15) and sx and u.x == sx and u.y == sy then
        local ok, abil = pcall(war3.getUnitAbility, h)
        if ok and abil then
          for _, a in ipairs(abil) do
            if norm(a) == EVO_ABILITY then evolution = id; break end
          end
        end
      end
    end
  end

  -- 플레이어 어빌리티형 기록지침
  for _, code in ipairs(ITEM_ABILS) do
    local ok, v = pcall(war3.getPlayerAbilityAvailable, me, toApi(code))
    if ok and v then items[code] = 1 end
  end

  local unitParts, itemParts, nameParts = {}, {}, {}
  for _, id in ipairs(sortedKeys(counts)) do
    unitParts[#unitParts + 1] = jsonStr(id) .. ":" .. counts[id]
    local n = nameOf(id)
    if n ~= "" then nameParts[#nameParts + 1] = jsonStr(id) .. ":" .. jsonStr(n) end
  end
  if evolution then
    local n = nameOf(evolution)
    if n ~= "" and not counts[evolution] then nameParts[#nameParts + 1] = jsonStr(evolution) .. ":" .. jsonStr(n) end
  end
  for _, code in ipairs(sortedKeys(items)) do
    itemParts[#itemParts + 1] = jsonStr(code) .. ":1"
  end

  return string.format(
    '{"v":%d,"t":%.3f,"map":%s,"player":%d,"gold":%d,"wood":%d,"units":{%s},"items":{%s},"evolution":%s,"names":{%s},"difficulty":%s}',
    SCHEMA_V, os.clock(), jsonStr(war3.getMapName() or ""), me,
    war3.getPlayerState(me, PLAYER_STATE_RESOURCE_GOLD) or 0,
    war3.getPlayerState(me, PLAYER_STATE_RESOURCE_LUMBER) or 0,
    table.concat(unitParts, ","), table.concat(itemParts, ","),
    evolution and jsonStr(evolution) or "null",
    table.concat(nameParts, ","),
    difficulty and jsonStr(difficulty) or "null")
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
