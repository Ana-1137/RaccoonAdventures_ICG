# Raccoon Adventures

Uma aplicação 3D interativa desenvolvida em Three.js que permite explorar um acampamento florestal controlando um guaxinim em terceira pessoa.

## Descrição do Projeto

Raccoon Adventures é um projeto de Computação Gráfica que demonstra conceitos avançados como:

- Modelação 3D e hierarquias de cena
- Animações complexas com transições suaves
- Câmara dinâmica de terceira pessoa
- Física realista (gravidade, colisões, inércia)
- Iluminação dinâmica e sombras em tempo real
- Ciclo dia/noite automático
- Sistema de partículas
- Geração procedural (floresta com 180 árvores)
- Interface interativa (lil-gui)

**Documentação Completa:**
- [Proposta do Projeto (PT)](./extra/119905_PropostaProjeto.pdf)
- [Project Brief (EN)](./extra/ICG_2526_Projeto_ENGLISH.pdf)

## Requisitos

- Navegador moderno com suporte a WebGL (Chrome, Firefox, Edge)

## Como Jogar

🎮 **Aceda diretamente ao jogo online:**

https://ana-1137.github.io/RaccoonAdventures_ICG/

Não precisa de instalar nada! O jogo carrega automaticamente no seu navegador.

## Controlos

| Ação | Tecla |
|------|-------|
| Mover frente/trás | W / S |
| Mover esquerda/direita | A / D |
| Correr | Shift |
| Saltar | Space |
| Orbitar câmara | Rato (drag) |
| Zoom câmara | Roda do rato |

## Estrutura do Projeto

```
RaccoonAdventures_ICG/
├── index.html           # Página principal
├── main.js              # Ponto de entrada
├── config.js            # Configuração de caminhos (GitHub Pages)
├── controls/            # Sistemas de controlo
├── entities/            # Modelos do jogo
├── world/               # Componentes do mundo
├── elements/            # Assets (modelos, texturas)
├── animations/          # Animações FBX
└── extra/               # Documentação e referências
```

## Features Principais

- 11 animações do protagonista com blending automático
- Ciclo dia/noite com 24 horas simuladas
- Widget GUI para controlo em tempo real
- Fogueira com tremeluzir realista e partículas
- Sombras dinâmicas sincronizadas com iluminação
- Otimizações de performance (LOD em árvores, InstancedMesh)
- ~60 FPS em máquinas modernas

## Tecnologias Utilizadas

- **Three.js** (r160) - Motor 3D
- **lil-gui** - Interface de controlo
- **FBXLoader / GLTFLoader** - Carregamento de modelos
- **JavaScript ES6 Modules** - Organização do código

## Status

Projeto: 70% completo

Implementado:
- Todas as mecânicas principais
- Ciclo dia/noite com sincronização de iluminação
- Sistema de partículas
- Widget interativo

Falta (opcional):
- Colisões avançadas com objetos
- Fauna animada (peixes, pássaros)
- Luzes focais adicionais

## Ajuda de IA

O desenvolvimento deste projeto contou com assistência de IA (GitHub Copilot) nas seguintes áreas:

- **Contextualização do Projeto**: Análise da proposta inicial, definição de requisitos e estruturação de objetivos técnicos
- **Sistema de Física**: Implementação completa de gravidade, detecção de colisões com raycast, cálculo de inércia em saltos e validação de terreno
- **Animações**: Máquina de estados para blending de animações, sincronização de transições e implementação de states como Idle, Walk, Run, Jump, Sit e Terrified
- **Adaptação de Aulas Práticas**: Integração de conceitos de Three.js estudados nas aulas práticas (luzes, sombras, câmaras, controles)
- **Revisão e Melhoria de Código**: Otimizações de performance (InstancedMesh, LOD), refactoring de componentes, documentação inline e estruturação modular

A IA funcionou como ferramenta complementar de desenvolvimento, acelerando a implementação mantendo a qualidade e entendimento do código.

## Autoria

Projeto desenvolvido para a disciplina de Computação Gráfica (ICG).

Assets utilizados:
- Modelos: Meshy, Sketchfab, Mixamo
- Texturas: Polyhaven
- Animações: Mixamo, Adobe
