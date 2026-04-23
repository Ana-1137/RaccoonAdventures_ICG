import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getAssetPath } from '../../config.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
    model: {
        file: getAssetPath('elements/Log_Bench.glb'),
        scale: 0.3,  // Reduzido de 1.0
    },
    placement: {
        positions: [
            { x: 0, y: 0.06, z: 0.7, rotation: 0 },           // Atrás da fogueira
            { x: 0.6, y: 0.06, z: -0.1, rotation: Math.PI * 0.6 },      // Direita - perto da tenda
            { x: -0.6, y: 0.06, z: -0.1, rotation: Math.PI * 1.4 },     // Esquerda - perto da tenda
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
                    log.position.set(
                        posConfig.x,
                        posConfig.y || 0,  // Usar y do config se existir, senão 0
                        posConfig.z
                    );
                    log.scale.set(
                        SETTINGS.model.scale,
                        SETTINGS.model.scale,
                        SETTINGS.model.scale
                    );
                    log.rotation.y = posConfig.rotation;
                    
                    // Aplicar shadows a todas as meshes
                    log.traverse((child) => {
                        if (child.isMesh) {
                            // child.castShadow = false; // Objeto estático, sem necessidade
                            child.castShadow = true; // Ativar para criar sombras no chão
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
