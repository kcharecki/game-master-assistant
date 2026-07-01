<!-- Signature all-seeing Keeper eye: cat-slit monster iris that tracks the
     cursor, breathes (pupil dilation), and blinks. Respects reduced motion. -->
<script lang="ts">
  import { onMount } from 'svelte';

  // Iris offset within the eye, in SVG units. Driven by the cursor.
  let dx = $state(0);
  let dy = $state(0);
  // Extra pupil dilation (0..1) when the cursor is close — the monster "notices".
  let dilate = $state(0);

  let svgEl: SVGSVGElement;

  // How far the iris may drift from centre, and the pixel distance that maps
  // to full drift. Both in tune with the 120-unit viewBox.
  const MAX_TRAVEL = 15;
  const REACH = 480;

  const reduceMotion =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Latest pointer position, updated cheaply on every event.
  let ptrX = 0;
  let ptrY = 0;
  // Cached eye centre — recomputed only on scroll/resize, never per mouse event,
  // so a busy pointer doesn't trigger a layout reflow on every move.
  let cx = 0;
  let cy = 0;
  let raf = 0;

  function measure() {
    if (!svgEl) return;
    const r = svgEl.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
  }

  // Do the maths + reactive writes at most once per frame (rAF-coalesced).
  function frame() {
    raf = 0;
    const vx = ptrX - cx;
    const vy = ptrY - cy;
    const dist = Math.hypot(vx, vy) || 1;
    // Clamp travel: linear until REACH, then saturated at MAX_TRAVEL.
    const t = Math.min(dist, REACH) / REACH;
    dx = (vx / dist) * t * MAX_TRAVEL;
    dy = (vy / dist) * t * MAX_TRAVEL;
    // Dilate when the cursor is within ~220px of the eye.
    dilate = Math.max(0, 1 - dist / 220);
  }

  function onMove(e: MouseEvent) {
    ptrX = e.clientX;
    ptrY = e.clientY;
    if (!raf) raf = requestAnimationFrame(frame);
  }

  onMount(() => {
    if (reduceMotion) return;
    measure();
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('scroll', measure, { passive: true, capture: true });
    window.addEventListener('resize', measure, { passive: true });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
      if (raf) cancelAnimationFrame(raf);
    };
  });

  // Cat slit: narrow vertical ellipse. Dilation fattens it slightly.
  const pupilRx = $derived(5 + dilate * 3.5);
</script>

<div class="keeper">
  <div class="kt">KEEPER PANEL</div>
  <div class="ks">The truth is<br />not for them.</div>
  <svg
    bind:this={svgEl}
    class="eye"
    class:still={reduceMotion}
    viewBox="0 0 120 120"
    width="82"
    height="82"
    fill="none"
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="ke-iris" cx="50%" cy="42%" r="62%">
        <stop offset="0%" stop-color="#eafff4" />
        <stop offset="22%" stop-color="#7dffc0" />
        <stop offset="52%" stop-color="#31c988" />
        <stop offset="80%" stop-color="#146b48" />
        <stop offset="100%" stop-color="#052318" />
      </radialGradient>
      <radialGradient id="ke-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#39d98a" stop-opacity=".6" />
        <stop offset="55%" stop-color="#1f7a4f" stop-opacity=".18" />
        <stop offset="100%" stop-color="#1f7a4f" stop-opacity="0" />
      </radialGradient>
      <!-- Subtle fibrous shading around the slit. -->
      <radialGradient id="ke-shade" cx="50%" cy="50%" r="50%">
        <stop offset="55%" stop-color="#000" stop-opacity="0" />
        <stop offset="100%" stop-color="#02150d" stop-opacity=".55" />
      </radialGradient>
      <clipPath id="ke-clip">
        <path d="M10 60 C 32 28, 88 28, 110 60 C 88 92, 32 92, 10 60 Z" />
      </clipPath>
    </defs>

    <circle class="glow" cx="60" cy="60" r="58" fill="url(#ke-glow)" />

    <!-- Everything inside the almond is clipped so the iris can't escape. -->
    <g clip-path="url(#ke-clip)">
      <rect x="0" y="0" width="120" height="120" fill="#06120d" />
      <g class="iris-grp" style="transform: translate({dx}px, {dy}px)">
        <circle cx="60" cy="60" r="26" fill="url(#ke-iris)" />
        <circle cx="60" cy="60" r="26" fill="url(#ke-shade)" />
        <circle
          cx="60"
          cy="60"
          r="26"
          fill="none"
          stroke="#9dffd0"
          stroke-width="1"
          stroke-opacity=".45"
        />
        <!-- Cat slit pupil. -->
        <ellipse class="pupil" cx="60" cy="60" rx={pupilRx} ry="23" fill="#020c07" />
        <!-- Specular catch-lights. -->
        <circle cx="52" cy="49" r="4" fill="#f2fff8" opacity=".9" />
        <circle cx="66" cy="66" r="1.8" fill="#d8ffe9" opacity=".5" />
      </g>
      <!-- Eyelids: parked off-screen, sweep in to meet at the mid-line on blink.
           Curved edges read as real lids closing over the iris. -->
      <path
        class="lid lid-top"
        d="M-4 -56 L124 -56 L124 60 Q60 76 -4 60 Z"
        fill="#06120d"
        stroke="#2f8a66"
        stroke-width="1.2"
      />
      <path
        class="lid lid-bot"
        d="M-4 176 L124 176 L124 60 Q60 44 -4 60 Z"
        fill="#06120d"
        stroke="#2f8a66"
        stroke-width="1.2"
      />
    </g>

    <!-- Almond rim on top of everything. -->
    <path
      d="M10 60 C 32 28, 88 28, 110 60 C 88 92, 32 92, 10 60 Z"
      fill="none"
      stroke="#2f8a66"
      stroke-width="1.4"
    />
  </svg>
</div>

<style>
  .iris-grp {
    transition: transform 0.12s ease-out;
    will-change: transform;
  }
  .eye .glow {
    transform-origin: center;
    animation: kePulse 4.6s ease-in-out infinite;
  }
  /* Blink: lids parked off the almond, snap in to meet at centre, then part. */
  .lid {
    will-change: transform;
  }
  .lid-top {
    transform: translateY(-62px);
    animation: keLidTop 32s ease-in-out infinite;
  }
  .lid-bot {
    transform: translateY(62px);
    animation: keLidBot 32s ease-in-out infinite;
  }
  .pupil {
    transition: rx 0.25s ease-out;
  }
  @keyframes kePulse {
    0%,
    100% {
      opacity: 0.55;
      transform: scale(0.96);
    }
    50% {
      opacity: 1;
      transform: scale(1.04);
    }
  }
  @keyframes keLidTop {
    0%,
    98.2%,
    100% {
      transform: translateY(-62px);
    }
    99%,
    99.4% {
      transform: translateY(0);
    }
  }
  @keyframes keLidBot {
    0%,
    98.2%,
    100% {
      transform: translateY(62px);
    }
    99%,
    99.4% {
      transform: translateY(0);
    }
  }
  .eye.still .glow,
  .eye.still .lid,
  .eye.still .pupil,
  .eye.still .iris-grp {
    animation: none;
    transition: none;
  }
</style>
