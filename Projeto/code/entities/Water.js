import * as THREE from 'three';
import { SETTINGS as GROUND_SETTINGS, applyValeDepressionToGeometry } from '../world/scene.js';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
const SETTINGS = {
    // Água na cascata (vertical — queda de água)
    waterfall: {
        position: { x: 3.0, y: 1.5, z: -4.5 },   // acima da cascata
        size:     { w: 6.0, h: 3.0 },              // larga e alta
        color:    0x5ca3d4,
        opacity:  0.65,
        // Rotação: vertical (queda)
    },

    // Água no vale (horizontal — segue a depressão)
    basin: {
        position: { x: 3.0, y: -0.1, z: 0 },      // mais para baixo, dentro do vale
        size:     { w: 4.5, h: 9.3 },              // apenas a largura do vale (0.9*2)
        color:    0x3a7bd5,
        opacity:  0.80,
        segments: 32,                               // precisão da geometria
        // Rotação: horizontal (no chão)
    },
};

/**
 * Cria e adiciona duas águas à cena:
 * 1. Queda vertical na cascata
 * 2. Fluxo horizontal no vale (seguindo a depressão)
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
        roughness:   0.1,      // mais áspero para cascata
        metalness:   0.15,
        side:        THREE.DoubleSide,
    });

    const waterfall = new THREE.Mesh(waterfallGeo, waterfallMat);
    waterfall.position.set(
        SETTINGS.waterfall.position.x,
        SETTINGS.waterfall.position.y,
        SETTINGS.waterfall.position.z
    );
    // Rotação: queda vertical (sem rotação X, deixa na vertical)
    waterfall.rotation.y = 0;
    waterfall.receiveShadow = true;
    waterfall.raycast = () => {}; // Ignorar raycasts
    
    scene.add(waterfall);

    // ═══════════════════════════════════════════════════════════════════════════
    //  ÁGUA 2: VALE (HORIZONTAL — RETÂNGULO RETO)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const basinGeo = new THREE.PlaneGeometry(
        SETTINGS.basin.size.w,
        SETTINGS.basin.size.h,
        SETTINGS.basin.segments,
        SETTINGS.basin.segments
    );

    const basinMat = new THREE.MeshStandardMaterial({
        color:       SETTINGS.basin.color,
        transparent: true,
        opacity:     SETTINGS.basin.opacity,
        roughness:   0.05,     // mais liso para reflexo
        metalness:   0.2,
        side:        THREE.DoubleSide,
        depthWrite:  false,
    });

    const basin = new THREE.Mesh(basinGeo, basinMat);
    basin.position.set(
        SETTINGS.basin.position.x,
        SETTINGS.basin.position.y,
        SETTINGS.basin.position.z
    );
    // Rotação: horizontal (deitada no chão)
    basin.rotation.x = -Math.PI / 2;
    basin.receiveShadow = true;
    basin.raycast = () => {}; // Ignorar raycasts
    
    scene.add(basin);

    return { waterfall, basin };
}

export { SETTINGS as waterSettings };
