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

    // TODO: Adicionar nevoeiro (fog) aqui mais tarde
    // scene.fog = new THREE.Fog(0xcccccc, 10, 50);

    return scene;
}

export { createScene };
