import * as THREE from 'three';
import { createGround } from './Ground.js';
import { spawnForest } from '../entities/environment/Forest.js';
import { loadTent, TENT_SETTINGS } from '../entities/environment/Tent.js';
import { loadCampfire } from '../entities/environment/Campfire.js';
import { loadLogBenches } from '../entities/environment/LogBench.js';
import { loadWaterfalls, SETTINGS as WATERFALLS_SETTINGS } from '../entities/environment/Waterfalls.js';
import { loadBoundaryWall } from '../entities/environment/BoundaryWall.js';
import { createWater, WATER_SETTINGS } from '../entities/environment/Water.js';
import { createFish } from '../entities/environment/Fish.js';
import { createFireflies } from '../entities/environment/Fireflies.js';
import { createFlowers } from '../entities/environment/Flowers.js';
import { createBirds } from '../entities/environment/Birds.js';
import { playCollect } from './SoundManager.js';

/**
 * Constrói o mundo carregando todos os elementos da cena em paralelo.
 * Orquestra: chão, floresta, tenda, fogueira, bancos, cascatas e água.
 * @param {THREE.Scene}  scene   - Cena Three.js
 * @param {THREE.Group}  raccoon - Modelo do guaxinim (para LOD da floresta)
 * @param {Function}     [onProgress] - callback(pct 0-100, msg)
 * @returns {Promise<Object>} Objeto com referências aos elementos carregados
 */
export async function buildWorld(scene, raccoon, onProgress = null) {
    const progress = (pct, msg) => onProgress?.(pct, msg);

    // ── Chão (síncrono) ─────────────────────────────────────────────────────
    const { groundMesh, campfireMesh } = createGround();
    scene.add(groundMesh);
    scene.add(campfireMesh);
    progress(10, 'Chão criado...');

    // ── Zonas de exclusão partilhadas ────────────────────────────────────────
    const exclusionZones = [
        WATERFALLS_SETTINGS.exclusionZone,
        WATER_SETTINGS.valeExclusionZone,
        TENT_SETTINGS.exclusionZone,
    ];

    // ── Elementos assíncronos em paralelo ────────────────────────────────────
    progress(15, 'A carregar elementos...');
    const [forest, tent, campfire, logBenches, waterfalls, { waterfall, basin }] = await Promise.all([
        spawnForest(scene, raccoon, { exclusionZones }),
        loadTent(scene),
        loadCampfire(scene),
        loadLogBenches(scene),
        loadWaterfalls(scene),
        loadBoundaryWall(scene),
        createWater(scene),
    ]);
    progress(75, 'Floresta e estruturas prontas...');

    createFish(scene);
    createFireflies(scene);
    createBirds(scene);

    // ── Chão invisível ao nível da água (impede afundar no vale) ─────────────
    const waterFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 9.3),
        new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide })
    );
    waterFloor.rotation.x = -Math.PI / 2;
    waterFloor.position.set(2.6, -0.2, 0);
    scene.add(waterFloor);
    progress(85, 'Fauna criada...');

    // ── Flores: após floresta, mesmas zonas de exclusão ──────────────────────
    await createFlowers(scene, exclusionZones, () => playCollect());
    progress(100, 'Pronto!');

    return {
        groundMesh, campfireMesh,
        forest, tent, campfire, logBenches,
        waterfalls, waterfall, basin,
    };
}
