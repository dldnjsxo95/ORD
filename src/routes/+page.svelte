<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { api, type Database, type StatePayload } from '$lib/api';

  let db = $state<Database | null>(null);
  let dir = $state('');
  let watching = $state(false);
  let payload = $state<StatePayload | null>(null);
  let lastAt = $state('');
  let log = $state<string[]>([]);

  const unlisteners: Array<() => void> = [];

  function pushLog(message: string) {
    const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    log = [`${time}  ${message}`, ...log].slice(0, 200);
  }

  function unitName(id: string): string {
    return db?.units.find((u) => u.id === id)?.name ?? id;
  }

  async function start() {
    try {
      dir = await api.startWatch(dir || undefined);
      watching = true;
    } catch (e) {
      pushLog(`시작 실패: ${e}`);
    }
  }

  async function stop() {
    await api.stopWatch();
    watching = false;
  }

  onMount(async () => {
    db = await api.getDatabase();
    dir = (await api.defaultDir()) ?? '';
    unlisteners.push(
      await api.onState((p) => {
        payload = p;
        lastAt = new Date().toLocaleTimeString('ko-KR', { hour12: false });
        const total = Object.values(p.state.units).reduce((a, b) => a + b, 0);
        const ready = p.combos.filter((c) => c.craftable).length;
        pushLog(`갱신  t=${p.state.t.toFixed(1)}s  골드 ${p.state.gold}  유닛 ${total}개  조합 가능 ${ready}건`);
      }),
      await api.onStatus((s) => {
        if (s.kind === 'watching') pushLog(`감시 시작: ${s.dir}`);
        else if (s.kind === 'stopped') pushLog('감시 중지');
        else pushLog(`오류: ${s.message}`);
      }),
    );
    pushLog(`조합 DB ${db.version}: 유닛 ${db.units.length}종, 조합식 ${db.recipes.length}개`);
    await start();
  });

  onDestroy(() => unlisteners.forEach((u) => u()));

  const owned = $derived(
    payload ? Object.entries(payload.state.units).sort(([a], [b]) => a.localeCompare(b)) : [],
  );
  const craftable = $derived(payload?.combos.filter((c) => c.craftable) ?? []);
  const pending = $derived(payload?.combos.filter((c) => !c.craftable) ?? []);
</script>

<main>
  <header>
    <h1>ORD Helper</h1>
    <div class="controls">
      <input type="text" bind:value={dir} placeholder="감시 폴더" disabled={watching} />
      {#if watching}
        <button onclick={stop}>중지</button>
      {:else}
        <button onclick={start}>시작</button>
      {/if}
    </div>
    <div class="status">
      <span class:on={watching}>{watching ? '감시 중' : '중지됨'}</span>
      {#if payload}
        <span>{payload.state.map || '(맵 이름 없음)'}</span>
        <span>골드 {payload.state.gold}</span>
        <span>마지막 갱신 {lastAt}</span>
      {:else}
        <span class="muted">state.json 을 기다리는 중</span>
      {/if}
    </div>
  </header>

  <section class="grid">
    <div class="panel">
      <h2>보유 유닛 <small>{owned.reduce((a, [, n]) => a + n, 0)}</small></h2>
      {#if owned.length === 0}
        <p class="muted">없음</p>
      {:else}
        <table>
          <tbody>
            {#each owned as [id, n] (id)}
              <tr><td class="code">{id}</td><td>{unitName(id)}</td><td class="num">×{n}</td></tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    <div class="panel">
      <h2>조합 가능 <small>{craftable.length}</small></h2>
      {#if craftable.length === 0}
        <p class="muted">없음</p>
      {/if}
      {#each craftable as c (c.result)}
        <div class="combo ready">
          <strong>{c.result_name || c.result}</strong>
          <span class="code">{c.result}</span>
        </div>
      {/each}

      <h2>진행 중 <small>{pending.length}</small></h2>
      {#each pending as c (c.result)}
        <div class="combo">
          <div class="combo-head">
            <strong>{c.result_name || c.result}</strong>
            <span class="num">{c.have}/{c.need}</span>
          </div>
          <div class="missing">
            부족:
            {#each c.missing as m (m.unit)}
              <span class="chip">{unitName(m.unit)} ×{m.count}</span>
            {/each}
          </div>
        </div>
      {/each}
    </div>

    <div class="panel log">
      <h2>로그</h2>
      <pre>{log.join('\n')}</pre>
    </div>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #141518;
    color: #e6e6e6;
    font-family: system-ui, 'Malgun Gothic', sans-serif;
    font-size: 14px;
  }
  main {
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100vh;
    box-sizing: border-box;
  }
  h1 {
    font-size: 18px;
    margin: 0 0 8px;
  }
  h2 {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #9aa0a6;
    margin: 0 0 8px;
  }
  h2 small {
    color: #e6e6e6;
    margin-left: 6px;
  }
  .controls {
    display: flex;
    gap: 8px;
  }
  .controls input {
    flex: 1;
    background: #1e2024;
    border: 1px solid #2c2f35;
    color: inherit;
    padding: 6px 8px;
    border-radius: 4px;
  }
  button {
    background: #2d6cdf;
    color: #fff;
    border: 0;
    padding: 6px 14px;
    border-radius: 4px;
    cursor: pointer;
  }
  .status {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    color: #c0c4c8;
  }
  .status span.on {
    color: #4ade80;
  }
  .muted {
    color: #6b7075;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr 1.4fr 1.2fr;
    gap: 12px;
    flex: 1;
    min-height: 0;
  }
  .panel {
    background: #1b1d21;
    border: 1px solid #2c2f35;
    border-radius: 6px;
    padding: 12px;
    overflow: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  td {
    padding: 4px 6px;
    border-bottom: 1px solid #25282d;
  }
  .code {
    font-family: Consolas, monospace;
    color: #9aa0a6;
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .combo {
    padding: 8px;
    border-radius: 4px;
    background: #202329;
    margin-bottom: 6px;
  }
  .combo.ready {
    background: #16321f;
    border-left: 3px solid #4ade80;
    display: flex;
    justify-content: space-between;
  }
  .combo-head {
    display: flex;
    justify-content: space-between;
  }
  .missing {
    margin-top: 4px;
    color: #9aa0a6;
    font-size: 12px;
  }
  .chip {
    display: inline-block;
    background: #2c2f35;
    padding: 1px 6px;
    border-radius: 10px;
    margin-left: 4px;
    color: #e6e6e6;
  }
  .log pre {
    margin: 0;
    font-size: 12px;
    white-space: pre-wrap;
    color: #c0c4c8;
  }
</style>
