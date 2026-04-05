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
                loadAnim('idle', 'Wobbling.fbx'),
                loadAnim('walk', 'Female Walk.fbx'),
                loadAnim('run', 'Fast Run.fbx'),
                loadAnim('sit', 'Stand To Sit.fbx'),
                loadAnim('stand', 'Sit To Stand.fbx')
            ]).then(() => {
                if (this.actions['idle']) {
                     this.activeAction = this.actions['idle'];
                     this.activeAction.play();
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

        if (this.currentState === 'SITTING') {
            if (isMoving) {
                this.currentState = 'STANDING_UP';
                this.fadeToAction('stand', 0.8);
                
                const onFinished = (e) => {
                    if (e.action === this.actions['stand']) {
                        this.currentState = 'IDLE';
                        this.mixer.removeEventListener('finished', onFinished);
                    }
                };
                this.mixer.addEventListener('finished', onFinished);
            }
        } else if (this.currentState === 'STANDING_UP' || this.currentState === 'SITTING_DOWN') {
            // Bloqueia movimento durante transições
        } else {
            if (isMoving) {
                this.idleTimer = 0;
                
                const moveSpeed = (isRunning ? 15 : 6) * delta * 0.1; 
                const rotateSpeed = 2 * delta;

                if (keyStates.w) this.model.translateZ(moveSpeed);
                if (keyStates.s) this.model.translateZ(-moveSpeed);
                if (keyStates.a) this.model.rotateY(rotateSpeed);
                if (keyStates.d) this.model.rotateY(-rotateSpeed);
                
                if (isRunning) {
                    if (this.currentState !== 'RUN') {
                        this.fadeToAction('run', 0.2);
                        this.currentState = 'RUN';
                    }
                } else {
                    if (this.currentState !== 'WALK') {
                        this.fadeToAction('walk', 0.2);
                        this.currentState = 'WALK';
                    }
                }
            } else {
                if (this.currentState !== 'IDLE') {
                    this.fadeToAction('idle', 0.2);
                    this.currentState = 'IDLE';
                }

                this.idleTimer += delta;
                if (this.idleTimer > 2.0) {
                    this.currentState = 'SITTING_DOWN';
                    this.fadeToAction('sit', 0.5);
                    
                    const onFinished = (e) => {
                        if (e.action === this.actions['sit']) {
                            this.currentState = 'SITTING';
                            this.mixer.removeEventListener('finished', onFinished);
                        }
                    };
                    this.mixer.addEventListener('finished', onFinished);
                }
            }
        }
    }
}

export { Raccoon };
