// Eurfex Dash - iPhone-friendly, slow-mo runner (free Replit compatible)

// Prevent page scroll/bounce on iOS
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

const overlay = document.getElementById('overlay');
const playBtn = document.getElementById('playBtn');

async function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) { try { await el.requestFullscreen(); } catch {} }
}

playBtn.addEventListener('click', async () => {
  await enterFullscreen();
  overlay.style.display = 'none';
  startGame();
});

function startGame() {
  kaboom({
    global: true,
    width: window.innerWidth,
    height: window.innerHeight,
    background: [11, 14, 20],
    scale: 1,
    debug: false,
  });

  // ---------- Slow-mo system ----------
  let targetSlow = 1.0, currentSlow = 1.0;
  const SLOW_EASE = 6;

  function activateSlowMo(factor = 0.3, duration = 1.5) {
    targetSlow = Math.max(0.1, Math.min(0.5, factor));
    wait(duration, () => targetSlow = 1.0);
  }
  function slowDelta(dt) {
    currentSlow += (targetSlow - currentSlow) * Math.min(1, dt * SLOW_EASE);
    return dt * currentSlow;
  }

  function Cooldown(seconds) {
    return {
      time: 0, max: seconds,
      ready() { return this.time <= 0; },
      use() { this.time = this.max; },
      tick(dt) { this.time = Math.max(0, this.time - dt); },
      ratio() { return 1 - (this.time / this.max); },
    };
  }

  const lanes = [-150, 0, 150];
  const world = { speed: 240, maxSpeed: 760, accel: 28 };

  function saveHighScore(n) {
    const best = Number(localStorage.getItem("eurfex_best") || 0);
    if (n > best) localStorage.setItem("eurfex_best", String(n));
  }
  function getHighScore() {
    return Number(localStorage.getItem("eurfex_best") || 0);
  }

  scene("game", () => {
    layers(["bg", "obj", "ui"], "obj");

    // Road stripes
    for (let i = 0; i < 12; i++) {
      add([rect(6, 40), pos(width()/2, i * 80), color(70, 80, 100), anchor("center"), layer("bg"), "stripe"]);
    }

    let laneIndex = 1;
    const player = add([
      rect(56, 56),
      pos(width()/2 + lanes[laneIndex], height() - 160),
      anchor("center"),
      color(145, 214, 255),
      outline(3, rgb(18, 31, 45)),
      area({ shape: new Rect(vec2(0), 46, 46) }),
      "player",
    ]);

    let score = 0;
    const scoreLabel = add([ text("0", { size: 36 }), pos(12, 12), layer("ui") ]);
    add([ text("BEST: " + getHighScore(), { size: 18 }), pos(12, 54), layer("ui"), color(180,200,220) ]);

    const slowCooldown = Cooldown(3.0);
    const slowDuration = 1.5;
    const slowTarget = 0.2;

    // SLOW button (bottom-right)
    const BTN_SIZE = 96;
    const slowBtn = add([
      pos(width() - (BTN_SIZE + 16), height() - (BTN_SIZE + 16)),
      rect(BTN_SIZE, BTN_SIZE, { radius: 14 }),
      color(25, 35, 50),
      outline(3, rgb(18,31,45)),
      area(),
      fixed(),
      layer("ui"),
      "slowbtn",
    ]);
    add([ text("SLOW", { size: 22 }), pos(slowBtn.pos.x + 16, slowBtn.pos.y + 30), fixed(), layer("ui"), color(190,220,255) ]);
    const slowArc = add([ pos(slowBtn.pos.x + 10, slowBtn.pos.y + BTN_SIZE - 14), rect(BTN_SIZE - 20, 8), color(120,160,200), fixed(), layer("ui") ]);

    onClick("slowbtn", () => { if (slowCooldown.ready()) { slowCooldown.use(); activateSlowMo(slowTarget, slowDuration); } });
    onKeyPress("s", () => { if (slowCooldown.ready()) { slowCooldown.use(); activateSlowMo(slowTarget, slowDuration); } });

    function setLane(i) {
      laneIndex = clamp(i, 0, lanes.length - 1);
      player.pos.x = width()/2 + lanes[laneIndex];
    }
    onKeyPress("left", () => setLane(laneIndex - 1));
    onKeyPress("right", () => setLane(laneIndex + 1));

    // Swipe
    let touchStart = null;
    onTouchStart((id, posStart) => { touchStart = posStart; });
    onTouchEnd((id, posEnd) => {
      if (!touchStart) return;
      const dx = posEnd.x - touchStart.x, dy = posEnd.y - touchStart.y;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 28) {
        setLane(laneIndex + (dx > 0 ? 1 : -1));
      } else {
        const p = slowBtn.worldArea();
        if (posEnd.x >= p.p1.x && posEnd.x <= p.p2.x && posEnd.y >= p.p1.y && posEnd.y <= p.p2.y) {
          if (slowCooldown.ready()) { slowCooldown.use(); activateSlowMo(slowTarget, slowDuration); }
        }
      }
      touchStart = null;
    });

    // Spawners
    function spawnObstacle() {
      const lane = choose(lanes);
      add([ rect(56, 56, { radius: 8 }), pos(width()/2 + lane, -60), anchor("center"),
            color(255, 130, 130), outline(3, rgb(60, 20, 20)), area(), "obstacle", { vel: world.speed } ]);
      wait(rand(0.55, 1.0), spawnObstacle);
    }
    function spawnCoin() {
      const lane = choose(lanes);
      add([ rect(28, 28, { radius: 14 }), pos(width()/2 + lane, -40), anchor("center"),
            color(255, 220, 120), outline(3, rgb(60, 50, 20)), area(), "coin", { vel: world.speed } ]);
      wait(rand(0.3, 0.7), spawnCoin);
    }
    function spawnTimeShard() {
      const lane = choose(lanes);
      add([ rect(30, 30), pos(width()/2 + lane, -40), anchor("center"),
            color(120, 200, 255), outline(3, rgb(20, 50, 80)), area(), "time", { vel: world.speed } ]);
      wait(rand(2.6, 5.0), spawnTimeShard);
    }
    spawnObstacle(); spawnCoin(); spawnTimeShard();

    let coins = 0;
    const coinLabel = add([ text("Coins: 0", { size: 18 }), pos(12, 78), layer("ui"), color(240,220,120) ]);

    onUpdate(() => {
      const dts = slowDelta(dt());

      every("stripe", (s) => {
        s.move(0, world.speed * 0.8 * dts);
        if (s.pos.y > height() + 40) s.pos.y -= 12 * 80;
      });
      every("obstacle", (o) => { o.move(0, o.vel * dts); if (o.pos.y > height() + 80) destroy(o); });
      every("coin", (c) => { c.move(0, c.vel * dts); if (c.pos.y > height() + 80) destroy(c); });
      every("time", (t) => { t.move(0, t.vel * dts); if (t.pos.y > height() + 80) destroy(t); });

      world.speed = Math.min(world.maxSpeed, world.speed + world.accel * dt()); // ramp uses raw dt
      score += 22 * dts;
      scoreLabel.text = String(Math.floor(score));

      slowCooldown.tick(dt());
      slowArc.width = (BTN_SIZE - 20) * slowCooldown.ratio();
    });

    onCollide("player", "obstacle", () => { saveHighScore(Math.floor(score)); go("gameover", Math.floor(score)); });
    onCollide("player", "coin", (c) => { destroy(c); coins += 1; coinLabel.text = "Coins: " + coins; });
    onCollide("player", "time", (t) => { destroy(t); activateSlowMo(0.2, 1.6); });
  });

  scene("gameover", (finalScore) => {
    add([text("Game Over", { size: 48 }), pos(width()/2, height()/2 - 60), anchor("center")]);
    add([text("Score: " + finalScore, { size: 28 }), pos(width()/2, height()/2), anchor("center")]);
    add([text("Best: " + Number(localStorage.getItem('eurfex_best') || 0), { size: 24 }),
         pos(width()/2, height()/2 + 36), anchor("center")]);
    add([ rect(200, 60, { radius: 14 }), pos(width()/2, height()/2 + 110), anchor("center"),
          area(), color(40, 60, 90), outline(3, rgb(18,31,45)), "restart" ]);
    add([ text("Play Again", { size: 22 }), pos(width()/2, height()/2 + 110), anchor("center") ]);
    onClick("restart", () => go("game"));
    onKeyPress(() => go("game"));
    onTouchStart(() => go("game"));
  });

  go("game");
}
