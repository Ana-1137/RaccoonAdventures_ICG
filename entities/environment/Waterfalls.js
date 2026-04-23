import * as THREE from 'three';
import { getAssetPath } from '../../config.js';
import { loadGLTF, cloneScene, freezeObject } from '../../core/AssetCache.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
    cascata1: {
        file:     getAssetPath('elements/cascata1.glb'),
        scale:    2.0,
        position: { x: 0.7, y: 1.99, z: -4.5 },
        rotation: 0,
    },
    cascata2: {
        file:     getAssetPath('elements/cascata2.glb'),
        scale:    2.0,
        position: { x: 4.9, y: 1.99, z: -4.5 },
        rotation: 0,
    },
    exclusionZone: {
        type:  'rect',
        halfW: 4.5,
        halfD: 2.5,
    },
    waterArea: {
        y: 0.1,
    },
};

// Calcular centro da zona de exclusão a partir das posições
SETTINGS.exclusionZone.x = (SETTINGS.cascata1.position.x + SETTINGS.cascata2.position.x) / 2;
SETTINGS.exclusionZone.z =  SETTINGS.cascata1.position.z;
SETTINGS.waterArea.x     = SETTINGS.exclusionZone.x;
SETTINGS.waterArea.z     = SETTINGS.exclusionZone.z;

// ─── FUNÇÕES AUXILIARES ──────────────────────────────────────────────────────

/**
 * Carrega e posiciona um modelo de cascata.
 * @param {string} file
 * @param {Object} cfg  - { scale, position, rotation }
 * @param {THREE.Scene} scene
 * @returns {Promise<THREE.Group>}
 */
async function loadSingleWaterfall(file, cfg, scene) {
    const gltf    = await loadGLTF(file);
    const cascade = cloneScene(gltf);

    cascade.position.set(cfg.position.x, cfg.position.y, cfg.position.z);
    cascade.scale.setScalar(cfg.scale);
    cascade.rotation.y = cfg.rotation;

    cascade.traverse(child => {
        if (child.isMesh) {
            child.castShadow    = false;
            child.receiveShadow = true;
            child.raycast       = THREE.Mesh.prototype.raycast.bind(child);
        }
    });

    freezeObject(cascade);
    scene.add(cascade);
    return cascade;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Carrega as duas cascatas em paralelo via AssetCache.
 * @param {THREE.Scene} scene
 * @returns {Promise<{ cascata1, cascata2 }>}
 */
async function loadWaterfalls(scene) {
    const [cascata1, cascata2] = await Promise.all([
        loadSingleWaterfall(SETTINGS.cascata1.file, SETTINGS.cascata1, scene),
        loadSingleWaterfall(SETTINGS.cascata2.file, SETTINGS.cascata2, scene),
    ]);
    console.log('Cascatas carregadas com sucesso');
    return { cascata1, cascata2 };
}

export { loadWaterfalls, SETTINGS };