import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { getAssetPath } from '../../config.js';
import { setQuestActive, getFlowerCount } from './Flowers.js';

const POSITION = { x: 1.2, y: 0, z: 1.2 };
const WAVE_RADIUS   = 0.6;
const TALK_RADIUS   = 0.4;
const CANCEL_RADIUS = 0.6;  // sair deste range cancela o diálogo

export const FOX_POSITION = POSITION;

// Frases aleatórias pós-missão (antes de completar)
const CHAT_LINES = [
    "Ainda faltam algumas flores! Continua a explorar a floresta. 🌿",
    "Já encontraste as flores brilhantes? Estão escondidas entre as árvores!",
    "Obrigada por ajudares! Vai lá buscar as flores. 🌸",
    "Não desistas! A minha companheira vai adorar. 🦊",
    "Já tens algumas? Ótimo! Continua assim!",
];

// Frases de conclusão (quando traz as 10 flores)
const COMPLETE_LINES = [
    "Conseguiste! Trouxeste todas as flores! 🌸🌸🌸",
    "A minha companheira vai ficar tão feliz! Muito obrigada!",
    "Como prometido, fica com esta flor especial para ti. 🌺",
];

// ─── UI ──────────────────────────────────────────────────────────────────────
const IS_TOUCH = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));

function _el(css) {
    const d = document.createElement('div');
    d.style.cssText = css;
    document.body.appendChild(d);
    return d;
}

const _box = _el(`
    position:fixed; bottom:60px; left:50%; transform:translateX(-50%);
    background:rgba(0,0,0,0.78); color:#fff; font-family:sans-serif;
    font-size:1rem; padding:14px 22px; border-radius:10px;
    max-width:440px; text-align:center;
    border:1px solid rgba(255,255,255,0.2); display:none;
    ${IS_TOUCH ? 'pointer-events:all; cursor:pointer;' : 'pointer-events:none;'}
`);

const _btnRow = _el(`position:fixed;bottom:16px;left:50%;transform:translateX(-50%);display:none;gap:12px;`);

function _btn(label, color) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `padding:8px 28px;border-radius:6px;border:none;cursor:pointer;font-size:1rem;font-family:sans-serif;background:${color};color:#fff;font-weight:bold;`;
    _btnRow.appendChild(b);
    return b;
}
const _btnYes = _btn('Sim 🌸', '#4caf50');
const _btnNo = _btn('Não', '#e53935');

const _prompt = _el(`
    position:fixed; bottom:115px; left:50%; transform:translateX(-50%);
    background:rgba(255,255,255,${IS_TOUCH ? '0.25' : '0.15'}); color:#fff; font-family:sans-serif;
    font-size:${IS_TOUCH ? '1rem' : '0.85rem'}; padding:${IS_TOUCH ? '10px 20px' : '6px 14px'}; border-radius:6px;
    pointer-events:${IS_TOUCH ? 'all' : 'none'}; display:none;
    ${IS_TOUCH ? 'cursor:pointer; border:1px solid rgba(255,255,255,0.4); box-shadow: 0 4px 12px rgba(0,0,0,0.3);' : ''}
`);
_prompt.textContent = IS_TOUCH ? '🦊 Falar com a raposa' : 'Pressiona [E] para falar';

function _show(text, showBtns = false) {
    if (IS_TOUCH) {
        _box.textContent = text;
    } else {
        _box.textContent = showBtns ? text : text + '  [E]';
    }
    _box.style.display = 'block';
    _btnRow.style.display = showBtns ? 'flex' : 'none';
}
function _hide() { _box.style.display = 'none'; _btnRow.style.display = 'none'; }

// ─── Fox ─────────────────────────────────────────────────────────────────────
export class Fox {
    constructor(scene) {
        this.scene = scene;
        this.model = null;
        this.mixer = null;
        this.actions = {};
        this._state = 'idle';
        this._phase = 'idle';   // idle | quest | chat | complete
        this._lineIdx = 0;
        this._chatLines = null;
        this._pendingTalk = false;
        this._questDone = false;
        this._missionComplete = false;
        this._onComplete = null;  // callback → main.js para recompensa

        this.modelLoaded = new Promise(r => this._load(r));

        _btnYes.addEventListener('click', () => this._acceptQuest());
        _btnNo.addEventListener('click', () => this._declineQuest());

        // Interaction listeners (pointerdown works for both touch and mouse)
        _prompt.addEventListener('pointerdown', () => {
            if (this._phase === 'idle') {
                this._pendingTalk = true;
                // Em touch, queremos disparar logo se possível
                this._checkImmediateTalk();
            }
        });
        _box.addEventListener('pointerdown', () => {
            if (this._phase === 'chat' || this._phase === 'complete') this._advanceLine();
        });

        window.addEventListener('keydown', (e) => {
            if (e.code !== 'KeyE') return;
            if (this._phase === 'idle') { this._pendingTalk = true; return; }
            if (this._phase === 'chat') this._advanceLine();
            if (this._phase === 'complete') this._advanceLine();
        });
    }

    /** Regista callback chamado quando a missão é concluída. */
    onMissionComplete(cb) { this._onComplete = cb; }

    _load(resolve) {
        const loader = new FBXLoader();
        loader.load(getAssetPath('elements/fox.fbx'), (fbx) => {
            this.model = fbx;
            this.model.scale.setScalar(0.1);
            this.model.position.set(POSITION.x, POSITION.y, POSITION.z);
            this.model.rotation.y = -Math.PI / 2;
            this.model.traverse(c => {
                if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; c.raycast = () => { }; }
            });
            this.scene.add(this.model);

            // Collider invisível — bloqueia o raccoon sem afetar o visual
            const collider = new THREE.Mesh(
                new THREE.CylinderGeometry(0.09, 0.09, 0.5, 8),
                new THREE.MeshBasicMaterial({ visible: false })
            );
            collider.position.set(POSITION.x, 0.3, POSITION.z);
            this.scene.add(collider);
            this.mixer = new THREE.AnimationMixer(this.model);
            this._loadAnims(resolve);
        });
    }

    _loadAnims(resolve) {
        const loader = new FBXLoader();
        const base = getAssetPath('animations') + '/';
        const files = [
            { name: 'idle', file: 'Dwarf Idle.fbx' },
            { name: 'wave', file: 'Waving.fbx' },
            { name: 'talking', file: 'Talking.fbx' },
        ];
        let done = 0;
        for (const { name, file } of files) {
            loader.load(base + file, (fbx) => {
                const action = this.mixer.clipAction(fbx.animations[0]);
                action.loop = THREE.LoopRepeat;
                this.actions[name] = action;
                if (++done === files.length) { this._play('idle'); resolve(); }
            });
        }
    }

    _play(name) {
        if (this._state === name) return;
        const prev = this.actions[this._state];
        const next = this.actions[name];
        if (!next) return;
        if (prev) prev.fadeOut(0.3);
        next.reset().fadeIn(0.3).play();
        this._state = name;
    }

    _startConversation() {
        const { collected, total } = getFlowerCount();
        const allCollected = collected >= total && total > 0;

        if (allCollected && !this._missionComplete) {
            // Missão completa!
            this._missionComplete = true;
            this._phase = 'complete';
            this._chatLines = COMPLETE_LINES;
            this._lineIdx = 0;
            _show(COMPLETE_LINES[0]);
            this._play('talking');
        } else if (this._missionComplete) {
            // Já completou — frase genérica
            this._phase = 'chat';
            this._chatLines = ["Obrigada de novo! A minha companheira adorou as flores. 🌸"];
            this._lineIdx = 0;
            _show(this._chatLines[0]);
            this._play('talking');
        } else if (this._questDone) {
            // Missão em curso — frase aleatória de encorajamento
            this._phase = 'chat';
            this._chatLines = [CHAT_LINES[Math.floor(Math.random() * CHAT_LINES.length)]];
            this._lineIdx = 0;
            _show(this._chatLines[0]);
            this._play('talking');
        } else {
            // Primeira vez — pedido de missão
            this._phase = 'quest';
            _show('Olá guaxinim! Precisava da tua ajuda a apanhar algumas flores para surpreender a minha companheira. Ajudas-me?', true);
            this._play('talking');
        }
    }

    _acceptQuest() {
        _hide();
        this._questDone = true;
        setQuestActive(true);
        this._phase = 'chat';
        this._chatLines = ["Obrigada! Já sabes, flores brilhantes pela floresta. 🌸"];
        this._lineIdx = 0;
        _show(this._chatLines[0]);
        this._play('talking');
    }

    _declineQuest() {
        _hide();
        this._phase = 'idle';
        this._play('idle');
    }

    _checkImmediateTalk() {
        if (this._lastDist !== undefined && this._lastDist < TALK_RADIUS) {
            this._pendingTalk = false;
            _prompt.style.display = 'none';
            this._startConversation();
        }
    }

    _advanceLine() {
        this._lineIdx++;
        if (this._lineIdx >= this._chatLines.length) {
            _hide();
            this._phase = 'idle';
            this._play('idle');
            // Se acabou o diálogo de conclusão, disparar recompensa
            if (this._missionComplete && this._onComplete) {
                this._onComplete();
                this._onComplete = null; // só uma vez
            }
        } else {
            _show(this._chatLines[this._lineIdx]);
        }
    }

    update(delta, playerPos, tpCamera = null) {
        if (!this.model || !this.mixer) return;
        this.mixer.update(delta);

        const dx = playerPos.x - POSITION.x;
        const dz = playerPos.z - POSITION.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        this._lastDist = dist;

        const inDialogue = this._phase === 'quest' || this._phase === 'chat' || this._phase === 'complete';

        // Cancelar diálogo se o jogador se afastar
        if (inDialogue && dist > CANCEL_RADIUS) {
            _hide();
            this._phase = 'idle';
            this._play('idle');
            if (tpCamera) tpCamera.setDialogueLock(false);
            return;
        }

        // Câmara lock durante diálogo
        if (tpCamera) {
            if (inDialogue) {
                tpCamera.setDialogueLock(true, new THREE.Vector3(POSITION.x, POSITION.y + 0.8, POSITION.z));
            } else {
                tpCamera.setDialogueLock(false);
            }
        }

        if (inDialogue) {
            _prompt.style.display = 'none';
            return;
        }

        if (dist < TALK_RADIUS) {
            this._play('wave');
            _prompt.style.display = 'block';
            if (this._pendingTalk) {
                this._pendingTalk = false;
                _prompt.style.display = 'none';
                this._startConversation();
            }
        } else if (dist < WAVE_RADIUS) {
            _prompt.style.display = 'none';
            this._play('wave');
        } else {
            _prompt.style.display = 'none';
            this._play('idle');
        }
    }
}
