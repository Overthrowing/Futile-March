export function enableWifi() {
  const wifiBtn = document.getElementById('wifi-btn');
  const bgMusic = document.getElementById('bg-music');
  const titleScreen = document.getElementById('title-screen');

  // Using jsDelivr to serve the GitHub content with correct CORS headers for browser playback
  const AUDIO_SOURCE = "https://cdn.jsdelivr.net/gh/overthrowing/Futile-March/vivaldi.mp3";

  if (!wifiBtn || !bgMusic) {
    console.error("Wifi elements not found.");
    return;
  }

  // Setup Audio
  bgMusic.src = AUDIO_SOURCE;
  bgMusic.crossOrigin = "anonymous";
  bgMusic.loop = true;

  // Event Handler
  const handleWifiClick = (e) => {
    e.stopPropagation();

    const isActive = wifiBtn.classList.toggle('active');

    if (isActive) {
      const playPromise = bgMusic.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Playback failed:", error);
          alert("Audio playback error: " + error.message + "\nCheck console for details.");
          wifiBtn.classList.remove('active');
        });
      }
    } else {
      bgMusic.pause();
    }
  };

  wifiBtn.onclick = handleWifiClick;

  // Show button when game starts
  if (titleScreen) {
    titleScreen.addEventListener('click', () => {
      wifiBtn.classList.remove('hidden');
    });

    // Check if game already started
    if (titleScreen.classList.contains('hidden')) {
      wifiBtn.classList.remove('hidden');
    }
  } else {
    wifiBtn.classList.remove('hidden');
  }

  console.log("Wifi module loaded.");
}
