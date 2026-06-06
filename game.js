// ==========================================
// GAME.JS - BLOCK 1: INIT, DATA & VARIABLES
// ==========================================

const firebaseConfig = {
    apiKey: "AIzaSyCtgeDbmieZhR58_IriF_uIm3DQuOGSc-A",
    authDomain: "://firebaseapp.com",
    databaseURL: "https://firebasedatabase.app",
    projectId: "biere-handygame",
    storageBucket: "biere-handygame.firebasestorage.app",
    messagingSenderId: "706208794774",
    appId: "1:706208794774:web:9d7a39ee4701ab01e71ab7"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let gameState = "MENU"; 
let highscores = [];
let keys = {};
let beers = [], giTos = [], doeners = [], snacks = [], pfuetzen = [];

let beerSpawnTimer = 0;
let nextGitoRoundTimer = 3600; 
let gitoRoundTimer = 0;
let gitoRoundActive = false;
let nextDoenerTimer = 7200;
let milestoneTimer = 0;
let colorShiftIdx = 0;
let enteredName = "";

const player = {
    x: 240, y: 500, width: 50, height: 80, speed: 4.5, vx: 0, vy: 0,
    biereGesoffen: 0, verschuettet: 0, durst: 100, blase: 0, maxBlase: 15,
    isDrinking: false, drinkTimer: 0, doenerPowerActive: false, doenerTimer: 0, facing: 'right'
};

const joystick = { startX: 120, startY: 850, currentX: 120, currentY: 850, active: false, maxRadius: 50, vx: 0, vy: 0 };
const drinkButton = { x: 420, y: 850, radius: 45 };

const audio = {
    bgMenu: new Audio("backgroundmenu.mp3"), bgBierloch: new Audio("backgroundbierloch.mp3"), bgGito: new Audio("backgroundgito.mp3"),
    ruelps: new Audio("ruelps.mp3"), klirr: new Audio("klirr.mp3"), urin: new Audio("urin.mp3")
};
audio.bgMenu.loop = true; audio.bgBierloch.loop = true; audio.bgGito.loop = true;

const imgJustus = new Image(); imgJustus.src = 'justus.png';
const imgJustusSauft = new Image(); imgJustusSauft.src = 'justussauft.png';

let assetsLoaded = { justus: false, justusSauft: false };
imgJustus.onload = () => assetsLoaded.justus = true;
imgJustusSauft.onload = () => assetsLoaded.justusSauft = true;

const colorSchemes = [
    { floor: "#3a3a3a", bar: "#4a2e1b", stage: "#2b1b3d" },
    { floor: "#2a3a2a", bar: "#3b3b1b", stage: "#3d1b1b" },
    { floor: "#2a2a3a", bar: "#1b3b3b", stage: "#1b3d1b" },
    { floor: "#3a2a3a", bar: "#3b1b3b", stage: "#3d3d1b" }
];

function switchMusic(target) {
    [audio.bgMenu, audio.bgBierloch, audio.bgGito].forEach(track => { if(track !== target) track.pause(); });
    target.play().catch(e => console.log("Audio-Autoplay-Blocker:", e));
}

async function loadHighscores() {
    try {
        const snap = await db.collection("highscores").orderBy("score", "desc").limit(10).get();
        highscores = [];
        snap.forEach(doc => highscores.push(doc.data()));
    } catch (e) {
        console.error("Fehler beim Laden der Highscores:", e);
    }
}
loadHighscores();
// ==========================================
// GAME.JS - BLOCK 2: INPUTS & INTERACTION
// ==========================================

window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (gameState === "PLAYING" && e.key === " ") triggerDrinking();
    if (gameState === "HIGHSCORE_INPUT") handleNameInput(e);
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

function triggerDrinking() {
    if (!player.isDrinking && (player.durst > 15 || player.doenerPowerActive)) {
        player.isDrinking = true;
        player.drinkTimer = 60; // 1 Sekunde bei 60 FPS
        if (!player.doenerPowerActive) player.durst -= 15;
    }
}

function handleNameInput(e) {
    if (e.key === "Enter" && enteredName.trim().length > 0) {
        saveHighscore(enteredName.trim(), player.biereGesoffen);
    } else if (e.key === "Backspace") {
        enteredName = enteredName.slice(0, -1);
    } else if (e.key.length === 1 && enteredName.length < 10) {
        enteredName += e.key.toUpperCase();
    }
}

async function saveHighscore(name, score) {
    gameState = "MENU";
    switchMusic(audio.bgMenu);
    try {
        await db.collection("highscores").add({ name: name, score: score, date: new Date() });
        loadHighscores();
    } catch (e) { console.error(e); }
}

function getTouchPos(e) {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    return {
        x: (touch.clientX - rect.left) * (canvas.width / rect.width),
        y: (touch.clientY - rect.top) * (canvas.height / rect.height)
    };
}

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const pos = getTouchPos(e);
    
    if (gameState === "MENU") {
        if (pos.x > 170 && pos.x < 370 && pos.y > 400 && pos.y < 460) startGame();
        if (pos.x > 170 && pos.x < 370 && pos.y > 490 && pos.y < 550) gameState = "RULES";
    } else if (gameState === "RULES") {
        if (pos.x > 170 && pos.x < 370 && pos.y > 750 && pos.y < 810) gameState = "MENU";
    } else if (gameState === "PLAYING") {
        let distToJoystick = Math.hypot(pos.x - joystick.startX, pos.y - joystick.startY);
        if (distToJoystick < joystick.maxRadius + 20) {
            joystick.active = true;
            updateJoystick(pos);
        }
        let distToBtn = Math.hypot(pos.x - drinkButton.x, pos.y - drinkButton.radius);
        if (distToBtn < drinkButton.radius + 20) triggerDrinking();
    } else if (gameState === "GAMEOVER") {
        if (checkTop10(player.biereGesoffen)) {
            enteredName = "";
            gameState = "HIGHSCORE_INPUT";
        } else {
            gameState = "MENU";
            switchMusic(audio.bgMenu);
        }
    }
});

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (gameState === "PLAYING" && joystick.active) {
        updateJoystick(getTouchPos(e));
    }
});

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    joystick.active = false;
    joystick.vx = 0; joystick.vy = 0;
    joystick.currentX = joystick.startX; joystick.currentY = joystick.startY;
});

// Desktop Maus-Klicks für Testzwecke mappen
canvas.addEventListener('mousedown', e => {
    const rect = canvas.getBoundingClientRect();
    const pos = { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) };
    if (gameState === "MENU") {
        if (pos.x > 170 && pos.x < 370 && pos.y > 400 && pos.y < 460) startGame();
        if (pos.x > 170 && pos.x < 370 && pos.y > 490 && pos.y < 550) gameState = "RULES";
    } else if (gameState === "RULES" && pos.x > 170 && pos.x < 370 && pos.y > 750 && pos.y < 810) {
        gameState = "MENU";
    } else if (gameState === "GAMEOVER") {
        if (checkTop10(player.biereGesoffen)) { enteredName = ""; gameState = "HIGHSCORE_INPUT"; }
        else { gameState = "MENU"; switchMusic(audio.bgMenu); }
    }
});

function updateJoystick(pos) {
    let dx = pos.x - joystick.startX;
    let dy = pos.y - joystick.startY;
    let dist = Math.hypot(dx, dy);
    if (dist > joystick.maxRadius) {
        dx = (dx / dist) * joystick.maxRadius;
        dy = (dy / dist) * joystick.maxRadius;
    }
    joystick.currentX = joystick.startX + dx;
    joystick.currentY = joystick.startY + dy;
    joystick.vx = dx / joystick.maxRadius;
    joystick.vy = dy / joystick.maxRadius;
}
// ==========================================
// GAME.JS - BLOCK 3: GAMEPLAY LOGIC & PHYSICS
// ==========================================

function startGame() {
    gameState = "PLAYING";
    switchMusic(audio.bgBierloch);
    player.biereGesoffen = 0; player.verschuettet = 0; player.durst = 100; player.blase = 0;
    player.x = 240; player.y = 500; player.vx = 0; player.vy = 0;
    beers = []; giTos = []; doeners = []; snacks = []; pfuetzen = [];
    gitoRoundActive = false; nextGitoRoundTimer = 7200;
}

function updateGame() {
    beerSpawnTimer--;
    if (beerSpawnTimer <= 0) {
        let count = 3 + Math.floor(Math.random() * 6); // 3-8 pro Sekunde
        beerSpawnTimer = 60;
        for(let i=0; i<count; i++) {
            beers.push({
                x: canvas.width / 2, y: 70,
                vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 4,
                width: 20, height: 26, gravity: 0.12
            });
        }
    }

    if (!gitoRoundActive) {
        nextGitoRoundTimer--;
        if (nextGitoRoundTimer <= 0) {
            gitoRoundActive = true; gitoRoundTimer = 480; // 8 Sek
            switchMusic(audio.bgGito);
        }
    } else {
        gitoRoundTimer--;
        if (gitoRoundTimer % 8 === 0) {
            giTos.push({ x: canvas.width - 50, y: 150 + Math.random() * 400, vx: -(4 + Math.random() * 5), vy: (Math.random() - 0.5) * 3, width: 22, height: 22 });
        }
        if (gitoRoundTimer <= 0) { gitoRoundActive = false; nextGitoRoundTimer = (120 + Math.random() * 120) * 60; switchMusic(audio.bgBierloch); }
    }

    nextDoenerTimer--;
    if (nextDoenerTimer <= 0) {
        doeners.push({ x: canvas.width/2, y: 70, vx: (Math.random() - 0.5) * 4, vy: 1, width: 30, height: 20, gravity: 0.05 });
        nextDoenerTimer = (90 + Math.random() * 60) * 60;
    }

    if (Math.random() < 0.003 && snacks.length < 3) {
        snacks.push({ x: canvas.width - 100 + Math.random() * 60, y: 160 + Math.random() * 300, width: 16, height: 16 });
    }

    if (player.isDrinking) { player.drinkTimer--; if (player.drinkTimer <= 0) player.isDrinking = false; }
    if (player.doenerPowerActive) { player.doenerTimer--; if (player.doenerTimer <= 0) player.doenerPowerActive = false; }
    if (!player.doenerPowerActive && player.durst < 100) player.durst += 0.04;

    let mx = 0, my = 0;
    if (keys['w'] || keys['W']) my = -1; if (keys['s'] || keys['S']) my = 1;
    if (keys['a'] || keys['A']) mx = -1; if (keys['d'] || keys['D']) mx = 1;
    if (joystick.active) { mx = joystick.vx; my = joystick.vy; }

    let alc = Math.min(player.biereGesoffen / 200, 1.0);
    let speed = player.speed * (player.blase >= player.maxBlase ? 0.4 : 1.0);
    let swayX = alc > 0 ? Math.sin(Date.now() * 0.004) * alc * 3 : 0;
    let swayY = alc > 0 ? Math.cos(Date.now() * 0.002) * alc * 1.5 : 0;

    player.vx += ((mx * speed + swayX) - player.vx) * (0.15 - alc * 0.1);
    player.vy += ((my * speed + swayY) - player.vy) * (0.15 - alc * 0.1);
    player.x += player.vx; player.y += player.vy;

    if (mx > 0.1) player.facing = 'right'; if (mx < -0.1) player.facing = 'left';

    if (player.x < 0) player.x = 0; if (player.x > canvas.width - player.width) player.x = canvas.width - player.width;
    if (player.y < 120) player.y = 120; if (player.y > canvas.height - 300) player.y = canvas.height - 300;

    checkCollisions();
}

function checkCollisions() {
    if (player.x < 100 && player.blase > 0) {
        if (audio.urin.paused) audio.urin.play().catch(e => {});
        player.blase -= 0.1;
    } else { audio.urin.pause(); }

    let pR = { x: player.x, y: player.y, w: player.width, h: player.height };
    let hit = (r1, r2) => r1.x < r2.x + r2.width && r1.x + r1.w > r2.x && r1.y < r2.y + r2.height && r1.y + r1.h > r2.y;

    beers.forEach((b, i) => {
        b.vy += b.gravity; b.x += b.vx; b.y += b.vy;
        if (hit(pR, b)) {
            if (player.isDrinking && player.blase < player.maxBlase) { player.biereGesoffen++; player.blase++; audio.ruelps.play().catch(e=>{}); checkMilestone(); }
            else { player.verschuettet++; audio.klirr.play().catch(e=>{}); pfuetzen.push({ x: b.x, y: b.y, t: 180 }); if (player.verschuettet >= 100) gameOver(); }
            beers.splice(i, 1);
        }
    });

    giTos.forEach((g, i) => {
        g.x += g.vx; g.y += g.vy;
        if (hit(pR, g)) {
            if (player.isDrinking && player.blase < player.maxBlase) { player.biereGesoffen += 3; player.blase++; audio.ruelps.play().catch(e=>{}); checkMilestone(); }
            else { player.verschuettet++; audio.klirr.play().catch(e=>{}); pfuetzen.push({ x: g.x, y: g.y, t: 180 }); if (player.verschuettet >= 100) gameOver(); }
            giTos.splice(i, 1);
        }
    });

    doeners.forEach((d, i) => {
        d.vy += d.gravity; d.x += d.vx; d.y += d.vy;
        if (hit(pR, d)) { if (player.isDrinking) { player.doenerPowerActive = true; player.doenerTimer = 600; player.durst = 100; audio.ruelps.play().catch(e=>{}); } doeners.splice(i, 1); }
    });

    snacks.forEach((s, i) => { if (hit(pR, s)) { player.durst = Math.min(player.durst + 25, 100); snacks.splice(i, 1); } });
}

function checkMilestone() {
    if (player.biereGesoffen > 0 && player.biereGesoffen % 100 === 0) {
        milestoneTimer = 90; colorShiftIdx = (colorShiftIdx + 1) % colorSchemes.length;
    }
}

function gameOver() { gameState = "GAMEOVER"; }
function checkTop10(score) { if (highscores.length < 10) return true; return score > highscores[highscores.length - 1].score; }
// --- TEIL 4: RENDERING, UI & GAME LOOP ---

function render() {
    // 1. Hintergrund je nach Meilenstein leicht einfärben
    let colors = ["#222", "#2a1f3d", "#1f332a", "#3d361f", "#3d1f1f"];
    ctx.fillStyle = colors[colorShiftIdx % colors.length];
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. KLO-BEREICH (Links, X: 0-140)
    ctx.fillStyle = "#333"; ctx.fillRect(0, 120, 140, 660);
    // Schachbrett-Fliesenmuster zeichnen
    ctx.fillStyle = "#444";
    for(let y=120; y<780; y+=20) {
        for(let x=0; x<140; x+=20) { if((x+y)/20 % 2 === 0) ctx.fillRect(x, y, 20, 20); }
    }
    // Ed Sheeran Platzhalter
    ctx.fillStyle = "#e67e22"; ctx.fillRect(40, 300, 40, 70);
    ctx.fillStyle = "#fff"; ctx.font = "10px sans-serif"; ctx.fillText("Ed Sheeran", 35, 290);

    // 3. BAR-BEREICH (Rechts, X: 400-540)
    ctx.fillStyle = "#2c3e50"; ctx.fillRect(400, 120, 140, 660);
    ctx.fillStyle = "#7f8c8d"; ctx.fillRect(400, 120, 10, 660); // Tresen
    ctx.fillStyle = "#fff"; ctx.fillText("BAR (GiTo)", 440, 150);

    // 4. BAND-BÜHNE (Oben, Y: 0-120)
    ctx.fillStyle = "#111"; ctx.fillRect(0, 0, canvas.width, 120);
    ctx.fillStyle = "#f1c40f"; // Scheinwerfer-Effekt beim Meilenstein
    if (milestoneEffectActive && Math.floor(Date.now()/100)%2===0) ctx.fillRect(0,0,canvas.width,120);
    
    // Animierte Bandmitglieder (wackeln hoch/runter)
    let bandY = 50 + Math.sin(Date.now() * 0.01) * 5;
    ctx.fillStyle = "#9b59b6"; ctx.fillRect(120, bandY, 30, 50); // Keyboarder links
    ctx.fillStyle = "#e74c3c"; ctx.fillRect(255, bandY - 5, 30, 55); // Drummer Mitte
    ctx.fillStyle = "#3498db"; ctx.fillRect(390, bandY, 30, 50); // Bassist rechts
    ctx.fillStyle = "#fff"; ctx.fillText("DIE BAND", 245, 30);

    // 5. RENDERE SNACKS & PFÜTZEN
    ctx.fillStyle = "#e67e22"; snacks.forEach(s => ctx.fillRect(s.x, s.y, s.width, s.height)); // Snacks
    ctx.fillStyle = "#f39c12"; pfuetzen.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI*2); ctx.fill(); });

    // 6. RENDERE BIERE, GITOS & DÖNER
    beers.forEach(b => { ctx.fillStyle = "#f1c40f"; ctx.fillRect(b.x, b.y, b.width, b.height); ctx.fillStyle="#fff"; ctx.fillRect(b.x, b.y, b.width, 8); });
    giTos.forEach(g => { ctx.fillStyle = "#2ecc71"; ctx.fillRect(g.x, g.y, g.width, g.height); ctx.fillStyle="#fff"; ctx.fillRect(g.x+4, g.y+4, 6, 6); });
    doeners.forEach(d => { ctx.fillStyle = "#d35400"; ctx.fillRect(d.x, d.y, d.width, d.height); });

    // 7. SPIELFIGUR (JUSTUS) ZEICHNEN
    ctx.save();
    let currentImg = player.isDrinking ? imgJustusSauft : imgJustus;
    // Falls das Bild geladen ist, nutzen wir es, ansonsten ein farbiges Rechteck
    if (currentImg.complete && currentImg.naturalWidth !== 0) {
        if (player.facing === 'left') {
            ctx.translate(player.x + player.width, player.y);
            ctx.scale(-1, 1);
            ctx.drawImage(currentImg, 0, 0, player.width, player.height);
        } else {
            ctx.drawImage(currentImg, player.x, player.y, player.width, player.height);
        }
    } else {
        ctx.fillStyle = player.isDrinking ? "#e74c3c" : "#34495e";
        ctx.fillRect(player.x, player.y, player.width, player.height);
        ctx.fillStyle = "#fff"; ctx.fillText(player.isDrinking ? "SAUFT" : "JUSTUS", player.x+5, player.y+30);
    }
    ctx.restore();

    // 8. OBERES IN-GAME UI (Punkte, Ressourcen)
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)"; ctx.fillRect(0, 120, canvas.width, 40);
    ctx.fillStyle = "#fff"; ctx.font = "14px sans-serif";
    ctx.fillText(`Biere: ${player.biereGesoffen}/1000`, 10, 145);
    ctx.fillText(`Verschüttet: ${player.verschuettet}/100`, 140, 145);
    
    // Statusbalken für Durst & Blase
    ctx.fillStyle = "#555"; ctx.fillRect(290, 135, 100, 10);
    ctx.fillStyle = player.doenerPowerActive ? "#e67e22" : "#3498db"; 
    ctx.fillRect(290, 135, player.durst, 10);
    ctx.fillText("Durst", 250, 145);

    ctx.fillStyle = "#555"; ctx.fillRect(450, 135, 80, 10);
    ctx.fillStyle = (player.blase >= player.maxBlase) ? "#e74c3c" : "#f1c40f";
    ctx.fillRect(450, 135, (player.blase / player.maxBlase) * 80, 10);
    ctx.fillText("Blase", 410, 145);

    // Döner Powerup Overlay-Meldung
    if (player.doenerPowerActive) {
        ctx.fillStyle = "#e67e22"; ctx.font = "bold 16px sans-serif";
        ctx.fillText("DÖNER POWER: UNENDLICH DURST!", 150, 190);
    }

    // GiTo-Runden Countdown Warnung
    if (!gitoRoundActive && nextGitoRoundTimer < 300) {
        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 20px sans-serif";
        ctx.fillText(`GiTo-RUNDE IN ${Math.ceil(nextGitoRoundTimer/60)}...`, 180, 230);
    }

    // 9. UNTERES UI STEUERUNGSELEMENTE (Joystick & Trink-Button)
    ctx.fillStyle = "#111"; ctx.fillRect(0, 780, canvas.width, 180);

    // Joystick Basis
    ctx.beginPath(); ctx.arc(joystick.startX, joystick.startY, joystick.maxRadius, 0, Math.PI*2);
    ctx.fillStyle = "#333"; ctx.fill(); ctx.strokeStyle = "#555"; ctx.lineWidth = 3; ctx.stroke();
    // Joystick Knopf
    ctx.beginPath(); ctx.arc(joystick.currentX, joystick.currentY, 25, 0, Math.PI*2);
    ctx.fillStyle = "#e74c3c"; ctx.fill();

    // Trink-Knopf
    ctx.beginPath(); ctx.arc(drinkButton.x, drinkButton.y, drinkButton.radius, 0, Math.PI*2);
    ctx.fillStyle = player.isDrinking ? "#2ecc71" : "#d35400"; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = "#fff"; ctx.font = "bold 16px sans-serif"; ctx.fillText("TRINKEN", drinkButton.x - 34, drinkButton.y + 5);
}

function gameLoop() {
    if (gameState === "PLAYING") {
        updateGame();
        checkCollisions();
        render();
        requestAnimationFrame(gameLoop);
    }
}

// Initialisiere das Hauptmenü beim Laden der Seite
window.onload = () => {
    initMenuAudio();
    drawMenu();
};
