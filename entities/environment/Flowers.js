import * as THREE from 'three';
import { loadGLTF, cloneScene, freezeObject } from '../../core/AssetCache.js';
import { getAssetPath } from '../../config.js';

const SETTINGS = {
    count: 10,
    scale: { min: 0.06, max: 0.12 },
    collectRadius: 0.6,
    // Mesmo anel da floresta — flores ficam entre as árvores
    spawn: { centerX: 0, centerZ: 1.5, innerR: 3.2, outerR: 6.5 },
};

// Estado do módulo
const _flowers = [];   // { mesh, collected }
let _collected = 0;
let _total = 0;
let _onCollect = null; // callback(collected, total)

/**
 * Spawna flores aleatórias dentro do anel da floresta.
 * Deve ser chamado DEPOIS de spawnForest (o GLB já estará em cache HTTP).
 * @param {THREE.Scene} scene
 * @param {Array}       exclusionZones  — mesmas zonas da floresta
 * @param {Function}    [onCollect]     — callback(collected, total)
 */
export async function createFlowers(scene, exclusionZones = [], onCollect = null) {
    _onCollect = onCollect;

    // loadGLTF usa cache em memória — se a floresta já carregou outros GLBs,
    // o Flower.glb é carregado uma única vez e reutilizado via clone.
    const gltf = await loadGLTF(getAssetPath('elements/Flower.glb'));

    const { count, scale, spawn } = SETTINGS;
    const { centerX, centerZ, innerR, outerR } = spawn;
    const ir2 = innerR * innerR, or2 = outerR * outerR;

    let placed = 0;
    let attempts = 0;
    const maxAttempts = count * 20;

    while (placed < count && attempts < maxAttempts) {
        attempts++;
        const angle = Math.random() * Math.PI * 2;
        const r = innerR + Math.random() * (outerR - innerR);
        const x = centerX + Math.cos(angle) * r;
        const z = centerZ + Math.sin(angle) * r;

        // Verificar anel (redundante mas seguro)
        const d2 = (x - centerX) ** 2 + (z - centerZ) ** 2;
        if (d2 < ir2 || d2 > or2) continue;

        // Verificar zonas de exclusão
        let excluded = false;
        for (const zone of exclusionZones) {
            if (_inZone(x, z, zone)) { excluded = true; break; }
        }
        if (excluded) continue;

        const s = scale.min + Math.random() * (scale.max - scale.min);
        const mesh = cloneScene(gltf);
        mesh.scale.setScalar(s);
        mesh.position.set(x, 0, z);
        mesh.rotation.y = Math.random() * Math.PI * 2;
        freezeObject(mesh);   // matrix estática — sem custo por frame
        scene.add(mesh);

        _flowers.push({ mesh, collected: false });
        placed++;
    }

    _total = _flowers.length;
    return _flowers.length;
}

/**
 * Verifica proximidade do jogador e coleta flores.
 * Chamar no loop animate().
 * @param {THREE.Vector3} playerPos
 * @returns {number} total coletado
 */
export function updateFlowers(playerPos) {
    if (_collected === _total) return _collected;

    const r2 = SETTINGS.collectRadius ** 2;
    for (const f of _flowers) {
        if (f.collected) continue;
        const dx = playerPos.x - f.mesh.position.x;
        const dz = playerPos.z - f.mesh.position.z;
        if (dx * dx + dz * dz < r2) {
            f.collected = true;
            f.mesh.visible = false;
            _collected++;
            if (_onCollect) _onCollect(_collected, _total);
        }
    }
    return _collected;
}

export function getFlowerCount() { return { collected: _collected, total: _total }; }

// ─── helpers ────────────────────────────────────────────────────────────────
function _inZone(x, z, zone) {
    if (zone.type === 'circle') {
        const dx = x - zone.x, dz = z - zone.z;
        return dx * dx + dz * dz < zone.radius * zone.radius;
    }
    if (zone.type === 'rect') {
        return Math.abs(x - zone.x) < zone.halfW && Math.abs(z - zone.z) < zone.halfD;
    }
    return false;
}
