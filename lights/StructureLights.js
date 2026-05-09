import * as THREE from 'three';

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
const SETTINGS = {
    festoon: {
        // Pontos de ancoragem do cordão (árvores/postes à volta do acampamento)
        anchors: [
            { x: -2.5, y: 2.2, z:  2.0 },   // árvore esquerda-frente
            { x:  2.5, y: 2.2, z:  2.0 },   // árvore direita-frente
            { x:  2.5, y: 2.2, z: -2.5 },   // árvore direita-trás (perto da tenda)
            { x: -2.5, y: 2.2, z: -2.5 },   // árvore esquerda-trás
        ],
        bulbsPerSegment: 4,    // lâmpadas entre cada par de âncoras
        bulbColor: 0xffdd88,   // branco-quente
        bulbSize: 0.06,
        lightIntensity: 0.8,
        lightRange: 1.5,
        sag: 0.25,             // curvatura do fio (metros de descida no meio)
    },
    gardenPosts: [
        // Ao longo da margem do vale (lado esquerdo do rio)
        { x:  1.2, z:  1.5 },
        { x:  1.2, z:  0.0 },
        { x:  1.2, z: -1.5 },
        { x:  1.2, z: -3.0 },
    ],
    post: {
        height: 0.6,
        lightIntensity: 0.6,
        lightRange: 1.2,
        lightColor: 0xffeebb,
    },
    lantern: {
        position: { x: 0.6, y: 1.6, z: -2.2 },  // galho perto da entrada da tenda
        lightIntensity: 0.9,
        lightRange: 2.5,
        lightColor: 0xffcc66,
    },
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

/** Cria uma lâmpada esférica pequena (bulbo festoon). */
function createBulb(color) {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(SETTINGS.festoon.bulbSize, 6, 6),
        new THREE.MeshBasicMaterial({ color })
    );
    return mesh;
}

/** Cria um poste de jardim procedural (cilindro + cúpula). */
function createGardenPost(x, z) {
    const group = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0x5c3d1e });

    // Haste
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, SETTINGS.post.height, 6), mat);
    shaft.position.set(0, SETTINGS.post.height / 2, 0);
    group.add(shaft);

    // Cúpula
    const dome = new THREE.Mesh(
        new THREE.SphereGeometry(0.07, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: 0x333333 })
    );
    dome.position.y = SETTINGS.post.height;
    group.add(dome);

    // Luz
    const light = new THREE.SpotLight(
        SETTINGS.post.lightColor,
        SETTINGS.post.lightIntensity,
        SETTINGS.post.lightRange,
        Math.PI / 3,   // ângulo do cone
        0.5            // penumbra
    );
    light.position.set(0, SETTINGS.post.height, 0);
    light.target.position.set(0, 0, 0);
    group.add(light);
    group.add(light.target);

    group.position.set(x, 0, z);
    return group;
}

/** Cria a lanterna da tenda (caixa + luz). */
function createTentLantern() {
    const group = new THREE.Group();
    const { position, lightIntensity, lightRange, lightColor } = SETTINGS.lantern;

    // Corpo da lanterna
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.12, 0.08),
        new THREE.MeshLambertMaterial({ color: 0x222222 })
    );
    group.add(body);

    // Vidro emissivo
    const glass = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, 0.09, 0.06),
        new THREE.MeshBasicMaterial({ color: lightColor, transparent: true, opacity: 0.7 })
    );
    group.add(glass);

    // Luz
    const light = new THREE.PointLight(lightColor, lightIntensity, lightRange);
    group.add(light);

    group.position.set(position.x, position.y, position.z);
    return { group, light };
}

// ─── FUNÇÃO PÚBLICA ──────────────────────────────────────────────────────────

/**
 * Cria e adiciona à cena: cordão festoon, postes de jardim e lanterna da tenda.
 * @param {THREE.Scene} scene
 * @returns {{ lights: THREE.Light[], settings: Object }}
 */
export function createStructureLights(scene) {
    const allLights = [];

    // ── 1. CORDÃO FESTOON ────────────────────────────────────────────────────
    const { anchors, bulbsPerSegment, bulbColor, lightIntensity, lightRange, sag } = SETTINGS.festoon;

    for (let s = 0; s < anchors.length; s++) {
        const a = anchors[s];
        const b = anchors[(s + 1) % anchors.length];

        for (let i = 1; i <= bulbsPerSegment; i++) {
            const t = i / (bulbsPerSegment + 1);

            // Interpolação linear + sag parabólico
            const x = a.x + (b.x - a.x) * t;
            const z = a.z + (b.z - a.z) * t;
            const yLinear = a.y + (b.y - a.y) * t;
            const ySag = -sag * 4 * t * (1 - t);   // parábola: 0 nas pontas, -sag no meio
            const y = yLinear + ySag;

            // Bulbo visual
            const bulb = createBulb(bulbColor);
            bulb.position.set(x, y, z);
            scene.add(bulb);

            // Luz pontual por bulbo (intensidade baixa para não sobrecarregar)
            const light = new THREE.PointLight(bulbColor, lightIntensity, lightRange);
            light.position.set(x, y, z);
            scene.add(light);
            allLights.push(light);
        }
    }

    // ── 2. POSTES DE JARDIM ──────────────────────────────────────────────────
    for (const cfg of SETTINGS.gardenPosts) {
        const post = createGardenPost(cfg.x, cfg.z);
        scene.add(post);
        // Recolher SpotLights do grupo
        post.traverse(obj => { if (obj.isLight) allLights.push(obj); });
    }

    // ── 3. LANTERNA DA TENDA ─────────────────────────────────────────────────
    const { group: lanternGroup, light: lanternLight } = createTentLantern();
    scene.add(lanternGroup);
    allLights.push(lanternLight);

    // ── Settings expostos para o Dashboard ───────────────────────────────────
    const settings = { enabled: true };

    return { lights: allLights, settings };
}
