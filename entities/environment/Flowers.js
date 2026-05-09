import * as THREE from 'three';
import { loadGLTF, cloneScene, freezeObject } from '../../core/AssetCache.js';
import { getAssetPath } from '../../config.js';

const SETTINGS = {
    count: 10,
    scale: { min: 0.025, max: 0.05 },
    collectRadius: 0.18,   // só coleta quando mesmo em cima
    sparkleRadius: 1.2,    // distância para ativar partículas
    spawn: { centerX: 0, centerZ: 1.5, innerR: 3.2, outerR: 6.5 },
    sparkle: {
        count: 8,
        color: 0xffee88,
        size: 0.06,
        speed: 0.4,
        spread: 0.15,
    },
};

// Estado do módulo
const _flowers = [];  // { mesh, collected, sparklePts, sparklePhases }
let _collected = 0;
let _total = 0;
let _onCollect = null;

/** Cria o sistema de partículas brilhantes de uma flor (invisível por defeito). */
function _createSparkle(scene, x, z) {
    const { count, color, size, spread } = SETTINGS.sparkle;
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
        positions[i * 3]     = x + (Math.random() - 0.5) * spread;
        positions[i * 3 + 1] = Math.random() * spread;
        positions[i * 3 + 2] = z + (Math.random() - 0.5) * spread;
        phases[i] = Math.random() * Math.PI * 2;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
        color, size, sizeAttenuation: true,
        transparent: true, opacity: 0, depthWrite: false,
    });

    const pts = new THREE.Points(geo, mat);
    pts.userData.isParticles = true;  // ignorado pelo raycast do raccoon
    pts.visible = false;
    scene.add(pts);
    return { pts, phases, baseX: x, baseZ: z };
}

export async function createFlowers(scene, exclusionZones = [], onCollect = null) {
    _onCollect = onCollect;

    const gltf = await loadGLTF(getAssetPath('elements/Flower.glb'));

    const { count, scale, spawn } = SETTINGS;
    const { centerX, centerZ, innerR, outerR } = spawn;
    const ir2 = innerR * innerR, or2 = outerR * outerR;

    let placed = 0, attempts = 0;

    while (placed < count && attempts < count * 20) {
        attempts++;
        const angle = Math.random() * Math.PI * 2;
        const r = innerR + Math.random() * (outerR - innerR);
        const x = centerX + Math.cos(angle) * r;
        const z = centerZ + Math.sin(angle) * r;

        const d2 = (x - centerX) ** 2 + (z - centerZ) ** 2;
        if (d2 < ir2 || d2 > or2) continue;

        let excluded = false;
        for (const zone of exclusionZones) {
            if (_inZone(x, z, zone)) { excluded = true; break; }
        }
        if (excluded) continue;

        const s = scale.min + Math.random() * (scale.max - scale.min);
        const mesh = cloneScene(gltf);
        mesh.scale.setScalar(s);
        mesh.position.set(x, 0, z);
        mesh.rotation.x = -Math.PI / 2;
        mesh.rotation.z = Math.random() * Math.PI * 2;
        freezeObject(mesh);
        // Desativar raycast DEPOIS de freezeObject (traverse interno não repõe raycast)
        mesh.traverse(o => { if (o.isMesh) o.raycast = () => {}; });
        mesh.userData.isParticles = true;  // flag extra para o filtro do raccoon
        scene.add(mesh);

        const sparkle = _createSparkle(scene, x, z);
        _flowers.push({ mesh, collected: false, sparkle });
        placed++;
    }

    _total = _flowers.length;
    return _flowers.length;
}

export function updateFlowers(playerPos, delta) {
    if (_collected === _total) return _collected;

    const now = Date.now() * 0.001;
    const collectR2 = SETTINGS.collectRadius ** 2;
    const sparkleR2 = SETTINGS.sparkleRadius ** 2;
    const { speed, spread, count } = SETTINGS.sparkle;

    for (const f of _flowers) {
        if (f.collected) continue;

        const dx = playerPos.x - f.mesh.position.x;
        const dz = playerPos.z - f.mesh.position.z;
        const d2 = dx * dx + dz * dz;

        // ── Partículas brilhantes ────────────────────────────────────────────
        const near = d2 < sparkleR2;
        const { pts, phases, baseX, baseZ } = f.sparkle;
        pts.visible = near;
        if (near) {
            const targetOpacity = 0.5 + 0.5 * (1 - Math.sqrt(d2) / SETTINGS.sparkleRadius);
            pts.material.opacity = THREE.MathUtils.lerp(pts.material.opacity, targetOpacity, 0.1);

            const pos = pts.geometry.attributes.position;
            for (let i = 0; i < count; i++) {
                const t = now * speed + phases[i];
                pos.array[i * 3]     = baseX + Math.cos(t) * spread;
                pos.array[i * 3 + 1] = 0.05 + Math.abs(Math.sin(t * 1.3)) * spread;
                pos.array[i * 3 + 2] = baseZ + Math.sin(t * 0.9) * spread;
            }
            pos.needsUpdate = true;
        } else {
            pts.material.opacity = 0;
        }

        // ── Coleta ───────────────────────────────────────────────────────────
        if (d2 < collectR2) {
            f.collected = true;
            f.mesh.visible = false;
            pts.visible = false;
            _collected++;
            if (_onCollect) _onCollect(_collected, _total);
        }
    }
    return _collected;
}

export function getFlowerCount() { return { collected: _collected, total: _total }; }

function _inZone(x, z, zone) {
    if (zone.type === 'circle') {
        const dx = x - zone.x, dz = z - zone.z;
        return dx * dx + dz * dz < zone.radius * zone.radius;
    }
    if (zone.type === 'rect') {
        return Math.abs(x - zone.x) < zone.halfW && Math.abs(z - zone.z) < zone.halfD;
    }
    return false;
}
