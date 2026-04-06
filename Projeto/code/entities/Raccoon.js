import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

class Raccoon {
    constructor(scene) {
        this.scene = scene;
        this.model = null;
        this.mixer = null;
        
        this.actions = {};
        this.activeAction = null;
        this.currentState = 'IDLE';
        this.idleTimer = 0;
        this.lastMoveState = null;
        this.wasJumping = false;
        this.previousLeanSide = 'NONE'; // Adicionado para evitar re-triggers (Fase 11)
        
        // Procedural Lean (Fase 11)
        this.leanAmount = 0;
        this.targetLean = 0;
        this.spine = null;

        this.modelLoaded = new Promise(resolve => {
            this.loadModel(resolve);
        });
        console.log("Raccoon constructor loaded", this.modelLoaded);
    }

    loadModel(resolve) {
        const loader = new FBXLoader();
        loader.load('../elements/Raccoon.fbx', (fbx) => {
            this.model = fbx;
            this.model.name = "guaxinim";
            
            this.model.scale.set(0.1, 0.1, 0.1); 
            this.model.position.set(0, 0, 0); 
            
            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
                // Encontrar o osso da coluna para inclinação procedural (Fase 11)
                if (child.isBone && child.name.includes('Spine')) {
                    this.spine = child;
                }
            });

            this.scene.add(this.model);
            
            this.mixer = new THREE.AnimationMixer(this.model);

            // Carregar Animações FBX
            const animLoader = new FBXLoader();
            const animationsPath = '../animations/';
            
            const loadAnim = (name, file) => {
                return new Promise((resolve) => {
                    animLoader.load(animationsPath + file, (animFbx) => {
                        let clip = animFbx.animations[0];

                        // One-shot para curvas (Fase 11): Agora usamos curvas apenas como transição
                        if (name === 'run_left' || name === 'run_right') {
                            const action = this.mixer.clipAction(clip);
                            action.name = name;
                            action.loop = THREE.LoopOnce;
                            action.clampWhenFinished = true;
                            this.actions[name] = action;
                            resolve();
                            return;
                        }

                        const action = this.mixer.clipAction(clip);
                        action.name = name;
                        
                        if (name === 'sit' || name === 'stand' || name === 'jump_stand' || name === 'jump_run' || name === 'jump_walk') {
                            action.loop = THREE.LoopOnce;
                            action.clampWhenFinished = true;
                        }
                        this.actions[name] = action;
                        resolve();
                    });
                });
            };

            Promise.all([
                loadAnim('idle', 'Idle.fbx'),
                loadAnim('wobble', 'Wobbling.fbx'),
                loadAnim('walk', 'Female Walk.fbx'),
                loadAnim('run', 'Fast Run.fbx'),
                loadAnim('run_left', 'Running Left Turn.fbx'),
                loadAnim('run_right', 'Running Right Turn.fbx'),
                loadAnim('jump_stand', 'Jumping.fbx'),
                loadAnim('jump_run', 'Jump.fbx'),
                loadAnim('sit', 'Stand To Sit.fbx'),
                loadAnim('stand', 'Sit To Stand.fbx'),
                loadAnim('terrified', 'Terrified.fbx')
            ]).then(() => {
                // Criar a variação de salto a andar (clipped) - Fase 9
                const baseJumpClip = this.actions['jump_stand'].getClip();
                const jumpWalkClip = THREE.AnimationUtils.subclip(baseJumpClip, 'jump_walk', 8, Math.floor(baseJumpClip.duration * 30), 30);
                const jumpWalkAction = this.mixer.clipAction(jumpWalkClip);
                jumpWalkAction.loop = THREE.LoopOnce;
                jumpWalkAction.clampWhenFinished = true;
                this.actions['jump_walk'] = jumpWalkAction;

                this.currentState = 'SITTING';
                if (this.actions['sit']) {
                     this.activeAction = this.actions['sit'];
                     this.activeAction.play();
                     this.activeAction.paused = true;
                     this.activeAction.time = this.activeAction.getClip().duration;
                }
                if (resolve) resolve();
            });
        });
    }

    fadeToAction(name, duration, syncTime = false) {
        if (!this.actions[name] || this.activeAction === this.actions[name]) return;
        
        const previousAction = this.activeAction;
        this.activeAction = this.actions[name];

        let ratio = 0;
        if (syncTime && previousAction) {
            // Sincronização de Passos (Locomotion Syncing):
            // Calcula o progresso atual (%) da animação anterior para aplicar à nova
            const prevClip = previousAction.getClip();
            ratio = previousAction.time / prevClip.duration;
        }

        if (previousAction) {
            previousAction.fadeOut(duration);
        }

        this.activeAction
            .reset()
            .setEffectiveTimeScale(1)
            .setEffectiveWeight(1)
            .fadeIn(duration)
            .play();

        if (syncTime) {
            const newClip = this.activeAction.getClip();
            this.activeAction.time = ratio * newClip.duration;
        }
    }

    update(delta, keyStates) {
        if (!this.mixer || !this.model || !this.actions['idle']) {
            return;
        }

        this.mixer.update(delta);

        const isMoving = keyStates.w || keyStates.s || keyStates.a || keyStates.d;
        const isRunning = isMoving && keyStates.shift;
        const isJumping = keyStates.space;

        // Se houver qualquer input, resetamos o timer de AFK
        if (isMoving || isJumping) {
            this.idleTimer = 0;
        }

        // --- SISTEMA DE INCLINAÇÃO V2 (Fase 11) ---
        // Apenas inclinar se estiver a correr ou a andar rápido
        if (isRunning && isMoving) {
            // A = Esquerda (Inclinamos aprox. -20 graus), D = Direita
            if (keyStates.a) this.targetLean = -0.35; 
            else if (keyStates.d) this.targetLean = 0.35; 
            else this.targetLean = 0;
        } else {
            this.targetLean = 0;
        }
        
        // Suavizar a inclinação
        this.leanAmount = THREE.MathUtils.lerp(this.leanAmount, this.targetLean, 0.1);
        
        // Aplicar APENAS ao osso da coluna (para não afetar as patas)
        if (this.spine) {
            this.spine.rotation.z = this.leanAmount;
        }

        // --- SISTEMA DE ESTADOS ---
        
        // 1. Saltando (Lógica dinâmica Fase 9)
        if (isJumping && !this.wasJumping && 
            this.currentState !== 'JUMP' && 
            this.currentState !== 'SITTING' && 
            this.currentState !== 'SITTING_DOWN' && 
            this.currentState !== 'STANDING_UP') {
            
            this.currentState = 'JUMP';
            
            // Escolher animação e velocidade de balanço
            let jumpAnim = 'jump_stand';
            this.jumpForwardSpeed = 0;

            if (isRunning) {
                jumpAnim = 'jump_run';
                this.jumpForwardSpeed = 16 * 0.1; // Velocidade de corrida
            } else if (isMoving) {
                jumpAnim = 'jump_walk';
                this.jumpForwardSpeed = 7 * 0.1; // Velocidade de caminhada
            }

            this.fadeToAction(jumpAnim, 0.1);
            
            const onJumpFinished = (e) => {
                if (e.action === this.actions[jumpAnim]) {
                    this.currentState = 'IDLE';
                    this.mixer.removeEventListener('finished', onJumpFinished);
                }
            };
            this.mixer.addEventListener('finished', onJumpFinished);
        }
        this.wasJumping = isJumping;

        // Manter inércia durante o salto (Fase 9 Fix: removido o multiplicador * 60 excessivo)
        if (this.currentState === 'JUMP') {
            this.model.translateZ(this.jumpForwardSpeed * delta); 
            return; // Bloqueia rotação e novos inputs de movimento
        }

        // 2. Sentando/Levantando
        if (this.currentState === 'SITTING') {
            if (isMoving || isJumping) {
                this.currentState = 'STANDING_UP';
                this.fadeToAction('stand', 0.5);
                
                const onFinished = (e) => {
                    if (e.action === this.actions['stand']) {
                        this.currentState = 'IDLE';
                        this.mixer.removeEventListener('finished', onFinished);
                    }
                };
                this.mixer.addEventListener('finished', onFinished);
            }
            return; // Bloqueia movimento enquanto sentado
        }

        if (this.currentState === 'STANDING_UP' || this.currentState === 'SITTING_DOWN' || this.currentState === 'JUMP') {
            return; // Bloqueia input durante transições críticas ou salto
        }

        // 3. Movimento Ativo
        if (isMoving) {
            this.idleTimer = 0;
            const moveSpeed = (isRunning ? 15 : 6) * delta * 0.1; 
            const rotateSpeed = 2.5 * delta;

            if (keyStates.w) this.model.translateZ(moveSpeed);
            if (keyStates.s) this.model.translateZ(-moveSpeed);
            if (keyStates.a) this.model.rotateY(rotateSpeed);
            if (keyStates.d) this.model.rotateY(-rotateSpeed);

            if (isRunning) {
                // Curvas durante a corrida (Fase 11: One-shot transition + Procedural Lean)
                if (keyStates.a) {
                    if (this.currentState !== 'RUN_LEFT_TRANSITION' && this.previousLeanSide !== 'LEFT') {
                        this.fadeToAction('run_left', 0.4, true);
                        this.currentState = 'RUN_LEFT_TRANSITION';
                        this.previousLeanSide = 'LEFT';
                        
                        // Quando a animação de curva (One-Shot) terminar, voltamos para o RUN estável (PÉS)
                        const onLeanFinished = (e) => {
                            if (e.action === this.actions['run_left']) {
                                this.fadeToAction('run', 0.4, true);
                                this.currentState = 'RUN';
                                this.mixer.removeEventListener('finished', onLeanFinished);
                            }
                        };
                        this.mixer.addEventListener('finished', onLeanFinished);
                    }
                } else if (keyStates.d) {
                    if (this.currentState !== 'RUN_RIGHT_TRANSITION' && this.previousLeanSide !== 'RIGHT') {
                        this.fadeToAction('run_right', 0.4, true);
                        this.currentState = 'RUN_RIGHT_TRANSITION';
                        this.previousLeanSide = 'RIGHT';
                        
                        const onLeanFinished = (e) => {
                            if (e.action === this.actions['run_right']) {
                                this.fadeToAction('run', 0.4, true);
                                this.currentState = 'RUN';
                                this.mixer.removeEventListener('finished', onLeanFinished);
                            }
                        };
                        this.mixer.addEventListener('finished', onLeanFinished);
                    }
                } else {
                    if (this.currentState !== 'RUN') {
                        this.fadeToAction('run', 0.5, true);
                        this.currentState = 'RUN';
                        this.previousLeanSide = 'NONE';
                    }
                }
                this.lastMoveState = 'RUN';
            } else {
                if (this.currentState !== 'WALK') {
                    this.fadeToAction('walk', 0.4, true);
                    this.currentState = 'WALK';
                }
                this.lastMoveState = 'WALK';
            }
        } 
        // 4. Parado (AFK Logic)
        else {
            if (this.currentState !== 'IDLE' && this.currentState !== 'WOBBLE') {
                // Escolher entre wobble (cansado) ou idle (calmo)
                const targetAnim = (this.lastMoveState === 'RUN') ? 'wobble' : 'idle';
                this.fadeToAction(targetAnim, 0.3);
                this.currentState = targetAnim.toUpperCase();
            }

            this.idleTimer += delta;
            
            // Sentar apenas se estiver AFK por algum tempo (ex: 5 segundos)
            // Ou se a animação de Wobble/Idle terminar (como pediste)
            if (this.idleTimer > 5.0) {
                this.currentState = 'SITTING_DOWN';
                this.fadeToAction('sit', 0.8);
                
                const onSitFinished = (e) => {
                    if (e.action === this.actions['sit']) {
                        this.currentState = 'SITTING';
                        this.lastMoveState = null;
                        this.mixer.removeEventListener('finished', onSitFinished);
                    }
                };
                this.mixer.addEventListener('finished', onSitFinished);
            }
        }
    }
}

export { Raccoon };
