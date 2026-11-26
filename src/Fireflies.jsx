import React, {useEffect, useRef} from 'react';

// Slow, sparse glow points behind the tag view. Colour follows the --spark token,
// so it switches with the theme; reduced motion draws one still frame.
export function Fireflies({on}) {
  const ref = useRef(null);
  useEffect(() => {
    if (!on) return;
    const canvas = ref.current, g = canvas.getContext('2d'), dpr = Math.min(2, window.devicePixelRatio || 1);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0, color = '#e3f58f', last = performance.now();
    const readColor = () => { color = getComputedStyle(document.documentElement).getPropertyValue('--spark').trim() || color; };
    const points = Array.from({length:18}, () => ({x:Math.random(), y:Math.random(), r:.8 + Math.random() * 1.5, vx:(Math.random() - .5) * .0001, vy:-.00003 - Math.random() * .00008, phase:Math.random() * 6.28, speed:.0006 + Math.random() * .0009}));
    function draw(dt) {
      g.clearRect(0, 0, w, h);
      for (const p of points) {
        if (dt) {
          p.x += p.vx * dt; p.y += p.vy * dt; p.phase += p.speed * dt;
          if (p.y < -.05) { p.y = 1.05; p.x = Math.random(); }
          if (p.x < -.05) p.x = 1.05;
          if (p.x > 1.05) p.x = -.05;
        }
        const alpha = reduce ? .45 : .15 + .85 * Math.max(0, Math.sin(p.phase)), x = p.x * w, y = p.y * h, radius = p.r * 8;
        const glow = g.createRadialGradient(x, y, 0, x, y, radius);
        glow.addColorStop(0, color); glow.addColorStop(1, 'transparent');
        g.globalAlpha = alpha * .42; g.fillStyle = glow; g.beginPath(); g.arc(x, y, radius, 0, 6.283); g.fill();
        g.globalAlpha = alpha * .9; g.fillStyle = color; g.beginPath(); g.arc(x, y, p.r * .75, 0, 6.283); g.fill();
      }
      g.globalAlpha = 1;
    }
    function size() {
      const r = canvas.getBoundingClientRect();
      w = r.width; h = r.height;
      canvas.width = Math.max(1, w * dpr); canvas.height = Math.max(1, h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) draw(0);
    }
    function frame(t) { const dt = Math.min(64, t - last); last = t; draw(dt); raf = requestAnimationFrame(frame); }
    readColor(); size();
    const resize = new ResizeObserver(size); resize.observe(canvas);
    const theme = new MutationObserver(readColor); theme.observe(document.documentElement, {attributes:true, attributeFilter:['data-theme']});
    const scheme = matchMedia('(prefers-color-scheme: light)'); scheme.addEventListener?.('change', readColor);
    if (!reduce) raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); resize.disconnect(); theme.disconnect(); scheme.removeEventListener?.('change', readColor); };
  }, [on]);
  return on ? <canvas className="fireflies" ref={ref} aria-hidden="true"/> : null;
}
