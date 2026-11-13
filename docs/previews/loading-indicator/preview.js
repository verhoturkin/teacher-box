// Preview only. Geometry is precomputed with material-shapes-ts 0.3.0 (Apache-2.0),
// a port of AndroidX Graphics Shapes; see README.md and NOTICE.
const geometry = await fetch('./geometry.json').then((response) => response.json());
const byId = (id) => document.getElementById(id);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = byId('reduced');
reduced.checked = reducedMotion.matches;
reducedMotion.addEventListener('change', (event) => { reduced.checked = event.matches; });

function pathData(cubics) {
  return `M${cubics[0][0]},${cubics[0][1]} ` +
    cubics.map((cubic) => `C${cubic.slice(2).join(',')}`).join(' ') + 'Z';
}

function morphPath(index, progress) {
  const pair = geometry.morphs[index];
  return pathData(pair.start.map((cubic, i) =>
    cubic.map((value, j) => value + (pair.end[i][j] - value) * progress)));
}

// Unit-mass underdamped spring: stiffness 200, damping ratio 0.6.
// AndroidX starts a new morph every 650 ms; global rotation is 360° / 4666 ms.
function spring(milliseconds) {
  const omega = Math.sqrt(200);
  const damping = 0.6;
  const damped = omega * Math.sqrt(1 - damping * damping);
  const t = milliseconds / 1000;
  return 1 - Math.exp(-damping * omega * t) *
    (Math.cos(damped * t) + damping * omega / damped * Math.sin(damped * t));
}

function draw(element, elapsed) {
  const still = reduced.checked;
  const step = still ? 0 : Math.floor(elapsed / 650);
  const progress = still ? 0 : spring(elapsed % 650);
  const index = step % geometry.names.length;
  element.querySelector('path').setAttribute('d', morphPath(index, Math.max(0, Math.min(1, progress))));
  const angle = still ? 90 : 90 + step * 90 + progress * 90 + elapsed * 360 / 4666;
  element.querySelector('g').setAttribute('transform',
    `translate(.5 .5) rotate(${angle}) scale(${geometry.scale}) translate(-.5 -.5)`);
}

geometry.names.forEach((name, i) => {
  const item = document.createElement('div');
  item.className = 'shape';
  item.innerHTML = `<svg viewBox="0 0 1 1" aria-hidden="true"><path d="${pathData(geometry.shapes[i])}" /></svg><span>${name}</span>`;
  byId('shapes').append(item);
});

let paused = false;
let elapsed = 0;
let previous;
let speed = 1;
let simulation;
const pending = byId('pending');

function frame(now) {
  if (previous !== undefined && !paused) elapsed += (now - previous) * speed;
  previous = now;
  document.querySelectorAll('[data-animated]').forEach((element) => {
    if (element === pending) return;
    draw(element, elapsed);
  });
  if (simulation) {
    const age = now - simulation.started;
    // Completion wins over the visibility threshold, including duration === 200.
    if (age >= simulation.duration) {
      pending.hidden = true;
      byId('hint').hidden = true;
      byId('result').hidden = false;
      byId('result').textContent = simulation.shown
        ? `Данные готовы · ${simulation.duration} мс`
        : `Данные готовы · ${simulation.duration} мс · индикатор не появлялся`;
      document.querySelector('.simulation').setAttribute('aria-busy', 'false');
      simulation = undefined;
    } else if (age > 200) {
      pending.hidden = false;
      simulation.shown = true;
      draw(pending, age - 200);
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

byId('pause').addEventListener('click', () => {
  paused = !paused;
  byId('pause').textContent = paused ? 'Продолжить' : 'Пауза';
  byId('pause').setAttribute('aria-pressed', String(paused));
});
byId('speed').addEventListener('change', (event) => { speed = Number(event.target.value); });
byId('theme').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme !== 'dark';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  byId('theme').textContent = dark ? 'Светлая тема' : 'Тёмная тема';
  byId('theme').setAttribute('aria-pressed', String(dark));
});
byId('run').addEventListener('click', () => {
  pending.hidden = true;
  byId('result').hidden = true;
  byId('hint').hidden = true;
  document.querySelector('.simulation').setAttribute('aria-busy', 'true');
  simulation = { started: performance.now(), duration: Number(byId('duration').value), shown: false };
});
