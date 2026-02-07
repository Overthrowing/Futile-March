let renderer = new Renderer(
`
float fbm2(vec2 p) {
    float f = 0.0;
    mat2 m2 = mat2(0.8, -0.6, 0.6, 0.8);
    f += 0.5 * noise(vec3(p, 0.0)); p = m2 * p * 2.02;
    f += 0.25 * noise(vec3(p, 0.0)); p = m2 * p * 2.03;
    f += 0.125 * noise(vec3(p, 0.0)); p = m2 * p * 2.01;
    f += 0.0625 * noise(vec3(p, 0.0));
    return f / 0.9375;
}

float mountainHeight(vec3 p) {
    return max(-5.0, p.z * 0.3 + sin(p.x * 0.1) * 2.0 + sin(p.z * 0.05) * 3.0);
}

float bumpySection(vec3 p) {
    float bumps = 0.0;
    if(p.z > 18.0 && p.z < 30.0 && abs(p.x) < 5.0) {
        float fade = smoothstep(18.0, 20.0, p.z) * smoothstep(30.0, 28.0, p.z);
        bumps += sin(p.x * 3.0) * sin(p.z * 3.0) * 0.15 * fade;
    }
    if(p.z > 48.0 && p.z < 60.0 && abs(p.x) < 5.0) {
        float fade = smoothstep(48.0, 50.0, p.z) * smoothstep(60.0, 58.0, p.z);
        bumps += sin(p.x * 4.0 + 1.0) * sin(p.z * 4.0) * 0.2 * fade;
    }
    if(p.z > 93.0 && p.z < 105.0 && abs(p.x) < 5.0) {
        float fade = smoothstep(93.0, 95.0, p.z) * smoothstep(105.0, 103.0, p.z);
        bumps += sin(p.x * 5.0 + 2.0) * sin(p.z * 5.0) * 0.18 * fade;
    }
    return bumps;
}

float mountain(vec3 p) {
    float h = mountainHeight(p);
    float rocky = fbm(p * 0.15) * 0.3;
    float bumps = bumpySection(p);
    float ground = p.y - h - rocky - bumps;
    
    // Add extra mountains outside the path
    float pathDist = abs(p.x);
    float pathWidth = 6.0, pathDepth = 0.5;
    float pathCarve = smoothstep(pathWidth, pathWidth - 1.0, pathDist) * pathDepth;
    
    // Side mountains - higher terrain outside path (pushed back to avoid clipping)
    float sideMountains = 0.0;
    if(pathDist > 10.0) {
        float sideHeight = 10.0 * fbm2(p.xz * 0.04) + 5.0 * fbm2(p.xz * 0.08);
        sideMountains = -sideHeight * smoothstep(10.0, 20.0, pathDist);
    }
    
    return ground + pathCarve + sideMountains;
}

float spinningBar(vec3 p, vec3 barPos, float barAngle) {
    vec3 q = p - barPos;
    q = rotX(q, 0.29);
    q = rotY(q, barAngle);
    return min(sdCapsule(q, vec3(-4.0, 0.0, 0.0), vec3(4.0, 0.0, 0.0), 0.3), sdCylinder(q, 3.0, 0.2));
}

float floorBeam(vec3 p, vec3 beamPos, float width) {
    vec3 q = rotX(p - beamPos, 0.29);
    return sdBox(q, vec3(width, 0.15, 0.3));
}

float hole(vec3 p, vec3 holePos, float radius) {
    vec2 d = vec2(length(p.xz - holePos.xz) - radius, p.y - holePos.y);
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float boulderRings(vec3 p) {
    float rad = 2.0, ringThickness = 0.2;
    float ring1 = sdTorus(twist(p, 0.2), vec2(rad, ringThickness));
    float ring2 = sdTorus(twist(rotY(p, 1.047), 0.2), vec2(rad, ringThickness));
    float ring3 = sdTorus(twist(rotY(p, 2.094), 0.2), vec2(rad, ringThickness));
    return min(min(ring1, ring2), ring3);
}

float boulder(vec3 p) {
    if(length(p - boulderPos) > 4.0) return sdSphere(p - boulderPos, 2.5);
    vec3 q = boulderRotMat * (p - boulderPos);
    return max(sdSphere(q, 2.5), -boulderRings(q));
}

float boulderSimple(vec3 p) { return sdSphere(p - boulderPos, 2.5); }

float playerHead(vec3 p) {
    p -= uHeadPos;
    float head = sdSphere(p - vec3(0.0, 0.4, 0.0), 0.2);
    float nose = sdSphere(p - vec3(0.0, 0.37, 0.18), 0.08);
    float beard = sdRoundCone(p, vec3(0.0, 0.25, 0.1), vec3(0.0, 0.1, 0.05), 0.12, 0.08);
    return smin(smin(head, nose, 0.1), beard, 0.08);
}

float playerBody(vec3 p) {
    vec3 chestP = p + uChestPos;
    float torso = sdRoundCone(chestP, vec3(0.0, 0.15, 0.0), vec3(0.0, -0.15, -0.1), 0.2, 0.12);
    float pushOffset = isPushing * 0.15;
    float rArm = sdCapsule(chestP, vec3(0.2, 0.1, 0.0), vec3(0.15, 0.1 - pushOffset, 0.2 + pushOffset), 0.05);
    float lArm = sdCapsule(chestP, vec3(-0.2, 0.1, 0.0), vec3(-0.15, 0.1 - pushOffset, 0.2 + pushOffset), 0.05);
    return min(min(torso, rArm), lArm);
}

float playerLegs(vec3 p) {
    float thigh1 = sdCapsule(p, uhip1, ujr1, 0.04);
    float shin1 = sdCapsule(p, ujr1, ujr2, 0.035);
    float foot1 = sdCapsule(p, ujr2, ujr3, 0.03);
    float thigh2 = sdCapsule(p, uhip2, ujl1, 0.04);
    float shin2 = sdCapsule(p, ujl1, ujl2, 0.035);
    float foot2 = sdCapsule(p, ujl2, ujl3, 0.03);
    return min(min(min(thigh1, shin1), min(foot1, thigh2)), min(shin2, foot2));
}

float player(vec3 p) {
    vec3 q = p - playerPos;
    if(length(q) > 1.5) return sdSphere(q, 1.0);
    q = rotY(q, -playerAngle.x);
    vec3 bodyP = rotX(q, uBodyAngle.y);
    return min(min(playerHead(bodyP), playerBody(bodyP)), playerLegs(q));
}

float allSpinningBars(vec3 p) {
    float d = 1000.0;
    d = min(d, spinningBar(p, vec3(0.0, mountainHeight(vec3(0,0,30)) + 1.5, 30.0), t * 1.5));
    d = min(d, spinningBar(p, vec3(0.0, mountainHeight(vec3(0,0,60)) + 1.5, 60.0), -t * 2.0));
    d = min(d, spinningBar(p, vec3(0.0, mountainHeight(vec3(0,0,90)) + 1.5, 90.0), t * 1.2 + 1.57));
    d = min(d, spinningBar(p, vec3(0.0, mountainHeight(vec3(0,0,120)) + 1.5, 120.0), -t * 1.8 + 0.785));
    return d;
}

float allHoles(vec3 p) {
    float d = 1000.0;
    float surfaceExtra = 2.0;
    vec3 h1 = vec3(2.5, mountainHeight(vec3(2.5, 0, 45)) - 5.0, 45.0);
    vec3 h2 = vec3(-2.0, mountainHeight(vec3(-2, 0, 75)) - 5.0, 75.0);
    vec3 h3 = vec3(1.5, mountainHeight(vec3(1.5, 0, 105)) - 5.0, 105.0);
    if(p.y < h1.y + 5.0 + surfaceExtra) d = min(d, max(length(p.xz - h1.xz) - 3.0, -(p.y - h1.y)));
    if(p.y < h2.y + 5.0 + surfaceExtra) d = min(d, max(length(p.xz - h2.xz) - 2.5, -(p.y - h2.y)));
    if(p.y < h3.y + 5.0 + surfaceExtra) d = min(d, max(length(p.xz - h3.xz) - 2.0, -(p.y - h3.y)));
    return d;
}

float tiltedBox(vec3 p, vec3 boxPos, vec3 size) {
    return sdBox(rotX(p - boxPos, 0.29), size);
}

float allBoxes(vec3 p) {
    float d = 1000.0;
    d = min(d, tiltedBox(p, vec3(-3.0, mountainHeight(vec3(-3,0,15)) + 1.0, 15.0), vec3(1.0)));
    d = min(d, tiltedBox(p, vec3(2.5, mountainHeight(vec3(2.5,0,25)) + 0.75, 25.0), vec3(0.75)));
    d = min(d, tiltedBox(p, vec3(-1.5, mountainHeight(vec3(-1.5,0,40)) + 1.2, 40.0), vec3(1.2, 1.2, 0.8)));
    d = min(d, tiltedBox(p, vec3(3.5, mountainHeight(vec3(3.5,0,55)) + 0.9, 55.0), vec3(0.9, 0.9, 1.1)));
    d = min(d, tiltedBox(p, vec3(-4.0, mountainHeight(vec3(-4,0,70)) + 1.5, 70.0), vec3(1.5, 1.5, 1.0)));
    d = min(d, tiltedBox(p, vec3(1.0, mountainHeight(vec3(1,0,85)) + 0.8, 85.0), vec3(0.8)));
    d = min(d, tiltedBox(p, vec3(-2.5, mountainHeight(vec3(-2.5,0,100)) + 1.1, 100.0), vec3(1.1, 1.1, 0.9)));
    d = min(d, tiltedBox(p, vec3(4.0, mountainHeight(vec3(4,0,115)) + 1.3, 115.0), vec3(1.3, 1.0, 1.2)));
    d = min(d, tiltedBox(p, vec3(0.5, mountainHeight(vec3(0.5,0,130)) + 0.7, 130.0), vec3(0.7)));
    d = min(d, tiltedBox(p, vec3(-3.5, mountainHeight(vec3(-3.5,0,140)) + 1.0, 140.0), vec3(1.0)));
    return d;
}

float allFloorBeams(vec3 p) {
    float d = 1000.0;
    d = min(d, floorBeam(p, vec3(0.0, mountainHeight(vec3(0,0,10)) + 0.15, 10.0), 4.0));
    d = min(d, floorBeam(p, vec3(-1.0, mountainHeight(vec3(-1,0,35)) + 0.15, 35.0), 3.5));
    d = min(d, floorBeam(p, vec3(1.5, mountainHeight(vec3(1.5,0,52)) + 0.15, 52.0), 3.0));
    d = min(d, floorBeam(p, vec3(0.0, mountainHeight(vec3(0,0,68)) + 0.15, 68.0), 4.5));
    d = min(d, floorBeam(p, vec3(-0.5, mountainHeight(vec3(-0.5,0,82)) + 0.15, 82.0), 3.5));
    d = min(d, floorBeam(p, vec3(0.5, mountainHeight(vec3(0.5,0,98)) + 0.15, 98.0), 4.0));
    d = min(d, floorBeam(p, vec3(-1.0, mountainHeight(vec3(-1,0,112)) + 0.15, 112.0), 3.0));
    d = min(d, floorBeam(p, vec3(0.0, mountainHeight(vec3(0,0,125)) + 0.15, 125.0), 5.0));
    return d;
}

float boulderGlow(vec3 p) { return boulderSimple(p); }

float de(vec3 p) {
    float ground = max(mountain(p), -allHoles(p));
    float d = min(ground, allSpinningBars(p));
    d = min(d, allBoxes(p));
    d = min(d, allFloorBeams(p));
    d = min(d, boulder(p));
    return min(d, player(p));
}
`,

`
// Sun and lighting setup
vec3 sunDir = normalize(vec3(0.8, 0.4, 0.6));
float sundot = clamp(dot(dir, sunDir), 0.0, 1.0);

// Sky colors - bright daylight
vec3 blueSky = vec3(0.4, 0.65, 0.9);
vec3 warmSky = vec3(0.95, 0.88, 0.75);
vec3 horizonCol = vec3(0.95, 0.85, 0.9);

vec3 col = vec3(0.0);

if(dist <= MIN_DIST) {
    vec3 norm = grad(p);
    float occ = ao(p, norm);
    
    // Main sun light - brighter to match sky
    float diff = max(dot(norm, sunDir), 0.0);
    // Fill light from opposite side
    vec3 fillDir = normalize(vec3(-0.3, 0.5, -0.5));
    float fill = max(dot(norm, fillDir), 0.0) * 0.35;
    // Ambient - brighter base
    float amb = 0.25 + 0.15 * norm.y;
    
    if(mountain(p) < 0.01) {
        // Base rock color with texture variation
        vec3 rockCol = mix(vec3(0.35, 0.3, 0.25), vec3(0.5, 0.45, 0.38), fbm(p * 1.5));
        
        // Path is lighter
        float onPath = smoothstep(6.0, 4.0, abs(p.x));
        rockCol = mix(rockCol, vec3(0.55, 0.5, 0.45), onPath * 0.4);
        
        // Side mountains - multi-colored bands based on height
        float sideFade = smoothstep(10.0, 18.0, abs(p.x));
        if(sideFade > 0.0) {
            // Height with noise variation
            float mountainH = p.y + fbm(p * 0.3) * 3.0;
            float vegNoise = fbm(p * 0.8);
            
            // Grass/forest green colors - varied
            vec3 grassCol = mix(vec3(0.2, 0.35, 0.15), vec3(0.28, 0.42, 0.18), vegNoise);
            vec3 forestCol = mix(vec3(0.15, 0.28, 0.12), vec3(0.22, 0.35, 0.15), fbm(p * 1.2));
            
            // Mid altitude - mix of vegetation and rock
            vec3 midRockCol = mix(vec3(0.4, 0.35, 0.28), vec3(0.48, 0.42, 0.35), fbm(p * 2.0));
            vec3 midGreenCol = mix(vec3(0.25, 0.32, 0.2), vec3(0.3, 0.38, 0.22), vegNoise);
            
            // High altitude - grey rock with alpine vegetation patches
            vec3 highCol = vec3(0.5, 0.5, 0.52);
            vec3 alpineGreen = vec3(0.22, 0.3, 0.2);
            
            // Peak - snow caps
            vec3 snowCol = vec3(0.95, 0.97, 1.0);
            
            // Start with low vegetation (dense forest/grass)
            vec3 sideCol = mix(forestCol, grassCol, smoothstep(0.0, 10.0, mountainH));
            
            // Mid altitude: patches of green mixed with rock (tree line)
            float midVegAmount = (0.5 + 0.5 * sin(p.x * 2.0 + vegNoise * 6.0)) * smoothstep(25.0, 15.0, mountainH);
            vec3 midBlend = mix(midRockCol, midGreenCol, midVegAmount * 0.7);
            sideCol = mix(sideCol, midBlend, smoothstep(8.0, 20.0, mountainH));
            
            // High altitude: rock with sparse alpine patches
            float alpinePatches = smoothstep(0.55, 0.65, vegNoise) * smoothstep(40.0, 28.0, mountainH);
            vec3 highBlend = mix(highCol, alpineGreen, alpinePatches * 0.4);
            sideCol = mix(sideCol, highBlend, smoothstep(22.0, 35.0, mountainH));
            
            // Snow on peaks - based on height and upward-facing surfaces
            float snowAmount = smoothstep(32.0, 48.0, mountainH);
            snowAmount *= pow(max(dot(norm, vec3(0.0, 1.0, 0.0)), 0.0), 1.5);
            snowAmount += smoothstep(42.0, 58.0, mountainH) * 0.6;
            sideCol = mix(sideCol, snowCol, clamp(snowAmount, 0.0, 1.0));
            
            rockCol = mix(rockCol, sideCol, sideFade);
        }
        
        col = rockCol * (amb + diff * 0.7 + fill) * occ;
        
        // Height-based atmospheric tint
        col = mix(col, col * vec3(0.9, 0.95, 1.05), smoothstep(0.0, 60.0, p.y) * 0.25);
    }
    else if(allSpinningBars(p) < 0.01) {
        vec3 metalCol = vec3(0.7, 0.65, 0.6);
        float spec = pow(max(dot(reflect(-sunDir, norm), normalize(camPos - p)), 0.0), 32.0);
        col = metalCol * (amb + diff * 0.6) + vec3(1.0, 0.95, 0.9) * spec * 0.5;
        col += vec3(0.95, 0.35, 0.15) * (0.12 + 0.08 * sin(t * 5.0));
    }
    else if(allBoxes(p) < 0.01) {
        // Wooden crate appearance
        vec3 woodBase = vec3(0.55, 0.35, 0.18);
        vec3 woodLight = vec3(0.72, 0.52, 0.28);
        vec3 woodDark = vec3(0.35, 0.22, 0.1);
        
        // Wood grain along planks
        float grain = sin(p.y * 40.0 + noise(p * 8.0) * 8.0) * 0.5 + 0.5;
        grain *= sin(p.x * 3.0 + p.z * 3.0 + noise(p * 2.0) * 2.0) * 0.3 + 0.7;
        vec3 crateCol = mix(woodBase, woodLight, grain * 0.4);
        
        // Plank lines - horizontal and vertical slats
        float plankX = abs(fract(p.x * 1.5) - 0.5);
        float plankY = abs(fract(p.y * 1.5) - 0.5);
        float plankZ = abs(fract(p.z * 1.5) - 0.5);
        float planks = min(min(plankX, plankY), plankZ);
        float plankEdge = smoothstep(0.02, 0.06, planks);
        crateCol = mix(woodDark, crateCol, plankEdge);
        
        // Darker gaps between planks
        float gaps = smoothstep(0.0, 0.015, planks);
        crateCol *= 0.6 + 0.4 * gaps;
        
        // Edge darkening for 3D depth
        float edgeDist = allBoxes(p + norm * 0.08);
        float edgeDarken = smoothstep(0.0, 0.12, edgeDist);
        crateCol = mix(woodDark * 0.7, crateCol, edgeDarken);
        
        // Subtle weathering/wear
        crateCol *= 0.85 + 0.15 * noise(p * 12.0);
        
        col = crateCol * (amb + diff * 0.65 + fill) * occ;
    }
    else if(allFloorBeams(p) < 0.01) {
        vec3 woodCol = vec3(0.38, 0.28, 0.18);
        woodCol = mix(woodCol, vec3(0.5, 0.38, 0.26), (sin(p.x * 20.0 + noise(p * 3.0) * 5.0) * 0.5 + 0.5) * 0.3);
        col = woodCol * (amb + diff * 0.55) * occ;
    }
    else if(boulder(p) < 0.01) {
        vec3 q = boulderRotMat * (p - boulderPos);
        
        // Gray stone base colors
        vec3 grayBase = vec3(0.45, 0.45, 0.47);
        vec3 grayLight = vec3(0.58, 0.58, 0.6);
        vec3 grayDark = vec3(0.32, 0.32, 0.34);
        
        // Bumpy surface texture using layered noise
        float bumpNoise = fbm(q * 2.0) * 0.6 + noise(q * 5.0) * 0.25 + noise(q * 12.0) * 0.15;
        vec3 stoneCol = mix(grayDark, grayLight, bumpNoise);
        
        // Add some subtle color variation (slight blue/brown tints)
        float colorVar = noise(q * 1.5);
        stoneCol = mix(stoneCol, stoneCol * vec3(0.95, 0.95, 1.02), colorVar * 0.3);
        stoneCol = mix(stoneCol, stoneCol * vec3(1.02, 0.98, 0.95), (1.0 - colorVar) * 0.2);
        
        // Cracks and crevices
        float cracks = smoothstep(0.48, 0.52, noise(q * 8.0));
        stoneCol = mix(stoneCol, grayDark * 0.7, cracks * 0.3);
        
        col = stoneCol * (amb + diff * 0.6 + fill * 0.4) * occ;
        
        // Golden ring grooves (slightly dimmer to match gray)
        float ringDist = boulderRings(q);
        if(ringDist < 0.5) col += vec3(0.9, 0.75, 0.35) * (0.5 - ringDist) * (0.5 + 0.5 * sin(t * 2.0));
        col += vec3(0.85, 0.7, 0.3) * isPushing * 0.18;
    }
    else if(player(p) < 0.01) {
        vec3 q = rotY(p - playerPos, -playerAngle.x);
        vec3 bodyP = rotX(q, uBodyAngle.y);
        vec3 skinCol = vec3(0.78, 0.62, 0.52);
        if(playerHead(bodyP) < 0.01) {
            col = skinCol * (amb + diff * 0.5);
            float eyeR = sdSphere(bodyP - uHeadPos - vec3(0.08, 0.45, 0.12), 0.03);
            float eyeL = sdSphere(bodyP - uHeadPos - vec3(-0.08, 0.45, 0.12), 0.03);
            if(min(eyeR, eyeL) < 0.01) col = vec3(0.1);
        }
        else if(playerBody(bodyP) < 0.01) {
            vec3 clothCol = vec3(0.82, 0.76, 0.66);
            col = mix(clothCol * (amb + diff * 0.55), vec3(0.88, 0.6, 0.5), isPushing * 0.12);
        }
        else col = skinCol * (amb + diff * 0.5);
    }
    
    // Fog - blends toward bright sky/sun color
    float fo = 1.0 - exp(-totDist * 0.006);
    vec3 fogCol = mix(blueSky, warmSky, pow(sundot, 4.0));
    col = mix(col, fogCol, fo);
    
} else {
    // Sky gradient
    vec3 sky = mix(blueSky, warmSky, 1.5 * pow(sundot, 8.0));
    col = sky * (1.0 - 0.7 * dir.y);
    
    // Enhanced stars - layered noise-based approach like reference shader
    float starVisibility = pow(1.0 - max(sundot, 0.0), 2.0) * max(dir.y, 0.0);
    if(starVisibility > 0.01) {
        // Multiple layers of stars at different scales
        float s1 = noise(vec3(dir.xz * 80.0, 0.0));
        float s2 = noise(vec3(dir.xz * 160.0, 1.0));
        float s3 = noise(vec3(dir.xz * 320.0, 2.0));
        
        // Sharp star points using high power
        float starField = pow(s1, 18.0) * 0.8 + pow(s2, 20.0) * 0.5 + pow(s3, 22.0) * 0.3;
        
        // Color variation - some stars warmer, some cooler
        float starHue = noise(vec3(dir.xz * 40.0, 3.0));
        vec3 starCol = mix(vec3(0.8, 0.85, 1.0), vec3(1.0, 0.95, 0.8), starHue);
        
        // Twinkling effect
        float twinkle = 0.7 + 0.3 * sin(t * 3.0 + s1 * 50.0);
        
        col += starCol * starField * starVisibility * twinkle * 0.15;
    }
    
    // Also keep original star hash for variety
    col += stars(dir) * starVisibility * 0.3;
    
    // Sun glow
    col += vec3(1.0, 0.9, 0.7) * 0.15 * pow(sundot, 2.0);
    col += vec3(1.0, 0.95, 0.85) * 0.25 * pow(sundot, 8.0);
    col += vec3(1.0, 1.0, 0.95) * pow(sundot, 256.0);
    
    // Clouds
    float cloudSpeed = 0.008;
    vec2 cloudUV = dir.xz / (dir.y + 0.3) * 15.0 + t * cloudSpeed * 20.0;
    float cloud1 = fbm2(cloudUV * 0.05 + fbm2(cloudUV * 0.03));
    float cloud2 = fbm2(cloudUV * 0.08 + 10.0);
    float clouds = smoothstep(0.45, 0.75, cloud1) * 0.6 + smoothstep(0.5, 0.8, cloud2) * 0.3;
    
    vec3 cloudCol = mix(vec3(1.0, 0.98, 0.95), warmSky * 0.9, pow(sundot, 2.0));
    col = mix(col, cloudCol, clouds * max(dir.y, 0.0));
    
    // Horizon glow
    col = mix(col, horizonCol * 0.95, pow(1.0 - max(dir.y + 0.1, 0.0), 8.0));
}

// Boulder glow bloom
float glowIntensity = 0.35 / (1.0 + minGlow * minGlow * 0.5);
col += vec3(0.95, 0.75, 0.35) * glowIntensity * 0.12;

// Contrast enhancement
col = clamp(col, 0.0, 1.0);
col = col * col * (3.0 - 2.0 * col);

// Slight saturation boost
float sat = 0.15;
col = col * (1.0 + sat) - sat * dot(col, vec3(0.33));

// Vignette
col *= 1.0 - 0.25 * dot(pos4.xy, pos4.xy);

// Tone mapping
col = pow(col / (1.0 + col * 0.5), vec3(0.95));

color = vec4(col, 1.0);
`,

``,

`
uniform vec3 uhip1; uniform vec3 ujr1; uniform vec3 ujr2; uniform vec3 ujr3;
uniform vec3 uhip2; uniform vec3 ujl1; uniform vec3 ujl2; uniform vec3 ujl3;
uniform vec3 uChestPos; uniform vec3 uHeadPos; uniform float uLift; uniform vec3 uBodyAngle;
`
);

const boxObstacles = [
    { x: -3.0, z: 15, sx: 1.0, sy: 1.0, sz: 1.0 }, { x: 2.5, z: 25, sx: 0.75, sy: 0.75, sz: 0.75 },
    { x: -1.5, z: 40, sx: 1.2, sy: 1.2, sz: 0.8 }, { x: 3.5, z: 55, sx: 0.9, sy: 0.9, sz: 1.1 },
    { x: -4.0, z: 70, sx: 1.5, sy: 1.5, sz: 1.0 }, { x: 1.0, z: 85, sx: 0.8, sy: 0.8, sz: 0.8 },
    { x: -2.5, z: 100, sx: 1.1, sy: 1.1, sz: 0.9 }, { x: 4.0, z: 115, sx: 1.3, sy: 1.0, sz: 1.2 },
    { x: 0.5, z: 130, sx: 0.7, sy: 0.7, sz: 0.7 }, { x: -3.5, z: 140, sx: 1.0, sy: 1.0, sz: 1.0 }
];

const floorBeams = [
    { x: 0.0, z: 10, width: 4.0 }, { x: -1.0, z: 35, width: 3.5 }, { x: 1.5, z: 52, width: 3.0 },
    { x: 0.0, z: 68, width: 4.5 }, { x: -0.5, z: 82, width: 3.5 }, { x: 0.5, z: 98, width: 4.0 },
    { x: -1.0, z: 112, width: 3.0 }, { x: 0.0, z: 125, width: 5.0 }
];

const barPositions = [
    { z: 30, speed: 1.5, offset: 0 }, { z: 60, speed: -2.0, offset: 0 },
    { z: 90, speed: 1.2, offset: Math.PI/2 }, { z: 120, speed: -1.8, offset: Math.PI/4 }
];

const holePositions = [
    { x: 2.5, z: 45, radius: 3.0 }, { x: -2.0, z: 75, radius: 2.5 }, { x: 1.5, z: 105, radius: 2.0 }
];

function de(p) {
    const terrainY = getTerrainHeight(p[0], p[2]);
    let ground = Math.max(p[1] - terrainY, -deHoles(p));
    return Math.min(ground, Math.min(deSpinningBars(p), Math.min(deBoxes(p), deFloorBeams(p))));
}

function deSpinningBars(p) {
    let d = Infinity;
    for (const bar of barPositions) {
        const h = getTerrainHeight(0, bar.z) + 1.5;
        const angle = t * bar.speed + bar.offset;
        const rotated = rotY(plus(p, [0, -h, -bar.z]), angle);
        d = Math.min(d, Math.min(sdCapsule3D(rotated, [-4,0,0], [4,0,0], 0.3), sdCylinder3D(rotated, 3, 0.2)));
    }
    return d;
}

function deBoxes(p) {
    let d = Infinity;
    for (const box of boxObstacles) {
        const h = getTerrainHeight(box.x, box.z) + box.sy;
        d = Math.min(d, sdBox3D(rotX(plus(p, [-box.x, -h, -box.z]), 0.29), [box.sx, box.sy, box.sz]));
    }
    return d;
}

function deFloorBeams(p) {
    let d = Infinity;
    for (const beam of floorBeams) {
        const h = getTerrainHeight(beam.x, beam.z) + 0.15;
        d = Math.min(d, sdBox3D(rotX(plus(p, [-beam.x, -h, -beam.z]), 0.29), [beam.width, 0.15, 0.3]));
    }
    return d;
}

function sdBox3D(p, b) {
    const q = [Math.abs(p[0]) - b[0], Math.abs(p[1]) - b[1], Math.abs(p[2]) - b[2]];
    return len([Math.max(q[0], 0), Math.max(q[1], 0), Math.max(q[2], 0)]) + Math.min(Math.max(q[0], Math.max(q[1], q[2])), 0);
}

function deHoles(p) {
    let d = Infinity;
    for (const hole of holePositions) {
        const h = getTerrainHeight(hole.x, hole.z) - 5.0;
        const dist2D = Math.sqrt((p[0]-hole.x)**2 + (p[2]-hole.z)**2) - hole.radius;
        if (p[1] < h + 7) d = Math.min(d, Math.max(dist2D, -(p[1] - h)));
    }
    return d;
}

function sdCapsule3D(p, a, b, r) {
    const pa = plus(p, times(a, -1)), ba = plus(b, times(a, -1));
    return len(plus(pa, times(ba, -clamp(dot(pa, ba) / dot(ba, ba), 0, 1)))) - r;
}

function sdCylinder3D(p, h, r) {
    const d = [len([p[0], p[2]]) - r, Math.abs(p[1]) - h];
    return Math.min(Math.max(d[0], d[1]), 0) + len([Math.max(d[0], 0), Math.max(d[1], 0)]);
}

function getSpinningBarForce(p) {
    for (const bar of barPositions) {
        const h = getTerrainHeight(0, bar.z) + 1.5;
        const angle = t * bar.speed + bar.offset;
        const rotated = rotY(plus(p, [0, -h, -bar.z]), angle);
        if (sdCapsule3D(rotated, [-4,0,0], [4,0,0], 0.3) < 1.0) {
            const tangent = rotY([0, 0, 1], angle + Math.PI/2);
            return { hit: true, force: [tangent[0] * bar.speed * 15, 10, tangent[2] * bar.speed * 15] };
        }
    }
    return { hit: false, force: [0, 0, 0] };
}

function isOverHole(x, z) {
    for (const hole of holePositions) {
        if (Math.sqrt((x-hole.x)**2 + (z-hole.z)**2) < hole.radius) return true;
    }
    return false;
}

function getHoleInfo(x, z) {
    for (const hole of holePositions) {
        if (Math.sqrt((x-hole.x)**2 + (z-hole.z)**2) < hole.radius * 1.5) return hole;
    }
    return null;
}
