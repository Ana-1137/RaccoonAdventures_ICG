# 🦝 Raccoon Adventures

Uma experiência 3D interativa desenvolvida em **Three.js** onde o jogador explora um acampamento florestal controlando um guaxinim em terceira pessoa, interage com um NPC (raposa) e completa uma missão de recolha de flores.

## 🎮 Jogar Online

**https://ana-1137.github.io/RaccoonAdventures_ICG/**

> Funciona em desktop e mobile (touch controls automáticos).

## Descrição do Projeto

Raccoon Adventures é o projeto final da disciplina de **Introdução à Computação Gráfica (ICG 2025/2026)**, demonstrando a aplicação prática de conceitos lecionados nas aulas:

- **Modelação 3D** — modelos externos (FBX/GLB) e geometria procedural
- **Iluminação** — AmbientLight, DirectionalLight, PointLight, SpotLight com sombras dinâmicas
- **Materiais & Texturas** — PBR (color + normal + roughness maps), alphaMap procedural
- **Animação** — 14 animações FBX com cross-fade, animações procedurais (vento, ondas, órbitas)
- **Interação** — teclado, rato (OrbitControls), touch, GUI (lil-gui), diálogo com NPC
- **Raycasting** — colisões com chão, teto, paredes, deteção de abismos
- **Vertex Deformation** — ondas na água, depressão do vale no terreno
- **Otimizações** — InstancedMesh, LOD, throttle, Float32Array, freezeObject

## Controlos

### Desktop

| Ação | Tecla |
|------|-------|
| Mover | W / A / S / D |
| Correr | Shift (segurar) |
| Saltar | Space |
| Interagir com NPC | E |
| Inventário | I |
| Orbitar câmara | Rato (arrastar) |
| Zoom | Roda do rato |

### Mobile

- **Joystick virtual** (esquerda) — movimento
- **Botão RUN** (direita) — correr
- **Botão JUMP** (direita) — saltar
- **Toque na UI** — interagir com NPC

## Estrutura do Projeto

```
RaccoonAdventures_ICG/
├── index.html                  # Página + loading screen + importmap
├── main.js                     # Loop principal e orquestração
├── config.js                   # Paths para GitHub Pages / localhost
│
├── core/
│   └── AssetCache.js           # Cache GLTF em memória + freezeObject
│
├── world/
│   ├── scene.js                # Cena base (background + fog)
│   ├── World.js                # Orquestrador de carregamento paralelo
│   ├── Ground.js               # Terreno PBR + depressão do vale
│   ├── Climate.js              # Ciclo dia/noite (sol, lua, céu, luzes)
│   ├── Rain.js                 # Sistema de chuva (partículas)
│   └── SoundManager.js         # Web Audio API (3 buses + proximidade)
│
├── entities/
│   ├── player/
│   │   ├── Raccoon.js          # Personagem: FSM 12 estados + física
│   │   └── QuestReward.js      # Animação de recompensa
│   └── environment/
│       ├── Fox.js              # NPC com diálogo e missão
│       ├── Forest.js           # ~120 árvores (InstancedMesh + vento)
│       ├── Water.js            # Cascata + água com ondas (vertex def.)
│       ├── Waterfalls.js       # 2 cascatas (modelos GLB)
│       ├── Fish.js             # 6 peixes procedurais (Shape+Extrude)
│       ├── Birds.js            # 8 pássaros procedurais (esferas+cone)
│       ├── Fireflies.js        # 30 pirilampos noturnos (Points)
│       ├── Flowers.js          # 10 flores colecionáveis + sparkles
│       ├── BoundaryWall.js     # Muralha de rochas (InstancedMesh)
│       ├── Tent.js             # Tenda (GLB)
│       ├── Campfire.js         # Fogueira (GLB)
│       └── LogBench.js         # Bancos de tronco (GLB)
│
├── lights/
│   ├── SceneLights.js          # Ambient + Directional (sol) + sombras
│   ├── CampfireLight.js        # PointLight + partículas + tremeluzir
│   └── StructureLights.js      # Festoon, marcadores, lanterna
│
├── controls/
│   ├── KeyboardControls.js     # WASD + Shift + Space
│   ├── TouchControls.js        # Joystick + botões mobile
│   └── ThirdPersonCamera.js    # Follow + FOV dinâmico + occlusion
│
├── ui/
│   ├── Dashboard.js            # lil-gui: tempo, luzes, clima, sons, FPS
│   ├── Inventory.js            # Sistema de inventário (tecla I)
│   └── ItemShowcase.js         # Showcase 3D com órbita de câmara
│
├── elements/                   # Assets (modelos GLB/FBX, texturas PBR)
├── animations/                 # 22 animações FBX (Mixamo)
├── sounds/                     # 8 ficheiros de áudio (ambiente + efeitos)
└── extra/                      # Documentação e entregas
```

## Features

### 🐾 Personagem (Raccoon)
- **12 estados** de animação: Idle, Walk, Run, Jump, Sit, Stand, Wobble, Terrified, Swimming, e transições de curva
- **14 animações FBX** com cross-fade suave e locomotion syncing (sincronização de fase walk↔run)
- **Sub-clips derivados**: `jump_walk` (recortado do salto parado), `terrified_loop` (PingPong)
- **Lean procedural**: inclinação do osso Spine durante corrida com curvas
- **AFK system**: idle → wobble → sentar automaticamente após 5s

### ⚡ Física
- Gravidade com salto (delay de liftoff sincronizado com animação)
- Deteção de chão/teto via raycasting filtrado (rejeição de backfaces, threshold de normais)
- Deteção de paredes horizontais (impede atravessar objetos sólidos)
- Deteção de abismos (ledge detection) → animação de vertigens
- Inércia horizontal durante saltos (com colisão de paredes no ar)
- Respawn de segurança se cair abaixo de Y=-50

### 🌅 Ciclo Dia/Noite
- Sol e lua em órbita trigonométrica contínua (180° de diferença)
- Cor do céu interpolada: azul claro → laranja (sunset) → azul escuro (noite)
- Intensidade de luz dinâmica baseada na elevação solar
- Pirilampos aparecem de noite, pássaros desaparecem
- Luzes estruturais (festoon) acendem automaticamente à noite

### 🌳 Mundo
- **Terreno**: PlaneGeometry 30×30 com depressão procedural (vale curvo em 3 zonas)
- **Floresta**: ~120 árvores (2 tipos: pinheiro + carvalho) via 4 InstancedMesh, geradas com grelha hexagonal + jitter + zonas de exclusão
- **Água**: cascata vertical + superfície horizontal com vertex deformation (ondas sinusoidais)
- **Muralha**: 27 rochas procedurais (BoxGeometry deformado com pseudo-random) via InstancedMesh com texturas PBR
- **Fogueira**: modelo GLB + PointLight com tremeluzir (3 sinusoides) + partículas Float32Array

### 🐦 Fauna Procedural
- **Peixes** (6): corpo com `Shape` + `ExtrudeGeometry` (elipse, cauda crescente, barbatanas, olhos, guelras), órbita elíptica no vale, saltos periódicos
- **Pássaros** (8): corpo elíptico (`SphereGeometry` escalado), cabeça, olhos, bico (`ConeGeometry`), rabo, asas com prismas quadrangulares (`CylinderGeometry` 4-sided achatado) com pivots para batimento; órbita circular, fade dia/noite
- **Pirilampos** (30): `Points` com drift aleatório, bob sinusoidal, fade noturno
- **Sparkles das flores**: partículas brilhantes que aparecem por proximidade quando a missão está ativa

### 🦊 NPC & Missão
- Raposa com 3 animações (idle, wave, talking) e sistema de estados (idle → quest → chat → complete)
- Diálogo interativo com opções Sim/Não para aceitar missão
- Missão: recolher 10 flores espalhadas pela floresta
- Recompensa: showcase 3D com órbita de câmara + item adicionado ao inventário
- UI adaptada: tecla E (desktop) ou botão touch (mobile)

### 🔊 Áudio
- Web Audio API com 3 buses (Master → Ambient + Effects)
- Sons ambiente: dia, noite, chuva, rio (crossfade automático)
- Sons por proximidade: fogueira, brilho das flores
- Efeitos one-shot: coleta, unlock
- Controlo de volume no Dashboard (master, ambiente, efeitos)

### 📊 Dashboard (lil-gui)
- Controlo do ciclo dia/noite (hora, velocidade, ativar/desativar)
- Controlo da fogueira (on/off, intensidade, alcance, cor)
- Luzes estruturais (on/off, sempre ligadas)
- Nevoeiro (densidade) e chuva (intensidade)
- Volume de áudio (master, ambiente, efeitos)
- FPS em tempo real

### ⚙️ Otimizações de Performance
- **InstancedMesh**: ~120 árvores em 4 draw calls + 27 rochas em 2 draw calls
- **MeshLambertMaterial**: para árvores (mais rápido que PBR, visualmente equivalente para fundo)
- **LOD de distância**: partículas da fogueira pausam se jogador longe
- **Throttle a 30Hz**: vento das árvores e partículas não correm a 60fps
- **Float32Array**: velocidades das partículas sem alocações/garbage collection
- **freezeObject**: `matrixAutoUpdate=false` para objetos estáticos (tenda, cascatas, flores)
- **alphaTest**: em vez de `transparent:true` para folhas (evita sorting)
- **Shadow map reduzido**: fogueira 512×512 (vs 1024 padrão)
- **Raycast desativado**: em objetos decorativos (flores, peixes, partículas, pássaros)
- **Asset caching**: GLTFs em cache de memória para evitar re-parse

## Tecnologias

| Tecnologia | Versão | Utilização |
|------------|--------|------------|
| **Three.js** | r184 | Motor 3D (cena, câmara, renderer, luzes, materiais) |
| **lil-gui** | 0.18.0 | Dashboard de controlo interativo |
| **FBXLoader** | Three.js addon | Carregamento de modelos animados (Raccoon, Fox) |
| **GLTFLoader** | Three.js addon | Carregamento de modelos estáticos (árvores, tenda, etc.) |
| **OrbitControls** | Three.js addon | Controlo de câmara com rato |
| **Web Audio API** | Nativa | Sistema de áudio espacial |
| **ES Modules** | Nativo | Organização modular do código (sem bundler) |

### ⚠️ Nota sobre a Versão do Three.js (r160 → r184)
O projeto foi inicialmente construído e fixado na versão **r160** (`0.160.0`). A decisão de fixar a versão através de um *import map* foi tomada para garantir total estabilidade e compatibilidade com os guiões e exemplos lecionados nas aulas, prevenindo que o projeto "partisse" de um dia para o outro devido a atualizações constantes da biblioteca (que introduzem frequentemente *breaking changes*).

Posteriormente (alteração efetuada após a apresentação), o projeto foi validado e atualizado para a versão **r184** (`0.184.0`), acompanhando os desenvolvimentos mais recentes da UC e usufruindo das mais recentes otimizações internas do motor, sem impacto negativo no funcionamento da aplicação.

## Documentação

### 📋 Diretrizes e Proposta
- [Diretrizes do Projeto](./extra/ICG_2526_Projeto_ENGLISH.pdf) — Requisitos técnicos e escopo
- [Proposta do Projeto](./extra/119905_PropostaProjeto.pdf) — Conceito, objetivos e funcionalidades

### ✅ Entrega Intermédia (16/04/2026)
- [Slides da Apresentação](./extra/119905-Slides_Entrega_Intermedia.pdf) — Apresentação visual e demo
- [Relatório de Entrega](./extra/119905_ICG_Entrega_Intermedia.pdf) — Progresso detalhado

### 🎓 Entrega Final
- [Guião de Apresentação](./extra/Guidelines_and_Slides_Skeleton.pdf) — Skeleton dos slides
- [Apresentação Final](./extra/Final%20Raccoon%20Adventures.pdf) — Slides da apresentação final
- [Vídeo Demo](https://youtu.be/qsZUAlynYQ8) — Demonstração do projeto

## Uso de IA

O desenvolvimento contou com assistência de IA (GitHub Copilot / Antigravity) nas seguintes áreas:

- **Sistema de Física**: gravidade, colisões com raycast, inércia em saltos, deteção de abismos
- **Máquina de Estados de Animação**: FSM com 12 estados, cross-fade, sub-clips, locomotion syncing
- **Otimizações de Performance**: InstancedMesh, LOD, throttle, Float32Array, freezeObject
- **Refactoring e Modularização**: separação em módulos ES6, padrão SETTINGS por ficheiro
- **Debugging**: resolução de problemas de física, raycasting, e compatibilidade mobile

A IA funcionou como ferramenta complementar, acelerando a implementação mantendo a compreensão e qualidade do código.

## Assets

| Tipo | Fonte |
|------|-------|
| Modelos 3D | Meshy, Sketchfab |
| Animações FBX | Mixamo |
| Texturas PBR | Polyhaven / Ambient CG |
| Sons | freesound.org |

## Autoria

Projeto desenvolvido para a disciplina de **Introdução à Computação Gráfica (ICG)** — 2025/2026.
