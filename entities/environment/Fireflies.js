import * as THREE from 'three';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
const SETTINGS = {
    count: 30,
    color: 0x88ff44,          // verde bioluminescente
    size: 0.06,
    // Área de spawn: anel da floresta em torno do acampamento
    spawn: { cx: 0, cz: 1.5, innerR: 2.5, outerR: 6.0, yMin: 0.3, yMax: 1.8 },
    speed: 0.3,
    bobAmplitude: 0.15,
    bobSpeed: 1.2,
    nightStart: 18,
    nightEnd: 6,
    fadeSpeed: 0.02,
};

// ─── ESTADO INTERNO ─────────────────────────────────────────────────────────
let _points = null;
let _phases = null;
let _dirs = null;
let _baseY = null;
let _currentOpacity = 0;

/**
 * Cria o sistema de pirilampos e adiciona à cena.
 * @param {THREE.Scene} scene
 */
export function createFireflies(scene) {
    const { count, spawn } = SETTINGS;
    const positions = new Float32Array(count * 3);
    _phases = new Float32Array(count);
    _dirs   = new Float32Array(count * 2);
    _baseY  = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const r = spawn.innerR + Math.random() * (spawn.outerR - spawn.innerR);
        const x = spawn.cx + Math.cos(angle) * r;
        const z = spawn.cz + Math.sin(angle) * r;
        const y = spawn.yMin + Math.random() * (spawn.yMax - spawn.yMin);

        positions[i * 3]     = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        _baseY[i]  = y;
        _phases[i] = Math.random() * Math.PI * 2;

        const da = Math.random() * Math.PI * 2;
        _dirs[i * 2]     = Math.cos(da);
        _dirs[i * 2 + 1] = Math.sin(da);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
        color: SETTINGS.color,
        size: SETTINGS.size,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
    });

    _points = new THREE.Points(geometry, material);
    _points.userData.isParticles = true;
    scene.add(_points);
}

/**
 * Atualiza posição e visibilidade dos pirilampos.
 * @param {number} delta
 * @param {number} hour  - Hora atual do clima (0-24)
 */
export function updateFireflies(delta, hour) {
    if (!_points) return;

    // Fade in/out baseado na hora
    const isNight = hour >= SETTINGS.nightStart || hour < SETTINGS.nightEnd;
    _currentOpacity = THREE.MathUtils.lerp(_currentOpacity, isNight ? 0.85 : 0, SETTINGS.fadeSpeed);
    _points.material.opacity = _currentOpacity;
    _points.visible = _currentOpacity > 0.01;

    if (!_points.visible) return;

    const pos = _points.geometry.attributes.position;
    const now = Date.now() * 0.001;
    const { spawn, speed, bobAmplitude, bobSpeed } = SETTINGS;

    for (let i = 0; i < SETTINGS.count; i++) {
        let x = pos.getX(i);
        let z = pos.getZ(i);

        x += _dirs[i * 2]     * speed * delta;
        z += _dirs[i * 2 + 1] * speed * delta;

        // Inverter direção se saiu do anel
        const dx = x - spawn.cx, dz = z - spawn.cz;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < spawn.innerR || dist > spawn.outerR) {
            _dirs[i * 2]     *= -1;
            _dirs[i * 2 + 1] *= -1;
            x = pos.getX(i);
            z = pos.getZ(i);
        }

        const y = _baseY[i] + Math.sin(now * bobSpeed + _phases[i]) * bobAmplitude;
        pos.setXYZ(i, x, y, z);
    }

    pos.needsUpdate = true;
}
