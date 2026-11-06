import React from 'react';
import {AbsoluteFill, Audio, getStaticFiles, interpolate, Sequence, staticFile, useCurrentFrame} from 'remotion';
import './fonts';
import {CAMERA, COLORS, MUSIC, SCENES, sceneFrames, sec, VIDEO} from './config';
import {Particles} from './components/Particles';
import {Scene1OldWay} from './scenes/Scene1OldWay';
import {Scene2Shift} from './scenes/Scene2Shift';
import {Scene3Beyond} from './scenes/Scene3Beyond';
import {Scene4BiggerPicture} from './scenes/Scene4BiggerPicture';

const Music: React.FC = () => {
  const hasMusic = getStaticFiles().some((f) => f.name === MUSIC.file);
  if (!hasMusic) return null;
  const total = sec(VIDEO.durationInSeconds);
  const volume = (f: number) =>
    MUSIC.volume * interpolate(f, [total - sec(MUSIC.fadeOutSeconds), total], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  // Shift the track so its biggest hit lands on the yellow flood.
  const shift = MUSIC.hitAt == null ? 0 : SCENES.logo.start - MUSIC.hitAt;
  if (shift >= 0) {
    return (
      <Sequence from={sec(shift)} layout="none">
        <Audio src={staticFile(MUSIC.file)} volume={(f) => volume(f + sec(shift))} />
      </Sequence>
    );
  }
  return <Audio src={staticFile(MUSIC.file)} trimBefore={sec(-shift)} volume={volume} />;
};

export const FungoVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const s1 = sceneFrames('oldWay');
  const s2 = sceneFrames('shift');
  const s3a = sceneFrames('privateTraits');
  const s3b = sceneFrames('encryptedBids');
  const s4a = sceneFrames('lookingWrong');
  const s4b = sceneFrames('logo');
  // particles breathe up a little when the screen clears in scene 4a
  const particleBoost = interpolate(frame, [s4a.from - 10, s4a.from + 10], [1, 1.5], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // slow cinematic push-in through scenes 1–3, eased so it never feels mechanical
  const cam = interpolate(frame, [0, s4a.from], [1, CAMERA.pushIn], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: (t) => 1 - Math.pow(1 - t, 1.6),
  });

  return (
    <AbsoluteFill style={{background: COLORS.bg}}>
      <Particles intensity={particleBoost} />
      <AbsoluteFill style={{transform: `scale(${cam})`}}>
      <Sequence from={s1.from} durationInFrames={s1.duration} name="1 · The old way">
        <Scene1OldWay />
      </Sequence>
      <Sequence from={s2.from} durationInFrames={s2.duration} name="2 · The shift">
        <Scene2Shift />
      </Sequence>
      <Sequence from={s3a.from} durationInFrames={s3a.duration + s3b.duration} name="3 · Beyond the artwork">
        <Scene3Beyond />
      </Sequence>
      </AbsoluteFill>
      <Sequence from={s4a.from} durationInFrames={s4a.duration + s4b.duration} name="4 · The bigger picture">
        <Scene4BiggerPicture />
      </Sequence>
      <Music />
    </AbsoluteFill>
  );
};
