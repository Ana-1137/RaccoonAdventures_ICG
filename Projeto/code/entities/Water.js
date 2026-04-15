import * as THREE from 'three';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
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
    // │ ÁGUA NO VALE (HORIZONTAL — VERTEX DEFORMATION SUAVE)                    │
    // └─────────────────────────────────────────────────────────────────────────┘
    basin: {
        position: { x: 2.6, y: -0.1, z: 0 },      // Posição 3D
        size:     { w: 3.2, h: 9.3 },              // Dimensões (largura x comprimento)
        color:    0x5ca3d4,                        // Cor da água
        opacity:  0.6,                             // Transparência (0-1)
        segments: 64,                              // Resolução (mais = mais realista)
        waveAmplitude: 0.03,                        // Altura das ondas (0-1)
        waveSpeed: 0.7,                            // Velocidade (0-2, mais baixo = mais calmo)
        roughness: 0.2,                            // Material: superfície
        metalness: 0.3,                            // Material: reflexo
    },
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria e adiciona duas águas à cena:
 * 1. Queda vertical na cascata
 * 2. Fluxo horizontal no vale (com vertex deformation ondulante)
 * @param {THREE.Scene} scene
 * @returns {Promise<Object>} { waterfall, basin }
 */
export async function createWater(scene) {
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
    waterfall.raycast = () => {};
    
    scene.add(waterfall);

    // ═══════════════════════════════════════════════════════════════════════════
    //  ÁGUA 2: VALE (HORIZONTAL — VERTEX DEFORMATION COM ONDAS SUAVES)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const basinGeo = new THREE.PlaneGeometry(
        SETTINGS.basin.size.w,
        SETTINGS.basin.size.h,
        SETTINGS.basin.segments,
        SETTINGS.basin.segments
    );

    // Guardar posições originais para cálculo de ondas
    const originalPositions = new Float32Array(basinGeo.attributes.position.array);

    const basinMat = new THREE.MeshStandardMaterial({
        color:       SETTINGS.basin.color,
        transparent: true,
        opacity:     SETTINGS.basin.opacity,
        roughness:   SETTINGS.basin.roughness,
        metalness:   SETTINGS.basin.metalness,
        side:        THREE.DoubleSide,
        wireframe:   false,
    });

    const basin = new THREE.Mesh(basinGeo, basinMat);
    basin.position.set(
        SETTINGS.basin.position.x,
        SETTINGS.basin.position.y,
        SETTINGS.basin.position.z
    );
    basin.rotation.x = -Math.PI / 2;
    basin.raycast = () => {};
    
    // Guardar dados para animação
    basin.userData.originalPositions = originalPositions;
    basin.userData.geometry = basinGeo;
    
    scene.add(basin);

    return { waterfall, basin };
}

/**
 * Atualiza a animação da água com vertex deformation (ondas suaves)
 * Similar à abordagem das aulas (06_04_Ex_Waves.html): deforma vértices em tempo real
 * @param {THREE.Mesh} basinMesh - Mesh da água horizontal
 * @param {number} deltaTime - Tempo decorrido desde o último frame
 */
let waterTime = 0;

export function updateWater(basinMesh, deltaTime = 0.016) {
    if (!basinMesh || !basinMesh.userData.originalPositions) return;
    
    waterTime += deltaTime * SETTINGS.basin.waveSpeed;

    const geometry = basinMesh.userData.geometry;
    const positionAttribute = geometry.attributes.position;
    const originalPositions = basinMesh.userData.originalPositions;

    // ── VERTEX DEFORMATION: Calcular novas posições Z com ondas ──
    for (let i = 0; i < positionAttribute.count; i++) {
        // Obter posição original (X e Y no plano)
        const x = originalPositions[i * 3];         // X original
        const y = originalPositions[i * 3 + 1];     // Y original (será Z no mundo)

        // Calcular deslocamento em Z (altura) com ondas suaves e calmas
        // Combinar duas ondas para efeito mais natural
        const wave1 = Math.sin(x * 0.5 + waterTime) * SETTINGS.basin.waveAmplitude;
        const wave2 = Math.cos(y * 0.3 + waterTime * 0.7) * SETTINGS.basin.waveAmplitude * 0.7;
        const newZ = wave1 + wave2;

        // Atualizar posição do vértice
        positionAttribute.setXYZ(i, x, y, newZ);
    }

    // CRÍTICO: Informar ao Three.js que as posições mudaram
    positionAttribute.needsUpdate = true;

    // Recalcular normais para iluminação correta na superfície ondulante
    geometry.computeVertexNormals();
}

export { SETTINGS as waterSettings };
