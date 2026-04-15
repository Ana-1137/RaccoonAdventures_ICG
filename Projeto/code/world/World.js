import * as THREE from 'three';
import { createGround } from './scene.js';
import { spawnForest } from './Trees.js';
import { loadTent } from '../entities/Tent.js';
import { loadCampfire } from '../entities/Campfire.js';
import { loadLogBenches } from '../entities/LogBench.js';
import { loadWaterfalls, SETTINGS as WATERFALLS_SETTINGS } from '../entities/Waterfalls.js';
import { createWater, WATER_SETTINGS } from '../entities/Water.js';

/**
 * Constrói o mundo carregando todos os elementos da cena em paralelo.
 * @param {THREE.Scene} scene - Cena Three.js
 * @param {THREE.Group} raccoon - Modelo do guaxinim (para LOD da floresta)
 * @returns {Promise<Object>} Objeto com referências aos elementos carregados
 */
export async function buildWorld(scene, raccoon) {
    // Criar o chão (síncrono, mas retorna meshes)
    const { groundMesh, campfireMesh } = createGround();
    scene.add(groundMesh);
    scene.add(campfireMesh);
    
    // Carregar floresta, tenda, fogueira, logs, cascatas e água em paralelo
    // A floresta recebe as zonas de exclusão das cascatas E do vale para evitar árvores nesses locais
    const [forest, tent, campfire, logBenches, waterfalls, { waterfall, basin }] = await Promise.all([
        spawnForest(scene, raccoon, { exclusionZones: [WATERFALLS_SETTINGS.exclusionZone, WATER_SETTINGS.valeExclusionZone] }),
        loadTent(scene),
        loadCampfire(scene),
        loadLogBenches(scene),
        loadWaterfalls(scene),
        createWater(scene),
    ]);
    
    return {
        groundMesh,
        campfireMesh,
        forest,
        tent,
        campfire,
        logBenches,
        waterfalls,
        waterfall,
        basin,
    };
}
