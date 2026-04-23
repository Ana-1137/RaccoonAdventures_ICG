import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Cache em memória: path → Promise<GLTF>
// O browser já faz cache HTTP, mas esta cache evita re-parsear o mesmo GLB.
const _cache = new Map();
const _loader = new GLTFLoader();

/**
 * Carrega um ficheiro GLTF/GLB com cache em memória.
 * A segunda chamada para o mesmo path retorna imediatamente a promise já resolvida.
 * @param {string} path - Caminho para o ficheiro GLB/GLTF
 * @returns {Promise<GLTF>}
 */
export function loadGLTF(path) {
    if (!_cache.has(path)) {
        _cache.set(path, new Promise((resolve, reject) => {
            _loader.load(path, resolve, undefined, reject);
        }));
    }
    return _cache.get(path);
}

/**
 * Clona o scene de um GLTF para criar uma instância independente.
 * A geometria é partilhada; os materiais são clonados para permitir
 * alterações individuais (cor, opacidade, etc.).
 * @param {GLTF} gltf
 * @returns {THREE.Group}
 */
export function cloneScene(gltf) {
    return gltf.scene.clone(true);
}

/**
 * Congela a matrix de um objeto e de todos os seus filhos.
 * Elimina o recálculo automático da matrix world em cada frame.
 * Deve ser chamado DEPOIS de definir a posição/rotação/escala finais.
 * @param {THREE.Object3D} object
 */
export function freezeObject(object) {
    object.traverse(child => {
        child.matrixAutoUpdate = false;
        child.updateMatrix();
    });
    object.updateMatrixWorld(true);
}
