/* eslint-env browser */
/* global window, localStorage, requestAnimationFrame */

import './flappybird.css';

// PUBLIC_INTERFACE
export default function setupFlappyBirdGame(mountNode) {
  /** This is the main entry to bootstrap the Flappy Bird game UI. */
  mountNode.innerHTML = `
    <div id="fb-game-root">
      <div id="fb-game-area">
        <canvas id="fb-canvas" tabindex="0"></canvas>
        <div id="fb-ui-overlay" class="hidden"></div>
      </div>
      <div id="fb-score-bar">
        <span id="fb-current-score">0</span>
        <span id="fb-best-label">BEST</span>
        <span id="fb-best-score">0</span>
      </div>
    </div>
  `;

  // UI State references
  const canvas = document.getElementById('fb-canvas');
  const overlay = document.getElementById('fb-ui-overlay');
  const scoreSpan = document.getElementById('fb-current-score');
  const bestSpan = document.getElementById('fb-best-score');

  // Responsive canvas sizing
  function resizeCanvas() {
    // Centered, keep a fixed aspect ratio for consistency
    const maxW = 390;
    const maxH = 600;
    let w = Math.min(window.innerWidth * 0.95, maxW);
    let h = Math.round((w / maxW) * maxH);
    if(window.innerHeight < h + 100) h = window.innerHeight - 80;
    w = Math.round((h / maxH) * maxW);
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Game variables
  const GAMESTATE = {
    LOADING: 0, START: 1, RUNNING: 2, DEAD: 3, GAMEOVER: 4
  };

  let state = GAMESTATE.START;
  let score = 0;
  let best = Number(localStorage.getItem('flappy-best') || 0);

  // Bird physics setup
  const assets = {
    colors: {
      bird: "#4EC0CA", // primary
      pipe: "#D6B75D", // secondary
      sky: "#ECF8F9",
      ground: "#EAE7D6",
      pipeAccent: "#C09D24",
      birdEdge: "#38A2B0",
      accent: "#FF4B4B", // for highlights
    },
    birdRadius: 18,
    pipeWidth: 48,
    pipeGap: 128,
    gravity: 0.44,
    jump: -7,
    minPipeY: 90,
    maxPipeY: 340,
    groundH: 60,
  };

  // Game objects
  let birdY, birdV, pipes, gameH, gameW;
  function resetGame() {
    resizeCanvas();
    gameW = canvas.width;
    gameH = canvas.height;
    birdY = 0.42 * gameH;
    birdV = 0;
    pipes = [];
    score = 0;
    genInitialPipes();
    updateScoreDisplay();
  }
  function genInitialPipes() {
    pipes = [];
    // first pipe appears off screen
    for(let i=0; i<4; ++i) {
      pipes.push(generatePipe(gameW + i * 170));
    }
  }
  function generatePipe(x) {
    // y location is for TOP of gap
    const gapY = Math.floor(
      assets.minPipeY + Math.random() * (assets.maxPipeY - assets.minPipeY)
    );
    return { x, gapY, passed: false };
  }

  // DRAWING
  const ctx = canvas.getContext('2d');
  function draw() {
    ctx.clearRect(0,0,gameW,gameH);

    //  sky
    ctx.fillStyle = assets.colors.sky;
    ctx.fillRect(0,0,gameW,gameH);

    // pipes
    pipes.forEach(pipe => {
      drawPipe(pipe);
    });

    // ground
    ctx.fillStyle = assets.colors.ground;
    ctx.fillRect(0, gameH-assets.groundH, gameW, assets.groundH);

    // bird
    drawBird(gameW * 0.23, birdY);

    // optional: shadow
    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.beginPath();
    ctx.ellipse(gameW*0.23, birdY+assets.birdRadius+8,
      assets.birdRadius*0.69, assets.birdRadius*0.23, 0, 0, Math.PI*2);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();

    // If game dead, grey overlay
    if(state === GAMESTATE.DEAD){
      ctx.save();
      ctx.globalAlpha = 0.48;
      ctx.fillStyle = assets.colors.accent;
      ctx.fillRect(0,0,gameW,gameH-assets.groundH);
      ctx.restore();
    }
  }
  function drawBird(x, y) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, assets.birdRadius, 0, Math.PI*2);
    ctx.fillStyle = assets.colors.bird;
    ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.strokeStyle = assets.colors.birdEdge;
    ctx.stroke();
    // Eye
    ctx.beginPath();
    ctx.arc(x+7, y-7, 4.9, 0, Math.PI*2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.strokeStyle = "#222";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x+9.7, y-8, 1.75, 0, Math.PI*2);
    ctx.fillStyle = "#000";
    ctx.fill();
    // Beak
    ctx.beginPath();
    ctx.moveTo(x+assets.birdRadius-3, y);
    ctx.lineTo(x+assets.birdRadius+17, y-5);
    ctx.lineTo(x+assets.birdRadius+7, y+5);
    ctx.closePath();
    ctx.fillStyle = assets.colors.accent;
    ctx.fill();
    ctx.restore();
  }
  function drawPipe(pipe) {
    const w = assets.pipeWidth, gap = assets.pipeGap;
    // Top pipe (downward)
    ctx.save();
    ctx.fillStyle = assets.colors.pipe;
    ctx.fillRect(pipe.x, 0, w, pipe.gapY);
    ctx.fillStyle = assets.colors.pipeAccent;
    ctx.fillRect(pipe.x-1, pipe.gapY-15, w+2, 15);
    // Bottom pipe
    ctx.fillStyle = assets.colors.pipe;
    ctx.fillRect(pipe.x, pipe.gapY+gap, w, gameH-assets.gapY-assets.groundH);
    ctx.fillStyle = assets.colors.pipeAccent;
    ctx.fillRect(pipe.x-1, pipe.gapY+gap, w+2, 15);
    ctx.restore();
  }

  // GAME LOOP
  function updateGame() {
    if(state !== GAMESTATE.RUNNING)
      return;

    // Bird physics
    birdV += assets.gravity;
    birdY += birdV;

    // Update pipes
    for(let pipe of pipes){
      pipe.x -= 2.4;
    }
    if(pipes[0].x < -assets.pipeWidth-10){
      pipes.shift();
      pipes.push(generatePipe(
        pipes[pipes.length-1].x+170
      ));
    }
    // Score
    pipes.forEach(pipe => {
      if(
        !pipe.passed &&
        (gameW*0.23) > (pipe.x + assets.pipeWidth) &&
        state === GAMESTATE.RUNNING
      ){
        pipe.passed = true;
        score++;
        updateScoreDisplay();
      }
    });
    // Collisions
    if(checkCollision()){
      state = GAMESTATE.DEAD;
      updateOverlay('gameover');
      if(score > best){
        best = score;
        localStorage.setItem('flappy-best', best);
      }
    }
    // Hit ground
    if(birdY > gameH-assets.groundH-assets.birdRadius){
      birdY = gameH-assets.groundH-assets.birdRadius;
      state = GAMESTATE.DEAD;
      updateOverlay('gameover');
      if(score > best){
        best = score;
        localStorage.setItem('flappy-best', best);
      }
    }
    // Top of screen
    if(birdY < assets.birdRadius){
      birdY = assets.birdRadius + 2;
      birdV = 0.8;
    }
    draw();
    requestAnimationFrame(updateGame);
  }
  function checkCollision(){
    // Bird against pipes
    const bx = gameW*0.23, by = birdY, r = assets.birdRadius;
    return pipes.some(pipe => {
      const px = pipe.x, py = pipe.gapY, gap = assets.pipeGap, w = assets.pipeWidth;
      if(
        bx + r > px && bx - r < px + w // horizontal overlap
      ){
        if( by - r < py || by + r > py + gap ){
          return true;
        }
      }
      return false;
    });
  }

  // UI Management
  function updateScoreDisplay(){
    scoreSpan.textContent = score;
    bestSpan.textContent = Math.max(score, best);
  }
  function updateOverlay(what) {
    if(what === 'start'){
      overlay.classList.remove('hidden');
      overlay.innerHTML = `
        <div class="fb-dialog">
          <h1 class="fb-title">FLAPPY BIRD</h1>
          <button class="fb-btn fb-primary" id="fb-start-btn">START</button>
          <div class="fb-hint">Press SPACE/Click/Touch to flap</div>
        </div>`;
      document.getElementById('fb-start-btn').onclick = ()=>startGame();
    } else if(what === 'gameover'){
      overlay.classList.remove('hidden');
      overlay.innerHTML = `
        <div class="fb-dialog">
          <h2 class="fb-title" style="color:#FF4B4B;">GAME OVER</h2>
          <div class="fb-score-summary">Score: <b>${score}</b> &nbsp; | &nbsp; Best: <b>${best}</b></div>
          <button class="fb-btn fb-accent" id="fb-restart-btn">RESTART</button>
        </div>
      `;
      document.getElementById('fb-restart-btn').onclick = ()=>restartGame();
    } else {
      overlay.classList.add('hidden');
      overlay.innerHTML = "";
    }
  }
  
  // GAME CONTROL
  function startGame(){
    resetGame();
    state = GAMESTATE.RUNNING;
    updateOverlay(null);
    draw();
    requestAnimationFrame(updateGame);
  }
  function restartGame(){
    resetGame();
    state = GAMESTATE.RUNNING;
    updateOverlay(null);
    draw();
    requestAnimationFrame(updateGame);
  }
  function showStartScreen(){
    resetGame();
    updateOverlay('start');
    draw();
  }

  // INPUT HANDLING
  function onFlap(e){
    if(state === GAMESTATE.START) {
      startGame();
      return;
    } else if(state === GAMESTATE.DEAD) {
      // ignore flap until restart
      return;
    }
    if(state === GAMESTATE.RUNNING){
      birdV = assets.jump;
    }
  }
  document.addEventListener('keydown', function(e){
    if(e.repeat) return;
    if(e.code === 'Space'){
      onFlap();
      e.preventDefault();
    }
    if(state === GAMESTATE.DEAD && e.code === 'Enter'){
      restartGame();
    }
  });
  canvas.addEventListener('mousedown', onFlap);
  canvas.addEventListener('touchstart', onFlap);

  // Overlay click also triggers flap/start
  overlay.addEventListener('mousedown', ()=>onFlap());
  overlay.addEventListener('touchstart', ()=>onFlap());

  // Initialize
  showStartScreen();
}
