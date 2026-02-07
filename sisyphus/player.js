let mouseDown = [], keyDown = [], keyPressed = [];

document.onmousemove = (e) => {
    if (document.pointerLockElement) {
        player.angle[0] += e.movementX / 700;
        player.angle[1] = clamp(player.angle[1] - e.movementY / 700, -Math.PI/2.5, Math.PI/2.5);
    }
};

document.onmousedown = (e) => mouseDown[e.button] = true;
document.onmouseup = (e) => mouseDown[e.button] = false;
document.onkeydown = (e) => { keyDown[e.key.toLowerCase()] = keyPressed[e.key.toLowerCase()] = true; };
document.onkeyup = (e) => keyDown[e.key.toLowerCase()] = false;

function lerpAngle(a, b, w) {
    a = a % (2 * Math.PI);
    b = b % (2 * Math.PI);
    if (Math.abs(b - a) >= Math.PI) a += Math.sign(b - a) * 2 * Math.PI;
    return lerp(a, b, w);
}

function Player() {
    this.pos = [0, 2, -10];
    this.camPos = [0, 0, 0];
    this.angle = [0, 0];
    this.bodyAngle = [0, 0];
    this.velocity = [0, 0, 0];
    this.body2 = 0.5;
    this.gravity = 40;
    this.jumpVel = 12;
    this.speed = 5;
    this.pushSpeed = 3;
    this.isPushing = false;
    this.pushCooldown = 0;
    this.coyoteTime = 0;
    
    this.update = () => {
        this.checkSpinningBars();
        this.move();
        this.push();
        if (this.legAnimator) this.legAnimator.update();
        this.updateUniforms();
    };
    
    this.checkSpinningBars = () => {
        const result = getSpinningBarForce(this.pos);
        if (result.hit) {
            this.velocity = plus(this.velocity, result.force);
            showMessage("Knocked off!", 1500);
        }
    };
    
    this.move = () => {
        let vel = [0, 0, 0];
        const moveSpeed = this.isPushing ? this.pushSpeed : this.speed;
        const ca = Math.cos(this.angle[0]), sa = Math.sin(this.angle[0]);
        
        if (keyDown["w"]) { vel[2] += ca; vel[0] += sa; }
        if (keyDown["s"]) { vel[2] -= ca; vel[0] -= sa; }
        if (keyDown["a"]) { vel[2] += sa; vel[0] -= ca; }
        if (keyDown["d"]) { vel[2] -= sa; vel[0] += ca; }
        
        if (len(vel) > 0) {
            this.bodyAngle[0] = lerpAngle(this.bodyAngle[0], Math.atan2(vel[0], vel[2]), 0.1);
            renderer.setUni("playerAngle", [this.bodyAngle[0], 0]);
        }
        
        if (this.legAnimator) {
            if (!this.onGround()) {
                this.legAnimator.setState(this.velocity[1] > 5 ? 2 : 3, this.velocity[1] > 5 ? 0.1 : 1);
            } else {
                this.legAnimator.setState(len(vel) > 0 ? 0 : 1, len(vel) > 0 ? 0.1 : 0.2);
            }
        }
        
        if (len(vel) > 0) vel = times(normalize(vel), moveSpeed * dt);
        
        this.coyoteTime -= dt;
        if (this.onGround()) {
            this.coyoteTime = 0.15;
            this.velocity[0] *= 0.9;
            this.velocity[2] *= 0.9;
        }
        
        if (keyPressed[" "] && this.coyoteTime > 0) {
            this.velocity[1] = this.jumpVel;
            this.coyoteTime = -1;
        }
        
        this.velocity[1] -= this.gravity * dt;
        this.pos = plus(plus(this.pos, times(this.velocity, dt)), vel);
        
        const overHole = isOverHole(this.pos[0], this.pos[2]);
        const terrainY = getTerrainHeight(this.pos[0], this.pos[2]);
        const groundLevel = terrainY + this.body2;
        
        if (!overHole && this.pos[1] < groundLevel) {
            this.pos[1] = groundLevel;
            if (this.velocity[1] < 0) this.velocity[1] = 0;
        }
        
        if (overHole) {
            const holeInfo = getHoleInfo(this.pos[0], this.pos[2]);
            if (holeInfo) {
                this.velocity[0] += (holeInfo.x - this.pos[0]) * 3.0 * dt;
                this.velocity[2] += (holeInfo.z - this.pos[2]) * 3.0 * dt;
            }
        }
        
        const barDist = deSpinningBars(this.pos);
        if (barDist < this.body2) {
            this.pos = plus(this.pos, times(deNormal(this.pos), this.body2 - barDist));
        }
        
        this.handleCollision(deBoxes, this.body2, false);
        
        const beamDist = deFloorBeams(this.pos);
        if (beamDist < this.body2) {
            this.pos[1] = Math.max(this.pos[1], getTerrainHeight(this.pos[0], this.pos[2]) + 0.3 + this.body2);
        }
        
        const toBoulder = plus(this.pos, times(boulder.pos, -1));
        const distToBoulder = len(toBoulder);
        const minDist = this.body2 + boulder.size;
        
        if (distToBoulder < minDist && distToBoulder > 0.01) {
            const pushDir = normalize(toBoulder);
            this.pos = plus(this.pos, times(pushDir, minDist - distToBoulder));
            const velIntoBoulder = dot(this.velocity, times(pushDir, -1));
            if (velIntoBoulder > 0) this.velocity = plus(this.velocity, times(pushDir, velIntoBoulder));
        }
        
        if (Math.abs(this.pos[0]) > 6.5) {
            this.pos[0] = Math.sign(this.pos[0]) * 6.5;
            this.velocity[0] *= -0.5;
        }
        
        if (this.pos[1] < terrainY - 8) triggerRestart("Fell into the abyss!");
    };
    
    this.handleCollision = (deFn, radius, bounce) => {
        const dist = deFn(this.pos);
        if (dist < radius) {
            const eps = 0.05;
            const norm = normalize([
                deFn(plus(this.pos, [eps, 0, 0])) - deFn(plus(this.pos, [-eps, 0, 0])),
                deFn(plus(this.pos, [0, eps, 0])) - deFn(plus(this.pos, [0, -eps, 0])),
                deFn(plus(this.pos, [0, 0, eps])) - deFn(plus(this.pos, [0, 0, -eps]))
            ]);
            this.pos = plus(this.pos, times(norm, radius - dist + (bounce ? 0.1 : 0)));
            const velDot = dot(this.velocity, norm);
            if (velDot < 0) {
                this.velocity = plus(this.velocity, times(norm, -velDot * (bounce ? 1.5 : 1)));
            }
        }
    };
    
    this.push = () => {
        this.pushCooldown -= dt;
        const toBoulder = plus(boulder.pos, times(this.pos, -1));
        const distToBoulder = len(toBoulder);
        const moveDir = dirFromAngle(this.angle[0], 0);
        const dotProduct = dot(normalize(toBoulder), moveDir);
        
        const canPush = distToBoulder < 4.5 && distToBoulder > 2.0 && dotProduct > 0.5 && keyDown["w"] && this.onGround();
        
        if (canPush && this.pushCooldown <= 0) {
            this.isPushing = true;
            boulder.applyPush(times(normalize([toBoulder[0], 0, toBoulder[2]]), 3.0));
            renderer.setUni("uBodyAngle", [0, 0.3, 0]);
        } else {
            this.isPushing = false;
            renderer.setUni("uBodyAngle", [0, 0, 0]);
        }
        renderer.setUni("isPushing", this.isPushing ? 1.0 : 0.0);
    };
    
    this.onGround = () => {
        if (isOverHole(this.pos[0], this.pos[2])) return false;
        return this.pos[1] <= getTerrainHeight(this.pos[0], this.pos[2]) + this.body2 + 0.1;
    };
    
    this.updateUniforms = () => {
        renderer.setUni("playerPos", this.pos);
        renderer.setUni("camAngle", this.angle);
        
        let camDir = rotY(rotX([0, 0, -6], -this.angle[1]), this.angle[0]);
        let camPos = plus(plus(this.pos, [0, 1.5, 0]), camDir);
        
        let iterations = 50;
        while (de(camPos) < 0.8 && iterations-- > 0) {
            camPos = plus(camPos, times(normalize(camDir), -0.1));
        }
        
        renderer.setUni("camPos", camPos);
        this.camPos = camPos;
    };
    
    this.reset = (z) => {
        this.pos = [0, getTerrainHeight(0, z) + 2, z];
        this.velocity = [0, 0, 0];
        this.isPushing = false;
    };
    
    this.createAnimators = () => {
        const legUnis = ["uhip1", "ujr1", "ujr2", "ujr3", "uhip2", "ujl1", "ujl2", "ujl3", "uHeadPos", "uChestPos", "uBodyAngle"];
        
        const frames = {
            walk1: [[0.1,-0.1,-0.12], [0.15,-0.2,0.15], [0.13,-0.35,0], [0.13,-0.46,0.15],
                    [-0.1,-0.1,-0.12], [-0.15,-0.28,-0.05], [-0.13,-0.3,-0.2], [-0.13,-0.46,-0.15],
                    [0,0,0], [0,0,0], [0,-0.3,0], 1.2],
            idle:  [[0.1,-0.1,-0.12], [0.15,-0.26,0.05], [0.13,-0.35,-0.15], [0.13,-0.46,0],
                    [-0.1,-0.1,-0.12], [-0.15,-0.26,0.05], [-0.13,-0.35,-0.15], [-0.13,-0.46,0],
                    [0,0,0], [0,0,0], [0,0,0], 1.2],
            jump:  [[0.1,-0.1,-0.12], [0.15,-0.18,0.05], [0.13,-0.25,-0.15], [0.13,-0.35,0],
                    [-0.1,-0.1,-0.12], [-0.15,-0.18,0.05], [-0.13,-0.25,-0.15], [-0.13,-0.35,0],
                    [0,0,0], [0,0,0], [0,-0.2,0], 1.2],
            fall:  [[0.1,-0.1,-0.12], [0.15,-0.13,0.05], [0.13,-0.2,-0.15], [0.13,-0.3,0],
                    [-0.1,-0.1,-0.12], [-0.15,-0.13,0.05], [-0.13,-0.2,-0.15], [-0.13,-0.3,0],
                    [0,0,0], [0,0,0], [0,-0.2,0], 1.2],
            walk2: [[0.1,-0.1,-0.12], [0.15,-0.28,-0.05], [0.13,-0.3,-0.2], [0.13,-0.46,-0.15],
                    [-0.1,-0.1,-0.12], [-0.15,-0.2,0.15], [-0.13,-0.35,0], [-0.13,-0.46,0.15],
                    [0,0,0], [0,0,0], [0,-0.3,0], 1.2]
        };
        
        for (let i in legUnis) renderer.addUniform(legUnis[i], "vec3", frames.idle[i]);
        renderer.addUniform("uLift", "float", 1.2);
        
        this.legAnimator = new Animator([...legUnis, "uLift"], sinLerp);
        const stepTime = 0.3;
        this.legAnimator.addKeyFrame(frames.walk1, 0, 0);
        this.legAnimator.addKeyFrame(frames.walk2, stepTime/2, 0);
        this.legAnimator.addKeyFrame(frames.walk1, stepTime, 0);
        this.legAnimator.addKeyFrame(frames.idle, 0, 1);
        this.legAnimator.addKeyFrame(frames.jump, 0, 2);
        this.legAnimator.addKeyFrame(frames.fall, 0, 3);
    };
    
    this.createAnimators();
}

let player = new Player();
