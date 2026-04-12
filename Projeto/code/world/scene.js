import * as THREE from 'three';

function createScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Cor do céu (azul claro)
    
    // TODO: Adicionar nevoeiro (fog) aqui mais tarde
    // scene.fog = new THREE.Fog(0xcccccc, 10, 50);

    return scene;
}

/**
 * Cria o chão com duas texturas PBR:
 * 1. Textura base (relva) — cobre todo o plano
 * 2. Textura secundária (terra da fogueira) — plano pequeno central com alphaMap circular
 * @returns {Object} { groundMesh, campfireMesh }
 */
function createGround() {
    const textureLoader = new THREE.TextureLoader();
    
    // ── Textura Base (Relva) ──
    const grassColor = textureLoader.load('../elements/textures/Default/Color.jpg');
    const grassNormal = textureLoader.load('../elements/textures/Default/NormalGL.jpg');
    const grassRoughness = textureLoader.load('../elements/textures/Default/Roughness.jpg');
    
    // Configurar wrapping e repeat para todas as texturas
    [grassColor, grassNormal, grassRoughness].forEach(texture => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(15, 15);
    });
    
    // Criar o material PBR para o chão
    const groundMaterial = new THREE.MeshStandardMaterial({
        map: grassColor,
        normalMap: grassNormal,
        roughnessMap: grassRoughness,
        side: THREE.DoubleSide,
    });
    
    // Criar o plano do chão
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    
    // ── Textura Secundária (Terra da Fogueira) ──
    const campfireColor = textureLoader.load('../elements/textures/Campfire/Color.jpg');
    const campfireNormal = textureLoader.load('../elements/textures/Campfire/NormalGL.jpg');
    const campfireRoughness = textureLoader.load('../elements/textures/Campfire/Roughness.jpg');
    
    // Configurar wrapping e repeat para o campfire
    [campfireColor, campfireNormal, campfireRoughness].forEach(texture => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(3, 3);
    });
    
    // Criar alphaMap circular programaticamente
    const alphaMapCanvas = document.createElement('canvas');
    alphaMapCanvas.width = 256;
    alphaMapCanvas.height = 256;
    const ctx = alphaMapCanvas.getContext('2d');
    
    const centerX = alphaMapCanvas.width / 2;
    const centerY = alphaMapCanvas.height / 2;
    const maxRadius = alphaMapCanvas.width / 2;
    
    // Preencher com gradiente circular (opaco no centro, transparente nas bordas)
    for (let y = 0; y < alphaMapCanvas.height; y++) {
        for (let x = 0; x < alphaMapCanvas.width; x++) {
            const dx = x - centerX;
            const dy = y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const radius = Math.min(distance / maxRadius, 1);
            
            // Gradiente suave: 1 (opaco) no centro para 0 (transparente) nas bordas
            const alpha = Math.max(0, 1 - radius * radius);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    
    const alphaMapTexture = new THREE.CanvasTexture(alphaMapCanvas);
    
    // Criar o material PBR com alphaMap para o campfire
    const campfireMaterial = new THREE.MeshStandardMaterial({
        map: campfireColor,
        normalMap: campfireNormal,
        roughnessMap: campfireRoughness,
        alphaMap: alphaMapTexture,
        transparent: true,
        side: THREE.DoubleSide,
    });
    
    // Criar o plano do campfire (8x8, posicionado ligeiramente acima para evitar z-fighting)
    const campfireGeometry = new THREE.PlaneGeometry(8, 8);
    const campfireMesh = new THREE.Mesh(campfireGeometry, campfireMaterial);
    campfireMesh.position.y = 0.001; // Ligeiramente acima do chão
    campfireMesh.rotation.x = -Math.PI / 2;
    campfireMesh.receiveShadow = true;
    
    return { groundMesh, campfireMesh };
}

export { createScene, createGround };
