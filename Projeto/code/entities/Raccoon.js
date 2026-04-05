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
            });

            this.scene.add(this.model);
            
            this.mixer = new THREE.AnimationMixer(this.model);

            // Carregar Animações FBX
            const animLoader = new FBXLoader();
            const animationsPath = '../animations/';
            
            const loadAnim = (name, file) => {
                return new Promise((resolve) => {
                    animLoader.load(animationsPath + file, (animFbx) => {
                        const clip = animFbx.animations[0];
                        const action = this.mixer.clipAction(clip);
                        action.name = name;
                        if (name === 'sit' || name === 'stand') {
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
                loadAnim('jump', 'Jumping.fbx'),
                loadAnim('sit', 'Stand To Sit.fbx'),
                loadAnim('stand', 'Sit To Stand.fbx'),
                loadAnim('terrified', 'Terrified.fbx')
            ]).then(() => {
                // Iniciar sentado, conforme solicitado
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

    fadeToAction(name, duration) {
        if (!this.actions[name] || this.activeAction === this.actions[name]) return;
        
        const previousAction = this.activeAction;
        this.activeAction = this.actions[name];

        if (previousAction) {
            previousAction.fadeOut(duration);
        }

        this.activeAction
            .reset()
            .setEffectiveTimeScale(1)
            .setEffectiveWeight(1)
            .fadeIn(duration)
            .play();
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

        // --- SISTEMA DE ESTADOS ---
        
        // 1. Saltando
        if (isJumping && this.currentState !== 'JUMP' && this.currentState !== 'SITTING' && this.currentState !== 'SITTING_DOWN' && this.currentState !== 'STANDING_UP') {
            this.currentState = 'JUMP';
            this.fadeToAction('jump', 0.1);
            
            const onJumpFinished = (e) => {
                if (e.action === this.actions['jump']) {
                    this.currentState = 'IDLE';
                    this.mixer.removeEventListener('finished', onJumpFinished);
                }
            };
            this.mixer.addEventListener('finished', onJumpFinished);
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
                // Curvas durante a corrida
                if (keyStates.a) {
                    if (this.currentState !== 'RUN_LEFT') {
                        this.fadeToAction('run_left', 0.2);
                        this.currentState = 'RUN_LEFT';
                    }
                } else if (keyStates.d) {
                    if (this.currentState !== 'RUN_RIGHT') {
                        this.fadeToAction('run_right', 0.2);
                        this.currentState = 'RUN_RIGHT';
                    }
                } else {
                    if (this.currentState !== 'RUN') {
                        this.fadeToAction('run', 0.2);
                        this.currentState = 'RUN';
                    }
                }
                this.lastMoveState = 'RUN';
            } else {
                if (this.currentState !== 'WALK') {
                    this.fadeToAction('walk', 0.2);
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
