varying vec2 vUv;
uniform float size;

attribute vec3 color;
varying lowp vec3 vColor;

void main( void ) {
  vUv = uv;
  vColor = color;
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  gl_PointSize = 1000.0 * size / length(mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}