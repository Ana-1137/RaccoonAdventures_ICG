import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
    cascata1: {
        file: '../elements/cascata1.glb',
        scale: 2.0,
        position: { x: 0.7, y: 1.99, z: -4.5 },
        rotation: 0,
    },
    cascata2: {
        file: '../elements/cascata2.glb',
        scale: 2.0,
        position: { x: 4.9, y: 1.99, z: -4.5 },
        rotation: 0,
    },
    
    // Zona de exclusão para as árvores (calculada baseada nas posições)
    exclusionZone: {
        type: 'rect',
        halfW: 4.5,  // 7 unidades de largura
        halfD: 2.5,  // 7 unidades de profundidade
    },
    
    // Posição da água (entre as cascatas)
    waterArea: {
        y: 0.1,  // Altura da água
    },
};

// Calcular a zona de exclusão dinamicamente baseada nas posições das cascatas
SETTINGS.exclusionZone.x = (SETTINGS.cascata1.position.x + SETTINGS.cascata2.position.x) / 2;
SETTINGS.exclusionZone.z = SETTINGS.cascata1.position.z;

// Calcular a posição da água
SETTINGS.waterArea.x = (SETTINGS.cascata1.position.x + SETTINGS.cascata2.position.x) / 2;
SETTINGS.waterArea.z = SETTINGS.cascata1.position.z;

// ─── Variáveis Globais ─────────────────────────────────────────────────────
let loadedCascatas = {
    cascata1: null,
    cascata2: null,
};

// ─── Funções Privadas ─────────────────────────────────────────────────────

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
                        child.castShadow = false; // Objeto estático
                        child.receiveShadow = true;
                        // Ativar raycast para deteção de colisões (ex: edges para medo)
                        child.raycast = THREE.Mesh.prototype.raycast.bind(child);
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

// ─── Funções Públicas ─────────────────────────────────────────────────────

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
            
            // Guardar referências globais
            loadedCascatas.cascata1 = cascata1;
            loadedCascatas.cascata2 = cascata2;
            
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

// ─────────────────────────────────────────────────────────────────────────────
export { loadWaterfalls, SETTINGS };