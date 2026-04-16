import * as THREE from 'three';

/**
 * Sistema de Clima com Ciclo Dia/Noite Realista
 * Controla posição do sol, cor do céu, iluminação e sombras
 */

// ─── CONFIGURAÇÃO CENTRAL ────────────────────────────────────────────────────
const SETTINGS = {
    time: {
        hour: 12,           // Hora atual (0-24)
        speed: 0.02,        // Velocidade de passagem do tempo (horas por frame)
        enabled: true,      // Ativar/desativar passagem automática de tempo
    },
    
    sun: {
        intensity: {
            min: 0.1,       // Intensidade mínima (noite)
            max: 1.5,       // Intensidade máxima (meio-dia)
        },
        distance: 50,       // Distância do sol em relação à cena
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
    const climate = {
        scene,
        sunLight,
        ambientLight,
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
            
            // Atualizar posição do sol e iluminação
            this.updateSunPosition();
            this.updateLighting();
            this.updateSkyColor();
        },
        
        /**
         * Calcula e atualiza a posição do sol baseado na hora do dia
         * Simulação simplificada: sol nasce às 6h, apanha-se às 18h
         */
        updateSunPosition() {
            const { hour } = SETTINGS.time;
            const { distance } = SETTINGS.sun;
            
            // Calcular ângulo de elevação (Y) e azimute (X/Z)
            // Nasce a leste (Z), apanha-se a oeste (Z negativo)
            const sunriseHour = 6;
            const sunsetHour = 18;
            const dayDuration = sunsetHour - sunriseHour;
            
            let sunriseProgress = 0; // 0 a 1
            
            if (hour >= sunriseHour && hour <= sunsetHour) {
                // Durante o dia
                sunriseProgress = (hour - sunriseHour) / dayDuration;
            } else if (hour < sunriseHour) {
                // Antes do amanhecer
                sunriseProgress = (hour + 24 - sunriseHour) / dayDuration;
            } else {
                // Depois do pôr do sol
                sunriseProgress = (hour - sunriseHour) / dayDuration;
            }
            
            // Elevation: seno para uma curva natural (0° a 90° a 0°)
            const elevationAngle = Math.sin(sunriseProgress * Math.PI) * (Math.PI / 2.5);
            
            // Azimute: leste a oeste
            const azimuthAngle = (sunriseProgress * Math.PI) - (Math.PI / 2);
            
            // Converter para posição 3D
            const x = Math.cos(azimuthAngle) * Math.cos(elevationAngle) * distance;
            const y = Math.sin(elevationAngle) * distance;
            const z = Math.sin(azimuthAngle) * Math.cos(elevationAngle) * distance;
            
            this.sunLight.position.set(x, y, z);
            
            // Atualizar alvo de sombra para acompanhar o sol
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
            
            // Calcular intensidade: máximo ao meio-dia (12h), mínimo à noite (0h/24h)
            let newSunIntensity = 0;
            let newAmbientIntensity = 0;
            
            if (hour >= 6 && hour <= 18) {
                // Durante o dia: curva suave de intensidade
                const dayProgress = (hour - 6) / 12; // 0 a 1
                
                // Parabola: máximo ao meio-dia
                const curveIntensity = Math.sin(dayProgress * Math.PI);
                
                newSunIntensity = sunIntensityMin + 
                               (sunIntensityMax - sunIntensityMin) * curveIntensity;
                newAmbientIntensity = ambientIntensityMin + 
                                   (ambientIntensityMax - ambientIntensityMin) * curveIntensity;
            } else {
                // Noite
                const nightHour = hour < 6 ? hour + 24 : hour;
                const nightProgress = (nightHour - 18) / 12; // 0 a 1 durante 18h a 6h
                
                // Suave transição noite: 10% de intensidade base
                const curveIntensity = Math.sin(nightProgress * Math.PI) * 0.1;
                
                newSunIntensity = sunIntensityMin * Math.max(0.1, curveIntensity);
                newAmbientIntensity = ambientIntensityMin * 0.8;
            }
            
            this.sunLight.intensity = newSunIntensity;
            this.ambientLight.intensity = newAmbientIntensity;
        },
        
        /**
         * Atualiza cor do céu (background) baseado na hora
         */
        updateSkyColor() {
            const { time: { hour }, sky } = SETTINGS;
            let targetColor = sky.dayColor;
            
            if (hour >= 6 && hour <= 8) {
                // Amanhecer (6h-8h)
                const progress = (hour - 6) / 2;
                targetColor = new THREE.Color().lerpColors(
                    sky.sunsetColor,
                    sky.dayColor,
                    progress
                );
            } else if (hour >= 8 && hour <= 18) {
                // Dia
                targetColor = sky.dayColor;
            } else if (hour >= 18 && hour <= 20) {
                // Pôr do sol (18h-20h)
                const progress = (hour - 18) / 2;
                targetColor = new THREE.Color().lerpColors(
                    sky.dayColor,
                    sky.sunsetColor,
                    progress
                );
            } else if (hour >= 20 && hour <= 22) {
                // Crepúsculo (20h-22h)
                const progress = (hour - 20) / 2;
                targetColor = new THREE.Color().lerpColors(
                    sky.sunsetColor,
                    sky.nightColor,
                    progress
                );
            } else {
                // Noite (22h-6h)
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
    climate.updateSunPosition();
    climate.updateLighting();
    climate.updateSkyColor();
    
    return climate;
}

export { SETTINGS };
