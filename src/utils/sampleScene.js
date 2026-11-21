// A small procedural picture used for gallery previews before the user has loaded an image.

export function createSampleScene(width = 320, height = 220) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const w = width;
  const h = height;

  canvas.width = w;
  canvas.height = h;

  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.7);
  sky.addColorStop(0, '#2b6cb0');
  sky.addColorStop(0.6, '#f6ad55');
  sky.addColorStop(1, '#fbd38d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#fff7d6';
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.3, h * 0.11, 0, Math.PI * 2);
  ctx.fill();

  const ridge = (base, amp, color, seed) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      const t = x / w;
      const y = base - amp * (Math.sin(t * 7 + seed) * 0.5 + Math.sin(t * 17 + seed * 2.3) * 0.25 + 0.5);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.fill();
  };

  ridge(h * 0.62, h * 0.28, '#5a4e7c', 1.2);
  ridge(h * 0.7, h * 0.2, '#3d6b5a', 4.1);
  ridge(h * 0.86, h * 0.12, '#2f4f3a', 2.6);

  ctx.fillStyle = '#c0392b';
  ctx.fillRect(w * 0.16, h * 0.6, w * 0.16, h * 0.17);
  ctx.fillStyle = '#7b241c';
  ctx.beginPath();
  ctx.moveTo(w * 0.14, h * 0.6);
  ctx.lineTo(w * 0.24, h * 0.47);
  ctx.lineTo(w * 0.34, h * 0.6);
  ctx.fill();
  ctx.fillStyle = '#fdf2d0';
  ctx.fillRect(w * 0.2, h * 0.65, w * 0.035, h * 0.05);
  ctx.fillRect(w * 0.26, h * 0.67, w * 0.03, h * 0.1);

  ctx.fillStyle = '#5b3a1e';
  ctx.fillRect(w * 0.52, h * 0.58, w * 0.02, h * 0.2);
  ctx.fillStyle = '#2e8b57';
  ctx.beginPath();
  ctx.arc(w * 0.53, h * 0.52, h * 0.11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3cb371';
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.49, h * 0.06, 0, Math.PI * 2);
  ctx.fill();

  const ground = ctx.createLinearGradient(0, h * 0.78, 0, h);
  ground.addColorStop(0, '#6aa84f');
  ground.addColorStop(1, '#38761d');
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.78, w, h * 0.22);
  ctx.strokeStyle = '#f4e3b2';
  ctx.lineWidth = h * 0.035;
  ctx.beginPath();
  ctx.moveTo(w * 0.27, h * 0.78);
  ctx.quadraticCurveTo(w * 0.4, h * 0.9, w * 0.72, h);
  ctx.stroke();

  return canvas;
}
