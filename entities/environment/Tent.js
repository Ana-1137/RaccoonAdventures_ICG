import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getAssetPath } from '../../config.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
    model: {
        file: getAssetPath('elements/Tent.glb'),
        scale: 0.8,              // reduzido para melhor proporção
        position: { x: 0, y: 0.4, z: -2 },  // y aumentado para sentar sobre o chão
        rotation: 0,             // rotação Y em radianos
    },
};

/**
 * Carrega o modelo da tenda da cena.
 * @param {THREE.Scene} scene - Cena Three.js
 * @returns {Promise<THREE.Group>} Promise resolvida com o modelo carregado
 */
function loadTent(scene) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        
        loader.load(
            SETTINGS.model.file,
            (gltf) => {
                const tent = gltf.scene;
                
                // Aplicar transformações
                tent.position.set(
                    SETTINGS.model.position.x,
                    SETTINGS.model.position.y,
                    SETTINGS.model.position.z
                );
                tent.scale.set(
                    SETTINGS.model.scale,
                    SETTINGS.model.scale,
                    SETTINGS.model.scale
                );
                tent.rotation.y = SETTINGS.model.rotation;
                
                // Aplicar shadows a todas as meshes
                tent.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = false;
                        child.receiveShadow = true;
                    }
                });
                
                // Adicionar à cena
                scene.add(tent);
                
                console.log('Tenda carregada com sucesso');
                resolve(tent);
            },
            undefined,
            (error) => {
                console.error('Erro ao carregar tenda:', error);
                reject(error);
            }
        );
    });
}

export { loadTent, SETTINGS };
