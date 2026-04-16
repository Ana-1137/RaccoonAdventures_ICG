import * as THREE from 'three';

// ─── Configuração Central para Luzes ─────────────────────────────────────────
const LIGHTING_SETTINGS = {
    sun: {
        color: 0xffffff,
        intensity: 1,
        position: { x: 5, y: 10, z: 7.5 },
    },
    ambient: {
        color: 0xffffff,
        intensity: 0.5,
    },
    campfire: {
        color: 0xff8c00,
        intensity: 1,
        range: 15,
        position: { x: 0, y: 0.8, z: 0 },
        castShadow: true, // Desativar para otimização
    },
};

// ─────────────────────────────────────────────────────────────────────────────

function createLights(scene) {
    // Luz ambiente para iluminar toda a cena
    const ambientLight = new THREE.AmbientLight(LIGHTING_SETTINGS.ambient.color, LIGHTING_SETTINGS.ambient.intensity);
    scene.add(ambientLight);

    // Luz direcional para simular o sol
    const directionalLight = new THREE.DirectionalLight(LIGHTING_SETTINGS.sun.color, LIGHTING_SETTINGS.sun.intensity);
    directionalLight.position.set(
        LIGHTING_SETTINGS.sun.position.x,
        LIGHTING_SETTINGS.sun.position.y,
        LIGHTING_SETTINGS.sun.position.z
    );
    directionalLight.castShadow = true; // Ativar sombras
    scene.add(directionalLight);
    
    return {
        ambientLight,
        directionalLight,
    };
}

/**
 * Cria a luz da fogueira com visual e animação de tremeluzir
 * @param {THREE.Scene} scene - Cena Three.js
 * @returns {Object} { light, mesh, settings } - Luz, modelo visual e configurações
 */
function createCampfireLight(scene) {
    // ─── LUZ PONTUAL OTIMIZADA ──────────────────────────────────────────────
    const campfireLight = new THREE.PointLight(
        LIGHTING_SETTINGS.campfire.color,
        LIGHTING_SETTINGS.campfire.intensity,
        LIGHTING_SETTINGS.campfire.range
    );
    campfireLight.position.set(
        LIGHTING_SETTINGS.campfire.position.x,
        LIGHTING_SETTINGS.campfire.position.y,
        LIGHTING_SETTINGS.campfire.position.z
    );
    // Desativar sombras aqui para melhor performance (sol já projeta sombras)
    campfireLight.castShadow = false;
    scene.add(campfireLight);
    
    // ─── MODELO VISUAL DO FOGO (Esfera + Partículas) ────────────────────────────
    const fireGroup = new THREE.Group();
    fireGroup.position.set(
        LIGHTING_SETTINGS.campfire.position.x,
        LIGHTING_SETTINGS.campfire.position.y - 0.8,  // Esfera muito mais para baixo
        LIGHTING_SETTINGS.campfire.position.z
    );
    fireGroup.userData.isParticles = true; // Marcar GROUP para excluir de raycasts
    scene.add(fireGroup);
    
    // Material base da esfera de fogo - muito transparente, só brilho
    const fireMaterial = new THREE.MeshBasicMaterial({
        color: 0xff8c00,
        transparent: true,
        opacity: 0.2,  // Muito transparente para parecer só brilho
        side: THREE.DoubleSide,
        depthWrite: false,
    });
    
    // Esfera central de fogo - maior mas muito transparente
    const fireGeometry = new THREE.SphereGeometry(0.15, 16, 16);  // Maior para efeito de brilho
    const fireSphereMesh = new THREE.Mesh(fireGeometry, fireMaterial);
    fireGroup.add(fireSphereMesh);
    
    // ─── SISTEMA DE PARTÍCULAS PARA EFEITO DE CHAMA ──────────────────────────
    // Criar partículas que saem da esfera e sobem
    const particleCount = 100;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = [];
    const particleLife = [];
    const particleMaxLife = new Float32Array(particleCount);
    
    // Inicializar partículas
    for (let i = 0; i < particleCount; i++) {
        // Posição inicial aleatória na esfera - muito menor
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const radius = 0.05 + Math.random() * 0.05;  // Minúsculo (era 0.3-0.5)
        
        particlePositions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
        particlePositions[i * 3 + 1] = Math.cos(phi) * radius;
        particlePositions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
        
        // Velocidade inicial (para cima)
        particleVelocities.push({
            x: (Math.random() - 0.5) * 0.02,
            y: 0.03 + Math.random() * 0.02,
            z: (Math.random() - 0.5) * 0.02,
        });
        
        // Tempo de vida
        particleMaxLife[i] = 1.5 + Math.random() * 1.0;
        particleLife[i] = 0;
    }
    
    // Geometry das partículas
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    
    // Material das partículas (pontos minúsculos com cor de fogo)
    const particleMaterial = new THREE.PointsMaterial({
        color: 0xff8c00,
        size: 0.01,  // Minúsculo
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
    });
    
    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    particleSystem.userData.isParticles = true; // Marcar para excluir de raycasts
    fireGroup.add(particleSystem);
    
    const particleData = {
        positions: particlePositions,
        velocities: particleVelocities,
        life: particleLife,
        maxLife: particleMaxLife,
        geometry: particleGeometry,
    };
    
    // ─── SETTINGS PARA DASHBOARD ────────────────────────────────────────────
    const campfireSettings = {
        enabled: true,
        intensity: LIGHTING_SETTINGS.campfire.intensity,
        range: LIGHTING_SETTINGS.campfire.range,
        color: '#ff8c00',
    };
    
    // ─── OBJETO DE RETORNO COM ANIMAÇÃO ─────────────────────────────────────
    const campfireObject = {
        light: campfireLight,
        mesh: fireGroup,
        settings: campfireSettings,
        
        /**
         * Atualiza a animação de tremeluzir da fogueira
         * @param {number} deltaTime - Tempo em segundos
         */
        update() {
            if (!campfireSettings.enabled) {
                this.light.visible = false;
                this.mesh.visible = false;
                return;
            }
            
            this.light.visible = true;
            this.mesh.visible = true;
            
            // Tremeluzir realista com múltiplas frequências
            const flickerTime = Date.now() * 0.001;
            const flicker = Math.sin(flickerTime * 2) * 0.3 + 
                          Math.sin(flickerTime * 4.7) * 0.2 + 
                          Math.sin(flickerTime * 8.3) * 0.1;
            const flickeredIntensity = campfireSettings.intensity * (0.7 + flicker);
            
            this.light.intensity = Math.max(0, flickeredIntensity);
            
            // Atualizar esfera base - muito transparente
            fireMaterial.opacity = 0.1 + (flicker * 0.1);  // Pequenas variações em transparência para brilho
            
            // Atualizar partículas
            const posArray = particleData.positions;
            for (let i = 0; i < particleCount; i++) {
                particleData.life[i] += 0.016; // ~60fps
                
                // Se a partícula morreu, resetar
                if (particleData.life[i] >= particleData.maxLife[i]) {
                    const theta = Math.random() * Math.PI * 2;
                    const phi = Math.random() * Math.PI;
                    const radius = 0.05 + Math.random() * 0.05;  // Minúsculo (era 0.3-0.5)
                    
                    posArray[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
                    posArray[i * 3 + 1] = Math.cos(phi) * radius;
                    posArray[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
                    
                    particleData.life[i] = 0;
                    particleData.velocities[i] = {
                        x: (Math.random() - 0.5) * 0.02,
                        y: 0.03 + Math.random() * 0.02,
                        z: (Math.random() - 0.5) * 0.02,
                    };
                }
                
                // Mover partícula
                const vel = particleData.velocities[i];
                posArray[i * 3] += vel.x;
                posArray[i * 3 + 1] += vel.y;
                posArray[i * 3 + 2] += vel.z;
                
                // Aumentar velocidade de dispersão (efeito de fumo)
                vel.x *= 0.98;
                vel.y *= 0.99;
                vel.z *= 0.98;
            }
            
            // Atualizar a geometria
            particleData.geometry.attributes.position.needsUpdate = true;
            
            // Atualizar cor das partículas com flicker
            particleMaterial.opacity = 0.3 + (flicker * 0.2);
        },
    };
    
    return campfireObject;
}

export { createLights, createCampfireLight, LIGHTING_SETTINGS };
