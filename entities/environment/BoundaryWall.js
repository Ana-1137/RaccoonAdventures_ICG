import * as THREE from 'three';

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
function createProceduralRockBlock(width, height, depth) {
    // Usar BoxGeometry com alguns segmentos para permitir deformação
    const geometry = new THREE.BoxGeometry(width, height, depth, 3, 5, 3);
    
    // Deformar vértices aleatoriamente para parecer orgânico (mas subtil)
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        
        // Multiplicador de ruído mais subtil (apenas +/- 10% ou um offset fixo pequeno)
        const offsetX = (Math.random() - 0.5) * 0.3;
        const offsetY = (Math.random() - 0.5) * 0.3;
        const offsetZ = (Math.random() - 0.5) * 0.3;
        
        pos.setXYZ(i, x + offsetX, y + offsetY, z + offsetZ);
    }
    
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({
        color: 0x5a5a5a, // Cinzento rocha mais escuro
        flatShading: true // Dá o aspeto low-poly facetado para esconder a falta de texturas detalhadas
    });

    return { geometry, material };
}

/**
 * Constrói uma muralha em forma de U usando InstancedMesh procedural para máxima performance.
 * @param {THREE.Scene} scene 
 */
export async function loadBoundaryWall(scene) {
    // Extrair os dados dos meshes gerados em código (ZERO DOWNLOADS DE REDE!)
    // Criamos 2 tipos diferentes de blocos: um mais alto e um mais largo
    const rock1 = createProceduralRockBlock(1.5, 3.0, 1.5);
    const rock2 = createProceduralRockBlock(2.0, 2.5, 1.8);
    
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
