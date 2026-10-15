export const presets = { spots: { feed: 0.0367, kill: 0.0649 }, stripes: { feed: 0.03, kill: 0.062 }, coral: { feed: 0.0545, kill: 0.062 } };
export function createWorld({ seed = 42, width = 80, height = 40, preset = 'spots' } = {}) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new Error('seed must be unsigned 32-bit');
  if (!Number.isInteger(width) || width < 20 || width > 120 || !Number.isInteger(height) || height < 10 || height > 60) throw new Error('width must be 20–120 and height 10–60');
  if (!Object.hasOwn(presets, preset)) throw new Error('preset must be spots, stripes, or coral');
  let state = seed; const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const u = new Float64Array(width * height).fill(1), v = new Float64Array(width * height);
  for (let patch = 0; patch < 9; patch++) {
    const cx = Math.floor(random() * width), cy = Math.floor(random() * height);
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) { const i = ((cy + y + height) % height) * width + (cx + x + width) % width; u[i] = 0.5; v[i] = 0.22 + random() * 0.08; }
  }
  return { seed, width, height, preset, ...presets[preset], frame: 0, u, v, nextU: new Float64Array(u.length), nextV: new Float64Array(v.length) };
}
export function step(world, count = 1) {
  if (!Number.isInteger(count) || count < 0 || count > 10000) throw new Error('step count must be 0–10000');
  const { width: w, height: h } = world;
  for (let tick = 0; tick < count; tick++) {
    const { u, v, nextU, nextV, feed, kill } = world;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; let lu = -u[i], lv = -v[i];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const j = ((y + dy + h) % h) * w + (x + dx + w) % w, weight = dx && dy ? 0.05 : 0.2;
        lu += u[j] * weight; lv += v[j] * weight;
      }
      const reaction = u[i] * v[i] * v[i];
      nextU[i] = Math.max(0, Math.min(1, u[i] + 0.16 * lu - reaction + feed * (1 - u[i])));
      nextV[i] = Math.max(0, Math.min(1, v[i] + 0.08 * lv + reaction - (feed + kill) * v[i]));
    }
    world.u = nextU; world.v = nextV; world.nextU = u; world.nextV = v; world.frame++;
  }
  return world;
}
export function analyze(world) {
  let sum = 0, active = 0, max = 0;
  for (const n of world.v) { sum += n; if (n > 0.1) active++; max = Math.max(max, n); }
  return { seed: world.seed, width: world.width, height: world.height, preset: world.preset, frame: world.frame, feed: world.feed, kill: world.kill, meanV: sum / world.v.length, maxV: max, activeCells: active };
}
export function render(world, { color = false } = {}) {
  const ramp = ' .:-=+*#%@', rows = [];
  for (let y = 0; y < world.height; y++) { let row = ''; for (let x = 0; x < world.width; x++) { const value = world.v[y * world.width + x], ch = ramp[Math.min(9, Math.floor(value * 22))]; row += color && value > 0.04 ? `\x1b[${value > 0.25 ? 35 : 36}m${ch}\x1b[0m` : ch; } rows.push(row); }
  return rows.join('\n');
}
export function renderSVG(world) {
  const w = world.width * 8 + 64, h = world.height * 8 + 116;
  let cells = '';
  world.v.forEach((v, i) => { const t = Math.min(1, v * 2.5); if (t < 0.02) return; const c = `rgb(${Math.round(30 + t * 190)},${Math.round(190 - t * 70)},${Math.round(180 + t * 60)})`; cells += `<rect x="${32 + i % world.width * 8}" y="${84 + Math.floor(i / world.width) * 8}" width="8" height="8" fill="${c}"/>`; });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${Math.round(h * 800 / w)}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" rx="18" fill="#0d1525"/><g font-family="monospace"><text x="32" y="36" font-size="22" fill="#eff5ff">TERMINAL PATTERN GARDEN</text><text x="32" y="62" fill="#93a4bc">${world.preset} / seed ${world.seed} / iteration ${world.frame}</text>${cells}<text x="32" y="${h - 12}" font-size="11" fill="#93a4bc">Gray–Scott reaction-diffusion / 1 spots 2 stripes 3 coral / n seed r reset q quit</text></g></svg>\n`;
}
