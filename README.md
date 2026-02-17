# Sisyphus

**"One must imagine Sisyphus happy."**

Sisyphus is a browser-based raymarching game inspired by the myth of Sisyphus. The goal is simple yet futile: push the boulder up the mountain.

[https://overthrowing.github.io/Futile-March/](https://overthrowing.github.io/Futile-March/)

Winner of the AppLovin "How did you think of this" track at TartanHacks 2026! 

## Features

-   **Raymarching Engine**: Custom WebGL rendering engine using signed distance functions (SDFs) to create the terrain and boulder.
-   **Physics Interaction**: Physics-based interaction between the player, the terrain, and the boulder.
-   **Progressive Web App (PWA)**: Installable on mobile devices with offline support via Service Workers.
-   **Cross-Platform Controls**:
    -   **Desktop**: Keyboard and Mouse (WASD + Mouse Look).
    -   **Mobile**: Touch controls with virtual joystick and look zone.
-   **Dynamic Modules**: "Wi-Fi" feature that dynamically loads external audio modules for background music.

## Project Structure

The project is organized into the following components:

### Core Game (`/sisyphus`)
-   `game.html`: The main entry point containing the game canvas and UI overlays.
-   `game.js`: Manages the main game loop, state, and UI logic.
-   `rendering.js`: Handles WebGL initialization, uniform management, and draw calls.
-   `graphics.js`: Contains the shader code and SDF definitions for the raymarching renderer.
-   `player.js`: Handles player physics, movement, and collision detection.
-   `boulder.js`: Manages the boulder's physics, position, and interaction with the mountain.
-   `libs.js`: Math utilities and vector helper functions.
-   `sw.js`: Service Worker for caching assets and offline functionality.

### Static Modules (`/static`)
-   `wifi.js`: An ES module that implements the "Wi-Fi" button functionality, enabling background music (Vivaldi) from a remote CDN.
-   `imports.js`: The entry point for loading static features.

### Tools (`/`)
-   `run_server.py`: A Python script to serve the project locally (useful for testing Service Workers and CORS).
-   `bundle_minify.py`: A utility to bundle and minify the project for deployment.

## Getting Started

### Prerequisites
-   A modern web browser with WebGL support.
-   Python 3 (optional, for running the local server).

### Running Locally

1.  Clone the repository:
    ```bash
    git clone https://github.com/Overthrowing/Futile-March.git
    cd Futile-March
    ```

2.  Start the local server:
    ```bash
    python3 run_server.py
    ```

3.  Open your browser and navigate to:
    `http://localhost:8000/sisyphus/game.html`

## Controls

### Desktop
-   **W, A, S, D**: Move the player.
-   **Mouse**: Look around.
-   **Space**: Jump.
-   **Hold W (near boulder)**: Push the boulder.
-   **R**: Reset position.

### Mobile
-   **Left Stick**: Move.
-   **Drag Screen**: Look around.
-   **Jump Button**: Jump.

## Technical Details

### Raymarching
Unlike traditional rasterization games that use triangles, Sisyphus uses **Raymarching**. The scene is defined mathematically using Signed Distance Functions (SDFs). For every pixel on the screen, a ray is "marched" forward in steps until it hits a surface defined by the SDF. This allows for smooth, organic shapes and infinite detail without polygons.

### Dynamic Import System
The game features a unique "Wi-Fi" button that demonstrates dynamic module loading. When clicked:
1.  The game attempts to fetch `imports.js` from a remote CDN (jsDelivr/GitHub).
2.  If the remote fetch fails (e.g., offline or local dev), it falls back to the local `../static/imports.js`.
3.  This module then initializes `wifi.js`, which hooks into the DOM to control audio playback.

## Credits
Inspirations for experiments:
https://www.shadertoy.com/view/XsBXWt
https://www.shadertoy.com/view/MdXyzX

Background music: Vivaldi.
