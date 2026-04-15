import * as THREE from 'three';
import { Water } from 'three/addons/objects/Water.js';
import { SETTINGS as GROUND_SETTINGS, applyValeDepressionToGeometry } from '../world/scene.js';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
// Todas as variáveis aqui para fácil ajuste visual e comportamental
const SETTINGS = {
    // ┌─────────────────────────────────────────────────────────────────────────┐
    // │ ÁGUA NA CASCATA (VERTICAL)                                              │
    // └─────────────────────────────────────────────────────────────────────────┘
    waterfall: {
        position: { x: 3.0, y: 1.8, z: -4.5 },   // Posição 3D
        size:     { w: 3.0, h: 3.8 },              // Dimensões (largura x altura)
        color:    0x5ca3d4,                        // Cor da água
        opacity:  0.65,                            // Transparência (0-1)
        roughness: 0.1,                            // Material: áspero para cascata
        metalness: 0.15,                           // Material: reflexividade
    },

    // ┌─────────────────────────────────────────────────────────────────────────┐
    // │ ÁGUA NO VALE (HORIZONTAL — EFEITO REALISTA)                             │
    // └─────────────────────────────────────────────────────────────────────────┘
    basin: {
        position: { x: 2.6, y: -0.1, z: 0 },      // Posição 3D
        size:     { w: 3.2, h: 9.3 },              // Dimensões (largura x comprimento)
        color:    0x3a7bd5,                        // Cor da água
        opacity:  0.3,                             // Transparência (0-1)
        segments: 32,                              // Resolução da geometria (mais = mais detalhe)
        
        // ── Water Addon Configuration ──
        textureWidth:  200,                        // Resolução do mapa de reflexos
        textureHeight: 200,                        // Resolução do mapa de reflexos
        distortionScale: 2.0,                      // Intensidade das ondas (0-20 recomendado)
        
        // ── Sun Configuration ──
        sunColor: 0xffffff,                        // Cor da luz do sol refletida
        sunIntensity: 1.0,                         // Brilho da reflexão solar
    },
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria e adiciona duas águas à cena:
 * 1. Queda vertical na cascata
 * 2. Fluxo horizontal no vale (com efeito realista de Water addon)
 * @param {THREE.Scene} scene
 * @returns {Object} { waterfall, basin }
 */
export function createWater(scene) {
    // ═══════════════════════════════════════════════════════════════════════════
    //  ÁGUA 1: CASCATA (VERTICAL)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const waterfallGeo = new THREE.PlaneGeometry(
        SETTINGS.waterfall.size.w,
        SETTINGS.waterfall.size.h,
        8, 8
    );

    const waterfallMat = new THREE.MeshStandardMaterial({
        color:       SETTINGS.waterfall.color,
        transparent: true,
        opacity:     SETTINGS.waterfall.opacity,
        roughness:   SETTINGS.waterfall.roughness,
        metalness:   SETTINGS.waterfall.metalness,
        side:        THREE.DoubleSide,
    });

    const waterfall = new THREE.Mesh(waterfallGeo, waterfallMat);
    waterfall.position.set(
        SETTINGS.waterfall.position.x,
        SETTINGS.waterfall.position.y,
        SETTINGS.waterfall.position.z
    );
    waterfall.rotation.y = 0;
    waterfall.receiveShadow = true;
    waterfall.raycast = () => {}; // Ignorar raycasts
    
    scene.add(waterfall);

    // ═══════════════════════════════════════════════════════════════════════════
    //  ÁGUA 2: VALE (HORIZONTAL — EFEITO REALISTA)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const basinGeo = new THREE.PlaneGeometry(
        SETTINGS.basin.size.w,
        SETTINGS.basin.size.h,
        SETTINGS.basin.segments,
        SETTINGS.basin.segments
    );

    // Criar água usando o Water addon do Three.js
    const basin = new Water(basinGeo, {
        textureWidth: SETTINGS.basin.textureWidth,
        textureHeight: SETTINGS.basin.textureHeight,
        waterNormals: new THREE.TextureLoader().load(
            'https://threejs.org/examples/textures/waternormals.jpg'
        ),
        sunDirection: new THREE.Vector3(1, 1, 1).normalize(),
        sunColor: SETTINGS.basin.sunColor,
        waterColor: SETTINGS.basin.color,
        distortionScale: SETTINGS.basin.distortionScale,
        fog: scene.fog !== undefined,
        side: THREE.DoubleSide,
    });

    // Ajustar transparência
    basin.material.transparent = true;
    basin.material.opacity = SETTINGS.basin.opacity;

    basin.position.set(
        SETTINGS.basin.position.x,
        SETTINGS.basin.position.y,
        SETTINGS.basin.position.z
    );
    basin.rotation.x = -Math.PI / 2;
    basin.raycast = () => {};
    
    scene.add(basin);

    return { waterfall, basin };
}

/**
 * Atualiza a animação da água (ondas)
 * @param {THREE.Mesh} basinMesh - Mesh da água horizontal
 * @param {number} deltaTime - Tempo decorrido desde o último frame
 */
export function updateWater(basinMesh, deltaTime = 0.016) {
    if (basinMesh && basinMesh.material && basinMesh.material.uniforms.time) {
        basinMesh.material.uniforms.time.value += deltaTime;
    }
}

export { SETTINGS as waterSettings };
