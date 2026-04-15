import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
    cascata1: {
        file: '../elements/cascata1.glb',
        scale: 1.0,
        position: { x: 5.5, y: 0.99, z: -5.0 },  // Esquerda, acima do chão, afastada do cenário
        rotation: 0,
    },
    cascata2: {
        file: '../elements/cascata2.glb',
        scale: 1.0,
        position: { x: 2.5, y: 0.99, z: -5.0 },   // Direita, acima do chão, afastada do cenário (espaço para água)
        rotation: 0,
    },
    // Espaço entre cascatas: 5 unidades (2.5 + 2.5) - perfeito para adicionar partículas de água
};

/**
 * Carrega um modelo de cascata individual.
 * @param {GLTFLoader} loader - Instância do loader
 * @param {string} file - Caminho do ficheiro
 * @param {Object} config - Configuração de posição, escala e rotação
 * @returns {Promise<THREE.Group>} Promise resolvida com o modelo carregado
 */
function loadWaterfallModel(loader, file, config) {
    return new Promise((resolve, reject) => {
        loader.load(
            file,
            (gltf) => {
                const cascade = gltf.scene;
                
                // Aplicar transformações
                cascade.position.set(
                    config.position.x,
                    config.position.y,
                    config.position.z
                );
                cascade.scale.set(
                    config.scale,
                    config.scale,
                    config.scale
                );
                cascade.rotation.y = config.rotation;
                
                // Aplicar shadows a todas as meshes
                cascade.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                
                resolve(cascade);
            },
            undefined,
            (error) => {
                console.error(`Erro ao carregar cascata (${file}):`, error);
                reject(error);
            }
        );
    });
}

/**
 * Carrega ambas as cascatas (esquerda e direita) na cena.
 * @param {THREE.Scene} scene - Cena Three.js
 * @returns {Promise<Object>} Promise resolvida com { cascata1, cascata2 }
 */
function loadWaterfalls(scene) {
    return new Promise(async (resolve, reject) => {
        try {
            const loader = new GLTFLoader();
            
            // Carregar ambas as cascatas em paralelo
            const [cascata1, cascata2] = await Promise.all([
                loadWaterfallModel(loader, SETTINGS.cascata1.file, SETTINGS.cascata1),
                loadWaterfallModel(loader, SETTINGS.cascata2.file, SETTINGS.cascata2),
            ]);
            
            // Adicionar à cena
            scene.add(cascata1);
            scene.add(cascata2);
            
            console.log('Cascatas carregadas com sucesso');
            resolve({ cascata1, cascata2 });
        } catch (error) {
            console.error('Erro ao carregar cascatas:', error);
            reject(error);
        }
    });
}

/**
 * Obtém a posição do espaço entre as cascatas (útil para adicionar água depois)
 * @returns {Object} Posição central entre as cascatas { x, z }
 */
function getWaterAreaPosition() {
    return {
        x: 0, // Centro entre as cascatas
        z: 0,
    };
}

/**
 * Obtém as configurações atuais das cascatas
 * @returns {Object} Objeto SETTINGS com as configurações
 */
function getWaterfallsSettings() {
    return SETTINGS;
}

export { loadWaterfalls, getWaterAreaPosition, getWaterfallsSettings, SETTINGS };
