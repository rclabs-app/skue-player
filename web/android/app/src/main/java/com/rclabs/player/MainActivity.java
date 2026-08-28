package com.rclabs.player;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.KeyEvent;
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
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;

@UnstableApi
public class MainActivity extends BridgeActivity {
    private ExoPlayer exoPlayer;
    private TextureView textureView;
    private FrameLayout videoContainer;

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

            // Torna o WebView transparente
            this.bridge.getWebView().setBackgroundColor(Color.TRANSPARENT);

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
                    return exoPlayer != null ? (int) exoPlayer.getCurrentPosition() : 0;
                }

                @JavascriptInterface
                public int getDuration() {
                    return exoPlayer != null && exoPlayer.getDuration() > 0 ? (int) exoPlayer.getDuration() : 0;
                }

                @JavascriptInterface
                public boolean isPlaying() {
                    return exoPlayer != null && exoPlayer.isPlaying();
                }
            }, "NativePlayer");
        }
    }

    private void setupExoPlayer() {
        videoContainer = new FrameLayout(this);
        videoContainer.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        videoContainer.setVisibility(View.GONE);
        videoContainer.setBackgroundColor(Color.TRANSPARENT);

        DefaultHttpDataSource.Factory httpDataSourceFactory = new DefaultHttpDataSource.Factory()
                .setUserAgent("Mozilla/5.0 (VLC)")
                .setConnectTimeoutMs(8000)
                .setReadTimeoutMs(8000)
                .setAllowCrossProtocolRedirects(true);

        DefaultMediaSourceFactory mediaSourceFactory = new DefaultMediaSourceFactory(this)
                .setDataSourceFactory(httpDataSourceFactory);

        exoPlayer = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(mediaSourceFactory)
                .build();

        textureView = new TextureView(this);
        textureView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        textureView.setOpaque(true);

        exoPlayer.setVideoTextureView(textureView);
        videoContainer.addView(textureView);

        ViewGroup root = (ViewGroup) getWindow().getDecorView().findViewById(android.R.id.content);
        root.addView(videoContainer, 0);

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
                evalJs("if(window.onNativePlayerRenderingStart) window.onNativePlayerRenderingStart();");
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
                videoContainer.setVisibility(View.VISIBLE);
                MediaItem mediaItem = MediaItem.fromUri(Uri.parse(rawUrl));
                exoPlayer.setMediaItem(mediaItem);
                exoPlayer.prepare();
                exoPlayer.play();
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
            } catch (Exception e) {
                e.printStackTrace();
            }
            videoContainer.setVisibility(View.GONE);
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

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        return super.dispatchKeyEvent(event);
    }
}
