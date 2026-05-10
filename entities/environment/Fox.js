import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { getAssetPath } from '../../config.js';
import { setQuestActive } from './Flowers.js';

const POSITION    = { x: 2.2, y: 0, z: 1.2 };
const WAVE_RADIUS = 2.0;
const TALK_RADIUS = 1.2;

// Diálogo após aceitar a missão (repetível)
const DIALOGUE_AFTER = [
    "Obrigada! Já sabes, flores brilhantes pela floresta. 🌸",
    "Até já! 🦊",
];

// ─── UI ──────────────────────────────────────────────────────────────────────
function _el(css) {
    const d = document.createElement('div');
    d.style.cssText = css;
    document.body.appendChild(d);
    return d;
}

// Balão de diálogo
const _box = _el(`
    position:fixed; bottom:60px; left:50%; transform:translateX(-50%);
    background:rgba(0,0,0,0.78); color:#fff; font-family:sans-serif;
    font-size:1rem; padding:14px 22px; border-radius:10px;
    max-width:440px; text-align:center;
    border:1px solid rgba(255,255,255,0.2); display:none;
`);

// Botões Sim / Não (só visíveis no pedido de missão)
const _btnRow = _el(`
    position:fixed; bottom:16px; left:50%; transform:translateX(-50%);
    display:none; gap:12px; flex-direction:row;
`);
_btnRow.style.display = 'none';

function _btn(label, color) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `
        padding:8px 28px; border-radius:6px; border:none; cursor:pointer;
        font-size:1rem; font-family:sans-serif;
        background:${color}; color:#fff; font-weight:bold;
    `;
    _btnRow.appendChild(b);
    return b;
}
const _btnYes = _btn('Sim 🌸', '#4caf50');
const _btnNo  = _btn('Não',    '#e53935');

// Prompt [E]
const _prompt = _el(`
    position:fixed; bottom:115px; left:50%; transform:translateX(-50%);
    background:rgba(255,255,255,0.15); color:#fff; font-family:sans-serif;
    font-size:0.85rem; padding:6px 14px; border-radius:6px;
    pointer-events:none; display:none;
`);
_prompt.textContent = 'Pressiona [E] para falar';

function _show(text, showButtons = false) {
    _box.textContent = showButtons ? text : text + '  [E]';
    _box.style.display = 'block';
    _btnRow.style.display = showButtons ? 'flex' : 'none';
}
function _hide() { _box.style.display = 'none'; _btnRow.style.display = 'none'; }

// ─── Fox ─────────────────────────────────────────────────────────────────────
export class Fox {
    constructor(scene) {
        this.scene   = scene;
        this.model   = null;
        this.mixer   = null;
        this.actions = {};
        this._state  = 'idle';
        this._phase  = 'idle';   // idle | quest | after
        this._afterIdx = 0;
        this._pendingTalk = false;
        this._questDone = false;

        this.modelLoaded = new Promise(r => this._load(r));

        // Botões
        _btnYes.addEventListener('click', () => this._acceptQuest());
        _btnNo.addEventListener('click',  () => this._declineQuest());

        // Tecla E
        window.addEventListener('keydown', (e) => {
            if (e.code !== 'KeyE') return;
            if (this._phase === 'idle') { this._pendingTalk = true; return; }
            if (this._phase === 'after') this._advanceAfter();
        });
    }

    _load(resolve) {
        const loader = new FBXLoader();
        loader.load(getAssetPath('elements/fox.fbx'), (fbx) => {
            this.model = fbx;
            this.model.scale.setScalar(0.1);
            this.model.position.set(POSITION.x, POSITION.y, POSITION.z);
            this.model.rotation.y = -Math.PI / 2;
            this.model.traverse(c => {
                if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; c.raycast = () => {}; }
            });
            this.scene.add(this.model);
            this.mixer = new THREE.AnimationMixer(this.model);
            this._loadAnims(resolve);
        });
    }

    _loadAnims(resolve) {
        const loader = new FBXLoader();
        const base = getAssetPath('animations') + '/';
        const files = [
            { name: 'idle',    file: 'Dwarf Idle.fbx' },
            { name: 'wave',    file: 'Waving.fbx' },
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

    // Inicia o pedido de missão
    _startQuest() {
        this._phase = 'quest';
        this._play('talking');
        _show(
            'Olá guaxinim! Precisava da tua ajuda a apanhar algumas flores para surpreender a minha companheira. Ajudas-me?',
            true   // mostrar botões
        );
    }

    _acceptQuest() {
        _hide();
        this._questDone = true;
        setQuestActive(true);
        this._phase = 'after';
        this._afterIdx = 0;
        _show(DIALOGUE_AFTER[0]);
        this._play('talking');
    }

    _declineQuest() {
        _hide();
        this._phase = 'idle';
        this._play('idle');
    }

    _advanceAfter() {
        this._afterIdx++;
        if (this._afterIdx >= DIALOGUE_AFTER.length) {
            _hide();
            this._phase = 'idle';
            this._play('idle');
        } else {
            _show(DIALOGUE_AFTER[this._afterIdx]);
        }
    }

    update(delta, playerPos) {
        if (!this.model || !this.mixer) return;
        this.mixer.update(delta);

        const dx = playerPos.x - POSITION.x;
        const dz = playerPos.z - POSITION.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Durante diálogo ativo não alterar estado
        if (this._phase === 'quest' || this._phase === 'after') {
            _prompt.style.display = 'none';
            return;
        }

        if (dist < TALK_RADIUS) {
            this._play('wave');
            _prompt.style.display = 'block';
            if (this._pendingTalk) {
                this._pendingTalk = false;
                _prompt.style.display = 'none';
                if (this._questDone) {
                    // Missão já aceite — diálogo curto
                    this._phase = 'after';
                    this._afterIdx = 0;
                    _show(DIALOGUE_AFTER[0]);
                    this._play('talking');
                } else {
                    this._startQuest();
                }
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
