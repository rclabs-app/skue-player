package com.rclabs.player;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.SurfaceView;
import android.view.TextureView;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.widget.FrameLayout;
import com.getcapacitor.BridgeActivity;

import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;

@UnstableApi
public class MainActivity extends BridgeActivity {
    private ExoPlayer exoPlayer;
    private FrameLayout videoContainer;
    
    // Cached state for JavascriptInterface (thread-safe)
    private int currentPositionMs = 0;
    private int durationMs = 0;
    private boolean isPlayerPlaying = false;
    private android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    private Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            if (exoPlayer != null) {
                currentPositionMs = (int) exoPlayer.getCurrentPosition();
                long dur = exoPlayer.getDuration();
                durationMs = dur > 0 ? (int) dur : 0;
                isPlayerPlaying = exoPlayer.isPlaying();
            }
            mainHandler.postDelayed(this, 500);
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Garantir que a Janela e a DecorView do Android fiquem 100% transparentes
        try {
            getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
            if (getWindow().getDecorView() != null) {
                getWindow().getDecorView().setBackgroundColor(Color.TRANSPARENT);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebSettings settings = this.bridge.getWebView().getSettings();
            settings.setTextZoom(100);
            settings.setUseWideViewPort(true);
            settings.setLoadWithOverviewMode(true);
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setMediaPlaybackRequiresUserGesture(false);

            // Torna o WebView 100% transparente
            this.bridge.getWebView().setBackgroundColor(Color.TRANSPARENT);
            this.bridge.getWebView().setLayerType(View.LAYER_TYPE_HARDWARE, null);

            setupExoPlayer();

            this.bridge.getWebView().addJavascriptInterface(new Object() {
                @JavascriptInterface
                public void playNativeVideo(String url) {
                    runOnUiThread(() -> startNativeVideo(url));
                }

                @JavascriptInterface
                public void pauseNativeVideo() {
                    runOnUiThread(() -> {
                        if (exoPlayer != null && exoPlayer.isPlaying()) {
                            exoPlayer.pause();
                        }
                    });
                }

                @JavascriptInterface
                public void resumeNativeVideo() {
                    runOnUiThread(() -> {
                        if (exoPlayer != null) {
                            exoPlayer.play();
                        }
                    });
                }

                @JavascriptInterface
                public void seekNativeVideo(int msec) {
                    runOnUiThread(() -> {
                        if (exoPlayer != null) {
                            exoPlayer.seekTo((long) msec);
                        }
                    });
                }

                @JavascriptInterface
                public void stopNativeVideo() {
                    runOnUiThread(() -> closeNativeVideo());
                }

                @JavascriptInterface
                public int getCurrentPosition() {
                    return currentPositionMs;
                }

                @JavascriptInterface
                public int getDuration() {
                    return durationMs;
                }

                @JavascriptInterface
                public boolean isPlaying() {
                    return isPlayerPlaying;
                }

                @JavascriptInterface
                public void updateAspectRatioNative(String ratio) {
                    runOnUiThread(() -> {
                        if (exoPlayer == null || videoContainer == null || videoContainer.getChildCount() == 0) return;
                        
                        androidx.media3.common.VideoSize videoSize = exoPlayer.getVideoSize();
                        int videoWidth = videoSize.width;
                        int videoHeight = videoSize.height;
                        if (videoWidth == 0 || videoHeight == 0) return;

                        int containerWidth = videoContainer.getWidth();
                        int containerHeight = videoContainer.getHeight();
                        if (containerWidth == 0 || containerHeight == 0) return;

                        float targetRatio = 0f;
                        switch (ratio) {
                            case "16:9": targetRatio = 16f / 9f; break;
                            case "4:3": targetRatio = 4f / 3f; break;
                            case "21:9": targetRatio = 21f / 9f; break;
                        }

                        SurfaceView sv = (SurfaceView) videoContainer.getChildAt(0);
                        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) sv.getLayoutParams();
                        params.gravity = android.view.Gravity.CENTER;

                        if (ratio.equals("original")) {
                            float videoRatio = (float) videoWidth / videoHeight;
                            float screenRatio = (float) containerWidth / containerHeight;
                            if (videoRatio > screenRatio) {
                                params.width = containerWidth;
                                params.height = (int) (containerWidth / videoRatio);
                            } else {
                                params.height = containerHeight;
                                params.width = (int) (containerHeight * videoRatio);
                            }
                        } else if (ratio.equals("stretch")) {
                            params.width = containerWidth;
                            params.height = containerHeight;
                        } else if (ratio.equals("zoom")) {
                            float videoRatio = (float) videoWidth / videoHeight;
                            float screenRatio = (float) containerWidth / containerHeight;
                            if (videoRatio > screenRatio) {
                                params.height = containerHeight;
                                params.width = (int) (containerHeight * videoRatio);
                            } else {
                                params.width = containerWidth;
                                params.height = (int) (containerWidth / videoRatio);
                            }
                        } else {
                            float screenRatio = (float) containerWidth / containerHeight;
                            if (targetRatio > screenRatio) {
                                params.width = containerWidth;
                                params.height = (int) (containerWidth / targetRatio);
                            } else {
                                params.height = containerHeight;
                                params.width = (int) (containerHeight * targetRatio);
                            }
                        }
                        sv.setLayoutParams(params);
                    });
                }
            }, "NativePlayer");
        }
    }

    private void setupExoPlayer() {
        videoContainer = new FrameLayout(this);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        );
        videoContainer.setLayoutParams(params);
        videoContainer.setVisibility(View.GONE);
        videoContainer.setBackgroundColor(Color.BLACK);

        DefaultHttpDataSource.Factory httpDataSourceFactory = new DefaultHttpDataSource.Factory()
                .setUserAgent("Mozilla/5.0 (VLC)")
                .setConnectTimeoutMs(10000)
                .setReadTimeoutMs(10000)
                .setAllowCrossProtocolRedirects(true);

        DefaultMediaSourceFactory mediaSourceFactory = new DefaultMediaSourceFactory(this)
                .setDataSourceFactory(httpDataSourceFactory);

        DefaultRenderersFactory renderersFactory = new DefaultRenderersFactory(this)
                .setEnableDecoderFallback(true)
                .setExtensionRendererMode(DefaultRenderersFactory.EXTENSION_RENDERER_MODE_ON);

        exoPlayer = new ExoPlayer.Builder(this, renderersFactory)
                .setMediaSourceFactory(mediaSourceFactory)
                .build();

        ViewGroup root = (ViewGroup) getWindow().getDecorView().findViewById(android.R.id.content);
        root.addView(videoContainer, 0); // ADD BEHIND WEBVIEW (index 0)
        // Removed bringToFront() to ensure Vue UI is on top


        exoPlayer.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_READY) {
                    evalJs("if(window.onNativePlayerPrepared) window.onNativePlayerPrepared();");
                } else if (playbackState == Player.STATE_ENDED) {
                    closeNativeVideo();
                    evalJs("if(window.onNativePlayerEnded) window.onNativePlayerEnded();");
                }
            }

            @Override
            public void onRenderedFirstFrame() {
                runOnUiThread(() -> {
                    if (videoContainer != null) videoContainer.setVisibility(View.VISIBLE);
                });
                evalJs("if(window.onNativePlayerRenderingStart) window.onNativePlayerRenderingStart();");
            }
            
            @Override
            public void onVideoSizeChanged(androidx.media3.common.VideoSize videoSize) {
                evalJs("if(window.onNativePlayerVideoSizeChanged) window.onNativePlayerVideoSizeChanged();");
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                closeNativeVideo();
                int errorCode = error.errorCode;
                evalJs("if(window.onNativePlayerError) window.onNativePlayerError(" + errorCode + ", 0);");
            }
        });
    }

    private void evalJs(String js) {
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(js, null));
        }
    }

    public void startNativeVideo(final String rawUrl) {
        if (exoPlayer != null && videoContainer != null) {
            try {
                runOnUiThread(() -> {
                    getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    videoContainer.removeAllViews();
                    SurfaceView newSurfaceView = new SurfaceView(MainActivity.this);
                    newSurfaceView.setLayoutParams(new FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                    ));
                    videoContainer.addView(newSurfaceView);
                    exoPlayer.setVideoSurfaceView(newSurfaceView);
                    videoContainer.setVisibility(View.VISIBLE);
                });
                MediaItem mediaItem = MediaItem.fromUri(Uri.parse(rawUrl));
                exoPlayer.setMediaItem(mediaItem);
                exoPlayer.prepare();
                exoPlayer.play();
                
                mainHandler.removeCallbacks(progressRunnable);
                mainHandler.post(progressRunnable);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    public void closeNativeVideo() {
        if (exoPlayer != null && videoContainer != null) {
            try {
                exoPlayer.stop();
                exoPlayer.clearMediaItems();
                runOnUiThread(() -> {
                    getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    videoContainer.removeAllViews();
                    videoContainer.setVisibility(View.GONE);
                });
                mainHandler.removeCallbacks(progressRunnable);
                currentPositionMs = 0;
                durationMs = 0;
                isPlayerPlaying = false;
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (exoPlayer != null && exoPlayer.isPlaying()) {
            exoPlayer.pause();
        }
    }

    @Override
    public void onDestroy() {
        if (exoPlayer != null) {
            exoPlayer.release();
            exoPlayer = null;
        }
        super.onDestroy();
    }


}
