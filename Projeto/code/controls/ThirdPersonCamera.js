import * as THREE from 'three';

class ThirdPersonCamera {
    constructor(camera, target, domElement, orbitControls) {
        this.camera = camera;
        this.target = target;
        this.isInteracting = false;
        
        // Offset mais baixo e curto
        this.defaultOffsetDirection = new THREE.Vector3(0.2, 0.12, -0.6).normalize();
        this.lookAtOffset = new THREE.Vector3(0, 0.15, 0); 

        this.defaultDistance = 0.55; 
        this.lastTargetPosition = new THREE.Vector3();
        if (target) this.lastTargetPosition.copy(target.position);

        // Usar eventos do OrbitControls para interação
        orbitControls.addEventListener('start', () => {
            this.isInteracting = true;
        });
        orbitControls.addEventListener('end', () => {
            setTimeout(() => { this.isInteracting = false; }, 100);
        });

        // Capturar wheel para zoom de forma mais agressiva
        const onWheel = () => {
            this.isInteracting = true;
            clearTimeout(this.wheelTimeout);
            this.wheelTimeout = setTimeout(() => {
                this.isInteracting = false;
            }, 600); // 600ms para dar tempo ao utilizador de lerpar se quiser, mas aqui só para ignorar auto-follow
        };
        domElement.addEventListener('wheel', onWheel, { passive: true });
    }

    update(isMoving, orbitControls) {
        if (!this.target) return;

        const targetPos = this.target.position.clone().add(this.lookAtOffset);
        
        // Sincronização direta de posição (sempre, para não "desprender")
        const deltaMove = this.target.position.clone().sub(this.lastTargetPosition);
        this.camera.position.add(deltaMove);
        this.lastTargetPosition.copy(this.target.position);

        // Atualizar o alvo dos controlos sempre
        orbitControls.target.copy(targetPos);

        // REGRA DE RETORNO (Fase 5):
        // Só forçamos o regresso à posição/zoom default se:
        // 1. O utilizador NÃO estiver a mexer no mouse (isInteracting == false)
        // 2. O personagem ESTIVER a mover-se (isMoving == true)
        
        if (!this.isInteracting && isMoving) {
            const idealOffset = this.defaultOffsetDirection.clone().applyQuaternion(this.target.quaternion);
            const idealPosition = targetPos.clone().add(idealOffset.multiplyScalar(this.defaultDistance));

            // Lerp para posição e zoom
            this.camera.position.lerp(idealPosition, 0.1);
            
            // Suavizar o foco
            this.camera.lookAt(targetPos);
        } else if (!this.isInteracting) {
            // Se estivermos parados e sem usar o mouse, apenas garantimos que olha para o guaxinim
            // Mas não forçamos a posição (mantendo o zoom/rotação manual)
            this.camera.lookAt(targetPos);
        }
    }
}

export { ThirdPersonCamera };
