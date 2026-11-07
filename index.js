const outside = document.getElementById("outside"); // pumpkin part
const inside  = document.getElementById("inside");  // fire
const diffC   = document.getElementById("diff");
const ctx_o = outside.getContext("2d");
const ctx_i = inside.getContext("2d");
const ctx_d = diffC.getContext("2d");
const tc = document.getElementById('target').getContext('2d');
let color;
window.best = 0
const MASK_W = 100;
const MASK_H = 50;
const PAGES =  ['main-menu', 'game-container', 'editor-container', 'settings-container'];
window.colors = ["red", "green", "blue", "purple", "white"];
const FACE_COLORS = window.colors;
const FACE_MAX = {
    shapes: 20,
    points: 200,
    spec: 20000,
};
const newBest = (score) => { window.best = Math.max(window.best, score);}
const hex = {"red":"#f38ba8","green":"#a6e3a1","blue":"#89b4fa","purple":"#cba6f7","white":"#f5e0dc"};
drawFace(tc, 1, '#1e1e2e');

window.difficulty = "easy" // easy, medium, hard, insane
const DIFFICULTY = {
    easy:   { tolerance: 3, fullMarks: 0.65 },
    medium: { tolerance: 2, fullMarks: 0.75 },
    hard:   { tolerance: 1, fullMarks: 0.90 },
    insane: { tolerance: 0, fullMarks: 0.95 },
};

const msgs = {
    0:  ["did you not even try?"],
    10: ["maybe try again","lines are hard."],
    50: ["i mean it's ok","try harder","see if you can get to 70%"],
    70: ["wow","good job","you passed","see if you can improve"],
    80: ["entering the big leagues","carving expert","wow!"],
    90: ["pro","carving master","insanely good","near perfect"],
    99: ["pro+","carving grand master","perfection"]
}


const audio = new Audio('music.mp3');
audio.loop = true;

const smallDiff = document.createElement('canvas');
smallDiff.width = MASK_W; smallDiff.height = MASK_H;
const sdctx = smallDiff.getContext('2d');

const HIT    = [166, 227, 161];   // #a6e3a1
const EXTRA  = [243, 139, 168];   // #f38ba8
const MISSED = [108, 112, 134];   // #6c7086

function showDiff(carved, target, carvedWide, targetWide) {
    const img = sdctx.createImageData(MASK_W, MASK_H);
    const px = img.data;

    for (let i = 0; i < MASK_W * MASK_H; i++) {
        let col = null;
        if (target[i] && carvedWide[i])       col = HIT;
        else if (target[i])                   col = MISSED;
        else if (carved[i] && !targetWide[i]) col = EXTRA;
        if (!col) continue;
        px[i*4]   = col[0];
        px[i*4+1] = col[1];
        px[i*4+2] = col[2];
        px[i*4+3] = 200;
    }
    sdctx.putImageData(img, 0, 0);

    ctx_d.clearRect(0, 0, width, height);
    ctx_d.imageSmoothingEnabled = true;
    ctx_d.drawImage(smallDiff, 0, 0, width, height);
}


const scratch = document.createElement('canvas');
scratch.width = MASK_W;
scratch.height = MASK_H;
const sctx = scratch.getContext('2d', { willReadFrequently: true });

function getMask(source, isOn) {
    sctx.clearRect(0,0,MASK_W,MASK_H);
    sctx.drawImage(source,0,0,MASK_W,MASK_H);
    const data = sctx.getImageData(0,0,MASK_W,MASK_H).data;

    const mask = new Uint8Array(MASK_W * MASK_H);
    
    for (let i = 0; i < mask.length; i++) {
        mask[i] = isOn(data[i * 4 + 3]) ? 1 : 0;
    };
    return mask;
}

function dilate(mask, r) {
    if (r <= 0) return mask;
    const out = new Uint8Array(mask.length);
    for (let y = 0; y < MASK_H; y++) {
        for (let x = 0; x < MASK_W; x++) {
            if (!mask[y * MASK_W + x]) continue;
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && nx < MASK_W && ny >= 0 && ny < MASK_H) {
                        out[ny * MASK_W + nx] = 1;
                    }
                }
            }
        }
    }
    return out;
}

function score(carved, target, tolerance) {
    const carvedWide = dilate(carved, tolerance);
    const targetWide = dilate(target, tolerance);

    let targetTotal = 0, targetHit = 0, carvedTotal = 0, carvedGood = 0;

    for (let i = 0; i < target.length; i++) {
        if (target[i]) {
            targetTotal++;
            if (carvedWide[i]) targetHit++;
        }
        if (carved[i]) {
            carvedTotal++;
            if (targetWide[i]) carvedGood++;
        }
    }

    const coverage  = targetTotal ? targetHit / targetTotal : 0;
    const precision = carvedTotal ? carvedGood / carvedTotal : 0;
    return { coverage, precision, raw: coverage * precision, carvedWide, targetWide };

}
// url thingy idea
// i think im goona use the prefix parse for the url stuff to keep it organized.

function parsePreset(spec) {
    const m = spec.match(/^([0-2])([0-2])([0-2])(?:-([a-z]+))?$/)
    if (!m) return null;
    const colorName = m[4] || FACE_COLORS[Math.floor(Math.random() * FACE_COLORS.length)];
    if (!FACE_COLORS.includes(colorName)) return null;
    return {kind: 'preset', modes: [Number(m[1]), Number(m[2]), Number(m[3])],colorName,}
}

function parsePolygons(spec) {
    const shapes = [];
    for (const s of spec.split(/[;|]/)) {
        const i = s.indexOf(':');
        if (i < 0) return null;
        const colorName = s.slice(0, i);
        if (!FACE_COLORS.includes(colorName)) return null;
        const points = [];
        for (const p of s.slice(i + 1).trim().split(/\s+/)) {
            if (!p) continue;
            const bits = p.split(',');
            if (bits.length !== 2) return null;
            const x = Number(bits[0]), y = Number(bits[1]);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
            points.push([Math.min(Math.max(0,x),500), Math.min(Math.max(0,y),250)]);
        }
        if (points.length < 3 || points.length > FACE_MAX.points) return null;
        shapes.push({colorName, points});
        if (shapes.length > FACE_MAX.shapes) return null;
    }
    return shapes.length ? {kind: 'shapes', shapes} : null;
}

function parseFace(spec) {
    if (typeof spec !== 'string') return null;
    const s = spec.trim();
    if (!s || s.length > FACE_MAX.spec) return null;
    return parsePreset(s) || parsePolygons(s) || null;
}

function loadFace(search=location.search) {
    let spec = '';
    try {
        spec = new URLSearchParams(search).get('face') || '';
    } catch (_) {}
    return parseFace(spec) || {kind: 'preset', modes: [0, 0, 0], colorName: FACE_COLORS[Math.floor(Math.random() * FACE_COLORS.length)]};
}

function faceToSpec(face) {
    if (!face || typeof face !== 'object') return '';
    if (face.kind === 'preset') {
        return `${face.modes[0]}${face.modes[1]}${face.modes[2]}-${face.colorName}`;
    } else if (face.kind === 'shapes') {
        return face.shapes.map(s => `${s.colorName}:${s.points.map(p => p.join(',')).join(' ')}`).join(';');
    }
}

function drawFace(c, scale = 1, face = window.customFace) {
    c.save();
    c.scale(scale, scale);
    c.clearRect(0, 0, 500, 250);

    // start of idea -- i think ill do a point system.
    if (face && face.kind === 'shapes') {
        color = hex[face.shapes[0].colorName];
        for (const s of face.shapes) {
            c.fillStyle = hex[s.colorName];
            c.strokeStyle = hex[s.colorName];
            c.beginPath();
            s.points.forEach(([x,y], i) => i ? c.lineTo(x,y) : c.moveTo(x,y));
            c.closePath();
            c.fill();
        }
        c.restore();
        return;
    }

    const modes = face && face.kind === 'preset' ? face.modes : [0, 0, 0];
    color = face && face.colorName ? hex[face.colorName] : hex[FACE_COLORS[Math.floor(Math.random() * FACE_COLORS.length)]];

    color = hex[window.colors[Math.floor(Math.random() * window.colors.length)]];
    c.save();
    c.scale(scale, scale);
    c.fillStyle = color;
    c.strokeStyle = color;
    let mode;
    c.clearRect(0, 0, 500, 250);
    // left eye
    mode = Math.floor(Math.random() * 3);
    if (mode === 0) {
        c.beginPath();
        c.moveTo(50, 50);
        c.lineTo(150, 150);
        c.lineTo(30, 150);
        c.fill();
    } else if (mode === 1) {
        c.beginPath();
        c.arc(100, 100, 50, 0, Math.PI * 2);
        c.fill();
    } else if (mode === 2) {
        c.beginPath();
        c.moveTo(50, 150);
        c.lineTo(150, 150);
        c.lineTo(100, 50);
        c.fill();
    }
    // right eye
    mode = Math.floor(Math.random() * 3);
    if (mode === 0) {
        c.beginPath();
        c.moveTo(450, 50);
        c.lineTo(470, 150);
        c.lineTo(350, 150);
        c.fill();
    } else if (mode === 1) {
        c.beginPath();
        c.arc(400, 100, 50, 0, Math.PI * 2);
        c.fill();
    } else if (mode === 2) {
        c.beginPath();
        c.moveTo(450, 150);
        c.lineTo(350, 150);
        c.lineTo(400, 50);
        c.fill();
    }
    // mouth
    mode = Math.floor(Math.random() * 3);
    if (mode === 0) {
        c.beginPath();
        c.moveTo(50, 200);
        c.lineTo(50, 250);
        c.lineTo(450, 250);
        c.lineTo(450, 200);
    } else if (mode === 1) {
        c.beginPath();
        c.arc(250, 225, 25, 0, Math.PI);
        c.fill();
    } else if (mode === 2) {
        c.beginPath();
        c.moveTo(50, 200);
        c.lineTo(450, 190);
        c.lineTo(450, 250);
        c.lineTo(50, 250);
        c.stroke();
    }
    c.fill();

}

window.TIMED = window.TIMED || { seconds: 10 };

const clockEl = document.getElementById('clock');

let mode = 'free'; // free, timed
let remaining = 0; //ms
let endsAt = 0; // performance.now() timestamp of zero
let pausedAt = 0;
let running = false;
let ticker = 0;

function setMode(m) {
    mode = (m === 'timed') ? 'timed' : 'free';
    clockEl.classList.toggle('hidden', mode !== 'timed');
    const submit = document.getElementById('submit-btn');
    if (submit) submit.disabled = (mode === 'timed');
}

function paintClock() {
    if (mode !== 'timed') return;
    clockEl.textContent = remaining < 5000
        ? (remaining / 1000).toFixed(1) + 's'
        : Math.ceil(remaining / 1000) + 's';
    const lowAt = Math.min(3000, window.TIMED.seconds * 1000 * 0.35);
    clockEl.classList.toggle('low', remaining > 0 && remaining <= lowAt);
}

function resetClock() {
    pauseClock();
    remaining = window.TIMED.seconds * 1000;
    clockEl.classList.remove('low');
    paintClock();
}

function startClock() {
    if (mode !== 'timed' || running || remaining <= 0) return;
    running = true;
    pausedAt = 0;
    endsAt = performance.now() + remaining;
    ticker = setInterval(tick, 100);
    tick();
}

function pauseClock() {
    running = false;
    pausedAt = 0;
    if (ticker) clearInterval(ticker);
    ticker = 0;
}

function tick() {
    if (!running) return;
    if (document.hidden) {
        if (!pausedAt) pausedAt = performance.now();
        return;
    }
    if (pausedAt) {
        endsAt += performance.now() - pausedAt;
        pausedAt = 0;
    }

    remaining = Math.max(0, endsAt - performance.now());

    if (remaining <= 0) {
        pauseClock();
        paintClock();
        clockEl.classList.add('low');
        grade(window.difficulty);
        return;
    }
    paintClock();
}

function playFree() {
    setMode('free');
    play();
}

function playTimed() {
    setMode('timed');
    play();
}

const width  = outside.width;
const height = outside.height;

let sized = false;
let last = null;

function resetCanvas() {
    ctx_o.fillStyle = "#fab387";
    ctx_o.fillRect(0, 0, width, height);
}

function startRound() {
    clearDiff();
    resetClock();
    drawFace(tc);
    resetCanvas();
    document.getElementById('grade').innerText = `grade: ? % (best: ${window.best} %)`;
}

function fit() {
    const r = outside.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bw = Math.max(1, Math.round(r.width  * dpr));
    const bh = Math.max(1, Math.round(r.height * dpr));
    if (outside.width === bw && outside.height === bh) { sized = true; return; }

    let keep = null;
    if (sized) {
        keep = document.createElement('canvas');
        keep.width = outside.width; keep.height = outside.height;
        keep.getContext('2d').drawImage(outside, 0, 0);
    }

    for (const c of [outside, inside, diffC]) { c.width = bw; c.height = bh; }
    const sxs = bw / width, sys = bh / height;
    ctx_o.setTransform(sxs, 0, 0, sys, 0, 0);
    ctx_i.setTransform(sxs, 0, 0, sys, 0, 0);
    ctx_d.setTransform(sxs, 0, 0, sys, 0, 0);

    ctx_o.fillStyle = "#fab387";
    ctx_o.fillRect(0, 0, width, height);


    if (keep) reOpenHoles(keep, bw, bh);
    sized = true;
}

function reOpenHoles(keep, bw, bh) {
    const m = document.createElement('canvas');
    m.width = bw; m.height = bh;
    const mc = m.getContext('2d');
    mc.fillStyle = '#000';
    mc.fillRect(0, 0, bw, bh);
    mc.globalCompositeOperation = 'destination-out';
    mc.drawImage(keep, 0, 0, bw, bh);

    ctx_o.save();
    ctx_o.setTransform(1, 0, 0, 1, 0, 0);
    ctx_o.globalCompositeOperation = 'destination-out';
    ctx_o.drawImage(m, 0, 0);
    ctx_o.restore();
}

addEventListener('resize', fit);

const toDesign = (e) => {
  const r = outside.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * width  / r.width,
    y: (e.clientY - r.top ) * height / r.height
  };
};



// maroon - #eba0ac
// peach - #fab387
// yellow - #f9e2af

ctx_o.fillStyle = "#fab387"
ctx_o.fillRect(0,0,width,height);
ctx_i.fillRect(0,0,width,height);

const row = document.querySelector('.btns');
const buttons = [...row.querySelectorAll('button')];

row.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (!btn.dataset.color) return;
    window.fireColor = btn.dataset.color;
    buttons.forEach(b => b.classList.toggle('active', b === btn));
});

const DIFF_KEY = 'pumpkin.difficulty';
const diffRow  = document.querySelector('.diffs');
const diffBtns = [...diffRow.querySelectorAll('button[data-diff]')];

function setDifficulty(name) {
    if (!DIFFICULTY[name]) name = 'easy';
    window.difficulty = name;

    diffBtns.forEach(b => {
        const on = b.dataset.diff === name;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    try { localStorage.setItem(DIFF_KEY, name); } catch (_) {}

    if (typeof newRound === 'function') newRound();
    if (typeof refreshBest === 'function') refreshBest();
}

diffRow.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-diff]');
    if (b) setDifficulty(b.dataset.diff);
});

let saved = 'easy';
try { saved = localStorage.getItem(DIFF_KEY) || 'easy'; } catch (_) {}
setDifficulty(saved);

buttons.find(b => b.dataset.color === window.fireColor)?.classList.add('active');

function play() {
    document.getElementById('main-menu').classList.add('hidden'); 
    document.getElementById('game-container').classList.remove('hidden');
    fit();
    startRound();
}

function grade(difficulty=window.difficulty) {
    pauseClock();
    clockEl.classList.add('done');
    const { tolerance, fullMarks } = DIFFICULTY[difficulty] ?? DIFFICULTY.easy;
    const carved = getMask(outside, a => a < 128);
    const target = getMask(document.getElementById('target'), a => a > 128);
    const s = score(carved, target, tolerance);
    showDiff(carved, target, s.carvedWide, s.targetWide);

    const {coverage, precision, raw} = {coverage: s.coverage, precision: s.precision, raw: s.raw};
    const a = hex[window.fireColor] === color ? 10 : 0;
    let pct = (Math.round(((Math.min(1, raw / fullMarks) * 100 + a) / 11) * 10));

    console.log({ coverage, precision, raw, a });
    let msg = Object.keys(msgs).filter(key => pct >= Number(key)).reduce((acc, key) => msgs[key], "");
    msg = msg[Math.floor(Math.random() * msg.length)];
    newBest(pct);
    document.getElementById('grade').innerText = `grade: ${pct} % - ${msg} (best: ${window.best} %)`;
}

function clearDiff() { ctx_d.clearRect(0, 0, width, height); }

outside.addEventListener("pointerdown", (e) => {
    startClock();
    clearDiff();
    audio.play();
    const r = outside.getBoundingClientRect();
    last = toDesign(e);
    outside.setPointerCapture(e.pointerId);
    carve(last, last);
});

outside.addEventListener("pointermove", (e) => {
    if (!last) return;
    const r = outside.getBoundingClientRect();
    const p = toDesign(e);
    carve(last, p);
    last = p;
});

outside.addEventListener("pointerup", () => { last = null; });

function carve(a, b) {
    ctx_o.globalCompositeOperation = "destination-out";
    ctx_o.lineCap = "round";
    ctx_o.lineJoin = "round";
    ctx_o.lineWidth = 20;
    ctx_o.beginPath();
    ctx_o.moveTo(a.x, a.y);
    ctx_o.lineTo(b.x, b.y);
    ctx_o.stroke();
    ctx_o.globalCompositeOperation = "source-over";
}

function calcColor(color, p){
    // red, green, blue, purple, white, rainbow
    if (color === "red") {
        p.r = '255';
        p.g = Math.round(Math.random() * -90 + 100);
        p.b = Math.round(Math.random() * -20 + 10);
    } else if (color === "green") {
        p.r = Math.round(Math.random() * -90 + 100);
        p.g = '255';
        p.b = Math.round(Math.random() * -20 + 10);
    } else if (color === "blue") {
        p.r = Math.round(Math.random() * -20 + 10);
        p.g = Math.round(Math.random() * -90 + 100);
        p.b = '255';
    } else if (color === "purple") {
        p.r = Math.round(Math.random() * -90 + 100);
        p.g = Math.round(Math.random() * -20 + 10);
        p.b = '255';
    } else if (color === "teal") {
        p.r = Math.round(Math.random() * -20 + 10);
        p.g = '255';
        p.b = Math.round(Math.random() * -90 + 110);
    } else if (color === "white") {
        const gray = Math.round(Math.random() * -90 + 110);
        p.r = gray;
        p.g = gray;
        p.b = gray;
    } else if (color === "rainbow") {
        p.r = Math.round(Math.random() * -90 + 110);
        p.g = Math.round(Math.random() * -90 + 110);
        p.b = Math.round(Math.random() * -90 + 110);
    } else {
        console.warn("not valid color.")
    }
}

window.onload = function () {
    window.fireColor = "red"
    // bg fire
    let particles = [];
    let SmokeParticles = [];
    let particle_count = 450;
    let flameWidth = 350;

    function particleFlame () {
        this.speed = {
            x: -2.5 + Math.random() * 5,
            y: -15 + Math.random() * 10
        }
        let locmin = (width/2)-(flameWidth/2);
        let locmax = (width/2)+(flameWidth/2);
        this.location = {
            x: Math.random() * (locmax - locmin) + locmin,
            y: height
        }
        this.radius = Math.random()*(-50) + 50;
        this.life = 20 + Math.random() * 10;
        this.remaining_life = this.life;
        calcColor(window.fireColor,this);
    }

    for (let i  = 0; i < particle_count; i++) {
        particles.push(new particleFlame());
    }

    function drawFlames () {
        ctx_i.globalCompositeOperation = "source-over";
        ctx_i.fillStyle = "black";
        ctx_i.fillRect(0,0,width,height);
        ctx_i.globalCompositeOperation = "lighter";
        
        for (let i = 0; i < particles.length; i++) {
            let p = particles[i];
            ctx_i.beginPath();
            p.opacity = Math.round(p.remaining_life/p.life*100)/100;
            let gradient = ctx_i.createRadialGradient(p.location.x, p.location.y, 0, p.location.x, p.location.y, p.radius);
            gradient.addColorStop(0, `rgba(${p.r}, ${p.g}, ${p.b}, ${p.opacity})`)
            gradient.addColorStop(0.5, `rgba(${p.r}, ${p.g}, ${p.b}, ${p.opacity})`)
            gradient.addColorStop(1, `rgba(${p.r}, ${p.g}, ${p.b}, 0)`)
            ctx_i.fillStyle = gradient;
            ctx_i.arc(p.location.x, p.location.y, p.radius, 0, Math.PI * 2, false);
            ctx_i.fill();

            p.remaining_life--;
            p.radius -= 2;
            p.location.x += p.speed.x;
            p.location.y += p.speed.y;

            if (p.remaining_life < 0 || p.radius < 0) {
                particles[i] = new particleFlame();
            }
        }
    }
    setInterval(drawFlames, 33);
}

// start of editor part.
window.customFace = loadFace();

const EW = 500;
const EH = 250;
const eCanvas = document.getElementById('editor');
const ectx = eCanvas.getContext('2d');

let eShapes = [];
let eCurrent = [];
let eColor = 'white';
let edMirror = false; // mirror mode to make faces easier.

function eArea(pts) {
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % pts.length];
        a += (x1 * y2 - x2 * y1);
    }
    return Math.abs(a) / 2;
}

function eFit() {
    const r = eCanvas.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    eCanvas.width = Math.round(r.width * dpr);
    eCanvas.height = Math.round(r.height * dpr);
    ectx.setTransform(eCanvas.width / EW, 0, 0, eCanvas.height / EH, 0, 0);
    eRender();
}

function eRender() {
    ectx.clearRect(0, 0, EW, EH);
    ectx.fillStyle = '#fab387';
    ectx.fillRect(0, 0, EW, EH);
    ectx.strokeStyle = 'rgba(30,30,46,.1)';
    ectx.lineWidth = 1;
    for (let x = 50; x < EW; x += 50) {
        ectx.beginPath();
        ectx.moveTo(x, 0);
        ectx.lineTo(x, EH);
        ectx.stroke();
    }
    for (let y = 50; y < EH; y += 50) {
        ectx.beginPath();
        ectx.moveTo(0, y);
        ectx.lineTo(EW, y);
        ectx.stroke();
    }

    ectx.strokeStyle = 'rgba(30,30,46,.35)';
    ectx.setLineDash([8, 8]);
    ectx.beginPath();
    ectx.moveTo(EW / 2, 0);
    ectx.lineTo(EW / 2, EH);
    ectx.stroke();
    ectx.setLineDash([]);

    for (const sh of eShapes) {
        ectx.fillStyle = hex[sh.colorName] || "#fff";
        ectx.beginPath();
        sh.points.forEach(([x, y], i) => i ? ectx.lineTo(x, y) : ectx.moveTo(x, y));
        ectx.closePath();
        ectx.fill();
    }
    
    if (eCurrent.length) {
        ectx.strokeStyle = "#1e1e2e";
        ectx.lineWidth = 2;
        ectx.beginPath();
        eCurrent.forEach(([x, y], i) => i ? ectx.lineTo(x, y) : ectx.moveTo(x, y));
        ectx.stroke();
        ectx.fillStyle = "#1e1e2e";
        for (const [x, y] of eCurrent) {
            ectx.beginPath();
            ectx.arc(x, y, 5, 0, Math.PI * 2);
            ectx.fill();
        }
    }
    eStats();
}

function eStats() {
    const commited = eShapes.reduce((acc, sh) => acc + eArea(sh.points), 0);
    const pending = eCurrent.length >= 3 ? eArea(eCurrent) : 0;
    const pct = (commited + pending) /  (EW * EH) * 100;
    let note = `${eShapes.length} shapes - ${pct.toFixed(1)}% of the pumpkin`;
    if (pct > 0 && pct < 8.8) note += 'small, hard'
    if (pct > 30.2) note += 'large, easy';
    document.getElementById('ed-status').textContent = note;
}

eCanvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const p = ePoint(e);
    if (eCurrent.length >= 3) {
        const [x0, y0] = eCurrent[0];
        if (Math.hypot(p[0] - x0, p[1] - y0) < 12) {eCloseShape(); return;}
    }
    eCurrent.push(p);
    eRender();
})

function eCloseShape() {
    if (eCurrent.length < 3) {eStats(); return; }
    eShapes.push({colorName: eColor, points: eCurrent.slice() });

    if (edMirror) {
        const own = eCurrent.map(([x, y]) => x + ',' + y);
        const flipped = eCurrent.map(([x, y]) => (EW - x) + ',' + y)
        // don't coopy symetric shapies.
        if (!flipped.every(k => own.includes(k))) {
            eShapes.push({colorName: eColor, points:eCurrent.map(([x, y]) => [EW - x, y])})
        }
    }
    eCurrent = [];
    eRender();
}

// ed for the ui buttons. 

function edUndo() {
    if (eCurrent.length) eCurrent.pop();
    else eShapes.pop();
    eRender();
}

function edClear() {
    eShapes = [];
    eCurrent = []
    eRender();
}

function edToggleMirror() {
    edMirror = !edMirror;
    document.getElementById('ed-mirror').textContent = 'mirror: ' + (edMirror ? 'on' : 'off');
}

function edSpec() {
    const shapes = eShapes.slice();
    if (eCurrent.length >= 3) shapes.push({colorName: eColor, points: eCurrent});
    return faceToSpec({kind: 'shapes', shapes})
}

function edPlay() {
    const face = parseFace(edSpec());
    if (!face) {
        document.getElementById('ed-status').textContent = 'needs to be a closed shape of 3+ points'
        return;
    }
    window.customFace = face;
    play();
    if (typeof startRound === 'function') startRound();
}

function edCopyLink() {
    const base = location.href.split(/[?#]/)[0];
    document.getElementById('ed-status').textContent = base + '?face=' + encodeURIComponent(edSpec());
}


function showPage(id) {
    for (const p of PAGES) {
        const el = document.getElementById(p);
        if (el) el.classList.toggle('hidden', p !== id)
    }
}

function openEditor() {
    showPage('editor-container');
    if (window.customFace && window.customFace.kind === 'shapes' && !eShapes.length) {
        eShapes = window.customFace.shapes.map(s => ({
            colorName: s.colorName,
            points: s.points.map(p => [p[0], p[1]])
        }))
    }
    eCurrent = [];
    eFit();
    eRender();
}

function openSettings() {
    showPage('settings-container');
    renderSettings();
}

function applyTheme(name) {
    document.body.classList.toggle('light', name === 'light');
    try { localStorage.setItem('pumpkin.theme', name); } catch (_) {}
}

function toggleTheme() {
    applyTheme(document.body.classList.contains('light') ? 'dark' : 'light');
    renderSettings();
}

applyTheme(localStorage.getItem('pumpkin.theme') || 'dark');

function renderSettings() {
    document.getElementById('set-theme').textContent = 'theme: ' + (document.body.classList.contains('light') ? 'light' : 'dark');
    document.getElementById('set-mute').textContent = 'music: ' + (audio.muted ? 'off' : 'on');
    document.getElementById('set-vol').textContent = Math.round(audio.volume * 100) + '%';
}

function bumpVolume(d) {
    audio.volume = Math.max(0, Math.min(1, Math.round((audio.volume + d) * 10) / 10));
    try { localStorage.setItem('pumpkin.volume', String(audio.volume)); } catch (_) {}
    renderSettings();
}

function toggleMute() {
    audio.muted = ! audio.muted;
    try { localStorage.setItem('pumpkin.muted', audio.muted ? '1' : '0');  } catch (_) {}
    renderSettings();
}

document.querySelectorAll('[data-ed]').forEach(b => {
    b.addEventListener('click', () => {
        eColor = b.dataset.ed;
        document.querySelectorAll('[data-ed]').forEach(o => o.classList.toggle('on', o === b));
    })
})

function ePoint(e) {
   const r = eCanvas.getBoundingClientRect();
   return [
       Math.max(0, Math.min(EW, Math.round((e.clientX - r.left) * EW / r.width))),
       Math.max(0, Math.min(EH, Math.round((e.clientY - r.top ) * EH / r.height))),
   ];
}

window.addEventListener('resize', eFit);
setTimeout(eFit, 0);


fit();

const faceSpec = new URLSearchParams(location.search).get('face');

if (faceSpec && parseFace(faceSpec)) playFree()