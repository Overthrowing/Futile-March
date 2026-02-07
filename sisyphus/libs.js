// GLSL Libraries for raymarching
let libs = 
`
// Smooth minimum for organic blending
float smin(float a, float b, float k) {
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h * h * k * 0.25;
}

// Bending transformation
vec3 bend(vec3 p, float k) {
    float c = cos(k * p.x);
    float s = sin(k * p.x);
    mat2 m = mat2(c, -s, s, c);
    return vec3(m * p.xy, p.z);
}

// Rotation around arbitrary axis
vec3 rotAxis(vec3 p, float a, vec3 u) {
    mat3 m = mat3(
        cos(a) + u.x*u.x*(1.-cos(a)), u.x*u.y*(1.-cos(a))-u.z*sin(a), u.x*u.z*(1.-cos(a)) + u.y*sin(a),
        u.y*u.x*(1.-cos(a))+u.z*sin(a), cos(a) + u.y*u.y*(1.-cos(a)), u.y*u.z*(1.-cos(a))-u.x*sin(a),
        u.z*u.x*(1.-cos(a))-u.y*sin(a), u.z*u.y*(1.-cos(a))+u.x*sin(a), cos(a) + u.z*u.z*(1.-cos(a)) 
    );
    return m * p;
}

vec3 rotY(vec3 v, float a) {
    return vec3(v.x*cos(a)+v.z*sin(a), v.y, -v.x*sin(a) + v.z*cos(a));
}

vec3 rotX(vec3 v, float a) {
    return vec3(v.x, v.y*cos(a)-v.z*sin(a), v.y*sin(a)+v.z*cos(a));
}

vec3 rotZ(vec3 v, float a) {
    return vec3(v.x*cos(a)-v.y*sin(a), v.x*sin(a)+v.y*cos(a), v.z);
}

vec3 twist(vec3 p, float k) {
    float c = cos(k * p.y);
    float s = sin(k * p.y);
    mat2 m = mat2(c, -s, s, c);
    return vec3(m * p.xz, p.y);
}

float dot2(in vec3 v) { return dot(v, v); }

// SDF Primitives
float sdBox(vec3 p, vec3 b) {
    vec3 q = abs(p) - b;
    return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
    vec3 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y;
}

float sdCylinder(vec3 p, float h, float r) {
    vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
    return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdSphere(vec3 p, float r) {
    return length(p) - r;
}

float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
    vec3 ba = b - a;
    float l2 = dot(ba, ba);
    float rr = r1 - r2;
    float a2 = l2 - rr * rr;
    float il2 = 1.0 / l2;
    vec3 pa = p - a;
    float y = dot(pa, ba);
    float z = y - l2;
    float x2 = dot2(pa * l2 - ba * y);
    float y2 = y * y * l2;
    float z2 = z * z * l2;
    float k = sign(rr) * rr * rr * x2;
    if(sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
    if(sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
    return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

// Noise functions
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }

float noise(vec3 p) {
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);
    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = permute(b.xyxy);
    vec4 k2 = permute(k1.xyxy + b.zzww);
    vec4 c = k2 + a.zzzz;
    vec4 k3 = permute(c);
    vec4 k4 = permute(c + 1.0);
    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));
    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);
    return o4.y * d.y + o4.x * (1.0 - d.y);
}

float fbm(vec3 p) {
    float f = 0.0;
    f += 0.5 * noise(p); p *= 2.01;
    f += 0.25 * noise(p); p *= 2.02;
    f += 0.125 * noise(p); p *= 2.03;
    f += 0.0625 * noise(p);
    return f / 0.9375;
}

// Stars background
vec3 nmzHash33(vec3 q) {
    uvec3 p = uvec3(ivec3(q));
    p = p * uvec3(374761393U, 1103515245U, 668265263U) + p.zxy + p.yzx;
    p = p.yzx * (p.zxy ^ (p >> 3U));
    return vec3(p ^ (p >> 16U)) * (1.0 / vec3(0xffffffffU));
}

vec3 stars(in vec3 p) {
    vec3 c = vec3(0.);
    float resX = 400.;
    for(float i = 0.; i < 4.; i++) {
        vec3 q = fract(p * (.15 * resX)) - 0.5;
        vec3 id = floor(p * (.15 * resX));
        vec2 rn = nmzHash33(id).xy;
        float c2 = 1. - smoothstep(0., .6, length(q));
        c2 *= step(rn.x, .0005 + i * 0.002);
        c += c2 * (mix(vec3(1.0, 0.49, 0.1), vec3(0.75, 0.9, 1.), rn.y) * 0.25 + 0.75);
        p *= 1.4;
    }
    return c * c * 0.5;
}
`;

let libsAfterDe = `
vec3 grad(vec3 p) {
    float eps = 0.01;
    return normalize(vec3(
        (de(p + vec3(eps, 0., 0.)) - de(p - vec3(eps, 0., 0.))) / (2. * eps),
        (de(p + vec3(0., eps, 0.)) - de(p - vec3(0., eps, 0.))) / (2. * eps),
        (de(p + vec3(0., 0., eps)) - de(p - vec3(0., 0., eps))) / (2. * eps)
    ));
}

float ao(vec3 p, vec3 n) {
    float occ = 0.0;
    float sca = 1.0;
    for(int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i) / 4.0;
        float d = de(p + h * n);
        occ += (h - d) * sca;
        sca *= 0.95;
    }
    return clamp(1.0 - 3.0 * occ, 0.0, 1.0);
}
`;

// JavaScript math utilities
function rotY(v, a) {
    return [v[0]*Math.cos(a) + v[2]*Math.sin(a), v[1], -v[0]*Math.sin(a) + v[2]*Math.cos(a)];
}

function rotX(v, a) {
    return [v[0], v[1]*Math.cos(a) - v[2]*Math.sin(a), v[1]*Math.sin(a) + v[2]*Math.cos(a)];
}

function plus(a1, a2) {
    return [a1[0] + a2[0], a1[1] + a2[1], a1[2] + a2[2]];
}

function times(a, s) {
    return [a[0]*s, a[1]*s, a[2]*s];
}

function min(...args) { return Math.min(...args); }
function max(...args) { return Math.max(...args); }

function abs(x) {
    if(Array.isArray(x)) return x.map(Math.abs);
    return Math.abs(x);
}

function cos(x) {
    if(Array.isArray(x)) return x.map(Math.cos);
    return Math.cos(x);
}

function sin(x) {
    if(Array.isArray(x)) return x.map(Math.sin);
    return Math.sin(x);
}

function len(v) { return Math.hypot(...v); }

function normalize(v) {
    const l = len(v);
    return l === 0 ? [0, 0, 0] : times(v, 1/l);
}

function dot(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2]; }

function cross(a, b) {
    return [
        a[1]*b[2] - a[2]*b[1],
        a[2]*b[0] - a[0]*b[2],
        a[0]*b[1] - a[1]*b[0]
    ];
}

function reflect(d, n) {
    return plus(d, times(n, -2 * dot(d, n)));
}

function lerp(a, b, w) {
    if(Array.isArray(a)) {
        return a.map((v, i) => v + (b[i] - v) * w);
    }
    return a + (b - a) * w;
}

function sinLerp(a, b, w) {
    return lerp(a, b, Math.sin(Math.PI * (w - 0.5)) / 2 + 0.5);
}

function clamp(x, minVal, maxVal) {
    return Math.min(Math.max(x, minVal), maxVal);
}

function I() { return [[1,0,0], [0,1,0], [0,0,1]]; }

function matTimes(m, v) {
    return [
        m[0][0]*v[0] + m[0][1]*v[1] + m[0][2]*v[2],
        m[1][0]*v[0] + m[1][1]*v[1] + m[1][2]*v[2],
        m[2][0]*v[0] + m[2][1]*v[1] + m[2][2]*v[2]
    ];
}

function matTimesMat(a, b) {
    let temp = [[], [], []];
    for(let i = 0; i < 3; i++) {
        let col = matTimes(a, [b[0][i], b[1][i], b[2][i]]);
        for(let j = 0; j < 3; j++) {
            temp[j].push(col[j]);
        }
    }
    return temp;
}

function rotAxisMat(a, u) {
    const c = Math.cos(a), s = Math.sin(a);
    return [
        [c + u[0]*u[0]*(1-c), u[0]*u[1]*(1-c) - u[2]*s, u[0]*u[2]*(1-c) + u[1]*s],
        [u[1]*u[0]*(1-c) + u[2]*s, c + u[1]*u[1]*(1-c), u[1]*u[2]*(1-c) - u[0]*s],
        [u[2]*u[0]*(1-c) - u[1]*s, u[2]*u[1]*(1-c) + u[0]*s, c + u[2]*u[2]*(1-c)]
    ];
}

function sdBox3(p, b) {
    let q = plus(abs(p), times(b, -1));
    return len([max(q[0], 0), max(q[1], 0), max(q[2], 0)]) + min(max(q[0], q[1], q[2]), 0);
}

function dirFromAngle(ax, ay) {
    let dir = [0, 0, 1];
    dir = rotX(dir, -ay);
    dir = rotY(dir, ax);
    return dir;
}

// Mountain height function (used in both JS and GLSL)
function getMountainHeight(x, z) {
    // Main slope going up in Z direction
    const baseHeight = z * 0.3;
    // Add some waviness
    const wave = Math.sin(x * 0.1) * 2 + Math.sin(z * 0.05) * 3;
    return Math.max(0, baseHeight + wave);
}

// Slope angle at position
function getSlopeAngle(z) {
    return Math.atan(0.3); // Approximately 16.7 degrees
}

// Check if position is on the path
function isOnPath(x, z) {
    const pathWidth = 6;
    return Math.abs(x) < pathWidth;
}

function deNormal(p) {
    const eps = 0.01;
    return normalize([
        de(plus(p, [eps, 0, 0])) - de(plus(p, [-eps, 0, 0])),
        de(plus(p, [0, eps, 0])) - de(plus(p, [0, -eps, 0])),
        de(plus(p, [0, 0, eps])) - de(plus(p, [0, 0, -eps]))
    ]);
}

// Bumpy section height for physics
function getBumpyHeight(x, z) {
    let bumps = 0;
    
    // Bumpy zone 1: z = 20-28
    if (z > 18 && z < 30 && Math.abs(x) < 5) {
        const fade = smoothstepJS(18, 20, z) * smoothstepJS(30, 28, z);
        bumps += Math.sin(x * 3) * Math.sin(z * 3) * 0.15 * fade;
    }
    
    // Bumpy zone 2: z = 50-58
    if (z > 48 && z < 60 && Math.abs(x) < 5) {
        const fade = smoothstepJS(48, 50, z) * smoothstepJS(60, 58, z);
        bumps += Math.sin(x * 4 + 1) * Math.sin(z * 4) * 0.2 * fade;
    }
    
    // Bumpy zone 3: z = 95-103
    if (z > 93 && z < 105 && Math.abs(x) < 5) {
        const fade = smoothstepJS(93, 95, z) * smoothstepJS(105, 103, z);
        bumps += Math.sin(x * 5 + 2) * Math.sin(z * 5) * 0.18 * fade;
    }
    
    return bumps;
}

function smoothstepJS(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

// Mountain height for physics - must match GLSL mountainHeight!
function getTerrainHeight(x, z) {
    const baseHeight = z * 0.3;
    const wave = Math.sin(x * 0.1) * 2 + Math.sin(z * 0.05) * 3;
    const bumps = getBumpyHeight(x, z);
    return Math.max(-5, baseHeight + wave + bumps);
}

// Simple noise approximation for terrain detail
function simpleNoise(x, z) {
    return Math.sin(x * 1.3 + z * 0.7) * Math.cos(x * 0.9 - z * 1.1) * 0.5;
}

