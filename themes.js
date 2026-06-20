(() => {
  'use strict';

  function seeded(seed) {
    let s = seed | 0;
    return () => {
      s = (s * 1664525 + 1013904223) | 0;
      return (s >>> 0) / 4294967296;
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function drawSkyGradient(ctx, W, H, stops) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    stops.forEach(([pos, color]) => grad.addColorStop(pos, color));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawCitySilhouette(ctx, W, H, bgOffset, rng, palette) {
    const baseY = H * 0.42;
    const blockW = 38 + rng() * 26;
    const count = Math.ceil(W / blockW) + 3;
    const shift = (bgOffset * 0.18) % blockW;

    for (let i = -2; i < count; i++) {
      const x = i * blockW - shift;
      const h = 60 + rng() * 180;
      const w = blockW * (0.7 + rng() * 0.45);
      ctx.fillStyle = palette.building;
      ctx.fillRect(x, baseY - h, w, h + H * 0.6);

      const winRows = Math.floor(h / 16);
      for (let row = 0; row < winRows; row++) {
        for (let col = 0; col < 3; col++) {
          if (rng() > 0.35) continue;
          const wx = x + 6 + col * 10;
          const wy = baseY - h + 10 + row * 16;
          ctx.fillStyle = palette.window;
          ctx.globalAlpha = 0.35 + rng() * 0.55;
          ctx.fillRect(wx, wy, 5, 8);
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawMountain(ctx, W, H, color, peakX) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(peakX - W * 0.55, H * 0.55);
    ctx.lineTo(peakX, H * 0.18);
    ctx.lineTo(peakX + W * 0.6, H * 0.55);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(peakX - 40, H * 0.28);
    ctx.lineTo(peakX, H * 0.18);
    ctx.lineTo(peakX + 42, H * 0.29);
    ctx.closePath();
    ctx.fill();
  }

  function drawTorii(ctx, x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-55, 0);
    ctx.quadraticCurveTo(0, -28, 55, 0);
    ctx.stroke();
    ctx.fillRect(-62, -4, 124, 8);
    ctx.fillRect(-42, 0, 10, 70);
    ctx.fillRect(32, 0, 10, 70);
    ctx.restore();
  }

  function drawLanternRow(ctx, W, y, count, color, animFrame) {
    for (let i = 0; i < count; i++) {
      const x = (i + 0.5) * (W / count) + Math.sin(animFrame * 0.04 + i) * 4;
      ctx.fillStyle = '#2a1810';
      ctx.fillRect(x - 1, y - 30, 2, 30);
      const glow = 0.55 + Math.sin(animFrame * 0.08 + i * 1.3) * 0.25;
      ctx.fillStyle = color;
      ctx.globalAlpha = glow;
      ctx.beginPath();
      ctx.ellipse(x, y, 10, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function makeParticleField(type, count, W, H, seed) {
    const rng = seeded(seed);
    return Array.from({ length: count }, () => ({
      x: rng() * W,
      y: rng() * H,
      speed: 0.4 + rng() * 1.4,
      drift: (rng() - 0.5) * 0.8,
      size: 2 + rng() * 5,
      spin: rng() * Math.PI * 2,
      spinSpeed: (rng() - 0.5) * 0.04,
      phase: rng() * Math.PI * 2,
      type,
    }));
  }

  function updateThemeParticles(particles, W, H, scroll, dt) {
    particles.forEach((p) => {
      p.y += p.speed + scroll * 0.35;
      p.x += p.drift + Math.sin(p.phase) * 0.3;
      p.spin += p.spinSpeed;
      p.phase += dt * 1.5;
      if (p.y > H + 12) {
        p.y = -12;
        p.x = Math.random() * W;
      }
      if (p.x < -12) p.x = W + 12;
      if (p.x > W + 12) p.x = -12;
    });
  }

  function drawThemeParticles(ctx, particles, colors) {
    particles.forEach((p) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.spin);
      ctx.globalAlpha = 0.55 + Math.sin(p.phase) * 0.25;
      if (p.type === 'sakura') {
        ctx.fillStyle = colors.petal;
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.65, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'snow') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'maple') {
        ctx.fillStyle = colors.leaf;
        ctx.fillRect(-p.size * 0.4, -p.size * 0.2, p.size * 0.8, p.size * 0.45);
      } else if (p.type === 'firefly') {
        ctx.fillStyle = colors.glow;
        ctx.shadowColor = colors.glow;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  const BG_VERSION = '2';

  function drawThemeBackground(ctx, W, H, bgOffset, theme, img) {
    if (img) {
      const scale = Math.max(W / img.width, H / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = (W - dw) / 2;
      const scroll = ((bgOffset * scale * 0.32) % dh + dh) % dh;
      const startY = -scroll;

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.filter = theme.imageFilter || 'saturate(1.12) contrast(1.08)';
      ctx.globalAlpha = theme.imageAlpha || 0.94;

      let y = startY - dh;
      while (y < H + dh) {
        ctx.drawImage(img, dx, y, dw, dh);
        y += dh;
      }

      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.restore();
    } else if (theme.drawFallback) {
      theme.drawFallback(ctx, W, H, bgOffset, 0, 0);
    }

    if (theme.overlayStops) {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      theme.overlayStops.forEach(([pos, color]) => grad.addColorStop(pos, color));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    const vignette = ctx.createRadialGradient(W / 2, H * 0.52, H * 0.2, W / 2, H * 0.52, H * 0.95);
    vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vignette.addColorStop(1, theme.vignette || 'rgba(4, 4, 12, 0.42)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);
  }

  const THEMES = [
    {
      id: 'tokyo-neon-night',
      name: 'Tokyo Neon Night',
      subtitle: 'Rain-slick streets under electric signs',
      image: `assets/backgrounds/tokyo-neon-night.jpg?v=${BG_VERSION}`,
      vignette: 'rgba(6, 4, 18, 0.48)',
      overlayStops: [
        [0, 'rgba(8, 4, 20, 0.15)'],
        [0.55, 'rgba(8, 4, 20, 0.05)'],
        [1, 'rgba(0, 240, 255, 0.1)'],
      ],
      rain: 0.85,
      initParticles(W, H) {
        return [];
      },
      drawFallback(ctx, W, H, bgOffset, animFrame) {
        drawSkyGradient(ctx, W, H, [
          [0, '#0a0618'],
          [0.35, '#1a0f3a'],
          [0.7, '#2b1458'],
          [1, '#120a24'],
        ]);

        const rng = seeded(42);
        drawCitySilhouette(ctx, W, H, bgOffset, rng, {
          building: 'rgba(8, 6, 20, 0.92)',
          window: '#ff4fd8',
        });

        for (let i = 0; i < 8; i++) {
          const x = (i * 167 + animFrame * 0.2) % W;
          const y = H * 0.3 + (i % 3) * 40;
          ctx.fillStyle = i % 2 ? '#00f0ff' : '#ff2d95';
          ctx.globalAlpha = 0.55 + Math.sin(animFrame * 0.06 + i) * 0.3;
          ctx.font = '700 18px Orbitron, sans-serif';
          ctx.fillText(i % 2 ? '渋谷' : 'TOKYO', x, y);
        }
        ctx.globalAlpha = 1;

        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, 'rgba(10, 6, 24, 0.2)');
        grad.addColorStop(1, 'rgba(0, 240, 255, 0.08)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      },
    },
    {
      id: 'shibuya-sunset',
      name: 'Shibuya Sunset',
      subtitle: 'Golden hour over the crossing',
      image: `assets/backgrounds/shibuya-sunset.jpg?v=${BG_VERSION}`,
      vignette: 'rgba(20, 8, 30, 0.35)',
      overlayStops: [
        [0, 'rgba(255, 160, 80, 0.12)'],
        [0.6, 'rgba(10, 8, 20, 0.08)'],
        [1, 'rgba(30, 12, 40, 0.2)'],
      ],
      rain: 0,
      initParticles(W, H) {
        return makeParticleField('firefly', 18, W, H, 7);
      },
      drawFallback(ctx, W, H, bgOffset, animFrame) {
        drawSkyGradient(ctx, W, H, [
          [0, '#ffb347'],
          [0.25, '#ff6b6b'],
          [0.55, '#9b4dca'],
          [1, '#2d1b4e'],
        ]);

        ctx.fillStyle = 'rgba(255, 210, 120, 0.45)';
        ctx.beginPath();
        ctx.arc(W * 0.72, H * 0.22, 55, 0, Math.PI * 2);
        ctx.fill();

        const rng = seeded(11);
        drawCitySilhouette(ctx, W, H, bgOffset * 0.7, rng, {
          building: 'rgba(30, 12, 40, 0.75)',
          window: '#ffe08a',
        });

        drawLanternRow(ctx, W, H * 0.48, 9, '#ff9f43', animFrame);
      },
      drawParticles: (ctx, particles) => drawThemeParticles(ctx, particles, { glow: '#ffd56b' }),
    },
    {
      id: 'fuji-spring',
      name: 'Mount Fuji Spring',
      subtitle: 'Cherry blossoms and morning mist',
      image: `assets/backgrounds/fuji-spring.jpg?v=${BG_VERSION}`,
      vignette: 'rgba(80, 50, 90, 0.28)',
      overlayStops: [
        [0, 'rgba(255, 220, 235, 0.1)'],
        [0.5, 'rgba(255, 255, 255, 0.04)'],
        [1, 'rgba(60, 100, 150, 0.15)'],
      ],
      rain: 0,
      initParticles(W, H) {
        return makeParticleField('sakura', 70, W, H, 23);
      },
      drawFallback(ctx, W, H, bgOffset) {
        drawSkyGradient(ctx, W, H, [
          [0, '#f8d7ef'],
          [0.4, '#f5b8d8'],
          [0.75, '#9ec8f5'],
          [1, '#6a9fd4'],
        ]);

        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(0, H * 0.45, W, H * 0.2);

        drawMountain(ctx, W, H, 'rgba(100, 120, 150, 0.55)', W * 0.5);

        const rng = seeded(5);
        for (let i = 0; i < 16; i++) {
          const x = i * 90 - (bgOffset * 0.12) % 90;
          const h = 50 + rng() * 40;
          ctx.fillStyle = 'rgba(180, 90, 120, 0.35)';
          ctx.beginPath();
          ctx.moveTo(x, H * 0.58);
          ctx.lineTo(x + 18, H * 0.58 - h);
          ctx.lineTo(x + 36, H * 0.58);
          ctx.fill();
        }
      },
      drawParticles: (ctx, particles) => drawThemeParticles(ctx, particles, { petal: '#ffc2d8' }),
    },
    {
      id: 'kyoto-winter',
      name: 'Kyoto Winter',
      subtitle: 'Snowfall past crimson torii gates',
      image: `assets/backgrounds/kyoto-winter.jpg?v=${BG_VERSION}`,
      vignette: 'rgba(12, 20, 40, 0.38)',
      overlayStops: [
        [0, 'rgba(30, 50, 90, 0.12)'],
        [0.55, 'rgba(200, 220, 240, 0.06)'],
        [1, 'rgba(255, 255, 255, 0.1)'],
      ],
      rain: 0,
      initParticles(W, H) {
        return makeParticleField('snow', 90, W, H, 99);
      },
      drawFallback(ctx, W, H, bgOffset) {
        drawSkyGradient(ctx, W, H, [
          [0, '#1a2a4a'],
          [0.5, '#3a5a8a'],
          [1, '#c9d8ef'],
        ]);

        drawMountain(ctx, W, H, 'rgba(50, 70, 100, 0.5)', W * 0.35);
        drawTorii(ctx, W * 0.25 - (bgOffset * 0.05) % 60, H * 0.52, 1.1, '#c62828');
        drawTorii(ctx, W * 0.72 - (bgOffset * 0.05) % 60, H * 0.56, 0.85, '#b71c1c');

        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(0, H * 0.62, W, H * 0.38);
      },
      drawParticles: (ctx, particles) => drawThemeParticles(ctx, particles, {}),
    },
    {
      id: 'osaka-festival',
      name: 'Osaka Summer Festival',
      subtitle: 'Lanterns and fireworks over the bay',
      image: `assets/backgrounds/osaka-festival.jpg?v=${BG_VERSION}`,
      vignette: 'rgba(8, 12, 35, 0.4)',
      overlayStops: [
        [0, 'rgba(255, 80, 60, 0.08)'],
        [0.5, 'rgba(10, 20, 50, 0.1)'],
        [1, 'rgba(40, 10, 50, 0.18)'],
      ],
      rain: 0.15,
      initParticles(W, H) {
        return makeParticleField('firefly', 30, W, H, 55);
      },
      drawFallback(ctx, W, H, bgOffset, animFrame) {
        drawSkyGradient(ctx, W, H, [
          [0, '#0b1a3a'],
          [0.45, '#1e3a6a'],
          [1, '#3a1a4a'],
        ]);

        ctx.fillStyle = 'rgba(20, 60, 120, 0.45)';
        ctx.fillRect(0, H * 0.55, W, H * 0.45);

        drawLanternRow(ctx, W, H * 0.42, 12, '#ff5252', animFrame);

        for (let i = 0; i < 4; i++) {
          const bx = W * (0.2 + i * 0.2);
          const by = H * (0.12 + (i % 2) * 0.06);
          const pulse = 0.4 + Math.sin(animFrame * 0.05 + i * 2) * 0.35;
          ctx.fillStyle = `rgba(255, ${120 + i * 30}, 200, ${pulse})`;
          ctx.beginPath();
          ctx.arc(bx, by, 8 + pulse * 10, 0, Math.PI * 2);
          ctx.fill();
        }

        const rng = seeded(31);
        drawCitySilhouette(ctx, W, H, bgOffset * 0.5, rng, {
          building: 'rgba(10, 15, 35, 0.8)',
          window: '#ffd54f',
        });
      },
      drawParticles: (ctx, particles) => drawThemeParticles(ctx, particles, { glow: '#ff8a80' }),
    },
    {
      id: 'autumn-maple',
      name: 'Autumn Maple Tunnel',
      subtitle: 'Crimson leaves along a mountain pass',
      image: `assets/backgrounds/autumn-maple.jpg?v=${BG_VERSION}`,
      vignette: 'rgba(40, 18, 8, 0.32)',
      overlayStops: [
        [0, 'rgba(255, 200, 120, 0.1)'],
        [0.55, 'rgba(80, 30, 10, 0.06)'],
        [1, 'rgba(30, 12, 8, 0.22)'],
      ],
      rain: 0,
      initParticles(W, H) {
        return makeParticleField('maple', 55, W, H, 77);
      },
      drawFallback(ctx, W, H, bgOffset) {
        drawSkyGradient(ctx, W, H, [
          [0, '#ffd9a0'],
          [0.4, '#ff9a62'],
          [0.75, '#8b4513'],
          [1, '#3d2314'],
        ]);

        for (let side = 0; side < 2; side++) {
          const xBase = side === 0 ? 0 : W * 0.72;
          for (let i = 0; i < 14; i++) {
            const x = xBase + i * 22 - (bgOffset * 0.08) % 22;
            const h = 120 + (i % 5) * 18;
            ctx.fillStyle = side === 0 ? 'rgba(120, 45, 20, 0.7)' : 'rgba(90, 35, 15, 0.7)';
            ctx.fillRect(x, H * 0.35, 16, h);
            ctx.fillStyle = side === 0 ? '#e65100' : '#bf360c';
            ctx.beginPath();
            ctx.arc(x + 8, H * 0.35, 28 + (i % 3) * 6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      },
      drawParticles: (ctx, particles) => drawThemeParticles(ctx, particles, { leaf: '#d84315' }),
    },
    {
      id: 'coastal-dawn',
      name: 'Coastal Highway Dawn',
      subtitle: 'First light over the Pacific',
      image: `assets/backgrounds/coastal-dawn.jpg?v=${BG_VERSION}`,
      vignette: 'rgba(20, 40, 70, 0.3)',
      overlayStops: [
        [0, 'rgba(255, 200, 180, 0.14)'],
        [0.45, 'rgba(120, 170, 220, 0.06)'],
        [1, 'rgba(20, 50, 90, 0.2)'],
      ],
      rain: 0.2,
      initParticles(W, H) {
        return [];
      },
      drawFallback(ctx, W, H, bgOffset, animFrame) {
        drawSkyGradient(ctx, W, H, [
          [0, '#fce4d6'],
          [0.3, '#f8b6c4'],
          [0.6, '#89b4e8'],
          [1, '#2e5f8a'],
        ]);

        ctx.fillStyle = 'rgba(46, 95, 138, 0.55)';
        ctx.fillRect(0, H * 0.58, W, H * 0.42);

        for (let i = 0; i < 6; i++) {
          const y = H * 0.62 + i * 14 + Math.sin(animFrame * 0.03 + i) * 3;
          ctx.strokeStyle = `rgba(255,255,255,${0.08 + i * 0.03})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, y);
          for (let x = 0; x <= W; x += 40) {
            ctx.lineTo(x, y + Math.sin((x + bgOffset) * 0.02 + i) * 5);
          }
          ctx.stroke();
        }

        ctx.fillStyle = 'rgba(255, 220, 180, 0.35)';
        ctx.beginPath();
        ctx.ellipse(W * 0.15, H * 0.72, W * 0.55, 30, 0, 0, Math.PI * 2);
        ctx.fill();
      },
    },
    {
      id: 'akihabara-midnight',
      name: 'Akihabara Midnight',
      subtitle: 'Electric town never sleeps',
      image: `assets/backgrounds/akihabara-midnight.jpg?v=${BG_VERSION}`,
      vignette: 'rgba(4, 6, 18, 0.5)',
      overlayStops: [
        [0, 'rgba(0, 240, 255, 0.08)'],
        [0.5, 'rgba(8, 6, 20, 0.12)'],
        [1, 'rgba(255, 45, 149, 0.1)'],
      ],
      rain: 0.5,
      initParticles(W, H) {
        return makeParticleField('firefly', 24, W, H, 88);
      },
      drawFallback(ctx, W, H, bgOffset, animFrame) {
        drawSkyGradient(ctx, W, H, [
          [0, '#050510'],
          [0.5, '#101030'],
          [1, '#1a1040'],
        ]);

        const rng = seeded(64);
        drawCitySilhouette(ctx, W, H, bgOffset, rng, {
          building: 'rgba(5, 8, 22, 0.95)',
          window: '#00e5ff',
        });

        const signs = ['GAME', '電気', 'ARCADE', '秋葉原', 'NEON'];
        signs.forEach((text, i) => {
          const x = (i * 210 + animFrame * 0.35) % (W + 100) - 50;
          const y = 80 + (i % 3) * 55;
          ctx.fillStyle = i % 2 ? '#00f0ff' : '#ff2d95';
          ctx.globalAlpha = 0.65;
          ctx.font = '700 20px Orbitron, sans-serif';
          ctx.fillText(text, x, y);
        });
        ctx.globalAlpha = 1;
      },
      drawParticles: (ctx, particles) => drawThemeParticles(ctx, particles, { glow: '#69f0ae' }),
    },
  ];

  function pickRandomTheme() {
    return THEMES[Math.floor(Math.random() * THEMES.length)];
  }

  window.SCENE_THEMES = THEMES;
  window.pickRandomTheme = pickRandomTheme;
  window.updateThemeParticles = updateThemeParticles;
  window.drawThemeBackground = drawThemeBackground;
})();