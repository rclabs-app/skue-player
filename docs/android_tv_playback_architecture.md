# Android TV Native Playback Architecture

## Overview
Skue utilizes a hybrid architecture for Android TV, blending a Vue.js (Capacitor) web interface with a native hardware-accelerated ExoPlayer. To achieve maximum performance (60fps 4K) and proper UI layering, specific configurations must be strictly maintained.

## Core Rules & Architecture

### 1. View Type: `SurfaceView` vs `TextureView`
* **Rule:** ALWAYS use `SurfaceView`. NEVER use `TextureView`.
* **Reasoning:** `TextureView` forces the GPU to composite frames into the Android View hierarchy, causing severe framerate drops (e.g., 20fps) on 4K Android TVs. `SurfaceView` punches a hole directly to the display hardware layer, bypassing the OS compositor entirely and ensuring flawless native framerate playback.

### 2. Z-Ordering and UI Layering
* **Rule:** The `videoContainer` must be added at `index = 0` (behind the WebView).
* **Rule:** The Vue application (`#app`, `body`, `html`) and the Capacitor `WebView` must be set to `transparent` during playback.
* **Reasoning:** Because `SurfaceView` renders below the window by default, placing the `videoContainer` behind a transparent WebView allows the Vue UI (controls, progress bars) to naturally overlay the video without any complex Android z-index fighting.

### 3. Ghost Frames & Lifecycle Management
* **Rule:** Do NOT use `lockCanvas` or manipulate the canvas to clear the last frame.
* **Rule:** On `closeNativeVideo()`, completely remove the `SurfaceView` from the container using `removeAllViews()`.
* **Rule:** On `startNativeVideo()`, create a brand new `SurfaceView` and add it to the container.
* **Reasoning:** Reusing a view or locking the canvas causes the `MediaCodec` (hardware decoder) to fail initialization on subsequent playbacks (Error 4001: DECODER_INIT_FAILED) due to surface locking conflicts. Destroying and recreating the `SurfaceView` ensures a clean, fresh surface for the hardware decoder and permanently prevents "Ghost Frames" (the last frame of a previous video freezing on screen).

### 4. Visibility and Surface Allocation
* **Rule:** The `videoContainer` MUST be `VISIBLE` when `exoPlayer.prepare()` is called.
* **Reasoning:** If the container is `GONE` or `INVISIBLE`, Android will NOT allocate the underlying hardware Surface. ExoPlayer will play audio but drop all video frames, and events like `onRenderedFirstFrame` will never fire.

---
*Note: Any deviation from these rules will likely result in black screens, audio-only playback, heavy stuttering, or 4001 decoder errors.*
