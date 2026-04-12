import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
    // Escalas dos modelos com ranges aleatórios (cada árvore tem tronco e copa separados)
    scale: {
        evergreen: {
            trunk: { min: 0.3, max: 0.5 },
            crown: { min: 0.3, max: 0.5 },
            crownOffsetY: { min: 0.3, max: 0.8 },
        },
        oak: {
            trunk: { min: 0.3, max: 0.45 },
            crown: { min: 0.3, max: 0.45 },
            crownOffsetY: { min: 0.3, max: 0.5 },
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
        totalTrees: 20,            // Número total de árvores a spawnar
        evergreenPercent: 0.6,     // Percentagem de pinheiros (0-1)
        oakPercent: 0.4,           // Percentagem de carvalhos (0-1)
        areaRadius: 30,            // Raio da área de spawn (em unidades)
        minDistanceApart: 3.0,     // Distância mínima entre árvores
        groundY: 0.5,              // Altura Y onde as árvores spawnam
        clearZoneRadius: 8,        // Raio da zona central circular reservada (fogueira, tenda, etc)
        // Zonas de exclusão adicionais (circular e rectangular)
        exclusionZones: [
            // Exemplo: Zona da queda de água (circular)
            // { type: 'circle', x: 15, z: -10, radius: 5 },
            // Exemplo: Zona do rio (rectangular)
            // { type: 'rect', x: 8, z: 0, halfW: 2, halfD: 12 },
        ],
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
 * Gera um número aleatório entre min e max.
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @returns {number} Número aleatório entre min e max
 */
function randomBetween(min, max) {
    return min + Math.random() * (max - min);
}

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
        loader.load('../elements/Log_Tiered_Evergreen.glb', (gltf) => {
            loadedMeshes.evergreenTrunk = extractFirstMesh(gltf);
            onLoaded();
        });

        // Carregar copa do carvalho
        loader.load('../elements/Green_Cauliflower.glb', (gltf) => {
            loadedMeshes.oakCrown = extractFirstMesh(gltf);
            onLoaded();
        });

        // Carregar tronco do carvalho
        loader.load('../elements/Log_Green_Cauliflower.glb', (gltf) => {
            loadedMeshes.oakTrunk = extractFirstMesh(gltf);
            onLoaded();
        });
    });
}

/**
 * Extrai o primeiro mesh de um modelo GLTF com geometria, material e yOffset.
 * O yOffset é calculado a partir da bounding box (quanto subir para a base ficar em Y=0).
 * @param {Object} gltf - Modelo GLTF carregado
 * @returns {Object} { geometry, material, yOffset }
 */
function extractFirstMesh(gltf) {
    let geometry = null;
    let material = null;
    let yOffset = 0;

    gltf.scene.traverse((child) => {
        if (child.isMesh && !geometry) {
            geometry = child.geometry.clone();
            material = child.material.clone();
            
            // Calcular yOffset usando Box3 com escala 1.0
            const tempMesh = new THREE.Mesh(geometry, material);
            const box = new THREE.Box3().setFromObject(tempMesh);
            yOffset = -box.min.y; // quanto subir para a base ficar em Y=0
        }
    });

    return { geometry, material, yOffset };
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
 * Gera uma posição aleatória dentro da área de spawn, respeitando:
 * - Distância mínima entre árvores
 * - Zona de exclusão central (clearZoneRadius)
 * - Zonas de exclusão adicionais (circular e rectangular)
 * @param {Array<THREE.Vector3>} existingPositions - Posições já ocupadas
 * @returns {THREE.Vector3|null} Nova posição se possível, null se limite atingido
 */
function getRandomSpawnPosition(existingPositions) {
    const { areaRadius, minDistanceApart, groundY, clearZoneRadius, exclusionZones } = SETTINGS.spawn;
    const maxAttempts = 50;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * areaRadius;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const newPos = new THREE.Vector3(x, groundY, z);

        // Verificar zona central de exclusão (clearZoneRadius)
        const distToCenter = Math.sqrt(x * x + z * z);
        if (distToCenter < clearZoneRadius) {
            continue;
        }

        // Verificar zonas de exclusão adicionais
        let inExclusionZone = false;
        for (const zone of exclusionZones) {
            if (zone.type === 'circle') {
                const dx = newPos.x - zone.x;
                const dz = newPos.z - zone.z;
                const distToZone = Math.sqrt(dx * dx + dz * dz);
                if (distToZone < zone.radius) {
                    inExclusionZone = true;
                    break;
                }
            } else if (zone.type === 'rect') {
                const dx = Math.abs(newPos.x - zone.x);
                const dz = Math.abs(newPos.z - zone.z);
                if (dx < zone.halfW && dz < zone.halfD) {
                    inExclusionZone = true;
                    break;
                }
            }
        }
        if (inExclusionZone) {
            continue;
        }

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
 * @param {Object} options - Opções de spawn configuráveis
 *   @param {number} options.totalTrees - Número total de árvores a spawnar (default: SETTINGS.spawn.totalTrees)
 *   @param {number} options.evergreenPercent - Percentagem de pinheiros (0-1, default: SETTINGS.spawn.evergreenPercent)
 *   @param {number} options.oakPercent - Percentagem de carvalhos (0-1, default: SETTINGS.spawn.oakPercent)
 */
async function spawnForest(scene, raccoon, options = {}) {
    // Usar valores padrão do SETTINGS se não forem fornecidas opções
    const totalTrees = options.totalTrees !== undefined ? options.totalTrees : SETTINGS.spawn.totalTrees;
    const evergreenPercent = options.evergreenPercent !== undefined ? options.evergreenPercent : SETTINGS.spawn.evergreenPercent;
    const oakPercent = options.oakPercent !== undefined ? options.oakPercent : SETTINGS.spawn.oakPercent;

    // Calcular número de árvores de cada tipo baseado em percentagens
    const maxEvergreens = Math.ceil(totalTrees * evergreenPercent);
    const maxOaks = Math.ceil(totalTrees * oakPercent);

    // Awaitar carregamento dos modelos
    await loadAllModels();

    // Guardar referência ao marcho do guaxinim para LOD
    if (raccoon) {
        raccoonPosition.copy(raccoon.position);
    }

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
            // Gerar escalas aleatórias para esta árvore
            const randomTrunkScale = randomBetween(SETTINGS.scale.evergreen.trunk.min, SETTINGS.scale.evergreen.trunk.max);
            const randomCrownScale = randomBetween(SETTINGS.scale.evergreen.crown.min, SETTINGS.scale.evergreen.crown.max);
            const randomCrownOffsetY = randomBetween(SETTINGS.scale.evergreen.crownOffsetY.min, SETTINGS.scale.evergreen.crownOffsetY.max);
            
            // Calcular posição Y do tronco com yOffset escalado
            const trunkY = SETTINGS.spawn.groundY + (loadedMeshes.evergreenTrunk.yOffset * randomTrunkScale);
            const trunkPos = pos.clone();
            trunkPos.y = trunkY;
            
            // Matriz para tronco
            const trunkMatrix = new THREE.Matrix4()
                .compose(trunkPos, new THREE.Quaternion(), new THREE.Vector3(randomTrunkScale, randomTrunkScale, randomTrunkScale));
            instancedMeshes.trunkEvergreen.setMatrixAt(evergreenIndex, trunkMatrix);

            // Calcular posição Y da copa com yOffset do tronco + offset configurável + yOffset da copa
            const crownY = trunkY + (randomCrownOffsetY * randomTrunkScale) + (loadedMeshes.evergreenCrown.yOffset * randomCrownScale);
            const crownPos = pos.clone();
            crownPos.y = crownY;
            const crownMatrix = new THREE.Matrix4()
                .compose(crownPos, new THREE.Quaternion(), new THREE.Vector3(randomCrownScale, randomCrownScale, randomCrownScale));
            instancedMeshes.crownEvergreen.setMatrixAt(evergreenIndex, crownMatrix);

            // Guardar metadados para animação (incluindo o crownOffsetY real gerado)
            treeInstances.push({
                type: 'evergreen',
                index: evergreenIndex,
                position: pos,
                windPhaseOffset: Math.random() * Math.PI * 2,
                basePosition: pos.clone(),
                crownOffsetY: randomCrownOffsetY,
                randomScale: randomCrownScale,
                randomTrunkScale: randomTrunkScale,
                trunkY: trunkY,
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
            // Gerar escalas aleatórias para esta árvore
            const randomTrunkScale = randomBetween(SETTINGS.scale.oak.trunk.min, SETTINGS.scale.oak.trunk.max);
            const randomCrownScale = randomBetween(SETTINGS.scale.oak.crown.min, SETTINGS.scale.oak.crown.max);
            const randomCrownOffsetY = randomBetween(SETTINGS.scale.oak.crownOffsetY.min, SETTINGS.scale.oak.crownOffsetY.max);
            
            // Calcular posição Y do tronco com yOffset escalado
            const trunkY = SETTINGS.spawn.groundY + (loadedMeshes.oakTrunk.yOffset * randomTrunkScale);
            const trunkPos = pos.clone();
            trunkPos.y = trunkY;
            
            // Matriz para tronco
            const trunkMatrix = new THREE.Matrix4()
                .compose(trunkPos, new THREE.Quaternion(), new THREE.Vector3(randomTrunkScale, randomTrunkScale, randomTrunkScale));
            instancedMeshes.trunkOak.setMatrixAt(oakIndex, trunkMatrix);

            // Calcular posição Y da copa com yOffset do tronco + offset configurável + yOffset da copa
            const crownY = trunkY + (randomCrownOffsetY * randomTrunkScale) + (loadedMeshes.oakCrown.yOffset * randomCrownScale);
            const crownPos = pos.clone();
            crownPos.y = crownY;
            const crownMatrix = new THREE.Matrix4()
                .compose(crownPos, new THREE.Quaternion(), new THREE.Vector3(randomCrownScale, randomCrownScale, randomCrownScale));
            instancedMeshes.crownOak.setMatrixAt(oakIndex, crownMatrix);

            // Guardar metadados para animação (incluindo o crownOffsetY real gerado)
            treeInstances.push({
                type: 'oak',
                index: oakIndex,
                position: pos,
                windPhaseOffset: Math.random() * Math.PI * 2,
                basePosition: pos.clone(),
                crownOffsetY: randomCrownOffsetY,
                randomScale: randomCrownScale,
                randomTrunkScale: randomTrunkScale,
                trunkY: trunkY,
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

    console.log(`Floresta criada: ${evergreenIndex + oakIndex} árvores (${evergreenIndex} pinheiros, ${oakIndex} carvalhos)`);
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

        // Posicionar a copa com yOffset do tronco + offset configurável + yOffset da copa
        const crownPos = tree.basePosition.clone();
        if (tree.type === 'evergreen') {
            crownPos.y = tree.trunkY + (tree.crownOffsetY * tree.randomTrunkScale) + (loadedMeshes.evergreenCrown.yOffset * tree.randomScale);
        } else if (tree.type === 'oak') {
            crownPos.y = tree.trunkY + (tree.crownOffsetY * tree.randomTrunkScale) + (loadedMeshes.oakCrown.yOffset * tree.randomScale);
        }

        // Criar matriz com transformação animada
        const matrix = new THREE.Matrix4()
            .compose(crownPos, quaternion, new THREE.Vector3(1, 1, 1));

        // Aplicar escala real (armazenada nos metadados)
        const scale = tree.randomScale;
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
