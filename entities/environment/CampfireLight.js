import * as THREE from 'three';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
const SETTINGS = {
    light: {
        color:      0xff8c00,
        intensity:  1,
        range:      15,
        position:   { x: 0, y: 0.8, z: 0 },
        shadow: {
            near: 0.1, far: 20,
            mapWidth: 1024, mapHeight: 1024,
            bias: -0.001,
        },
    },
    fire: {
        sphere: { radius: 0.15, opacity: 0.2, color: 0xff8c00 },
        particles: {
            count:  100,
            size:   0.01,
            opacity: 0.6,
            color:  0xff8c00,
            velXZ:  0.02,
            velY:   { base: 0.03, spread: 0.02 },
            spawnRadius: { min: 0.05, max: 0.10 },
            life:   { base: 1.5, spread: 1.0 },
        },
        flicker: {
            freqs:    [2, 4.7, 8.3],
            weights:  [0.3, 0.2, 0.1],
            baseScale: 0.7,
        },
    },
};

// ─── FUNÇÕES AUXILIARES ──────────────────────────────────────────────────────

/**
 * Cria a luz pontual da fogueira com sombras configuradas.
 * @param {THREE.Scene} scene
 * @returns {THREE.PointLight}
 */
function createFireLight(scene) {
    const { color, intensity, range, position, shadow } = SETTINGS.light;
    const light = new THREE.PointLight(color, intensity, range);
    light.position.set(position.x, position.y, position.z);
    light.castShadow = true;
    light.shadow.camera.near    = shadow.near;
    light.shadow.camera.far     = shadow.far;
    light.shadow.mapSize.width  = shadow.mapWidth;
    light.shadow.mapSize.height = shadow.mapHeight;
    light.shadow.bias           = shadow.bias;
    scene.add(light);
    return light;
}

/**
 * Inicializa (ou reinicia) uma partícula — posição, velocidade e tempo de vida.
 * @param {number}      i          - Índice da partícula
 * @param {Float32Array} pos
 * @param {Array}       velocities
 * @param {Array}       life
 * @param {Float32Array} maxLife
 * @param {Object}      cfg        - SETTINGS.fire.particles
 */
function initParticle(i, pos, velocities, life, maxLife, cfg) {
    const { spawnRadius, velXZ, velY } = cfg;
    const theta  = Math.random() * Math.PI * 2;
    const phi    = Math.random() * Math.PI;
    const radius = spawnRadius.min + Math.random() * (spawnRadius.max - spawnRadius.min);

    pos[i * 3]     = Math.sin(phi) * Math.cos(theta) * radius;
    pos[i * 3 + 1] = Math.cos(phi) * radius;
    pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;

    velocities[i] = {
        x: (Math.random() - 0.5) * velXZ,
        y: velY.base + Math.random() * velY.spread,
        z: (Math.random() - 0.5) * velXZ,
    };
    life[i]    = 0;
    maxLife[i] = cfg.life.base + Math.random() * cfg.life.spread;
}

/**
 * Cria o grupo visual do fogo: esfera central + sistema de partículas.
 * @param {THREE.Scene} scene
 * @returns {{ fireGroup, fireMaterial, particleData }}
 */
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
    fireGroup.add(new THREE.Mesh(new THREE.SphereGeometry(sphere.radius, 16, 16), fireMaterial));

    // Sistema de partículas
    const count      = particles.count;
    const positions  = new Float32Array(count * 3);
    const velocities = [];
    const life       = [];
    const maxLife    = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        initParticle(i, positions, velocities, life, maxLife, particles);
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMaterial = new THREE.PointsMaterial({
        color: particles.color, size: particles.size,
        sizeAttenuation: true, transparent: true,
        opacity: particles.opacity, depthWrite: false,
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    particleSystem.userData.isParticles = true;
    fireGroup.add(particleSystem);

    return {
        fireGroup, fireMaterial,
        particleData: { positions, velocities, life, maxLife, geometry: particleGeometry, material: particleMaterial },
    };
}

/**
 * Calcula o fator de tremeluzir combinando múltiplas ondas sinusoidais.
 * @param {number} time - Tempo em segundos
 * @returns {number}
 */
function computeFlicker(time) {
    const { freqs, weights } = SETTINGS.fire.flicker;
    return freqs.reduce((acc, freq, idx) => acc + Math.sin(time * freq) * weights[idx], 0);
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria a fogueira completa: luz pontual + visual de fogo + partículas.
 * @param {THREE.Scene} scene
 * @returns {{ light, mesh, settings, update() }}
 */
function createCampfireLight(scene) {
    const light = createFireLight(scene);
    const { fireGroup, fireMaterial, particleData } = createFireVisual(scene);

    const settings = {
        enabled:   true,
        intensity: SETTINGS.light.intensity,
        range:     SETTINGS.light.range,
        color:     '#ff8c00',
    };

    return {
        light,
        mesh: fireGroup,
        settings,

        /**
         * Atualiza tremeluzir da luz, opacidade da esfera e movimento das partículas.
         * Deve ser chamado em cada frame do loop de animação.
         */
        update() {
            if (!settings.enabled) {
                light.visible    = false;
                fireGroup.visible = false;
                return;
            }
            light.visible    = true;
            fireGroup.visible = true;

            const flicker = computeFlicker(Date.now() * 0.001);
            light.intensity       = Math.max(0, settings.intensity * (SETTINGS.fire.flicker.baseScale + flicker));
            fireMaterial.opacity  = 0.1 + flicker * 0.1;

            const { positions: pos, velocities: vel, life, maxLife, geometry, material } = particleData;
            const cfg = SETTINGS.fire.particles;

            for (let i = 0; i < cfg.count; i++) {
                life[i] += 0.016;
                if (life[i] >= maxLife[i]) {
                    initParticle(i, pos, vel, life, maxLife, cfg);
                    continue;
                }
                pos[i * 3]     += vel[i].x;
                pos[i * 3 + 1] += vel[i].y;
                pos[i * 3 + 2] += vel[i].z;
                vel[i].x *= 0.98;
                vel[i].y *= 0.99;
                vel[i].z *= 0.98;
            }
            geometry.attributes.position.needsUpdate = true;
            material.opacity = 0.3 + flicker * 0.2;
        },
    };
}

export { createCampfireLight };
