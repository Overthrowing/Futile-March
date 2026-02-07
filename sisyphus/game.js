renderer.addUniform("res", "vec2", [getViewportSize().width, getViewportSize().height]);
renderer.addUniform("camPos", "vec3", [0, 5, -10]);
renderer.addUniform("camAngle", "vec2", [0, 0]);
renderer.addUniform("t", "float", 0);
renderer.addUniform("boulderPos", "vec3", [0, 5, 3]);
renderer.addUniform("playerPos", "vec3", [0, 2, 0]);
renderer.addUniform("playerAngle", "vec2", [0, 0]);
renderer.addUniform("boulderRotMat", "mat3", I());
renderer.addUniform("isPushing", "float", 0);
renderer.addUniform("gameState", "float", 0);

let t = performance.now() / 1000, dt = 1/60;
let gameStarted = false, restartPending = false, restartMessage = "", messageTimeout = null;

const $ = id => document.getElementById(id);
const titleScreen = $("title-screen"), instructions = $("instructions"), progressEl = $("progress");
const messageEl = $("message"), resetBtn = $("reset-btn"), mobileControls = $("mobile-controls");
const mobileInstructions = $("mobile-instructions"), joystickZone = $("joystick-zone");
const joystickKnob = $("joystick-knob"), lookZone = $("look-zone"), jumpBtn = $("jump-btn");
const isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || window.innerWidth <= 768;

titleScreen.onclick = () => {
    titleScreen.classList.add("hidden");
    [progressEl, instructions, resetBtn].forEach(el => el.classList.remove("hidden"));
    if (isMobile) [mobileControls, mobileInstructions, lookZone].forEach(el => el.classList.remove("hidden"));
    gameStarted = true;
    player.reset(-10);
    boulder.reset(-10);
    if (!isMobile) renderer.canvas.requestPointerLock();
};

function fullReset() {
    restartPending = false;
    player.reset(-10);
    boulder.reset(-10);
    boulder.maxHeight = 0;
    showMessage("Reset!", 1500);
}

resetBtn.onclick = (e) => {
    e.stopPropagation();
    fullReset();
    if (!isMobile) renderer.canvas.requestPointerLock();
};

function showMessage(msg, duration = 2000) {
    messageEl.textContent = msg;
    messageEl.classList.add("show");
    if (messageTimeout) clearTimeout(messageTimeout);
    messageTimeout = setTimeout(() => messageEl.classList.remove("show"), duration);
}

function triggerRestart(reason) {
    if (restartPending) return;
    restartPending = true;
    restartMessage = reason;
    showMessage(reason + " Walk back to the bottom to restart.", 5000);
    boulder.reset(-5);
}

function checkRestart() {
    if (restartPending && player.pos[2] < 0) {
        restartPending = false;
        showMessage("Begin again...", 2000);
        boulder.reset(-5);
        boulder.maxHeight = 0;
    }
}

function checkVictory() {
    if (boulder.pos[2] >= 150) {
        showMessage("Victory! But the boulder rolls back...", 4000);
        setTimeout(() => { boulder.reset(-5); player.reset(-10); boulder.maxHeight = 0; }, 4000);
    }
}

function updateUI() {
    const height = Math.max(0, Math.floor(boulder.pos[2] * 0.3));
    const maxH = Math.max(0, Math.floor(boulder.maxHeight * 0.3));
    progressEl.textContent = `Height: ${height}m (Best: ${maxH}m)`;
}

function update() {
    try {
        const now = performance.now() / 1000;
        dt = Math.min(now - t, 1/20);
        t = now;
        
        if (gameStarted) {
            player.update();
            boulder.update();
            checkRestart();
            checkVictory();
            updateUI();
        }
        
        renderer.setUni("t", t);
        renderer.draw();
        keyPressed = [];
    } catch (e) { console.error(e); }
    
    requestAnimationFrame(update);
}

function handleResize() {
    const size = getViewportSize();
    renderer.canvas.width = size.width;
    renderer.canvas.height = size.height;
    renderer.gl.viewport(0, 0, size.width, size.height);
    renderer.setUni("res", [size.width, size.height]);
}

window.onresize = handleResize;
if (window.visualViewport) window.visualViewport.onresize = handleResize;

document.addEventListener('pointerlockchange', () => {
    if (!document.pointerLockElement && gameStarted && !isMobile) showMessage("Click to resume", 1000);
});

document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'r' && gameStarted) fullReset();
});

// Mobile controls
let joystickActive = false, joystickTouchId = null, joystickCenter = {x:0,y:0}, joystickInput = {x:0,y:0};
let lookActive = false, lookTouchId = null, lookStart = {x:0,y:0};

function getTouchById(touches, id) {
    for (let i = 0; i < touches.length; i++) if (touches[i].identifier === id) return touches[i];
    return null;
}

if (joystickZone) {
    joystickZone.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (joystickTouchId === null) {
            const touch = e.changedTouches[0];
            joystickTouchId = touch.identifier;
            joystickActive = true;
            const rect = joystickZone.getBoundingClientRect();
            joystickCenter = { x: rect.left + rect.width/2, y: rect.top + rect.height/2 };
        }
    }, { passive: false });
    
    joystickZone.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = getTouchById(e.touches, joystickTouchId);
        if (touch && joystickActive) {
            const dx = touch.clientX - joystickCenter.x, dy = touch.clientY - joystickCenter.y;
            const maxDist = 50, dist = Math.min(Math.sqrt(dx*dx + dy*dy), maxDist);
            const angle = Math.atan2(dy, dx);
            joystickInput = { x: (dist/maxDist) * Math.cos(angle), y: (dist/maxDist) * Math.sin(angle) };
            joystickKnob.style.left = `calc(50% + ${joystickInput.x * maxDist}px)`;
            joystickKnob.style.top = `calc(50% + ${joystickInput.y * maxDist}px)`;
            keyDown['w'] = joystickInput.y < -0.3;
            keyDown['s'] = joystickInput.y > 0.3;
            keyDown['a'] = joystickInput.x < -0.3;
            keyDown['d'] = joystickInput.x > 0.3;
        }
    }, { passive: false });
    
    const joystickEnd = (e) => {
        if (getTouchById(e.changedTouches, joystickTouchId)) {
            joystickActive = false; joystickTouchId = null; joystickInput = {x:0,y:0};
            joystickKnob.style.left = '50%'; joystickKnob.style.top = '50%';
            keyDown['w'] = keyDown['s'] = keyDown['a'] = keyDown['d'] = false;
        }
    };
    joystickZone.addEventListener('touchend', joystickEnd, { passive: false });
    joystickZone.addEventListener('touchcancel', joystickEnd, { passive: false });
}

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
            const sens = 0.004;
            player.angle[0] += (touch.clientX - lookStart.x) * sens;
            player.angle[1] = clamp(player.angle[1] - (touch.clientY - lookStart.y) * sens, -Math.PI/2.5, Math.PI/2.5);
            lookStart = { x: touch.clientX, y: touch.clientY };
        }
    }, { passive: false });
    
    const lookEnd = (e) => { if (getTouchById(e.changedTouches, lookTouchId)) { lookActive = false; lookTouchId = null; } };
    lookZone.addEventListener('touchend', lookEnd, { passive: false });
    lookZone.addEventListener('touchcancel', lookEnd, { passive: false });
}

if (jumpBtn) {
    jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault(); e.stopPropagation();
        jumpBtn.classList.add('active');
        keyPressed[' '] = keyDown[' '] = true;
    }, { passive: false });
    
    jumpBtn.addEventListener('touchend', (e) => { e.preventDefault(); jumpBtn.classList.remove('active'); keyDown[' '] = false; }, { passive: false });
    jumpBtn.addEventListener('touchcancel', () => { jumpBtn.classList.remove('active'); keyDown[' '] = false; });
}

renderer.canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
renderer.canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

renderer.draw();
update();

console.log(`
╔═══════════════════════════════════════╗
║           SISYPHUS                    ║
║  WASD - Move | SPACE - Jump | R - Reset║
║  One must imagine Sisyphus happy.     ║
╚═══════════════════════════════════════╝
`);
