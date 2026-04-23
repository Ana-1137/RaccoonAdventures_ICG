import * as THREE from 'three';
import { createGround } from './Ground.js';
import { spawnForest }  from '../entities/environment/Forest.js';
import { loadTent }      from '../entities/environment/Tent.js';
import { loadCampfire }  from '../entities/environment/Campfire.js';
import { loadLogBenches } from '../entities/environment/LogBench.js';
import { loadWaterfalls, SETTINGS as WATERFALLS_SETTINGS } from '../entities/environment/Waterfalls.js';
import { loadBoundaryWall } from '../entities/environment/BoundaryWall.js';
import { createWater, WATER_SETTINGS } from '../entities/environment/Water.js';

/**
 * Constrói o mundo carregando todos os elementos da cena em paralelo.
 * Orquestra: chão, floresta, tenda, fogueira, bancos, cascatas e água.
 * @param {THREE.Scene}  scene   - Cena Three.js
 * @param {THREE.Group}  raccoon - Modelo do guaxinim (para LOD da floresta)
 * @returns {Promise<Object>} Objeto com referências aos elementos carregados
 */
export async function buildWorld(scene, raccoon) {
    // ── Chão (síncrono) ─────────────────────────────────────────────────────
    const { groundMesh, campfireMesh } = createGround();
    scene.add(groundMesh);
    scene.add(campfireMesh);

    // ── Elementos assíncronos em paralelo ────────────────────────────────────
    // A floresta recebe as zonas de exclusão das cascatas e do vale
    const [forest, tent, campfire, logBenches, waterfalls, { waterfall, basin }] = await Promise.all([
        spawnForest(scene, raccoon, {
            exclusionZones: [
                WATERFALLS_SETTINGS.exclusionZone,
                WATER_SETTINGS.valeExclusionZone,
            ],
        }),
        loadTent(scene),
        loadCampfire(scene),
        loadLogBenches(scene),
        loadWaterfalls(scene),
        loadBoundaryWall(scene),
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
