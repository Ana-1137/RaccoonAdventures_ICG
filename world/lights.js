import * as THREE from 'three';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
// Luz ambiente e directional do sol. A luz da fogueira está em CampfireLight.js.
const LIGHTING_SETTINGS = {
    sun: {
        color:     0xffffff,
        intensity: 1,
        position:  { x: 5, y: 10, z: 7.5 },
        shadow: {
            frustum:   15,   // metade da dimensão da câmara ortogonal de sombra
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
 * Configura a shadow camera de uma luz direcional com valores simétricos.
 * @param {THREE.DirectionalLight} light
 * @param {Object} shadowCfg - LIGHTING_SETTINGS.sun.shadow
 */
function configureShadowCamera(light, shadowCfg) {
    const cam = light.shadow.camera;
    cam.left   = -shadowCfg.frustum;
    cam.right  =  shadowCfg.frustum;
    cam.top    =  shadowCfg.frustum;
    cam.bottom = -shadowCfg.frustum;
    cam.near   =  shadowCfg.near;
    cam.far    =  shadowCfg.far;
    light.shadow.mapSize.width  = shadowCfg.mapWidth;
    light.shadow.mapSize.height = shadowCfg.mapHeight;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria e adiciona à cena a luz ambiente e a luz direcional (sol).
 * A luz da fogueira é gerida por entities/environment/CampfireLight.js.
 * @param {THREE.Scene} scene
 * @returns {{ ambientLight: THREE.AmbientLight, directionalLight: THREE.DirectionalLight }}
 */
function createLights(scene) {
    // Luz ambiente global
    const ambientLight = new THREE.AmbientLight(
        LIGHTING_SETTINGS.ambient.color,
        LIGHTING_SETTINGS.ambient.intensity
    );
    scene.add(ambientLight);

    // Luz direcional (sol)
    const { color, intensity, position, shadow } = LIGHTING_SETTINGS.sun;
    const directionalLight = new THREE.DirectionalLight(color, intensity);
    directionalLight.position.set(position.x, position.y, position.z);
    directionalLight.castShadow = true;
    configureShadowCamera(directionalLight, shadow);
    scene.add(directionalLight);

    return { ambientLight, directionalLight };
}

export { createLights, LIGHTING_SETTINGS };
