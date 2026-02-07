function Boulder() {
    this.pos = [0, 5, 0];
    this.size = 2.5;
    this.gravity = 25;
    this.velocity = [0, 0, 0];
    this.rotVel = 0;
    this.rotAxis = [0, 0, 1];
    this.rotMat = I();
    this.friction = 0.98;
    this.groundFriction = 0.995;
    this.slopeGravity = 12;
    this.beingPushed = false;
    this.pushForce = [0, 0, 0];
    this.maxHeight = 0;
    
    this.update = () => {
        this.beingPushed = len(this.pushForce) > 0.1;
        
        if (this.beingPushed) {
            this.velocity = plus(this.velocity, times(this.pushForce, dt));
            this.pushForce = times(this.pushForce, 0.9);
        }
        
        this.checkBarCollision();
        this.checkHoles();
        
        const terrainY = getTerrainHeight(this.pos[0], this.pos[2]);
        const groundY = terrainY + this.size;
        
        if (this.pos[1] <= groundY + 0.1) {
            this.pos[1] = groundY;
            
            if (this.velocity[1] < -5) {
                this.velocity[1] *= -0.3;
            } else {
                this.velocity[1] = 0;
            }
            
            this.velocity[0] *= this.groundFriction;
            this.velocity[2] *= this.groundFriction;
            
            if (!this.beingPushed && this.pos[2] > 0) {
                this.velocity[2] -= this.slopeGravity * 0.3 * dt;
                this.velocity[0] += (Math.random() - 0.5) * 0.5 * dt;
            }
            
            const groundSpeed = len([this.velocity[0], this.velocity[2]]);
            if (groundSpeed > 0.1) {
                this.rotVel = groundSpeed / this.size;
                this.rotAxis = normalize(cross([this.velocity[0], 0, this.velocity[2]], [0, 1, 0]));
            }
        } else {
            this.velocity[1] -= this.gravity * dt;
        }
        
        this.velocity = times(this.velocity, this.friction);
        this.pos = plus(this.pos, times(this.velocity, dt));
        
        this.handleCollision(deBoxes, 0.1, 1.5);
        this.handleCollision(deFloorBeams, 0.05, 0, () => { this.velocity[1] += 2; this.velocity[2] *= 0.9; });
        
        if (Math.abs(this.pos[0]) > 5.5) {
            this.pos[0] = Math.sign(this.pos[0]) * 5.5;
            this.velocity[0] *= -0.5;
        }
        
        if (this.pos[2] < -5) { this.pos[2] = -5; this.velocity[2] = 0; }
        
        if (len(this.rotAxis) > 0) {
            this.rotMat = matTimesMat(rotAxisMat(this.rotVel * dt, this.rotAxis), this.rotMat);
        }
        
        if (this.pos[2] > this.maxHeight) this.maxHeight = this.pos[2];
        
        if (this.pos[2] < this.maxHeight - 30 && this.maxHeight > 10) {
            triggerRestart("Your burden has fled from you...");
        }
        
        this.updateUniforms();
    };
    
    this.handleCollision = (deFn, pushExtra, bounceMult, callback) => {
        const dist = deFn(this.pos);
        if (dist < this.size) {
            const eps = 0.1;
            const norm = normalize([
                deFn(plus(this.pos, [eps, 0, 0])) - deFn(plus(this.pos, [-eps, 0, 0])),
                deFn(plus(this.pos, [0, eps, 0])) - deFn(plus(this.pos, [0, -eps, 0])),
                deFn(plus(this.pos, [0, 0, eps])) - deFn(plus(this.pos, [0, 0, -eps]))
            ]);
            this.pos = plus(this.pos, times(norm, this.size - dist + pushExtra));
            if (bounceMult) {
                const velDot = dot(this.velocity, norm);
                if (velDot < 0) this.velocity = plus(this.velocity, times(norm, -velDot * bounceMult));
            }
            if (callback) callback();
        }
    };
    
    this.checkBarCollision = () => {
        const result = getSpinningBarForce(this.pos);
        if (result.hit) {
            this.velocity = plus(this.velocity, times(result.force, 0.5));
            this.velocity[1] += 5;
        }
    };
    
    this.checkHoles = () => {
        const holes = [
            { x: 2.5, z: 45, radius: 3.0 },
            { x: -2.0, z: 75, radius: 2.5 },
            { x: 1.5, z: 105, radius: 2.0 }
        ];
        
        for (const hole of holes) {
            const dx = this.pos[0] - hole.x, dz = this.pos[2] - hole.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            
            if (dist < hole.radius + this.size * 0.5) {
                const pullStrength = 5 * (1 - dist / (hole.radius + this.size));
                this.velocity[0] -= (dx / dist) * pullStrength * dt;
                this.velocity[2] -= (dz / dist) * pullStrength * dt;
                
                if (dist < hole.radius * 0.5) triggerRestart("The stone has been swallowed by the void...");
            }
        }
    };
    
    this.applyPush = (force) => { this.pushForce = plus(this.pushForce, force); };
    
    this.updateUniforms = () => {
        renderer.setUni("boulderPos", this.pos);
        renderer.setUni("boulderRotMat", this.rotMat);
    };
    
    this.reset = (z) => {
        this.pos = [0, getTerrainHeight(0, z) + this.size + 1, z + 3];
        this.velocity = [0, 0, 0];
        this.rotMat = I();
        this.rotVel = 0;
        this.maxHeight = z;
        this.pushForce = [0, 0, 0];
    };
    
    this.de = (p) => len(plus(p, times(this.pos, -1))) - this.size;
}

let boulder = new Boulder();
