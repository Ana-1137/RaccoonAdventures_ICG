import * as THREE from 'three';
import { getValeCenterXAtZ, GROUND_SETTINGS } from '../../world/Ground.js';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
const SETTINGS = {
    orbits: [
        { z: -3.0 }, { z: -1.5 }, { z:  0.0 },
        { z:  1.5 }, { z:  3.0 }, { z:  3.8 },
    ],
    orbit: {
        radiusX: 0.12,   // pequeno — mantém peixe no centro do vale
        radiusZ: 0.45,
        speedMin: 0.6,
        speedMax: 1.2,
        yBase: -0.05,
        yDip:  -0.10,
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
    const depth = 0.04; // espessura de extrusão (peixe achatado)

    // ── Corpo: elipse oval ──────────────────────────────────────────────────
    const bodyShape = new THREE.Shape();
    const bW = 0.09, bH = 0.045; // semi-eixos da elipse
    bodyShape.absellipse(0, 0, bW, bH, 0, Math.PI * 2);
    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, { depth, bevelEnabled: false });
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: bodyColor }));
    body.position.z = -depth / 2;
    group.add(body);

    // ── Cauda: dois triângulos formando um crescente ─────────────────────────
    const tailShape = new THREE.Shape();
    tailShape.moveTo(0,  0);
    tailShape.lineTo(-0.055,  0.045);
    tailShape.lineTo(-0.03,   0);
    tailShape.lineTo(-0.055, -0.045);
    tailShape.closePath();
    const tailGeo = new THREE.ExtrudeGeometry(tailShape, { depth, bevelEnabled: false });
    const tail = new THREE.Mesh(tailGeo, new THREE.MeshLambertMaterial({ color: finColor }));
    tail.position.set(-bW, 0, -depth / 2);
    group.add(tail);

    // ── Barbatana dorsal: triângulo no topo ──────────────────────────────────
    const dorsalShape = new THREE.Shape();
    dorsalShape.moveTo(-0.02, 0);
    dorsalShape.lineTo( 0.03, 0);
    dorsalShape.lineTo( 0.01, 0.04);
    dorsalShape.closePath();
    const dorsal = new THREE.Mesh(
        new THREE.ExtrudeGeometry(dorsalShape, { depth: depth * 0.6, bevelEnabled: false }),
        new THREE.MeshLambertMaterial({ color: finColor })
    );
    dorsal.position.set(0, bH, -depth * 0.3);
    group.add(dorsal);

    // ── Barbatana peitoral: oval achatado lateral ────────────────────────────
    const pectShape = new THREE.Shape();
    pectShape.absellipse(0, 0, 0.03, 0.015, 0, Math.PI * 2);
    const pectoral = new THREE.Mesh(
        new THREE.ExtrudeGeometry(pectShape, { depth: 0.005, bevelEnabled: false }),
        new THREE.MeshLambertMaterial({ color: finColor })
    );
    pectoral.position.set(0.02, -bH * 0.3, depth / 2);
    pectoral.rotation.x = Math.PI / 6;
    group.add(pectoral);

    // ── Olho: círculo pequeno ────────────────────────────────────────────────
    const eyeGeo = new THREE.CircleGeometry(0.010, 8);
    const eye = new THREE.Mesh(eyeGeo, new THREE.MeshBasicMaterial({ color: 0x111111 }));
    eye.position.set(0.055, 0.012, depth / 2 + 0.001);
    group.add(eye);

    // Orientar o grupo: peixe aponta para +Z (frente)
    group.rotation.y = Math.PI / 2;

    return group;
}

// ─── ESTADO INTERNO ─────────────────────────────────────────────────────────
const fishes = [];

export function createFish(scene) {
    const { orbits, orbit, jump } = SETTINGS;

    orbits.forEach((cfg, i) => {
        const mesh = createFishMesh();
        const cx = getValeCenterXAtZ(cfg.z, GROUND_SETTINGS.vale);
        const speed = orbit.speedMin + Math.random() * (orbit.speedMax - orbit.speedMin);
        const phase = Math.random() * Math.PI * 2;
        const dir   = i % 2 === 0 ? 1 : -1;

        mesh.position.set(cx, orbit.yBase, cfg.z);
        scene.add(mesh);

        fishes.push({
            mesh, cx, cz: cfg.z, speed, phase, dir,
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

        // Recalcular cx para o Z atual (segue curva do vale)
        fish.cx = getValeCenterXAtZ(fish.cz, GROUND_SETTINGS.vale);

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
