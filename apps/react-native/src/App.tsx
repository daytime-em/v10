import { Player, type PlayerStatus, type ReactNativeMedia, Video, VideoPlayer, VideoSkin } from '@videojs/react-native';
import { useEffect, useRef, useState } from 'react';
import { Button, ScrollView, StatusBar, StyleSheet, Text, useColorScheme, View } from 'react-native';

const SOURCE_LIVE = 'https://stream.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM.m3u8';

// warning - this asset's encoding doesn't work well in android emulator, but that's just an emulator quirk. It works fine on a real device.
const SOURCE_VOD = 'https://stream.mux.com/Q3ikJX28joohwD02j01Ew7yyPYeraJwRjVVXrwZjt9xUo.m3u8';
//const SOURCE_VOD = 'https://stream.mux.com/u02xH9SB1ZZNNjPiQp4l6mhzBKJ101uExYx4LU02J5Xm88.m3u8';

/**
 * React Native supplies no themed defaults for `Text` or view backgrounds, so an unstyled screen renders near-black
 * text over the dark window background the OS hands us. Every component that renders text picks its colors from here.
 */
function useTheme() {
  const isDark = useColorScheme() === 'dark';

  return isDark
    ? { background: '#000000', text: '#f2f2f7', textMuted: '#a1a1aa' }
    : { background: '#ffffff', text: '#1c1c1e', textMuted: '#6b7280' };
}

/**
 * The original path: a Player that drives the TurboModule through React context.
 *
 * Intentionally kept but not rendered — swap it into `App` to compare the two implementations. Both control paths are
 * supported, neither is deprecated.
 */
// biome-ignore lint/correctness/noUnusedVariables: kept as a switchable alternative to AdapterVideo
function ContextPlayer() {
  const player = useRef<Player.Ref>(null);
  const [status, setStatus] = useState<PlayerStatus | 'idle'>('idle');
  const [source, setSource] = useState(SOURCE_VOD);
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.text }]}>{'<Player> — context path'}</Text>
      <Player ref={player} source={source} onStatusChange={setStatus} style={styles.video} />
      <Text style={{ color: theme.textMuted }}>status: {status}</Text>
      <Text style={{ color: theme.textMuted }}>source: {source === SOURCE_VOD ? 'vod' : 'live'}</Text>
      <View style={styles.controls}>
        <Button title="Play" onPress={() => player.current?.play()} />
        <Button title="Pause" onPress={() => player.current?.pause()} />
        <Button
          title="Swap source"
          onPress={() => setSource((current) => (current === SOURCE_VOD ? SOURCE_LIVE : SOURCE_VOD))}
        />
      </View>
    </View>
  );
}

/**
 * The adapter path with no store: a Video backed by a ReactNativeMedia implementing the `Media` contract, driven
 * through its ref. Status comes from contract events rather than a callback prop.
 *
 * Intentionally kept but not rendered — swap it into `App` to compare against the store-backed skin below.
 */
// biome-ignore lint/correctness/noUnusedVariables: kept as a switchable alternative to SkinnedPlayer
function AdapterVideo() {
  const media = useRef<ReactNativeMedia>(null);
  const [status, setStatus] = useState('idle');
  const [src, setSrc] = useState(SOURCE_VOD);
  const theme = useTheme();

  useEffect(() => {
    const instance = media.current;
    if (!instance) return;

    const abort = new AbortController();
    const { signal } = abort;

    // Exactly the contract event names — note `pause`, not native's `paused`.
    instance.addEventListener('play', () => setStatus('play'), { signal });
    instance.addEventListener('playing', () => setStatus('playing'), { signal });
    instance.addEventListener('pause', () => setStatus('pause'), { signal });
    instance.addEventListener('ended', () => setStatus('ended'), { signal });

    return () => abort.abort();
  }, []);

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.text }]}>{'<Video> — Media adapter path'}</Text>
      <Video ref={media} src={src} style={styles.video} />
      <Text style={{ color: theme.textMuted }}>status: {status}</Text>
      <Text style={{ color: theme.textMuted }}>src: {src === SOURCE_VOD ? 'vod' : 'live'}</Text>
      <View style={styles.controls}>
        <Button title="Play" onPress={() => media.current?.play()} />
        <Button title="Pause" onPress={() => media.current?.pause()} />
        <Button
          title="Swap src"
          onPress={() => setSrc((current) => (current === SOURCE_VOD ? SOURCE_LIVE : SOURCE_VOD))}
        />
      </View>
    </View>
  );
}

/**
 * The store-backed path: a VideoPlayer holding the store and media adapter, a VideoSkin supplying the container and
 * chrome, and a Video rendering the surface. Same composition as the react-dom preset.
 *
 * Nothing here holds a ref or a status callback — the play button reads the store and the store mirrors the adapter.
 */
function SkinnedPlayer() {
  const [src, setSrc] = useState(SOURCE_VOD);
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: theme.text }]}>{'<VideoPlayer> + <VideoSkin>'}</Text>

      <VideoPlayer>
        <VideoSkin style={styles.video}>
          <Video src={src} style={styles.surface} />
        </VideoSkin>
      </VideoPlayer>

      <Text style={{ color: theme.textMuted }}>src: {src === SOURCE_VOD ? 'vod' : 'live'}</Text>
      <View style={styles.controls}>
        <Button
          title="Swap src"
          onPress={() => setSrc((current) => (current === SOURCE_VOD ? SOURCE_LIVE : SOURCE_VOD))}
        />
      </View>
    </View>
  );
}

export default function App() {
  const theme = useTheme();
  const isDark = useColorScheme() === 'dark';

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: theme.text }]}>@videojs/react-native</Text>
        <SkinnedPlayer />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 32,
    paddingVertical: 48,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  section: {
    alignItems: 'center',
    gap: 8,
  },
  heading: {
    fontSize: 14,
    fontWeight: '600',
  },
  video: {
    width: 320,
    height: 180,
    backgroundColor: 'black',
  },
  surface: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  controls: {
    flexDirection: 'row',
    gap: 16,
  },
});
