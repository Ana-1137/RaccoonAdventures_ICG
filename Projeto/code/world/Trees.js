import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
    // Escalas dos modelos (cada árvore tem tronco e copa separados)
    scale: {
        // Pinheiro (Evergreen)
        evergreen: {
            trunk: 0.5,   // Escala do tronco (reduzido)
            crown: 0.5,   // Escala da copa (reduzido)
            crownOffsetY: 0.45, // Copa com ligeira sobreposição (não demasiada)
        },
        // Carvalho (Oak)
        oak: {
            trunk: 0.5,   // Igualado ao evergreen
            crown: 0.5,   // Reduzido
            crownOffsetY: 0.4, // Copa com ligeira sobreposição (não demasiada)
        },
    },
    
    // Animação de vento (procedural na copa)
    wind: {
        speed: 1.0,      // Velocidade da oscilação (ciclos/segundo)
        intensityX: 0.15, // Intensidade de rotação em X (radianos)
        intensityZ: 0.12, // Intensidade de rotação em Z (radianos)
    },
    
    // Spawn da floresta
    spawn: {
        evergreenCount: 8,  // Número de pinheiros
        oakCount: 5,         // Número de carvalhos
        areaRadius: 20,      // Raio da área de spawn (em unidades)
        minDistanceApart: 2.0, // Distância mínima entre árvores
        groundY: 0.5,        // Altura Y onde as árvores spawnam (ligeiramente acima do chão)
    },
};

// ─── Variáveis Globais ─────────────────────────────────────────────────────
let loadedModels = {
    evergreenTrunk: null,
    evergreenCrown: null,
    oakTrunk: null,
    oakCrown: null,
};

let treeInstances = []; // Array com todas as árvores criadas (para update de animação)

// ─── Funções Privadas ─────────────────────────────────────────────────────

/**
 * Carrega todos os modelos GLB necessários para as árvores.
 * @returns {Promise} Promessa resolvida quando todos os modelos estiverem carregados.
 */
function loadAllModels() {
    return new Promise((resolve) => {
        const loader = new GLTFLoader();
        let loaded = 0;
        const total = 4;

        const onLoaded = () => {
            loaded++;
            if (loaded === total) resolve();
        };

        // Carregar copa do pinheiro
        loader.load('../elements/Copa_Tiered_Evergreen.glb', (gltf) => {
            loadedModels.evergreenCrown = gltf.scene.clone();
            onLoaded();
        });

        // Carregar tronco do pinheiro
        loader.load('../elements/Oak_Tiered_Evergreen.glb', (gltf) => {
            loadedModels.evergreenTrunk = gltf.scene.clone();
            onLoaded();
        });

        // Carregar copa do carvalho
        loader.load('../elements/Green_Cauliflower.glb', (gltf) => {
            loadedModels.oakCrown = gltf.scene.clone();
            onLoaded();
        });

        // Carregar tronco do carvalho
        loader.load('../elements/Oak_Green_Cauliflower.glb', (gltf) => {
            loadedModels.oakTrunk = gltf.scene.clone();
            onLoaded();
        });
    });
}

/**
 * Cria uma árvore (grupo com tronco + copa).
 * @param {string} type - Tipo de árvore: 'evergreen' ou 'oak'
 * @param {THREE.Vector3} position - Posição do tronco
 * @returns {THREE.Group} Grupo contendo tronco + copa com metadados para animação
 */
function createTree(type, position) {
    const treeGroup = new THREE.Group();
    treeGroup.name = `tree_${type}`;
    treeGroup.position.copy(position);

    const config = SETTINGS.scale[type];

    // ── Tronco ──
    let trunk = null;
    if (type === 'evergreen') {
        trunk = loadedModels.evergreenTrunk.clone();
    } else if (type === 'oak') {
        trunk = loadedModels.oakTrunk.clone();
    }
    
    if (trunk) {
        trunk.scale.setScalar(config.trunk);
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        trunk.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        treeGroup.add(trunk);
    }

    // ── Copa ──
    let crown = null;
    if (type === 'evergreen') {
        crown = loadedModels.evergreenCrown.clone();
    } else if (type === 'oak') {
        crown = loadedModels.oakCrown.clone();
    }
    
    if (crown) {
        crown.scale.setScalar(config.crown);
        crown.position.y = config.crownOffsetY; // Offset vertical
        crown.castShadow = true;
        crown.receiveShadow = true;
        crown.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        treeGroup.add(crown);
    }

    // ── Metadados para animação de vento ──
    // Cada copa tem offset de fase aleatório para não sincronizar
    treeGroup.userData = {
        crownObject: crown,
        type: type,
        windPhaseOffset: Math.random() * Math.PI * 2, // Offset de fase [0, 2π]
        baseRotation: new THREE.Euler(0, 0, 0), // Referência de rotação inicial
    };

    return treeGroup;
}

/**
 * Gera uma posição aleatória dentro da área de spawn, respeitando distância mínima.
 * @param {Array<THREE.Vector3>} existingPositions - Posições já ocupadas
 * @returns {THREE.Vector3|null} Nova posição se possível, null se limite atingido
 */
function getRandomSpawnPosition(existingPositions) {
    const { areaRadius, minDistanceApart, groundY } = SETTINGS.spawn;
    const maxAttempts = 30;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * areaRadius;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const newPos = new THREE.Vector3(x, groundY, z);

        // Verificar distância mínima com árvores existentes
        let valid = true;
        for (const existingPos of existingPositions) {
            if (newPos.distanceTo(existingPos) < minDistanceApart) {
                valid = false;
                break;
            }
        }

        if (valid) {
            return newPos;
        }
    }

    return null; // Não conseguiu encontrar posição válida
}

// ─── Funções Públicas ─────────────────────────────────────────────────────

/**
 * Popula a cena com uma floresta de árvores (pinheiros + carvalhos).
 * Deve ser chamado depois de modelLoaded estar resolvido.
 * @param {THREE.Scene} scene - Cena Three.js onde adicionar as árvores
 */
async function spawnForest(scene) {
    // Awaitar carregamento dos modelos
    await loadAllModels();

    const { evergreenCount, oakCount } = SETTINGS.spawn;
    const usedPositions = []; // Rastrear posições para evitar sobreposição

    // ── Spawnar pinheiros ──
    for (let i = 0; i < evergreenCount; i++) {
        const pos = getRandomSpawnPosition(usedPositions);
        if (pos) {
            const tree = createTree('evergreen', pos);
            scene.add(tree);
            treeInstances.push(tree);
            usedPositions.push(pos.clone());
        }
    }

    // ── Spawnar carvalhos ──
    for (let i = 0; i < oakCount; i++) {
        const pos = getRandomSpawnPosition(usedPositions);
        if (pos) {
            const tree = createTree('oak', pos);
            scene.add(tree);
            treeInstances.push(tree);
            usedPositions.push(pos.clone());
        }
    }

    console.log(`Floresta criada: ${treeInstances.length} árvores`);
}

/**
 * Atualiza a animação de vento de todas as copas.
 * Deve ser chamado no loop de animação com delta time.
 * @param {number} delta - Tempo desde o último frame (segundos)
 */
function update(delta) {
    const now = Date.now() / 1000; // Tempo em segundos
    const { speed, intensityX, intensityZ } = SETTINGS.wind;

    for (const tree of treeInstances) {
        const crown = tree.userData.crownObject;
        if (!crown) continue;

        // Calcular tempo com offset de fase aleatório
        const time = now * speed + tree.userData.windPhaseOffset;

        // Aplicar oscilação de vento (senos e cossenos em fase diferente)
        const rotX = Math.sin(time) * intensityX;
        const rotZ = Math.cos(time * 0.8) * intensityZ; // 0.8 para desincronizar um pouco

        // Aplicar rotação relative (mantendo a rotação base)
        crown.rotation.x = rotX;
        crown.rotation.z = rotZ;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
export { spawnForest, update };
