uniform float size;
varying vec2 vUv;

uniform vec3 fogColor;
uniform float fogDensity;

varying lowp vec3 vColor;
 
void main( void ) {
  float distX = (gl_PointCoord.x - 0.5);
  float distY = (gl_PointCoord.y - 0.5);
  float starColor = 0.08 / (distX * distX + distY * distY);
  if (starColor > 1.2) {
    gl_FragColor = vec4(1.2 * vColor, 1.0);
  } else if (starColor > 1.0) {
    gl_FragColor = vec4(starColor * vColor, 1.0);
  } else if (starColor > 0.3) {
    gl_FragColor = vec4(vColor, (starColor - 0.4) * 1.5);
  } else {
    gl_FragColor = vec4(vColor, 0.0);
  }

  #ifdef USE_FOG
      #ifdef USE_LOGDEPTHBUF_EXT
          float depth = gl_FragDepthEXT / gl_FragCoord.w;
      #else
          float depth = gl_FragCoord.z / gl_FragCoord.w;
      #endif
      float fogFactor = exp2(- 0.5 / fogDensity / (depth + 0.01));
      gl_FragColor.rgb = mix(min(gl_FragColor.rgb, 1.0), fogColor, fogFactor );
  #endif
}