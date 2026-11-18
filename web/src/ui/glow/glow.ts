import './glow.css';

/**
 * Animated background (fragment shader, plain WebGL: no three.js, nothing fetched from a CDN).
 * Parameters are those of the reference page `green-glow.html`.
 */
const COLORS = ['#0d750d', '#042e04', '#066020'];
const OPTS = {
  rotation: 90, speed: 0.23, scale: 1.2, frequency: 1, warpStrength: 1, mouseInfluence: 1,
  parallax: 0.45, noise: 0.33, intensity: 0.8, bandWidth: 6,
};

const VERT = `attribute vec2 position; varying vec2 vUv;
void main(){ vUv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }`;

const FRAG = `precision highp float;
#define MAX_COLORS 8
uniform vec2 uCanvas; uniform float uTime; uniform float uSpeed; uniform vec2 uRot;
uniform int uColorCount; uniform vec3 uColors[MAX_COLORS]; uniform float uScale;
uniform float uFrequency; uniform float uWarpStrength; uniform vec2 uPointer;
uniform float uMouseInfluence; uniform float uParallax; uniform float uNoise;
uniform float uIntensity; uniform float uBandWidth;
varying vec2 vUv;
void main(){
  float t = uTime * uSpeed;
  vec2 p = vUv * 2.0 - 1.0;
  p += uPointer * uParallax * 0.1;
  vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
  vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
  q /= max(uScale, 0.0001);
  q /= 0.5 + 0.2 * dot(q, q);
  q += 0.2 * cos(t) - 7.56;
  q += (uPointer - rp) * uMouseInfluence * 0.2;
  vec2 s = q; vec3 sumCol = vec3(0.0); float cover = 0.0;
  for (int i = 0; i < MAX_COLORS; i++) {
    if (i >= uColorCount) break;
    s -= 0.01;
    vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
    float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);
    float kBelow = clamp(uWarpStrength, 0.0, 1.0);
    float kMix = pow(kBelow, 0.3);
    float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
    vec2 warped = s + (r - s) * kBelow * gain;
    float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);
    float m = mix(m0, m1, kMix);
    float w = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));
    sumCol += uColors[i] * w; cover = max(cover, w);
  }
  vec3 col = clamp(sumCol, 0.0, 1.0) * uIntensity;
  if (uNoise > 0.0001) {
    float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);
    col = clamp(col + (n - 0.5) * uNoise, 0.0, 1.0);
  }
  gl_FragColor = vec4(col * cover, cover);
}`;

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
  return shader;
}

/** Mounts the background. Returns a cleanup function; on failure the CSS gradient stays as the fallback. */
export function startGlow(): () => void {
  const host = document.createElement('div');
  host.id = 'glow';
  host.setAttribute('aria-hidden', 'true');
  document.body.prepend(host);
  const cleanup = () => host.remove();

  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: true, premultipliedAlpha: true });
  if (!gl) return cleanup;

  try {
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const colors = new Float32Array(24);
    COLORS.forEach((c, i) => colors.set(hexToRgb(c), i * 3));
    gl.uniform3fv(u('uColors'), colors);
    gl.uniform1i(u('uColorCount'), COLORS.length);
    gl.uniform1f(u('uSpeed'), OPTS.speed);
    gl.uniform1f(u('uScale'), OPTS.scale);
    gl.uniform1f(u('uFrequency'), OPTS.frequency);
    gl.uniform1f(u('uWarpStrength'), OPTS.warpStrength);
    gl.uniform1f(u('uMouseInfluence'), OPTS.mouseInfluence);
    gl.uniform1f(u('uParallax'), OPTS.parallax);
    gl.uniform1f(u('uNoise'), OPTS.noise);
    gl.uniform1f(u('uIntensity'), OPTS.intensity);
    gl.uniform1f(u('uBandWidth'), OPTS.bandWidth);
    const rad = (OPTS.rotation * Math.PI) / 180;
    gl.uniform2f(u('uRot'), Math.cos(rad), Math.sin(rad));
    const uTime = u('uTime');
    const uPointer = u('uPointer');
    const uCanvas = u('uCanvas');

    host.append(canvas);
    const resize = () => {
      const ratio = Math.min(devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(host.clientWidth * ratio));
      const h = Math.max(1, Math.round(host.clientHeight * ratio));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uCanvas, w, h);
    };

    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    const onPointer = (e: PointerEvent) => {
      target.x = (e.clientX / innerWidth) * 2 - 1;
      target.y = -((e.clientY / innerHeight) * 2 - 1);
    };
    addEventListener('pointermove', onPointer, { passive: true });

    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;
    const io = new IntersectionObserver((entries) => { visible = entries.some((e) => e.isIntersecting); });
    io.observe(host);

    let raf = 0;
    let last = performance.now();
    let time = 0;
    const render = () => {
      gl.uniform1f(uTime, time);
      gl.uniform2f(uPointer, cur.x, cur.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const draw = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (visible && !document.hidden) {
        time += dt;
        cur.x += (target.x - cur.x) * Math.min(1, dt * 8);
        cur.y += (target.y - cur.y) * Math.min(1, dt * 8);
        render();
      }
      raf = requestAnimationFrame(draw);
    };
    // "Reduce motion": one still frame, redrawn only when the size changes. No animation loop at all.
    const observer = new ResizeObserver(() => {
      resize();
      if (reduceMotion.matches) render();
    });
    observer.observe(host);
    resize();
    if (reduceMotion.matches) render();
    else raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onPointer);
      observer.disconnect();
      io.disconnect();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      cleanup();
    };
  } catch (error) {
    console.error('glow background disabled', error);
    canvas.remove();
    return cleanup;
  }
}
