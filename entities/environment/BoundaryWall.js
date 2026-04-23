import * as THREE from 'three';
import { getAssetPath } from '../../config.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
    wall: {
        centerX: 0,
        centerZ: 1.5,          // Deslocado para +Z conforme pedido
        radius: 9.5,           // Afastado da floresta para evitar sobreposição
        count: 27,             // Número de pedras gigantes
        scaleMin: 1.5,
        scaleMax: 2.5,
        // O U abre para a frente (+Z). O arco vai da Esquerda (PI) -> Trás (-PI/2) -> Direita (0/2PI)
        startAngle: Math.PI * 0.35,
        endAngle: Math.PI * 2.15,
    }
};

/**
 * Cria a geometria de uma rocha procedural ("low poly") retangular.
 */
function createProceduralRockBlock(width, height, depth, material) {
    // Usar BoxGeometry com alguns segmentos para permitir deformação
    const geometry = new THREE.BoxGeometry(width, height, depth, 3, 5, 3);
    
    // Função pseudo-aleatória baseada nas coordenadas (para evitar que vértices duplicados nas arestas se separem)
    const pseudoRandom = (x, y, z, seed) => {
        // Arredondar para evitar problemas de floating point em vértices sobrepostos
        const rx = Math.round(x * 100);
        const ry = Math.round(y * 100);
        const rz = Math.round(z * 100);
        const dot = rx * 12.9898 + ry * 78.233 + rz * 37.719 + seed;
        const s = Math.sin(dot) * 43758.5453;
        return s - Math.floor(s);
    };

    // Deformar vértices para parecer orgânico (sem rasgar a malha)
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        
        // Multiplicador de ruído consistente para a mesma posição no espaço
        const offsetX = (pseudoRandom(x, y, z, 1) - 0.5) * 0.3;
        const offsetY = (pseudoRandom(x, y, z, 2) - 0.5) * 0.3;
        const offsetZ = (pseudoRandom(x, y, z, 3) - 0.5) * 0.3;
        
        pos.setXYZ(i, x + offsetX, y + offsetY, z + offsetZ);
    }
    
    geometry.computeVertexNormals();

    return { geometry, material };
}

/**
 * Constrói uma muralha em forma de U usando InstancedMesh procedural para máxima performance.
 * @param {THREE.Scene} scene 
 */
export async function loadBoundaryWall(scene) {
    // ── Carregar Texturas PBR da Rocha ──
    const textureLoader = new THREE.TextureLoader();
    const loadTex = (path) => {
        const tex = textureLoader.load(getAssetPath(path));
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 2); // Repetir a textura para não ficar esticada no monólito
        return tex;
    };

    const colorTex     = loadTex('elements/textures/Rock/Rock058_1K-JPG_Color.jpg');
    const normalTex    = loadTex('elements/textures/Rock/Rock058_1K-JPG_NormalGL.jpg');
    const roughnessTex = loadTex('elements/textures/Rock/Rock058_1K-JPG_Roughness.jpg');

    // Usamos StandardMaterial para suportar Normal e Roughness maps (dá um aspeto incrivel com luz)
    const rockMaterial = new THREE.MeshStandardMaterial({
        color: 0xaaaaaa, // Cor base neutra
        map: colorTex,
        normalMap: normalTex,
        roughnessMap: roughnessTex,
        flatShading: true
    });

    // Extrair os dados dos meshes gerados em código (ZERO DOWNLOADS DE MODELOS 3D!)
    // Criamos 2 tipos diferentes de blocos: um mais alto e um mais largo
    const rock1 = createProceduralRockBlock(1.5, 3.0, 1.5, rockMaterial);
    const rock2 = createProceduralRockBlock(2.0, 2.5, 1.8, rockMaterial);
    
    const meshesData = [rock1, rock2];

    const { centerX, centerZ, radius, count, scaleMin, scaleMax, startAngle, endAngle } = SETTINGS.wall;

    // Alocar os InstancedMeshes
    const instances = meshesData.map(data => {
        const imesh = new THREE.InstancedMesh(data.geometry, data.material, count); // count é o máximo teórico
        imesh.castShadow = true;
        imesh.receiveShadow = true;
        imesh.raycast = THREE.InstancedMesh.prototype.raycast.bind(imesh);
        return imesh;
    });

    const angleStep = (endAngle - startAngle) / (count - 1);

    // Objectos temporários para cálculo de matrizes
    const dummy = new THREE.Object3D();
    const counters = new Array(instances.length).fill(0);

    for (let i = 0; i < count; i++) {
        const angle = startAngle + i * angleStep;
        const typeIdx = i % instances.length;

        const x = centerX + Math.cos(angle) * radius;
        const z = centerZ + Math.sin(angle) * radius;
        const scale = scaleMin + Math.random() * (scaleMax - scaleMin);

        // A altura precisa ser ajustada dependendo se é rocha1 ou rocha2
        const baseHeight = (typeIdx === 0) ? 3.0 : 2.5;
        dummy.position.set(x, (baseHeight * scale) / 2 - 0.2, z);
        dummy.scale.setScalar(scale);
        dummy.rotation.y = -angle + Math.PI / 2 + (Math.random() - 0.5) * 1.0;
        dummy.updateMatrix();

        instances[typeIdx].setMatrixAt(counters[typeIdx], dummy.matrix);
        counters[typeIdx]++;
    }

    const wallGroup = new THREE.Group();
    instances.forEach((imesh, idx) => {
        imesh.count = counters[idx];
        imesh.instanceMatrix.needsUpdate = true;
        wallGroup.add(imesh);
    });

    scene.add(wallGroup);
    console.log(`Muralha gerada: ${count} pedras (Instanced).`);
    return wallGroup;
}
