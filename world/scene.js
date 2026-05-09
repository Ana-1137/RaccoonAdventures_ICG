import * as THREE from 'three';

/**
 * Cria e configura a cena Three.js base.
 * Apenas responsável pelo setup inicial — chão, luzes e entidades
 * são adicionados por módulos separados (Ground.js, lights.js, World.js).
 * @returns {THREE.Scene}
 */
function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Cor do céu (azul claro inicial)

    // Nevoeiro exponencial — densidade 0 por defeito, controlável pelo Dashboard
    scene.fog = new THREE.FogExp2(0x87CEEB, 0.0);

    return scene;
}

export { createScene };
