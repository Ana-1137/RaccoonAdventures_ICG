import * as THREE from 'three';
import { getAssetPath } from '../../config.js';
import { loadGLTF, cloneScene, freezeObject } from '../../core/AssetCache.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
    model: {
        file:     getAssetPath('elements/Tent.glb'),
        scale:    0.8,
        position: { x: 0, y: 0.4, z: -2 },
        rotation: 0,
    },
    exclusionZone: {
        type: 'circle',
        x: 0,
        z: -2,
        radius: 1.5, // Raio para proteger a tenda das árvores
    }
};

/**
 * Carrega a tenda via AssetCache e marca como estática.
 * @param {THREE.Scene} scene
 * @returns {Promise<THREE.Group>}
 */
async function loadTent(scene) {
    const gltf = await loadGLTF(SETTINGS.model.file);
    const tent  = cloneScene(gltf);

    const { position, scale, rotation } = SETTINGS.model;
    tent.position.set(position.x, position.y, position.z);
    tent.scale.setScalar(scale);
    tent.rotation.y = rotation;

    tent.traverse(child => {
        if (child.isMesh) {
            child.castShadow    = false;
            child.receiveShadow = true;
        }
    });

    freezeObject(tent);
    scene.add(tent);
    console.log('Tenda carregada com sucesso');
    return tent;
}

export { loadTent, SETTINGS as TENT_SETTINGS };
