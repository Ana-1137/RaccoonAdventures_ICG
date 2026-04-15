import * as THREE from 'three';
import { createGround } from './scene.js';
import { spawnForest } from './Trees.js';
import { loadTent } from '../entities/Tent.js';
import { loadCampfire } from '../entities/Campfire.js';
import { loadLogBenches } from '../entities/LogBench.js';

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
    
    // Carregar floresta, tenda, fogueira e logs em paralelo
    const [forest, tent, campfire, logBenches] = await Promise.all([
        spawnForest(scene, raccoon),
        loadTent(scene),
        loadCampfire(scene),
        loadLogBenches(scene),
    ]);
    
    // TODO: Adicionar futuros elementos aqui
    // loadFires(scene),
    
    return {
        groundMesh,
        campfireMesh,
        forest,
        tent,
        campfire,
        logBenches,
    };
}
