import * as THREE from 'three';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
// O basin está em {cx:2.6, cz:0}, tamanho {w:3.2, h:9.3}
// O vale tem uma curva — o centro X desloca-se ligeiramente ao longo do Z
// Os peixes nadam ao longo do eixo Z (cima/baixo no rio) com oscilação em X
const SETTINGS = {
    count: 6,
    color: 0xf4a460,
    basin: {
        cx: 2.6,          // centro X do rio
        zMin: -4.0,       // limite sul do rio (perto das cascatas)
        zMax:  4.0,       // limite norte do rio
        y: -0.06,         // Y base (superfície da água)
        xSpread: 0.6,     // variação lateral máxima em X
    },
    swim: {
        speedMin: 0.8,
        speedMax: 1.6,
        // Oscilação lateral (simula curva do vale)
        wobbleAmpX: 0.3,
        wobbleFreqX: 0.4,
        // Salto fora de água
        jumpInterval: { min: 4.0, max: 9.0 }, // segundos entre saltos
        jumpHeight: 0.25,
        jumpDuration: 0.5,  // segundos no ar
    },
};

// ─── GEOMETRIA ───────────────────────────────────────────────────────────────
function createFishMesh() {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: SETTINGS.color });

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
    const { cx, zMin, zMax, y, xSpread } = SETTINGS.basin;
    const { speedMin, speedMax, jumpInterval } = SETTINGS.swim;
    const zRange = zMax - zMin;

    for (let i = 0; i < SETTINGS.count; i++) {
        const mesh = createFishMesh();

        // Cada peixe tem uma posição Z inicial diferente ao longo do rio
        const zOffset = zMin + (i / SETTINGS.count) * zRange;
        // Offset lateral fixo dentro do rio
        const xOffset = (Math.random() * 2 - 1) * xSpread;
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        const phaseOffset = Math.random() * Math.PI * 2;
        // Direção inicial: metade vai para norte, metade para sul
        const dir = i % 2 === 0 ? 1 : -1;

        // Timer para próximo salto
        const nextJump = jumpInterval.min + Math.random() * (jumpInterval.max - jumpInterval.min);

        mesh.position.set(cx + xOffset, y, zOffset);
        scene.add(mesh);

        fishes.push({
            mesh, speed, phaseOffset, xOffset, dir,
            // Parâmetro t: posição normalizada no rio [0,1], mapeado para [zMin, zMax]
            t: (zOffset - zMin) / zRange,
            jumpTimer: nextJump,
            isJumping: false,
            jumpTime: 0,
        });
    }
}

export function updateFish(delta) {
    const { cx, zMin, zMax, y } = SETTINGS.basin;
    const { speedMin, wobbleAmpX, wobbleFreqX, jumpInterval, jumpHeight, jumpDuration } = SETTINGS.swim;
    const zRange = zMax - zMin;
    const now = Date.now() * 0.001;

    for (const fish of fishes) {
        const { mesh, speed, phaseOffset, xOffset } = fish;

        // ── Avançar t ao longo do rio ────────────────────────────────────────
        fish.t += fish.dir * speed * delta / zRange;

        // Inverter direção nas extremidades
        if (fish.t >= 1.0) { fish.t = 1.0; fish.dir = -1; }
        if (fish.t <= 0.0) { fish.t = 0.0; fish.dir =  1; }

        // Posição Z ao longo do rio
        const z = zMin + fish.t * zRange;

        // Oscilação lateral suave (simula curva do vale)
        const x = cx + xOffset + Math.sin(fish.t * Math.PI * 2 * wobbleFreqX + phaseOffset) * wobbleAmpX;

        // ── Salto ────────────────────────────────────────────────────────────
        fish.jumpTimer -= delta;
        let yPos = y;

        if (!fish.isJumping && fish.jumpTimer <= 0) {
            fish.isJumping = true;
            fish.jumpTime = 0;
        }

        if (fish.isJumping) {
            fish.jumpTime += delta;
            const progress = fish.jumpTime / jumpDuration;
            if (progress >= 1.0) {
                fish.isJumping = false;
                fish.jumpTimer = jumpInterval.min + Math.random() * (jumpInterval.max - jumpInterval.min);
            } else {
                // Parábola: sobe e desce
                yPos = y + Math.sin(progress * Math.PI) * jumpHeight;
            }
        }

        mesh.position.set(x, yPos, z);

        // Orientar o peixe na direção de movimento (Z + ligeira inclinação no salto)
        mesh.rotation.y = fish.dir > 0 ? 0 : Math.PI;
        if (fish.isJumping) {
            const progress = fish.jumpTime / jumpDuration;
            mesh.rotation.x = Math.sin(progress * Math.PI) * 0.4 * fish.dir;
        } else {
            mesh.rotation.x = 0;
        }

        // Ondulação lateral do corpo
        mesh.rotation.z = Math.sin(now * 4 + phaseOffset) * 0.12;
    }
}
