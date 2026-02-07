function getViewportSize() {
    const vv = window.visualViewport;
    return {
        width: vv ? vv.width : window.innerWidth,
        height: vv ? vv.height : window.innerHeight
    };
}

function createGraphics(de, colors, otherfunctions, uniforms) {
    const c = document.createElement("canvas");
    const size = getViewportSize();
    c.width = size.width;
    c.height = size.height;
    document.body.appendChild(c);
    c.onclick = () => c.requestPointerLock();

    const gl = c.getContext("webgl2");

    const makeShader = (src, type) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
        console.log(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
    };

    const vertSrc = `#version 300 es
    in vec4 a_position;
    out vec4 pos4;
    void main() { pos4 = a_position; gl_Position = a_position; }`;

    const fragSrc = `#version 300 es
    #define MIN_DIST 0.002
    #define MAX_ITERATIONS 120
    #define RANGE 500.
    precision highp float;
    out vec4 color;
    in vec4 pos4;
    uniform vec2 res; uniform vec3 camPos; uniform vec2 camAngle; uniform float t;
    uniform vec3 playerPos; uniform vec3 boulderPos; uniform mat3 boulderRotMat;
    uniform vec2 playerAngle; uniform float isPushing; uniform float gameState;
    ${uniforms}
    ${libs}
    ${de}
    ${libsAfterDe}
    ${otherfunctions}
    void main() {
        vec2 pos = pos4.xy;
        pos.x *= res.x / res.y;
        vec3 dir = normalize(vec3(pos.x * 0.4, pos.y * 0.4, 0.6));
        dir = rotX(dir, -camAngle.y);
        dir = rotY(dir, camAngle.x);
        vec3 p = camPos;
        float dist = de(p), totDist = dist;
        float glowDist = boulderGlow(p), minGlow = glowDist;
        for(int i = 0; i < MAX_ITERATIONS; i++) {
            if(dist < MIN_DIST || totDist > RANGE) break;
            p += dir * dist;
            dist = de(p);
            glowDist = boulderGlow(p);
            if(glowDist < minGlow) minGlow = glowDist;
            totDist += dist;
        }
        ${colors}
    }`;

    const program = gl.createProgram();
    gl.attachShader(program, makeShader(vertSrc, gl.VERTEX_SHADER));
    gl.attachShader(program, makeShader(fragSrc, gl.FRAGMENT_SHADER));
    gl.linkProgram(program);

    const posLoc = gl.getAttribLocation(program, "a_position");
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,-1,1,1,1,1,1,1,-1,-1,-1]), gl.STATIC_DRAW);

    const va = gl.createVertexArray();
    gl.bindVertexArray(va);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.viewport(0, 0, c.width, c.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);

    return { gl, program, c };
}

function Renderer(de, colors, otherfunctions, uniforms) {
    const { gl, program, c } = createGraphics(de, colors, otherfunctions, uniforms);
    this.gl = gl;
    this.canvas = c;
    this.program = program;
    this.uniforms = {};

    this.addUniform = (name, type, value) => {
        if (Array.isArray(value) && !Array.isArray(value[0])) value = new Float32Array(value);
        const uni = { location: gl.getUniformLocation(program, name), value };
        
        if (type === "vec2") uni.set = (l, v) => gl.uniform2fv(l, v);
        else if (type === "vec3") uni.set = (l, v) => gl.uniform3fv(l, v);
        else if (type === "vec4") uni.set = (l, v) => gl.uniform4fv(l, v);
        else if (type === "float") uni.set = (l, v) => gl.uniform1f(l, v);
        else if (type === "mat3") uni.set = (l, v) => gl.uniformMatrix3fv(l, false, new Float32Array(v.flat()));

        this.uniforms[name] = uni;
        uni.set(uni.location, uni.value);
    };

    this.setUni = (name, value) => {
        if (Array.isArray(value) && !Array.isArray(value[0])) value = new Float32Array(value);
        const uni = this.uniforms[name];
        uni.value = value;
        uni.set(uni.location, value);
    };

    this.draw = () => gl.drawArrays(gl.TRIANGLES, 0, 6);
}
