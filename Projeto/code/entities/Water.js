import * as THREE from 'three';
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
    // │ ÁGUA NO VALE (HORIZONTAL — COM SHADER CUSTOMIZADO)                      │
    // └─────────────────────────────────────────────────────────────────────────┘
    basin: {
        position: { x: 2.6, y: -0.1, z: 0 },      // Posição 3D
        size:     { w: 3.2, h: 9.3 },              // Dimensões (largura x comprimento)
        color:    0x5ca3d4,                        // Cor da água (hex)
        opacity:  0.6,                             // Transparência (0-1) — 0.6 = bem transparente
        segments: 32,                              // Resolução da geometria
        waveAmplitude: 0.01,                       // Amplitude das ondas (0-0.5)
        waveFrequency: 0.7,                        // Frequência das ondas
        waveSpeed: 0.8,                            // Velocidade da animação
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// Shader customizado para água com transparência e ondas
// ─────────────────────────────────────────────────────────────────────────────

const waveShader = {
    uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(SETTINGS.basin.color) },
        opacity: { value: SETTINGS.basin.opacity },
        amplitude: { value: SETTINGS.basin.waveAmplitude },
        frequency: { value: SETTINGS.basin.waveFrequency },
    },
    vertexShader: `
        uniform float time;
        uniform float amplitude;
        uniform float frequency;
        
        void main() {
            vec3 pos = position;
            
            // Ondas em múltiplas direções para efeito natural
            float wave1 = sin(pos.x * frequency + time * 2.0) * amplitude;
            float wave2 = sin(pos.y * frequency * 0.7 + time * 1.5) * amplitude;
            float wave3 = cos((pos.x + pos.y) * frequency * 0.5 + time) * amplitude * 0.7;
            
            pos.z += wave1 + wave2 + wave3;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
    `,
    fragmentShader: `
        uniform vec3 color;
        uniform float opacity;
        
        void main() {
            gl_FragColor = vec4(color, opacity);
        }
    `,
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria e adiciona duas águas à cena:
 * 1. Queda vertical na cascata
 * 2. Fluxo horizontal no vale (com shader customizado e ondas animadas)
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
    //  ÁGUA 2: VALE (HORIZONTAL — COM SHADER TRANSPARENTE)
    // ═══════════════════════════════════════════════════════════════════════════
    
    const basinGeo = new THREE.PlaneGeometry(
        SETTINGS.basin.size.w,
        SETTINGS.basin.size.h,
        SETTINGS.basin.segments,
        SETTINGS.basin.segments
    );

    // Criar shader material com transparência real
    const basinMat = new THREE.ShaderMaterial({
        uniforms: {
            ...waveShader.uniforms,
            color: { value: new THREE.Color(SETTINGS.basin.color) },
            opacity: { value: SETTINGS.basin.opacity },
        },
        vertexShader: waveShader.vertexShader,
        fragmentShader: waveShader.fragmentShader,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        wireframe: false,
    });

    const basin = new THREE.Mesh(basinGeo, basinMat);
    basin.position.set(
        SETTINGS.basin.position.x,
        SETTINGS.basin.position.y,
        SETTINGS.basin.position.z
    );
    basin.rotation.x = -Math.PI / 2;
    basin.raycast = () => {};
    
    // Guardar referências para animação
    basin.userData.shaderMaterial = basinMat;
    
    scene.add(basin);

    return { waterfall, basin };
}

/**
 * Atualiza a animação da água (ondas)
 * Chamado no animation loop (requestAnimationFrame)
 * @param {THREE.Mesh} basinMesh - Mesh da água horizontal
 * @param {number} deltaTime - Tempo decorrido desde o último frame
 */
export function updateWater(basinMesh, deltaTime = 0.016) {
    if (basinMesh && basinMesh.userData.shaderMaterial) {
        const mat = basinMesh.userData.shaderMaterial;
        if (mat.uniforms.time) {
            mat.uniforms.time.value += deltaTime * SETTINGS.basin.waveSpeed;
        }
    }
}

export { SETTINGS as waterSettings };
