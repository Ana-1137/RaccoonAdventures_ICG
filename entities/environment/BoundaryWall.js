import * as THREE from 'three';
import { getAssetPath } from '../../config.js';
import { loadGLTF, cloneScene, freezeObject } from '../../core/AssetCache.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
const SETTINGS = {
    models: [
        getAssetPath('elements/cascata1.glb'),
        getAssetPath('elements/cascata2.glb')
    ],
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
 * Extrai a geometria e o material do primeiro mesh num GLTF.
 */
function extractFirstMesh(gltf) {
    let geometry = null, material = null;
    gltf.scene.traverse(child => {
        if (child.isMesh && !geometry) {
            geometry = child.geometry.clone();
            // Converter para Lambert para poupar GPU, igual à floresta
            material = new THREE.MeshLambertMaterial({
                color: child.material.color ?? 0xffffff,
                map: child.material.map ?? null,
            });
        }
    });
    return { geometry, material };
}

/**
 * Constrói uma muralha em forma de U usando InstancedMesh para máxima performance.
 * @param {THREE.Scene} scene 
 */
export async function loadBoundaryWall(scene) {
    const gltfs = await Promise.all(SETTINGS.models.map(file => loadGLTF(file)));

    // Extrair os dados dos meshes
    const meshesData = gltfs.map(extractFirstMesh);

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

        // A altura (y) precisa ser proporcional à escala para não ficar enterrada.
        // As cascatas normais estão a Y=1.99 com escala 2.0 (ratio aprox 1.0)
        dummy.position.set(x, scale * 1.0, z);
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
