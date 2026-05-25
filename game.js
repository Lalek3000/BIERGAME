const cv = document.getElementById("gameCanvas"), cx = cv.getContext("2d");
const touchControlsContainer = document.getElementById("touchControls");

let st = "click-to-unlock", gm = 1, tot = 0, sp = 0;
const ts = 1000, ms = 100, sr = 0.02, gr = 0.025;
let au = null, bgMusic = null, gitoMusic = null, menuMusic = null, peNode = null, peGain = null;
let gtTimer = 4000, gtMode = "idle", gtCount = 5, flT = 0, snackTimer = 600, dönerTimer = 6000;
let inputNames = ["Janitor 1", "Janitor 2", "Janitor 3", "Janitor 4"], activeField = 0, playerNames = "";
let highscores = JSON.parse(localStorage.getItem("beer_janitor_scores")) || [];

function saveScore(n, s) {
    highscores.push({ names: n, score: s, date: new Date().toLocaleDateString() });
    highscores.sort((a,b) => b.score - a.score); highscores = highscores.slice(0, 5);
    localStorage.setItem("beer_janitor_scores", JSON.stringify(highscores));
}

function initAu(){
    try{
        if(!au) au = new(window.AudioContext||window.webkitAudioContext)();
        if(au.state === "suspended") au.resume();
        if(st === "click-to-unlock"){ st = "menu"; startMenuMusic(); setupTouchControls(); }
    }catch(e){}
}

function snd(t){
    try{
        if(!au||au.state==="suspended")return;
        let n=au.currentTime,o=au.createOscillator(),g=au.createGain();
        if(t==='drink'){o.type="sine";o.frequency.setValueAtTime(200,n);o.frequency.exponentialRampToValueAtTime(300,n+0.15);g.gain.setValueAtTime(0.1,n);}
        if(t==='spill'){o.type="triangle";o.frequency.setValueAtTime(800,n);o.frequency.exponentialRampToValueAtTime(100,n+0.2);g.gain.setValueAtTime(0.1,n);}
        if(t==='burp'){o.type="sawtooth";o.frequency.setValueAtTime(90,n);o.frequency.linearRampToValueAtTime(50,n+0.3);g.gain.setValueAtTime(0.15,n);}
        o.connect(g);g.connect(au.destination);o.start(n);o.stop(n+0.3);
    }catch(e){}
}

function startPeeSound(){
    try{
        if(!au||au.state==="suspended")return;
        if(!peNode){
            let bS=au.sampleRate*2,buf=au.createBuffer(1,bS,au.sampleRate),d=buf.getChannelData(0);
            for(let i=0;i<bS;i++)d[i]=Math.random()*2-1;
            peNode=au.createBufferSource();peNode.buffer=buf;peNode.loop=true;
            let f=au.createBiquadFilter();f.type="bandpass";f.frequency.value=600;f.Q.value=4;
            peGain=au.createGain();peGain.gain.setValueAtTime(0,au.currentTime);
            peNode.connect(f);f.connect(peGain);peGain.connect(au.destination);peNode.start();
        }
        if(peGain)peGain.gain.linearRampToValueAtTime(0.05,au.currentTime+0.1);
    }catch(e){}
}

function stopPeeSound(){if(peGain&&au){try{peGain.gain.linearRampToValueAtTime(0,au.currentTime+0.1);}catch(e){}}}
function startMenuMusic(){if(!menuMusic&&(st==="menu"||st==="name-input"||st==="rules")){menuMusic=new Audio("backgroundmenu.mp3");menuMusic.loop=true;menuMusic.volume=0.4;menuMusic.play().catch(e=>{});}}
function startMusic(){if(menuMusic){menuMusic.pause();menuMusic=null;}if(!bgMusic){bgMusic=new Audio("background.mp3");bgMusic.loop=true;bgMusic.volume=0.4;}if(!gitoMusic){gitoMusic=new Audio("backgroundgito.mp3");gitoMusic.loop=true;gitoMusic.volume=0.45;}switchTrack("normal");}
function switchTrack(t){try{if(t==="gito"&&gitoMusic&&bgMusic){bgMusic.pause();gitoMusic.play().catch(e=>{});}if(t==="normal"&&bgMusic&&gitoMusic){gitoMusic.pause();bgMusic.play().catch(e=>{});}}catch(e){}}

class P{
    constructor(x,y,c,ct){this.sx=x;this.sy=y;this.c=c;this.ct=ct;this.reset();}
    reset(){this.x=this.sx;this.y=this.sy;this.vx=0;this.vy=0;this.sc=0;this.th=100;this.bl=0;this.dt=0;this.id=false;this.r=22;this.wa=Math.random()*Math.PI*2;this.dat=0;}
}

const p1=new P(200,500,"#3399ff",{u:"KeyW",d:"KeyS",l:"KeyA",r:"KeyD",a:"KeyQ"});
const p2=new P(330,500,"#00ffcc",{u:"KeyT",d:"KeyG",l:"KeyF",r:"H",a:"KeyR"});
const p3=new P(460,500,"#ff00ff",{u:"KeyI",d:"KeyK",l:"KeyJ",r:"KeyL",a:"KeyU"});
const p4=new P(600,500,"#ffff00",{u:"BracketLeft",d:"Quote",l:"Semicolon",r:"Backslash",a:"KeyP"});
let ap=[p1],beers=[],pud=[],snacks=[];
const keys={};
window.addEventListener("keydown",e=>{
    initAu();
    if(st==="playing"){keys[e.code]=true;return;}
    if(st==="name-input"){
        if(e.key==="Enter"){advanceNameInput();}
        else if(e.key==="Backspace"){inputNames[activeField]=inputNames[activeField].slice(0,-1);}
        else if(e.key.length===1){
            if(inputNames[activeField].startsWith("Janitor"))inputNames[activeField]="";
            inputNames[activeField]+=e.key;
        }
    }
});
window.addEventListener("keyup",e=>{if(st==="playing")keys[e.code]=false;});

function setupTouchControls() {
    touchControlsContainer.innerHTML = "";
    if(st !== "playing") { touchControlsContainer.style.display = "none"; return; }
    ap.forEach((player) => {
        const pad = document.createElement("div"); pad.className = "player-pad";
        const directions = [
            { class: "btn-up", key: player.ct.u, label: "▲" }, { class: "btn-down", key: player.ct.d, label: "▼" },
            { class: "btn-left", key: player.ct.l, label: "◀" }, { class: "btn-right", key: player.ct.r, label: "▶" },
            { class: "btn-act", key: player.ct.a, label: "🍺" }
        ];
        directions.forEach(d => {
            const btn = document.createElement("div"); btn.className = `touch-btn ${d.class}`; btn.innerText = d.label;
            btn.addEventListener("touchstart", (e) => { e.preventDefault(); keys[d.key] = true; });
            btn.addEventListener("touchend", (e) => { e.preventDefault(); keys[d.key] = false; });
            pad.appendChild(btn);
        });
        touchControlsContainer.appendChild(pad);
    });
    touchControlsContainer.style.display = "flex";
}

function handleMenuClick(clientX, clientY) {
    initAu();
    const r = cv.getBoundingClientRect();
    const cx = (clientX - r.left) * (cv.width / r.width);
    const cy = (clientY - r.top) * (cv.height / r.height);
    if(st==="menu"){
        if(cx>=300&&cx<=500&&cy>=100&&cy<=135) gm=1;
        if(cx>=300&&cx<=500&&cy>=145&&cy<=180) gm=2;
        if(cx>=300&&cx<=500&&cy>=190&&cy<=225) gm=3;
        if(cx>=300&&cx<=500&&cy>=235&&cy<=270) gm=4;
        if(cx>=300&&cx<=500&&cy>=280&&cy<=315) st="rules";
        if(cx>=300&&cx<=500&&cy>=330&&cy<=375){st="name-input";activeField=0;}
    }else if(st==="rules"&&cx>=300&&cx<=500&&cy>=480&&cy<=525) { st="menu";
    }else if(st==="name-input"){
        for(let i=0;i<gm;i++){ if(cx>=250&&cx<=550&&cy>=(130+i*45)&&cy<=(165+i*45)) activeField=i; }
        if(cx>=300&&cx<=500&&cy>=510&&cy<=550){advanceNameInput();}
    } else if (st === "gameover" || st === "click-to-unlock") { if(st === "gameover") st = "menu"; }
}

cv.addEventListener("click", e => handleMenuClick(e.clientX, e.clientY));
cv.addEventListener("touchstart", e => { 
    if(e.touches.length > 0) handleMenuClick(e.touches[0].clientX, e.touches[0].clientY); 
});

function advanceNameInput() {
    if(activeField < gm-1){ activeField++; }
    else{
        let nA=[]; for(let i=0;i<gm;i++) nA.push(inputNames[i]);
        playerNames=nA.join(" & ")+(gm>1?" (Team)":""); startMusic(); start();
    }
}
function start(){
    beers=[],pud=[],snacks=[];sp=0;
    p1.reset();p2.reset();p3.reset();p4.reset();
    if(gm===1){ap=[p1];p1.x=400;}
    else if(gm===2){ap=[p1,p2];p1.x=300;p2.x=500;}
    else if(gm===3){ap=[p1,p2,p3];p1.x=200;p2.x=400;p3.x=600;}
    else{ap=[p1,p2,p3,p4];}
    gtTimer=3600+Math.random()*1800;gtMode="idle";gtCount=5;snackTimer=600;dönerTimer=6000+Math.random()*2400;
    st="playing"; setupTouchControls();
}

function dUnlock() {
    cx.fillStyle = "#222"; cx.fillRect(0,0,cv.width,cv.height);
    cx.fillStyle = "#ffcc00"; cx.font = "20px Courier New"; cx.textAlign = "center";
    cx.fillText("ZUM STARTEN BERÜHREN / KLICKEN", 400, 300);
}
function dMenu() {
    cx.fillStyle = "#222"; cx.fillRect(0,0,cv.width,cv.height);
    cx.fillStyle = "#ffcc00"; cx.font = "24px Courier New"; cx.textAlign = "center";
    cx.fillText("HAUPTMENÜ", 400, 50); cx.font = "16px Courier New";
    cx.fillStyle = gm===1?"#fff":"#888"; cx.fillText("[ " + (gm===1?"X":" ") + " ] 1 SPIELER", 400, 120);
    cx.fillStyle = gm===2?"#fff":"#888"; cx.fillText("[ " + (gm===2?"X":" ") + " ] 2 SPIELER", 400, 160);
    cx.fillStyle = gm===3?"#fff":"#888"; cx.fillText("[ " + (gm===3?"X":" ") + " ] 3 SPIELER", 400, 210);
    cx.fillStyle = gm===4?"#fff":"#888"; cx.fillText("[ " + (gm===4?"X":" ") + " ] 4 SPIELER", 400, 255);
    cx.fillStyle = "#ffcc00"; cx.fillText("REGLEN ANZEIGEN", 400, 300);
    cx.fillStyle = "#00ffcc"; cx.fillText("SPIEL STARTEN", 400, 350);
    cx.fillStyle = "#aaa"; cx.fillText("HIGHSCORES:", 400, 420);
    highscores.forEach((h, i) => { cx.fillText(`${i+1}. ${h.names} - ${h.score} Pkt (${h.date})`, 400, 450 + i*25); });
}
function dRules() {
    cx.fillStyle = "#222"; cx.fillRect(0,0,cv.width,cv.height);
    cx.fillStyle = "#ffcc00"; cx.font = "20px Courier New"; cx.textAlign = "center";
    cx.fillText("REGELN", 400, 50); cx.font = "14px Courier New"; cx.fillStyle = "#fff";
    cx.fillText("1. Trinke nur wenn du DURST hast.", 400, 120);
    cx.fillText("2. Wenn Ed Sheeran Gitarre spielt: SCHNELL PINKELN!", 400, 160);
    cx.fillText("3. Bei 100 verkippten Bieren ist das Spiel vorbei.", 400, 200);
    cx.fillStyle = "#ff3333"; cx.fillText("ZURÜCK", 400, 500);
}
function dNameInput() {
    cx.fillStyle = "#222"; cx.fillRect(0,0,cv.width,cv.height);
    cx.fillStyle = "#ffcc00"; cx.font = "20px Courier New"; cx.textAlign = "center";
    cx.fillText("NAMEN EINGEBEN", 400, 50); cx.font = "16px Courier New";
    for(let i=0; i<gm; i++) {
        cx.fillStyle = (activeField === i) ? "#fff" : "#666";
        cx.fillText(`Spieler ${i+1}: ${inputNames[i]} ${activeField===i?"_":""}`, 400, 150 + i*45);
    }
    cx.fillStyle = "#00ffcc"; cx.fillText("WEITER", 400, 520);
}
function dOver() {
    cx.fillStyle = "rgba(0,0,0,0.8)"; cx.fillRect(0,0,cv.width,cv.height);
    cx.fillStyle = "#ff3333"; cx.font = "40px Courier New"; cx.textAlign = "center";
    cx.fillText("GAME OVER", 400, 250); cx.fillStyle = "#fff"; cx.font = "20px Courier New";
    cx.fillText(`Erreichte Biere: ${tot} / ${ts}`, 400, 310);
    cx.fillStyle = "#ffcc00"; cx.fillText("Klicke hier um ins Menü zu gelangen", 400, 400);
}

function uGame(){
    tot=ap.reduce((s,p)=>s+p.sc,0);
    if(tot>=ts||sp>=ms){saveScore(playerNames,tot);st="gameover"; setupTouchControls(); return;}
    
    ap.forEach(p => {
        if(keys[p.ct.l]) p.vx = -4;
        else if(keys[p.ct.r]) p.vx = 4;
        else p.vx *= 0.8;

        if(keys[p.ct.u]) p.vy = -4;
        else if(keys[p.ct.d]) p.vy = 4;
        else p.vy *= 0.8;

        p.x += p.vx; p.y += p.vy;
        if(p.x < p.r) p.x = p.r; if(p.x > cv.width - p.r) p.x = cv.width - p.r;
        if(p.y < p.r) p.y = p.r; if(p.y > cv.height - p.r) p.y = cv.height - p.r;

        if(keys[p.ct.a]) { if(p.dat <= 0) { snd('drink'); p.sc += 1; p.dat = 15; } }
        if(p.dat > 0) p.dat--;
    });

    if(Math.random()<sr) beers.push({x:Math.random()*cv.width,y:15,w:20,h:30,vx:(Math.random()-0.5)*2.5,vy:2,t:"beer"});
    
    beers.forEach((b,i) => {
        b.y += b.vy; b.x += b.vx;
        ap.forEach(p => {
            let dist = Math.hypot(p.x - b.x, p.y - b.y);
            if(dist < p.r + b.w/2) { beers.splice(i, 1); }
        });
        if(b.y > cv.height) { beers.splice(i,1); sp++; snd('spill'); }
    });
}

function dGame(){
    cx.fillStyle = "#222"; cx.fillRect(0,0,cv.width,cv.height);
    ap.forEach(p => {
        cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI*2); cx.fill();
        cx.fillStyle = "#fff"; cx.font = "12px Courier New"; cx.textAlign = "center";
        cx.fillText(p.sc, p.x, p.y - p.r - 5);
    });
    cx.fillStyle = "#ffcc00"; beers.forEach(b => { cx.fillRect(b.x, b.y, b.w, b.h); });
    cx.fillStyle = "#fff"; cx.font = "16px Courier New"; cx.textAlign = "left";
    cx.fillText(`Gesamt: ${tot}/${ts}`, 20, 30); cx.textAlign = "right";
    cx.fillText(`Verkippt: ${sp}/${ms}`, cv.width - 20, 30);
}

function loop(){
    if(st==="click-to-unlock")dUnlock();
    else if(st==="menu")dMenu();
    else if(st==="rules")dRules();
    else if(st==="name-input")dNameInput();
    else if(st==="playing"){uGame();dGame();}
    else {dOver(); if(bgMusic)bgMusic.pause(); if(gitoMusic)gitoMusic.pause(); stopPeeSound();}
    requestAnimationFrame(loop);
}

loop();
