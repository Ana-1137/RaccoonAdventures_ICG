const keyStates = {
    w: false, a: false, s: false, d: false, shift: false
};

document.addEventListener('keydown', (event) => {
    if (keyStates[event.key.toLowerCase()] !== undefined) {
        keyStates[event.key.toLowerCase()] = true;
    }
});

document.addEventListener('keyup', (event) => {
    if (keyStates[event.key.toLowerCase()] !== undefined) {
        keyStates[event.key.toLowerCase()] = false;
    }
});

export { keyStates };
