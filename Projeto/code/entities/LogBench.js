import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
    model: {
        file: '../elements/Log_Bench.glb',
        scale: 1.0,
    },
    placement: {
        positions: [
            { x: 0, z: -1.2, rotation: 0 },           // Frente
            { x: 1.0, z: 0.6, rotation: Math.PI * 0.5 },      // Direita
            { x: -1.0, z: 0.6, rotation: Math.PI * 1.5 },     // Esquerda
        ],
    },
};

/**
 * Carrega 3 logs de banco à volta da fogueira.
 * @param {THREE.Scene} scene - Cena Three.js
 * @returns {Promise<THREE.Group[]>} Promise resolvida com array de logs carregados
 */
function loadLogBenches(scene) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        const logs = [];
        let loadedCount = 0;
        
        SETTINGS.placement.positions.forEach((posConfig) => {
            loader.load(
                SETTINGS.model.file,
                (gltf) => {
                    const log = gltf.scene;
                    
                    // Aplicar transformações
                    log.position.set(posConfig.x, 0, posConfig.z);
                    log.scale.set(
                        SETTINGS.model.scale,
                        SETTINGS.model.scale,
                        SETTINGS.model.scale
                    );
                    log.rotation.y = posConfig.rotation;
                    
                    // Aplicar shadows a todas as meshes
                    log.traverse((child) => {
                        if (child.isMesh) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    
                    // Adicionar à cena
                    scene.add(log);
                    logs.push(log);
                    loadedCount++;
                    
                    // Resolver apenas quando todos os logs estiverem carregados
                    if (loadedCount === SETTINGS.placement.positions.length) {
                        resolve(logs);
                    }
                },
                undefined,
                (error) => {
                    console.error('Erro ao carregar log de banco:', error);
                    reject(error);
                }
            );
        });
    });
}

export { loadLogBenches, SETTINGS };
