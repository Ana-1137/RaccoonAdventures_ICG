import * as THREE from 'three';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
const SETTINGS = {
    light: {
        color: 0xff8c00,
        intensity: 1,
        range: 15,
        position: { x: 0, y: 0.8, z: 0 },
        // castShadow mantido para que bench e personagem projetem sombra da fogueira
        castShadow: true,
        shadow: {
            near: 0.1, far: 20,
            // 512×512 em vez de 1024×1024 — menos 4× de memória de GPU
            mapWidth: 512, mapHeight: 512,
            bias: -0.001,
        },
    },
    fire: {
        sphere: { radius: 0.15, opacity: 0.2, color: 0xff8c00 },
        particles: {
            count: 60,                      // reduzido de 100 → 60
            size: 0.01,
            opacity: 0.6,
            color: 0xff8c00,
            velXZ: 0.02,
            velYBase: 0.03,
            velYSpread: 0.02,
            spawnMin: 0.05,
            spawnMax: 0.10,
            lifeBase: 1.5,
            lifeSpread: 1.0,
            // LOD: só animar partículas se o jogador estiver dentro deste raio
            lodDistance: 2,
            // Throttle: atualizar partículas a ~30 Hz em vez de 60 Hz
            updateInterval: 0.033,
        },
        flicker: {
            freqs: [2, 4.7, 8.3],
            weights: [0.3, 0.2, 0.1],
            baseScale: 0.7,
        },
    },
};

// ─── FUNÇÕES AUXILIARES ──────────────────────────────────────────────────────

/** @param {THREE.Scene} scene @returns {THREE.PointLight} */
function createFireLight(scene) {
    const { color, intensity, range, position, castShadow, shadow } = SETTINGS.light;
    const light = new THREE.PointLight(color, intensity, range);
    light.position.set(position.x, position.y, position.z);
    light.castShadow = castShadow;
    light.shadow.camera.near = shadow.near;
    light.shadow.camera.far = shadow.far;
    light.shadow.mapSize.width = shadow.mapWidth;
    light.shadow.mapSize.height = shadow.mapHeight;
    light.shadow.bias = shadow.bias;
    scene.add(light);
    return light;
}

/**
 * Inicializa (ou reinicia) uma partícula no índice i.
 * Velocidades guardadas como Float32Array para evitar alocações de objetos.
 * @param {number}      i
 * @param {Float32Array} pos - buffer de posições (x,y,z por partícula)
 * @param {Float32Array} vel - buffer de velocidades (x,y,z por partícula)
 * @param {Float32Array} life
 * @param {Float32Array} maxLife
 * @param {Object}      cfg  - SETTINGS.fire.particles
 */
function initParticle(i, pos, vel, life, maxLife, cfg) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const radius = cfg.spawnMin + Math.random() * (cfg.spawnMax - cfg.spawnMin);
    const i3 = i * 3;

    pos[i3] = Math.sin(phi) * Math.cos(theta) * radius;
    pos[i3 + 1] = Math.cos(phi) * radius;
    pos[i3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;

    vel[i3] = (Math.random() - 0.5) * cfg.velXZ;
    vel[i3 + 1] = cfg.velYBase + Math.random() * cfg.velYSpread;
    vel[i3 + 2] = (Math.random() - 0.5) * cfg.velXZ;

    life[i] = 0;
    maxLife[i] = cfg.lifeBase + Math.random() * cfg.lifeSpread;
}

/** @param {THREE.Scene} scene @returns {{ fireGroup, fireMaterial, particleData }} */
function createFireVisual(scene) {
    const { sphere, particles } = SETTINGS.fire;
    const { position } = SETTINGS.light;

    const fireGroup = new THREE.Group();
    fireGroup.position.set(position.x, position.y - 0.8, position.z);
    fireGroup.userData.isParticles = true;
    scene.add(fireGroup);

    // Esfera central de brilho
    const fireMaterial = new THREE.MeshBasicMaterial({
        color: sphere.color, transparent: true,
        opacity: sphere.opacity, side: THREE.DoubleSide, depthWrite: false,
    });
    fireGroup.add(new THREE.Mesh(
        new THREE.SphereGeometry(sphere.radius, 16, 16), fireMaterial
    ));

    // Sistema de partículas com Float32Array para velocidades (sem GC)
    const count = particles.count;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3); // ← Float32Array em vez de [{x,y,z}]
    const life = new Float32Array(count);
    const maxLife = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        initParticle(i, pos, vel, life, maxLife, particles);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const material = new THREE.PointsMaterial({
        color: particles.color, size: particles.size,
        sizeAttenuation: true, transparent: true,
        opacity: particles.opacity, depthWrite: false,
    });

    const particleSystem = new THREE.Points(geometry, material);
    particleSystem.userData.isParticles = true;
    fireGroup.add(particleSystem);

    return { fireGroup, fireMaterial, particleData: { pos, vel, life, maxLife, geometry, material } };
}

/**
 * Combina múltiplas ondas sinusoidais para tremeluzir orgânico.
 * @param {number} time - segundos
 */
function computeFlicker(time) {
    const { freqs, weights } = SETTINGS.fire.flicker;
    return freqs.reduce((acc, f, i) => acc + Math.sin(time * f) * weights[i], 0);
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria a fogueira completa: luz pontual + visual de fogo + partículas.
 * Otimizações:
 *   - Shadow map 512×512 (era 1024×1024)
 *   - Float32Array para velocidades (sem alocações por frame)
 *   - LOD de distância: partículas pausadas quando jogador está longe
 *   - Throttle: loop de partículas corre a ~30 Hz, não a 60 Hz
 * @param {THREE.Scene} scene
 * @returns {{ light, mesh, settings, update(playerPos?) }}
 */
function createCampfireLight(scene) {
    const light = createFireLight(scene);
    const { fireGroup, fireMaterial, particleData } = createFireVisual(scene);

    const settings = {
        enabled: true,
        intensity: SETTINGS.light.intensity,
        range: SETTINGS.light.range,
        color: '#ff8c00',
    };

    let _timeSinceUpdate = 0; // acumulador para throttle

    return {
        light,
        mesh: fireGroup,
        settings,

        /**
         * Atualiza tremeluzir e partículas.
         * @param {THREE.Vector3} [playerPos] - Posição do jogador para LOD de distância
         * @param {number}        [delta=0.016]
         */
        update(playerPos = null, delta = 0.016) {
            if (!settings.enabled) {
                light.visible = false;
                fireGroup.visible = false;
                return;
            }
            light.visible = true;
            fireGroup.visible = true;

            // ── Tremeluzir da luz (corre sempre, é barato) ──
            const flicker = computeFlicker(Date.now() * 0.001);
            light.intensity = Math.max(0, settings.intensity * (SETTINGS.fire.flicker.baseScale + flicker));
            fireMaterial.opacity = 0.1 + flicker * 0.1;

            // ── LOD: verificar distância ao jogador ──────────────────────────
            const cfg = SETTINGS.fire.particles;
            if (playerPos) {
                const dx = playerPos.x - SETTINGS.light.position.x;
                const dz = playerPos.z - SETTINGS.light.position.z;
                if (Math.sqrt(dx * dx + dz * dz) > cfg.lodDistance) return;
            }

            // ── Throttle: só correr o loop a ~30 Hz ──────────────────────────
            _timeSinceUpdate += delta;
            if (_timeSinceUpdate < cfg.updateInterval) return;
            _timeSinceUpdate = 0;

            // ── Atualizar partículas com Float32Array ──────────────────────
            const { pos, vel, life, maxLife, geometry, material } = particleData;

            for (let i = 0; i < cfg.count; i++) {
                life[i] += cfg.updateInterval;

                if (life[i] >= maxLife[i]) {
                    initParticle(i, pos, vel, life, maxLife, cfg);
                    continue;
                }

                const i3 = i * 3;
                pos[i3] += vel[i3];
                pos[i3 + 1] += vel[i3 + 1];
                pos[i3 + 2] += vel[i3 + 2];
                vel[i3] *= 0.98;
                vel[i3 + 1] *= 0.99;
                vel[i3 + 2] *= 0.98;
            }

            geometry.attributes.position.needsUpdate = true;
            material.opacity = 0.3 + flicker * 0.2;
        },
    };
}

export { createCampfireLight };
