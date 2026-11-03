const outside = document.getElementById("outside"); //
const inside  = document.getElementById("inside");
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
