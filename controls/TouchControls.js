/**
 * TouchControls.js
 * Joystick virtual (esquerda) + botões Sprint/Jump (direita) para mobile.
 * Atualiza o mesmo objeto keyStates do KeyboardControls — sem alterar o resto do código.
 * Só é montado em dispositivos touch.
 */

const CSS = `
#touch-controls {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 220px;
    pointer-events: none;
    z-index: 100;
    user-select: none;
}

/* ── Joystick ── */
#joystick-zone {
    position: absolute;
    left: 24px; bottom: 24px;
    width: 130px; height: 130px;
    pointer-events: all;
}
#joystick-base {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    border: 2px solid rgba(255,255,255,0.35);
}
#joystick-knob {
    position: absolute;
    width: 52px; height: 52px;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    background: rgba(255,255,255,0.55);
    border: 2px solid rgba(255,255,255,0.8);
    transition: none;
}

/* ── Botões ── */
#touch-buttons {
    position: absolute;
    right: 24px; bottom: 24px;
    display: flex;
    gap: 16px;
    pointer-events: all;
}
.touch-btn {
    width: 68px; height: 68px;
    border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.6);
    background: rgba(255,255,255,0.18);
    color: #fff;
    font-size: 13px;
    font-weight: bold;
    font-family: sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
}
.touch-btn.active {
    background: rgba(255,255,255,0.45);
}
`;

/**
 * Monta os controlos tácteis e liga-os ao keyStates.
 * @param {Object} keyStates - { w, a, s, d, shift, space }
 */
export function createTouchControls(keyStates) {
    // Só montar em dispositivos touch
    if (!('ontouchstart' in window)) return;

    // Injetar CSS
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Estrutura HTML
    const root = document.createElement('div');
    root.id = 'touch-controls';
    root.innerHTML = `
        <div id="joystick-zone">
            <div id="joystick-base"></div>
            <div id="joystick-knob"></div>
        </div>
        <div id="touch-buttons">
            <div class="touch-btn" id="btn-sprint">RUN</div>
            <div class="touch-btn" id="btn-jump">JUMP</div>
        </div>
    `;
    document.body.appendChild(root);

    // ── Joystick ────────────────────────────────────────────────────────────
    const zone  = document.getElementById('joystick-zone');
    const knob  = document.getElementById('joystick-knob');
    const RADIUS = 39; // pixels — raio máximo do knob

    let joystickActive = false;
    let originX = 0, originY = 0;

    function updateJoystick(cx, cy) {
        const rect = zone.getBoundingClientRect();
        const centerX = rect.left + rect.width  / 2;
        const centerY = rect.top  + rect.height / 2;

        let dx = cx - centerX;
        let dy = cy - centerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > RADIUS) {
            dx = (dx / dist) * RADIUS;
            dy = (dy / dist) * RADIUS;
        }

        // Mover knob visualmente
        knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

        // Threshold de 25% do raio para evitar drift
        const threshold = RADIUS * 0.25;
        keyStates.w = dy < -threshold;
        keyStates.s = dy >  threshold;
        keyStates.a = dx < -threshold;
        keyStates.d = dx >  threshold;
    }

    function resetJoystick() {
        knob.style.transform = 'translate(-50%, -50%)';
        keyStates.w = keyStates.s = keyStates.a = keyStates.d = false;
        joystickActive = false;
    }

    zone.addEventListener('touchstart', e => {
        e.preventDefault();
        joystickActive = true;
        const t = e.changedTouches[0];
        updateJoystick(t.clientX, t.clientY);
    }, { passive: false });

    zone.addEventListener('touchmove', e => {
        e.preventDefault();
        if (!joystickActive) return;
        const t = e.changedTouches[0];
        updateJoystick(t.clientX, t.clientY);
    }, { passive: false });

    zone.addEventListener('touchend',    () => resetJoystick(), { passive: true });
    zone.addEventListener('touchcancel', () => resetJoystick(), { passive: true });

    // ── Botões Sprint / Jump ─────────────────────────────────────────────────
    function bindButton(id, key) {
        const btn = document.getElementById(id);
        const press   = e => { e.preventDefault(); keyStates[key] = true;  btn.classList.add('active'); };
        const release = e => { keyStates[key] = false; btn.classList.remove('active'); };
        btn.addEventListener('touchstart', press,   { passive: false });
        btn.addEventListener('touchend',   release, { passive: true  });
        btn.addEventListener('touchcancel',release, { passive: true  });
    }

    bindButton('btn-sprint', 'shift');
    bindButton('btn-jump',   'space');
}
