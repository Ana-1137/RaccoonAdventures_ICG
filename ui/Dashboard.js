import GUI from 'lil-gui';

/**
 * Cria e configura o painel de controlo lil-GUI.
 * @param {Object} climate  - Sistema de clima (retornado por createClimate)
 * @param {Object} campfire - Fogueira (retornado por createCampfireLight)
 * @returns {GUI} Instância do painel
 */
function createDashboard(climate, campfire) {
    const gui = new GUI({ title: '🌞 Climate Dashboard' });
    gui.domElement.style.cssText = 'position:fixed;top:10px;right:10px;z-index:1000;';

    _buildTimeFolder(gui, climate);
    _buildLightingFolder(gui, campfire);
    _buildPerformanceFolder(gui);

    return gui;
}

// ─── FOLDERS ────────────────────────────────────────────────────────────────

/**
 * Pasta de controlo do ciclo dia/noite.
 * @param {GUI}    gui
 * @param {Object} climate
 */
function _buildTimeFolder(gui, climate) {
    const folder = gui.addFolder('⏰ Tempo');
    folder.open();

    folder.add(climate.settings.time, 'enabled').name('Ativar Ciclo');
    folder.add(climate.settings.time, 'hour', 0, 24, 0.01).name('Hora do Dia');
    folder.add(climate.settings.time, 'speed', 0, 0.3, 0.01).name('Velocidade');

    // Display de hora (read-only, atualizado em cada frame via .listen())
    const timeDisplay = { time: climate.getTimeFormatted() };
    folder.add(timeDisplay, 'time').name('Hora Atual').listen().disable();

    // Guardar referência para que main.js possa atualizar o display
    climate._guiTimeDisplay = timeDisplay;
}

/**
 * Pasta de controlo da fogueira (luz + intensidade + alcance + cor).
 * @param {GUI}    gui
 * @param {Object} campfire
 */
function _buildLightingFolder(gui, campfire) {
    const folder = gui.addFolder('💡 Iluminação');
    folder.open();

    folder
        .add(campfire.settings, 'enabled')
        .name('Ativar Fogueira')
        .onChange((value) => {
            campfire.light.visible = value;
            campfire.mesh.visible  = value;
        });

    folder
        .add(campfire.settings, 'intensity', 0, 2, 0.1)
        .name('Intensidade');

    folder
        .add(campfire.settings, 'range', 5, 30, 1)
        .name('Alcance')
        .onChange((value) => {
            campfire.light.distance   = value;
            campfire.settings.range   = value;
        });

    folder
        .addColor(campfire.settings, 'color')
        .name('Cor')
        .onChange((value) => campfire.light.color.setStyle(value));
}

/**
 * Pasta de performance: exibe FPS em tempo real.
 * @param {GUI} gui
 * @returns {Object} fpsDisplay — atualizar `fpsDisplay.fps` em cada frame
 */
function _buildPerformanceFolder(gui) {
    const folder     = gui.addFolder('⚙️ Performance');
    const fpsDisplay = { fps: '0.0' };
    folder.open();
    folder.add(fpsDisplay, 'fps').name('FPS').listen().disable();
    // Guardar no objeto global para acesso em main.js
    gui._fpsDisplay = fpsDisplay;
    return fpsDisplay;
}

export { createDashboard };
