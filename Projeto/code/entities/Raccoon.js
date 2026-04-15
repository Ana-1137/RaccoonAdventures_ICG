import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

// ─── Configuração Central ─────────────────────────────────────────────────────
// Muda estes valores para ajustar velocidades, tempos e intensidade de lean
const SETTINGS = {
    model: {
        scale: 0.1,   // fator de escala (1 unidade Three = 10 unidades FBX)
    },
    speed: {
        walk: 3,    // unidades/s enquanto caminha
        run: 7,   // unidades/s enquanto corre
        rotate: 3.5,  // rad/s de rotação (ajustado para melhor controlo)
    },
    physics: {
        gravity: 2.3,      // Gravidade ajustada para melhor sincronização com animação
        jumpPower: 0.8,   // Ajustado proporcionalmente para manter altura máxima (h ≈ 0.51)
        rayHeight: 0.6,   // raio para baixo a partir dos pés
        ceilingCheckHeight: 0.5, // teto
        maxStepHeight: 0.2, // degraus
        ledgeDepth: 1.5,  // profundidade
        ledgeOffset: 0.1, // Margem bem mais curta (Fase 12 Final)
        // ── Refinamento de Raycast (Fase 12 - Rampas) ──
        maxLandingDistance: -0.02, // distância máxima de caída permitida em rampas (negativo = para baixo)
        backfaceNormalThreshold: 0.1, // threshold da normal-Y para rejeitar backfaces (valores < isto = face de baixo)
        // ── Deteção de Paredes (Fase 12 - Colisões Horizontais) ──
        wallCheckDistance: 0.1, // distância do raycast horizontal para a frente
        wallCheckHeight: 0.14, // altura do raycast horizontal em relação aos pés
        wallNormalThreshold: 0.4, // threshold da normal-Y para distinguir paredes de rampas (< isto = parede)
    },
    jump: {
        standForward: 0,                // velocidade horizontal no salto parado
        walkForward: 7 * 0.1,         // velocidade horizontal no salto a andar
        runForward: 16 * 0.1,         // velocidade horizontal no salto a correr
        walkStartFrame: 15,            // frame inicial do sub-clip do jump a andar
        walkEndTrimFrames: 15,          // frames a cortar no final (termina antes da pose estática)
        launchDelay: 0.15,             // Delay antes da aplicação do impulso (sincronização com prep frames)
    },
    terrified: {
        loopStartFrame: 30,             // Início
        loopEndFrame: 60,              // Cortar mais cedo para evitar abaixar-se (Fase 12 Final)
    },
    lean: {
        maxAngle: 0.35,  // radianos de inclinação máxima da coluna
        smoothing: 0.1,   // lerp factor (0 = instantâneo, 1 = muito suave)
    },
    blend: {
        toWalk: 0.4,   // duração do cross-fade walk
        toRun: 0.5,
        toLean: 0.4,   // transição para animação de curva
        toIdle: 0.3,
        toSit: 0.8,
        toStand: 0.5,
        toJump: 0.1,
        toTerrified: 0.4, // transição para vertigens
    },
    afkTimeout: 5.0,  // segundos sem movimento antes de sentar
};

// ─── Estados possíveis da máquina de estados ──────────────────────────────────
const STATES = {
    IDLE: 'IDLE',
    WALK: 'WALK',
    RUN: 'RUN',
    RUN_LEFT_TRANSITION: 'RUN_LEFT_TRANSITION',
    RUN_RIGHT_TRANSITION: 'RUN_RIGHT_TRANSITION',
    WOBBLE: 'WOBBLE',
    JUMP: 'JUMP',
    SITTING: 'SITTING',
    SITTING_DOWN: 'SITTING_DOWN',
    STANDING_UP: 'STANDING_UP',
    TERRIFIED: 'TERRIFIED',
    TERRIFIED_LOOP: 'TERRIFIED_LOOP',
};

// ─── Mapeamento de animações FBX ─────────────────────────────────────────────
// Adicionar uma nova animação é tão simples como adicionar uma linha aqui.
const ANIM_FILES = [
    { name: 'idle', file: 'Idle.fbx' },
    { name: 'wobble', file: 'Wobbling.fbx' },
    { name: 'walk', file: 'Female Walk.fbx' },
    { name: 'run', file: 'Fast Run.fbx' },
    { name: 'run_left', file: 'Running Left Turn.fbx' },
    { name: 'run_right', file: 'Running Right Turn.fbx' },
    { name: 'jump_stand', file: 'Jumping.fbx' },
    { name: 'jump_run', file: 'Jump.fbx' },
    { name: 'sit', file: 'Stand To Sit.fbx' },
    { name: 'stand', file: 'Sit To Stand.fbx' },
    { name: 'terrified', file: 'Terrified.fbx' },
];

/** Animações que devem tocar apenas uma vez e parar no último frame. */
const ONE_SHOT_ANIMS = new Set(['sit', 'stand', 'jump_stand', 'jump_run', 'jump_walk', 'run_left', 'run_right', 'terrified']);

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classe que representa o guaxinim jogável.
 * Gere o modelo 3D, o mixer de animações e a máquina de estados de movimento.
 */
class Raccoon {
    /**
     * @param {THREE.Scene} scene - A cena Three.js onde o modelo será adicionado.
     */
    constructor(scene) {
        this.scene = scene;

        /** @type {THREE.Group|null} */
        this.model = null;
        
        // ── Posição inicial de spawn ──
        this.spawnPosition = { x: 1, y: 0, z: 1 };

        /** @type {THREE.AnimationMixer|null} */
        this.mixer = null;

        /** @type {Object.<string, THREE.AnimationAction>} */
        this.actions = {};

        /** @type {THREE.AnimationAction|null} */
        this.activeAction = null;

        // ── Estado da máquina de estados ──
        this.currentState = STATES.IDLE;
        this.lastMoveState = null;   // 'RUN' | 'WALK' | null — determina wobble vs idle
        this.idleTimer = 0;      // segundos sem movimento
        this.wasJumping = false;  // evita disparar salto em todos os frames
        this.previousLeanSide = 'NONE'; // evita re-disparar a animação de curva
        this.stuckTimer = 0;     // deteção de estado preso em transição

        // ── Inclinação Procedural (Spine Lean) ──
        this.leanAmount = 0; // valor atual interpolado
        this.targetLean = 0; // alvo de inclinação
        /** @type {THREE.Bone|null} */
        this.spine = null;

        // ── Física e Colisões (Fase 12) ──
        this.verticalVelocity = 0;
        this.isGrounded = true;
        this.raycaster = new THREE.Raycaster();
        this.floorObjects = []; // Cache opcional para performance

        // ── Inércia de Salto ──
        this.jumpForwardSpeed = 0;
        this.jumpLaunchPending = false; // Aguardando delay antes do liftoff
        this.jumpLaunchTimer = 0;      // Contador do delay do salto

        /** Promessa resolvida quando o modelo e todas as animações estiverem carregados. */
        this.modelLoaded = new Promise(resolve => this._loadModel(resolve));
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  CARREGAMENTO
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Carrega o modelo FBX e todas as animações.
     * @param {Function} resolve - Callback a chamar quando tudo estiver pronto.
     */
    _loadModel(resolve) {
        const loader = new FBXLoader();
        loader.load('../elements/Raccoon.fbx', (fbx) => {
            this.model = fbx;
            this.model.name = 'guaxinim';
            this.model.scale.setScalar(SETTINGS.model.scale);
            this.model.position.set(this.spawnPosition.x, this.spawnPosition.y, this.spawnPosition.z);

            this.model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
                // Guardar referência ao osso da coluna para lean procedural
                if (child.isBone && child.name.includes('Spine')) {
                    this.spine = child;
                }
            });

            this.scene.add(this.model);
            this.mixer = new THREE.AnimationMixer(this.model);

            this._loadAnimations(resolve);
        });
    }

    /**
     * Carrega todas as animações definidas em ANIM_FILES e cria os sub-clips derivados.
     * @param {Function} resolve
     */
    _loadAnimations(resolve) {
        const animLoader = new FBXLoader();
        const basePath = '../animations/';

        const loadOne = ({ name, file }) => new Promise((done) => {
            animLoader.load(basePath + file, (animFbx) => {
                const clip = animFbx.animations[0];
                const action = this.mixer.clipAction(clip);
                action.name = name;

                if (ONE_SHOT_ANIMS.has(name)) {
                    action.loop = THREE.LoopOnce;
                    action.clampWhenFinished = true;
                }

                this.actions[name] = action;
                done();
            });
        });

        Promise.all(ANIM_FILES.map(loadOne)).then(() => {
            this._buildDerivedClips();
            this._initStartingState();
            resolve();
        });
    }

    /**
     * Cria variações de clips derivadas de animações base (e.g. jump_walk = jump_stand recortado).
     */
    _buildDerivedClips() {
        const baseClip = this.actions['jump_stand'].getClip();
        const totalFrames = Math.floor(baseClip.duration * 30);
        const { walkStartFrame, walkEndTrimFrames } = SETTINGS.jump;
        const endFrame = totalFrames - walkEndTrimFrames;

        const walkClip = THREE.AnimationUtils.subclip(baseClip, 'jump_walk', walkStartFrame, endFrame, 30);
        const walkAction = this.mixer.clipAction(walkClip);
        walkAction.loop = THREE.LoopOnce;
        walkAction.clampWhenFinished = true;
        this.actions['jump_walk'] = walkAction;

        // Criar loop de Vertigens (olhar para os lados sem se baixar)
        const baseTerrified = this.actions['terrified'].getClip();
        const { loopStartFrame, loopEndFrame } = SETTINGS.terrified;
        const terrifiedClip = THREE.AnimationUtils.subclip(baseTerrified, 'terrified_loop', loopStartFrame, loopEndFrame, 30);
        const terrifiedAction = this.mixer.clipAction(terrifiedClip);
        // PingPong faz com que ele olhe para os lados e volte suavemente, evitando o "corte" seco (Fase 12 Final)
        terrifiedAction.loop = THREE.LoopPingPong;
        this.actions['terrified_loop'] = terrifiedAction;
    }

    /**
     * Coloca o guaxinim no estado inicial: sentado no chão.
     */
    _initStartingState() {
        this.currentState = STATES.SITTING;
        const sitAction = this.actions['sit'];
        if (sitAction) {
            this.activeAction = sitAction;
            this.activeAction.play();
            this.activeAction.paused = true;
            this.activeAction.time = sitAction.getClip().duration;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  TRANSIÇÃO DE ANIMAÇÕES
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Faz cross-fade suave para uma nova animação.
     * @param {string}  name      - Chave da animação em `this.actions`.
     * @param {number}  duration  - Duração do cross-fade em segundos.
     * @param {boolean} [syncTime=false] - Se true, sincroniza a fase do ciclo (Locomotion Syncing).
     */
    fadeToAction(name, duration, syncTime = false) {
        if (!this.actions[name] || this.activeAction === this.actions[name]) return;

        const previousAction = this.activeAction;
        this.activeAction = this.actions[name];

        // Calc ratio before switching references
        let ratio = 0;
        if (syncTime && previousAction) {
            ratio = previousAction.time / previousAction.getClip().duration;
        }

        previousAction?.fadeOut(duration);

        this.activeAction
            .reset()
            .setEffectiveTimeScale(1)
            .setEffectiveWeight(1)
            .fadeIn(duration)
            .play();

        if (syncTime) {
            this.activeAction.time = ratio * this.activeAction.getClip().duration;
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  LOOP PRINCIPAL
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Chamado a cada frame pelo loop de animação.
     * @param {number} delta     - Tempo desde o último frame (segundos).
     * @param {Object} keyStates - Estado das teclas em { w, a, s, d, shift, space }.
     */
    update(delta, keyStates) {
        if (!this.mixer || !this.model || !this.actions['idle']) return;

        this.mixer.update(delta);

        // ── Safety Reset: Validar estado da máquina de estados ──────────────────────────────────
        // Se o currentState for inválido, resetar para IDLE (proteção contra estados corrompidos)
        const validStates = Object.values(STATES);
        if (!validStates.includes(this.currentState)) {
            console.warn(`Estado inválido detetado: ${this.currentState}, resetando para IDLE`);
            this.currentState = STATES.IDLE;
            this.fadeToAction('idle', 0.2);
        }

        // ── Deteção de Estado Preso em Transição ──────────────────────────────────────────────
        // Se está em transição de corrida (esquerda/direita) e no chão, incrementar timer
        const isInTransition = (this.currentState === STATES.RUN_LEFT_TRANSITION || 
                                this.currentState === STATES.RUN_RIGHT_TRANSITION);
        
        if (isInTransition && this.isGrounded) {
            this.stuckTimer += delta;
            // Se estiver preso há mais de 2 segundos, fazer reset para IDLE
            if (this.stuckTimer > 2.0) {
                console.warn(`Estado preso detetado: ${this.currentState}, resetando para IDLE`);
                this.currentState = STATES.IDLE;
                this.fadeToAction('idle', 0.3);
                this.stuckTimer = 0;
            }
        } else {
            // Resetar timer quando muda de estado ou deixa de estar em transição
            if (this.stuckTimer > 0) {
                this.stuckTimer = 0;
            }
        }

        // Derivar intenções a partir do input (abstração de teclas)
        const input = {
            forward: keyStates.w,
            backward: keyStates.s,
            left: keyStates.a,
            right: keyStates.d,
            run: keyStates.shift,
            jump: keyStates.space,
        };
        const isMoving = input.forward || input.backward || input.left || input.right;
        const isRunning = isMoving && input.run;
        const isTerrified = (this.currentState === STATES.TERRIFIED || this.currentState === STATES.TERRIFIED_LOOP);

        if (isMoving || input.jump || isTerrified) this.idleTimer = 0;

        // ── Processamento do Delay de Liftoff do Salto ──────────────────────────────────────────
        if (this.jumpLaunchPending) {
            this.jumpLaunchTimer -= delta;
            if (this.jumpLaunchTimer <= 0) {
                // Aplicar impulso após delay de preparação
                this.verticalVelocity = SETTINGS.physics.jumpPower;
                this.jumpLaunchPending = false;
                this.isGrounded = false; // Confirma a descolagem
            }
        }

        // --- SISTEMA DE FÍSICA E CHÃO (Fase 12) ---
        this._handleGravityAndGround(delta);

        this._applyProceduralLean(isRunning, input);
        this._handleJump(isRunning, isMoving, input);
        this._handleLedgeDetection(isMoving);

        // Bloquear movimento durante transições de sentar/levantar
        if ([STATES.SITTING_DOWN, STATES.STANDING_UP].includes(this.currentState)) return;

        this._handleSitting(isMoving, input.jump);
        if (this.currentState === STATES.SITTING) return;

        // Durante o salto, preservamos a inércia horizontal mas permitimos rotação limitada
        if (this.currentState === STATES.JUMP) {
            // CORREÇÃO: Só aterra se já descolou (!jumpLaunchPending) e está no chão
            if (this.isGrounded && !this.jumpLaunchPending) {
                // Aterrou! Voltamos diretamente para IDLE sem estado intermédio
                this.currentState = STATES.IDLE;
                this.fadeToAction('idle', 0.15);
            } else {
                // ── Wall check durante o salto ──────────────────────────────────
                let isWallInFront = false;
                if (this.jumpForwardSpeed > 0) {
                    // Calcular direção forward
                    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.model.quaternion);
                    const wallCheckOrigin = this.model.position.clone();
                    wallCheckOrigin.y += SETTINGS.physics.wallCheckHeight;
                    
                    const collidables = this.scene.children.filter(o => o !== this.model && o.type !== 'Light');
                    this.raycaster.set(wallCheckOrigin, forward);
                    const wallHits = this.raycaster.intersectObjects(collidables, true);
                    
                    if (wallHits.length > 0 && wallHits[0].distance <= SETTINGS.physics.wallCheckDistance) {
                        // Verificar se é parede (superfície quase vertical) ou rampa
                        const hit = wallHits[0];
                        if (hit.face) {
                            const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
                            const worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
                            if (worldNormal.y < SETTINGS.physics.wallNormalThreshold) {
                                isWallInFront = true; // Parede detetada
                            }
                        } else {
                            isWallInFront = true; // Sem info de face, assumir parede
                        }
                    }
                }

                // Aplicar movimento de inércia do salto (apenas se não há parede)
                if (isWallInFront) {
                    this.jumpForwardSpeed = 0; // Parar inércia horizontal ao atingir parede
                    this.verticalVelocity = 0; // Parar velocidade vertical
                    this.currentState = STATES.IDLE; // Forçar saída imediata do estado JUMP
                    this.fadeToAction('idle', 0.2); // Transição para animação idle
                } else {
                    this.model.translateZ(this.jumpForwardSpeed * delta);
                }

                // Permitir rodar um pouco no ar (Fase 12 Refinação)
                const rotate = SETTINGS.speed.rotate * 0.5 * delta;
                if (input.left) this.model.rotateY(rotate);
                if (input.right) this.model.rotateY(-rotate);
                return;
            }
        }

        // --- BARREIRA DE VERTIGENS (Fase 12 Refinada) ---
        // Se estiver com Vertigens, bloqueia movimento para a frente (W)
        // Permitimos rodar (A/D) e andar para trás (S) para sair do perigo
        const isBlockedByFear = (isTerrified && input.forward);

        if (isMoving && !isBlockedByFear) {
            this._handleMovement(delta, isRunning, input);
        } else {
            this._handleIdle(delta);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    //  SUB-SISTEMAS (métodos privados)
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * Calcula e aplica a inclinação procedural da coluna durante curvas a alta velocidade.
     * @param {boolean} isRunning
     * @param {Object}  input
     */
    _applyProceduralLean(isRunning, input) {
        if (isRunning) {
            if (input.left) this.targetLean = -SETTINGS.lean.maxAngle;
            else if (input.right) this.targetLean = SETTINGS.lean.maxAngle;
            else this.targetLean = 0;
        } else {
            this.targetLean = 0;
        }

        this.leanAmount = THREE.MathUtils.lerp(this.leanAmount, this.targetLean, SETTINGS.lean.smoothing);
        if (this.spine) this.spine.rotation.z = this.leanAmount;
    }

    /**
     * Gere o salto: disparo único, escolha de animação e velocidade de inércia.
     * @param {boolean} isRunning
     * @param {boolean} isMoving
     * @param {Object}  input
     */
    _handleJump(isRunning, isMoving, input) {
        const canJump =
            input.jump &&
            !this.wasJumping &&
            ![STATES.JUMP, STATES.SITTING, STATES.SITTING_DOWN, STATES.STANDING_UP].includes(this.currentState);

        if (canJump) {
            this.currentState = STATES.JUMP;

            let jumpAnim = 'jump_stand';
            this.jumpForwardSpeed = SETTINGS.jump.standForward;

            if (isRunning) {
                jumpAnim = 'jump_run';
                this.jumpForwardSpeed = SETTINGS.jump.runForward;
            } else if (isMoving) {
                jumpAnim = 'jump_walk';
                this.jumpForwardSpeed = SETTINGS.jump.walkForward;
            }

            this.fadeToAction(jumpAnim, SETTINGS.blend.toJump);

            // ── Delay no impulso para sincronizar com frames de preparação da animação ──
            this.jumpLaunchPending = true;
            this.jumpLaunchTimer = SETTINGS.jump.launchDelay;
            this.isGrounded = false;
        }

        this.wasJumping = input.jump;
    }

    /**
     * Gere a lógica de sentar/levantar quando o personagem está parado durante muito tempo.
     * @param {boolean} isMoving
     * @param {boolean} wantsJump
     */
    _handleSitting(isMoving, wantsJump) {
        if (this.currentState !== STATES.SITTING) return;

        if (isMoving || wantsJump) {
            this.currentState = STATES.STANDING_UP;
            this.fadeToAction('stand', SETTINGS.blend.toStand);

            const onStandFinished = (e) => {
                if (e.action === this.actions['stand']) {
                    this.currentState = STATES.IDLE;
                    this.mixer.removeEventListener('finished', onStandFinished);
                }
            };
            this.mixer.addEventListener('finished', onStandFinished);
        }
    }

    /**
     * Aplica movimento ao modelo e escolhe a animação correcta (walk/run/turn).
     * @param {number}  delta
     * @param {boolean} isRunning
     * @param {Object}  input
     */
    _handleMovement(delta, isRunning, input) {
        this.idleTimer = 0;

        const speed = (isRunning ? SETTINGS.speed.run : SETTINGS.speed.walk) * delta * SETTINGS.model.scale;
        const rotate = SETTINGS.speed.rotate * delta;

        // ── Ledge check preventivo ──────────────────────────────────
        if (input.forward) {
            const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.model.quaternion);
            const probeOrigin = this.model.position.clone()
                .add(forward.multiplyScalar(speed + SETTINGS.physics.ledgeOffset));
            probeOrigin.y += 0.5;

            const collidables = this.scene.children.filter(o => o !== this.model && o.type !== 'Light');
            this.raycaster.set(probeOrigin, new THREE.Vector3(0, -1, 0));
            const hits = this.raycaster.intersectObjects(collidables, true);

            const isSafe = hits.length > 0 && (this.model.position.y - hits[0].point.y) < SETTINGS.physics.ledgeDepth;

            // ── Wall check horizontal (deteção de paredes à frente) ──────────────────────────────────
            let isWallBlocking = false;
            const wallCheckOrigin = this.model.position.clone();
            wallCheckOrigin.y += SETTINGS.physics.wallCheckHeight; // altura do raycast
            this.raycaster.set(wallCheckOrigin, forward);
            const wallHits = this.raycaster.intersectObjects(collidables, true);
            
            if (wallHits.length > 0 && wallHits[0].distance <= SETTINGS.physics.wallCheckDistance) {
                // Verificar se é uma parede (superfície quase vertical) ou rampa (superfície inclinada)
                const hit = wallHits[0];
                if (hit.face) {
                    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
                    const worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
                    // Só é parede se normal-Y < threshold (superfície quase vertical)
                    if (worldNormal.y < SETTINGS.physics.wallNormalThreshold) {
                        isWallBlocking = true; // Parede detetada à frente
                    }
                } else {
                    // Se não temos info de face, assumir que é parede por segurança
                    isWallBlocking = true;
                }
            }

            if (isSafe && !isWallBlocking) {
                this.model.translateZ(speed); // só move se for seguro E sem paredes
            }
            // se não for seguro ou há parede, não move — ponto final
        }
        
        // ── Ledge check & Wall check para trás ──────────────────────────────────
        if (input.backward) {
            const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.model.quaternion);
            backward.negate(); // Inverter para a direção oposta
            const probeOrigin = this.model.position.clone()
                .add(backward.multiplyScalar(speed + SETTINGS.physics.ledgeOffset));
            probeOrigin.y += 0.5;

            const collidables = this.scene.children.filter(o => o !== this.model && o.type !== 'Light');
            this.raycaster.set(probeOrigin, new THREE.Vector3(0, -1, 0));
            const hits = this.raycaster.intersectObjects(collidables, true);

            const isSafe = hits.length > 0 && (this.model.position.y - hits[0].point.y) < SETTINGS.physics.ledgeDepth;

            // ── Wall check horizontal (deteção de paredes atrás) ──────────────────────────────────
            let isWallBlocking = false;
            const wallCheckOrigin = this.model.position.clone();
            wallCheckOrigin.y += SETTINGS.physics.wallCheckHeight; // altura do raycast
            this.raycaster.set(wallCheckOrigin, backward);
            const wallHits = this.raycaster.intersectObjects(collidables, true);
            
            if (wallHits.length > 0 && wallHits[0].distance <= SETTINGS.physics.wallCheckDistance) {
                // Verificar se é uma parede (superfície quase vertical) ou rampa (superfície inclinada)
                const hit = wallHits[0];
                if (hit.face) {
                    const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
                    const worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
                    // Só é parede se normal-Y < threshold (superfície quase vertical)
                    if (worldNormal.y < SETTINGS.physics.wallNormalThreshold) {
                        isWallBlocking = true; // Parede detetada atrás
                    }
                } else {
                    // Se não temos info de face, assumir que é parede por segurança
                    isWallBlocking = true;
                }
            }

            if (isSafe && !isWallBlocking) {
                this.model.translateZ(-speed); // só move se for seguro E sem paredes
            }
            // se não for seguro ou há parede, não move — ponto final
        }
        if (input.left) this.model.rotateY(rotate);
        if (input.right) this.model.rotateY(-rotate);

        if (isRunning) {
            this._handleRunningAnimation(input);
            this.lastMoveState = 'RUN';
        } else {
            if (this.currentState !== STATES.WALK) {
                this.fadeToAction('walk', SETTINGS.blend.toWalk, true);
                this.currentState = STATES.WALK;
            }
            this.lastMoveState = 'WALK';
        }
    }

    /**
     * Escolhe entre correr a direito, virar à esquerda ou virar à direita,
     * usando one-shot + lean procedural para evitar o efeito "disco riscado".
     * @param {Object} input
     */
    _handleRunningAnimation(input) {
        if (input.left) {
            if (this.currentState !== STATES.RUN_LEFT_TRANSITION && this.previousLeanSide !== 'LEFT') {
                this.fadeToAction('run_left', SETTINGS.blend.toLean, true);
                this.currentState = STATES.RUN_LEFT_TRANSITION;
                this.previousLeanSide = 'LEFT';

                const onFinished = (e) => {
                    if (e.action === this.actions['run_left']) {
                        this.fadeToAction('run', SETTINGS.blend.toRun, true);
                        this.currentState = STATES.RUN;
                        this.mixer.removeEventListener('finished', onFinished);
                    }
                };
                this.mixer.addEventListener('finished', onFinished);
            }
        } else if (input.right) {
            if (this.currentState !== STATES.RUN_RIGHT_TRANSITION && this.previousLeanSide !== 'RIGHT') {
                this.fadeToAction('run_right', SETTINGS.blend.toLean, true);
                this.currentState = STATES.RUN_RIGHT_TRANSITION;
                this.previousLeanSide = 'RIGHT';

                const onFinished = (e) => {
                    if (e.action === this.actions['run_right']) {
                        this.fadeToAction('run', SETTINGS.blend.toRun, true);
                        this.currentState = STATES.RUN;
                        this.mixer.removeEventListener('finished', onFinished);
                    }
                };
                this.mixer.addEventListener('finished', onFinished);
            }
        } else {
            if (this.currentState !== STATES.RUN) {
                this.fadeToAction('run', SETTINGS.blend.toRun, true);
                this.currentState = STATES.RUN;
                this.previousLeanSide = 'NONE';
            }
        }
    }

    /**
     * Gere o estado de repouso: idle → wobble → sentar (AFK).
     * @param {number} delta
     */
    _handleIdle(delta) {
        // Não substituir IDLE se estivermos com Medo (TERRIFIED) ── Fase 12 Final
        if (this.currentState !== STATES.IDLE &&
            this.currentState !== STATES.WOBBLE &&
            this.currentState !== STATES.TERRIFIED &&
            this.currentState !== STATES.TERRIFIED_LOOP) {
            // Wobble apenas se o último movimento foi corrida; senão vai para idle
            const targetAnim = (this.lastMoveState === 'RUN') ? 'wobble' : 'idle';
            this.fadeToAction(targetAnim, SETTINGS.blend.toIdle);
            this.currentState = targetAnim.toUpperCase();
        }

        this.idleTimer += delta;

        if (this.idleTimer > SETTINGS.afkTimeout) {
            this.currentState = STATES.SITTING_DOWN;
            this.fadeToAction('sit', SETTINGS.blend.toSit);

            const onSitFinished = (e) => {
                if (e.action === this.actions['sit']) {
                    this.currentState = STATES.SITTING;
                    this.lastMoveState = null;
                    this.mixer.removeEventListener('finished', onSitFinished);
                }
            };
            this.mixer.addEventListener('finished', onSitFinished);
        }
    }

    /**
     * Lógica de Gravidade e Deteção de Chão. (Fase 12)
     * Faz o guaxinim subir rampas e cair de plataformas.
     */
    _handleGravityAndGround(delta) {
        // CORREÇÃO: Pausar a física Y enquanto o guaxinim se agacha para saltar
        if (this.jumpLaunchPending) return;

        // Obter candidatos a chão/teto
        const collidables = this.scene.children.filter(obj =>
            obj !== this.model && obj.type !== 'Light' && obj.type !== 'AmbientLight'
        );

        // --- 1. DETEÇÃO DE TETO (Upward Raycast) ---
        // Se estivermos a subir (salto), verificamos se batemos com a cabeça
        if (this.verticalVelocity > 0) {
            const headOrigin = this.model.position.clone();
            headOrigin.y += 0.2; // Pequeno offset a partir do peito
            this.raycaster.set(headOrigin, new THREE.Vector3(0, 1, 0));
            const ceilingIntersects = this.raycaster.intersectObjects(collidables, true);

            if (ceilingIntersects.length > 0 && ceilingIntersects[0].distance < SETTINGS.physics.ceilingCheckHeight) {
                // Batemos no teto! Paramos a subida imediatamente
                this.verticalVelocity = 0;
                // Garantir que não fica preso em JUMP — deixar a gravidade resolver
                this.isGrounded = false;
            }
        }

        // --- 2. DETEÇÃO DE CHÃO (Downward Raycast) ---
        const rayOrigin = this.model.position.clone();
        rayOrigin.y += 1.0; // Origem bem acima do personagem para evitar estar dentro da geometria

        this.raycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));
        const rawIntersects = this.raycaster.intersectObjects(collidables, true);

        // ── Filtro sofisticado de hits do raycast ──────────────────────────────────
        const intersects = rawIntersects.filter(hit => {
            // 1. Rejeitar hits muito acima dos pés (atravessamento de rampa)
            if (hit.point.y > this.model.position.y + SETTINGS.physics.maxStepHeight) {
                return false;
            }

            // 2. Rejeitar hits da face de baixo de geometrias (backfaces)
            if (hit.face) {
                const normalMatrix = new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld);
                const worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
                // Se a normal aponta para baixo (y < threshold), é uma face inferior → ignorar
                if (worldNormal.y < SETTINGS.physics.backfaceNormalThreshold) {
                    return false;
                }
            }

            return true;
        });

        if (intersects.length > 0) {
            const groundY = intersects[0].point.y;
            const diff = groundY - this.model.position.y;

            // REFINAMENTO: Só fazemos snap ao chão se:
            // a) Estivermos a descer (verticalVelocity <= 0)
            // b) O chão estiver acima (climbing) ou abaixo até maxLandingDistance (deslizar em rampas)
            const isClimbing = (diff > 0 && diff <= SETTINGS.physics.maxStepHeight);
            const isLanding = (this.verticalVelocity <= 0 && diff <= 0 && diff >= SETTINGS.physics.maxLandingDistance);
            //                 ↑ velocidade a diminuir       ↑ chão abaixo             ↑ não cai longe demais

            if (isClimbing || isLanding) {
                if (!this.isGrounded && this.verticalVelocity < 0) {
                    this.isGrounded = true;
                    this.verticalVelocity = 0;
                }
                this.model.position.y = groundY;
            } else {
                // Caindo ou saltando livremente
                this.isGrounded = false;
                this.verticalVelocity -= SETTINGS.physics.gravity * delta;
            }
        } else {
            // Abismo
            this.isGrounded = false;
            this.verticalVelocity -= SETTINGS.physics.gravity * delta;
        }

        this.model.position.y += this.verticalVelocity * delta;

        // Segurança absoluta
        if (this.model.position.y < -50) {
            this.model.position.set(this.spawnPosition.x, this.spawnPosition.y, this.spawnPosition.z);
            this.verticalVelocity = 0;
            this.isGrounded = true;
        }
    }

    /**
     * Deteção de abismos à frente para acionar a animação de Vertigens.
     * @param {boolean} isMoving
     */
    _handleLedgeDetection(isMoving) {
        // Só detetamos vertigens se não estivermos sentado ou no ar por um salto voluntário
        if (this.currentState === STATES.JUMP || this.currentState === STATES.SITTING) {
            return;
        }

        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(this.model.quaternion);

        // Lançar raio à frente (Ledge Offset)
        const ledgeRayOrigin = this.model.position.clone();
        ledgeRayOrigin.add(forward.multiplyScalar(SETTINGS.physics.ledgeOffset));
        ledgeRayOrigin.y += 0.5;

        const collidables = this.scene.children.filter(obj => obj !== this.model);
        this.raycaster.set(ledgeRayOrigin, new THREE.Vector3(0, -1, 0));
        const intersects = this.raycaster.intersectObjects(collidables, true);

        let scaryDepth = false;
        if (intersects.length > 0) {
            const depth = this.model.position.y - intersects[0].point.y;
            // Buffer de estabilidade: se já estivermos com medo, aceitamos uma profundidade menor
            const threshold = (this.currentState === STATES.TERRIFIED) ? (SETTINGS.physics.ledgeDepth * 0.8) : SETTINGS.physics.ledgeDepth;
            if (depth > threshold) {
                scaryDepth = true;
            }
        } else {
            scaryDepth = true; // Precipício total
        }

        // Se houver abismo, ativamos o medo
        if (scaryDepth) {
            if (this.currentState !== STATES.TERRIFIED) {
                this.currentState = STATES.TERRIFIED;
                this.fadeToAction('terrified_loop', SETTINGS.blend.toTerrified);
            }
        } else if (this.currentState === STATES.TERRIFIED) {
            // Só sai do medo se o chão à frente voltar a ser seguro (estabilização)
            // Se o usuário estiver parado, mantemos o medo um pouco mais para evitar flickering
            if (isMoving || !scaryDepth) {
                this.currentState = STATES.IDLE;
                this.fadeToAction('idle', SETTINGS.blend.toIdle);
            }
        }
    }
}

export { Raccoon };
