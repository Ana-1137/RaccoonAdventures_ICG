import * as THREE from 'three';

class ThirdPersonCamera {
    constructor(camera, target) {
        this.camera = camera;
        this.target = target;

        this.currentPosition = new THREE.Vector3();
        this.currentLookat = new THREE.Vector3();
    }

    update(isMoving, orbitControls) {
        if (!this.target) {
            // Aguarda o modelo ser carregado
            if (this.target) this.target = this.target;
            return;
        }

        if (isMoving) {
            orbitControls.enabled = false;

            const cameraOffset = new THREE.Vector3(0.5, 0.4, -1.1);
            const offset = cameraOffset.clone().applyQuaternion(this.target.quaternion);
            const desiredCameraPos = this.target.position.clone().add(offset);
            
            this.camera.position.lerp(desiredCameraPos, 0.15);

            const lookAtTarget = this.target.position.clone();
            lookAtTarget.y += 0.5;
            this.camera.lookAt(lookAtTarget);

            orbitControls.target.lerp(this.target.position, 0.2);

        } else {
            orbitControls.enabled = true;
        }
    }
}

export { ThirdPersonCamera };
