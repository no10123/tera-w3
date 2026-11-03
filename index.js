const outside = document.getElementById("outside"); // pumpkin part
const inside  = document.getElementById("inside");  // fire
const ctx_o = outside.getContext("2d");
const ctx_i = inside.getContext("2d");

const width  = outside.width;
const height = outside.height;

// maroon - #eba0ac
// peach - #fab387
// yellow - #f9e2af

ctx_o.fillStyle = "#fab387"
ctx_o.fillRect(0,0,width,height);
ctx_i.fillRect(0,0,width,height);

outside.addEventListener("pointerdown", (e) => {
    const r = outside.getBoundingClientRect();
    last = { x: e.clientX - r.left, y: e.clientY - r.top };
    outside.setPointerCapture(e.pointerId);
    carve(last, last);
});

outside.addEventListener("pointermove", (e) => {
    if (!last) return;
    const r = outside.getBoundingClientRect();
    const p = { x: e.clientX - r.left, y: e.clientY - r.top };
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