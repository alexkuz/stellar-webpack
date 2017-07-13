import * as THREE from 'three';

const rgba = (c, a) => `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;

const roundRect = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y);
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r);
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r);
  ctx.lineTo(x, y+r);
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();   
}

const nearestSize = size => {
  let nearest = 2;
  while(size > nearest) { nearest *= 2; }
  return nearest;
}

export default function createTextTexture(message, parameters={}) {
  const {
    fontface='Arial',
    fontsize=18,
    borderThickness=2,
    borderColor={ r:20, g:40, b:40 },
    backgroundColor={ r:255, g:255, b:255 },
    textColor={ r:20, g:20, b:20, a:1.0 },
    borderRadius=9999,
    opacity=1
  } = parameters;
  
  let canvas = document.createElement('canvas');
  let context = canvas.getContext('2d');
  context.font = `${fontsize}px ${fontface}`;

  // get size data (height depends only on font size)
  const metrics = context.measureText(message);
  const textWidth = metrics.width;

  const realBorderRadius = Math.min(borderRadius, (fontsize * 1.4 + borderThickness) / 2);
  const width = textWidth + borderThickness + realBorderRadius * 2;
  const height = fontsize * 1.4 + borderThickness;

  canvas = document.createElement('canvas');
  canvas.width = nearestSize(width);
  canvas.height = nearestSize(height);
  canvas.style = `width: ${canvas.width}px; height: ${canvas.height}px;`;
  context = canvas.getContext('2d');
  context.font = `${fontsize}px ${fontface}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  context.fillStyle = rgba(backgroundColor, opacity);
  context.strokeStyle = rgba(borderColor, opacity);
  context.lineWidth = borderThickness;

  roundRect(
    context,
    borderThickness / 2 + (canvas.width - width) / 2,
    borderThickness / 2 + (canvas.height - height) / 2,
    width,
    height,
    realBorderRadius
  );
  // 1.4 is extra height factor for text below baseline: g,j,p,q.
  
  // text color
  context.fillStyle = rgba(textColor, 1);
  context.fillText(message, canvas.width / 2, canvas.height / 2);
  
  // canvas contents will be used for a texture
  const texture = new THREE.Texture(canvas);
  texture.needsUpdate = true;

  return { width: canvas.width, height: canvas.height, texture };
}