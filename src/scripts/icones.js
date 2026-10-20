// Icones de traç (24×24, com les del web) per a la línia del títol de les imatges netes: mapa de Catalunya, radar i
// rànquing de l'estudi. Es dibuixen amb el color de la variable, dins d'un cercle suau del mateix color.
export const ICONS = {
  temp: ['M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z'],
  rain: ['M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242', 'M16 14v6', 'M8 14v6', 'M12 16v6'],
  wind: ['M12.8 19.6A2 2 0 1 0 14 16H2', 'M17.5 8a2.5 2.5 0 1 1 2 4H2', 'M9.8 4.4A2 2 0 1 1 11 8H2'],
  hum: ['M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z', 'M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97'],
  snow: ['M2 12h20M12 2v20M20 16l-4-4 4-4M4 8l4 4-4 4M16 4l-4 4-4-4M8 20l4-4 4 4'],
  // Gràfic de barres (imatge dels models de l'estudi)
  models: ['M3 3v18h18', 'M7 16v2', 'M12 11v7', 'M17 6v12'],
  radar: ['M19.07 4.93A10 10 0 0 0 6.99 3.34', 'M4 6h.01', 'M2.29 9.62A10 10 0 1 0 21.31 8.35', 'M16.24 7.76A6 6 0 1 0 8.23 16.67', 'M12 18h.01', 'M17.99 11.66A6 6 0 0 1 15.77 16.67', 'M13.41 10.59l5.66-5.66', 'M14 12a2 2 0 1 1-4 0a2 2 0 1 1 4 0'],
};

export function drawIcon(ctx, name, x, y, size, color) {
  const paths = ICONS[name];
  if (!paths) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const d of paths) ctx.stroke(new Path2D(d));
  ctx.restore();
}

// Icona dins d'un cercle suau del mateix color (13 % d'opacitat), centrada a (cx, cy). size: la mida de la icona.
export function iconBadge(ctx, name, cx, cy, size, color) {
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  drawIcon(ctx, name, cx - size / 2, cy - size / 2, size, color);
}
