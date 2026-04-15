import * as THREE from 'three';

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
            color: '../elements/textures/Default/Grass003_1K-JPG_Color.jpg',
            normal: '../elements/textures/Default/Grass003_1K-JPG_NormalGL.jpg',
            roughness: '../elements/textures/Default/Grass003_1K-JPG_Roughness.jpg',
            repeat: 30,           // repetições do padrão
        },
        campfire: {
            color: '../elements/textures/Campfire/Ground037_1K-JPG_Color.jpg',
            normal: '../elements/textures/Campfire/Ground037_1K-JPG_NormalGL.jpg',
            roughness: '../elements/textures/Campfire/Ground037_1K-JPG_Roughness.jpg',
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
 * Calcula o desvio em X para uma posição Z ao longo do vale.
 * Implementa transição suave: reto → curva (senoide) → reto desviado
 * Vale corre das cascatas (Z = -4.5) para frente (Z = +4.5)
 * @param {number} z - Posição Z no mundo
 * @param {Object} valeSettings - SETTINGS.vale
 * @returns {number} Posição X do centro do vale nesta posição Z
 */
function getValeCenterXAtZ(z, valeSettings) {
    const { zone1, zone2, zone3, centerX, shiftX } = valeSettings;

    // Zona 1: Reto antes da curva
    if (z >= zone1.start && z <= zone1.end) {
        return centerX;
    }

    // Zona 2: Curva (interpolação senoidal suave)
    if (z > zone1.end && z <= zone2.end) {
        const t = (z - zone2.start) / (zone2.end - zone2.start);
        const curveAmount = Math.sin(t * Math.PI) * shiftX;
        return centerX + curveAmount;
    }

    // Zona 3: Reto desviado
    if (z > zone2.end && z <= zone3.end) {
        return centerX + shiftX;
    }

    return centerX; // fallback
}

/**
 * Aplica a depressão do vale ao geometria do chão.
 * Modifica os vértices do PlaneGeometry para criar uma bacia alongada.
 * Vale corre das cascatas (Z = -4.5) para frente (Z = +4.5)
 * @param {THREE.PlaneGeometry} geometry - Geometria do chão
 * @param {Object} valeSettings - SETTINGS.vale
 */
function applyValeDepressionToGeometry(geometry, valeSettings) {
    const pos = geometry.attributes.position;
    const { zone1, zone3, width, depth, depthFalloff } = valeSettings;

    for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i); // X do vértice (permanece igual)
        const vy = pos.getY(i); // Y aqui = Z do mundo (antes da rotação -90º)

        // Verificar se está dentro da extensão Z do vale (das cascatas para frente)
        if (vy >= zone1.start && vy <= zone3.end) {
            const valeCenterX = getValeCenterXAtZ(vy, valeSettings);

            // Distância lateral em X
            const dx = vx - valeCenterX;
            const lateralDist = Math.abs(dx) / width;

            if (lateralDist < 1.0) {
                // Fator de profundidade lateral: máximo no centro, zero nas bordas (quadrático)
                const lateralFactor = 1.0 - lateralDist * lateralDist;

                // Fator de profundidade longitudinal: decresce ligeiramente para o fim
                const distFromStart = Math.max(0, vy - zone1.start);
                const lengthFraction = distFromStart / (zone3.end - zone1.start);
                const depthFactor = 1.0 - lengthFraction * depthFalloff;

                // Aplicar depressão
                const depression = depth * lateralFactor * depthFactor;
                pos.setZ(i, -depression);
            }
        }
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals(); // Recalcular normais para iluminação
}

// ─────────────────────────────────────────────────────────────────────────────

function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Cor do céu (azul claro)

    // TODO: Adicionar nevoeiro (fog) aqui mais tarde
    // scene.fog = new THREE.Fog(0xcccccc, 10, 50);

    return scene;
}

/**
 * Cria o chão com duas texturas PBR:
 * 1. Textura base (relva) — cobre todo o plano
 * 2. Textura secundária (terra da fogueira) — plano pequeno central com alphaMap circular
 * @returns {Object} { groundMesh, campfireMesh }
 */
function createGround() {
    const textureLoader = new THREE.TextureLoader();

    // ═══════════════════════════════════════════════════════════════════════════
    //  TEXTURA BASE (RELVA)
    // ═══════════════════════════════════════════════════════════════════════════

    const grassColor = textureLoader.load(
        SETTINGS.textures.grass.color,
        undefined,
        undefined,
        (err) => console.error('Erro ao carregar textura de cor da relva:', err)
    );
    const grassNormal = textureLoader.load(
        SETTINGS.textures.grass.normal,
        undefined,
        undefined,
        (err) => console.error('Erro ao carregar normal map da relva:', err)
    );
    const grassRoughness = textureLoader.load(
        SETTINGS.textures.grass.roughness,
        undefined,
        undefined,
        (err) => console.error('Erro ao carregar roughness map da relva:', err)
    );

    // Configurar wrapping e repeat para todas as texturas
    [grassColor, grassNormal, grassRoughness].forEach(texture => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(SETTINGS.textures.grass.repeat, SETTINGS.textures.grass.repeat);
    });

    const groundMaterial = new THREE.MeshStandardMaterial({
        color: SETTINGS.ground.color,
        map: grassColor,
        normalMap: grassNormal,
        roughnessMap: grassRoughness,
        side: THREE.DoubleSide,
    });

    // ═══════════════════════════════════════════════════════════════════════════
    //  CRIAR CHÃO COM DEPRESSÃO DO VALE
    // ═══════════════════════════════════════════════════════════════════════════

    const groundGeometry = new THREE.PlaneGeometry(
        SETTINGS.ground.size,
        SETTINGS.ground.size,
        SETTINGS.ground.segments,
        SETTINGS.ground.segments
    );

    // Aplicar depressão do vale
    applyValeDepressionToGeometry(groundGeometry, SETTINGS.vale);

    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;

    // ═══════════════════════════════════════════════════════════════════════════
    //  TEXTURA SECUNDÁRIA (FOGUEIRA)
    // ═══════════════════════════════════════════════════════════════════════════

    const campfireColor = textureLoader.load(
        SETTINGS.textures.campfire.color,
        undefined,
        undefined,
        (err) => console.error('Erro ao carregar textura de cor do campfire:', err)
    );
    const campfireNormal = textureLoader.load(
        SETTINGS.textures.campfire.normal,
        undefined,
        undefined,
        (err) => console.error('Erro ao carregar normal map do campfire:', err)
    );
    const campfireRoughness = textureLoader.load(
        SETTINGS.textures.campfire.roughness,
        undefined,
        undefined,
        (err) => console.error('Erro ao carregar roughness map do campfire:', err)
    );

    [campfireColor, campfireNormal, campfireRoughness].forEach(texture => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(SETTINGS.textures.campfire.repeat, SETTINGS.textures.campfire.repeat);
    });

    // ── Criar alphaMap circular programaticamente ──
    const alphaMapCanvas = document.createElement('canvas');
    alphaMapCanvas.width = SETTINGS.campfire.alphaMapCanvasSize;
    alphaMapCanvas.height = SETTINGS.campfire.alphaMapCanvasSize;
    const ctx = alphaMapCanvas.getContext('2d');

    const centerX = alphaMapCanvas.width / 2;
    const centerY = alphaMapCanvas.height / 2;
    const maxRadius = SETTINGS.campfire.alphaMapRadius;

    // Preencher com gradiente circular (opaco no centro, transparente nas bordas)
    for (let y = 0; y < alphaMapCanvas.height; y++) {
        for (let x = 0; x < alphaMapCanvas.width; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const radius = Math.min(distance / maxRadius, 1);

            const alpha = Math.max(0, 1 - radius * radius);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }

    const alphaMapTexture = new THREE.CanvasTexture(alphaMapCanvas);

    const campfireMaterial = new THREE.MeshStandardMaterial({
        color: SETTINGS.ground.color,
        map: campfireColor,
        normalMap: campfireNormal,
        roughnessMap: campfireRoughness,
        alphaMap: alphaMapTexture,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
    });

    const campfireGeometry = new THREE.PlaneGeometry(SETTINGS.campfire.size, SETTINGS.campfire.size);
    const campfireMesh = new THREE.Mesh(campfireGeometry, campfireMaterial);
    campfireMesh.position.set(
        SETTINGS.campfire.position.x,
        SETTINGS.campfire.position.y,
        SETTINGS.campfire.position.z
    );
    campfireMesh.rotation.x = -Math.PI / 2;
    campfireMesh.receiveShadow = true;
    campfireMesh.raycast = () => {}; // Ignorar raycasts (assim não interfere com física do personagem)

    return { groundMesh, campfireMesh };
}

export { createScene, createGround, SETTINGS };
