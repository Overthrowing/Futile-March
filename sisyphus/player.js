let mouseDown = [];
let keyDown = [];
let keyPressed = [];

document.onmousemove = (e) => {
    if (document.pointerLockElement) {
        let sens = [1/700, 1/700];
        player.angle[0] += e.movementX * sens[0];
        player.angle[1] -= e.movementY * sens[1];
        player.angle[1] = clamp(player.angle[1], -Math.PI/2.5, Math.PI/2.5);
    }
};

document.onmousedown = (e) => mouseDown[e.button] = true;
document.onmouseup = (e) => mouseDown[e.button] = false;
document.onkeydown = (e) => {
    keyDown[e.key.toLowerCase()] = true;
    keyPressed[e.key.toLowerCase()] = true;
};
document.onkeyup = (e) => keyDown[e.key.toLowerCase()] = false;

function Player() {
    this.pos = [0, 2, -10];
    this.camPos = [0, 0, 0];
    this.angle = [0, 0];
    this.bodyAngle = [0, 0];
    
    this.gravity = 40;
    this.jumpVel = 12;
    this.speed = 5;
    this.pushSpeed = 3;
    
    this.velocity = [0, 0, 0];
    this.body2 = 0.5;
    
    this.isPushing = false;
    this.pushCooldown = 0;
    
    this.coyoteTime = 0;
    
    this.update = () => {
        this.checkSpinningBars();
        this.move();
        this.push();
        
        if (this.legAnimator) {
            this.legAnimator.update();
        }
        this.updateUniforms();
    };
    
    this.checkSpinningBars = () => {
        const barResult = getSpinningBarForce(this.pos);
        if (barResult.hit) {
            this.velocity = plus(this.velocity, barResult.force);
            showMessage("Knocked off!", 1500);
        }
    };
    
    this.move = () => {
        let vel = [0, 0, 0];
        let moveSpeed = this.isPushing ? this.pushSpeed : this.speed;
        
        if (keyDown["w"]) {
            vel[2] += Math.cos(this.angle[0]);
            vel[0] += Math.sin(this.angle[0]);
        }
        if (keyDown["s"]) {
            vel[2] -= Math.cos(this.angle[0]);
            vel[0] -= Math.sin(this.angle[0]);
        }
        if (keyDown["a"]) {
            vel[2] += Math.sin(this.angle[0]);
            vel[0] -= Math.cos(this.angle[0]);
        }
        if (keyDown["d"]) {
            vel[2] -= Math.sin(this.angle[0]);
            vel[0] += Math.cos(this.angle[0]);
        }
        
        // Update body angle to face movement direction
        if (len(vel) > 0) {
            const targetAngle = Math.atan2(vel[0], vel[2]);
            this.bodyAngle[0] = lerpAngle(this.bodyAngle[0], targetAngle, 0.1);
            renderer.setUni("playerAngle", [this.bodyAngle[0], 0]);
        }
        
        // Animation states
        if (!this.onGround()) {
            if (this.velocity[1] > 5) {
                this.legAnimator && this.legAnimator.setState(2, 0.1);
            } else {
                this.legAnimator && this.legAnimator.setState(3, 1);
            }
        } else {
            if (len(vel) > 0) {
                this.legAnimator && this.legAnimator.setState(0, 0.1);
            } else {
                this.legAnimator && this.legAnimator.setState(1, 0.2);
            }
        }
        
        // Normalize and apply speed
        if (len(vel) > 0) {
            vel = times(normalize(vel), moveSpeed * dt);
        }
        
        // Coyote time for jumping
        this.coyoteTime -= dt;
        if (this.onGround()) {
            this.coyoteTime = 0.15;
            this.velocity[0] *= 0.9;
            this.velocity[2] *= 0.9;
        }
        
        // Jump
        if (keyPressed[" "] && this.coyoteTime > 0) {
            this.velocity[1] = this.jumpVel;
            this.coyoteTime = -1;
        }
        
        // Apply gravity
        this.velocity[1] -= this.gravity * dt;
        
        // Combine movement velocity
        vel = plus(times(this.velocity, dt), vel);
        this.pos = plus(vel, this.pos);
        
        // Check if player is over a hole
        const overHole = isOverHole(this.pos[0], this.pos[2]);
        
        // Ground collision - but allow falling into holes
        const terrainY = getTerrainHeight(this.pos[0], this.pos[2]);
        const groundLevel = terrainY + this.body2;
        
        if (!overHole && this.pos[1] < groundLevel) {
            this.pos[1] = groundLevel;
            if (this.velocity[1] < 0) {
                this.velocity[1] = 0;
            }
        }
        
        // If over hole, apply extra gravity pull
        if (overHole) {
            const holeInfo = getHoleInfo(this.pos[0], this.pos[2]);
            if (holeInfo) {
                // Pull towards hole center
                const dx = holeInfo.x - this.pos[0];
                const dz = holeInfo.z - this.pos[2];
                const pullStrength = 3.0;
                this.velocity[0] += dx * pullStrength * dt;
                this.velocity[2] += dz * pullStrength * dt;
            }
        }
        
        // Spinning bar collision (handled separately)
        const barDist = deSpinningBars(this.pos);
        if (barDist < this.body2) {
            // Push away from bar
            const pushDir = deNormal(this.pos);
            this.pos = plus(this.pos, times(pushDir, this.body2 - barDist));
        }
        
        // Box collision
        const boxDist = deBoxes(this.pos);
        if (boxDist < this.body2) {
            // Find push direction from box
            const eps = 0.05;
            const boxNorm = normalize([
                deBoxes(plus(this.pos, [eps, 0, 0])) - deBoxes(plus(this.pos, [-eps, 0, 0])),
                deBoxes(plus(this.pos, [0, eps, 0])) - deBoxes(plus(this.pos, [0, -eps, 0])),
                deBoxes(plus(this.pos, [0, 0, eps])) - deBoxes(plus(this.pos, [0, 0, -eps]))
            ]);
            this.pos = plus(this.pos, times(boxNorm, this.body2 - boxDist));
            // Stop velocity into the box
            const velDot = dot(this.velocity, boxNorm);
            if (velDot < 0) {
                this.velocity = plus(this.velocity, times(boxNorm, -velDot));
            }
        }
        
        // Floor beam collision - can step over small beams
        const beamDist = deFloorBeams(this.pos);
        if (beamDist < this.body2) {
            // Push up and over the beam
            this.pos[1] = Math.max(this.pos[1], getTerrainHeight(this.pos[0], this.pos[2]) + 0.3 + this.body2);
        }
        
        // Boulder collision - prevent clipping through the ball
        const toBoulder = plus(this.pos, times(boulder.pos, -1));
        const distToBoulder = len(toBoulder);
        const minDist = this.body2 + boulder.size;
        
        if (distToBoulder < minDist && distToBoulder > 0.01) {
            // Push player out of boulder
            const pushDir = normalize(toBoulder);
            const overlap = minDist - distToBoulder;
            this.pos = plus(this.pos, times(pushDir, overlap));
            
            // Stop velocity into boulder
            const velIntoBoulder = dot(this.velocity, times(pushDir, -1));
            if (velIntoBoulder > 0) {
                this.velocity = plus(this.velocity, times(pushDir, velIntoBoulder));
            }
        }
        
        // Keep player on path (soft boundary)
        const pathWidth = 6.5;
        if (Math.abs(this.pos[0]) > pathWidth) {
            this.pos[0] = Math.sign(this.pos[0]) * pathWidth;
            this.velocity[0] *= -0.5;
        }
        
        // Fell into hole check
        if (this.pos[1] < terrainY - 8) {
            triggerRestart("Fell into the abyss!");
        }
    };
    
    this.push = () => {
        this.pushCooldown -= dt;
        
        // Check if near boulder and moving towards it
        const toBoulder = plus(boulder.pos, times(this.pos, -1));
        const distToBoulder = len(toBoulder);
        
        // Direction player is moving
        const moveDir = dirFromAngle(this.angle[0], 0);
        const dotProduct = dot(normalize(toBoulder), moveDir);
        
        // Can push if close, moving towards boulder, and pressing forward
        const canPush = distToBoulder < 4.5 && 
                        distToBoulder > 2.0 && 
                        dotProduct > 0.5 && 
                        keyDown["w"] &&
                        this.onGround();
        
        if (canPush && this.pushCooldown <= 0) {
            this.isPushing = true;
            
            // Apply push force to boulder
            const pushDir = normalize([toBoulder[0], 0, toBoulder[2]]);
            const pushForce = 3.0;
            boulder.applyPush(times(pushDir, pushForce));
            
            // Lean forward while pushing
            renderer.setUni("uBodyAngle", [0, 0.3, 0]);
        } else {
            this.isPushing = false;
            renderer.setUni("uBodyAngle", [0, 0, 0]);
        }
        
        renderer.setUni("isPushing", this.isPushing ? 1.0 : 0.0);
    };
    
    this.onGround = () => {
        // Can't be on ground if over a hole
        if (isOverHole(this.pos[0], this.pos[2])) {
            return false;
        }
        const terrainY = getTerrainHeight(this.pos[0], this.pos[2]);
        return this.pos[1] <= terrainY + this.body2 + 0.1;
    };
    
    this.updateUniforms = () => {
        renderer.setUni("playerPos", this.pos);
        renderer.setUni("camAngle", this.angle);
        
        // Third person camera behind player
        let camDir = [0, 0, -6];
        camDir = rotX(camDir, -this.angle[1]);
        camDir = rotY(camDir, this.angle[0]);
        
        let camPos = plus(plus(this.pos, [0, 1.5, 0]), camDir);
        
        // Camera collision
        let iterations = 50;
        while (de(camPos) < 0.8 && iterations > 0) {
            iterations--;
            camPos = plus(camPos, times(normalize(camDir), -0.1));
        }
        
        renderer.setUni("camPos", camPos);
        this.camPos = camPos;
    };
    
    this.reset = (z) => {
        const terrainY = getTerrainHeight(0, z);
        this.pos = [0, terrainY + 2, z];
        this.velocity = [0, 0, 0];
        this.isPushing = false;
    };
    
    this.createAnimators = () => {
        const legUnis = [
            "uhip1", "ujr1", "ujr2", "ujr3",
            "uhip2", "ujl1", "ujl2", "ujl3",
            "uHeadPos", "uChestPos", "uBodyAngle"
        ];
        
        const legUniValues = [
            // Walking frame 1
            [
                [0.1, -0.1, -0.12],
                [0.15, -0.2, 0.15],
                [0.13, -0.35, 0.0],
                [0.13, -0.46, 0.15],
                [-0.1, -0.1, -0.12],
                [-0.15, -0.28, -0.05],
                [-0.13, -0.3, -0.2],
                [-0.13, -0.46, -0.15],
                [0, 0, 0],
                [0, 0, 0],
                [0, -0.3, 0],
                1.2
            ],
            // Idle
            [
                [0.1, -0.1, -0.12],
                [0.15, -0.26, 0.05],
                [0.13, -0.35, -0.15],
                [0.13, -0.46, 0],
                [-0.1, -0.1, -0.12],
                [-0.15, -0.26, 0.05],
                [-0.13, -0.35, -0.15],
                [-0.13, -0.46, 0],
                [0, 0, 0],
                [0, 0, 0],
                [0, 0, 0],
                1.2
            ],
            // Jump up
            [
                [0.1, -0.1, -0.12],
                [0.15, -0.18, 0.05],
                [0.13, -0.25, -0.15],
                [0.13, -0.35, 0],
                [-0.1, -0.1, -0.12],
                [-0.15, -0.18, 0.05],
                [-0.13, -0.25, -0.15],
                [-0.13, -0.35, 0],
                [0, 0, 0],
                [0, 0, 0],
                [0, -0.2, 0],
                1.2
            ],
            // Falling
            [
                [0.1, -0.1, -0.12],
                [0.15, -0.13, 0.05],
                [0.13, -0.2, -0.15],
                [0.13, -0.3, 0],
                [-0.1, -0.1, -0.12],
                [-0.15, -0.13, 0.05],
                [-0.13, -0.2, -0.15],
                [-0.13, -0.3, 0],
                [0, 0, 0],
                [0, 0, 0],
                [0, -0.2, 0],
                1.2
            ],
            // Walking frame 2
            [
                [0.1, -0.1, -0.12],
                [0.15, -0.28, -0.05],
                [0.13, -0.3, -0.2],
                [0.13, -0.46, -0.15],
                [-0.1, -0.1, -0.12],
                [-0.15, -0.2, 0.15],
                [-0.13, -0.35, 0.0],
                [-0.13, -0.46, 0.15],
                [0, 0, 0],
                [0, 0, 0],
                [0, -0.3, 0],
                1.2
            ]
        ];
        
        for (let i in legUnis) {
            renderer.addUniform(legUnis[i], "vec3", legUniValues[1][i]);
        }
        renderer.addUniform("uLift", "float", 1.2);
        
        this.legAnimator = new Animator([...legUnis, "uLift"], sinLerp);
        
        const stepTime = 0.3;
        this.legAnimator.addKeyFrame(legUniValues[0], 0, 0);
        this.legAnimator.addKeyFrame(legUniValues[4], stepTime/2, 0);
        this.legAnimator.addKeyFrame(legUniValues[0], stepTime, 0);
        
        this.legAnimator.addKeyFrame(legUniValues[1], 0, 1);
        this.legAnimator.addKeyFrame(legUniValues[2], 0, 2);
        this.legAnimator.addKeyFrame(legUniValues[3], 0, 3);
    };
    
    this.createAnimators();
}

function lerpAngle(a, b, w) {
    a = a % (2 * Math.PI);
    b = b % (2 * Math.PI);
    if (Math.abs(b - a) < Math.PI) {
        return lerp(a, b, w);
    } else {
        a += Math.sign(b - a) * 2 * Math.PI;
        return lerp(a, b, w);
    }
}

let player = new Player();

