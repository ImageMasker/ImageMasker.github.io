// Minimal WebGL2 helper tailored to the masker's full-screen-pass pipeline.
// Conventions: every texture/FBO stores row 0 = top of the image, colours are premultiplied.

const VERTEX_SHADER = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

function numberLines(source) {
  return source.split('\n').map((line, index) => `${String(index + 1).padStart(4)}: ${line}`).join('\n');
}

export class GL {
  constructor(canvas) {
    this.canvas = canvas;
    this.programs = new Map();
    this.pool = [];
    this.listeners = new Set();
    this.lost = false;

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });

    if (!gl) {
      throw new Error('WebGL2 is not available in this browser.');
    }

    this.gl = gl;
    this.setup();

    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.lost = true;
    });
    canvas.addEventListener('webglcontextrestored', () => {
      this.lost = false;
      this.programs.clear();
      this.pool = [];
      this.setup();
      for (const listener of this.listeners) {
        listener();
      }
    });
  }

  setup() {
    const gl = this.gl;

    this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }

  onRestore(listener) {
    this.listeners.add(listener);
  }

  compile(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compile failed:\n${log}\n${numberLines(source)}`);
    }

    return shader;
  }

  program(key, fragmentSource) {
    const cached = this.programs.get(key);

    if (cached) {
      return cached;
    }

    const gl = this.gl;
    const handle = gl.createProgram();
    const vertex = this.compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragment = this.compile(
      gl.FRAGMENT_SHADER,
      typeof fragmentSource === 'function' ? fragmentSource() : fragmentSource
    );

    gl.attachShader(handle, vertex);
    gl.attachShader(handle, fragment);
    gl.bindAttribLocation(handle, 0, 'aPos');
    gl.linkProgram(handle);

    if (!gl.getProgramParameter(handle, gl.LINK_STATUS) && !gl.isContextLost()) {
      throw new Error(`Program link failed (${key}): ${gl.getProgramInfoLog(handle)}`);
    }

    gl.deleteShader(vertex);
    gl.deleteShader(fragment);

    const uniforms = [];
    const count = gl.getProgramParameter(handle, gl.ACTIVE_UNIFORMS) || 0;

    for (let index = 0; index < count; index += 1) {
      const info = gl.getActiveUniform(handle, index);

      if (!info) {
        continue;
      }

      uniforms.push({
        name: info.name.replace(/\[0\]$/, ''),
        type: info.type,
        location: gl.getUniformLocation(handle, info.name),
      });
    }

    const program = { handle, uniforms };
    this.programs.set(key, program);
    return program;
  }

  /** Runs a full-screen pass. `target` is a pooled render target, or null for the canvas. */
  draw(program, target, values = {}) {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(
      0,
      0,
      target ? target.width : gl.drawingBufferWidth,
      target ? target.height : gl.drawingBufferHeight
    );
    gl.useProgram(program.handle);
    gl.bindVertexArray(this.vao);

    let unit = 0;

    for (const uniform of program.uniforms) {
      const value = values[uniform.name];

      switch (uniform.type) {
        case gl.SAMPLER_2D: {
          const texture = value?.texture ?? value ?? null;
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.uniform1i(uniform.location, unit);
          unit += 1;
          break;
        }
        case gl.FLOAT:
          gl.uniform1f(uniform.location, Number(value) || 0);
          break;
        case gl.INT:
        case gl.BOOL:
          gl.uniform1i(uniform.location, Number(value) || 0);
          break;
        case gl.FLOAT_VEC2:
          gl.uniform2fv(uniform.location, value ?? [0, 0]);
          break;
        case gl.FLOAT_VEC3:
          gl.uniform3fv(uniform.location, value ?? [0, 0, 0]);
          break;
        case gl.FLOAT_VEC4:
          gl.uniform4fv(uniform.location, value ?? [0, 0, 0, 0]);
          break;
        case gl.FLOAT_MAT3:
          gl.uniformMatrix3fv(uniform.location, false, value ?? [1, 0, 0, 0, 1, 0, 0, 0, 1]);
          break;
        default:
          break;
      }
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  createTexture(width, height, { filter = this.gl.LINEAR, wrap = this.gl.MIRRORED_REPEAT } = {}) {
    const gl = this.gl;
    const texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);

    if (width && height) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }

    return texture;
  }

  /** Uploads an image/canvas/bitmap. Returns { texture, width, height }. */
  textureFromSource(source, options = {}) {
    const gl = this.gl;
    const texture = this.createTexture(0, 0, { wrap: gl.CLAMP_TO_EDGE, ...options });
    const entry = { texture, width: 0, height: 0 };

    this.updateTexture(entry, source);
    return entry;
  }

  updateTexture(entry, source) {
    const gl = this.gl;

    gl.bindTexture(gl.TEXTURE_2D, entry.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    entry.width = source.naturalWidth || source.videoWidth || source.width;
    entry.height = source.naturalHeight || source.videoHeight || source.height;
  }

  deleteTexture(entry) {
    if (entry?.texture) {
      this.gl.deleteTexture(entry.texture);
    }
  }

  /** Pooled RGBA8 render target. */
  acquire(width, height) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    const free = this.pool.find((target) => !target.busy && target.width === w && target.height === h);

    if (free) {
      free.busy = true;
      return free;
    }

    const gl = this.gl;
    const texture = this.createTexture(w, h);
    const fbo = gl.createFramebuffer();

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE && !gl.isContextLost()) {
      gl.deleteFramebuffer(fbo);
      gl.deleteTexture(texture);
      throw new Error(`Could not allocate a ${w}x${h} render target.`);
    }

    const target = { texture, fbo, width: w, height: h, busy: true };
    this.pool.push(target);
    return target;
  }

  release(target) {
    if (target) {
      target.busy = false;
    }
  }

  clear(target, color = [0, 0, 0, 0]) {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(
      0,
      0,
      target ? target.width : gl.drawingBufferWidth,
      target ? target.height : gl.drawingBufferHeight
    );
    gl.clearColor(color[0], color[1], color[2], color[3]);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /** Frees idle targets that do not match the given size (pass nothing to free all idle targets). */
  trim(keepWidth = 0, keepHeight = 0) {
    const gl = this.gl;

    this.pool = this.pool.filter((target) => {
      if (target.busy || (target.width === keepWidth && target.height === keepHeight)) {
        return true;
      }

      gl.deleteFramebuffer(target.fbo);
      gl.deleteTexture(target.texture);
      return false;
    });
  }

  readPixels(target) {
    const gl = this.gl;
    const pixels = new Uint8ClampedArray(target.width * target.height * 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.readPixels(0, 0, target.width, target.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  }
}
