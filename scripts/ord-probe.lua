-- 임시 탐색용: JASS 전역 변수 목록을 한 번 덤프한다 (난이도 변수 찾기). 끝나면 삭제.
local OUT = os.getenv("LOCALAPPDATA") .. "\\ord-helper\\vars.txt"
local done = false
local function dump()
  local vars = war3.jass.variables()
  local f = io.open(OUT, "wb")
  if not f then return end
  if not vars then f:write("nil\n"); f:close(); return end
  for _, v in ipairs(vars) do
    local val = v.value
    local s
    if type(val) == "table" then
      local parts = {}
      for i = 1, math.min(#val, 8) do parts[#parts + 1] = tostring(val[i]) end
      s = "[" .. table.concat(parts, ",") .. "]"
    else
      s = tostring(val)
    end
    f:write(tostring(v.name), "\t", tostring(v.type), "\t", s, "\n")
  end
  f:close()
end
callbacks.bind("OnTick", function()
  if done then return end
  done = true
  local ok, err = pcall(dump)
  if not ok then print("ord-probe 오류: " .. tostring(err)) end
end)
print("ord-probe 시작")
