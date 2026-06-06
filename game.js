// ==========================================
// GAME.JS - BLOCK 1: SETUP & REINPUTS
// ==========================================

// Firebase Initialisierung
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

// Spielzustände & Entitäten
let gameState = "MENU"; 
let highscores = [];
let keys = {};
let beers = [], giTos = [], doeners = [], snacks = [], pfuetzen = [];
let beerSpawnTimer = 0, nextGitoRoundTimer = 1200, gitoRoundTimer = 0, gitoRoundActive = false;
let nextDoenerTimer = 7200, milestoneTimer = 0, colorShiftIdx = 0;
let inputName = "";

const player = {
    x: 230, y: 500, width: 60, height: 90, speed: 5, vx: 0, vy: 0,
    biereGesoffen: 0, verschuettet: 0, durst: 100, blase: 0, maxBlase: 15,
    isDrinking: false, drinkTimer: 0, doenerPowerActive: false, doenerTimer: 0, facing: 'right'
};

const joystick = { startX: 120, startY: 840, currentX: 120, currentY: 840, active: false, maxRadius: 50, vx: 0, vy: 0 };
const drinkButton = { x: 380, y: 790, radius: 45 };

// Audio-Setup
const audio = {
    bgMenu: new Audio("backgroundmenu.mp3"), bgBierloch: new Audio("backgroundbierloch.mp3"), bgGito: new Audio("backgroundgito.mp3"),
    ruelps: new Audio("ruelps.mp3"), klirr: new Audio("klirr.mp3"), urin: new Audio("urin.mp3")
};
audio.bgMenu.loop = true; audio.bgBierloch.loop = true; audio.bgGito.loop = true;

// Assets (Laden im Hintergrund, Fallback-Pixel-Art integriert)
const imgJustus = new Image(); imgJustus.src = 'justus.png';
const imgJustusSauft = new Image(); imgJustusSauft.src = 'justussauft.png';

// --- EINGABE-EVENTS (KEYBOARD & TOUCH) ---
window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (e.key === ' ' && gameState === "PLAYING") activateTrinkmodus();
});
window.addEventListener('keyup', e => { keys[e.key] = false; });

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    for (let t of e.touches) {
        let tx = (t.clientX - rect.left) * (canvas.width / rect.width);
        let ty = (t.clientY - rect.top) * (canvas.height / rect.height);
        
        if (gameState === "MENU") {
            if (tx > 170 && tx < 370 && ty > 400 && ty < 460) startGame();
            if (tx > 170 && tx < 370 && ty > 490 && ty < 550) gameState = "RULES";
        } else if (gameState === "RULES" && tx > 170 && tx < 370 && ty > 750 && ty < 810) {
            gameState = "MENU";
        } else if (gameState === "PLAYING") {
            let distToJoystick = Math.hypot(tx - joystick.startX, ty - joystick.startY);
            if (distToJoystick < 70) joystick.active = true;
            let distToDrink = Math.hypot(tx - drinkButton.x, ty - drinkButton.y);
            if (distToDrink < drinkButton.radius) activateTrinkmodus();
        }
    }
});

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!joystick.active || gameState !== "PLAYING") return;
    const rect = canvas.getBoundingClientRect();
    const t = e.touches[0];
    let tx = (t.clientX - rect.left) * (canvas.width / rect.width);
    let ty = (t.clientY - rect.top) * (canvas.height / rect.height);
    
    let dx = tx - joystick.startX;
    let dy = ty - joystick.startY;
    let dist = Math.hypot(dx, dy);
    
    if (dist > joystick.maxRadius) {
        dx = (dx / dist) * joystick.maxRadius;
        dy = (dy / dist) * joystick.maxRadius;
    }
    joystick.currentX = joystick.startX + dx;
    joystick.currentY = joystick.startY + dy;
    joystick.vx = dx / joystick.maxRadius;
    joystick.vy = dy / joystick.maxRadius;
});

canvas.addEventListener('touchend', () => {
    joystick.active = false;
    joystick.currentX = joystick.startX;
    joystick.currentY = joystick.startY;
    joystick.vx = 0; joystick.vy = 0;
});

// Klick-Events für den Desktop-PC
canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    let mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    let my = (e.clientY - rect.top) * (canvas.height / rect.height);
    
    if (gameState === "MENU") {
        if (mx > 170 && mx < 370 && my > 400 && my < 460) startGame();
        if (mx > 170 && mx < 370 && my > 490 && my < 550) gameState = "RULES";
    } else if (gameState === "RULES" && mx > 170 && mx < 370 && my > 750 && my < 810) {
        gameState = "MENU";
    }
});

function activateTrinkmodus() {
    if (!player.isDrinking && (player.durst >= 15 || player.doenerPowerActive)) {
        player.isDrinking = true;
        player.drinkTimer = 60; // 1 Sekunde bei 60 FPS
        if (!player.doenerPowerActive) player.durst -= 15;
    }
}
// ==========================================
// GAME.JS - BLOCK 2: GAME LOOP & LOGIK
// ==========================================

function update() {
    if (gameState !== "PLAYING") return;

    // Spawning-Raten (3 bis 8 Biere pro Sekunde)
    beerSpawnTimer--;
    if (beerSpawnTimer <= 0) {
        beers.push({ x: canvas.width / 2, y: 80, vx: (Math.random() - 0.5) * 6, vy: -2 - Math.random() * 3, w: 24, h: 32, g: 0.15 });
        beerSpawnTimer = 7 + Math.floor(Math.random() * 13);
    }
    
    // Gito-Runde steuern
    if (!gitoRoundActive) {
        nextGitoRoundTimer--;
        if (nextGitoRoundTimer <= 0) {
            gitoRoundActive = true; gitoRoundTimer = 480;
            audio.bgBierloch.pause(); audio.bgGito.currentTime = 0; audio.bgGito.play().catch(e=>e);
        }
    } else {
        gitoRoundTimer--;
        if (gitoRoundTimer % 10 === 0) {
            giTos.push({ x: canvas.width - 60, y: 150 + Math.random() * 400, vx: -(3 + Math.random() * 5), vy: (Math.random() - 0.5) * 4, w: 24, h: 28 });
        }
        if (gitoRoundTimer <= 0) {
            gitoRoundActive = false;
            audio.bgGito.pause(); audio.bgBierloch.currentTime = 0; audio.bgBierloch.play().catch(e=>e);
            nextGitoRoundTimer = (120 + Math.floor(Math.random() * 120)) * 60;
        }
    }

    // Döner & Snacks Spawning
    nextDoenerTimer--;
    if (nextDoenerTimer <= 0) {
        doeners.push({ x: canvas.width/2, y: 80, vx: (Math.random()-0.5)*4, vy: 1, w: 30, h: 20, g: 0.05 });
        nextDoenerTimer = (90 + Math.floor(Math.random() * 60)) * 60;
    }
    if (Math.random() < 0.005 && snacks.length < 3) {
        snacks.push({ x: canvas.width - 100 + Math.random() * 60, y: 200 + Math.random() * 300, w: 20, h: 20 });
    }

    // Timer reduzieren
    if (player.isDrinking) { player.drinkTimer--; if (player.drinkTimer <= 0) player.isDrinking = false; }
    if (player.doenerPowerActive) { player.doenerTimer--; if (player.doenerTimer <= 0) player.doenerPowerActive = false; }
    if (!player.doenerPowerActive && player.durst < 100) player.durst += 0.03;

    // --- ALKOHOL-STEUERUNG (SCHWANKEN & TRÄGHEIT) ---
    let moveX = keys['d'] || keys['D'] ? 1 : (keys['a'] || keys['A'] ? -1 : 0);
    let moveY = keys['s'] || keys['S'] ? 1 : (keys['w'] || keys['W'] ? -1 : 0);
    if (joystick.active) { moveX = joystick.vx; moveY = joystick.vy; }

    let alc = Math.min(player.biereGesoffen / 200, 1.0);
    let speed = player.speed * (player.blase >= player.maxBlase ? 0.4 : 1.0);
    
    let swayX = alc > 0 ? Math.sin(Date.now() * 0.003) * alc * 3 : 0;
    let swayY = alc > 0 ? Math.cos(Date.now() * 0.004) * alc * 2 : 0;

    let targetVx = moveX * speed + swayX;
    let targetVy = moveY * speed + swayY;
    let ease = 0.15 - (alc * 0.12);

    player.vx += (targetVx - player.vx) * ease;
    player.vy += (targetVy - player.vy) * ease;
    player.x += player.vx; player.y += player.vy;

    if (moveX > 0.1) player.facing = 'right'; if (moveX < -0.1) player.facing = 'left';

    // Grenzen setzen (Klo und Bar begehbar)
    player.x = Math.max(0, Math.min(canvas.width - player.width, player.x));
    player.y = Math.max(120, Math.min(canvas.height - 180 - player.height, player.y));

    // --- KOLLISIONEN & INTERAKTIONEN ---
    // Klobereich links (X < 120)
    if (player.x < 100 && player.blase > 0) {
        if (audio.urin.paused) audio.urin.play().catch(e=>e);
        player.blase -= 0.1;
    } else {
        audio.urin.pause();
    }

    const checkHit = (p, o) => p.x < o.x + o.w && p.x + p.width > o.x && p.y < o.y + o.h && p.y + p.height > o.y;

    // Biere kollidieren
    for(let i=beers.length-1; i>=0; i--) {
        let b = beers[i]; b.vy += b.g; b.x += b.vx; b.y += b.vy;
        if (checkHit(player, b)) {
            if (player.isDrinking && player.blase < player.maxBlase) {
                player.biereGesoffen++; player.blase++;
                audio.ruelps.currentTime = 0; audio.ruelps.play().catch(e=>e);
                if (player.biereGesoffen % 100 === 0) { milestoneTimer = 120; colorShiftIdx++; }
            } else {
                player.verschuettet++; audio.klirr.currentTime = 0; audio.klirr.play().catch(e=>e);
                pfuetzen.push({ x: b.x, y: Math.min(b.y, canvas.height-190), t: 300 });
                if (player.verschuettet >= 100) endGame();
            }
            beers.splice(i, 1);
        } else if (b.y > canvas.height - 180) beers.splice(i, 1);
    }

    // GiTos kollidieren
    for(let i=giTos.length-1; i>=0; i--) {
        let g = giTos[i]; g.x += g.vx; g.y += g.vy;
        if (checkHit(player, g)) {
            if (player.isDrinking && player.blase < player.maxBlase) {
                player.biereGesoffen += 3; player.blase++;
                audio.ruelps.currentTime = 0; audio.ruelps.play().catch(e=>e);
            } else {
                player.verschuettet++; audio.klirr.currentTime = 0; audio.klirr.play().catch(e=>e);
                pfuetzen.push({ x: g.x, y: g.y, t: 300 });
                if (player.verschuettet >= 100) endGame();
            }
            giTos.splice(i, 1);
        } else if (g.x < 0) giTos.splice(i, 1);
    }

    // Döner & Snacks einsammeln
    for(let i=doeners.length-1; i>=0; i--) {
        let d = doeners[i]; d.vy += d.g; d.x += d.vx; d.y += d.vy;
        if (checkHit(player, d)) {
            if (player.isDrinking) { player.doenerPowerActive = true; player.doenerTimer = 600; player.durst = 100; }
            doeners.splice(i, 1);
        } else if (d.y > canvas.height-180) doeners.splice(i, 1);
    }
    for(let i=snacks.length-1; i>=0; i--) {
        if (checkHit(player, {x: snacks[i].x, y: snacks[i].y, w: 20, h: 20})) {
            player.durst = Math.min(player.durst + 30, 100); snacks.splice(i, 1);
        }
    }
}
// ==========================================
// GAME.JS - BLOCK 3: RENDERING & CORE LOOP
// ==========================================

const colorThemes = [
    { floor: "#333", bar: "#4a2e1b", toilet: "#555" },
    { floor: "#2c3e50", bar: "#d35400", toilet: "#7f8c8d" },
    { floor: "#27ae60", bar: "#8e44ad", toilet: "#bdc3c7" },
    { floor: "#130f40", bar: "#951555", toilet: "#535c68" }
];

function draw() {
    // Canvas leeren
    ctx.fillStyle = "#111"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    let theme = colorThemes[colorShiftIdx % colorThemes.length];

    if (gameState === "MENU") {
        ctx.fillStyle = "#fff"; ctx.font = "bold 26px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("MÄDCHENNAME MADEMANN", canvas.width/2, 180);
        ctx.fillStyle = "#ffcc00"; ctx.font = "bold 20px sans-serif";
        ctx.fillText("DIE NACHT DER 1000 BIERE", canvas.width/2, 220);

        // Buttons zeichnen
        ctx.fillStyle = "#27ae60"; ctx.fillRect(170, 400, 200, 60);
        ctx.fillStyle = "#2980b9"; ctx.fillRect(170, 490, 200, 60);
        ctx.fillStyle = "#fff"; ctx.font = "18px sans-serif";
        ctx.fillText("SPIEL STARTEN", canvas.width/2, 435);
        ctx.fillText("SPIELREGELN", canvas.width/2, 525);

        // Dekorationen: Bierkrüge zeichnen
        ctx.fillStyle = "#ffcc00"; ctx.fillRect(80, 650, 40, 50); ctx.fillStyle = "#fff"; ctx.fillRect(80, 640, 40, 10);
        ctx.fillStyle = "#666"; ctx.fillRect(115, 660, 10, 30);
        ctx.fillStyle = "#777"; ctx.fillRect(400, 680, 50, 20); // Umgekipptes Bier

        // Highscores anzeigen
        ctx.fillStyle = "#aaa"; ctx.font = "14px monospace"; ctx.fillText("--- GLOBAL ARCADE TOP 5 ---", canvas.width/2, 740);
        highscores.slice(0, 5).forEach((h, i) => {
            ctx.fillText(`${i+1}. ${h.name} : ${h.score} Biere`, canvas.width/2, 770 + i * 22);
        });

    } else if (gameState === "RULES") {
        ctx.fillStyle = "#fff"; ctx.font = "24px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("SPIELREGELN", canvas.width/2, 100);
        ctx.font = "15px sans-serif"; ctx.textAlign = "left";
        let rulesText = [
            "- Drücke LEERTASTE oder roten Button für TRINKMODUS.",
            "- Fange fallende Biere (1 Pkt) & GiTos (3 Pkt) im Trinkmodus.",
            "- Ohne Trinkmodus verkippen Getränke (Max 100 erlaubt!).",
            "- Snacks an der Bar füllen deinen DURST auf.",
            "- Döner geben dir 10 Sek unendlichen Durst.",
            "- Bei VOLLER BLASE musst du ganz links aufs Klo zu Ed Sheeran!",
            "- Je mehr du trinkst, desto betrunkener schwankst du."
        ];
        rulesText.forEach((line, idx) => ctx.fillText(line, 40, 180 + idx * 40));
        
        ctx.fillStyle = "#c0392b"; ctx.fillRect(170, 750, 200, 60);
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.fillText("ZURÜCK", canvas.width/2, 785);

    } else if (gameState === "PLAYING" || gameState === "GAMEOVER") {
        // --- SPIELFELD ZEICHNEN ---
        ctx.fillStyle = theme.floor; ctx.fillRect(0, 120, canvas.width, canvas.height - 300);
        
        // Klobereich links (Schachbrettmuster)
        ctx.fillStyle = theme.toilet; ctx.fillRect(0, 120, 120, canvas.height - 300);
        ctx.fillStyle = "#444";
        for(let y=120; y<canvas.height-180; y+=30) { ctx.fillRect((y%60===0?0:15), y, 15, 15); }
        ctx.fillStyle = "#fff"; ctx.font = "12px sans-serif"; ctx.fillText("KLO (Ed)", 40, 150);

        // Barbereich rechts
        ctx.fillStyle = theme.bar; ctx.fillRect(canvas.width - 100, 120, 100, canvas.height - 300);
        ctx.fillStyle = "#ffcc00"; ctx.fillText("BAR (GiTo)", canvas.width - 50, 150);

        // Bandbühne oben
        ctx.fillStyle = "#222"; ctx.fillRect(0, 0, canvas.width, 120);
        ctx.fillStyle = "#9b59b6"; ctx.fillRect(canvas.width/2 - 80, 20, 160, 80); // Bühne
        
        // Animierte Bandmitglieder (Pixel-Boxen wackeln im Takt)
        let bounce = Math.sin(Date.now() * 0.007) * 5;
        ctx.fillStyle = "#f1c40f"; ctx.fillRect(canvas.width/2 - 15, 40 + bounce, 30, 40); // Drummer
        ctx.fillStyle = "#e74c3c"; ctx.fillRect(canvas.width/2 - 60, 35 - bounce, 25, 45); // Keyboarder
        ctx.fillStyle = "#3498db"; ctx.fillRect(canvas.width/2 + 35, 35 - bounce, 25, 45); // Bassist

        // Pfützen zeichnen
        ctx.fillStyle = "rgba(230, 126, 34, 0.6)";
        pfuetzen.forEach(p => { ctx.beginPath(); ctx.ellipse(p.x, p.y, 20, 8, 0, 0, Math.PI*2); ctx.fill(); });

        // Snacks zeichnen
        ctx.fillStyle = "#e67e22"; snacks.forEach(s => ctx.fillRect(s.x, s.y, 16, 16));

        // Getränke & Döner zeichnen
        beers.forEach(b => { ctx.fillStyle = "#f39c12"; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = "#fff"; ctx.fillRect(b.x, b.y, b.w, 6); });
        giTos.forEach(g => { ctx.fillStyle = "#2ecc71"; ctx.fillRect(g.x, g.y, g.w, g.h); ctx.fillStyle = "#fff"; ctx.fillRect(g.x+4, g.y+4, 6, 6); });
        doeners.forEach(d => { ctx.fillStyle = "#d35400"; ctx.fillRect(d.x, d.y, d.w, d.h); });

        // --- SPIELERSCHALTUNG ---
        ctx.save();
        let centerPlayerX = player.x + player.width/2;
        ctx.translate(centerPlayerX, player.y + player.height/2);
        if (player.facing === 'left') ctx.scale(-1, 1);

        let currentImg = player.isDrinking ? imgJustusSauft : imgJustus;
        if (currentImg.complete && currentImg.naturalWidth !== 0) {
            ctx.drawImage(currentImg, -player.width/2, -player.height/2, player.width, player.height);
        } else {
            // Ausweichgrafik falls PNGs fehlen
            ctx.fillStyle = player.isDrinking ? "#e74c3c" : "#34495e";
            ctx.fillRect(-player.width/2, -player.height/2, player.width, player.height);
            ctx.fillStyle = "#f1c40f"; ctx.fillRect(player.isDrinking ? -10 : 10, -30, 15, 15); // Kopf-Box
        }
        ctx.restore();

        // --- UI OVERLAY (OBEN) ---
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 120, canvas.width, 40);
        ctx.fillStyle = "#fff"; ctx.font = "14px monospace"; ctx.textAlign = "left";
        ctx.fillText(`Gesoffen: ${player.biereGesoffen}`, 15, 145);
        ctx.fillStyle = "#e74c3c"; ctx.fillText(`Verschüttet: ${player.verschuettet}/100`, 160, 145);

        // Balken für Ressourcen
        ctx.fillStyle = "#555"; ctx.fillRect(360, 130, 70, 12);
        ctx.fillStyle = player.doenerPowerActive ? "#f1c40f" : "#3498db";
        ctx.fillRect(360, 130, player.durst * 0.7, 12);
        
        ctx.fillStyle = "#555"; ctx.fillRect(450, 130, 70, 12);
        ctx.fillStyle = "#2ecc71"; ctx.fillRect(450, 130, (player.blase / player.maxBlase) * 70, 12);

        // --- MOBILE HANDY-STEUERUNG (UNTERES PANEL) ---
        ctx.fillStyle = "#111"; ctx.fillRect(0, canvas.height - 180, canvas.width, 180);
        
        // Joystick Außenring & Innenknubbel
        ctx.beginPath(); ctx.arc(joystick.startX, joystick.startY, joystick.maxRadius, 0, Math.PI*2);
        ctx.strokeStyle = "#444"; ctx.lineWidth = 4; ctx.stroke();
        ctx.beginPath(); ctx.arc(joystick.currentX, joystick.currentY, 25, 0, Math.PI*2);
        ctx.fillStyle = "#666"; ctx.fill();

        // Trink-Knopf (Aktionsknopf)
        ctx.beginPath(); ctx.arc(drinkButton.x, drinkButton.y, drinkButton.radius, 0, Math.PI*2);
        ctx.fillStyle = player.isDrinking ? "#c0392b" : "#e74c3c"; ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("SAUFEN", drinkButton.x, drinkButton.y + 5);

        // Meilenstein-Flash (Blinken alle 100 Biere)
        if (milestoneTimer > 0) {
            milestoneTimer--;
            if (Math.floor(milestoneTimer / 10) % 2 === 0) {
                ctx.fillStyle = "rgba(255,255,255,0.3)"; ctx.fillRect(0,0,canvas.width,canvas.height);
            }
        }
    }

    if (gameState === "GAMEOVER") {
        ctx.fillStyle = "rgba(0,0,0,0.85)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#e74c3c"; ctx.font = "bold 32px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("GAME OVER", canvas.width/2, 250);
        ctx.fillStyle = "#fff"; ctx.font = "18px sans-serif";
        ctx.fillText(`Du hast ${player.biereGesoffen} Biere geschafft!`, canvas.width/2, 310);

        if (player.biereGesoffen >= 1000) {
            ctx.fillStyle = "#ffcc00"; ctx.fillText("GRATIS TICKET CODE:", canvas.width/2, 380);
            ctx.font = "bold 24px monospace"; ctx.fillText("MDPEKDAMVZG", canvas.width/2, 415);
            ctx.font = "12px sans-serif"; ctx.fillText("Am 24.10.2024 im Lido einlösen!", canvas.width/2, 440);
        }

        ctx.fillStyle = "#aaa"; ctx.font = "14px monospace";
        ctx.fillText("Drücke F5 zum Neustarten", canvas.width/2, 550);
    }
}

function startGame() {
    gameState = "PLAYING";
    player.biereGesoffen = 0; player.verschuettet = 0; player.blase = 0; player.durst = 100;
    beers = []; giTos = []; pfuetzen = []; snacks = [];
    audio.bgMenu.pause();
    audio.bgBierloch.currentTime = 0; audio.bgBierloch.play().catch(e => console.log("Interaktion nötig für Sound:", e));
}

function endGame() {
    gameState = "GAMEOVER";
    audio.bgBierloch.pause(); audio.bgGito.pause(); audio.urin.pause();
    
    // Automatisch in Firebase speichern
    let randomID = "Spieler_" + Math.floor(Math.random()*900 + 100);
    db.collection("scores").add({
        name: randomID, score: player.biereGesoffen, timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => loadHighscores());
}

function loadHighscores() {
    db.collection("scores").orderBy("score", "desc").limit(5).get().then(snapshot => {
        highscores = [];
        snapshot.forEach(doc => highscores.push(doc.data()));
    }).catch(e => console.log("Fehler beim Laden:", e));
}

// --- CORE GAME LOOP ENGINE ---
function gameLoop() {
    update();
    draw();
requestAnimationFrame(gameLoop);}// Start-Trigger beim Laden der SeiteloadHighscores();audio.bgMenu.play().catch(e=>console.log("Menü-Musik startet nach Klick"));gameLoop();
