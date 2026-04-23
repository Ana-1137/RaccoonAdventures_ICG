import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getAssetPath } from '../../config.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
    model: {
        file: getAssetPath('elements/campfire.glb'),  // minúsculas - ficheiro real
        scale: 0.2,              // escala normal
        position: { x: 0, y: 0.06, z: 0 },  // centro da cena
        rotation: 0,             // rotação Y em radianos
    },
};

/**
 * Carrega o modelo da fogueira na cena.
 * @param {THREE.Scene} scene - Cena Three.js
 * @returns {Promise<THREE.Group>} Promise resolvida com o modelo carregado
 */
function loadCampfire(scene) {
    return new Promise((resolve, reject) => {
        const loader = new GLTFLoader();
        
        loader.load(
            SETTINGS.model.file,
            (gltf) => {
                const campfire = gltf.scene;
                
                // Aplicar transformações
                campfire.position.set(
                    SETTINGS.model.position.x,
                    SETTINGS.model.position.y,
                    SETTINGS.model.position.z
                );
                campfire.scale.set(
                    SETTINGS.model.scale,
                    SETTINGS.model.scale,
                    SETTINGS.model.scale
                );
                campfire.rotation.y = SETTINGS.model.rotation;
                
                // Aplicar shadows a todas as meshes
                campfire.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = false; // Objeto estático, não precisa shadow
                        child.receiveShadow = true;
                    }
                });
                
                // Adicionar à cena
                scene.add(campfire);
                
                resolve(campfire);
            },
            undefined,
            (error) => {
                console.error('Erro ao carregar fogueira:', error);
                reject(error);
            }
        );
    });
}

export { loadCampfire, SETTINGS };
