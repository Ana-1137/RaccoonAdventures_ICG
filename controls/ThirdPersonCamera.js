import * as THREE from 'three';

class ThirdPersonCamera {
    constructor(camera, target, domElement, orbitControls) {
        this.camera = camera;
        this.target = target;
        this.isInteracting = false;
        this._dialogueLock = false;      // true durante diálogo com Fox
        this._dialogueTarget = null;     // posição do NPC para olhar
        
        // Offset (Fase 6): Equilíbrio entre horizonte e personagem
        this.defaultOffsetDirection = new THREE.Vector3(0.25, 0.18, -0.65).normalize();
        this.lookAtOffset = new THREE.Vector3(0, 0.18, 0); 

        this.defaultDistance = 0.6; 
        this.lastTargetPosition = new THREE.Vector3();
        if (target) this.lastTargetPosition.copy(target.position);

        // Listeners manuais
        const startInteracting = () => {
            this.isInteracting = true;
            if (this.interactionTimeout) clearTimeout(this.interactionTimeout);
        };
        const stopInteracting = () => {
            if (this.interactionTimeout) clearTimeout(this.interactionTimeout);
            this.interactionTimeout = setTimeout(() => {
                this.isInteracting = false;
            }, 600);
        };

        // Escutar no elemento DOM e window
        domElement.addEventListener('mousedown', startInteracting);
        window.addEventListener('mouseup', stopInteracting);
        domElement.addEventListener('touchstart', startInteracting);
        window.addEventListener('touchend', stopInteracting);
        
        // Wheel zoom deve ser tratado como interação
        window.addEventListener('wheel', () => {
            startInteracting();
            stopInteracting();
        }, { passive: true });

        // Eventos do OrbitControls como backup
        orbitControls.addEventListener('start', startInteracting);
        orbitControls.addEventListener('end', stopInteracting);
    }

    /** Liga/desliga o lock de câmara para diálogo.
     *  @param {boolean} active
     *  @param {THREE.Vector3} [npcPos] — posição do NPC para enquadrar */
    setDialogueLock(active, npcPos = null) {
        this._dialogueLock = active;
        this._dialogueTarget = npcPos ? npcPos.clone() : null;
    }

    update(isMoving, orbitControls, isRunning) {
        if (!this.target) return;

        // ── Modo diálogo: câmara atrás do raccoon a olhar para o NPC ─────────
        if (this._dialogueLock && this._dialogueTarget) {
            const rp = this.target.position;
            const np = this._dialogueTarget;
            // Direção do raccoon para o NPC
            const toNpc = np.clone().sub(rp).normalize();
            // Câmara atrás do raccoon (oposto ao NPC), ligeiramente ao lado e baixa
            const back = toNpc.clone().negate().multiplyScalar(0.4);
            back.x += toNpc.z * 0.25;   // offset lateral
            back.z -= toNpc.x * 0.25;
            const idealPos = rp.clone().add(back).add(new THREE.Vector3(0, 0.12, 0));
            this.camera.position.lerp(idealPos, 0.06);
            // Olhar para o ponto médio entre os dois ao nível dos olhos
            const lookAt = rp.clone().lerp(np, 0.6).add(new THREE.Vector3(0, 0.1, 0));
            this.camera.lookAt(lookAt);
            orbitControls.target.copy(lookAt);
            this.lastTargetPosition.copy(rp);
            return;
        }

        // --- Efeitos de Velocidade (Fase 7) ---
        // Aumentar o FOV quando corre (efeito de distorção)
        const targetFOV = isRunning ? 65 : 45;
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 0.05);
        this.camera.updateProjectionMatrix();

        // Afastar um pouco a câmara quando corre
        const targetDistance = isRunning ? this.defaultDistance * 1.3 : this.defaultDistance;

        // --- Sincronização e Movimento ---
        const targetPos = this.target.position.clone().add(this.lookAtOffset);
        
        // Sincronização direta de posição para evitar lag
        const deltaMove = this.target.position.clone().sub(this.lastTargetPosition);
        this.camera.position.add(deltaMove);
        this.lastTargetPosition.copy(this.target.position);

        // Alvo dos controlos sempre no guaxinim
        orbitControls.target.copy(targetPos);

        if (!this.isInteracting && isMoving) {
            const idealOffset = this.defaultOffsetDirection.clone().applyQuaternion(this.target.quaternion);
            
            // Adicionar um tremor ultra-subtil se estiver a correr
            if (isRunning) {
                idealOffset.x += (Math.random() - 0.5) * 0.015;
                idealOffset.y += (Math.random() - 0.5) * 0.015;
            }

            const idealPosition = targetPos.clone().add(idealOffset.multiplyScalar(targetDistance));

            // Lerp para posição e zoom
            this.camera.position.lerp(idealPosition, 0.1);
            this.camera.lookAt(targetPos);
        } else if (!this.isInteracting) {
            // Focagem manual
            this.camera.lookAt(targetPos);
        }
    }
}

export { ThirdPersonCamera };
