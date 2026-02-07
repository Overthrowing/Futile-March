let renderer = new Renderer(

// Distance estimation function (de)
`
// Mountain terrain height - must match JS getTerrainHeight!
float mountainHeight(vec3 p) {
    float baseSlope = p.z * 0.3;
    float wave = sin(p.x * 0.1) * 2.0 + sin(p.z * 0.05) * 3.0;
    float height = baseSlope + wave;
    return max(-5.0, height);
}

// Bumpy sections - adds small bumps in certain areas
float bumpySection(vec3 p) {
    float bumps = 0.0;
    
    // Bumpy zone 1: z = 20-28
    if(p.z > 18.0 && p.z < 30.0 && abs(p.x) < 5.0) {
        float fade = smoothstep(18.0, 20.0, p.z) * smoothstep(30.0, 28.0, p.z);
        bumps += sin(p.x * 3.0) * sin(p.z * 3.0) * 0.15 * fade;
    }
    
    // Bumpy zone 2: z = 50-58
    if(p.z > 48.0 && p.z < 60.0 && abs(p.x) < 5.0) {
        float fade = smoothstep(48.0, 50.0, p.z) * smoothstep(60.0, 58.0, p.z);
        bumps += sin(p.x * 4.0 + 1.0) * sin(p.z * 4.0) * 0.2 * fade;
    }
    
    // Bumpy zone 3: z = 95-103
    if(p.z > 93.0 && p.z < 105.0 && abs(p.x) < 5.0) {
        float fade = smoothstep(93.0, 95.0, p.z) * smoothstep(105.0, 103.0, p.z);
        bumps += sin(p.x * 5.0 + 2.0) * sin(p.z * 5.0) * 0.18 * fade;
    }
    
    return bumps;
}

// The main mountain/ground
float mountain(vec3 p) {
    float h = mountainHeight(p);
    
    // Add visual rocky texture (doesn't affect collision height)
    float rocky = fbm(p * 0.15) * 0.3;
    
    // Add bumpy sections
    float bumps = bumpySection(p);
    
    float ground = p.y - h - rocky - bumps;
    
    // Carve out the path
    float pathWidth = 6.0;
    float pathDepth = 0.5;
    float pathDist = abs(p.x);
    float pathCarve = smoothstep(pathWidth, pathWidth - 1.0, pathDist) * pathDepth;
    
    return ground + pathCarve;
}

// Spinning bar obstacle - tilted to match slope
float spinningBar(vec3 p, vec3 barPos, float barAngle) {
    vec3 q = p - barPos;
    
    // Tilt the whole thing to match the slope (about 16.7 degrees = atan(0.3))
    float slopeAngle = 0.29; // atan(0.3)
    q = rotX(q, slopeAngle);
    q = rotY(q, barAngle);
    
    // Horizontal bar
    float bar = sdCapsule(q, vec3(-4.0, 0.0, 0.0), vec3(4.0, 0.0, 0.0), 0.3);
    // Central pole (perpendicular to slope)
    float pole = sdCylinder(q, 3.0, 0.2);
    
    return min(bar, pole);
}

// Floor beam - small beam lying across the path
float floorBeam(vec3 p, vec3 beamPos, float width) {
    vec3 q = p - beamPos;
    // Tilt to match slope
    q = rotX(q, 0.29);
    // Beam lying across (X direction)
    return sdBox(q, vec3(width, 0.15, 0.3));
}

// Hole/pit in the ground
float hole(vec3 p, vec3 holePos, float radius) {
    vec2 d = vec2(length(p.xz - holePos.xz) - radius, p.y - holePos.y);
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

// The boulder with carved grooves like jackrabbit
float boulderRings(vec3 p) {
    float rad = 2.0;
    float ringThickness = 0.2;
    
    vec3 r1P = twist(p, 0.2);
    float ring1 = sdTorus(r1P, vec2(rad, ringThickness));
    
    vec3 r2P = rotY(p, 1.047);
    r2P = twist(r2P, 0.2);
    float ring2 = sdTorus(r2P, vec2(rad, ringThickness));
    
    vec3 r3P = rotY(p, 2.094);
    r3P = twist(r3P, 0.2);
    float ring3 = sdTorus(r3P, vec2(rad, ringThickness));
    
    return min(min(ring1, ring2), ring3);
}

float boulder(vec3 p) {
    if(length(p - boulderPos) > 4.0) {
        return sdSphere(p - boulderPos, 2.5);
    }
    vec3 q = p - boulderPos;
    q = boulderRotMat * q;
    
    float sphere = sdSphere(q, 2.5);
    float rings = boulderRings(q);
    
    return max(sphere, -rings);
}

float boulderSimple(vec3 p) {
    return sdSphere(p - boulderPos, 2.5);
}

// Sisyphus character
float playerHead(vec3 p) {
    p -= uHeadPos;
    float head = sdSphere(p - vec3(0.0, 0.4, 0.0), 0.2);
    float nose = sdSphere(p - vec3(0.0, 0.37, 0.18), 0.08);
    
    // Beard
    float beard = sdRoundCone(p, vec3(0.0, 0.25, 0.1), vec3(0.0, 0.1, 0.05), 0.12, 0.08);
    
    float d = smin(head, nose, 0.1);
    d = smin(d, beard, 0.08);
    return d;
}

float playerBody(vec3 p) {
    vec3 chestP = p + uChestPos;
    float torso = sdRoundCone(chestP, vec3(0.0, 0.15, 0.0), vec3(0.0, -0.15, -0.1), 0.2, 0.12);
    
    // Arms extended forward for pushing
    float pushOffset = isPushing * 0.15;
    vec3 armR = vec3(0.15, 0.1 - pushOffset, 0.2 + pushOffset);
    vec3 armL = vec3(-0.15, 0.1 - pushOffset, 0.2 + pushOffset);
    
    float rArm = sdCapsule(chestP, vec3(0.2, 0.1, 0.0), armR, 0.05);
    float lArm = sdCapsule(chestP, vec3(-0.2, 0.1, 0.0), armL, 0.05);
    
    float d = torso;
    d = min(d, rArm);
    d = min(d, lArm);
    return d;
}

float playerLegs(vec3 p) {
    vec3 hip1 = uhip1;
    vec3 jr1 = ujr1;
    vec3 jr2 = ujr2;
    vec3 jr3 = ujr3;
    vec3 hip2 = uhip2;
    vec3 jl1 = ujl1;
    vec3 jl2 = ujl2;
    vec3 jl3 = ujl3;

    float thigh1 = sdCapsule(p, hip1, jr1, 0.04);
    float shin1 = sdCapsule(p, jr1, jr2, 0.035);
    float foot1 = sdCapsule(p, jr2, jr3, 0.03);

    float thigh2 = sdCapsule(p, hip2, jl1, 0.04);
    float shin2 = sdCapsule(p, jl1, jl2, 0.035);
    float foot2 = sdCapsule(p, jl2, jl3, 0.03);

    float d = min(thigh1, shin1);
    d = min(d, foot1);
    d = min(d, thigh2);
    d = min(d, shin2);
    d = min(d, foot2);
    return d;
}

float player(vec3 p) {
    vec3 q = p - playerPos;
    if(length(q) > 1.5) {
        return sdSphere(q, 1.0);
    }
    q = rotY(q, -playerAngle.x);
    
    vec3 bodyP = rotX(q, uBodyAngle.y);
    
    float head = playerHead(bodyP);
    float body = playerBody(bodyP);
    float legs = playerLegs(q);
    
    return min(min(head, body), legs);
}

// All spinning bars - aligned with terrain
float allSpinningBars(vec3 p) {
    float d = 1000.0;
    
    // Bar 1 at z=30
    float h1 = mountainHeight(vec3(0.0, 0.0, 30.0)) + 1.5;
    d = min(d, spinningBar(p, vec3(0.0, h1, 30.0), t * 1.5));
    
    // Bar 2 at z=60
    float h2 = mountainHeight(vec3(0.0, 0.0, 60.0)) + 1.5;
    d = min(d, spinningBar(p, vec3(0.0, h2, 60.0), -t * 2.0));
    
    // Bar 3 at z=90
    float h3 = mountainHeight(vec3(0.0, 0.0, 90.0)) + 1.5;
    d = min(d, spinningBar(p, vec3(0.0, h3, 90.0), t * 1.2 + 1.57));
    
    // Bar 4 at z=120
    float h4 = mountainHeight(vec3(0.0, 0.0, 120.0)) + 1.5;
    d = min(d, spinningBar(p, vec3(0.0, h4, 120.0), -t * 1.8 + 0.785));
    
    return d;
}

// All holes - aligned with terrain
float allHoles(vec3 p) {
    float d = 1000.0;
    
    // Hole 1
    float h1 = mountainHeight(vec3(2.5, 0.0, 45.0)) - 5.0;
    vec3 holePos1 = vec3(2.5, h1, 45.0);
    float hole1 = length(p.xz - holePos1.xz) - 3.0;
    if(p.y < holePos1.y + 5.0) {
        d = min(d, max(hole1, -(p.y - holePos1.y)));
    }
    
    // Hole 2
    float h2 = mountainHeight(vec3(-2.0, 0.0, 75.0)) - 5.0;
    vec3 holePos2 = vec3(-2.0, h2, 75.0);
    float hole2 = length(p.xz - holePos2.xz) - 2.5;
    if(p.y < holePos2.y + 5.0) {
        d = min(d, max(hole2, -(p.y - holePos2.y)));
    }
    
    // Hole 3
    float h3 = mountainHeight(vec3(1.5, 0.0, 105.0)) - 5.0;
    vec3 holePos3 = vec3(1.5, h3, 105.0);
    float hole3 = length(p.xz - holePos3.xz) - 2.0;
    if(p.y < holePos3.y + 5.0) {
        d = min(d, max(hole3, -(p.y - holePos3.y)));
    }
    
    return d;
}

// Tilted box - aligned with slope
float tiltedBox(vec3 p, vec3 boxPos, vec3 size) {
    vec3 q = p - boxPos;
    q = rotX(q, 0.29); // Tilt to match slope
    return sdBox(q, size);
}

// Random boxes scattered on the path - tilted to match slope
float allBoxes(vec3 p) {
    float d = 1000.0;
    
    // Box 1 - left side at z=15
    vec3 boxPos1 = vec3(-3.0, mountainHeight(vec3(-3.0, 0.0, 15.0)) + 1.0, 15.0);
    d = min(d, tiltedBox(p, boxPos1, vec3(1.0, 1.0, 1.0)));
    
    // Box 2 - right side at z=25
    vec3 boxPos2 = vec3(2.5, mountainHeight(vec3(2.5, 0.0, 25.0)) + 0.75, 25.0);
    d = min(d, tiltedBox(p, boxPos2, vec3(0.75, 0.75, 0.75)));
    
    // Box 3 - center-left at z=40
    vec3 boxPos3 = vec3(-1.5, mountainHeight(vec3(-1.5, 0.0, 40.0)) + 1.2, 40.0);
    d = min(d, tiltedBox(p, boxPos3, vec3(1.2, 1.2, 0.8)));
    
    // Box 4 - right at z=55
    vec3 boxPos4 = vec3(3.5, mountainHeight(vec3(3.5, 0.0, 55.0)) + 0.9, 55.0);
    d = min(d, tiltedBox(p, boxPos4, vec3(0.9, 0.9, 1.1)));
    
    // Box 5 - left at z=70
    vec3 boxPos5 = vec3(-4.0, mountainHeight(vec3(-4.0, 0.0, 70.0)) + 1.5, 70.0);
    d = min(d, tiltedBox(p, boxPos5, vec3(1.5, 1.5, 1.0)));
    
    // Box 6 - center-right at z=85
    vec3 boxPos6 = vec3(1.0, mountainHeight(vec3(1.0, 0.0, 85.0)) + 0.8, 85.0);
    d = min(d, tiltedBox(p, boxPos6, vec3(0.8, 0.8, 0.8)));
    
    // Box 7 - left at z=100
    vec3 boxPos7 = vec3(-2.5, mountainHeight(vec3(-2.5, 0.0, 100.0)) + 1.1, 100.0);
    d = min(d, tiltedBox(p, boxPos7, vec3(1.1, 1.1, 0.9)));
    
    // Box 8 - right at z=115
    vec3 boxPos8 = vec3(4.0, mountainHeight(vec3(4.0, 0.0, 115.0)) + 1.3, 115.0);
    d = min(d, tiltedBox(p, boxPos8, vec3(1.3, 1.0, 1.2)));
    
    // Box 9 - center at z=130
    vec3 boxPos9 = vec3(0.5, mountainHeight(vec3(0.5, 0.0, 130.0)) + 0.7, 130.0);
    d = min(d, tiltedBox(p, boxPos9, vec3(0.7, 0.7, 0.7)));
    
    // Box 10 - left at z=140
    vec3 boxPos10 = vec3(-3.5, mountainHeight(vec3(-3.5, 0.0, 140.0)) + 1.0, 140.0);
    d = min(d, tiltedBox(p, boxPos10, vec3(1.0, 1.0, 1.0)));
    
    return d;
}

// Floor beams - small obstacles on the ground
float allFloorBeams(vec3 p) {
    float d = 1000.0;
    
    // Beam 1 at z=10
    vec3 beamPos1 = vec3(0.0, mountainHeight(vec3(0.0, 0.0, 10.0)) + 0.15, 10.0);
    d = min(d, floorBeam(p, beamPos1, 4.0));
    
    // Beam 2 at z=35
    vec3 beamPos2 = vec3(-1.0, mountainHeight(vec3(-1.0, 0.0, 35.0)) + 0.15, 35.0);
    d = min(d, floorBeam(p, beamPos2, 3.5));
    
    // Beam 3 at z=52
    vec3 beamPos3 = vec3(1.5, mountainHeight(vec3(1.5, 0.0, 52.0)) + 0.15, 52.0);
    d = min(d, floorBeam(p, beamPos3, 3.0));
    
    // Beam 4 at z=68
    vec3 beamPos4 = vec3(0.0, mountainHeight(vec3(0.0, 0.0, 68.0)) + 0.15, 68.0);
    d = min(d, floorBeam(p, beamPos4, 4.5));
    
    // Beam 5 at z=82
    vec3 beamPos5 = vec3(-0.5, mountainHeight(vec3(-0.5, 0.0, 82.0)) + 0.15, 82.0);
    d = min(d, floorBeam(p, beamPos5, 3.5));
    
    // Beam 6 at z=98
    vec3 beamPos6 = vec3(0.5, mountainHeight(vec3(0.5, 0.0, 98.0)) + 0.15, 98.0);
    d = min(d, floorBeam(p, beamPos6, 4.0));
    
    // Beam 7 at z=112
    vec3 beamPos7 = vec3(-1.0, mountainHeight(vec3(-1.0, 0.0, 112.0)) + 0.15, 112.0);
    d = min(d, floorBeam(p, beamPos7, 3.0));
    
    // Beam 8 at z=125
    vec3 beamPos8 = vec3(0.0, mountainHeight(vec3(0.0, 0.0, 125.0)) + 0.15, 125.0);
    d = min(d, floorBeam(p, beamPos8, 5.0));
    
    return d;
}

float boulderGlow(vec3 p) {
    return boulderSimple(p);
}

float de(vec3 p) {
    float ground = mountain(p);
    
    // Carve holes into ground
    float holes = allHoles(p);
    ground = max(ground, -holes);
    
    float bars = allSpinningBars(p);
    float boxes = allBoxes(p);
    float beams = allFloorBeams(p);
    float bould = boulder(p);
    float plyr = player(p);
    
    float d = ground;
    d = min(d, bars);
    d = min(d, boxes);
    d = min(d, beams);
    d = min(d, bould);
    d = min(d, plyr);
    
    return d;
}
`,

// Color/shading
`
vec3 col = vec3(0.0);
vec3 skyCol = vec3(0.02, 0.01, 0.05);

if(dist <= MIN_DIST) {
    vec3 norm = grad(p);
    float occ = ao(p, norm);
    
    vec3 lightDir = normalize(vec3(0.5, 0.8, -0.3));
    vec3 lightDir2 = normalize(vec3(-0.3, 0.5, 0.5));
    float diff = max(dot(norm, lightDir), 0.0);
    float diff2 = max(dot(norm, lightDir2), 0.0) * 0.3;
    
    // Mountain/ground
    if(mountain(p) < 0.01) {
        vec3 rockCol = vec3(0.25, 0.2, 0.18);
        float n = fbm(p * 2.0);
        rockCol = mix(rockCol, vec3(0.35, 0.3, 0.25), n);
        
        // Path is slightly different color
        float pathGlow = smoothstep(6.0, 4.0, abs(p.x));
        rockCol = mix(rockCol, vec3(0.4, 0.35, 0.3), pathGlow * 0.3);
        
        col = rockCol * (0.3 + diff * 0.5 + diff2) * occ;
        
        // Height-based fog
        float heightFog = smoothstep(0.0, 50.0, p.y);
        col = mix(col, col * vec3(0.8, 0.85, 1.0), heightFog * 0.3);
    }
    
    // Spinning bars
    else if(allSpinningBars(p) < 0.01) {
        vec3 metalCol = vec3(0.6, 0.55, 0.5);
        float spec = pow(max(dot(reflect(-lightDir, norm), normalize(camPos - p)), 0.0), 32.0);
        col = metalCol * (0.4 + diff * 0.4) + vec3(spec * 0.3);
        
        // Danger glow
        col += vec3(0.8, 0.2, 0.1) * (0.2 + 0.1 * sin(t * 5.0));
    }
    
    // Boxes
    else if(allBoxes(p) < 0.01) {
        // Weathered stone/wood color
        vec3 boxCol = vec3(0.45, 0.38, 0.32);
        float n = noise(p * 5.0);
        boxCol = mix(boxCol, vec3(0.55, 0.48, 0.4), n);
        
        // Edge highlighting
        float edgeFactor = 1.0 - smoothstep(0.0, 0.1, allBoxes(p + norm * 0.05));
        boxCol += vec3(0.1) * edgeFactor;
        
        col = boxCol * (0.4 + diff * 0.5 + diff2 * 0.2) * occ;
    }
    
    // Floor beams
    else if(allFloorBeams(p) < 0.01) {
        // Dark wood color
        vec3 woodCol = vec3(0.3, 0.22, 0.15);
        float woodGrain = sin(p.x * 20.0 + noise(p * 3.0) * 5.0) * 0.5 + 0.5;
        woodCol = mix(woodCol, vec3(0.4, 0.3, 0.2), woodGrain * 0.3);
        
        col = woodCol * (0.5 + diff * 0.4) * occ;
    }
    
    // Boulder
    else if(boulder(p) < 0.01) {
        vec3 q = p - boulderPos;
        q = boulderRotMat * q;
        
        vec3 stoneCol = vec3(0.5, 0.45, 0.4);
        float n = fbm(q * 0.5);
        stoneCol = mix(stoneCol, vec3(0.6, 0.55, 0.5), n);
        
        col = stoneCol * (0.4 + diff * 0.5 + diff2 * 0.3) * occ;
        
        // Ring grooves glow
        float ringDist = boulderRings(q);
        if(ringDist < 0.5) {
            col += vec3(0.9, 0.7, 0.3) * (0.5 - ringDist) * (0.5 + 0.5 * sin(t * 2.0));
        }
        
        // Glow when being pushed
        col += vec3(0.8, 0.6, 0.2) * isPushing * 0.3;
    }
    
    // Player (Sisyphus)
    else if(player(p) < 0.01) {
        vec3 q = p - playerPos;
        q = rotY(q, -playerAngle.x);
        vec3 bodyP = rotX(q, uBodyAngle.y);
        
        // Skin tone for Sisyphus
        vec3 skinCol = vec3(0.7, 0.55, 0.45);
        
        if(playerHead(bodyP) < 0.01) {
            col = skinCol * (0.5 + diff * 0.4);
            // Eyes
            float eyeR = sdSphere(bodyP - uHeadPos - vec3(0.08, 0.45, 0.12), 0.03);
            float eyeL = sdSphere(bodyP - uHeadPos - vec3(-0.08, 0.45, 0.12), 0.03);
            if(min(eyeR, eyeL) < 0.01) {
                col = vec3(0.1);
            }
        }
        else if(playerBody(bodyP) < 0.01) {
            // Simple cloth/toga
            vec3 clothCol = vec3(0.75, 0.7, 0.6);
            col = clothCol * (0.4 + diff * 0.5);
            
            // Strain effect when pushing
            col = mix(col, vec3(0.8, 0.5, 0.4), isPushing * 0.2);
        }
        else {
            // Legs - skin
            col = skinCol * (0.5 + diff * 0.4);
        }
    }
    
    // Distance fog
    float fog = 1.0 - exp(-totDist * 0.003);
    col = mix(col, skyCol, fog);
    
} else {
    // Sky with stars
    col = stars(dir) + skyCol;
    
    // Subtle gradient
    col += vec3(0.1, 0.05, 0.15) * (1.0 - abs(dir.y));
}

// Boulder glow bloom effect
float glowIntensity = 0.4 / (1.0 + minGlow * minGlow * 0.5);
col += vec3(0.9, 0.7, 0.3) * glowIntensity * 0.15;

// Vignette
vec2 uv = pos4.xy;
float vig = 1.0 - 0.3 * length(uv);
col *= vig;

// Tone mapping
col = col / (1.0 + col);
col = pow(col, vec3(0.9));

color = vec4(col, 1.0);
`,

// Additional functions
`
`,

// Uniforms
`
uniform vec3 uhip1;
uniform vec3 ujr1;
uniform vec3 ujr2;
uniform vec3 ujr3;
uniform vec3 uhip2;
uniform vec3 ujl1;
uniform vec3 ujl2;
uniform vec3 ujl3;
uniform vec3 uChestPos;
uniform vec3 uHeadPos;
uniform float uLift;
uniform vec3 uBodyAngle;
`
);

// Box obstacle positions - must match GLSL!
const boxObstacles = [
    { x: -3.0, z: 15, sx: 1.0, sy: 1.0, sz: 1.0 },
    { x: 2.5, z: 25, sx: 0.75, sy: 0.75, sz: 0.75 },
    { x: -1.5, z: 40, sx: 1.2, sy: 1.2, sz: 0.8 },
    { x: 3.5, z: 55, sx: 0.9, sy: 0.9, sz: 1.1 },
    { x: -4.0, z: 70, sx: 1.5, sy: 1.5, sz: 1.0 },
    { x: 1.0, z: 85, sx: 0.8, sy: 0.8, sz: 0.8 },
    { x: -2.5, z: 100, sx: 1.1, sy: 1.1, sz: 0.9 },
    { x: 4.0, z: 115, sx: 1.3, sy: 1.0, sz: 1.2 },
    { x: 0.5, z: 130, sx: 0.7, sy: 0.7, sz: 0.7 },
    { x: -3.5, z: 140, sx: 1.0, sy: 1.0, sz: 1.0 }
];

// Floor beam positions - must match GLSL!
const floorBeams = [
    { x: 0.0, z: 10, width: 4.0 },
    { x: -1.0, z: 35, width: 3.5 },
    { x: 1.5, z: 52, width: 3.0 },
    { x: 0.0, z: 68, width: 4.5 },
    { x: -0.5, z: 82, width: 3.5 },
    { x: 0.5, z: 98, width: 4.0 },
    { x: -1.0, z: 112, width: 3.0 },
    { x: 0.0, z: 125, width: 5.0 }
];

// JavaScript distance estimation for physics
function de(p) {
    // Simple terrain height check
    const terrainY = getTerrainHeight(p[0], p[2]);
    let ground = p[1] - terrainY;
    
    // Check spinning bars
    const bars = deSpinningBars(p);
    
    // Check boxes
    const boxes = deBoxes(p);
    
    // Check floor beams
    const beams = deFloorBeams(p);
    
    // Check holes
    const holes = deHoles(p);
    
    // Carve holes
    ground = Math.max(ground, -holes);
    
    return Math.min(ground, Math.min(bars, Math.min(boxes, beams)));
}

function deSpinningBars(p) {
    let d = Infinity;
    const barPositions = [
        { z: 30, speed: 1.5, offset: 0 },
        { z: 60, speed: -2.0, offset: 0 },
        { z: 90, speed: 1.2, offset: Math.PI/2 },
        { z: 120, speed: -1.8, offset: Math.PI/4 }
    ];
    
    for (const bar of barPositions) {
        // Use terrain height for bar position
        const h = getTerrainHeight(0, bar.z) + 1.5;
        const barPos = [0, h, bar.z];
        const angle = t * bar.speed + bar.offset;
        
        // Distance to bar
        const q = plus(p, times(barPos, -1));
        const rotated = rotY(q, angle);
        
        // Capsule distance
        const barDist = sdCapsule3D(rotated, [-4, 0, 0], [4, 0, 0], 0.3);
        const poleDist = sdCylinder3D(rotated, 3, 0.2);
        
        d = Math.min(d, Math.min(barDist, poleDist));
    }
    
    return d;
}

function deBoxes(p) {
    let d = Infinity;
    
    for (const box of boxObstacles) {
        const h = getTerrainHeight(box.x, box.z) + box.sy;
        const boxPos = [box.x, h, box.z];
        // Tilted box - rotate point to match slope
        let q = plus(p, times(boxPos, -1));
        q = rotX(q, 0.29); // Match slope angle
        d = Math.min(d, sdBox3D(q, [box.sx, box.sy, box.sz]));
    }
    
    return d;
}

function deFloorBeams(p) {
    let d = Infinity;
    
    for (const beam of floorBeams) {
        const h = getTerrainHeight(beam.x, beam.z) + 0.15;
        const beamPos = [beam.x, h, beam.z];
        // Tilted beam - rotate point to match slope
        let q = plus(p, times(beamPos, -1));
        q = rotX(q, 0.29); // Match slope angle
        d = Math.min(d, sdBox3D(q, [beam.width, 0.15, 0.3]));
    }
    
    return d;
}

function sdBox3D(p, b) {
    const q = [Math.abs(p[0]) - b[0], Math.abs(p[1]) - b[1], Math.abs(p[2]) - b[2]];
    const outside = len([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]);
    const inside = Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0);
    return outside + inside;
}

function deHoles(p) {
    let d = Infinity;
    const holePositions = [
        { x: 2.5, z: 45, radius: 3.0 },
        { x: -2.0, z: 75, radius: 2.5 },
        { x: 1.5, z: 105, radius: 2.0 }
    ];
    
    for (const hole of holePositions) {
        // Use terrain height for hole depth
        const h = getTerrainHeight(hole.x, hole.z) - 5.0;
        const dx = p[0] - hole.x;
        const dz = p[2] - hole.z;
        const dist2D = Math.sqrt(dx*dx + dz*dz) - hole.radius;
        
        if (p[1] < h + 5) {
            d = Math.min(d, Math.max(dist2D, -(p[1] - h)));
        }
    }
    
    return d;
}

function sdCapsule3D(p, a, b, r) {
    const pa = plus(p, times(a, -1));
    const ba = plus(b, times(a, -1));
    const h = clamp(dot(pa, ba) / dot(ba, ba), 0, 1);
    return len(plus(pa, times(ba, -h))) - r;
}

function sdCylinder3D(p, h, r) {
    const d = [len([p[0], p[2]]) - r, Math.abs(p[1]) - h];
    return Math.min(Math.max(d[0], d[1]), 0) + len([Math.max(d[0], 0), Math.max(d[1], 0)]);
}

// Get bar collision info for knockback
function getSpinningBarForce(p) {
    const barPositions = [
        { z: 30, speed: 1.5, offset: 0 },
        { z: 60, speed: -2.0, offset: 0 },
        { z: 90, speed: 1.2, offset: Math.PI/2 },
        { z: 120, speed: -1.8, offset: Math.PI/4 }
    ];
    
    for (const bar of barPositions) {
        // Use terrain height for bar position
        const h = getTerrainHeight(0, bar.z) + 1.5;
        const barPos = [0, h, bar.z];
        const angle = t * bar.speed + bar.offset;
        
        const q = plus(p, times(barPos, -1));
        const rotated = rotY(q, angle);
        const barDist = sdCapsule3D(rotated, [-4, 0, 0], [4, 0, 0], 0.3);
        
        if (barDist < 1.0) {
            // Calculate tangential force direction
            const tangent = rotY([0, 0, 1], angle + Math.PI/2);
            const force = times(tangent, bar.speed * 15);
            force[1] = 10; // Add upward component
            return { hit: true, force };
        }
    }
    
    return { hit: false, force: [0, 0, 0] };
}

// Hole positions for player/boulder falling
const holePositions = [
    { x: 2.5, z: 45, radius: 3.0 },
    { x: -2.0, z: 75, radius: 2.5 },
    { x: 1.5, z: 105, radius: 2.0 }
];

// Check if position is over a hole
function isOverHole(x, z) {
    for (const hole of holePositions) {
        const dx = x - hole.x;
        const dz = z - hole.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < hole.radius) {
            return true;
        }
    }
    return false;
}

// Get info about the hole the position is over
function getHoleInfo(x, z) {
    for (const hole of holePositions) {
        const dx = x - hole.x;
        const dz = z - hole.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < hole.radius * 1.5) {
            return hole;
        }
    }
    return null;
}

