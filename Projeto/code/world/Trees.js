import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
    // Escalas dos modelos (cada árvore tem tronco e copa separados)
    scale: {
        // Pinheiro (Evergreen)
        evergreen: {
            trunk: 0.5,   // Escala do tronco
            crown: 0.5,   // Escala da copa
            crownOffsetY: 0.45, // Altura da copa sobre o tronco
        },
        // Carvalho (Oak)
        oak: {
            trunk: 0.5,
            crown: 0.5,
            crownOffsetY: 0.4,
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
        maxEvergreens: 8,   // Número máximo de pinheiros
        maxOaks: 5,         // Número máximo de carvalhos
        areaRadius: 20,     // Raio da área de spawn (em unidades)
        minDistanceApart: 2.0, // Distância mínima entre árvores
        groundY: 0.5,       // Altura Y onde as árvores spawnam
    },

    // LOD e otimizações de performance
    lod: {
        maxUpdateDistance: 30, // Máxima distância ao guaxinim para atualizar animação de vento
    },
};

// ─── Variáveis Globais ─────────────────────────────────────────────────────
let loadedMeshes = {
    evergreenTrunk: null,
    evergreenCrown: null,
    oakTrunk: null,
    oakCrown: null,
};

let instancedMeshes = {
    trunkEvergreen: null,
    crownEvergreen: null,
    trunkOak: null,
    crownOak: null,
};

let treeInstances = []; // Metadados de cada árvore para animação
let raccoonPosition = new THREE.Vector3(0, 0, 0); // Posição atual do guaxinim (para LOD)

// ─── Funções Privadas ─────────────────────────────────────────────────────

/**
 * Carrega todos os modelos GLB e extrai geometria + material.
 * @returns {Promise} Promessa resolvida quando todos os modelos estiverem carregados
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
            loadedMeshes.evergreenCrown = extractFirstMesh(gltf);
            onLoaded();
        });

        // Carregar tronco do pinheiro
        loader.load('../elements/Oak_Tiered_Evergreen.glb', (gltf) => {
            loadedMeshes.evergreenTrunk = extractFirstMesh(gltf);
            onLoaded();
        });

        // Carregar copa do carvalho
        loader.load('../elements/Green_Cauliflower.glb', (gltf) => {
            loadedMeshes.oakCrown = extractFirstMesh(gltf);
            onLoaded();
        });

        // Carregar tronco do carvalho
        loader.load('../elements/Oak_Green_Cauliflower.glb', (gltf) => {
            loadedMeshes.oakTrunk = extractFirstMesh(gltf);
            onLoaded();
        });
    });
}

/**
 * Extrai o primeiro mesh de um modelo GLTF com geometria e material.
 * @param {Object} gltf - Modelo GLTF carregado
 * @returns {Object} { geometry, material }
 */
function extractFirstMesh(gltf) {
    let geometry = null;
    let material = null;

    gltf.scene.traverse((child) => {
        if (child.isMesh && !geometry) {
            geometry = child.geometry.clone();
            material = child.material.clone();
        }
    });

    return { geometry, material };
}

/**
 * Cria um InstancedMesh para múltiplas instâncias do mesmo modelo.
 * @param {Object} meshData - { geometry, material }
 * @param {number} count - Número de instâncias
 * @returns {THREE.InstancedMesh}
 */
function createInstancedMesh(meshData, count) {
    const { geometry, material } = meshData;
    
    // Garantir que o material renderiza apenas a face frontal (otimização)
    material.side = THREE.FrontSide;
    
    const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
    instancedMesh.castShadow = true;
    instancedMesh.receiveShadow = true;
    
    // Ativar frustum culling (deve estar ativo por defeito, mas confirmar)
    instancedMesh.frustumCulled = true;
    
    return instancedMesh;
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

    return null;
}

// ─── Funções Públicas ─────────────────────────────────────────────────────

/**
 * Popula a cena com uma floresta usando InstancedMesh (otimizado para performance).
 * @param {THREE.Scene} scene - Cena Three.js
 * @param {THREE.Group} raccoon - Modelo do guaxinim (para LOD)
 */
async function spawnForest(scene, raccoon) {
    // Awaitar carregamento dos modelos
    await loadAllModels();

    // Guardar referência ao marcho do guaxinim para LOD
    if (raccoon) {
        raccoonPosition.copy(raccoon.position);
    }

    const { maxEvergreens, maxOaks } = SETTINGS.spawn;
    const usedPositions = [];

    // ── Criar InstancedMeshes ──
    instancedMeshes.trunkEvergreen = createInstancedMesh(loadedMeshes.evergreenTrunk, maxEvergreens);
    instancedMeshes.crownEvergreen = createInstancedMesh(loadedMeshes.evergreenCrown, maxEvergreens);
    instancedMeshes.trunkOak = createInstancedMesh(loadedMeshes.oakTrunk, maxOaks);
    instancedMeshes.crownOak = createInstancedMesh(loadedMeshes.oakCrown, maxOaks);

    // ── Spawnar pinheiros ──
    let evergreenIndex = 0;
    for (let i = 0; i < maxEvergreens; i++) {
        const pos = getRandomSpawnPosition(usedPositions);
        if (pos) {
            const config = SETTINGS.scale.evergreen;
            
            // Matriz para tronco
            const trunkMatrix = new THREE.Matrix4()
                .compose(pos, new THREE.Quaternion(), new THREE.Vector3(config.trunk, config.trunk, config.trunk));
            instancedMeshes.trunkEvergreen.setMatrixAt(evergreenIndex, trunkMatrix);

            // Matriz para copa (com offset Y)
            const crownPos = pos.clone();
            crownPos.y += config.crownOffsetY;
            const crownMatrix = new THREE.Matrix4()
                .compose(crownPos, new THREE.Quaternion(), new THREE.Vector3(config.crown, config.crown, config.crown));
            instancedMeshes.crownEvergreen.setMatrixAt(evergreenIndex, crownMatrix);

            // Guardar metadados para animação
            treeInstances.push({
                type: 'evergreen',
                index: evergreenIndex,
                position: pos,
                windPhaseOffset: Math.random() * Math.PI * 2,
                basePosition: pos.clone(),
                crownOffsetY: config.crownOffsetY,
            });

            usedPositions.push(pos.clone());
            evergreenIndex++;
        }
    }
    instancedMeshes.trunkEvergreen.count = evergreenIndex;
    instancedMeshes.crownEvergreen.count = evergreenIndex;
    instancedMeshes.trunkEvergreen.instanceMatrix.needsUpdate = true;
    instancedMeshes.crownEvergreen.instanceMatrix.needsUpdate = true;

    // ── Spawnar carvalhos ──
    let oakIndex = 0;
    for (let i = 0; i < maxOaks; i++) {
        const pos = getRandomSpawnPosition(usedPositions);
        if (pos) {
            const config = SETTINGS.scale.oak;
            
            // Matriz para tronco
            const trunkMatrix = new THREE.Matrix4()
                .compose(pos, new THREE.Quaternion(), new THREE.Vector3(config.trunk, config.trunk, config.trunk));
            instancedMeshes.trunkOak.setMatrixAt(oakIndex, trunkMatrix);

            // Matriz para copa (com offset Y)
            const crownPos = pos.clone();
            crownPos.y += config.crownOffsetY;
            const crownMatrix = new THREE.Matrix4()
                .compose(crownPos, new THREE.Quaternion(), new THREE.Vector3(config.crown, config.crown, config.crown));
            instancedMeshes.crownOak.setMatrixAt(oakIndex, crownMatrix);

            // Guardar metadados para animação
            treeInstances.push({
                type: 'oak',
                index: oakIndex,
                position: pos,
                windPhaseOffset: Math.random() * Math.PI * 2,
                basePosition: pos.clone(),
                crownOffsetY: config.crownOffsetY,
            });

            usedPositions.push(pos.clone());
            oakIndex++;
        }
    }
    instancedMeshes.trunkOak.count = oakIndex;
    instancedMeshes.crownOak.count = oakIndex;
    instancedMeshes.trunkOak.instanceMatrix.needsUpdate = true;
    instancedMeshes.crownOak.instanceMatrix.needsUpdate = true;

    // ── Configuração de Raycast para Colisão ──
    // InstancedMeshes não suportam raycast por defeito — adicionar suporte manualmente
    if (evergreenIndex > 0) {
        instancedMeshes.trunkEvergreen.raycast = THREE.InstancedMesh.prototype.raycast.bind(instancedMeshes.trunkEvergreen);
        instancedMeshes.trunkEvergreen.layers.set(0); // Garantir que está na layer 0 (padrão)
    }
    if (oakIndex > 0) {
        instancedMeshes.trunkOak.raycast = THREE.InstancedMesh.prototype.raycast.bind(instancedMeshes.trunkOak);
        instancedMeshes.trunkOak.layers.set(0); // Garantir que está na layer 0 (padrão)
    }

    // ── Adicionar à cena ──
    if (evergreenIndex > 0) {
        scene.add(instancedMeshes.trunkEvergreen);
        scene.add(instancedMeshes.crownEvergreen);
    }
    if (oakIndex > 0) {
        scene.add(instancedMeshes.trunkOak);
        scene.add(instancedMeshes.crownOak);
    }

    console.log(`Floresta criada: ${evergreenIndex + oakIndex} árvores (InstancedMesh otimizado)`);
}

/**
 * Atualiza a animação de vento de todas as copas.
 * Usa setMatrixAt para atualizar cada instância com rotação procedural.
 * LOD: apenas árvores próximas ao guaxinim são animadas.
 * @param {number} delta - Tempo desde o último frame (segundos)
 * @param {THREE.Vector3} playerPos - Posição do guaxinim (para LOD)
 */
function update(delta, playerPos) {
    const now = Date.now() / 1000; // Tempo em segundos
    const { speed, intensityX, intensityZ } = SETTINGS.wind;
    const { maxUpdateDistance } = SETTINGS.lod;

    // Atualizar posição do guaxinim se fornecida
    if (playerPos) {
        raccoonPosition.copy(playerPos);
    }

    for (const tree of treeInstances) {
        // ── LOD: Verificar distância ──
        const distance = tree.basePosition.distanceTo(raccoonPosition);
        
        // Se a árvore está muito longe, não animar (apenas manter a posição estática)
        if (distance > maxUpdateDistance) {
            continue;
        }

        // Calcular tempo com offset de fase aleatório
        const time = now * speed + tree.windPhaseOffset;

        // Aplicar oscilação de vento
        const rotX = Math.sin(time) * intensityX;
        const rotZ = Math.cos(time * 0.8) * intensityZ;

        // Criar quaternião com as rotações
        const qX = new THREE.Quaternion();
        qX.setFromAxisAngle(new THREE.Vector3(1, 0, 0), rotX);
        const qZ = new THREE.Quaternion();
        qZ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), rotZ);
        const quaternion = qX.multiply(qZ);

        // Posição da copa (com offset Y do tronco)
        const crownPos = tree.basePosition.clone();
        crownPos.y += tree.crownOffsetY;

        // Criar matriz com transformação animada
        const matrix = new THREE.Matrix4()
            .compose(crownPos, quaternion, new THREE.Vector3(1, 1, 1));

        // Aplicar escala
        const scale = SETTINGS.scale[tree.type].crown;
        matrix.scale(new THREE.Vector3(scale, scale, scale));

        // Atualizar InstancedMesh
        if (tree.type === 'evergreen') {
            instancedMeshes.crownEvergreen.setMatrixAt(tree.index, matrix);
            instancedMeshes.crownEvergreen.instanceMatrix.needsUpdate = true;
        } else if (tree.type === 'oak') {
            instancedMeshes.crownOak.setMatrixAt(tree.index, matrix);
            instancedMeshes.crownOak.instanceMatrix.needsUpdate = true;
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
export { spawnForest, update };
