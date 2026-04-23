import * as THREE from 'three';
import { getAssetPath } from '../../config.js';
import { loadGLTF, cloneScene, freezeObject } from '../../core/AssetCache.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
    model: {
        file:     getAssetPath('elements/campfire.glb'),
        scale:    0.2,
        position: { x: 0, y: 0.06, z: 0 },
        rotation: 0,
    },
};

/**
 * Carrega o modelo da fogueira via AssetCache e marca como estático.
 * @param {THREE.Scene} scene
 * @returns {Promise<THREE.Group>}
 */
async function loadCampfire(scene) {
    const gltf    = await loadGLTF(SETTINGS.model.file);
    const campfire = cloneScene(gltf);

    const { position, scale, rotation } = SETTINGS.model;
    campfire.position.set(position.x, position.y, position.z);
    campfire.scale.setScalar(scale);
    campfire.rotation.y = rotation;

    campfire.traverse(child => {
        if (child.isMesh) {
            child.castShadow    = false;
            child.receiveShadow = true;
        }
    });

    freezeObject(campfire);
    scene.add(campfire);
    return campfire;
}

export { loadCampfire, SETTINGS };
