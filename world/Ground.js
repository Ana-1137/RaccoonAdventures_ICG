import * as THREE from 'three';
import { getAssetPath } from '../config.js';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
// Muda estes valores para ajustar o vale, texturas e materiais do chão
const SETTINGS = {
    ground: {
        size: 30,               // dimensões do plano (30x30)
        segments: 64,           // segmentos para mais vértices (resolução da depressão)
        color: 0xffffff,        // cor base (branco para não descolorir texturas)
    },

    textures: {
        grass: {
            color:     getAssetPath('elements/textures/Default/Grass003_1K-JPG_Color.jpg'),
            normal:    getAssetPath('elements/textures/Default/Grass003_1K-JPG_NormalGL.jpg'),
            roughness: getAssetPath('elements/textures/Default/Grass003_1K-JPG_Roughness.jpg'),
            repeat: 30,           // repetições do padrão
        },
        campfire: {
            color:     getAssetPath('elements/textures/Campfire/Ground037_1K-JPG_Color.jpg'),
            normal:    getAssetPath('elements/textures/Campfire/Ground037_1K-JPG_NormalGL.jpg'),
            roughness: getAssetPath('elements/textures/Campfire/Ground037_1K-JPG_Roughness.jpg'),
            repeat: 10,           // padrão mais fino para campfire
        },
    },

    campfire: {
        size: 3,                // dimensões do plano (3x3)
        position: { x: 0, y: 0.001, z: 0 }, // ligeiramente acima para evitar z-fighting
        alphaMapRadius: 64,     // raio do gradiente circular (em pixels)
        alphaMapCanvasSize: 256, // resolução do canvas para alphaMap
    },

    // ┌─────────────────────────────────────────────────────────────────────────┐
    // │ VALE COM CURVA (depressão no terreno)                                  │
    // │ Estrutura: Zona1 (reto) → Zona2 (curva) → Zona3 (reto desviado)        │
    // │ Direção: Cascatas (Z = -4.5) → Frente (Z = +4.5) seguindo a curva      │
    // └─────────────────────────────────────────────────────────────────────────┘
    vale: {
        // Posições das cascatas (origem do vale)
        cascataX1: -1.5,
        cascataX2: 5.5,
        cascataZ: -5.5,

        // ── ZONA 1: Reto nas cascatas ──
        zone1: {
            start: -4.5,        // Onde inicia (nas cascatas)
            end: -3.0,          // Onde termina
        },

        // ── ZONA 2: Curva de transição ──
        zone2: {
            start: -3.0,        // Onde inicia a curva
            end: 1.0,           // Onde termina a curva
        },

        // ── ZONA 3: Reto desviado para a floresta ──
        zone3: {
            start: 1.0,         // Onde inicia o reto desviado
            end: 4.5,           // Onde termina o vale (fim total para frente)
        },

        // ── Dimensões e forma ──
        width: 0.9,             // meia-largura do vale (raio)
        depth: 0.5,             // profundidade máxima da depressão
        shiftX: 1.2,            // desvio em X (positivo = direita/floresta)
        depthFalloff: 0.3,      // quanto decresce a profundidade hacia o fim (0 a 1)
    },
};

// Calcular e armazenar dinâmicamente o centerX do vale (entre as cascatas)
SETTINGS.vale.centerX = (SETTINGS.vale.cascataX1 + SETTINGS.vale.cascataX2) / 2;

// ─── FUNÇÕES DE HELPER ──────────────────────────────────────────────────────

/**
 * Carrega e configura um conjunto de texturas PBR (color, normal, roughness).
 * @param {THREE.TextureLoader} loader
 * @param {Object} texturePaths - { color, normal, roughness, repeat }
 * @returns {{ colorTex, normalTex, roughnessTex }}
 */
function loadPBRTextures(loader, texturePaths) {
    const load = (path, label) => loader.load(
        path,
        undefined, undefined,
        (err) => console.error(`Erro ao carregar textura ${label}:`, err)
    );

    const colorTex     = load(texturePaths.color,     'color');
    const normalTex    = load(texturePaths.normal,     'normal');
    const roughnessTex = load(texturePaths.roughness,  'roughness');

    [colorTex, normalTex, roughnessTex].forEach(tex => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(texturePaths.repeat, texturePaths.repeat);
    });

    return { colorTex, normalTex, roughnessTex };
}

/**
 * Cria um alphaMap circular em canvas (opaco no centro, transparente nas bordas).
 * Usado para fundir suavemente a textura de terra da fogueira com a relva.
 * @param {number} canvasSize - Resolução do canvas em píxeis
 * @param {number} maxRadius  - Raio máximo do gradiente em píxeis
 * @returns {THREE.CanvasTexture}
 */
function createCircularAlphaMap(canvasSize, maxRadius) {
    const canvas  = document.createElement('canvas');
    canvas.width  = canvasSize;
    canvas.height = canvasSize;
    const ctx     = canvas.getContext('2d');
    const cx      = canvasSize / 2;
    const cy      = canvasSize / 2;

    for (let y = 0; y < canvasSize; y++) {
        for (let x = 0; x < canvasSize; x++) {
            const dist  = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            const ratio = Math.min(dist / maxRadius, 1);
            const alpha = Math.max(0, 1 - ratio * ratio);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    return new THREE.CanvasTexture(canvas);
}

/**
 * Calcula o desvio em X para uma posição Z ao longo do vale.
 * Implementa transição suave: reto → curva (senoide) → reto desviado
 * @param {number} z            - Posição Z no mundo
 * @param {Object} valeSettings - SETTINGS.vale
 * @returns {number} Posição X do centro do vale nesta posição Z
 */
function getValeCenterXAtZ(z, valeSettings) {
    const { zone1, zone2, zone3, centerX, shiftX } = valeSettings;

    // Zona 1: Reto antes da curva
    if (z >= zone1.start && z <= zone1.end) return centerX;

    // Zona 2: Curva (interpolação senoidal suave)
    if (z > zone1.end && z <= zone2.end) {
        const t = (z - zone2.start) / (zone2.end - zone2.start);
        return centerX + Math.sin(t * Math.PI) * shiftX;
    }

    // Zona 3: Reto desviado
    if (z > zone2.end && z <= zone3.end) return centerX + shiftX;

    return centerX; // fallback
}

/**
 * Aplica a depressão do vale à geometria do chão.
 * Modifica os vértices do PlaneGeometry para criar uma bacia alongada.
 * @param {THREE.PlaneGeometry} geometry    - Geometria do chão
 * @param {Object}              valeSettings - SETTINGS.vale
 */
function applyValeDepressionToGeometry(geometry, valeSettings) {
    const pos  = geometry.attributes.position;
    const { zone1, zone3, width, depth, depthFalloff } = valeSettings;

    for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i); // X do vértice (permanece igual)
        const vy = pos.getY(i); // Y aqui = Z do mundo (antes da rotação -90º)

        if (vy < zone1.start || vy > zone3.end) continue;

        const valeCenterX  = getValeCenterXAtZ(vy, valeSettings);
        const lateralDist  = Math.abs(vx - valeCenterX) / width;

        if (lateralDist >= 1.0) continue;

        const lateralFactor  = 1.0 - lateralDist * lateralDist;
        const distFromStart  = Math.max(0, vy - zone1.start);
        const lengthFraction = distFromStart / (zone3.end - zone1.start);
        const depthFactor    = 1.0 - lengthFraction * depthFalloff;

        pos.setZ(i, -(depth * lateralFactor * depthFactor));
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals(); // Recalcular normais para iluminação
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria o chão com duas texturas PBR:
 * 1. Textura base (relva) — cobre todo o plano
 * 2. Textura secundária (terra da fogueira) — plano pequeno central com alphaMap circular
 * @returns {{ groundMesh: THREE.Mesh, campfireMesh: THREE.Mesh }}
 */
function createGround() {
    const textureLoader = new THREE.TextureLoader();

    // ── Textura base: relva ──────────────────────────────────────────────────
    const { colorTex: grassColor, normalTex: grassNormal, roughnessTex: grassRoughness } =
        loadPBRTextures(textureLoader, SETTINGS.textures.grass);

    const groundMaterial = new THREE.MeshStandardMaterial({
        color:        SETTINGS.ground.color,
        map:          grassColor,
        normalMap:    grassNormal,
        roughnessMap: grassRoughness,
        side:         THREE.DoubleSide,
    });

    // ── Chão com depressão do vale ───────────────────────────────────────────
    const groundGeometry = new THREE.PlaneGeometry(
        SETTINGS.ground.size,
        SETTINGS.ground.size,
        SETTINGS.ground.segments,
        SETTINGS.ground.segments
    );
    applyValeDepressionToGeometry(groundGeometry, SETTINGS.vale);

    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;

    // ── Textura secundária: terra à volta da fogueira ────────────────────────
    const { colorTex: campfireColor, normalTex: campfireNormal, roughnessTex: campfireRoughness } =
        loadPBRTextures(textureLoader, SETTINGS.textures.campfire);

    const alphaMapTexture = createCircularAlphaMap(
        SETTINGS.campfire.alphaMapCanvasSize,
        SETTINGS.campfire.alphaMapRadius
    );

    const campfireMaterial = new THREE.MeshStandardMaterial({
        color:        SETTINGS.ground.color,
        map:          campfireColor,
        normalMap:    campfireNormal,
        roughnessMap: campfireRoughness,
        alphaMap:     alphaMapTexture,
        transparent:  true,
        depthWrite:   false,
        side:         THREE.DoubleSide,
    });

    const campfireGeometry = new THREE.PlaneGeometry(SETTINGS.campfire.size, SETTINGS.campfire.size);
    const campfireMesh     = new THREE.Mesh(campfireGeometry, campfireMaterial);
    campfireMesh.position.set(
        SETTINGS.campfire.position.x,
        SETTINGS.campfire.position.y,
        SETTINGS.campfire.position.z
    );
    campfireMesh.rotation.x = -Math.PI / 2;
    campfireMesh.receiveShadow = true;
    campfireMesh.raycast = () => {}; // Ignorar raycasts (não interfere com física)

    return { groundMesh, campfireMesh };
}

export { createGround, applyValeDepressionToGeometry, SETTINGS as GROUND_SETTINGS };
