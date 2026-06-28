(() => {
  "use strict";

  const canvas = document.querySelector("#court");
  const ctx = canvas.getContext("2d");
  const gameRoot = document.querySelector("#game");
  const leftScoreEl = document.querySelector("#leftScore");
  const rightScoreEl = document.querySelector("#rightScore");
  const startScreen = document.querySelector("#startScreen");
  const pauseScreen = document.querySelector("#pauseScreen");
  const winScreen = document.querySelector("#winScreen");
  const winnerText = document.querySelector("#winnerText");
  const finalScore = document.querySelector("#finalScore");
  const pauseButton = document.querySelector("#pauseButton");
  const soundButton = document.querySelector("#soundButton");

  const WIN_SCORE = 7;
  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    running: false,
    paused: false,
    gameOver: false,
    sound: true,
    lastTime: 0,
    serveTimer: 0,
    shake: 0,
    leftScore: 0,
    rightScore: 0,
    keys: new Set(),
  };

  const left = { x: 0, y: 0, targetY: 0, width: 14, height: 100, color: "#58ffe3" };
  const right = { x: 0, y: 0, targetY: 0, width: 14, height: 100, color: "#ff4f91" };
  const ball = { x: 0, y: 0, vx: 0, vy: 0, radius: 9, trail: [] };
  let audio = null;
  let animationId = 0;

  function resize() {
    const rect = gameRoot.getBoundingClientRect();
    state.width = rect.width;
    state.height = rect.height;
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * state.dpr);
    canvas.height = Math.round(rect.height * state.dpr);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    const shortSide = Math.min(state.width, state.height);
    left.width = right.width = Math.max(10, shortSide * 0.025);
    left.height = right.height = Math.max(72, state.height * 0.25);
    ball.radius = Math.max(7, shortSide * 0.018);
    left.x = Math.max(22, state.width * 0.035);
    right.x = state.width - left.x - right.width;
    left.y = clamp(left.y || state.height / 2 - left.height / 2, 0, state.height - left.height);
    right.y = clamp(right.y || state.height / 2 - right.height / 2, 0, state.height - right.height);
    left.targetY = left.y;
    right.targetY = right.y;
    if (!state.running) centerBall();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function centerBall() {
    ball.x = state.width / 2;
    ball.y = state.height / 2;
    ball.vx = 0;
    ball.vy = 0;
    ball.trail.length = 0;
  }

  function resetMatch() {
    state.leftScore = 0;
    state.rightScore = 0;
    state.gameOver = false;
    updateScore();
    left.y = left.targetY = state.height / 2 - left.height / 2;
    right.y = right.targetY = state.height / 2 - right.height / 2;
    prepareServe(Math.random() > 0.5 ? 1 : -1);
  }

  function prepareServe(direction) {
    centerBall();
    state.serveTimer = 0.75;
    ball.serveDirection = direction;
  }

  function launchBall(direction) {
    const baseSpeed = Math.max(390, state.width * 0.48);
    const angle = (Math.random() * 0.7 - 0.35);
    ball.vx = Math.cos(angle) * baseSpeed * direction;
    ball.vy = Math.sin(angle) * baseSpeed;
    beep(390, 0.05, 0.025);
  }

  function updateScore() {
    leftScoreEl.textContent = state.leftScore;
    rightScoreEl.textContent = state.rightScore;
  }

  async function enterFullscreen() {
    try {
      if (!document.fullscreenElement && gameRoot.requestFullscreen) {
        await gameRoot.requestFullscreen({ navigationUI: "hide" });
      }
      if (screen.orientation?.lock) {
        await screen.orientation.lock("landscape").catch(() => {});
      }
    } catch {
      // Fullscreen is optional; the game still fills the browser viewport.
    }
  }

  function initAudio() {
    if (!audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audio = new AudioContext();
    }
    if (audio?.state === "suspended") audio.resume();
  }

  function beep(frequency, duration, volume) {
    if (!state.sound || !audio) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    gain.gain.setValueAtTime(volume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + duration);
  }

  function startGame() {
    initAudio();
    enterFullscreen();
    startScreen.classList.remove("visible");
    winScreen.classList.remove("visible");
    pauseScreen.classList.remove("visible");
    resetMatch();
    state.running = true;
    state.paused = false;
    state.lastTime = performance.now();
  }

  function togglePause(force) {
    if (!state.running || state.gameOver) return;
    state.paused = typeof force === "boolean" ? force : !state.paused;
    pauseScreen.classList.toggle("visible", state.paused);
    pauseButton.textContent = state.paused ? "▶" : "Ⅱ";
    if (!state.paused) state.lastTime = performance.now();
  }

  function scorePoint(side) {
    if (side === "left") state.leftScore++;
    else state.rightScore++;
    updateScore();
    state.shake = 10;
    beep(side === "left" ? 620 : 520, 0.16, 0.05);

    if (state.leftScore >= WIN_SCORE || state.rightScore >= WIN_SCORE) {
      state.gameOver = true;
      state.running = false;
      const leftWon = state.leftScore > state.rightScore;
      winnerText.innerHTML = `ГРАВЕЦЬ ${leftWon ? "1" : "2"}<br><em>ПЕРЕМІГ!</em>`;
      winnerText.querySelector("em").style.color = leftWon ? left.color : right.color;
      finalScore.textContent = `${state.leftScore} : ${state.rightScore}`;
      setTimeout(() => winScreen.classList.add("visible"), 350);
      return;
    }

    prepareServe(side === "left" ? -1 : 1);
  }

  function movePaddle(paddle, clientY) {
    const rect = canvas.getBoundingClientRect();
    paddle.targetY = clamp(clientY - rect.top - paddle.height / 2, 0, state.height - paddle.height);
  }

  function onPointer(event) {
    event.preventDefault();
    if (!state.running || state.paused) return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    movePaddle(x < state.width / 2 ? left : right, event.clientY);
  }

  function update(dt) {
    const keyboardSpeed = state.height * 0.85 * dt;
    if (state.keys.has("KeyW")) left.targetY -= keyboardSpeed;
    if (state.keys.has("KeyS")) left.targetY += keyboardSpeed;
    if (state.keys.has("ArrowUp")) right.targetY -= keyboardSpeed;
    if (state.keys.has("ArrowDown")) right.targetY += keyboardSpeed;
    left.targetY = clamp(left.targetY, 0, state.height - left.height);
    right.targetY = clamp(right.targetY, 0, state.height - right.height);

    const follow = 1 - Math.pow(0.0005, dt);
    left.y += (left.targetY - left.y) * follow;
    right.y += (right.targetY - right.y) * follow;

    if (state.serveTimer > 0) {
      state.serveTimer -= dt;
      if (state.serveTimer <= 0) launchBall(ball.serveDirection);
      return;
    }

    ball.trail.unshift({ x: ball.x, y: ball.y });
    if (ball.trail.length > 12) ball.trail.pop();
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y - ball.radius <= 0 && ball.vy < 0) {
      ball.y = ball.radius;
      ball.vy *= -1;
      beep(230, 0.025, 0.018);
    } else if (ball.y + ball.radius >= state.height && ball.vy > 0) {
      ball.y = state.height - ball.radius;
      ball.vy *= -1;
      beep(230, 0.025, 0.018);
    }

    collide(left, 1);
    collide(right, -1);

    if (ball.x + ball.radius < 0) scorePoint("right");
    else if (ball.x - ball.radius > state.width) scorePoint("left");
  }

  function collide(paddle, direction) {
    const movingToward = direction === 1 ? ball.vx < 0 : ball.vx > 0;
    if (!movingToward) return;

    const hitX = ball.x + ball.radius >= paddle.x &&
      ball.x - ball.radius <= paddle.x + paddle.width;
    const hitY = ball.y + ball.radius >= paddle.y &&
      ball.y - ball.radius <= paddle.y + paddle.height;
    if (!hitX || !hitY) return;

    const relativeHit = clamp(
      (ball.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2),
      -1,
      1
    );
    const currentSpeed = Math.hypot(ball.vx, ball.vy);
    const maxSpeed = Math.max(850, state.width * 1.05);
    const speed = Math.min(maxSpeed, currentSpeed * 1.055);
    const angle = relativeHit * 0.92;
    ball.vx = Math.cos(angle) * speed * direction;
    ball.vy = Math.sin(angle) * speed;
    ball.x = direction === 1
      ? paddle.x + paddle.width + ball.radius
      : paddle.x - ball.radius;
    state.shake = 4;
    beep(290 + Math.abs(relativeHit) * 160, 0.045, 0.035);
  }

  function roundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
  }

  function draw() {
    ctx.clearRect(0, 0, state.width, state.height);
    ctx.save();
    if (state.shake > 0) {
      ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
      state.shake *= 0.82;
      if (state.shake < 0.2) state.shake = 0;
    }

    ctx.strokeStyle = "rgba(239, 252, 245, 0.10)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 14]);
    ctx.beginPath();
    ctx.moveTo(state.width / 2, 0);
    ctx.lineTo(state.width / 2, state.height);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = "rgba(239, 252, 245, 0.055)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(state.width / 2, state.height / 2, Math.min(state.width, state.height) * 0.17, 0, Math.PI * 2);
    ctx.stroke();

    drawPaddle(left);
    drawPaddle(right);

    ball.trail.forEach((point, index) => {
      const alpha = (1 - index / ball.trail.length) * 0.25;
      ctx.beginPath();
      ctx.fillStyle = `rgba(239, 252, 245, ${alpha})`;
      ctx.arc(point.x, point.y, ball.radius * (1 - index / 18), 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.save();
    ctx.shadowColor = "#effcf5";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "#effcf5";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (state.serveTimer > 0 && state.running) {
      const count = Math.max(1, Math.ceil(state.serveTimer * 3));
      ctx.fillStyle = "rgba(239, 252, 245, 0.36)";
      ctx.font = `900 ${Math.max(18, state.height * 0.055)}px system-ui`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(count, state.width / 2, state.height / 2 + state.height * 0.11);
    }
    ctx.restore();
  }

  function drawPaddle(paddle) {
    ctx.save();
    ctx.fillStyle = paddle.color;
    ctx.shadowColor = paddle.color;
    ctx.shadowBlur = 24;
    roundedRect(paddle.x, paddle.y, paddle.width, paddle.height, paddle.width / 2);
    ctx.restore();
  }

  function frame(now) {
    const dt = Math.min((now - state.lastTime) / 1000, 0.025) || 0;
    state.lastTime = now;
    if (state.running && !state.paused) update(dt);
    draw();
    animationId = requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture?.(event.pointerId);
    onPointer(event);
  });
  canvas.addEventListener("pointermove", onPointer);

  window.addEventListener("keydown", (event) => {
    state.keys.add(event.code);
    if (["ArrowUp", "ArrowDown", "Space"].includes(event.code)) event.preventDefault();
    if (event.code === "Space") togglePause();
  });
  window.addEventListener("keyup", (event) => state.keys.delete(event.code));
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state.running && !state.paused) togglePause(true);
  });

  document.querySelector("#startButton").addEventListener("click", startGame);
  document.querySelector("#resumeButton").addEventListener("click", () => togglePause(false));
  document.querySelector("#restartButton").addEventListener("click", () => {
    resetMatch();
    togglePause(false);
  });
  document.querySelector("#playAgainButton").addEventListener("click", startGame);
  pauseButton.addEventListener("click", () => togglePause());
  soundButton.addEventListener("click", () => {
    state.sound = !state.sound;
    soundButton.textContent = state.sound ? "♪" : "×";
    soundButton.setAttribute("aria-label", state.sound ? "Вимкнути звук" : "Увімкнути звук");
    if (state.sound) {
      initAudio();
      beep(440, 0.05, 0.025);
    }
  });

  resize();
  cancelAnimationFrame(animationId);
  animationId = requestAnimationFrame(frame);
})();
