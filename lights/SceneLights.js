import * as THREE from 'three';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
// Luzes de cena: luz ambiente global e luz direcional do sol.
// Luzes de entidades (fogueira, pirilampos, lanternas) → ver lights/CampfireLight.js etc.
const SETTINGS = {
    sun: {
        color:     0xffffff,
        intensity: 1,
        position:  { x: 5, y: 10, z: 7.5 },
        shadow: {
            frustum:   15,
            near:      0.1,
            far:       50,
            mapWidth:  2048,
            mapHeight: 2048,
        },
    },
    ambient: {
        color:     0xffffff,
        intensity: 0.5,
    },
};

// ─── FUNÇÕES AUXILIARES ──────────────────────────────────────────────────────

/**
 * Configura a shadow camera de uma DirectionalLight com valores simétricos.
 * @param {THREE.DirectionalLight} light
 * @param {Object} cfg - SETTINGS.sun.shadow
 */
function configureShadowCamera(light, cfg) {
    const cam   = light.shadow.camera;
    cam.left    = -cfg.frustum;
    cam.right   =  cfg.frustum;
    cam.top     =  cfg.frustum;
    cam.bottom  = -cfg.frustum;
    cam.near    =  cfg.near;
    cam.far     =  cfg.far;
    light.shadow.mapSize.width  = cfg.mapWidth;
    light.shadow.mapSize.height = cfg.mapHeight;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria e adiciona à cena a luz ambiente e a luz direcional (sol).
 * Futuros tipos de luz (fogueira, pirilampos, lanternas) devem ter
 * o seu próprio ficheiro em lights/.
 * @param {THREE.Scene} scene
 * @returns {{ ambientLight, directionalLight }}
 */
export function createLights(scene) {
    const ambientLight = new THREE.AmbientLight(
        SETTINGS.ambient.color,
        SETTINGS.ambient.intensity
    );
    scene.add(ambientLight);

    const { color, intensity, position, shadow } = SETTINGS.sun;
    const directionalLight = new THREE.DirectionalLight(color, intensity);
    directionalLight.position.set(position.x, position.y, position.z);
    directionalLight.castShadow = true;
    configureShadowCamera(directionalLight, shadow);
    scene.add(directionalLight);

    return { ambientLight, directionalLight };
}

export { SETTINGS as SCENE_LIGHT_SETTINGS };
