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
const newBest = (score) => { window.best = Math.max(window.best, score);}
window.colors = ["red", "green", "blue", "purple", "white"];
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

const width  = outside.width;
const height = outside.height;

let sized = false;
let last = null;

function resetCanvas() {
    ctx_o.fillStyle = "#fab387";
    ctx_o.fillRect(0, 0, width, height);
}

function fit() {
    const r = outside.getBoundingClientRect();
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


function drawFace(c, scale = 1) {
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

function grade(difficulty=window.difficulty) {
    const { tolerance, fullMarks } = DIFFICULTY[difficulty] ?? DIFFICULTY.easy;
    const carved = getMask(outside, a => a < 128);
    const target = getMask(document.getElementById('target'), a => a > 128);
    const s = score(carved, target, tolerance);
    showDiff(carved, target, s.carvedWide, s.targetWide);

    const {coverage, precision, raw} = {coverage: s.coverage, precision: s.precision, raw: s.raw};
    const a = hex[window.fireColor] === color ? 10 : 0;
    const pct = (Math.round(((Math.min(1, raw / fullMarks) * 100 + a) / 11) * 10));

    console.log({ coverage, precision, raw, a });
    let msg = Object.keys(msgs).filter(key => pct >= Number(key)).reduce((acc, key) => msgs[key], "");
    msg = msg[Math.floor(Math.random() * msg.length)];
    document.getElementById('grade').innerText = `grade: ${pct} % - ${msg} (best: ${window.best} %)`;
    newBest(pct);
}

function clearDiff() { ctx_d.clearRect(0, 0, width, height); }

outside.addEventListener("pointerdown", (e) => {
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

fit();