// Initialize uniforms
renderer.addUniform("res", "vec2", [window.innerWidth, window.innerHeight]);
renderer.addUniform("camPos", "vec3", [0, 5, -10]);
renderer.addUniform("camAngle", "vec2", [0, 0]);
renderer.addUniform("t", "float", 0);
renderer.addUniform("boulderPos", "vec3", [0, 5, 3]);
renderer.addUniform("playerPos", "vec3", [0, 2, 0]);
renderer.addUniform("playerAngle", "vec2", [0, 0]);
renderer.addUniform("boulderRotMat", "mat3", I());
renderer.addUniform("isPushing", "float", 0);
renderer.addUniform("gameState", "float", 0);

// Game state
let t = performance.now() / 1000;
let dt = 1/60;
let gameStarted = false;
let restartPending = false;
let restartMessage = "";
let messageTimeout = null;

// DOM elements
const titleScreen = document.getElementById("title-screen");
const instructions = document.getElementById("instructions");
const progressEl = document.getElementById("progress");
const messageEl = document.getElementById("message");
const resetBtn = document.getElementById("reset-btn");
const mobileControls = document.getElementById("mobile-controls");
const mobileInstructions = document.getElementById("mobile-instructions");
const joystickZone = document.getElementById("joystick-zone");
const joystickKnob = document.getElementById("joystick-knob");
const lookZone = document.getElementById("look-zone");
const jumpBtn = document.getElementById("jump-btn");

// Mobile detection
const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth <= 768;

// Start game on click/touch
titleScreen.onclick = () => {
    titleScreen.classList.add("hidden");
    progressEl.classList.remove("hidden");
    instructions.classList.remove("hidden");
    resetBtn.classList.remove("hidden");
    
    if (isMobile) {
        mobileControls.classList.remove("hidden");
        mobileInstructions.classList.remove("hidden");
        lookZone.classList.remove("hidden");
    }
    
    gameStarted = true;
    
    // Reset positions
    player.reset(-10);
    boulder.reset(-10);
    
    if (!isMobile) {
        renderer.canvas.requestPointerLock();
    }
};

// Full reset function
function fullReset() {
    restartPending = false;
    player.reset(-10);
    boulder.reset(-10);
    boulder.maxHeight = 0;
    showMessage("Reset!", 1500);
}

// Reset button click
resetBtn.onclick = (e) => {
    e.stopPropagation();
    fullReset();
    if (!isMobile) {
        renderer.canvas.requestPointerLock();
    }
};

// Show message in center of screen
function showMessage(msg, duration = 2000) {
    messageEl.textContent = msg;
    messageEl.classList.add("show");
    
    if (messageTimeout) clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => {
        messageEl.classList.remove("show");
    }, duration);
}

// Trigger restart - player must walk back down
function triggerRestart(reason) {
    if (restartPending) return;
    
    restartPending = true;
    restartMessage = reason;
    showMessage(reason + " Walk back to the bottom to restart.", 5000);
    
    // Reset boulder to bottom
    boulder.reset(-5);
}

// Check if player reached bottom for restart
function checkRestart() {
    if (restartPending && player.pos[2] < 0) {
        restartPending = false;
        showMessage("Begin again...", 2000);
        boulder.reset(-5);
        boulder.maxHeight = 0;
    }
}

// Victory check
function checkVictory() {
    const victoryZ = 150;
    if (boulder.pos[2] >= victoryZ) {
        showMessage("Victory! But the boulder rolls back...", 4000);
        setTimeout(() => {
            boulder.reset(-5);
            player.reset(-10);
            boulder.maxHeight = 0;
        }, 4000);
    }
}

// Update progress display
function updateUI() {
    const height = Math.max(0, Math.floor(boulder.pos[2] * 0.3));
    const maxH = Math.max(0, Math.floor(boulder.maxHeight * 0.3));
    progressEl.textContent = `Height: ${height}m (Best: ${maxH}m)`;
}

// Main game loop
function update() {
    try {
        // Delta time
        const now = performance.now() / 1000;
        dt = Math.min(now - t, 1/20);
        t = now;
        
        if (gameStarted) {
            // Update game objects
            player.update();
            boulder.update();
            
            // Game checks
            checkRestart();
            checkVictory();
            updateUI();
        }
        
        // Update shader time
        renderer.setUni("t", t);
        
        // Render
        renderer.draw();
        
        // Reset input
        keyPressed = [];
        
    } catch (e) {
        console.error(e);
    }
    
    requestAnimationFrame(update);
}

// Handle window resize
window.onresize = () => {
    renderer.canvas.width = window.innerWidth;
    renderer.canvas.height = window.innerHeight;
    renderer.gl.viewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.setUni("res", [window.innerWidth, window.innerHeight]);
};

// Handle pointer lock change (desktop only)
document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && gameStarted && !isMobile) {
        showMessage("Click to resume", 1000);
    }
});

// R key for reset
document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r' && gameStarted) {
        fullReset();
    }
});

// ============ MOBILE CONTROLS ============

// Joystick state
let joystickActive = false;
let joystickTouchId = null;
let joystickCenter = { x: 0, y: 0 };
let joystickInput = { x: 0, y: 0 };

// Look state
let lookActive = false;
let lookTouchId = null;
let lookStart = { x: 0, y: 0 };

// Get touch by ID
function getTouchById(touches, id) {
    for (let i = 0; i < touches.length; i++) {
        if (touches[i].identifier === id) return touches[i];
    }
    return null;
}

// Joystick handlers
if (joystickZone) {
    joystickZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (joystickTouchId === null) {
            const touch = e.changedTouches[0];
            joystickTouchId = touch.identifier;
            joystickActive = true;
            const rect = joystickZone.getBoundingClientRect();
            joystickCenter = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        }
    }, { passive: false });
    
    joystickZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = getTouchById(e.touches, joystickTouchId);
        if (touch && joystickActive) {
            const dx = touch.clientX - joystickCenter.x;
            const dy = touch.clientY - joystickCenter.y;
            const maxDist = 50;
            const dist = Math.min(Math.sqrt(dx*dx + dy*dy), maxDist);
            const angle = Math.atan2(dy, dx);
            
            joystickInput.x = (dist / maxDist) * Math.cos(angle);
            joystickInput.y = (dist / maxDist) * Math.sin(angle);
            
            // Update knob position
            joystickKnob.style.left = `calc(50% + ${joystickInput.x * maxDist}px)`;
            joystickKnob.style.top = `calc(50% + ${joystickInput.y * maxDist}px)`;
            
            // Apply to keyDown for movement
            keyDown['w'] = joystickInput.y < -0.3;
            keyDown['s'] = joystickInput.y > 0.3;
            keyDown['a'] = joystickInput.x < -0.3;
            keyDown['d'] = joystickInput.x > 0.3;
        }
    }, { passive: false });
    
    const joystickEnd = (e) => {
        const touch = getTouchById(e.changedTouches, joystickTouchId);
        if (touch) {
            joystickActive = false;
            joystickTouchId = null;
            joystickInput = { x: 0, y: 0 };
            joystickKnob.style.left = '50%';
            joystickKnob.style.top = '50%';
            keyDown['w'] = false;
            keyDown['s'] = false;
            keyDown['a'] = false;
            keyDown['d'] = false;
        }
    };
    
    joystickZone.addEventListener('touchend', joystickEnd, { passive: false });
    joystickZone.addEventListener('touchcancel', joystickEnd, { passive: false });
}

// Look zone handlers
if (lookZone) {
    lookZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (lookTouchId === null) {
            const touch = e.changedTouches[0];
            lookTouchId = touch.identifier;
            lookActive = true;
            lookStart = { x: touch.clientX, y: touch.clientY };
        }
    }, { passive: false });
    
    lookZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = getTouchById(e.touches, lookTouchId);
        if (touch && lookActive && gameStarted) {
            const dx = touch.clientX - lookStart.x;
            const dy = touch.clientY - lookStart.y;
            
            const sens = 0.004;
            player.angle[0] += dx * sens;
            player.angle[1] -= dy * sens;
            player.angle[1] = clamp(player.angle[1], -Math.PI/2.5, Math.PI/2.5);
            
            lookStart = { x: touch.clientX, y: touch.clientY };
        }
    }, { passive: false });
    
    const lookEnd = (e) => {
        const touch = getTouchById(e.changedTouches, lookTouchId);
        if (touch) {
            lookActive = false;
            lookTouchId = null;
        }
    };
    
    lookZone.addEventListener('touchend', lookEnd, { passive: false });
    lookZone.addEventListener('touchcancel', lookEnd, { passive: false });
}

// Jump button handler
if (jumpBtn) {
    jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        jumpBtn.classList.add('active');
        keyPressed[' '] = true;
        keyDown[' '] = true;
    }, { passive: false });
    
    jumpBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        jumpBtn.classList.remove('active');
        keyDown[' '] = false;
    }, { passive: false });
    
    jumpBtn.addEventListener('touchcancel', () => {
        jumpBtn.classList.remove('active');
        keyDown[' '] = false;
    });
}

// Prevent default touch on canvas
renderer.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
renderer.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

// ============ END MOBILE CONTROLS ============

// Initial render
renderer.draw();

// Start the game loop
update();

console.log(`
╔═══════════════════════════════════════╗
║           SISYPHUS                    ║
║                                       ║
║  Push the boulder up the mountain.    ║
║  Beware the spinning bars and holes.  ║
║  One must imagine Sisyphus happy.     ║
║                                       ║
║  Desktop Controls:                    ║
║  WASD - Move | SPACE - Jump           ║
║  R - Reset | Mouse - Look             ║
║                                       ║
║  Mobile Controls:                     ║
║  Left joystick - Move                 ║
║  Right side drag - Look around        ║
║  JUMP button - Jump                   ║
╚═══════════════════════════════════════╝
`);

