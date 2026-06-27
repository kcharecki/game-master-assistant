<!-- Signature animated all-seeing eye (pulse + blink). -->
<div class="keeper">
  <div class="kt">KEEPER PANEL</div>
  <div class="ks">The truth is<br />not for them.</div>
  <svg class="eye" viewBox="0 0 120 120" fill="none" width="74" height="74">
    <defs>
      <radialGradient id="ig" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#d8ffe9" />
        <stop offset="30%" stop-color="#5ff0a8" />
        <stop offset="70%" stop-color="#1f9c63" />
        <stop offset="100%" stop-color="#0a3a26" />
      </radialGradient>
      <radialGradient id="gg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#39d98a" stop-opacity=".55" />
        <stop offset="60%" stop-color="#1f7a4f" stop-opacity=".18" />
        <stop offset="100%" stop-color="#1f7a4f" stop-opacity="0" />
      </radialGradient>
    </defs>
    <circle class="glow" cx="60" cy="60" r="56" fill="url(#gg)" />
    <path
      d="M12 60 C 32 30, 88 30, 108 60 C 88 90, 32 90, 12 60 Z"
      fill="#06120d"
      stroke="#2f8a66"
      stroke-width="1.4"
    />
    <circle class="iris" cx="60" cy="60" r="22" fill="url(#ig)" stroke="#7dffc0" stroke-width="1" stroke-opacity=".5" />
    <ellipse class="pupil" cx="60" cy="60" rx="6.5" ry="17" fill="#03150d" />
    <circle cx="53" cy="52" r="3" fill="#eafff3" opacity=".8" />
  </svg>
</div>

<style>
  .eye .glow {
    transform-origin: center;
    animation: eyePulse 4.6s ease-in-out infinite;
  }
  .eye .pupil {
    transform-origin: center;
    animation: blink 7s ease-in-out infinite;
  }
  @keyframes eyePulse {
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
  @keyframes blink {
    0%,
    100% {
      transform: scaleY(1);
    }
    46%,
    54% {
      transform: scaleY(0.18);
    }
  }
</style>
