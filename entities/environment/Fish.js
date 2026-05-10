import * as THREE from 'three';
import { getValeCenterXAtZ, GROUND_SETTINGS } from '../../world/Ground.js';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
const SETTINGS = {
    orbits: [
        { z: -3.0, xOffset: +1 }, { z: -1.5 }, { z:  0.0 },
        { z:  1.5 }, { z:  3.0, xOffset: -1 }, { z:  3.8, xOffset: -1 },
    ],
    orbit: {
        radiusX: 0.12,   // pequeno — mantém peixe no centro do vale
        radiusZ: 0.45,
        speedMin: 0.6,
        speedMax: 1.2,
        yBase: -0.18,
        yDip:  -0.22,
    },
    jump: {
        interval: { min: 5.0, max: 12.0 },
        height: 0.22,
        duration: 0.5,
    },
};

// ─── GEOMETRIA ───────────────────────────────────────────────────────────────
function createFishMesh() {
    const bodyColor = 0xf4a460;
    const finColor  = 0xe07840;
    const group = new THREE.Group();
    const depth = 0.02;

    // Corpo: elipse oval
    const bW = 0.045, bH = 0.022;
    const bodyShape = new THREE.Shape();
    bodyShape.absellipse(0, 0, bW, bH, 0, Math.PI * 2);
    const body = new THREE.Mesh(
        new THREE.ExtrudeGeometry(bodyShape, { depth, bevelEnabled: false }),
        new THREE.MeshLambertMaterial({ color: bodyColor })
    );
    body.position.z = -depth / 2;
    group.add(body);

    // Cauda: crescente
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0,  0);
    tailShape.lineTo(-0.028,  0.022);
    tailShape.lineTo(-0.015,  0);
    tailShape.lineTo(-0.028, -0.022);
    tailShape.closePath();
    const tail = new THREE.Mesh(
        new THREE.ExtrudeGeometry(tailShape, { depth, bevelEnabled: false }),
        new THREE.MeshLambertMaterial({ color: finColor })
    );
    tail.position.set(-bW, 0, -depth / 2);
    group.add(tail);

    // Barbatana dorsal
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(-0.010, 0);
    dorsalShape.lineTo( 0.015, 0);
    dorsalShape.lineTo( 0.005, 0.020);
    dorsalShape.closePath();
    const dorsal = new THREE.Mesh(
        new THREE.ExtrudeGeometry(dorsalShape, { depth: depth * 0.6, bevelEnabled: false }),
        new THREE.MeshLambertMaterial({ color: finColor })
    );
    dorsal.position.set(0, bH, -depth * 0.3);
    group.add(dorsal);

    // Barbatana peitoral
    const pectShape = new THREE.Shape();
    pectShape.absellipse(0, 0, 0.015, 0.008, 0, Math.PI * 2);
    const pectoral = new THREE.Mesh(
        new THREE.ExtrudeGeometry(pectShape, { depth: 0.003, bevelEnabled: false }),
        new THREE.MeshLambertMaterial({ color: finColor })
    );
    pectoral.position.set(0.010, -bH * 0.3, depth / 2);
    pectoral.rotation.x = Math.PI / 6;
    group.add(pectoral);

    // Olho + guelra — frente e trás
    const eyeMat   = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const gillMat  = new THREE.LineBasicMaterial({ color: 0xc05030 });

    for (const side of [depth / 2 + 0.001, -depth / 2 - 0.001]) {
        // Olho
        const eye = new THREE.Mesh(new THREE.CircleGeometry(0.005, 8), eyeMat);
        eye.position.set(0.028, 0.006, side);
        if (side < 0) eye.rotation.y = Math.PI;
        group.add(eye);

        // Guelra: arco curvo (linha)
        const gillPts = [];
        for (let i = 0; i <= 8; i++) {
            const a = -Math.PI * 0.35 + (Math.PI * 0.7) * (i / 8);
            gillPts.push(new THREE.Vector3(0.012 + Math.cos(a) * 0.012, Math.sin(a) * 0.016, side));
        }
        const gillGeo = new THREE.BufferGeometry().setFromPoints(gillPts);
        group.add(new THREE.Line(gillGeo, gillMat));
    }

    group.rotation.y = Math.PI / 2;
    return group;
}

// ─── ESTADO INTERNO ─────────────────────────────────────────────────────────
const fishes = [];

export function createFish(scene) {
    const { orbits, orbit, jump } = SETTINGS;

    orbits.forEach((cfg, i) => {
        const mesh = createFishMesh();
        const cx = getValeCenterXAtZ(cfg.z, GROUND_SETTINGS.vale) + (cfg.xOffset ?? 0);
        const speed = orbit.speedMin + Math.random() * (orbit.speedMax - orbit.speedMin);
        const phase = Math.random() * Math.PI * 2;
        const dir   = i % 2 === 0 ? 1 : -1;

        mesh.position.set(cx, orbit.yBase, cfg.z);
        // Sem colisões — o personagem pode atravessar os peixes
        mesh.traverse(obj => { if (obj.isMesh || obj.isLine) obj.raycast = () => {}; });
        scene.add(mesh);

        fishes.push({
            mesh, cx, cz: cfg.z, speed, phase, dir,
            xOffset: cfg.xOffset ?? 0,
            angle: phase,
            jumpTimer: jump.interval.min + Math.random() * (jump.interval.max - jump.interval.min),
            isJumping: false,
            jumpTime: 0,
        });
    });
}

export function updateFish(delta) {
    const { orbit, jump } = SETTINGS;
    const now = Date.now() * 0.001;

    for (const fish of fishes) {
        const { mesh } = fish;

        fish.angle += fish.dir * fish.speed * delta;

        const x = fish.cx + Math.cos(fish.angle) * orbit.radiusX;
        const z = fish.cz + Math.sin(fish.angle) * orbit.radiusZ;

        // Recalcular cx para o Z atual (segue curva do vale) + offset fixo
        fish.cx = getValeCenterXAtZ(fish.cz, GROUND_SETTINGS.vale) + fish.xOffset;

        const yDip = orbit.yBase + (orbit.yDip - orbit.yBase) * (0.5 + 0.5 * Math.sin(fish.angle * 2));

        // Salto
        fish.jumpTimer -= delta;
        let yPos = yDip;
        if (!fish.isJumping && fish.jumpTimer <= 0) { fish.isJumping = true; fish.jumpTime = 0; }
        if (fish.isJumping) {
            fish.jumpTime += delta;
            const p = fish.jumpTime / jump.duration;
            if (p >= 1.0) {
                fish.isJumping = false;
                fish.jumpTimer = jump.interval.min + Math.random() * (jump.interval.max - jump.interval.min);
            } else {
                yPos = orbit.yBase + Math.sin(p * Math.PI) * jump.height;
            }
        }

        mesh.position.set(x, yPos, z);

        // Orientação tangencial à elipse
        const tx = -fish.dir * Math.sin(fish.angle) * orbit.radiusX;
        const tz =  fish.dir * Math.cos(fish.angle) * orbit.radiusZ;
        mesh.rotation.y = Math.atan2(tx, tz);
        mesh.rotation.x = fish.isJumping ? Math.sin(fish.jumpTime / jump.duration * Math.PI) * 0.5 * fish.dir : 0;
        mesh.rotation.z = Math.sin(now * 4 + fish.phase) * 0.10;
    }
}
