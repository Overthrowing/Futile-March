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
    this.slopeGravity = 12; // Gravity pulling boulder down the slope
    
    this.beingPushed = false;
    this.pushForce = [0, 0, 0];
    
    this.maxHeight = 0;
    
    this.update = () => {
        this.beingPushed = len(this.pushForce) > 0.1;
        
        // Apply push force
        if (this.beingPushed) {
            this.velocity = plus(this.velocity, times(this.pushForce, dt));
            this.pushForce = times(this.pushForce, 0.9); // Decay push
        }
        
        // Check collision with spinning bars
        this.checkBarCollision();
        
        // Check if fell in hole
        this.checkHoles();
        
        // Ground check and physics
        const terrainY = getTerrainHeight(this.pos[0], this.pos[2]);
        const groundY = terrainY + this.size;
        
        if (this.pos[1] <= groundY + 0.1) {
            // On ground
            this.pos[1] = groundY;
            
            // Bounce if falling fast
            if (this.velocity[1] < -5) {
                this.velocity[1] *= -0.3;
            } else {
                this.velocity[1] = 0;
            }
            
            // Apply ground friction
            this.velocity[0] *= this.groundFriction;
            this.velocity[2] *= this.groundFriction;
            
            // If NOT being pushed, gravity pulls boulder backwards (down the slope)
            if (!this.beingPushed && this.pos[2] > 0) {
                // Slope pulls boulder back
                const slopeForce = this.slopeGravity * 0.3; // 0.3 is slope angle
                this.velocity[2] -= slopeForce * dt;
                
                // Small random wobble
                this.velocity[0] += (Math.random() - 0.5) * 0.5 * dt;
            }
            
            // Update rotation based on movement
            const groundSpeed = len([this.velocity[0], this.velocity[2]]);
            if (groundSpeed > 0.1) {
                this.rotVel = groundSpeed / this.size;
                this.rotAxis = normalize(cross([this.velocity[0], 0, this.velocity[2]], [0, 1, 0]));
            }
        } else {
            // In air - apply gravity
            this.velocity[1] -= this.gravity * dt;
        }
        
        // Apply air friction
        this.velocity = times(this.velocity, this.friction);
        
        // Update position
        this.pos = plus(this.pos, times(this.velocity, dt));
        
        // Box collision
        const boxDist = deBoxes(this.pos);
        if (boxDist < this.size) {
            // Find push direction from box
            const eps = 0.1;
            const boxNorm = normalize([
                deBoxes(plus(this.pos, [eps, 0, 0])) - deBoxes(plus(this.pos, [-eps, 0, 0])),
                deBoxes(plus(this.pos, [0, eps, 0])) - deBoxes(plus(this.pos, [0, -eps, 0])),
                deBoxes(plus(this.pos, [0, 0, eps])) - deBoxes(plus(this.pos, [0, 0, -eps]))
            ]);
            this.pos = plus(this.pos, times(boxNorm, this.size - boxDist + 0.1));
            // Bounce off box
            const velDot = dot(this.velocity, boxNorm);
            if (velDot < 0) {
                this.velocity = plus(this.velocity, times(boxNorm, -velDot * 1.5));
            }
        }
        
        // Floor beam collision - boulder bumps over beams
        const beamDist = deFloorBeams(this.pos);
        if (beamDist < this.size) {
            // Find push direction from beam
            const eps = 0.1;
            const beamNorm = normalize([
                deFloorBeams(plus(this.pos, [eps, 0, 0])) - deFloorBeams(plus(this.pos, [-eps, 0, 0])),
                deFloorBeams(plus(this.pos, [0, eps, 0])) - deFloorBeams(plus(this.pos, [0, -eps, 0])),
                deFloorBeams(plus(this.pos, [0, 0, eps])) - deFloorBeams(plus(this.pos, [0, 0, -eps]))
            ]);
            this.pos = plus(this.pos, times(beamNorm, this.size - beamDist + 0.05));
            // Small bounce and slowdown
            this.velocity[1] += 2;
            this.velocity[2] *= 0.9; // Slow down when hitting beam
        }
        
        // Keep on path (soft boundaries)
        const pathWidth = 5.5;
        if (Math.abs(this.pos[0]) > pathWidth) {
            this.pos[0] = Math.sign(this.pos[0]) * pathWidth;
            this.velocity[0] *= -0.5;
        }
        
        // Prevent boulder from going below start
        if (this.pos[2] < -5) {
            this.pos[2] = -5;
            this.velocity[2] = 0;
        }
        
        // Update rotation matrix
        if (len(this.rotAxis) > 0) {
            this.rotMat = matTimesMat(rotAxisMat(this.rotVel * dt, this.rotAxis), this.rotMat);
        }
        
        // Track max height
        if (this.pos[2] > this.maxHeight) {
            this.maxHeight = this.pos[2];
        }
        
        // Check if boulder rolled too far back
        if (this.pos[2] < this.maxHeight - 30 && this.maxHeight > 10) {
            triggerRestart("The boulder escaped!");
        }
        
        this.updateUniforms();
    };
    
    this.checkBarCollision = () => {
        const barResult = getSpinningBarForce(this.pos);
        if (barResult.hit) {
            // Boulder gets knocked
            this.velocity = plus(this.velocity, times(barResult.force, 0.5));
            this.velocity[1] += 5;
        }
    };
    
    this.checkHoles = () => {
        const holePositions = [
            { x: 2.5, z: 45, radius: 3.0 },
            { x: -2.0, z: 75, radius: 2.5 },
            { x: 1.5, z: 105, radius: 2.0 }
        ];
        
        for (const hole of holePositions) {
            const dx = this.pos[0] - hole.x;
            const dz = this.pos[2] - hole.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            
            if (dist < hole.radius + this.size * 0.5) {
                // Near hole - pull towards center
                const pullStrength = 5 * (1 - dist / (hole.radius + this.size));
                this.velocity[0] -= (dx / dist) * pullStrength * dt;
                this.velocity[2] -= (dz / dist) * pullStrength * dt;
                
                if (dist < hole.radius * 0.5) {
                    // Fell in hole!
                    triggerRestart("The boulder fell into a pit!");
                }
            }
        }
    };
    
    this.applyPush = (force) => {
        this.pushForce = plus(this.pushForce, force);
    };
    
    this.updateUniforms = () => {
        renderer.setUni("boulderPos", this.pos);
        renderer.setUni("boulderRotMat", this.rotMat);
    };
    
    this.reset = (z) => {
        const terrainY = getTerrainHeight(0, z);
        this.pos = [0, terrainY + this.size + 1, z + 3];
        this.velocity = [0, 0, 0];
        this.rotMat = I();
        this.rotVel = 0;
        this.maxHeight = z;
        this.pushForce = [0, 0, 0];
    };
    
    this.de = (p) => {
        return len(plus(p, times(this.pos, -1))) - this.size;
    };
}

let boulder = new Boulder();

