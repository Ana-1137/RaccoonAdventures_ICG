import * as THREE from 'three';

/**
 * Sistema de Clima com Ciclo Dia/Noite Realista
 * Controla posição do sol, cor do céu, iluminação e sombras
 */

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
const SETTINGS = {
    time: {
        hour: 12,           // Hora atual (0-24)
        speed: 0.1,         // Velocidade de passagem do tempo (horas por frame) — MAIS RÁPIDO
        enabled: true,      // Ativar/desativar passagem automática de tempo
    },
    
    sun: {
        intensity: {
            min: 0.1,       // Intensidade mínima (noite)
            max: 1.5,       // Intensidade máxima (meio-dia)
        },
        distance: 50,       // Distância do sol em relação à cena
        size: 2,            // Tamanho visual do círculo do sol
        color: 0xfdb813,    // Cor amarelo-dourado
    },
    
    moon: {
        size: 1.5,          // Tamanho visual do círculo da lua
        color: 0xe0e0e0,    // Cor branco-cinzento
        opacity: 0.8,       // Transparência da lua
    },
    
    ambient: {
        intensity: {
            min: 0.2,       // Intensidade mínima (noite)
            max: 0.6,       // Intensidade máxima (dia)
        },
    },
    
    sky: {
        dayColor: new THREE.Color(0x87ceeb),      // Azul claro
        sunsetColor: new THREE.Color(0xff6b3d),   // Laranja/vermelho
        nightColor: new THREE.Color(0x001a4d),    // Azul escuro
    },
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cria e inicializa o sistema de clima
 * @param {THREE.Scene} scene - Cena Three.js
 * @param {THREE.DirectionalLight} sunLight - Luz direcional do sol
 * @param {THREE.AmbientLight} ambientLight - Luz ambiente
 * @returns {Object} Sistema de clima com métodos de controlo
 */
export function createClimate(scene, sunLight, ambientLight) {
    // ─── CRIAR SOL VISUAL ───────────────────────────────────────────────────
    const sunGeometry = new THREE.CircleGeometry(SETTINGS.sun.size, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
        color: SETTINGS.sun.color,
        // MeshBasicMaterial é auto-emissivo, não precisa dessas propriedades
    });
    const sunMesh = new THREE.Mesh(sunGeometry, sunMaterial);
    sunMesh.castShadow = false;
    sunMesh.receiveShadow = false;
    scene.add(sunMesh);
    
    // ─── CRIAR LUA VISUAL ────────────────────────────────────────────────────
    const moonGeometry = new THREE.CircleGeometry(SETTINGS.moon.size, 32);
    const moonMaterial = new THREE.MeshBasicMaterial({
        color: SETTINGS.moon.color,
        transparent: true,
        opacity: SETTINGS.moon.opacity,
        // MeshBasicMaterial é auto-emissivo
    });
    const moonMesh = new THREE.Mesh(moonGeometry, moonMaterial);
    moonMesh.castShadow = false;
    moonMesh.receiveShadow = false;
    scene.add(moonMesh);
    
    // ─────────────────────────────────────────────────────────────────────────
    
    const climate = {
        scene,
        sunLight,
        ambientLight,
        sunMesh,
        moonMesh,
        settings: SETTINGS,
        
        /**
         * Atualiza o clima baseado no tempo decorrido
         * @param {number} deltaTime - Tempo decorrido desde o último frame (em segundos)
         */
        update(deltaTime) {
            // Avançar tempo se estiver ativado
            if (SETTINGS.time.enabled) {
                SETTINGS.time.hour += (deltaTime * SETTINGS.time.speed);
                
                // Ciclar hora entre 0-24
                if (SETTINGS.time.hour >= 24) {
                    SETTINGS.time.hour -= 24;
                } else if (SETTINGS.time.hour < 0) {
                    SETTINGS.time.hour += 24;
                }
            }
            
            // Atualizar posição do sol e lua
            this.updateCelestialBodies();
            
            // Atualizar iluminação e céu
            this.updateLighting();
            this.updateSkyColor();
        },
        
        /**
         * Calcula e atualiza a posição do sol e lua baseado na hora do dia
         * Ambos circulam no céu em órbita contínua
         */
        updateCelestialBodies() {
            const { hour } = SETTINGS.time;
            const { distance } = SETTINGS.sun;
            
            // Converter hora (0-24) para ângulo (0-2π)
            // 0h está no leste, 12h no oeste (180°)
            const dayProgress = (hour / 24) * Math.PI * 2;
            
            // ── Sol ──
            // Elevação: máxima ao meio-dia (12h), mais baixa em 6h e 18h
            const sunElevation = Math.sin(dayProgress) * (Math.PI / 2.5);
            const sunAzimuth = dayProgress - (Math.PI / 2);
            
            const sunX = Math.cos(sunAzimuth) * Math.cos(sunElevation) * distance;
            const sunY = Math.sin(sunElevation) * distance;
            const sunZ = Math.sin(sunAzimuth) * Math.cos(sunElevation) * distance;
            
            this.sunMesh.position.set(sunX, sunY, sunZ);
            
            // Para a câmara sempre ver o sol, ele fica sempre virado
            this.sunMesh.lookAt(this.scene.position);
            
            // ── Lua (180° de diferença) ──
            const moonProgress = dayProgress + Math.PI; // Lua do lado oposto
            const moonElevation = Math.sin(moonProgress) * (Math.PI / 2.5);
            const moonAzimuth = moonProgress - (Math.PI / 2);
            
            const moonX = Math.cos(moonAzimuth) * Math.cos(moonElevation) * distance;
            const moonY = Math.sin(moonElevation) * distance;
            const moonZ = Math.sin(moonAzimuth) * Math.cos(moonElevation) * distance;
            
            this.moonMesh.position.set(moonX, moonY, moonZ);
            this.moonMesh.lookAt(this.scene.position);
            
            // Atualizar posição da luz direcional também (para sombras realistas)
            this.sunLight.position.set(sunX, sunY, sunZ);
            const shadowCamera = this.sunLight.shadow.camera;
            shadowCamera.left = -30;
            shadowCamera.right = 30;
            shadowCamera.top = 30;
            shadowCamera.bottom = -30;
            this.sunLight.shadow.mapSize.width = 2048;
            this.sunLight.shadow.mapSize.height = 2048;
        },
        
        /**
         * Atualiza intensidade das luzes baseado na hora do dia
         */
        updateLighting() {
            const { time: { hour } } = SETTINGS;
            const { min: sunIntensityMin, max: sunIntensityMax } = SETTINGS.sun.intensity;
            const { min: ambientIntensityMin, max: ambientIntensityMax } = SETTINGS.ambient.intensity;
            
            // Converter hora para ângulo (0-24h → 0-2π)
            const dayProgress = (hour / 24) * Math.PI * 2;
            
            // Elevação do sol: máxima ao meio-dia (sin(dayProgress) = 1 em 12h)
            const sunElevation = Math.sin(dayProgress);
            
            // Intensidade baseada diretamente na elevação do sol (suave e contínua)
            // 0 = elevação mínima (noite) → 1 = elevação máxima (meio-dia)
            const elevationFactor = Math.max(0, sunElevation); // Clamp a 0 durante noite
            
            // Interpolação suave de intensidades
            const newSunIntensity = sunIntensityMin + 
                                   (sunIntensityMax - sunIntensityMin) * elevationFactor;
            const newAmbientIntensity = ambientIntensityMin + 
                                        (ambientIntensityMax - ambientIntensityMin) * elevationFactor;
            
            this.sunLight.intensity = newSunIntensity;
            this.ambientLight.intensity = newAmbientIntensity;
        },
        
        /**
         * Atualiza cor do céu (background) baseado na hora
         */
        updateSkyColor() {
            const { time: { hour }, sky } = SETTINGS;
            
            // Converter hora para ângulo (0-24h → 0-2π)
            const dayProgress = (hour / 24) * Math.PI * 2;
            
            // Elevação do sol para determinar cor do céu
            const sunElevation = Math.sin(dayProgress);
            
            let targetColor;
            
            // Transições suaves baseadas na elevação do sol
            if (sunElevation > 0.3) {
                // Dia: céu azul claro
                targetColor = sky.dayColor;
            } else if (sunElevation > -0.1 && sunElevation <= 0.3) {
                // Amanhecer/Entardecer: transição para cor de pôr do sol
                const transitionFactor = (sunElevation + 0.1) / 0.4; // Normalizar entre 0-1
                targetColor = new THREE.Color().lerpColors(
                    sky.sunsetColor,
                    sky.dayColor,
                    transitionFactor
                );
            } else if (sunElevation > -0.3 && sunElevation <= -0.1) {
                // Crepúsculo: transição para noite
                const transitionFactor = (sunElevation + 0.3) / 0.2; // Normalizar entre 0-1
                targetColor = new THREE.Color().lerpColors(
                    sky.nightColor,
                    sky.sunsetColor,
                    transitionFactor
                );
            } else {
                // Noite: céu azul escuro
                targetColor = sky.nightColor;
            }
            
            this.scene.background = targetColor;
        },
        
        /**
         * Define a hora do dia diretamente
         * @param {number} hour - Hora (0-24)
         */
        setHour(hour) {
            SETTINGS.time.hour = Math.max(0, Math.min(24, hour));
        },
        
        /**
         * Define a velocidade de passagem do tempo
         * @param {number} speed - Velocidade em horas por frame
         */
        setTimeSpeed(speed) {
            SETTINGS.time.speed = Math.max(0, speed);
        },
        
        /**
         * Ativa/desativa a passagem automática de tempo
         * @param {boolean} enabled
         */
        setTimeEnabled(enabled) {
            SETTINGS.time.enabled = enabled;
        },
        
        /**
         * Obtém a hora atual do dia
         * @returns {number} Hora (0-24)
         */
        getHour() {
            return SETTINGS.time.hour;
        },
        
        /**
         * Obtém a hora formatada como string (HH:MM)
         * @returns {string} Hora formatada
         */
        getTimeFormatted() {
            const hours = Math.floor(this.settings.time.hour);
            const minutes = Math.floor((this.settings.time.hour % 1) * 60);
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        },
    };
    
    // Atualizar uma primeira vez para sincronizar estado inicial
    climate.updateCelestialBodies();
    climate.updateLighting();
    climate.updateSkyColor();
    
    return climate;
}

export { SETTINGS };
