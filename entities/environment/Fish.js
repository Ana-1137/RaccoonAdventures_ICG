import * as THREE from 'three';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
const SETTINGS = {
    count: 6,
    color: 0xf4a460,          // cor laranja-acastanhado
    // Limites do basin: posição {x:2.6, z:0}, tamanho {w:3.2, h:9.3}
    basin: {
        cx: 2.6, cz: 0,
        halfW: 1.3, halfD: 4.0,
        y: -0.08,             // ligeiramente abaixo da superfície da água
    },
    speed: { min: 0.4, max: 0.9 },
    turnSpeed: 1.2,           // rad/s de viragem máxima
    avoidMargin: 0.25,        // margem antes das paredes para virar
};

// ─── GEOMETRIA DO PEIXE ──────────────────────────────────────────────────────
// Cone (corpo) + cone pequeno (cauda) — sem modelos externos
function createFishMesh() {
    const group = new THREE.Group();

    const mat = new THREE.MeshLambertMaterial({ color: SETTINGS.color });

    // Corpo: cone apontado para +Z (direção de movimento)
    const body = new THREE.Mesh(
        new THREE.ConeGeometry(0.04, 0.18, 6),
        mat
    );
    body.rotation.x = Math.PI / 2; // cone aponta para +Z
    group.add(body);

    // Cauda: cone pequeno atrás
    const tail = new THREE.Mesh(
        new THREE.ConeGeometry(0.03, 0.08, 4),
        mat
    );
    tail.rotation.x = -Math.PI / 2; // aponta para -Z
    tail.position.z = -0.1;
    group.add(tail);

    return group;
}

// ─── ESTADO INTERNO ─────────────────────────────────────────────────────────
const fishes = [];

/**
 * Cria os peixes e adiciona-os à cena.
 * @param {THREE.Scene} scene
 */
export function createFish(scene) {
    const { cx, cz, halfW, halfD, y } = SETTINGS.basin;

    for (let i = 0; i < SETTINGS.count; i++) {
        const mesh = createFishMesh();

        // Posição aleatória dentro do basin
        const px = cx + (Math.random() * 2 - 1) * (halfW - 0.1);
        const pz = cz + (Math.random() * 2 - 1) * (halfD - 0.1);
        mesh.position.set(px, y, pz);

        // Direção inicial aleatória (ângulo no plano XZ)
        const angle = Math.random() * Math.PI * 2;
        mesh.rotation.y = angle;

        const speed = SETTINGS.speed.min + Math.random() * (SETTINGS.speed.max - SETTINGS.speed.min);
        const phaseOffset = Math.random() * Math.PI * 2; // para ondulação do corpo

        fishes.push({ mesh, speed, phaseOffset });
        scene.add(mesh);
    }
}

/**
 * Atualiza o movimento dos peixes a cada frame.
 * Cada peixe nada em frente, ondula o corpo e vira ao aproximar-se das margens.
 * @param {number} delta
 */
export function updateFish(delta) {
    const { cx, cz, halfW, halfD, y, avoidMargin } = SETTINGS.basin;
    const now = Date.now() * 0.001;

    for (const fish of fishes) {
        const { mesh, speed, phaseOffset } = fish;

        // Ondulação lateral do corpo (cauda a abanar)
        mesh.rotation.z = Math.sin(now * 3 + phaseOffset) * 0.15;

        // Mover para a frente (direção local +Z do grupo)
        const forward = new THREE.Vector3(0, 0, 1).applyEuler(mesh.rotation);
        forward.y = 0;
        forward.normalize();

        mesh.position.addScaledVector(forward, speed * delta);
        mesh.position.y = y; // manter na superfície da água

        // Deteção de margem e viragem suave
        const dx = mesh.position.x - cx;
        const dz = mesh.position.z - cz;
        const nearWallX = Math.abs(dx) > halfW - avoidMargin;
        const nearWallZ = Math.abs(dz) > halfD - avoidMargin;

        if (nearWallX || nearWallZ) {
            // Virar em direção ao centro
            const toCenterAngle = Math.atan2(cx - mesh.position.x, cz - mesh.position.z);
            let diff = toCenterAngle - mesh.rotation.y;
            // Normalizar para [-PI, PI]
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            mesh.rotation.y += Math.sign(diff) * SETTINGS.turnSpeed * delta;
        }
    }
}
