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
// Cabeça: meia-esfera achatada
// Corpo:  cilindro truncado (CylinderGeometry com raios diferentes)
// Cauda:  pirâmide retangular (BoxGeometry deformada via vertices não — usamos ConeGeometry 4 lados achatado)
function createFishMesh() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xe8935a });
    const finMat = new THREE.MeshLambertMaterial({ color: 0xc0623a });
    const group = new THREE.Group();

    // Cabeça: meia-esfera achatada (SphereGeometry com phiLength = PI/2, escala Y reduzida)
    const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
        mat
    );
    head.rotation.x = -Math.PI / 2; // abre para trás (+Z)
    head.position.z =  0.055;
    head.scale.y = 0.6;
    group.add(head);

    // Corpo: cone truncado (frente mais largo, trás mais estreito)
    const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.026, 0.10, 7),
        mat
    );
    body.rotation.x = Math.PI / 2;
    body.position.z = 0.0;
    group.add(body);

    // Cauda: pirâmide retangular achatada (4 lados, escala X > Y)
    const tail = new THREE.Mesh(
        new THREE.ConeGeometry(0.028, 0.055, 4),
        finMat
    );
    tail.rotation.x = -Math.PI / 2; // aponta para -Z
    tail.rotation.z =  Math.PI / 4; // rodar 45° para ficar em losango
    tail.scale.x = 1.6;             // achatar horizontalmente
    tail.scale.y = 0.5;
    tail.position.z = -0.07;
    group.add(tail);

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
