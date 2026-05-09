import * as THREE from 'three';
import { getValeCenterXAtZ, GROUND_SETTINGS } from '../../world/Ground.js';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
const SETTINGS = {
    // Centros fixos das elipses ao longo do rio (Z distribuído)
    orbits: [
        { z: -3.0 }, { z: -1.5 }, { z:  0.0 },
        { z:  1.5 }, { z:  3.0 }, { z:  3.8 },
    ],
    orbit: {
        radiusX: 0.35,   // raio da elipse no eixo X (largura)
        radiusZ: 0.55,   // raio da elipse no eixo Z (comprimento)
        speedMin: 0.6,   // rad/s
        speedMax: 1.2,
        yBase: -0.06,    // Y base (superfície da água)
        yDip: -0.12,     // Y mínimo (mergulho suave)
    },
    jump: {
        interval: { min: 5.0, max: 12.0 },
        height: 0.28,
        duration: 0.55,
    },
};

// ─── GEOMETRIA ───────────────────────────────────────────────────────────────
function createFishMesh() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xf4a460 });
    const group = new THREE.Group();

    const body = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 6), mat);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 4), mat);
    tail.rotation.x = -Math.PI / 2;
    tail.position.z = -0.1;
    group.add(tail);

    return group;
}

// ─── ESTADO INTERNO ─────────────────────────────────────────────────────────
const fishes = [];

export function createFish(scene) {
    const { orbits, orbit, jump } = SETTINGS;

    orbits.forEach((cfg, i) => {
        const mesh = createFishMesh();

        // Centro da elipse: X segue a curva do vale
        const cx = getValeCenterXAtZ(cfg.z, GROUND_SETTINGS.vale);

        const speed = orbit.speedMin + Math.random() * (orbit.speedMax - orbit.speedMin);
        const phase = Math.random() * Math.PI * 2; // fase inicial diferente por peixe
        const dir   = i % 2 === 0 ? 1 : -1;       // metade no sentido horário, metade anti

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

        // ── Avançar ângulo da elipse ─────────────────────────────────────────
        fish.angle += fish.dir * fish.speed * delta;

        const x = fish.cx + Math.cos(fish.angle) * orbit.radiusX;
        const z = fish.cz + Math.sin(fish.angle) * orbit.radiusZ;

        // Mergulho suave: Y oscila entre yBase e yDip com o ângulo
        const yDip = orbit.yBase + (orbit.yDip - orbit.yBase) * (0.5 + 0.5 * Math.sin(fish.angle * 2));

        // ── Salto ────────────────────────────────────────────────────────────
        fish.jumpTimer -= delta;
        let yPos = yDip;

        if (!fish.isJumping && fish.jumpTimer <= 0) {
            fish.isJumping = true;
            fish.jumpTime  = 0;
        }
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

        // Orientar o peixe tangencialmente à elipse
        const tx = -fish.dir * Math.sin(fish.angle) * orbit.radiusX;
        const tz =  fish.dir * Math.cos(fish.angle) * orbit.radiusZ;
        mesh.rotation.y = Math.atan2(tx, tz);

        // Inclinação no salto
        mesh.rotation.x = fish.isJumping
            ? Math.sin(fish.jumpTime / jump.duration * Math.PI) * 0.5 * fish.dir
            : 0;

        // Ondulação lateral
        mesh.rotation.z = Math.sin(now * 4 + fish.phase) * 0.12;
    }
}
