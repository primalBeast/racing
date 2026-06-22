(() => {
  'use strict';

  function showBootError(message) {
    const loading = document.getElementById('loading');
    if (!loading) return;
    loading.innerHTML = `<div class="loading-text" style="color:#ff2d95; letter-spacing:0.08em; text-align:center; max-width:520px; line-height:1.5;">${message}</div>`;
  }

  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    showBootError('Game canvas not found.');
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    showBootError('Could not start the game renderer.');
    return;
  }

  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  const REF_ASPECT = 16 / 9;
  const PLAYER_Y_INSET_RATIO = 110 / 720;
  let BASE_W = canvas.width;
  let BASE_H = canvas.height;
  let W = BASE_W;
  let H = BASE_H;
  let playerScreenY = H - Math.round(H * PLAYER_Y_INSET_RATIO);

  const CAR_TYPES = window.CAR_TYPES;
  if (!CAR_TYPES || !CAR_TYPES.length) {
    showBootError('cars.js failed to load. Serve the game from a local web server and refresh.');
    return;
  }
  const CAR_ASSET_VERSION = '4';
  const ASSETS = {
    titleScreen: 'assets/title-screen.jpg',
  };

  const LANE_COUNT = 5;
  const GUARD_RAIL_WIDTH = 10;
  const TUNNEL_PERIOD = 3200;
  const TUNNEL_LENGTH = 900;
  const SPEED_STRIP_PERIOD = 1400;
  const SPEED_STRIP_LENGTH = 220;
  const DIFFICULTY_RAMP_DISTANCE = 9000;
  const MAX_SPEED_KMH = 200;
  const NITRO_MAX_SPEED_KMH = 300;
  const NITRO_SPEED_BONUS_KMH = NITRO_MAX_SPEED_KMH - MAX_SPEED_KMH;
  const NITRO_SPEED_RAMP_UP = 120;
  const NITRO_SPEED_RAMP_DOWN = 160;
  const LAUNCH_SPEED_KMH = 100;
  const SPEED_PHASE1_DURATION = 1.5;
  const SPEED_PHASE2_DURATION = 36;
  const WALL_RECOVERY_RATE = 130;
  const WALL_SCORE_PENALTY = 45;
  const ENGINE_PITCH_SCALE = 0.34;
  const ENGINE_FILTER_SCALE = 0.38;

  const ROAD_CAR_WIDTHS = 6;
  const REFERENCE_CAR_WIDTH = CAR_TYPES[0].width;
  const ROAD_EDGE_MARGIN_RATIO = 0.05;
  let ROAD_WIDTH = ROAD_CAR_WIDTHS * REFERENCE_CAR_WIDTH;
  let CURVE_AMPLITUDE = 0;
  const CURVE_NORMAL_MIN = 0.42;
  const CURVE_MARGIN_REACH = 1.06;
  const STEER_CURVE_SAFETY = 0.9;
  const STRAIGHT_SEGMENT_MIN = 580;
  const STRAIGHT_SEGMENT_MAX = 1120;
  const CURVE_SEGMENT_MIN = 720;
  const CURVE_SEGMENT_MAX = 1240;
  const SPEED_TO_KMH = 15;
  const TRAFFIC_KMH_MIN = 60;
  const TRAFFIC_KMH_MAX = 120;
  const FIXED_DT = 1 / 60;
  const MAX_FRAME_DT = 0.25;
  const MAX_SIM_SUBSTEPS = 20;
  let roadStep = 2;
  let simAccumulator = 0;
  const STATE = { LOADING: 0, TITLE: 1, COUNTDOWN: 2, PLAYING: 3, GAMEOVER: 4, PAUSED: 5 };
  const RAMMER_TRAFFIC_INTERVAL = 50;
  const REPAIR_TRAFFIC_INTERVAL = 35;
  const NITRO_TRAFFIC_INTERVAL = 20;
  const BOOST_TRAFFIC_INTERVAL = 35;
  const OFF_ROAD_EXPLODE_DELAY = 2;
  const OFF_ROAD_FALL_GRAVITY = 1.85;
  const WALL_SOUND_VOLUME = 0.75;
  const COUNTDOWN_DURATION = 3;
  const TRAFFIC_MAX_SPEED_RATIO = 0.84;
  const STEER_BASE = 12;
  const MAX_CAR_ANGLE = 0.38;
  const ANGLE_RESPONSIVENESS = 14;
  const TRAFFIC_MIN_GAP = 1.2;
  const TRAFFIC_LANE_SMOOTH = 10;
  const TRAFFIC_COLLISION_COOLDOWN = 0.4;
  const SPINOUT_DURATION = 1.4;
  const SPINOUT_RATE = 9;
  const FATAL_CRASH_DURATION = 1.7;
  const TRAFFIC_LEAD_MIN = 680;
  const TRAFFIC_LEAD_APPROACH_SCALE = 24;
  const TRAFFIC_CULL_ABOVE = 1100;
  const MAX_HIT_POINTS = 3;
  const KNOCKOUT_DURATION = 10;
  const KNOCKOUT_SPIN_MIN = 16;
  const KNOCKOUT_SPIN_MAX = 28;
  const KNOCKOUT_LAUNCH_VX = 12;
  const KNOCKOUT_LAUNCH_VY = 18;
  const TRAFFIC_SPAWN_ABOVE_MIN = 32;
  const TRAFFIC_SPAWN_ABOVE_MAX = 160;
  const TRAFFIC_ON_SCREEN_MIN = 4;
  const TRAFFIC_ON_SCREEN_MAX = 16;
  const TRAFFIC_CAP_RAMP_DISTANCE = 12000;
  const TRAFFIC_BOUNCE_PASSES = 6;
  const TRAFFIC_CONTACT_LINGER = 0.45;
  const PLAYER_HIT_INVULN = 1.1;
  const BOUNCE_STRENGTH = 3.2;
  const BOUNCE_DAMPING = 0.86;
  const DAY_NIGHT_CYCLE = 72;
  const WEATHER_GRIP = { clear: 1, rain: 0.74, fog: 0.9, snow: 0.84 };
  const WEATHER_FOG = { clear: 0, rain: 0.1, fog: 0.78, snow: 0.25 };
  const WEATHER_RAIN = { clear: 0, rain: 1, fog: 0.18, snow: 0.08 };
  const WEATHER_LABELS = { clear: 'Clear', rain: 'Rain', fog: 'Fog', snow: 'Snow' };

  let state = STATE.LOADING;
  let images = {};
  let keys = {};
  let touchControl = {
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    x: 0,
    y: 0,
    steer: 0,
    nitro: false,
  };
  let audioCtx = null;

  let selectedCarIndex = 0;
  let activeCar = CAR_TYPES[0];
  let raceTime = 0;
  let speedPenaltyKmh = 0;
  let recoveryTargetKmh = 0;

  let player = {
    x: W / 2,
    y: playerScreenY,
    width: CAR_TYPES[0].width,
    height: CAR_TYPES[0].height,
    angle: 0,
    prevX: W / 2,
    vx: 0,
  };
  let hitPoints = MAX_HIT_POINTS;
  let playerInvulnTimer = 0;
  let hitFlashTimer = 0;
  let railScrapeTimer = 0;
  let railScrapeSide = 0;
  let wallScrapeSoundTimer = 0;
  let obstacles = [];
  let particles = [];
  let rainDrops = [];
  let weatherSnowflakes = [];
  let weatherType = 'clear';
  let themeParticles = [];
  let pickups = [];
  let floatingTexts = [];
  let activeTheme = null;
  let combo = 0;
  let comboTimer = 0;
  let scoreMultiplier = 1;
  let speedBoostTimer = 0;
  let knockoutTimer = 0;
  let themeBannerTimer = 0;
  let pickupSpawnTimer = 2.5;
  let trafficCarsSinceRammer = 0;
  let trafficCarsSinceRepair = 0;
  let trafficCarsSinceNitro = 0;
  let trafficCarsSinceBoost = 0;
  let driftSparkTimer = 0;
  let showLegend = true;
  let roadOffset = 0;
  let bgOffset = 0;
  let score = 0;
  let distance = 0;
  let speed = 0;
  let nitroSpeedBonusKmh = 0;
  let hudSpeedKmh = 0;
  let nitro = 100;
  let nitroActive = false;
  let spawnTimer = 0;
  let difficulty = 1;
  let shakeTimer = 0;
  let fatalCrash = null;
  let countdownTimer = 0;
  let lastTime = 0;
  let animFrame = 0;
  let roadCurveAnchors = [];
  let perfProfile = {
    tier: 'high',
    renderScale: 1,
    roadStep: 2,
    rainCount: 120,
    shadows: true,
    themeParticles: true,
    showLegendDefault: true,
    bgImageFilter: true,
    particleCap: 90,
    spinoutSparks: true,
    snowCount: 110,
    imageSmoothing: 'high',
  };

  const PERF_PROFILES = {
    high: {
      tier: 'high',
      renderScale: 1,
      roadStep: 2,
      rainCount: 120,
      shadows: true,
      themeParticles: true,
      showLegendDefault: true,
      bgImageFilter: true,
      particleCap: 90,
      spinoutSparks: true,
      snowCount: 110,
      imageSmoothing: 'high',
    },
    medium: {
      tier: 'medium',
      renderScale: 0.82,
      roadStep: 4,
      rainCount: 70,
      shadows: true,
      themeParticles: true,
      showLegendDefault: false,
      bgImageFilter: true,
      particleCap: 60,
      spinoutSparks: true,
      snowCount: 70,
      imageSmoothing: 'medium',
    },
    low: {
      tier: 'low',
      renderScale: 0.62,
      roadStep: 6,
      rainCount: 40,
      shadows: false,
      themeParticles: false,
      showLegendDefault: false,
      bgImageFilter: false,
      particleCap: 35,
      spinoutSparks: false,
      snowCount: 40,
      imageSmoothing: 'low',
    },
    ultralow: {
      tier: 'ultralow',
      renderScale: 0.5,
      roadStep: 8,
      rainCount: 24,
      shadows: false,
      themeParticles: false,
      showLegendDefault: false,
      bgImageFilter: false,
      particleCap: 24,
      spinoutSparks: false,
      snowCount: 24,
      imageSmoothing: 'low',
    },
  };

  function getMaxRoadHalfWidth() {
    const desiredHalf = (ROAD_WIDTH / 2) / CURVE_NORMAL_MIN;
    const edge = getViewportEdgeMarginsInternal();
    const playableWidth = W - edge.left - edge.right;
    return Math.min(desiredHalf, playableWidth / 2);
  }

  function getMaxCurveOffset() {
    const edge = getViewportEdgeMarginsInternal();
    const halfW = getMaxRoadHalfWidth();
    const leftOffset = Math.abs(edge.left + halfW - W / 2);
    const rightOffset = Math.abs((W - edge.right - halfW) - W / 2);
    return Math.max(leftOffset, rightOffset, ROAD_WIDTH) * CURVE_MARGIN_REACH;
  }

  function getWorstSteerMult() {
    return CAR_TYPES.reduce((min, car) => Math.min(min, car.steerMult), 1.4);
  }

  function getSteerLateralPerSecond() {
    const steerMult = activeCar?.steerMult ?? getWorstSteerMult();
    const grip = WEATHER_GRIP.rain;
    return STEER_BASE * steerMult * grip * 60;
  }

  function maxOffsetDeltaForSegment(segLen, forwardSpeed) {
    const steerRate = getSteerLateralPerSecond() * STEER_CURVE_SAFETY;
    const speedPerSecond = Math.max(forwardSpeed, kmhToSpeed(LAUNCH_SPEED_KMH)) * 60;
    return steerRate * segLen * 2 / (Math.PI * speedPerSecond);
  }

  function getSteerBasedMaxCurveOffset() {
    const highSpeed = kmhToSpeed(NITRO_MAX_SPEED_KMH);
    const maxDelta = maxOffsetDeltaForSegment(CURVE_SEGMENT_MIN, highSpeed);
    return maxDelta * 2.1;
  }

  function clampCurveOffset(targetOffset, lastOffset, segLen) {
    const maxAbs = Math.min(getMaxCurveOffset(), getSteerBasedMaxCurveOffset());
    let offset = Math.max(-maxAbs, Math.min(maxAbs, targetOffset));
    const maxDelta = maxOffsetDeltaForSegment(segLen, kmhToSpeed(NITRO_MAX_SPEED_KMH));
    const delta = offset - lastOffset;
    if (Math.abs(delta) > maxDelta) {
      offset = lastOffset + Math.sign(delta) * maxDelta;
    }
    return offset;
  }

  function syncCanvasMetrics() {
    ROAD_WIDTH = ROAD_CAR_WIDTHS * REFERENCE_CAR_WIDTH;
    CURVE_AMPLITUDE = Math.min(getMaxCurveOffset(), getSteerBasedMaxCurveOffset());
  }

  function setLoadingProgress(loaded, total, label) {
    const fill = document.getElementById('loading-fill');
    const text = document.querySelector('.loading-text');
    if (fill) fill.style.width = `${(loaded / total) * 100}%`;
    if (text) text.textContent = label || `LOADING ${loaded}/${total}`;
  }

  function isMobileDevice() {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches
      || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  }

  function selectPerformanceTier(avgFrameMs, isMobile) {
    let tier = 'ultralow';
    if (avgFrameMs < 9) tier = 'high';
    else if (avgFrameMs < 16) tier = 'medium';
    else if (avgFrameMs < 26) tier = 'low';

    if (isMobile) {
      if (tier === 'high') tier = 'medium';
      else if (tier === 'medium') tier = 'low';
      else if (tier === 'low') tier = 'ultralow';
    }
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4 && tier === 'high') {
      tier = 'medium';
    }
    return tier;
  }

  function applyPerformanceProfile(profile) {
    perfProfile = { ...profile };
    roadStep = perfProfile.roadStep;
    resizeCanvas();
  }

  function syncPlayerScreenY() {
    playerScreenY = H - Math.round(H * PLAYER_Y_INSET_RATIO);
    if (player) {
      player.y = playerScreenY;
      player.x = Math.min(Math.max(player.x, W * 0.1), W * 0.9);
    }
  }

  function runPerformanceBenchmark() {
    const sampleCar = images[CAR_TYPES[0].id];
    const bgImg = activeTheme && activeTheme.image
      ? images[`bg-${activeTheme.id}`]
      : null;
    const samples = [];
    const targetFrames = 42;

    return new Promise((resolve) => {
      let frames = 0;

      function benchFrame() {
        const t0 = performance.now();
        ctx.fillStyle = '#080812';
        ctx.fillRect(0, 0, W, H);

        if (bgImg) {
          const scale = Math.max(W / bgImg.width, H / bgImg.height);
          const dw = bgImg.width * scale;
          const dh = bgImg.height * scale;
          const dx = (W - dw) / 2;
          ctx.drawImage(bgImg, dx, 0, dw, dh);
        }

        for (let y = 0; y <= H; y += 2) {
          const left = W * 0.33;
          ctx.fillStyle = `rgb(${19 + (y % 5)}, ${21 + (y % 4)}, ${30 + (y % 6)})`;
          ctx.fillRect(left, y, W * 0.34, 3);
        }

        if (sampleCar) {
          for (let i = 0; i < 7; i++) {
            ctx.drawImage(sampleCar, 180 + i * 95, 90 + (i % 3) * 70, 58, 34);
          }
        }

        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = 'rgba(150, 200, 255, 0.25)';
          ctx.fillRect(Math.random() * W, Math.random() * H, 1, 8);
        }

        samples.push(performance.now() - t0);
        frames += 1;
        if (frames < targetFrames) {
          requestAnimationFrame(benchFrame);
        } else {
          const avgFrameMs = samples.reduce((sum, n) => sum + n, 0) / samples.length;
          resolve({ avgFrameMs, isMobile: isMobileDevice() });
        }
      }

      requestAnimationFrame(benchFrame);
    });
  }

  function trimParticles() {
    const cap = perfProfile.particleCap;
    if (particles.length > cap) {
      particles.splice(0, particles.length - cap);
    }
  }

  function loadImage(key, src, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`Timed out loading ${src}`));
      }, timeoutMs);

      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ key, img });
      };
      img.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(`Failed to load ${src}`));
      };
      img.src = src;
    });
  }

  function resolveActiveTheme() {
    if (typeof window.pickRandomTheme === 'function') {
      return window.pickRandomTheme();
    }
    return {
      id: 'fallback-night',
      name: 'Tokyo Night Run',
      subtitle: 'Neon streets after dark',
      rain: 0.6,
      draw(ctx, width, height) {
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#0a0618');
        grad.addColorStop(0.5, '#1a1040');
        grad.addColorStop(1, '#060610');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      },
    };
  }

  async function loadAssets() {
    activeTheme = resolveActiveTheme();

    const carEntries = CAR_TYPES.map((car) => [
      car.id,
      `${car.asset}?v=${CAR_ASSET_VERSION}`,
    ]);
    const themeBgEntry = activeTheme.image
      ? [[`bg-${activeTheme.id}`, activeTheme.image]]
      : [];
    const entries = [...Object.entries(ASSETS), ...themeBgEntry, ...carEntries];
    const total = entries.length;
    let loaded = 0;
    setLoadingProgress(0, total, `LOADING ASSETS 0/${total}`);

    const results = [];
    for (const [key, src] of entries) {
      const result = await loadImage(key, src, 30000);
      results.push(result);
      loaded++;
      setLoadingProgress(loaded, total, `LOADING ASSETS ${loaded}/${total}`);
    }

    results.forEach(({ key, img }) => { images[key] = img; });

    setLoadingProgress(total, total, 'TESTING DEVICE SPEED...');
    const bench = await runPerformanceBenchmark();
    const tier = selectPerformanceTier(bench.avgFrameMs, bench.isMobile);
    applyPerformanceProfile(PERF_PROFILES[tier]);
    themeParticles = perfProfile.themeParticles && activeTheme.initParticles
      ? activeTheme.initParticles(W, H)
      : [];
    initRain();

    document.getElementById('title-bg').style.backgroundImage = `url(${ASSETS.titleScreen})`;
    document.getElementById('loading').classList.add('hidden');
    showTitle();
  }

  function statBar(value, max) {
    const filled = Math.max(1, Math.min(5, Math.round((value / max) * 5)));
    return '▮'.repeat(filled) + '▯'.repeat(5 - filled);
  }

  function updateCarSelectUI() {
    const car = CAR_TYPES[selectedCarIndex];
    document.getElementById('car-preview').src = `${car.asset}?v=${CAR_ASSET_VERSION}`;
    document.getElementById('car-name').textContent = car.name;
    document.getElementById('car-tagline').textContent = car.tagline;
    document.getElementById('car-stats').innerHTML = `
      <span>Speed</span><span>${statBar(car.baseSpeed, 7)}</span>
      <span>Handling</span><span>${statBar(car.steerMult, 1.4)}</span>
      <span>Nitro</span><span>${statBar(car.nitroMult, 2)}</span>
      <span>Efficiency</span><span>${statBar(1.2 - car.nitroDrain, 0.7)}</span>
    `;
  }

  function pickRandomCar() {
    selectedCarIndex = Math.floor(Math.random() * CAR_TYPES.length);
    updateCarSelectUI();
  }

  function changeCar(delta) {
    selectedCarIndex = (selectedCarIndex + delta + CAR_TYPES.length) % CAR_TYPES.length;
    updateCarSelectUI();
    initAudio();
    previewEngineSound();
  }

  function pickTrafficCar() {
    const pool = [];
    CAR_TYPES.forEach((car, index) => {
      if (activeCar && car.id === activeCar.id) return;
      for (let i = 0; i < car.trafficWeight; i++) pool.push(index);
    });
    if (!pool.length) return CAR_TYPES[(selectedCarIndex + 1) % CAR_TYPES.length];
    return CAR_TYPES[pool[Math.floor(Math.random() * pool.length)]];
  }

  function worldYAtScreenY(screenY) {
    return roadOffset + (H - screenY);
  }

  function initRoadCurve() {
    roadCurveAnchors = [
      { wy: 0, offset: 0, type: 'straight' },
      { wy: H - playerScreenY, offset: 0, type: 'straight' },
    ];
    ensureRoadCurveUpTo(20000);
  }

  function pickCurveTarget(currentOffset) {
    const roll = Math.random();
    if (roll < 0.24) {
      const sign = currentOffset > 0 ? -1 : 1;
      return sign * CURVE_AMPLITUDE * (0.44 + Math.random() * 0.16);
    }
    if (roll < 0.68) {
      return (Math.random() < 0.5 ? -1 : 1) * CURVE_AMPLITUDE * (0.8 + Math.random() * 0.2);
    }
    return currentOffset * 0.36;
  }

  function appendRoadSegment(last, type) {
    let segLen;
    let offset;
    if (type === 'straight') {
      segLen = STRAIGHT_SEGMENT_MIN + Math.random() * (STRAIGHT_SEGMENT_MAX - STRAIGHT_SEGMENT_MIN);
      offset = last.offset;
    } else {
      segLen = CURVE_SEGMENT_MIN + Math.random() * (CURVE_SEGMENT_MAX - CURVE_SEGMENT_MIN);
      offset = clampCurveOffset(pickCurveTarget(last.offset), last.offset, segLen);
    }
    roadCurveAnchors.push({ wy: last.wy + segLen, offset, type });
  }

  function ensureRoadCurveUpTo(targetWy) {
    while (roadCurveAnchors[roadCurveAnchors.length - 1].wy < targetWy) {
      const last = roadCurveAnchors[roadCurveAnchors.length - 1];
      const lastType = last.type || 'straight';
      let nextType;
      if (lastType === 'straight') {
        nextType = 'curve';
      } else if (Math.random() < 0.78) {
        nextType = 'straight';
      } else {
        nextType = 'curve';
      }
      appendRoadSegment(last, nextType);
    }
  }

  function interpolateSegmentOffset(a, b, wy) {
    const t = (wy - a.wy) / (b.wy - a.wy);
    if (a.type === 'straight' && b.type === 'straight' && Math.abs(a.offset - b.offset) < 1) {
      return a.offset;
    }
    if (a.type === 'straight' && Math.abs(a.offset - b.offset) < 1) {
      return a.offset;
    }
    if (b.type === 'straight' && Math.abs(a.offset - b.offset) < 1) {
      return b.offset;
    }
    const curveT = 0.5 - 0.5 * Math.cos(Math.max(0, Math.min(1, t)) * Math.PI);
    return a.offset + (b.offset - a.offset) * curveT;
  }

  function roadOffsetAtWorldY(wy) {
    ensureRoadCurveUpTo(wy + 6000);
    for (let i = 0; i < roadCurveAnchors.length - 1; i++) {
      const a = roadCurveAnchors[i];
      const b = roadCurveAnchors[i + 1];
      if (wy >= a.wy && wy <= b.wy) {
        return interpolateSegmentOffset(a, b, wy);
      }
    }
    return roadCurveAnchors[roadCurveAnchors.length - 1].offset;
  }

  function roadCenterAtScreenY(screenY) {
    const wy = worldYAtScreenY(screenY);
    return W / 2 + roadOffsetAtWorldY(wy);
  }

  function kmhToSpeed(kmh) {
    return kmh / SPEED_TO_KMH;
  }

  function speedToKmh(gameSpeed) {
    return gameSpeed * SPEED_TO_KMH;
  }

  function targetSpeedKmh(elapsed, maxKmh = MAX_SPEED_KMH) {
    if (elapsed <= SPEED_PHASE1_DURATION) {
      const t = elapsed / SPEED_PHASE1_DURATION;
      const eased = 1 - (1 - t) ** 3;
      return LAUNCH_SPEED_KMH * eased;
    }
    const phase2 = Math.min(1, (elapsed - SPEED_PHASE1_DURATION) / SPEED_PHASE2_DURATION);
    const eased = phase2 * phase2 * (3 - 2 * phase2);
    return LAUNCH_SPEED_KMH + (maxKmh - LAUNCH_SPEED_KMH) * eased;
  }

  function baseTargetKmh() {
    const stripMult = speedBoostTimer > 0 ? 1.1 : 1;
    return Math.min(MAX_SPEED_KMH, targetSpeedKmh(raceTime, MAX_SPEED_KMH)) * stripMult;
  }

  function currentTargetKmh() {
    return baseTargetKmh() + nitroSpeedBonusKmh;
  }

  function updateNitroSpeedBonus(dt) {
    const bonusTarget = nitroActive ? NITRO_SPEED_BONUS_KMH : 0;
    const ramp = nitroActive ? NITRO_SPEED_RAMP_UP : NITRO_SPEED_RAMP_DOWN;
    if (nitroSpeedBonusKmh < bonusTarget) {
      nitroSpeedBonusKmh = Math.min(bonusTarget, nitroSpeedBonusKmh + dt * ramp);
    } else if (nitroSpeedBonusKmh > bonusTarget) {
      nitroSpeedBonusKmh = Math.max(bonusTarget, nitroSpeedBonusKmh - dt * ramp);
    }
  }

  function updatePlayerSpeed(dt) {
    raceTime += dt;
    updateNitroSpeedBonus(dt);
    const curveKmh = currentTargetKmh();

    if (speedPenaltyKmh > 0) {
      const recoveryRate = recoveryTargetKmh > 0 ? WALL_RECOVERY_RATE : 20;
      speedPenaltyKmh = Math.max(0, speedPenaltyKmh - dt * recoveryRate);
    }

    let targetKmh = curveKmh;
    if (recoveryTargetKmh > 0) {
      targetKmh = Math.max(recoveryTargetKmh, curveKmh) - speedPenaltyKmh;
      if (speedPenaltyKmh <= 0) recoveryTargetKmh = 0;
    } else if (speedPenaltyKmh > 0) {
      targetKmh = curveKmh - speedPenaltyKmh;
    }

    targetKmh = Math.max(0, targetKmh);
    speed = kmhToSpeed(targetKmh);
    hudSpeedKmh += (targetKmh - hudSpeedKmh) * Math.min(1, dt * 10);
  }

  function effectiveSpeedKmh() {
    const curveKmh = currentTargetKmh();
    if (recoveryTargetKmh > 0) {
      return Math.max(0, Math.max(recoveryTargetKmh, curveKmh) - speedPenaltyKmh);
    }
    return curveKmh;
  }

  function beginWallSpeedRecovery() {
    const topKmh = effectiveSpeedKmh();
    recoveryTargetKmh = topKmh;
    speedPenaltyKmh = topKmh * 0.2;
  }

  function applySpeedPenalty(kmhLoss) {
    speedPenaltyKmh = Math.min(speedPenaltyKmh + kmhLoss, NITRO_MAX_SPEED_KMH * 0.4);
  }

  function penalizeRaceProgress(seconds) {
    raceTime = Math.max(0, raceTime - seconds);
  }

  function maxTrafficSpeed(currentSpeed) {
    return Math.min(
      kmhToSpeed(TRAFFIC_KMH_MAX),
      currentSpeed * TRAFFIC_MAX_SPEED_RATIO,
      currentSpeed - 0.4
    );
  }

  function clampTrafficSpeed(obs, currentSpeed) {
    const cap = maxTrafficSpeed(currentSpeed);
    if (obs.speed > cap) obs.speed = cap;
    return obs.speed;
  }

  function randomTrafficSpeed(currentSpeed) {
    const currentKmh = speedToKmh(currentSpeed);
    const minKmh = currentKmh < TRAFFIC_KMH_MIN
      ? Math.max(16, currentKmh * 0.58)
      : TRAFFIC_KMH_MIN;
    const maxKmh = Math.min(
      TRAFFIC_KMH_MAX,
      Math.max(minKmh + 3, speedToKmh(maxTrafficSpeed(currentSpeed)))
    );
    if (maxKmh <= minKmh) {
      const fallbackKmh = Math.max(12, minKmh * 0.9);
      return { speed: kmhToSpeed(fallbackKmh), kmh: Math.round(fallbackKmh) };
    }
    const kmh = minKmh + Math.random() * (maxKmh - minKmh);
    return { speed: kmhToSpeed(kmh), kmh: Math.round(kmh) };
  }

  function screenYFromWorldY(worldY) {
    return H - (worldY - roadOffset);
  }

  function obstacleWorldY(obs) {
    return roadOffset + (H - obs.y);
  }

  function trafficSpawnScreenY(height) {
    return -height - TRAFFIC_SPAWN_ABOVE_MIN - Math.random() * (TRAFFIC_SPAWN_ABOVE_MAX - TRAFFIC_SPAWN_ABOVE_MIN);
  }

  function isSpawnOnRoad(x, y, width, height) {
    const centerY = y + height * 0.52;
    const bounds = roadBoundsAtScreenY(centerY);
    const halfW = width * 0.5;
    return x - halfW >= bounds.left + 6 && x + halfW <= bounds.right - 6;
  }

  function isTrafficOffRoad(obs) {
    const centerY = obs.y + obs.height * 0.52;
    const bounds = roadBoundsAtScreenY(centerY);
    const halfW = obs.width * 0.45;
    return obs.x - halfW < bounds.left || obs.x + halfW > bounds.right;
  }

  function shouldTriggerOffRoadFall(obs) {
    if (obs.offRoadFall || obs.exploded) return false;
    if (!isTrafficOffRoad(obs)) return false;
    return (
      obs.knockedOut
      || obs.spinOutTimer > 0
      || (obs.trafficContactTimer || 0) > 0
      || Math.abs(obs.vx || 0) > 3
    );
  }

  function explodeOffRoadTraffic(obs) {
    if (obs.exploded) return;
    obs.exploded = true;
    const cx = obs.x;
    const cy = obs.y + obs.height * 0.45;
    spawnCarExplosion(cx, cy, obs.width, obs.height, obs.carType.glow || '#ff8c3a');
    playExplosionSound();
    shakeTimer = Math.max(shakeTimer, 5);
  }

  function isTrafficBehind(obs) {
    return obs.y + obs.height * 0.4 > player.y + player.height * 0.45;
  }

  function getTrafficCap() {
    const progress = Math.min(1, distance / TRAFFIC_CAP_RAMP_DISTANCE);
    return Math.round(
      TRAFFIC_ON_SCREEN_MIN + progress * (TRAFFIC_ON_SCREEN_MAX - TRAFFIC_ON_SCREEN_MIN)
    );
  }

  function activeTrafficCount() {
    return obstacles.filter((obs) => !obs.knockedOut && !obs.offRoadFall && !obs.exploded).length;
  }

  function trafficOverlapsOther(obs, skipIndex) {
    for (let i = 0; i < obstacles.length; i++) {
      if (i === skipIndex || obstacles[i].knockedOut || obstacles[i].offRoadFall || obstacles[i].exploded) continue;
      if (carsOverlap(obs, obstacles[i])) return true;
    }
    return false;
  }

  function roadNormalAtScreenY(screenY) {
    const sample = Math.max(4, roadStep * 2);
    const yAbove = Math.max(0, screenY - sample);
    const yBelow = Math.min(H, screenY + sample);
    const center = roadCenterAtScreenY(screenY);
    const centerAbove = roadCenterAtScreenY(yAbove);
    const centerBelow = roadCenterAtScreenY(yBelow);
    const tx = centerBelow - centerAbove;
    const ty = yBelow - yAbove;
    const len = Math.hypot(tx, ty) || 1;
    return {
      center,
      nx: ty / len,
      ny: -tx / len,
    };
  }

  function getRoadEdgeMarginCssPx() {
    const container = document.getElementById('game-container');
    const width = container?.clientWidth || window.innerWidth || BASE_W;
    return width * ROAD_EDGE_MARGIN_RATIO;
  }

  function getViewportEdgeMarginsInternal() {
    const fallback = W * ROAD_EDGE_MARGIN_RATIO;
    const container = document.getElementById('game-container');
    if (!container || !canvas) {
      return { left: fallback, right: fallback };
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) {
      return { left: fallback, right: fallback };
    }

    const containerRect = container.getBoundingClientRect();
    const marginCss = getRoadEdgeMarginCssPx();
    const leftInternal = ((containerRect.left + marginCss - rect.left) / rect.width) * W;
    const rightInternal = ((containerRect.right - marginCss - rect.left) / rect.width) * W;
    return {
      left: Math.max(0, leftInternal),
      right: Math.max(0, W - rightInternal),
    };
  }

  function getViewportEdgeMarkerPositions() {
    const margins = getViewportEdgeMarginsInternal();
    return [margins.left, W - margins.right];
  }

  function roadBoundsAtScreenY(screenY) {
    const { center, nx } = roadNormalAtScreenY(screenY);
    const absNx = Math.max(CURVE_NORMAL_MIN, Math.abs(nx));
    const desiredHalf = (ROAD_WIDTH / 2) / absNx;
    const edge = getViewportEdgeMarginsInternal();
    const playableWidth = W - edge.left - edge.right;
    const maxHalf = playableWidth / 2;
    const horizontalHalf = Math.min(desiredHalf, maxHalf);

    const minCenter = edge.left + horizontalHalf;
    const maxCenter = W - edge.right - horizontalHalf;
    let clampedCenter = center;
    if (minCenter <= maxCenter) {
      clampedCenter = Math.max(minCenter, Math.min(maxCenter, center));
    } else {
      clampedCenter = W / 2;
    }

    const left = clampedCenter - horizontalHalf;
    const right = clampedCenter + horizontalHalf;
    return {
      left,
      right,
      center: clampedCenter,
      width: right - left,
    };
  }

  function laneFractionAt(laneIndex) {
    return (laneIndex + 0.5) / LANE_COUNT;
  }

  function laneXAt(screenY, laneIndex) {
    return laneXFromFraction(screenY, laneFractionAt(laneIndex));
  }

  function laneXFromFraction(screenY, fraction) {
    const bounds = roadBoundsAtScreenY(screenY);
    return bounds.left + bounds.width * fraction;
  }

  function buildRoadClipPath() {
    const leftPts = [];
    const rightPts = [];
    for (let y = 0; y <= H; y += roadStep) {
      const bounds = roadBoundsAtScreenY(y);
      leftPts.push({ x: bounds.left, y });
      rightPts.push({ x: bounds.right, y });
    }
    ctx.beginPath();
    ctx.moveTo(leftPts[0].x, leftPts[0].y);
    leftPts.forEach((p) => ctx.lineTo(p.x, p.y));
    for (let i = rightPts.length - 1; i >= 0; i--) {
      ctx.lineTo(rightPts[i].x, rightPts[i].y);
    }
    ctx.closePath();
  }

  function playerRoadLimits(screenY) {
    const bounds = roadBoundsAtScreenY(screenY);
    const halfW = player.width * 0.38;
    const inset = GUARD_RAIL_WIDTH + 6;
    return {
      left: bounds.left + inset + halfW,
      right: bounds.right - inset - halfW,
      bounds,
    };
  }

  function clampPlayerToRoad() {
    const limits = playerRoadLimits(player.y);
    if (player.x < limits.left) {
      player.x = limits.left;
      scrapeGuardRail(-1);
    } else if (player.x > limits.right) {
      player.x = limits.right;
      scrapeGuardRail(1);
    }
  }

  function scrapeGuardRail(side) {
    railScrapeTimer = 0.18;
    railScrapeSide = side;
    shakeTimer = Math.max(shakeTimer, 4);
    beginWallSpeedRecovery();
    if (wallScrapeSoundTimer <= 0) {
      initAudio();
      playWallScrapeSound();
      const penalty = Math.floor(WALL_SCORE_PENALTY * difficulty);
      score = Math.max(0, score - penalty);
      addFloatingText(player.x, player.y - 54, `-${penalty}`, '#ff6eb4');
      wallScrapeSoundTimer = 0.1;
    }
    if (animFrame % 2 === 0) {
      const limits = playerRoadLimits(player.y);
      const x = side < 0 ? limits.bounds.left + GUARD_RAIL_WIDTH : limits.bounds.right - GUARD_RAIL_WIDTH;
      particles.push({
        x: x + side * 4,
        y: player.y + player.height * 0.45 + Math.random() * 20,
        vx: side * (2 + Math.random() * 3),
        vy: -1 + Math.random() * 2,
        life: 1,
        decay: 0.06 + Math.random() * 0.04,
        color: '#ffe14d',
        size: 3 + Math.random() * 4,
      });
    }
  }

  function isInTunnel(wy) {
    const phase = wy % TUNNEL_PERIOD;
    return phase < TUNNEL_LENGTH;
  }

  function tunnelPhase(wy) {
    return (wy % TUNNEL_PERIOD) / TUNNEL_LENGTH;
  }

  function isOnSpeedStrip(wy) {
    const phase = wy % SPEED_STRIP_PERIOD;
    return phase < SPEED_STRIP_LENGTH;
  }

  function setHudOverlayVisible(visible) {
    const overlay = document.getElementById('hud-overlay');
    if (overlay) overlay.classList.toggle('hidden', !visible);
  }

  function updateHtmlHud() {
    const hpPanel = document.getElementById('hud-hp');
    const hpValue = document.getElementById('hud-hp-value');
    const scoreValue = document.getElementById('hud-score-value');
    const distanceValue = document.getElementById('hud-distance-value');
    const speedValue = document.getElementById('hud-speed-value');
    const carName = document.getElementById('hud-car-name');
    const nitroPanel = document.getElementById('hud-nitro');
    const nitroFill = document.getElementById('hud-nitro-fill');
    const nitroPct = document.getElementById('hud-nitro-pct');
    const envBadge = document.getElementById('hud-env');
    const nitroBoost = document.getElementById('hud-nitro-boost');
    const comboPanel = document.getElementById('hud-combo');
    const comboMain = document.getElementById('hud-combo-main');
    const comboSub = document.getElementById('hud-combo-sub');
    if (!hpPanel || !scoreValue || !nitroFill) return;

    hpPanel.classList.toggle('critical', hitPoints <= 1);
    if (hpValue) hpValue.textContent = String(hitPoints);
    document.querySelectorAll('.hud-hp-seg').forEach((seg, index) => {
      seg.classList.toggle('filled', index < hitPoints);
    });

    scoreValue.textContent = Math.floor(score).toLocaleString();
    if (distanceValue) distanceValue.textContent = String(Math.floor(distance));
    if (speedValue) speedValue.textContent = String(Math.round(hudSpeedKmh));
    if (carName) carName.textContent = activeCar.name.toUpperCase();

    nitroFill.style.width = `${Math.max(0, Math.min(100, nitro))}%`;
    if (nitroPct) nitroPct.textContent = `${Math.floor(nitro)}%`;
    nitroPanel.classList.toggle('active', nitroActive);
    if (nitroBoost) nitroBoost.classList.toggle('hidden', !nitroActive);

    const lighting = getDayNightLighting();
    if (envBadge) {
      const showEnv = themeBannerTimer <= 0;
      envBadge.classList.toggle('hidden', !showEnv);
      envBadge.classList.toggle('night', lighting.isNight);
      if (showEnv) {
        envBadge.textContent = `${WEATHER_LABELS[weatherType]} · ${lighting.label}`;
      }
    }

    if (comboPanel && comboMain && comboSub) {
      const showCombo = combo > 1 || scoreMultiplier > 1.01;
      comboPanel.classList.toggle('hidden', !showCombo);
      if (showCombo) {
        comboMain.textContent = combo > 1 ? `COMBO x${combo}` : '';
        comboSub.textContent = scoreMultiplier > 1.01 ? `${scoreMultiplier.toFixed(1)}x score` : '';
        comboSub.style.display = scoreMultiplier > 1.01 ? 'block' : 'none';
        comboMain.style.display = combo > 1 ? 'block' : 'none';
      }
    }
  }

  function showTitle() {
    state = STATE.TITLE;
    pickRandomCar();
    setHudOverlayVisible(false);
    document.getElementById('title-screen').classList.remove('hidden');
    document.getElementById('title-screen').classList.add('active');
    document.getElementById('game-over-screen').classList.add('hidden');
  }

  function startGame() {
    state = STATE.COUNTDOWN;
    countdownTimer = COUNTDOWN_DURATION;
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');

    activeCar = CAR_TYPES[selectedCarIndex];

    player = {
      x: W / 2,
      y: playerScreenY,
      width: activeCar.width,
      height: activeCar.height,
      angle: 0,
      prevX: W / 2,
      vx: 0,
    };
    hitPoints = MAX_HIT_POINTS;
    playerInvulnTimer = 0;
    hitFlashTimer = 0;
    obstacles = [];
    particles = [];
    roadOffset = 0;
    bgOffset = 0;
    railScrapeTimer = 0;
    railScrapeSide = 0;
    wallScrapeSoundTimer = 0;
    score = 0;
    distance = 0;
    speed = 0;
    nitroSpeedBonusKmh = 0;
    hudSpeedKmh = 0;
    raceTime = 0;
    speedPenaltyKmh = 0;
    recoveryTargetKmh = 0;
    nitro = 100;
    nitroActive = false;
    spawnTimer = 0;
    difficulty = 1;
    shakeTimer = 0;
    fatalCrash = null;
    pickups = [];
    floatingTexts = [];
    combo = 0;
    comboTimer = 0;
    scoreMultiplier = 1;
    speedBoostTimer = 0;
    knockoutTimer = 0;
    themeBannerTimer = 3.2;
    pickupSpawnTimer = 0.8;
    trafficCarsSinceRammer = 0;
    trafficCarsSinceRepair = 0;
    trafficCarsSinceNitro = 0;
    trafficCarsSinceBoost = 0;
    driftSparkTimer = 0;
    showLegend = perfProfile.showLegendDefault;
    lastTime = performance.now();
    simAccumulator = 0;
    syncCanvasMetrics();
    initRoadCurve();
    weatherType = pickWeather(activeTheme);
    if (weatherType === 'snow') initWeatherSnow();
    else weatherSnowflakes = [];
    initRain();
    initAudio();
    playEngineSound(activeCar);
  }

  function gameOver() {
    state = STATE.GAMEOVER;
    setHudOverlayVisible(false);
    stopEngineSound();
    if (!fatalCrash) playCrashSound();
    document.getElementById('final-score').textContent = Math.floor(score).toLocaleString();
    document.getElementById('final-distance').textContent = Math.floor(distance).toLocaleString();
    const panel = document.getElementById('game-over-screen');
    panel.classList.remove('hidden');
    panel.classList.add('active');
    shakeTimer = 20;
  }

  function initRain() {
    rainDrops = [];
    const count = perfProfile.rainCount;
    for (let i = 0; i < count; i++) {
      rainDrops.push({
        x: Math.random() * W,
        y: Math.random() * H,
        speed: 8 + Math.random() * 12,
        len: 10 + Math.random() * 20,
        opacity: 0.1 + Math.random() * 0.3,
      });
    }
  }

  function pickWeather(theme) {
    const roll = Math.random();
    const rainBias = theme?.rain || 0;
    if (theme?.id === 'kyoto-winter') {
      if (roll < 0.62) return 'snow';
      if (roll < 0.82) return 'fog';
      return 'clear';
    }
    if (rainBias > 0.55) {
      if (roll < 0.52) return 'rain';
      if (roll < 0.72) return 'fog';
      return 'clear';
    }
    if (rainBias > 0.15) {
      if (roll < 0.34) return 'rain';
      if (roll < 0.48) return 'fog';
      return 'clear';
    }
    if (roll < 0.18) return 'fog';
    if (roll < 0.3) return 'snow';
    if (roll < 0.48) return 'rain';
    return 'clear';
  }

  function initWeatherSnow() {
    weatherSnowflakes = [];
    const count = perfProfile.snowCount || 110;
    for (let i = 0; i < count; i++) {
      weatherSnowflakes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        speed: 0.6 + Math.random() * 1.6,
        drift: (Math.random() - 0.5) * 1.4,
        size: 1.5 + Math.random() * 3.5,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function updateWeatherSnow(dt, scroll) {
    weatherSnowflakes.forEach((flake) => {
      flake.y += flake.speed + scroll * 0.25;
      flake.x += flake.drift + Math.sin(flake.phase) * 0.35;
      flake.phase += dt * 1.8;
      if (flake.y > H + 10) {
        flake.y = -10;
        flake.x = Math.random() * W;
      }
      if (flake.x < -10) flake.x = W + 10;
      if (flake.x > W + 10) flake.x = -10;
    });
  }

  function getDayNightPhase() {
    return (raceTime % DAY_NIGHT_CYCLE) / DAY_NIGHT_CYCLE;
  }

  function getDayNightLighting() {
    const phase = getDayNightPhase();
    const sun = Math.sin(phase * Math.PI * 2 - Math.PI / 2) * 0.5 + 0.5;
    return {
      phase,
      sun,
      isNight: sun < 0.34,
      label: getTimeOfDayLabel(phase),
    };
  }

  function getTimeOfDayLabel(phase) {
    if (phase < 0.1 || phase >= 0.9) return 'Night';
    if (phase < 0.22) return 'Dawn';
    if (phase < 0.58) return 'Day';
    if (phase < 0.78) return 'Dusk';
    return 'Night';
  }

  function weatherGripMult() {
    return WEATHER_GRIP[weatherType] || 1;
  }

  function weatherSteerSlip() {
    if (weatherType === 'rain') return 0.72;
    if (weatherType === 'snow') return 0.8;
    return 1;
  }

  function fogVisibilityAtY(screenY) {
    const fog = WEATHER_FOG[weatherType] || 0;
    if (fog <= 0) return 1;
    const depth = 1 - screenY / H;
    return 1 - fog * (0.25 + depth * 0.75);
  }

  function rainIntensity() {
    const themeRain = activeTheme ? activeTheme.rain || 0 : 0;
    const weatherRain = WEATHER_RAIN[weatherType] || 0;
    return Math.min(1.2, themeRain * 0.35 + weatherRain);
  }

  function drawDayNightOverlay() {
    const { sun } = getDayNightLighting();
    if (sun > 0.97) return;

    ctx.save();
    if (sun < 0.38) {
      const night = 1 - sun / 0.38;
      ctx.fillStyle = `rgba(6, 10, 36, ${0.5 * night})`;
      ctx.fillRect(0, 0, W, H);
      const moonGlow = ctx.createRadialGradient(W * 0.78, H * 0.14, 0, W * 0.78, H * 0.14, 120);
      moonGlow.addColorStop(0, `rgba(180, 200, 255, ${0.12 * night})`);
      moonGlow.addColorStop(1, 'rgba(180, 200, 255, 0)');
      ctx.fillStyle = moonGlow;
      ctx.fillRect(0, 0, W, H);
    } else if (sun < 0.58 || sun > 0.82) {
      const twilight = sun < 0.58
        ? 1 - sun / 0.58
        : (sun - 0.82) / 0.18;
      const grad = ctx.createLinearGradient(0, 0, 0, H * 0.55);
      grad.addColorStop(0, `rgba(255, 120, 60, ${0.18 * twilight})`);
      grad.addColorStop(0.5, `rgba(120, 50, 120, ${0.1 * twilight})`);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    } else if (sun > 0.58 && sun < 0.82) {
      ctx.fillStyle = `rgba(255, 240, 200, ${(sun - 0.58) * 0.06})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  function drawFogOverlay() {
    const fog = WEATHER_FOG[weatherType] || 0;
    if (fog <= 0.02) return;

    ctx.save();
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, `rgba(196, 206, 222, ${0.62 * fog})`);
    grad.addColorStop(0.28, `rgba(176, 188, 208, ${0.34 * fog})`);
    grad.addColorStop(0.62, `rgba(150, 165, 185, ${0.1 * fog})`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawWeatherSnow() {
    if (weatherType !== 'snow' || !weatherSnowflakes.length) return;
    ctx.save();
    weatherSnowflakes.forEach((flake) => {
      ctx.globalAlpha = 0.55 + Math.sin(flake.phase) * 0.2;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#cfe8ff';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.arc(flake.x, flake.y, flake.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawHeadlightBeams(x, y, width, height, beamLength = 95) {
    const frontY = y + height * 0.14;
    const beamEndY = frontY - beamLength;
    const spread = width * 0.42;
    ctx.save();
    ctx.globalAlpha = 0.55;
    const cone = ctx.createLinearGradient(x, frontY, x, beamEndY);
    cone.addColorStop(0, 'rgba(255, 252, 210, 0.55)');
    cone.addColorStop(0.45, 'rgba(255, 248, 180, 0.18)');
    cone.addColorStop(1, 'rgba(255, 248, 180, 0)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(x - 7, frontY);
    ctx.lineTo(x - spread, beamEndY);
    ctx.lineTo(x + spread, beamEndY);
    ctx.lineTo(x + 7, frontY);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#fff8c8';
    ctx.shadowColor = '#fff8c8';
    ctx.shadowBlur = 10;
    const lampY = y + height * 0.1;
    ctx.fillRect(x - width * 0.24, lampY, 5, 4);
    ctx.fillRect(x + width * 0.19, lampY, 5, 4);
    ctx.restore();
  }

  function drawPlayerHeadlights() {
    const { isNight } = getDayNightLighting();
    if (!isNight) return;
    const scale = nitroActive ? 1.05 : 1;
    drawHeadlightBeams(
      player.x,
      player.y,
      player.width * scale,
      player.height * scale,
      110
    );
  }

  function getHudTints() {
    const lighting = getDayNightLighting();
    const night = lighting.isNight;
    return {
      score: night ? '#9fd4ff' : '#ffe14d',
      distance: night ? '#6ec8ff' : '#8be9ff',
      speed: night ? (nitroActive ? '#ff8fd0' : '#ffd080') : (nitroActive ? '#ff6eb4' : '#ffe14d'),
      panelAlpha: night ? 0.88 : 1,
    };
  }

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let engineNodes = [];

  function stopEngineSound() {
    engineNodes.forEach((node) => {
      try { node.stop(); } catch (_) {}
      try { node.disconnect(); } catch (_) {}
    });
    engineNodes = [];
    engineOsc = null;
    engineOsc2 = null;
    engineGain = null;
    engineFilter = null;
  }

  function playEngineSound(car) {
    if (!audioCtx) return;
    stopEngineSound();
    const e = car.engine;

    engineGain = audioCtx.createGain();
    engineFilter = audioCtx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = e.filter * ENGINE_FILTER_SCALE;
    engineFilter.Q.value = 1.1;
    engineFilter.connect(engineGain);
    engineGain.connect(audioCtx.destination);
    engineGain.gain.value = e.volume;

    engineOsc = audioCtx.createOscillator();
    engineOsc.type = e.wave;
    engineOsc.frequency.value = e.baseFreq * ENGINE_PITCH_SCALE;
    engineOsc.connect(engineFilter);
    engineOsc.start();
    engineNodes.push(engineOsc);

    if (e.harmonic) {
      engineOsc2 = audioCtx.createOscillator();
      engineOsc2.type = e.harmonicWave || 'square';
      engineOsc2.frequency.value = e.harmonic * ENGINE_PITCH_SCALE;
      const harmGain = audioCtx.createGain();
      harmGain.gain.value = e.harmonicVol || 0.012;
      engineOsc2.connect(harmGain);
      harmGain.connect(engineFilter);
      engineOsc2.start();
      engineNodes.push(engineOsc2);
    }
  }

  function previewEngineSound() {
    const car = CAR_TYPES[selectedCarIndex];
    playEngineSound(car);
    setTimeout(() => {
      if (state === STATE.TITLE) stopEngineSound();
    }, 450);
  }

  function updateEngineSound() {
    if (!engineOsc || !activeCar) return;
    const e = activeCar.engine;
    const targetFreq = (e.baseFreq + speed * e.freqScale + (nitroActive ? e.nitroBoost : 0)) * ENGINE_PITCH_SCALE;
    engineOsc.frequency.value += (targetFreq - engineOsc.frequency.value) * 0.12;
    if (engineOsc2) {
      const harmTarget = ((e.harmonic || e.baseFreq * 2) + speed * e.freqScale * 1.5) * ENGINE_PITCH_SCALE;
      engineOsc2.frequency.value += (harmTarget - engineOsc2.frequency.value) * 0.1;
    }
    if (engineFilter) {
      const filterTarget = e.filter * ENGINE_FILTER_SCALE + speed * e.freqScale * 2.2;
      engineFilter.frequency.value += (filterTarget - engineFilter.frequency.value) * 0.08;
    }
    if (engineGain) {
      const targetVol = nitroActive ? e.nitroVolume : e.volume;
      engineGain.gain.value += (targetVol - engineGain.gain.value) * 0.1;
    }
  }

  function playWallScrapeSound() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const impact = Math.min(1, speedToKmh(speed) / 180);
    const vol = (0.14 + impact * 0.16) * WALL_SOUND_VOLUME;

    const thud = audioCtx.createOscillator();
    const thudGain = audioCtx.createGain();
    thud.type = 'square';
    thud.frequency.setValueAtTime(95 + impact * 45, now);
    thud.frequency.exponentialRampToValueAtTime(28, now + 0.08);
    thudGain.gain.setValueAtTime(vol * 0.85, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    thud.connect(thudGain);
    thudGain.connect(audioCtx.destination);
    thud.start(now);
    thud.stop(now + 0.1);

    const noise = audioCtx.createBufferSource();
    const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.16, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(680 + impact * 420, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + 0.15);
    filter.Q.value = 3.2;

    const scrapeOsc = audioCtx.createOscillator();
    scrapeOsc.type = 'sawtooth';
    scrapeOsc.frequency.setValueAtTime(140 + impact * 80, now);
    scrapeOsc.frequency.exponentialRampToValueAtTime(36, now + 0.16);

    const mixGain = audioCtx.createGain();
    mixGain.gain.setValueAtTime(vol, now);
    mixGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(filter);
    scrapeOsc.connect(filter);
    filter.connect(mixGain);
    mixGain.connect(audioCtx.destination);

    noise.start(now);
    noise.stop(now + 0.16);
    scrapeOsc.start(now);
    scrapeOsc.stop(now + 0.16);
  }

  function playHitSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.18);
  }

  function playCrashSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.4);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  }

  function playExplosionSound() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;

    const boom = audioCtx.createOscillator();
    const boomGain = audioCtx.createGain();
    boom.type = 'sawtooth';
    boom.frequency.setValueAtTime(120, t);
    boom.frequency.exponentialRampToValueAtTime(28, t + 0.55);
    boomGain.gain.setValueAtTime(0.22, t);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    boom.connect(boomGain);
    boomGain.connect(audioCtx.destination);
    boom.start(t);
    boom.stop(t + 0.7);

    const crackle = audioCtx.createOscillator();
    const crackleGain = audioCtx.createGain();
    crackle.type = 'square';
    crackle.frequency.setValueAtTime(900, t + 0.02);
    crackle.frequency.exponentialRampToValueAtTime(120, t + 0.25);
    crackleGain.gain.setValueAtTime(0.08, t + 0.02);
    crackleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    crackle.connect(crackleGain);
    crackleGain.connect(audioCtx.destination);
    crackle.start(t + 0.02);
    crackle.stop(t + 0.3);
  }

  function playPassSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 600;
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.15);
  }

  function playNearMissSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.07, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.18);
  }

  function playPickupSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1040, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  }

  function playKnockoutSound() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.14);
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  function addFloatingText(x, y, text, color) {
    floatingTexts.push({ x, y, text, color, life: 1, vy: -1.2 });
  }

  function grantPickupInvuln() {
    playerInvulnTimer = Math.max(playerInvulnTimer, 0.75);
  }

  function tryRestoreHitPoint() {
    if (hitPoints >= MAX_HIT_POINTS) return false;
    hitPoints += 1;
    addFloatingText(player.x, player.y - 36, '+1 HP', '#7fff9f');
    return true;
  }

  function collectPickup(pickup) {
    if (pickup.type === 'rammer') {
      knockoutTimer = KNOCKOUT_DURATION;
      addFloatingText(player.x, player.y - 20, 'RAMMER!', '#ff2d95');
    } else if (pickup.type === 'nitro') {
      nitro = Math.min(100, nitro + 35);
      addFloatingText(player.x, player.y - 20, '+NITRO', '#00f0ff');
    } else if (pickup.type === 'repair') {
      if (tryRestoreHitPoint()) {
        /* healed */
      } else {
        const bonus = Math.floor(180 * difficulty * scoreMultiplier);
        score += bonus;
        addFloatingText(player.x, player.y - 20, `+${bonus}`, '#7fff9f');
      }
    } else {
      combo = Math.min(10, combo + 1);
      comboTimer = 4;
      if (tryRestoreHitPoint()) {
        score += 120 * difficulty * scoreMultiplier;
        addFloatingText(player.x, player.y - 20, 'BOOST!', '#ffe14d');
      } else {
        const bonus = Math.floor(280 * difficulty * scoreMultiplier);
        score += bonus;
        addFloatingText(player.x, player.y - 20, `+${bonus}`, '#ffe14d');
      }
    }
    grantPickupInvuln();
    playPickupSound();
    pickup.collected = true;
  }

  function pickPickupType() {
    if (trafficCarsSinceRammer >= RAMMER_TRAFFIC_INTERVAL) {
      trafficCarsSinceRammer = 0;
      return 'rammer';
    }
    if (trafficCarsSinceRepair >= REPAIR_TRAFFIC_INTERVAL) {
      trafficCarsSinceRepair = 0;
      return 'repair';
    }
    if (trafficCarsSinceNitro >= NITRO_TRAFFIC_INTERVAL) {
      trafficCarsSinceNitro = 0;
      return 'nitro';
    }
    if (trafficCarsSinceBoost >= BOOST_TRAFFIC_INTERVAL) {
      trafficCarsSinceBoost = 0;
      return 'boost';
    }
    return null;
  }

  function spawnPickup() {
    const type = pickPickupType();
    if (!type) return;

    const lane = Math.floor(Math.random() * LANE_COUNT);
    const laneFraction = laneFractionAt(lane);
    const spawnY = -50;
    const centerY = spawnY + 20;
    pickups.push({
      lane,
      laneFraction,
      x: laneXFromFraction(centerY, laneFraction),
      y: spawnY,
      type,
      spin: Math.random() * Math.PI * 2,
    });
  }

  function spawnDriftSparks() {
    const side = getSteerInput() || (player.x - player.prevX > 0 ? 1 : -1);
    for (let i = 0; i < 4; i++) {
      particles.push({
        x: player.x + side * player.width * 0.35,
        y: player.y + player.height * 0.7,
        vx: side * (1 + Math.random() * 2),
        vy: 1 + Math.random() * 2,
        life: 1,
        decay: 0.05 + Math.random() * 0.04,
        color: '#9ecbff',
        size: 2 + Math.random() * 3,
      });
    }
  }

  function getSteerInput() {
    if (touchControl.active && (state === STATE.PLAYING || state === STATE.COUNTDOWN)) {
      return touchControl.steer;
    }
    let input = 0;
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) input -= 1;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) input += 1;
    return input;
  }

  function canvasCoordsFromClient(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * W,
      y: ((clientY - rect.top) / rect.height) * H,
    };
  }

  function resetTouchControl() {
    touchControl.active = false;
    touchControl.pointerId = null;
    touchControl.steer = 0;
    touchControl.nitro = false;
  }

  function updateTouchControl(coords) {
    touchControl.x = coords.x;
    touchControl.y = coords.y;

    if (state === STATE.PLAYING || state === STATE.COUNTDOWN) {
      touchControl.steer = Math.max(-1, Math.min(1, (coords.x - player.x) / (W * 0.17)));
      const dy = coords.y - touchControl.startY;
      const dx = coords.x - touchControl.startX;
      touchControl.nitro = dy < -48 && Math.abs(dy) > Math.abs(dx) * 1.12;
    }
  }

  function initTouchControls() {
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || touchControl.active) return;
      if (e.target.closest('button')) return;

      touchControl.active = true;
      touchControl.pointerId = e.pointerId;
      const coords = canvasCoordsFromClient(e.clientX, e.clientY);
      touchControl.startX = coords.x;
      touchControl.startY = coords.y;
      touchControl.x = coords.x;
      touchControl.y = coords.y;
      touchControl.steer = 0;
      touchControl.nitro = false;

      if (state === STATE.PLAYING || state === STATE.COUNTDOWN) {
        try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      }
      initAudio();
      updateTouchControl(coords);
    });

    document.addEventListener('pointermove', (e) => {
      if (!touchControl.active || e.pointerId !== touchControl.pointerId) return;
      updateTouchControl(canvasCoordsFromClient(e.clientX, e.clientY));
    });

    const endTouch = (e) => {
      if (!touchControl.active || e.pointerId !== touchControl.pointerId) return;

      const coords = canvasCoordsFromClient(e.clientX, e.clientY);
      const dx = coords.x - touchControl.startX;
      const dy = coords.y - touchControl.startY;
      const tap = Math.abs(dx) < 32 && Math.abs(dy) < 32;

      if (state === STATE.TITLE) {
        if (Math.abs(dx) > 52 && Math.abs(dx) > Math.abs(dy) * 1.1) {
          changeCar(dx > 0 ? 1 : -1);
        } else if (tap) {
          startGame();
        }
      } else if (state === STATE.GAMEOVER && tap) {
        startGame();
      }

      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      resetTouchControl();
    };

    document.addEventListener('pointerup', endTouch);
    document.addEventListener('pointercancel', endTouch);
  }

  function carsOverlap(a, b) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y + a.height * 0.3 - (b.y + b.height * 0.3));
    return dx < (a.width + b.width) * 0.35 && dy < (a.height + b.height) * 0.3;
  }

  function overlapDepth(a, b) {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y + a.height * 0.3 - (b.y + b.height * 0.3));
    return {
      x: (a.width + b.width) * 0.35 - dx,
      y: (a.height + b.height) * 0.3 - dy,
    };
  }

  function applyBounceDamping(value, dt) {
    return value * Math.pow(BOUNCE_DAMPING, dt * 60);
  }

  function bounceCars(a, b, depth, currentSpeed) {
    const midX = (a.x + b.x) * 0.5;
    const midY = (a.y + b.y + a.height * 0.3 + b.height * 0.3) * 0.25;

    if (depth.x < depth.y) {
      const push = depth.x * 0.58;
      const dir = a.x < b.x ? -1 : 1;
      a.x -= push * dir;
      b.x += push * dir;
      const impulse = BOUNCE_STRENGTH;
      if ('vx' in a) a.vx = (a.vx || 0) - impulse * dir;
      if ('vx' in b) b.vx = (b.vx || 0) + impulse * dir;
    } else {
      const push = depth.y * 0.58;
      const dir = a.y < b.y ? -1 : 1;
      a.y -= push * dir;
      b.y += push * dir;
      const impulse = BOUNCE_STRENGTH * 0.7;
      if ('vy' in a) a.vy = (a.vy || 0) - impulse * dir;
      if ('vy' in b) b.vy = (b.vy || 0) + impulse * dir;

      if (a.speed !== undefined && b.speed !== undefined && currentSpeed !== undefined) {
        const aScreenVel = currentSpeed - a.speed;
        const bScreenVel = currentSpeed - b.speed;
        const exchange = 0.18;
        const trafficCap = maxTrafficSpeed(currentSpeed);
        if (aScreenVel > bScreenVel) {
          a.speed = Math.min(a.speed + exchange, trafficCap);
          b.speed = Math.max(b.speed - exchange * 0.6, kmhToSpeed(TRAFFIC_KMH_MIN));
        } else if (bScreenVel > aScreenVel) {
          b.speed = Math.min(b.speed + exchange, trafficCap);
          a.speed = Math.max(a.speed - exchange * 0.6, kmhToSpeed(TRAFFIC_KMH_MIN));
        }
        if (a.speed !== undefined) clampTrafficSpeed(a, currentSpeed);
        if (b.speed !== undefined) clampTrafficSpeed(b, currentSpeed);
      }
    }

    return { midX, midY };
  }

  function bounceTrafficPair(a, b, depth, currentSpeed) {
    const midX = (a.x + b.x) * 0.5;
    const midY = (a.y + b.y + a.height * 0.3 + b.height * 0.3) * 0.25;
    const lateralDir = a.x < b.x ? -1 : 1;
    const verticalDir = a.y < b.y ? -1 : 1;

    if (depth.x <= depth.y) {
      const push = depth.x * 0.82;
      a.x -= push * lateralDir;
      b.x += push * lateralDir;
      const impulse = BOUNCE_STRENGTH * 2.4;
      a.vx = (a.vx || 0) - impulse * lateralDir;
      b.vx = (b.vx || 0) + impulse * lateralDir;
      a.laneFraction = Math.max(0.04, Math.min(0.96, a.laneFraction - lateralDir * 0.06));
      b.laneFraction = Math.max(0.04, Math.min(0.96, b.laneFraction + lateralDir * 0.06));
    } else {
      const push = depth.y * 0.78;
      a.y -= push * verticalDir;
      b.y += push * verticalDir;
      const impulse = BOUNCE_STRENGTH * 1.8;
      a.vy = (a.vy || 0) - impulse * verticalDir;
      b.vy = (b.vy || 0) + impulse * verticalDir;

      const trafficCap = maxTrafficSpeed(currentSpeed);
      const exchange = 0.28;
      if (verticalDir < 0) {
        a.speed = Math.min(a.speed + exchange, trafficCap);
        b.speed = Math.max(b.speed - exchange * 0.7, kmhToSpeed(TRAFFIC_KMH_MIN * 0.5));
      } else {
        b.speed = Math.min(b.speed + exchange, trafficCap);
        a.speed = Math.max(a.speed - exchange * 0.7, kmhToSpeed(TRAFFIC_KMH_MIN * 0.5));
      }
      clampTrafficSpeed(a, currentSpeed);
      clampTrafficSpeed(b, currentSpeed);
    }

    const spinDir = lateralDir;
    if ((a.spinOutTimer || 0) <= 0.05) {
      a.spinOutTimer = 0.55 + Math.random() * 0.25;
      a.spinOutRate = spinDir * (5 + Math.random() * 4);
    }
    if ((b.spinOutTimer || 0) <= 0.05) {
      b.spinOutTimer = 0.55 + Math.random() * 0.25;
      b.spinOutRate = -spinDir * (5 + Math.random() * 4);
    }

    a.trafficContactTimer = TRAFFIC_CONTACT_LINGER;
    b.trafficContactTimer = TRAFFIC_CONTACT_LINGER;
    return { midX, midY };
  }

  function triggerTrafficSpinOut(obs, pushDir, currentSpeed) {
    obs.spinOutTimer = SPINOUT_DURATION + Math.random() * 0.45;
    obs.spinOutRate = pushDir * (SPINOUT_RATE + Math.random() * 4);
    obs.vx = (obs.vx || 0) + pushDir * BOUNCE_STRENGTH * 2.6;
    obs.vy = (obs.vy || 0) + (Math.random() - 0.35) * 2.4;
    obs.speed = Math.max(
      kmhToSpeed(TRAFFIC_KMH_MIN * 0.45),
      obs.speed - currentSpeed * 0.12
    );
    obs.laneFraction = Math.max(
      0.04,
      Math.min(0.96, obs.laneFraction + pushDir * 0.1)
    );
  }

  function spawnSpinoutSparks(x, y) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 1.5 + Math.random() * 4;
      particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 14,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 1,
        decay: 0.05 + Math.random() * 0.04,
        color: Math.random() > 0.5 ? '#ffe14d' : '#ff8c3a',
        size: 2 + Math.random() * 3,
      });
    }
  }

  function damagePlayer(obs, currentSpeed) {
    if (playerInvulnTimer > 0) return false;

    const depth = overlapDepth(player, obs);
    if (depth.x <= 0 || depth.y <= 0) return false;

    const { midX, midY } = bounceCars(player, obs, depth, currentSpeed);
    const pushDir = player.x < obs.x ? -1 : 1;
    player.vx += pushDir * BOUNCE_STRENGTH * 1.4;
    triggerTrafficSpinOut(obs, -pushDir, currentSpeed);
    spawnSpinoutSparks(midX, midY);

    hitPoints -= 1;
    playerInvulnTimer = PLAYER_HIT_INVULN;
    hitFlashTimer = PLAYER_HIT_INVULN;

    spawnCollisionParticles(midX, midY);
    shakeTimer = Math.max(shakeTimer, 10);
    applySpeedPenalty(28);
    penalizeRaceProgress(2.2);
    combo = 0;
    comboTimer = 0;
    playHitSound();
    addFloatingText(player.x, player.y - 40, '-1 HP', '#ff2d95');
    addFloatingText(player.x, player.y - 62, `${hitPoints} HP LEFT`, '#ffffff');

    if (hitPoints <= 0) {
      triggerFatalCrash(obs);
      gameOver();
    }
    return true;
  }

  function knockoutTraffic(obs, currentSpeed) {
    if (obs.knockedOut) return false;

    const depth = overlapDepth(player, obs);
    if (depth.x <= 0 || depth.y <= 0) return false;

    const { midX, midY } = bounceCars(player, obs, depth, currentSpeed);
    const pushDir = player.x < obs.x ? 1 : -1;
    player.vx += pushDir * BOUNCE_STRENGTH * 0.45;

    obs.knockedOut = true;
    obs.passed = true;
    obs.spinOutTimer = SPINOUT_DURATION + 1.8 + Math.random() * 0.8;
    obs.spinOutRate = pushDir * (KNOCKOUT_SPIN_MIN + Math.random() * (KNOCKOUT_SPIN_MAX - KNOCKOUT_SPIN_MIN));
    obs.vx = pushDir * (KNOCKOUT_LAUNCH_VX + Math.random() * 8) + (Math.random() - 0.5) * 4;
    obs.vy = -(KNOCKOUT_LAUNCH_VY + Math.random() * 10 + currentSpeed * 0.08);
    obs.speed = Math.max(kmhToSpeed(TRAFFIC_KMH_MIN * 0.25), obs.speed - currentSpeed * 0.35);

    const bonus = Math.floor(320 * difficulty * scoreMultiplier);
    score += bonus;
    combo = Math.min(10, combo + 1);
    comboTimer = 4;
    shakeTimer = Math.max(shakeTimer, 8);
    playKnockoutSound();
    addFloatingText(obs.x, obs.y - 18, 'K.O.', '#ff2d95');
    addFloatingText(obs.x, obs.y - 38, `+${bonus}`, '#ffe14d');
    spawnCollisionParticles(midX, midY);
    if (perfProfile.spinoutSparks) spawnSpinoutSparks(obs.x, obs.y + obs.height * 0.55);
    return true;
  }

  function resolvePlayerCollisions(currentSpeed) {
    if (knockoutTimer > 0) {
      for (const obs of obstacles) {
        if (obs.knockedOut || obs.offRoadFall || obs.exploded) continue;
        if (!carsOverlap(player, obs)) continue;
        knockoutTraffic(obs, currentSpeed);
      }
      return;
    }
    if (playerInvulnTimer > 0) return;
    for (const obs of obstacles) {
      if (!carsOverlap(player, obs)) continue;
      if (damagePlayer(obs, currentSpeed)) return;
    }
  }

  function updateCarAngle(car, lateralVel, forwardVel, steerInput, dt, roadLean = 0) {
    const speedFactor = Math.min(1.15, Math.max(0.35, forwardVel / Math.max(kmhToSpeed(40), 0.5)));
    const inputAngle = steerInput * MAX_CAR_ANGLE * speedFactor;
    const velAngle = Math.atan2(lateralVel, Math.abs(forwardVel) * 55 + 2) * 0.75;
    const targetAngle = Math.max(
      -MAX_CAR_ANGLE,
      Math.min(MAX_CAR_ANGLE, inputAngle * 0.65 + velAngle * 0.35 + roadLean)
    );
    const slip = car === player ? weatherSteerSlip() : 1;
    const blend = Math.min(1, ANGLE_RESPONSIVENESS * dt * slip);
    car.angle += (targetAngle - car.angle) * blend;
  }

  function playerRoadLean() {
    const lookAhead = 48;
    const centerNow = roadCenterAtScreenY(player.y);
    const centerAhead = roadCenterAtScreenY(player.y - lookAhead);
    return Math.max(
      -MAX_CAR_ANGLE * 0.45,
      Math.min(MAX_CAR_ANGLE * 0.45, Math.atan2(centerAhead - centerNow, lookAhead) * 0.5)
    );
  }

  function canSpawnTrafficAt(x, y, width, height) {
    const minGap = height * TRAFFIC_MIN_GAP;
    const spawnWorldY = obstacleWorldY({ y });
    const minWorldGap = height * TRAFFIC_MIN_GAP * 2.4;
    for (const obs of obstacles) {
      if (Math.abs(obs.y - y) < minGap) return false;
      if (Math.abs(obstacleWorldY(obs) - spawnWorldY) < minWorldGap) return false;
      if (carsOverlap({ x, y, width, height }, obs)) return false;
    }
    return true;
  }

  function findClearSpawnLane(spawnY, width, height) {
    const lanes = Array.from({ length: LANE_COUNT }, (_, i) => i);
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
    }
    for (const lane of lanes) {
      const laneFraction = laneFractionAt(lane);
      const centerY = spawnY + height * 0.52;
      const x = laneXFromFraction(centerY, laneFraction);
      if (canSpawnTrafficAt(x, spawnY, width, height)) return { lane, laneFraction, x };
    }
    return null;
  }

  function resolveTrafficCollisions(currentSpeed) {
    for (let pass = 0; pass < TRAFFIC_BOUNCE_PASSES; pass++) {
      for (let i = 0; i < obstacles.length; i++) {
        for (let j = i + 1; j < obstacles.length; j++) {
          const a = obstacles[i];
          const b = obstacles[j];
          if (a.knockedOut || b.knockedOut || a.offRoadFall || b.offRoadFall || a.exploded || b.exploded) continue;
          if (!carsOverlap(a, b)) continue;

          const depth = overlapDepth(a, b);
          if (depth.x <= 0 || depth.y <= 0) continue;

          const { midX, midY } = bounceTrafficPair(a, b, depth, currentSpeed);

          const now = performance.now() / 1000;
          if (!a.hitCooldown || now > a.hitCooldown) {
            a.hitCooldown = now + TRAFFIC_COLLISION_COOLDOWN;
            b.hitCooldown = now + TRAFFIC_COLLISION_COOLDOWN;
            spawnCollisionParticles(midX, midY);
            if (perfProfile.spinoutSparks) spawnSpinoutSparks(midX, midY);
          }
        }
      }
    }

    obstacles.forEach((obs) => {
      if (obs.knockedOut || obs.offRoadFall || obs.exploded || obs.spinOutTimer > 0 || (obs.trafficContactTimer || 0) > 0) return;
      const centerY = obs.y + obs.height * 0.52;
      const laneX = laneXFromFraction(centerY, obs.laneFraction);
      const maxDrift = obs.width * 0.18;
      obs.x = Math.max(laneX - maxDrift, Math.min(laneX + maxDrift, obs.x));
    });
  }

  function spawnObstacle(currentSpeed) {
    const carType = pickTrafficCar();
    const { width, height } = carType;
    const traffic = randomTrafficSpeed(currentSpeed);
    const spawnY = trafficSpawnScreenY(height);
    if (spawnY > -height) return;
    if (spawnY >= player.y - height * 1.4) return;

    const spawn = findClearSpawnLane(spawnY, width, height);
    if (!spawn) return;
    if (!isSpawnOnRoad(spawn.x, spawnY, width, height)) return;

    obstacles.push({
      lane: spawn.lane,
      laneFraction: spawn.laneFraction,
      x: spawn.x,
      y: spawnY,
      width,
      height,
      carType,
      speed: traffic.speed,
      kmh: traffic.kmh,
      passed: false,
      angle: 0,
      prevX: spawn.x,
      vx: 0,
      vy: 0,
      hitCooldown: 0,
      spinOutTimer: 0,
      spinOutRate: 0,
      trafficContactTimer: 0,
    });
    trafficCarsSinceRammer += 1;
    trafficCarsSinceRepair += 1;
    trafficCarsSinceNitro += 1;
    trafficCarsSinceBoost += 1;
  }

  function spawnExhaustParticles() {
    if (animFrame % 3 !== 0) return;
    const count = nitroActive ? 3 : 1;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: player.x + (Math.random() - 0.5) * 30,
        y: player.y + player.height * 0.5 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 2,
        vy: 2 + Math.random() * 3 + (nitroActive ? 4 : 0),
        life: 1,
        decay: 0.03 + Math.random() * 0.03,
        color: nitroActive
          ? `hsl(${180 + Math.random() * 60}, 100%, 70%)`
          : `hsl(${300 + Math.random() * 40}, 80%, 60%)`,
        size: nitroActive ? 6 + Math.random() * 4 : 3 + Math.random() * 3,
      });
    }
  }

  function spawnCollisionParticles(x, y) {
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2 + Math.random() * 8;
      particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 1,
        decay: 0.02 + Math.random() * 0.02,
        color: Math.random() > 0.5 ? '#ff2d95' : '#00f0ff',
        size: 4 + Math.random() * 6,
      });
    }
  }

  function spawnCarExplosion(cx, cy, w, h, accent = '#ff8c3a') {
    const palette = ['#fff4c8', '#ffe14d', '#ff8c3a', '#ff4d2d', '#ff2d95', accent, '#8a8a9a', '#3a3a48'];
    const count = perfProfile.tier === 'ultralow' ? 36 : perfProfile.tier === 'low' ? 52 : 78;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 2.5 + Math.random() * 11;
      particles.push({
        x: cx + (Math.random() - 0.5) * w * 0.9,
        y: cy + (Math.random() - 0.5) * h * 0.75,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - (1.5 + Math.random() * 3),
        life: 0.75 + Math.random() * 0.55,
        decay: 0.012 + Math.random() * 0.018,
        color: palette[Math.floor(Math.random() * palette.length)],
        size: 3 + Math.random() * 9,
        gravity: 0.12 + Math.random() * 0.14,
      });
    }

    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 5 + Math.random() * 7;
      particles.push({
        x: cx + (Math.random() - 0.5) * w * 0.35,
        y: cy + (Math.random() - 0.5) * h * 0.35,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 3,
        life: 1,
        decay: 0.03 + Math.random() * 0.02,
        color: i % 2 === 0 ? '#ffffff' : accent,
        size: 8 + Math.random() * 10,
        gravity: 0.08,
      });
    }
  }

  function triggerFatalCrash(obs) {
    const playerCx = player.x;
    const playerCy = player.y + player.height * 0.45;
    const obsCx = obs.x;
    const obsCy = obs.y + obs.height * 0.45;

    obs.exploded = true;
    particles = [];
    spawnCarExplosion(playerCx, playerCy, player.width, player.height, activeCar.glow || '#ff2d95');
    spawnCarExplosion(obsCx, obsCy, obs.width, obs.height, obs.carType.glow || '#ff8c3a');

    fatalCrash = {
      obs,
      timer: FATAL_CRASH_DURATION,
      sites: [
        { x: playerCx, y: playerCy, accent: activeCar.glow || '#ff2d95' },
        { x: obsCx, y: obsCy, accent: obs.carType.glow || '#ff8c3a' },
      ],
    };

    shakeTimer = Math.max(shakeTimer, 28);
    playExplosionSound();
    addFloatingText((playerCx + obsCx) / 2, (playerCy + obsCy) / 2 - 20, 'TOTALED!', '#ffffff');
  }

  function updateParticles(dt) {
    particles.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.gravity) p.vy += p.gravity;
      p.life -= p.decay;
    });
    particles = particles.filter((p) => p.life > 0);
  }

  function updateFatalCrash(dt) {
    if (!fatalCrash) return;
    fatalCrash.timer -= dt;
    if (fatalCrash.timer <= 0) fatalCrash = null;
  }

  function drawFatalCrashExplosions() {
    if (!fatalCrash) return;

    const progress = 1 - fatalCrash.timer / FATAL_CRASH_DURATION;
    fatalCrash.sites.forEach((site) => {
      const flash = Math.max(0, 1 - progress * 5);
      if (flash > 0) {
        const flashGrad = ctx.createRadialGradient(site.x, site.y, 0, site.x, site.y, 42 + flash * 36);
        flashGrad.addColorStop(0, `rgba(255, 255, 255, ${0.85 * flash})`);
        flashGrad.addColorStop(0.35, `rgba(255, 230, 120, ${0.55 * flash})`);
        flashGrad.addColorStop(1, 'rgba(255, 80, 40, 0)');
        ctx.fillStyle = flashGrad;
        ctx.beginPath();
        ctx.arc(site.x, site.y, 42 + flash * 36, 0, Math.PI * 2);
        ctx.fill();
      }

      const fireRadius = 18 + progress * 72;
      const fireAlpha = Math.max(0, 0.72 * (1 - progress * 1.15));
      if (fireAlpha <= 0) return;

      const fireGrad = ctx.createRadialGradient(site.x, site.y, 0, site.x, site.y, fireRadius);
      fireGrad.addColorStop(0, `rgba(255, 245, 210, ${fireAlpha})`);
      fireGrad.addColorStop(0.28, `rgba(255, 170, 60, ${fireAlpha * 0.9})`);
      fireGrad.addColorStop(0.62, `rgba(255, 70, 35, ${fireAlpha * 0.55})`);
      fireGrad.addColorStop(1, 'rgba(120, 20, 10, 0)');
      ctx.fillStyle = fireGrad;
      ctx.beginPath();
      ctx.arc(site.x, site.y, fireRadius, 0, Math.PI * 2);
      ctx.fill();

      const ringAlpha = Math.max(0, 0.45 * (1 - progress));
      if (ringAlpha > 0) {
        ctx.strokeStyle = site.accent;
        ctx.globalAlpha = ringAlpha;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(site.x, site.y, 12 + progress * 88, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    });
  }

  function handleInput(dt) {
    const steerInput = getSteerInput();
    const grip = weatherGripMult();
    const steer = STEER_BASE * activeCar.steerMult * grip * dt * 60;
    if (steerInput < 0) player.x -= steer;
    if (steerInput > 0) player.x += steer;
    if (weatherType === 'snow' && steerInput !== 0 && state === STATE.PLAYING) {
      const speedFactor = Math.min(1.2, speed / Math.max(kmhToSpeed(60), 0.5));
      player.vx += steerInput * dt * 3.4 * speedFactor;
    }
    clampPlayerToRoad();

    nitroActive = state === STATE.PLAYING
      && (keys[' '] || keys['Space'] || touchControl.nitro)
      && nitro > 0;
    if (nitroActive) {
      nitro = Math.max(0, nitro - activeCar.nitroDrain);
    } else {
      nitro = Math.min(100, nitro + activeCar.nitroRecharge);
    }
  }

  function updateCountdown(dt) {
    handleInput(dt);
    player.x += player.vx * dt * 60;
    player.vx = applyBounceDamping(player.vx, dt);
    clampPlayerToRoad();
    animFrame++;

    const steerInput = getSteerInput();
    const lateralVel = (player.x - player.prevX) / Math.max(dt, 0.001);
    updateCarAngle(player, lateralVel, kmhToSpeed(LAUNCH_SPEED_KMH), steerInput, dt, playerRoadLean());
    player.prevX = player.x;

    const skipCountdown = keys[' '] || keys.Space;
    countdownTimer -= dt * (skipCountdown ? 3 : 1);
    if (countdownTimer <= 0) {
      state = STATE.PLAYING;
      countdownTimer = 0;
      lastTime = performance.now();
    }
  }

  function togglePause() {
    if (state === STATE.PLAYING) {
      state = STATE.PAUSED;
      stopEngineSound();
      return;
    }
    if (state === STATE.PAUSED) {
      state = STATE.PLAYING;
      lastTime = performance.now();
      simAccumulator = 0;
      playEngineSound(activeCar);
    }
  }

  function update(dt) {
    if (state === STATE.PAUSED) return;
    if (state === STATE.COUNTDOWN) {
      updateCountdown(dt);
      return;
    }
    if (state === STATE.GAMEOVER) {
      animFrame++;
      updateParticles(dt);
      updateFatalCrash(dt);
      floatingTexts.forEach((ft) => {
        ft.y += ft.vy;
        ft.life -= dt * 0.9;
      });
      floatingTexts = floatingTexts.filter((ft) => ft.life > 0);
      return;
    }
    if (state !== STATE.PLAYING) return;

    handleInput(dt);
    player.x += player.vx * dt * 60;
    player.vx = applyBounceDamping(player.vx, dt);
    clampPlayerToRoad();
    animFrame++;

    if (speedBoostTimer > 0) speedBoostTimer -= dt;
    if (knockoutTimer > 0) knockoutTimer -= dt;
    const playerWy = worldYAtScreenY(player.y);
    if (isOnSpeedStrip(playerWy) && !nitroActive) {
      speedBoostTimer = Math.max(speedBoostTimer, 0.35);
    }
    updatePlayerSpeed(dt);

    const currentSpeed = speed;
    const steerInput = getSteerInput();
    const lateralVel = (player.x - player.prevX) / Math.max(dt, 0.001);
    updateCarAngle(player, lateralVel, currentSpeed, steerInput, dt, playerRoadLean());
    player.prevX = player.x;
    roadOffset += currentSpeed;
    bgOffset += currentSpeed * 0.3;
    ensureRoadCurveUpTo(roadOffset + H + 4000);

    if (railScrapeTimer > 0) railScrapeTimer -= dt;
    if (wallScrapeSoundTimer > 0) wallScrapeSoundTimer -= dt;
    if (playerInvulnTimer > 0) playerInvulnTimer -= dt;
    if (hitFlashTimer > 0) hitFlashTimer -= dt;
    if (comboTimer > 0) {
      comboTimer -= dt;
      if (comboTimer <= 0) combo = 0;
    }
    if (themeBannerTimer > 0) themeBannerTimer -= dt;

    scoreMultiplier = 1 + combo * 0.15 + (speedBoostTimer > 0 ? 0.5 : 0);

    if (Math.abs(steerInput) > 0 && speedToKmh(currentSpeed) > LAUNCH_SPEED_KMH * 0.85) {
      driftSparkTimer += dt;
      if (driftSparkTimer > 0.06) {
        driftSparkTimer = 0;
        spawnDriftSparks();
      }
    }

    distance += currentSpeed * 0.5;
    score += currentSpeed * 0.1 * difficulty * scoreMultiplier;
    difficulty = 1 + distance / DIFFICULTY_RAMP_DISTANCE;

    spawnTimer -= dt;
    const trafficCap = getTrafficCap();
    const trafficActive = activeTrafficCount();
    if (
      spawnTimer <= 0
      && speedToKmh(currentSpeed) >= LAUNCH_SPEED_KMH * 0.7
      && trafficActive < trafficCap
    ) {
      spawnObstacle(currentSpeed);
      const fillPressure = 1 - trafficActive / Math.max(1, trafficCap);
      spawnTimer = Math.max(
        0.28,
        (Math.max(0.45, 1.8 - difficulty * 0.28) * (0.55 + Math.random() * 0.45))
          * (1.05 - fillPressure * 0.62)
      );
    }

    pickupSpawnTimer -= dt;
    if (pickupSpawnTimer <= 0) {
      spawnPickup();
      pickupSpawnTimer = 1.8 + Math.random() * 1.7;
    }

    pickups.forEach((pickup) => {
      pickup.y += currentSpeed;
      pickup.spin += dt * 4;
      const centerY = pickup.y + 16;
      pickup.x = laneXFromFraction(centerY, pickup.laneFraction);

      const dx = Math.abs(player.x - pickup.x);
      const dy = Math.abs(player.y + player.height * 0.4 - pickup.y);
      if (dx < player.width * 0.45 && dy < player.height * 0.45) {
        collectPickup(pickup);
      }
    });
    pickups = pickups.filter((pickup) => !pickup.collected && pickup.y < H + 40);

    obstacles.forEach((obs, obsIndex) => {
      if (obs.exploded) return;

      if (obs.offRoadFall) {
        obs.offRoadTimer = (obs.offRoadTimer || 0) + dt;
        obs.prevX = obs.x;
        obs.vy = (obs.vy || 0) + OFF_ROAD_FALL_GRAVITY * dt * 60;
        obs.x += (obs.vx || 0) * dt * 60;
        obs.y += (obs.vy || 0) * dt * 60 + currentSpeed * 0.12;
        obs.vx *= 1 - dt * 0.1;
        if (obs.spinOutTimer > 0) {
          obs.spinOutTimer -= dt;
          obs.angle += (obs.spinOutRate || 0) * dt;
        }
        if (obs.offRoadTimer >= OFF_ROAD_EXPLODE_DELAY) {
          explodeOffRoadTraffic(obs);
        }
        return;
      }

      if (obs.trafficContactTimer > 0) obs.trafficContactTimer -= dt;
      if (!obs.knockedOut) clampTrafficSpeed(obs, currentSpeed);
      obs.prevX = obs.x;
      obs.x += (obs.vx || 0) * dt * 60;
      const relativeSpeed = obs.knockedOut ? currentSpeed * 0.35 : Math.max(0.5, currentSpeed - obs.speed);
      obs.y += relativeSpeed + (obs.vy || 0) * dt * 60;
      if (obs.knockedOut) {
        obs.vx *= 1 - dt * 0.08;
        obs.vy *= 1 - dt * 0.05;
      } else {
        obs.vx = applyBounceDamping(obs.vx || 0, dt);
        obs.vy = applyBounceDamping(obs.vy || 0, dt);
      }

      const centerY = obs.y + obs.height * 0.52;
      const spinning = obs.spinOutTimer > 0;
      if (
        !obs.knockedOut
        && (obs.trafficContactTimer || 0) <= 0
        && !trafficOverlapsOther(obs, obsIndex)
      ) {
        const targetX = laneXFromFraction(centerY, obs.laneFraction);
        const laneBlend = Math.min(1, TRAFFIC_LANE_SMOOTH * dt * (spinning ? 0.12 : 1));
        obs.x += (targetX - obs.x) * laneBlend;
      }

      const forwardVel = Math.abs(currentSpeed - obs.speed) + 0.5;
      const lateralVel = (obs.x - obs.prevX) / Math.max(dt, 0.001);
      if (spinning) {
        obs.spinOutTimer -= dt;
        obs.angle += obs.spinOutRate * dt;
        if (!obs.knockedOut) obs.spinOutRate *= 1 - dt * 0.42;
        if (perfProfile.spinoutSparks && animFrame % (obs.knockedOut ? 2 : 3) === 0) {
          spawnSpinoutSparks(obs.x, obs.y + obs.height * 0.55);
        }
      } else if (!obs.knockedOut) {
        const steerHint = Math.max(-1, Math.min(1, lateralVel / (forwardVel * 28)));
        updateCarAngle(obs, lateralVel, forwardVel, steerHint, dt);
      }

      if (shouldTriggerOffRoadFall(obs)) {
        obs.offRoadFall = true;
        obs.offRoadTimer = 0;
        obs.passed = true;
        obs.vy = Math.max((obs.vy || 0) + 5, 9);
        return;
      }

      if (!obs.passed && !obs.knockedOut && obs.y + obs.height * 0.5 > player.y + player.height * 0.5) {
        obs.passed = true;
        const passDx = Math.abs(player.x - obs.x);
        const passThreshold = (player.width + obs.width) * 0.38;
        const nearMiss = passDx < passThreshold && passDx > (player.width + obs.width) * 0.3;
        combo = Math.min(10, combo + 1);
        comboTimer = 4;
        score += 100 * difficulty * scoreMultiplier;
        if (nearMiss) {
          score += 80 * difficulty * scoreMultiplier;
          playNearMissSound();
          addFloatingText(player.x, player.y - 30, 'NEAR MISS!', '#ff6eb4');
          shakeTimer = Math.max(shakeTimer, 6);
        } else {
          playPassSound();
        }
      }
    });

    resolveTrafficCollisions(currentSpeed);
    resolvePlayerCollisions(currentSpeed);

    obstacles = obstacles.filter((obs) => {
      if (obs.exploded) return false;
      if (obs.offRoadFall) {
        return obs.y < H + 260 && obs.x > -obs.width * 3 && obs.x < W + obs.width * 3;
      }
      if (obs.knockedOut) {
        return obs.y + obs.height > -TRAFFIC_CULL_ABOVE
          && obs.y < H + 180
          && obs.x > -obs.width * 2
          && obs.x < W + obs.width * 2;
      }
      if (obs.y < -obs.height - TRAFFIC_CULL_ABOVE) return false;
      if (obs.y > H + 120) return false;
      if (!obs.passed && isTrafficBehind(obs)) return false;
      return true;
    });
    if (state !== STATE.PLAYING) return;

    spawnExhaustParticles();

    updateParticles(dt);

    const rainLevel = rainIntensity();
    rainDrops.forEach((drop) => {
      drop.y += (drop.speed + currentSpeed * 0.5) * (0.5 + rainLevel);
      drop.x -= 1 + rainLevel;
      if (drop.y > H) { drop.y = -20; drop.x = Math.random() * W; }
      if (drop.x < 0) drop.x = W;
    });

    if (themeParticles.length && window.updateThemeParticles) {
      window.updateThemeParticles(themeParticles, W, H, currentSpeed * 0.02, dt);
    }
    if (weatherType === 'snow') {
      updateWeatherSnow(dt, currentSpeed * 0.02);
    }

    floatingTexts.forEach((ft) => {
      ft.y += ft.vy;
      ft.life -= dt * 0.9;
    });
    floatingTexts = floatingTexts.filter((ft) => ft.life > 0);

    trimParticles();
    updateEngineSound();
  }

  function drawBackground() {
    if (activeTheme && window.drawThemeBackground) {
      const bgImg = images[`bg-${activeTheme.id}`] || null;
      const savedFilter = activeTheme.imageFilter;
      if (!perfProfile.bgImageFilter) activeTheme.imageFilter = null;
      window.drawThemeBackground(ctx, W, H, bgOffset, activeTheme, bgImg);
      activeTheme.imageFilter = savedFilter;
      if (activeTheme.drawParticles && themeParticles.length) {
        activeTheme.drawParticles(ctx, themeParticles);
      }
      drawDayNightOverlay();
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0a0618');
      grad.addColorStop(1, '#1a1040');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawGuardRails(points, side) {
    const offset = side === 'left' ? -GUARD_RAIL_WIDTH - 2 : GUARD_RAIL_WIDTH + 2;
    ctx.save();
    ctx.strokeStyle = 'rgba(210, 220, 235, 0.85)';
    ctx.lineWidth = 3;
    if (perfProfile.shadows) {
      ctx.shadowColor = '#8be9ff';
      ctx.shadowBlur = 6;
    }
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = p.x + offset;
      if (i === 0) ctx.moveTo(x, p.y);
      else ctx.lineTo(x, p.y);
    });
    ctx.stroke();

    ctx.fillStyle = 'rgba(180, 190, 205, 0.9)';
    for (let i = 0; i < points.length; i += 14) {
      const p = points[i];
      const x = p.x + offset;
      ctx.fillRect(x - 2, p.y, 4, 10);
      if (i % 28 === 0) {
        ctx.fillStyle = railScrapeTimer > 0 && railScrapeSide === (side === 'left' ? -1 : 1)
          ? '#ffe14d'
          : 'rgba(255, 225, 77, 0.75)';
        ctx.beginPath();
        ctx.arc(x, p.y + 5, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(180, 190, 205, 0.9)';
      }
    }
    ctx.restore();
  }

  function drawSpeedStrips() {
    for (let y = 0; y <= H; y += roadStep) {
      const wy = worldYAtScreenY(y);
      if (!isOnSpeedStrip(wy)) continue;
      const bounds = roadBoundsAtScreenY(y);
      const pulse = 0.25 + Math.sin(wy * 0.08 + animFrame * 0.12) * 0.15;
      ctx.fillStyle = `rgba(80, 255, 160, ${pulse})`;
      ctx.fillRect(bounds.left + 8, y, bounds.width - 16, roadStep + 0.5);
    }
  }

  function drawTunnel() {
    const playerWy = worldYAtScreenY(player.y);
    if (!isInTunnel(playerWy)) return;

    ctx.save();
    const vignette = ctx.createRadialGradient(W / 2, H * 0.55, H * 0.15, W / 2, H * 0.55, H * 0.85);
    vignette.addColorStop(0, 'rgba(4, 6, 14, 0.35)');
    vignette.addColorStop(1, 'rgba(2, 3, 10, 0.78)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function drawPickups() {
    pickups.forEach((pickup) => {
      const fogFade = fogVisibilityAtY(pickup.y);
      ctx.save();
      ctx.globalAlpha = fogFade;
      ctx.translate(pickup.x, pickup.y);
      ctx.rotate(pickup.spin);

      const isRammer = pickup.type === 'rammer';
      const pulse = 0.55 + Math.sin(animFrame * 0.14 + pickup.spin) * 0.45;
      let fillColor = '#ffe14d';
      let glowColor = '#ffe14d';
      if (pickup.type === 'nitro') {
        fillColor = '#00f0ff';
        glowColor = '#00f0ff';
      } else if (pickup.type === 'repair') {
        fillColor = '#7fff9f';
        glowColor = '#7fff9f';
      } else if (isRammer) {
        fillColor = '#ff2d95';
        glowColor = '#b44dff';
      }

      if (isRammer) {
        const ringR = 18 + pulse * 6;
        ctx.strokeStyle = `rgba(255, 45, 149, ${0.35 + pulse * 0.45})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#b44dff';
        ctx.shadowBlur = 16 + pulse * 12;
        ctx.beginPath();
        ctx.arc(0, 0, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = fillColor;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = isRammer ? 18 + pulse * 14 : 14;
      ctx.beginPath();
      ctx.arc(0, 0, isRammer ? 14 + pulse * 2 : 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 10px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = pickup.type === 'nitro'
        ? 'N'
        : pickup.type === 'repair'
          ? 'HP'
          : pickup.type === 'rammer'
            ? 'K'
            : '+';
      ctx.fillText(label, 0, 1);
      ctx.restore();
    });
  }

  function drawFloatingTexts() {
    floatingTexts.forEach((ft) => {
      ctx.globalAlpha = ft.life;
      ctx.font = '700 16px Orbitron, sans-serif';
      ctx.fillStyle = ft.color;
      ctx.shadowColor = ft.color;
      ctx.shadowBlur = 10;
      ctx.textAlign = 'center';
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;
  }

  function drawThemeBanner() {
    if (!activeTheme || themeBannerTimer <= 0) return;
    const alpha = Math.min(1, themeBannerTimer);
    const layout = getHudLayout();
    const panelW = Math.min(420, layout.vis.width * 0.55);
    const panelH = 84;
    const x = layout.vis.centerX - panelW / 2;
    const y = layout.topRowY + layout.statPanelH + 14;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawHudPanel(x, y, panelW, panelH, 'rgba(0, 240, 255, 0.5)');
    ctx.textAlign = 'center';
    ctx.font = '700 22px Orbitron, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(activeTheme.name, layout.vis.centerX, y + 30);
    ctx.font = '600 13px Rajdhani, sans-serif';
    ctx.fillStyle = '#8be9ff';
    ctx.fillText(activeTheme.subtitle, layout.vis.centerX, y + 48);
    const lighting = getDayNightLighting();
    const weatherLabel = WEATHER_LABELS[weatherType] || 'Clear';
    ctx.font = '600 12px Rajdhani, sans-serif';
    ctx.fillStyle = weatherType === 'rain' ? '#9fd4ff' : weatherType === 'snow' ? '#e8f4ff' : weatherType === 'fog' ? '#c8d0e0' : '#b8c8e8';
    ctx.fillText(`${weatherLabel} · ${lighting.label}`, layout.vis.centerX, y + 64);
    ctx.restore();
  }

  function collectRoadPoints() {
    const leftEdge = [];
    const rightEdge = [];
    const laneLines = Array.from({ length: LANE_COUNT - 1 }, () => []);
    for (let y = 0; y <= H; y += roadStep) {
      const bounds = roadBoundsAtScreenY(y);
      leftEdge.push({ x: bounds.left, y });
      rightEdge.push({ x: bounds.right, y });
      for (let i = 1; i < LANE_COUNT; i++) {
        laneLines[i - 1].push({ x: bounds.left + (bounds.width * i) / LANE_COUNT, y });
      }
    }
    return { leftEdge, rightEdge, laneLines };
  }

  function drawRoadEdges(points, glow, dashed) {
    ctx.strokeStyle = glow ? 'rgba(255, 45, 149, 0.65)' : 'rgba(255, 255, 255, 0.22)';
    ctx.lineWidth = glow ? 3 : 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = glow ? '#ff2d95' : 'transparent';
    ctx.shadowBlur = glow ? 14 : 0;
    if (dashed) {
      ctx.setLineDash([18, 20]);
      ctx.lineDashOffset = -roadOffset;
    } else {
      ctx.setLineDash([]);
    }
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;
    ctx.shadowBlur = 0;
  }

  function drawRoadSurface() {
    for (let y = 0; y <= H; y += roadStep) {
      const bounds = roadBoundsAtScreenY(y);
      const wy = worldYAtScreenY(y);
      const grain = Math.sin(wy * 0.014) * 2.5 + Math.sin(wy * 0.067 + 0.8) * 1.5;
      const wet = Math.sin(wy * 0.031 + roadOffset * 0.06) * 4;
      const base = 19 + grain + wet * 0.25;
      ctx.fillStyle = `rgb(${base | 0}, ${(base + 2) | 0}, ${(base + 11) | 0})`;
      ctx.fillRect(bounds.left, y, bounds.width, roadStep + 0.5);

      const shimmer = (Math.sin(wy * 0.022 + roadOffset * 0.04) + 1) * 0.5;
      const wetBoost = weatherType === 'rain' ? 0.12 : 0;
      if (shimmer + wetBoost > 0.82) {
        ctx.fillStyle = `rgba(90, 170, 210, ${(shimmer + wetBoost - 0.82) * 0.42})`;
        ctx.fillRect(bounds.left + bounds.width * 0.08, y, bounds.width * 0.84, roadStep + 0.5);
      }
    }

    const edgeInset = 5;
    for (let y = 0; y <= H; y += roadStep) {
      const bounds = roadBoundsAtScreenY(y);
      const wy = worldYAtScreenY(y);
      const edgePhase = wy % 44;
      if (edgePhase < 22) {
        ctx.fillStyle = 'rgba(255, 225, 77, 0.45)';
        ctx.fillRect(bounds.left + edgeInset, y, 3, roadStep + 0.5);
        ctx.fillRect(bounds.right - edgeInset - 3, y, 3, roadStep + 0.5);
      }
    }
  }

  function drawRoad() {
    ctx.save();
    buildRoadClipPath();
    ctx.clip();
    drawRoadSurface();
    drawSpeedStrips();
    ctx.restore();

    const { leftEdge, rightEdge, laneLines } = collectRoadPoints();
    drawGuardRails(leftEdge, 'left');
    drawGuardRails(rightEdge, 'right');
    drawRoadEdges(leftEdge, true, false);
    drawRoadEdges(rightEdge, true, false);
    laneLines.forEach((line) => drawRoadEdges(line, false, true));

    drawTunnel();

    if (railScrapeTimer > 0) {
      ctx.fillStyle = `rgba(255, 225, 77, ${railScrapeTimer * 1.8})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawSprite(img, x, y, width, height, glowColor, flipVertical = false, angle = 0) {
    ctx.save();
    if (glowColor && perfProfile.shadows) {
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 14;
    }
    const aspect = img.width / img.height;
    let drawW = width;
    let drawH = height;
    if (aspect > width / height) {
      drawH = width / aspect;
    } else {
      drawW = height * aspect;
    }
    const centerY = y + height / 2;
    ctx.translate(x, centerY);
    if (flipVertical) ctx.scale(1, -1);
    if (angle) ctx.rotate(angle);
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  }

  function drawObstacles() {
    const { isNight } = getDayNightLighting();
    obstacles.forEach((obs) => {
      if (obs.exploded) return;
      if (obs.y + obs.height < -8) return;

      const enterFade = obs.knockedOut || obs.offRoadFall
        ? (obs.offRoadFall ? Math.max(0.35, 1 - (obs.offRoadTimer || 0) * 0.22) : 1)
        : Math.min(1, (obs.y + obs.height) / 90);
      if (enterFade <= 0) return;
      const fogFade = fogVisibilityAtY(obs.y + obs.height * 0.5);

      ctx.save();
      ctx.globalAlpha = enterFade * fogFade;
      if (isNight && !obs.knockedOut) drawHeadlightBeams(obs.x, obs.y, obs.width, obs.height);
      const img = images[obs.carType.id];
      const glow = obs.knockedOut ? '#ff2d95' : obs.carType.glow;
      drawSprite(img, obs.x, obs.y, obs.width, obs.height, glow, false, obs.angle || 0);
      ctx.restore();
    });
  }

  function drawPlayer() {
    if (fatalCrash) return;
    const img = images[activeCar.id];
    const rammerActive = knockoutTimer > 0;
    const rammerPulse = 0.55 + Math.sin(animFrame * 0.16) * 0.45;
    const glow = rammerActive ? '#ff2d95' : nitroActive ? '#ffffff' : activeCar.glow;
    const scale = rammerActive ? 1.04 + rammerPulse * 0.06 : nitroActive ? 1.05 : 1;

    if (rammerActive) {
      ctx.save();
      const auraR = Math.max(player.width, player.height) * (0.62 + rammerPulse * 0.14);
      const cx = player.x;
      const cy = player.y + player.height * 0.48;
      const auraGrad = ctx.createRadialGradient(cx, cy, auraR * 0.15, cx, cy, auraR);
      auraGrad.addColorStop(0, `rgba(255, 45, 149, ${0.28 + rammerPulse * 0.22})`);
      auraGrad.addColorStop(0.55, `rgba(180, 77, 255, ${0.14 + rammerPulse * 0.12})`);
      auraGrad.addColorStop(1, 'rgba(180, 77, 255, 0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, auraR, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(255, 45, 149, ${0.45 + rammerPulse * 0.4})`;
      ctx.lineWidth = 3;
      ctx.shadowColor = '#b44dff';
      ctx.shadowBlur = 14 + rammerPulse * 16;
      ctx.beginPath();
      ctx.arc(cx, cy, auraR * 0.92, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    if (hitFlashTimer > 0 && !rammerActive) {
      ctx.globalAlpha = 0.45 + Math.sin(animFrame * 0.5) * 0.25;
    }
    if (rammerActive && perfProfile.shadows) {
      ctx.save();
      ctx.shadowColor = '#ff2d95';
      ctx.shadowBlur = 18 + rammerPulse * 18;
    }
    drawSprite(
      img,
      player.x,
      player.y,
      player.width * scale,
      player.height * scale,
      glow,
      false,
      player.angle
    );
    if (rammerActive && perfProfile.shadows) ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawRammerCountdown() {
    if (knockoutTimer <= 0 || fatalCrash) return;

    const pulse = 0.65 + Math.sin(animFrame * 0.18) * 0.35;
    const cx = player.x;
    const cy = player.y + player.height * 0.82;
    const radius = 20 + pulse * 3;
    const progress = knockoutTimer / KNOCKOUT_DURATION;
    const seconds = Math.ceil(knockoutTimer);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(180, 77, 255, ${0.22 + pulse * 0.28})`;
    ctx.lineWidth = 2;
    ctx.shadowColor = '#b44dff';
    ctx.shadowBlur = 10 + pulse * 10;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
    ctx.strokeStyle = '#ff2d95';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();

    ctx.fillStyle = `rgba(8, 6, 18, ${0.86 + pulse * 0.08})`;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 17px Orbitron, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ff2d95';
    ctx.shadowBlur = 10;
    ctx.fillText(String(seconds), cx, cy - 1);
    ctx.font = '700 7px Orbitron, sans-serif';
    ctx.fillStyle = '#ff6eb4';
    ctx.shadowBlur = 6;
    ctx.fillText('RAM', cx, cy + radius + 11);
    ctx.restore();
  }

  function drawLegendSwatch(type, x, y, w, h) {
    ctx.save();
    if (type === 'edge-neon') {
      ctx.fillStyle = '#14101f';
      roundRect(ctx, x, y, w, h, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 45, 149, 0.8)';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#ff2d95';
      ctx.shadowBlur = 6;
      roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 2);
      ctx.stroke();
    } else if (type === 'lane-dash') {
      ctx.fillStyle = '#14141f';
      roundRect(ctx, x, y, w, h, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(x + 4, y + h / 2);
      ctx.lineTo(x + w - 4, y + h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (type === 'edge-stud') {
      ctx.fillStyle = '#1a1a28';
      roundRect(ctx, x, y, w, h, 3);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 225, 77, 0.85)';
      ctx.fillRect(x + 4, y + 3, 4, h - 6);
      ctx.fillRect(x + 14, y + 5, 4, h - 8);
    } else if (type === 'speed-strip') {
      ctx.fillStyle = 'rgba(80, 255, 160, 0.45)';
      roundRect(ctx, x, y, w, h, 3);
      ctx.fill();
    } else if (type === 'guard-rail') {
      ctx.fillStyle = '#12141c';
      roundRect(ctx, x, y, w, h, 3);
      ctx.fill();
      ctx.strokeStyle = 'rgba(210, 220, 235, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y + 2);
      ctx.lineTo(x + w / 2, y + h - 2);
      ctx.stroke();
    } else if (type === 'orb-nitro') {
      ctx.fillStyle = '#00f0ff';
      ctx.shadowColor = '#00f0ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = '700 8px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', x + w / 2, y + h / 2 + 1);
    } else if (type === 'orb-repair') {
      ctx.fillStyle = '#7fff9f';
      ctx.shadowColor = '#7fff9f';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = '700 7px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('HP', x + w / 2, y + h / 2 + 1);
    } else if (type === 'orb-boost') {
      ctx.fillStyle = '#ffe14d';
      ctx.shadowColor = '#ffe14d';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w * 0.42, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#222';
      ctx.font = '700 9px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', x + w / 2, y + h / 2 + 1);
    } else if (type === 'orb-rammer') {
      const pulse = 0.55 + Math.sin(animFrame * 0.14) * 0.45;
      ctx.strokeStyle = `rgba(255, 45, 149, ${0.4 + pulse * 0.35})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ff2d95';
      ctx.shadowColor = '#b44dff';
      ctx.shadowBlur = 6 + pulse * 6;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = '700 8px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('K', x + w / 2, y + h / 2 + 1);
    } else if (type === 'hp-dots') {
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = '#ff2d95';
        ctx.shadowColor = '#ff2d95';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.arc(x + 6 + i * 10, y + h / 2, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawLegend() {
    const panelW = 280;
    const rowH = 17;
    const headerH = 22;
    const sectionGap = 8;
    const roadRows = 5;
    const pickupRows = 6;
    const panelH = headerH + roadRows * rowH + sectionGap + 14 + pickupRows * rowH + 12;
    const x = W - panelW - 14;
    const y = Math.max(172, H - panelH - 16);

    ctx.save();
    drawHudPanel(x, y, panelW, panelH, 'rgba(0, 240, 255, 0.35)');

    ctx.textAlign = 'left';
    ctx.font = '700 10px Orbitron, sans-serif';
    ctx.fillStyle = '#00f0ff';
    ctx.fillText('SYMBOL LEGEND', x + 14, y + 16);
    ctx.font = '600 8px Orbitron, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.textAlign = 'right';
    ctx.fillText('press L', x + panelW - 14, y + 16);
    ctx.textAlign = 'left';

    const roadItems = [
      { swatch: 'edge-neon', label: 'Neon edge — road boundary' },
      { swatch: 'lane-dash', label: 'Dashed lines — lane dividers' },
      { swatch: 'edge-stud', label: 'Yellow studs — edge markers' },
      { swatch: 'speed-strip', label: 'Green strip — speed boost' },
      { swatch: 'guard-rail', label: 'Guard rails — stay on road' },
    ];

    const pickupItems = [
      { swatch: 'orb-nitro', label: 'N — nitro refill' },
      { swatch: 'orb-repair', label: 'HP — +1 hit point' },
      { swatch: 'orb-boost', label: '+ — score boost & +1 HP' },
      { swatch: 'orb-rammer', label: 'K — knock out traffic (10s)' },
      { swatch: 'hp-dots', label: 'Pink dots — hit points' },
      { swatch: 'edge-neon', label: 'Traffic — avoid (-1 HP)' },
    ];

    let rowY = y + headerH + 4;
    ctx.font = '700 8px Orbitron, sans-serif';
    ctx.fillStyle = '#ffe14d';
    ctx.fillText('ROAD MARKINGS', x + 14, rowY);
    rowY += 12;

    ctx.font = '600 11px Rajdhani, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    roadItems.forEach((item) => {
      drawLegendSwatch(item.swatch, x + 14, rowY - 9, 24, 12);
      ctx.fillText(item.label, x + 44, rowY);
      rowY += rowH;
    });

    rowY += sectionGap;
    ctx.font = '700 8px Orbitron, sans-serif';
    ctx.fillStyle = '#ffe14d';
    ctx.fillText('PICKUPS & HUD', x + 14, rowY);
    rowY += 12;

    ctx.font = '600 11px Rajdhani, sans-serif';
    pickupItems.forEach((item) => {
      drawLegendSwatch(item.swatch, x + 14, rowY - 10, 22, 14);
      ctx.fillText(item.label, x + 44, rowY);
      rowY += rowH;
    });

    ctx.restore();
  }

  function drawHudCorners(x, y, w, h, color, len = 10) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, y + len + 8);
    ctx.lineTo(x + 8, y + 8);
    ctx.lineTo(x + len + 8, y + 8);
    ctx.moveTo(x + w - len - 8, y + 8);
    ctx.lineTo(x + w - 8, y + 8);
    ctx.lineTo(x + w - 8, y + len + 8);
    ctx.moveTo(x + 8, y + h - len - 8);
    ctx.lineTo(x + 8, y + h - 8);
    ctx.lineTo(x + len + 8, y + h - 8);
    ctx.moveTo(x + w - len - 8, y + h - 8);
    ctx.lineTo(x + w - 8, y + h - 8);
    ctx.lineTo(x + w - 8, y + h - len - 8);
    ctx.stroke();
  }

  function getVisibleHudBounds() {
    const container = document.getElementById('game-container');
    const cW = container?.clientWidth || BASE_W;
    const visibleRatio = Math.min(1, cW / Math.max(1, BASE_W));
    const insetX = (W * (1 - visibleRatio)) / 2;
    return {
      left: insetX,
      right: W - insetX,
      width: Math.max(W * 0.5, W * visibleRatio),
      centerX: W / 2,
    };
  }

  function getHudLayout() {
    const vis = getVisibleHudBounds();
    const marginX = Math.max(10, vis.width * 0.0125);
    const marginY = Math.max(8, H * 0.012);
    const panelW = Math.min(
      220,
      vis.width * 0.19,
      Math.max(108, (vis.width - marginX * 3) / 2)
    );
    const statPanelH = Math.max(72, H * 0.12);
    const topRowY = Math.max(64, H * 0.095);
    const hpPanelW = Math.min(248, vis.width * 0.34);
    const hpPanelH = Math.max(48, H * 0.075);
    const nitroW = Math.min(204, vis.width * 0.18);
    const nitroPanelH = Math.max(34, H * 0.052);
    return {
      vis,
      marginX,
      marginY,
      panelW,
      statPanelH,
      topRowY,
      hpPanelW,
      hpPanelH,
      nitroW,
      nitroPanelH,
      nitroY: H - Math.max(42, H * 0.07),
      scoreValueSize: Math.max(22, Math.round(H * 0.039)),
      speedValueSize: Math.max(28, Math.round(H * 0.05)),
      distanceValueSize: Math.max(16, Math.round(H * 0.028)),
    };
  }

  function drawHitPointsHud(layout = getHudLayout()) {
    const panelW = layout.hpPanelW;
    const panelH = layout.hpPanelH;
    const x = layout.vis.centerX - panelW / 2;
    const y = layout.marginY;
    const accent = hitPoints <= 1 ? '#ff2d95' : '#7fff9f';
    const pad = Math.max(12, panelW * 0.07);

    drawHudPanel(x, y, panelW, panelH, accent, { compact: true });

    ctx.textAlign = 'left';
    ctx.font = '700 9px Orbitron, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillText('ARMOR', x + pad, y + 18);

    const segW = Math.max(36, (panelW - pad * 2 - 16) / MAX_HIT_POINTS - 8);
    const segH = 10;
    const segStartX = x + pad;
    const segY = y + 26;
    for (let i = 0; i < MAX_HIT_POINTS; i++) {
      const filled = i < hitPoints;
      const sx = segStartX + i * (segW + 8);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      roundRect(ctx, sx, segY, segW, segH, 5);
      ctx.fill();
      if (filled) {
        const hpGrad = ctx.createLinearGradient(sx, segY, sx + segW, segY);
        hpGrad.addColorStop(0, '#ff2d95');
        hpGrad.addColorStop(1, '#ff6eb4');
        ctx.fillStyle = hpGrad;
        ctx.shadowColor = '#ff2d95';
        ctx.shadowBlur = 10;
        roundRect(ctx, sx, segY, segW, segH, 5);
        ctx.fill();
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        roundRect(ctx, sx + 0.5, segY + 0.5, segW - 1, segH - 1, 5);
        ctx.stroke();
      }
    }

    ctx.textAlign = 'right';
    const valueGrad = ctx.createLinearGradient(x + panelW - 80, y, x + panelW, y);
    valueGrad.addColorStop(0, '#ffffff');
    valueGrad.addColorStop(1, accent);
    ctx.font = '700 24px Orbitron, sans-serif';
    ctx.fillStyle = valueGrad;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 8;
    ctx.fillText(`${hitPoints}`, x + panelW - 42, y + 38);
    ctx.shadowBlur = 0;
    ctx.font = '600 14px Rajdhani, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fillText(`/ ${MAX_HIT_POINTS}`, x + panelW - 18, y + 38);
  }

  function drawParticles() {
    particles.forEach((p) => {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      if (perfProfile.shadows) {
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function drawRain() {
    const level = rainIntensity();
    if (level < 0.05) return;
    ctx.strokeStyle = 'rgba(150, 200, 255, 0.3)';
    ctx.lineWidth = 1;
    rainDrops.forEach((drop) => {
      ctx.globalAlpha = drop.opacity * Math.min(1, level * 1.1);
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 3, drop.y + drop.len);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  function drawHudPanel(x, y, w, h, accent, options = {}) {
    const { compact = false } = options;
    const radius = compact ? 8 : 12;
    ctx.save();

    ctx.shadowColor = accent;
    ctx.shadowBlur = 16;
    const shell = ctx.createLinearGradient(x, y, x + w, y + h);
    shell.addColorStop(0, 'rgba(14, 16, 28, 0.98)');
    shell.addColorStop(0.45, 'rgba(10, 12, 22, 0.97)');
    shell.addColorStop(1, 'rgba(6, 8, 16, 0.99)');
    ctx.fillStyle = shell;
    roundRect(ctx, x, y, w, h, radius);
    ctx.fill();
    ctx.shadowBlur = 0;

    const sheen = ctx.createLinearGradient(x, y, x, y + h * 0.55);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.09)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen;
    roundRect(ctx, x + 1, y + 1, w - 2, h * 0.5, radius - 1);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, radius);
    ctx.stroke();

    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 10;
    roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, radius - 1);
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (!compact) {
      const barGrad = ctx.createLinearGradient(x + 16, y, x + w - 16, y);
      barGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      barGrad.addColorStop(0.5, accent);
      barGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = barGrad;
      roundRect(ctx, x + 16, y + 8, w - 32, 2, 1);
      ctx.fill();
    }

    drawHudCorners(x, y, w, h, accent, compact ? 7 : 11);
    ctx.restore();
  }

  function drawHudStat(x, y, label, value, unit, accent, valueSize, panelW) {
    ctx.textAlign = 'left';
    ctx.font = '700 9px Orbitron, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText(label, x, y);

    const valueY = y + valueSize + 6;
    const valueGrad = ctx.createLinearGradient(x, valueY - valueSize, x + panelW, valueY);
    valueGrad.addColorStop(0, '#ffffff');
    valueGrad.addColorStop(1, accent);
    ctx.font = `700 ${valueSize}px Orbitron, sans-serif`;
    ctx.fillStyle = valueGrad;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 6;
    ctx.fillText(value, x, valueY);
    ctx.shadowBlur = 0;

    if (unit) {
      ctx.font = '600 12px Rajdhani, sans-serif';
      ctx.fillStyle = accent;
      const valueW = ctx.measureText(value).width;
      ctx.globalAlpha = 0.85;
      ctx.fillText(unit, x + valueW + 6, valueY - 4);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(x, valueY + 6, Math.min(panelW - 24, valueSize * 2.2), 1);
    ctx.globalAlpha = 1;
  }

  function drawNitroBar(x, y, w) {
    const barX = x + 16;
    const barY = y + 4;
    const barW = w - 32;
    const barH = 12;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    roundRect(ctx, barX, barY, barW, barH, 6);
    ctx.fill();

    for (let i = 1; i < 5; i++) {
      const tickX = barX + (barW * i) / 5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tickX, barY + 2);
      ctx.lineTo(tickX, barY + barH - 2);
      ctx.stroke();
    }

    const fillW = (barW * nitro) / 100;
    if (fillW > 0) {
      const nitroGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
      nitroGrad.addColorStop(0, '#00f0ff');
      nitroGrad.addColorStop(0.55, '#6e7bff');
      nitroGrad.addColorStop(1, '#ff2d95');
      ctx.fillStyle = nitroGrad;
      ctx.shadowColor = nitroActive ? '#ff2d95' : '#00f0ff';
      ctx.shadowBlur = nitroActive ? 14 : 8;
      roundRect(ctx, barX, barY, fillW, barH, 6);
      ctx.fill();
      ctx.shadowBlur = 0;

      if (nitroActive) {
        const shimmer = (Math.sin(animFrame * 0.25) + 1) * 0.5;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.12 + shimmer * 0.18})`;
        roundRect(ctx, barX, barY, fillW, barH * 0.45, 6);
        ctx.fill();
      }
    }

    ctx.textAlign = 'center';
    ctx.font = '700 9px Orbitron, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillText('NITRO', x + w / 2, y - 8);
    ctx.font = '600 10px Rajdhani, sans-serif';
    ctx.fillStyle = nitroActive ? '#ff9fd0' : 'rgba(255,255,255,0.45)';
    ctx.fillText(`${Math.floor(nitro)}%`, x + w / 2, barY + barH + 12);
  }

  function drawEnvironmentBadge(layout = getHudLayout()) {
    if (themeBannerTimer > 0) return;
    const lighting = getDayNightLighting();
    const label = `${WEATHER_LABELS[weatherType]} · ${lighting.label}`;
    const badgeW = Math.min(168, W * 0.22);
    const badgeH = 22;
    const x = layout.vis.right - badgeW - layout.marginX;
    const y = layout.marginY;
    ctx.save();
    ctx.globalAlpha = lighting.isNight ? 0.82 : 0.9;
    drawHudPanel(x, y, badgeW, badgeH, lighting.isNight ? 'rgba(120, 180, 255, 0.45)' : 'rgba(255, 225, 120, 0.4)', { compact: true });
    ctx.textAlign = 'center';
    ctx.font = '600 11px Rajdhani, sans-serif';
    ctx.fillStyle = lighting.isNight ? '#b8d8ff' : '#ffe8a8';
    ctx.fillText(label, x + badgeW / 2, y + 15);
    ctx.restore();
  }

  function drawKnockoutBadge() {
    if (knockoutTimer <= 0) return;

    const pulse = 0.6 + Math.sin(animFrame * 0.18) * 0.4;
    const badgeW = 168;
    const badgeH = 38;
    const x = W / 2 - badgeW / 2;
    const y = 118;
    ctx.save();
    drawHudPanel(x, y, badgeW, badgeH, `rgba(255, 45, 149, ${0.55 + pulse * 0.35})`, { compact: true });
    ctx.textAlign = 'center';
    ctx.font = '700 15px Orbitron, sans-serif';
    const grad = ctx.createLinearGradient(x, y, x + badgeW, y);
    grad.addColorStop(0, '#ff2d95');
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, '#b44dff');
    ctx.fillStyle = grad;
    ctx.shadowColor = '#ff2d95';
    ctx.shadowBlur = 10 + pulse * 10;
    ctx.fillText(`◆ RAMMER ${Math.ceil(knockoutTimer)}s ◆`, W / 2, y + 24);
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawComboBadge(layout = getHudLayout()) {
    if (combo <= 1 && scoreMultiplier <= 1.01) return;

    const badgeW = Math.min(148, W * 0.2);
    const badgeH = 38;
    const x = layout.vis.right - badgeW - layout.marginX;
    const y = layout.topRowY + layout.statPanelH + 8;
    drawHudPanel(x, y, badgeW, badgeH, '#ff6eb4', { compact: true });

    ctx.textAlign = 'center';
    if (combo > 1) {
      ctx.font = '700 16px Orbitron, sans-serif';
      const comboGrad = ctx.createLinearGradient(x, y, x + badgeW, y);
      comboGrad.addColorStop(0, '#ff9fd0');
      comboGrad.addColorStop(1, '#ff2d95');
      ctx.fillStyle = comboGrad;
      ctx.shadowColor = '#ff2d95';
      ctx.shadowBlur = 10;
      ctx.fillText(`COMBO x${combo}`, W / 2, y + 22);
      ctx.shadowBlur = 0;
    }
    if (scoreMultiplier > 1.01) {
      ctx.font = '600 11px Rajdhani, sans-serif';
      ctx.fillStyle = '#ffe14d';
      ctx.fillText(`${scoreMultiplier.toFixed(1)}x score`, W / 2, y + (combo > 1 ? 34 : 24));
    }
  }

  function drawHUD() {
    const layout = getHudLayout();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);
    ctx.textBaseline = 'alphabetic';
    ctx.shadowBlur = 0;

    const tints = getHudTints();
    const lighting = getDayNightLighting();
    if (lighting.isNight) ctx.globalAlpha = Math.max(0.95, tints.panelAlpha);

    drawHitPointsHud(layout);

    const { panelW, statPanelH, topRowY, marginX, nitroW, nitroY, nitroPanelH, vis } = layout;
    const kmh = Math.round(hudSpeedKmh);
    const speedAccent = tints.speed;
    const scorePanelAccent = lighting.isNight ? 'rgba(120, 190, 255, 0.9)' : 'rgba(255, 225, 77, 0.95)';
    const statPad = Math.max(12, panelW * 0.07);
    const scorePanelX = vis.left + marginX;

    drawHudPanel(scorePanelX, topRowY, panelW, statPanelH, scorePanelAccent);
    drawHudStat(
      scorePanelX + statPad,
      topRowY + 18,
      'SCORE',
      Math.floor(score).toLocaleString(),
      '',
      tints.score,
      layout.scoreValueSize,
      panelW
    );
    drawHudStat(
      scorePanelX + statPad,
      topRowY + 18 + layout.scoreValueSize + 14,
      'DISTANCE',
      `${Math.floor(distance)}`,
      'm',
      tints.distance,
      layout.distanceValueSize,
      panelW
    );

    const speedPanelX = vis.right - panelW - marginX;
    drawHudPanel(speedPanelX, topRowY, panelW, statPanelH, speedAccent);
    drawHudStat(
      speedPanelX + statPad,
      topRowY + 18,
      'VELOCITY',
      `${kmh}`,
      'km/h',
      speedAccent,
      layout.speedValueSize,
      panelW
    );

    ctx.textAlign = 'right';
    ctx.font = '600 11px Rajdhani, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillText(activeCar.name.toUpperCase(), speedPanelX + panelW - statPad, topRowY + statPanelH - 10);

    drawHudPanel(
      scorePanelX,
      nitroY - nitroPanelH + 6,
      nitroW,
      nitroPanelH,
      nitroActive ? 'rgba(255, 110, 180, 0.95)' : 'rgba(0, 240, 255, 0.75)',
      { compact: true }
    );
    drawNitroBar(scorePanelX, nitroY, nitroW);

    if (nitroActive) {
      ctx.textAlign = 'center';
      ctx.font = '700 13px Orbitron, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ff2d95';
      ctx.shadowBlur = 14;
      ctx.fillText('◆ NITRO BOOST ◆', vis.centerX, topRowY - 8);
      ctx.shadowBlur = 0;
    }

    drawEnvironmentBadge(layout);
    drawComboBadge(layout);
    ctx.restore();
  }

  function drawPauseOverlay() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgba(4, 6, 18, 0.62)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 56px Orbitron, sans-serif';
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;
    ctx.fillText('PAUSED', W / 2, H / 2 - 18);
    ctx.shadowBlur = 0;

    ctx.font = '600 17px Rajdhani, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    ctx.fillText('Press ESC to resume', W / 2, H / 2 + 36);
    ctx.restore();
  }

  function drawCountdown() {
    const remaining = Math.max(1, Math.ceil(countdownTimer));
    const label = String(remaining);
    const pulse = 0.82 + Math.sin(animFrame * 0.25) * 0.18;

    ctx.save();
    ctx.fillStyle = 'rgba(4, 6, 18, 0.42)';
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 132px Orbitron, sans-serif';
    const grad = ctx.createLinearGradient(W / 2 - 120, H / 2 - 60, W / 2 + 120, H / 2 + 60);
    grad.addColorStop(0, '#00f0ff');
    grad.addColorStop(0.5, '#ffffff');
    grad.addColorStop(1, '#ff2d95');
    ctx.fillStyle = grad;
    ctx.globalAlpha = pulse;
    ctx.shadowColor = '#ff2d95';
    ctx.shadowBlur = 28;
    ctx.fillText(label, W / 2, H / 2 - 12);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    ctx.font = '600 18px Rajdhani, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.fillText('Get ready — steer into position', W / 2, H / 2 + 86);
    ctx.restore();
  }



  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function setEdgeMarginDebugVisible(visible) {
    document.querySelectorAll('.edge-debug-marker').forEach((el) => {
      el.classList.toggle('hidden', !visible);
    });
  }

  function drawEdgeMarginDebugMarkers() {
    const flash = 0.55 + Math.sin(performance.now() * 0.008) * 0.45;
    const markerX = getViewportEdgeMarkerPositions();
    const centerY = H / 2;

    ctx.save();
    ctx.globalAlpha = flash;
    markerX.forEach((x) => {
      ctx.strokeStyle = '#ffe14d';
      ctx.lineWidth = 5;
      ctx.setLineDash([14, 10]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.fillStyle = '#ff2d95';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, centerY, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '700 16px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('5%', x, centerY);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function render() {
    ctx.save();

    if (shakeTimer > 0) {
      const shake = shakeTimer * 0.5;
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake
      );
    }

    ctx.clearRect(0, 0, W, H);

    if (state === STATE.PLAYING || state === STATE.PAUSED || state === STATE.GAMEOVER || state === STATE.COUNTDOWN) {
      drawBackground();
      drawRoad();
      drawPickups();
      drawObstacles();
      if (!fatalCrash) drawPlayerHeadlights();
      drawPlayer();
      drawRammerCountdown();
      drawFatalCrashExplosions();
      drawParticles();
      drawRain();
      drawWeatherSnow();
      drawFogOverlay();
      drawFloatingTexts();
      if (state === STATE.COUNTDOWN) {
        drawCountdown();
      }
      if (state === STATE.PLAYING || state === STATE.PAUSED) {
        drawThemeBanner();
        if (showLegend) drawLegend();
      }
    }

    const showEdgeDebug = state === STATE.PLAYING
      || state === STATE.PAUSED
      || state === STATE.COUNTDOWN
      || state === STATE.GAMEOVER;
    setEdgeMarginDebugVisible(showEdgeDebug);
    if (showEdgeDebug) drawEdgeMarginDebugMarkers();

    ctx.restore();

    const hudVisible = state === STATE.PLAYING || state === STATE.PAUSED || state === STATE.COUNTDOWN;
    setHudOverlayVisible(false);
    if (hudVisible) drawHUD();
    if (state === STATE.PAUSED) drawPauseOverlay();
  }

  function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let frameDt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    if (frameDt > MAX_FRAME_DT) frameDt = MAX_FRAME_DT;

    if (state !== STATE.PAUSED) {
      simAccumulator += frameDt;
      let steps = 0;
      while (simAccumulator >= FIXED_DT && steps < MAX_SIM_SUBSTEPS) {
        update(FIXED_DT);
        simAccumulator -= FIXED_DT;
        steps += 1;
      }
      if (steps === MAX_SIM_SUBSTEPS && simAccumulator >= FIXED_DT) {
        simAccumulator = 0;
      }

      if (shakeTimer > 0) {
        shakeTimer = Math.max(0, shakeTimer - frameDt * 60);
      }
    }

    render();
    requestAnimationFrame(gameLoop);
  }

  function isTitleStartKey(key) {
    return key === ' ' || key === 'Space' || key === 'Enter';
  }

  function isRestartKey(key) {
    return key === 'Enter';
  }

  function clearStartKeys() {
    keys[' '] = false;
    keys.Space = false;
    keys.Enter = false;
  }

  document.addEventListener('keydown', (e) => {
    if (state === STATE.TITLE) {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        changeCar(-1);
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        changeCar(1);
        return;
      }
    }

    if (state === STATE.TITLE && isTitleStartKey(e.key)) {
      e.preventDefault();
      initAudio();
      startGame();
      clearStartKeys();
      return;
    }

    if (state === STATE.GAMEOVER && isRestartKey(e.key)) {
      e.preventDefault();
      startGame();
      clearStartKeys();
      return;
    }

    if (e.key === 'Escape') {
      if (state === STATE.PLAYING || state === STATE.PAUSED) {
        e.preventDefault();
        togglePause();
        return;
      }
    }

    if (state === STATE.PAUSED) return;

    if (state === STATE.PLAYING && (e.key === 'l' || e.key === 'L')) {
      showLegend = !showLegend;
      return;
    }

    keys[e.key] = true;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Enter'].includes(e.key)) {
      e.preventDefault();
    }
    if (state === STATE.PLAYING && (e.key === ' ' || e.key === 'Space')) {
      initAudio();
    }
  });

  document.addEventListener('keyup', (e) => { keys[e.key] = false; });

  document.getElementById('start-btn').addEventListener('click', () => {
    initAudio();
    startGame();
  });

  document.getElementById('car-prev').addEventListener('click', () => changeCar(-1));
  document.getElementById('car-next').addEventListener('click', () => changeCar(1));

  document.getElementById('restart-btn').addEventListener('click', () => {
    startGame();
  });

  function resizeCanvas() {
    const container = document.getElementById('game-container');
    if (!container) return;

    const cH = container.clientHeight;
    BASE_H = Math.max(360, cH);
    BASE_W = Math.max(640, Math.round(BASE_H * REF_ASPECT));

    W = Math.max(640, Math.round(BASE_W * perfProfile.renderScale));
    H = Math.max(360, Math.round(BASE_H * perfProfile.renderScale));
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = `${BASE_W}px`;
    canvas.style.height = `${BASE_H}px`;

    const stage = document.getElementById('game-stage');
    if (stage) {
      stage.style.width = `${BASE_W}px`;
      stage.style.height = `${BASE_H}px`;
    }

    syncCanvasMetrics();
    syncPlayerScreenY();
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) {
      ctx.imageSmoothingQuality = perfProfile.imageSmoothing;
    }
  }

  function boot() {
    if (window.location.protocol === 'file:') {
      const text = document.querySelector('.loading-text');
      if (text) {
        text.textContent = 'LOADING... (use a local server if this hangs)';
      }
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    initTouchControls();

    loadAssets().catch((err) => {
      const hint = window.location.protocol === 'file:'
        ? ' Try running: npx serve . -l 8765 and open http://localhost:8765'
        : '';
      showBootError(`Failed to load assets: ${err.message}.${hint}`);
    });

    requestAnimationFrame(gameLoop);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();