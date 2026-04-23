import * as THREE from 'three';
import { getAssetPath } from '../../config.js';
import { loadGLTF, cloneScene, freezeObject } from '../../core/AssetCache.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
    model: {
        file:  getAssetPath('elements/Log_Bench.glb'),
        scale: 0.3,
    },
    placement: {
        positions: [
            { x:  0.0, y: 0.06, z:  0.7, rotation: 0 },
            { x:  0.6, y: 0.06, z: -0.1, rotation: Math.PI * 0.6 },
            { x: -0.6, y: 0.06, z: -0.1, rotation: Math.PI * 1.4 },
        ],
    },
};

/**
 * Carrega o GLB do banco de tronco uma única vez (via AssetCache) e clona-o
 * para cada instância. Elimina os 3 pedidos HTTP/parse redundantes.
 * Objectos marcados como estáticos (matrixAutoUpdate = false).
 * @param {THREE.Scene} scene
 * @returns {Promise<THREE.Group[]>}
 */
async function loadLogBenches(scene) {
    // Uma única parse do GLB → 3 clones em memória
    const gltf = await loadGLTF(SETTINGS.model.file);
    const logs  = [];

    for (const cfg of SETTINGS.placement.positions) {
        const log = cloneScene(gltf);

        log.position.set(cfg.x, cfg.y, cfg.z);
        log.scale.setScalar(SETTINGS.model.scale);
        log.rotation.y = cfg.rotation;

        log.traverse(child => {
            if (child.isMesh) {
                child.castShadow    = true;   // bench projeta sombra da fogueira
                child.receiveShadow = true;
            }
        });

        // Congelar matrix: elimina recálculo por frame (objeto nunca se move)
        freezeObject(log);

        scene.add(log);
        logs.push(log);
    }

    return logs;
}

export { loadLogBenches, SETTINGS };
