import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getAssetPath } from '../../config.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
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
    wind: {
        speed: 1.0,
        intensityX: 0.15,
        intensityZ: 0.12,
    },
    spawn: {
        totalTrees: 180,
        evergreenPercent: 0.6,
        oakPercent: 0.4,
        centerX: 0,
        centerZ: 1.5,
        innerRadius: 3,
        outerRadius: 7.5,
        // Espaçamento da grelha hexagonal = distância mínima entre árvores
        spacing: 0.6,
        // Jitter máximo aplicado a cada posição da grelha (% do espaçamento)
        jitterFactor: 0.3,
        groundY: 0.0,
    },
    lod: {
        animateDistance: 4,
        staticDistance: 25,
        // Throttle do vento: atualizar a ~30Hz em vez de 60Hz
        windUpdateInterval: 0.033,
    },
};

// ─── Estado do Módulo ─────────────────────────────────────────────────────────
let loadedMeshes = { evergreenTrunk: null, evergreenCrown: null, oakTrunk: null, oakCrown: null };
let instancedMeshes = { trunkEvergreen: null, crownEvergreen: null, trunkOak: null, crownOak: null };
let treeInstances = [];
let raccoonPosition = new THREE.Vector3();

// ─── Objectos pré-alocados (reutilizados em SPAWN e UPDATE) ──────────────────
const _qX = new THREE.Quaternion();
const _qZ = new THREE.Quaternion();
const _matrix = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _axis = new THREE.Vector3();
// Quaternião neutro reutilizável no spawn (nunca modificado)
const _identQ = new THREE.Quaternion();

// ─── FUNÇÕES AUXILIARES ───────────────────────────────────────────────────────

/** @param {number} min @param {number} max @returns {number} */
function rand(min, max) { return min + Math.random() * (max - min); }

/**
 * Verifica se um ponto (x, z) está dentro de uma zona de exclusão.
 * @param {number} x
 * @param {number} z
 * @param {Object} zone - { type: 'circle'|'rect', ... }
 */
function inExclusionZone(x, z, zone) {
    if (zone.type === 'circle') {
        const dx = x - zone.x, dz = z - zone.z;
        return dx * dx + dz * dz < zone.radius * zone.radius;
    }
    if (zone.type === 'rect') {
        return Math.abs(x - zone.x) < zone.halfW && Math.abs(z - zone.z) < zone.halfD;
    }
    return false;
}

/**
 * Gera posições para a floresta usando uma grelha hexagonal com jitter.
 * Complexidade O(n) — sem rejeições encadeadas (era O(n²) com tentativas aleatórias).
 *
 * Algoritmo:
 *  1. Gera pontos numa grelha hex regular que cobre o anel [innerRadius, outerRadius]
 *  2. Filtra pontos fora do anel e dentro das zonas de exclusão
 *  3. Aplica jitter aleatório a cada ponto aceite (aspeto natural)
 *  4. Mistura a lista (Fisher-Yates) para distribuição aleatória entre tipos
 *
 * @param {Array}  exclusionZones
 * @returns {THREE.Vector3[]} Posições válidas misturadas
 */
function generateForestPositions(exclusionZones) {
    const { innerRadius, outerRadius, spacing, jitterFactor, groundY, centerX, centerZ } = SETTINGS.spawn;
    const rowStep = spacing * Math.sqrt(3) / 2;   // altura de linha na grelha hex
    const jitter = spacing * jitterFactor;
    const maxCoord = outerRadius + spacing;
    const maxRows = Math.ceil(maxCoord / rowStep);
    const maxCols = Math.ceil(maxCoord / spacing);
    const ir2 = innerRadius * innerRadius;
    const or2 = outerRadius * outerRadius;

    const candidates = [];

    for (let row = -maxRows; row <= maxRows; row++) {
        const z = row * rowStep + centerZ;
        const xOffset = (row % 2 !== 0) ? spacing * 0.5 : 0; // alternância hex

        for (let col = -maxCols; col <= maxCols; col++) {
            const x = col * spacing + xOffset + centerX;
            const dist2 = (x - centerX) ** 2 + (z - centerZ) ** 2;

            // Verificar anel
            if (dist2 < ir2 || dist2 > or2) continue;

            // Verificar zonas de exclusão
            let excluded = false;
            for (const zone of exclusionZones) {
                if (inExclusionZone(x, z, zone)) { excluded = true; break; }
            }
            if (excluded) continue;

            // Aplicar jitter (mantém aspeto natural sem custo de rejection)
            const jx = x + (Math.random() - 0.5) * jitter;
            const jz = z + (Math.random() - 0.5) * jitter;
            candidates.push(new THREE.Vector3(jx, groundY, jz));
        }
    }

    // Fisher-Yates shuffle — distribui tipos aleatoriamente pela grelha
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = candidates[i];
        candidates[i] = candidates[j];
        candidates[j] = tmp;
    }

    return candidates;
}

/**
 * Carrega os 4 modelos GLB em paralelo usando Promise.all.
 */
function loadAllModels() {
    const loader = new GLTFLoader();
    const load = (path) => new Promise((resolve, reject) => loader.load(path, resolve, undefined, reject));

    return Promise.all([
        load(getAssetPath('elements/Copa_Tiered_Evergreen.glb')),
        load(getAssetPath('elements/Log_Tiered_Evergreen.glb')),
        load(getAssetPath('elements/Green_Cauliflower.glb')),
        load(getAssetPath('elements/Log_Green_Cauliflower.glb')),
    ]).then(([evCrown, evTrunk, oakCrown, oakTrunk]) => {
        loadedMeshes.evergreenCrown = extractFirstMesh(evCrown);
        loadedMeshes.evergreenTrunk = extractFirstMesh(evTrunk);
        loadedMeshes.oakCrown = extractFirstMesh(oakCrown);
        loadedMeshes.oakTrunk = extractFirstMesh(oakTrunk);
    });
}

/**
 * Extrai geometria, material e yOffset do primeiro mesh de um GLTF.
 * Converte para MeshLambertMaterial (muito mais rápido que MeshStandardMaterial/PBR).
 * alphaTest corta pixels transparentes nas folhas sem precisar de blending.
 * @param {Object} gltf
 * @returns {{ geometry, material, yOffset }}
 */
function extractFirstMesh(gltf) {
    let geometry = null, srcMaterial = null, yOffset = 0;
    gltf.scene.traverse(child => {
        if (child.isMesh && !geometry) {
            geometry = child.geometry.clone();
            srcMaterial = child.material;
            const box = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
            yOffset = -box.min.y;
        }
    });

    // MeshLambertMaterial — shader muito mais simples que PBR/MeshStandardMaterial.
    // Para árvores (elementos de fundo) a diferença visual é imperceptível.
    const material = new THREE.MeshLambertMaterial({
        color: srcMaterial?.color ?? 0xffffff,
        map: srcMaterial?.map ?? null,
        // alphaTest corta as folhas sem blending order (mais rápido que transparent:true)
        alphaTest: (srcMaterial?.alphaTest > 0) ? srcMaterial.alphaTest : 0.4,
        transparent: false, // alphaTest já trata a transparência
    });

    return { geometry, material, yOffset };
}

/**
 * Cria um InstancedMesh otimizado para múltiplas árvores do mesmo tipo.
 * @param {{ geometry, material }} meshData
 * @param {number} count
 * @returns {THREE.InstancedMesh}
 */
function createInstancedMesh(meshData, count) {
    const { geometry, material } = meshData;
    material.side = THREE.FrontSide; // só face frontal — metade dos fragmentos

    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.castShadow = false; // 180 árvores × shadow = demasiado custoso
    mesh.receiveShadow = true;
    mesh.frustumCulled = true;
    return mesh;
}

/**
 * Define a matrix de uma instância usando objectos pré-alocados (sem alocações).
 * @param {THREE.InstancedMesh} instMesh
 * @param {number}              idx
 * @param {THREE.Vector3}       position
 * @param {number}              scale
 */
function setInstanceMatrix(instMesh, idx, position, scale) {
    _scale.setScalar(scale);
    _matrix.compose(position, _identQ, _scale);
    instMesh.setMatrixAt(idx, _matrix);
}

// ─── FUNÇÃO PÚBLICA — SPAWN ────────────────────────────────────────────────────

/**
 * Popula a cena com a floresta usando InstancedMesh.
 * Posições geradas com grelha hexagonal + jitter (O(n), sem rejeições).
 * @param {THREE.Scene}  scene
 * @param {THREE.Group}  raccoon
 * @param {Object}       options - { exclusionZones, totalTrees, evergreenPercent, oakPercent }
 */
async function spawnForest(scene, raccoon, options = {}) {
    const totalTrees = options.totalTrees ?? SETTINGS.spawn.totalTrees;
    const evergreenPercent = options.evergreenPercent ?? SETTINGS.spawn.evergreenPercent;
    const oakPercent = options.oakPercent ?? SETTINGS.spawn.oakPercent;
    const exclusionZones = options.exclusionZones ?? [];

    const maxEvergreens = Math.ceil(totalTrees * evergreenPercent);
    const maxOaks = Math.ceil(totalTrees * oakPercent);

    await loadAllModels();

    if (raccoon) raccoonPosition.copy(raccoon.position);

    // Gerar todas as posições de uma vez (O(n))
    const positions = generateForestPositions(exclusionZones);
    let posIdx = 0;

    // ── InstancedMeshes ──
    instancedMeshes.trunkEvergreen = createInstancedMesh(loadedMeshes.evergreenTrunk, maxEvergreens);
    instancedMeshes.crownEvergreen = createInstancedMesh(loadedMeshes.evergreenCrown, maxEvergreens);
    instancedMeshes.trunkOak = createInstancedMesh(loadedMeshes.oakTrunk, maxOaks);
    instancedMeshes.crownOak = createInstancedMesh(loadedMeshes.oakCrown, maxOaks);

    // ── Pinheiros ────────────────────────────────────────────────────────────
    let evIdx = 0;
    for (let i = 0; i < maxEvergreens && posIdx < positions.length; i++, posIdx++) {
        const pos = positions[posIdx];
        const trunkScale = rand(SETTINGS.scale.evergreen.trunk.min, SETTINGS.scale.evergreen.trunk.max);
        const crownScale = rand(SETTINGS.scale.evergreen.crown.min, SETTINGS.scale.evergreen.crown.max);
        const crownOffsetY = rand(SETTINGS.scale.evergreen.crownOffsetY.min, SETTINGS.scale.evergreen.crownOffsetY.max);
        const trunkY = SETTINGS.spawn.groundY + loadedMeshes.evergreenTrunk.yOffset * trunkScale;

        _pos.copy(pos).setY(trunkY);
        setInstanceMatrix(instancedMeshes.trunkEvergreen, evIdx, _pos, trunkScale);

        const crownY = trunkY + crownOffsetY * trunkScale + loadedMeshes.evergreenCrown.yOffset * crownScale;
        _pos.copy(pos).setY(crownY);
        setInstanceMatrix(instancedMeshes.crownEvergreen, evIdx, _pos, crownScale);

        treeInstances.push({
            type: 'evergreen', index: evIdx,
            basePosition: pos.clone(),
            windPhaseOffset: Math.random() * Math.PI * 2,
            crownOffsetY, randomScale: crownScale, randomTrunkScale: trunkScale, trunkY,
        });
        evIdx++;
    }
    instancedMeshes.trunkEvergreen.count = evIdx;
    instancedMeshes.crownEvergreen.count = evIdx;
    instancedMeshes.trunkEvergreen.instanceMatrix.needsUpdate = true;
    instancedMeshes.crownEvergreen.instanceMatrix.needsUpdate = true;

    // ── Carvalhos ─────────────────────────────────────────────────────────────
    let oakIdx = 0;
    for (let i = 0; i < maxOaks && posIdx < positions.length; i++, posIdx++) {
        const pos = positions[posIdx];
        const trunkScale = rand(SETTINGS.scale.oak.trunk.min, SETTINGS.scale.oak.trunk.max);
        const crownScale = rand(SETTINGS.scale.oak.crown.min, SETTINGS.scale.oak.crown.max);
        const crownOffsetY = rand(SETTINGS.scale.oak.crownOffsetY.min, SETTINGS.scale.oak.crownOffsetY.max);
        const trunkY = SETTINGS.spawn.groundY + loadedMeshes.oakTrunk.yOffset * trunkScale;

        _pos.copy(pos).setY(trunkY);
        setInstanceMatrix(instancedMeshes.trunkOak, oakIdx, _pos, trunkScale);

        const crownY = trunkY + crownOffsetY * trunkScale + loadedMeshes.oakCrown.yOffset * crownScale;
        _pos.copy(pos).setY(crownY);
        setInstanceMatrix(instancedMeshes.crownOak, oakIdx, _pos, crownScale);

        treeInstances.push({
            type: 'oak', index: oakIdx,
            basePosition: pos.clone(),
            windPhaseOffset: Math.random() * Math.PI * 2,
            crownOffsetY, randomScale: crownScale, randomTrunkScale: trunkScale, trunkY,
        });
        oakIdx++;
    }
    instancedMeshes.trunkOak.count = oakIdx;
    instancedMeshes.crownOak.count = oakIdx;
    instancedMeshes.trunkOak.instanceMatrix.needsUpdate = true;
    instancedMeshes.crownOak.instanceMatrix.needsUpdate = true;

    // ── Raycast e adição à cena ───────────────────────────────────────────────
    if (evIdx > 0) {
        instancedMeshes.trunkEvergreen.raycast = THREE.InstancedMesh.prototype.raycast.bind(instancedMeshes.trunkEvergreen);
        scene.add(instancedMeshes.trunkEvergreen);
        scene.add(instancedMeshes.crownEvergreen);
    }
    if (oakIdx > 0) {
        instancedMeshes.trunkOak.raycast = THREE.InstancedMesh.prototype.raycast.bind(instancedMeshes.trunkOak);
        scene.add(instancedMeshes.trunkOak);
        scene.add(instancedMeshes.crownOak);
    }

    console.log(`Floresta criada: ${evIdx + oakIdx} árvores (${evIdx} pinheiros, ${oakIdx} carvalhos)`);
}

// ─── FUNÇÃO PÚBLICA — UPDATE (VENTO) ─────────────────────────────────────────

/**
 * Anima a copa das árvores próximas ao jogador com oscilação procedural de vento.
 * Throttle: só corre a ~30 Hz (não em cada frame).
 * @param {number}        delta
 * @param {THREE.Vector3} playerPos
 */
let _windTimeSince = 0;

function update(delta, playerPos) {
    // Throttle: apenas atualizar o vento a ~30 Hz
    _windTimeSince += delta;
    if (_windTimeSince < SETTINGS.lod.windUpdateInterval) return;
    const elapsed = _windTimeSince;
    _windTimeSince = 0;

    const now = Date.now() / 1000;
    const { speed, intensityX, intensityZ } = SETTINGS.wind;
    const { animateDistance, staticDistance } = SETTINGS.lod;

    if (playerPos) raccoonPosition.copy(playerPos);

    let evUpdated = false;
    let oakUpdated = false;

    for (const tree of treeInstances) {
        const dist = tree.basePosition.distanceTo(raccoonPosition);
        if (dist >= staticDistance || dist >= animateDistance) continue;

        const time = now * speed + tree.windPhaseOffset;
        _qX.setFromAxisAngle(_axis.set(1, 0, 0), Math.sin(time) * intensityX);
        _qZ.setFromAxisAngle(_axis.set(0, 0, 1), Math.cos(time * 0.8) * intensityZ);
        const q = _qX.multiply(_qZ);

        _pos.copy(tree.basePosition);
        const mesh = loadedMeshes;
        if (tree.type === 'evergreen') {
            _pos.y = tree.trunkY + tree.crownOffsetY * tree.randomTrunkScale + mesh.evergreenCrown.yOffset * tree.randomScale;
        } else {
            _pos.y = tree.trunkY + tree.crownOffsetY * tree.randomTrunkScale + mesh.oakCrown.yOffset * tree.randomScale;
        }

        _scale.setScalar(tree.randomScale);
        _matrix.compose(_pos, q, _scale);

        if (tree.type === 'evergreen') {
            instancedMeshes.crownEvergreen.setMatrixAt(tree.index, _matrix);
            evUpdated = true;
        } else {
            instancedMeshes.crownOak.setMatrixAt(tree.index, _matrix);
            oakUpdated = true;
        }
    }

    if (evUpdated) instancedMeshes.crownEvergreen.instanceMatrix.needsUpdate = true;
    if (oakUpdated) instancedMeshes.crownOak.instanceMatrix.needsUpdate = true;
}

export { spawnForest, update };
