# Synthetic live transport stream

`live-av-30s.ts.gz` contains 30 seconds of solid blue video (H.264 with B frames)
and a generated 440 Hz tone (AAC). It contains no external media or credentials.

Generate with FFmpeg, then gzip with `mtime=0` for a reproducible container:

```sh
ffmpeg -f lavfi -i color=c=blue:size=160x90:rate=25 -f lavfi -i sine=frequency=440:sample_rate=48000 -t 30 -c:v libx264 -preset ultrafast -g 25 -bf 2 -c:a aac -b:a 32k -f mpegts live-av-30s.ts
```

The integration test uses the installed mpegts.js demuxer, remuxer, HTTP loader
and the application configuration. It checks media timestamps and incremental
delivery, not browser decoding, MediaSource buffering or actual wall-clock playback.

`mpegtsPipeline.spec.js` also exercises three finite, overlapping responses through
the continuous loader and checks advancing, contiguous audio/video DTS.

For the optional system diagnostic, run from `web/`:

```sh
SKUE_HTTP_DIAGNOSTICS=1 npm test -- src/lib/liveTsHttp.spec.js
```

This requires FFmpeg and permission to bind a loopback port. It runs for about
33 seconds, makes three sequential HTTP requests to a local synthetic source,
and decodes the resulting fragmented MP4 tracks in memory. It saves no media
and does not test browser rendering. It is skipped in the default test suite.
