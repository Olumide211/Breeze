/**
 * Direction: turns a frame number into everything the renderer needs (camera, poses, props).
 * Timings and boil come from scenes.ts; this file holds the acting.
 */
import { CAM, LINE_WEIGHT_KEYS, MONTAGE_POSTURE, SCENES, T } from "./scenes";
import { sceneAt } from "./lib/ink";
import { srnd } from "./lib/rand";
import { add, bump, clamp, dir, easeOut, kf, kfPt, lerp, linear, mul, pointAt, prog, rot, sub, type Pt } from "./lib/util";
import { boyRig, FRESH_CORNER, MOUTH_AT, freshFinger, freshPalm, handToWorld, type BoyProps, type Erased, type Redrawn } from "./components/Boy";
import { doodleTip, PAPER_CENTER } from "./components/Paper";
import { ROOM } from "./components/Room";

export type Shot = {
  cam: { zoom: number; x: number; y: number };
  door: number;
  floorShadow: number;
  wallShadow: number;
  seat: "desk" | "bed";
  boy: BoyProps;
  paper: { doodle: number; crumple: number; ball: Pt } | null;
  /** crumpled ball lying around after S5 */
  ball: Pt | null;
  pencil: { tip: Pt; angle: number; roll: number; where: "hand" | "floor" } | null;
  parentHand: { x: number; y: number; close: number } | null;
  hideChair?: boolean;
};

// ── pencil-in-hand geometry ──
const HOLD = 13; // distance from the tip to where the fingers hold it
const GRIP: Pt = [11, 6]; // hand-local point that holds the pencil
export const heldTip = (wrist: Pt, handAngle: number, pencilAngle: number): Pt =>
  sub(add(wrist, rot(GRIP, handAngle)), mul(dir(pencilAngle), HOLD));
export const wristForTip = (tip: Pt, handAngle: number, pencilAngle: number): Pt =>
  sub(add(tip, mul(dir(pencilAngle), HOLD)), rot(GRIP, handAngle));

const DESK = { x: ROOM.deskSeat[0], y: ROOM.deskSeat[1], legDrop: 88 };
const BED = { x: ROOM.bedSeat[0], y: ROOM.bedSeat[1], legDrop: 84 };
const BALL_REST: Pt = [676, 352];
const BALL_FLOOR: Pt = [668, 491];
const LEFT_REST_DESK: Pt = [604, 372];
const FLOOR_PENCIL_Y = 496.5;
const DRAW_HAND = 28;
const DRAW_PENCIL = -112;

const erasedAt = (f: number): Erased => {
  const seg: [number, number, number, number] = [0, 0, 0, 0];
  seg[T.eraseHeadA.seg] = prog(f, T.eraseHeadA.at, T.eraseHeadA.dur);
  seg[T.eraseHeadB.seg] = prog(f, T.eraseHeadB.at, T.eraseHeadB.dur);
  const fingers: Erased["fingers"] = [0, 0, 0, 0, 0];
  T.eraseFingers.order.forEach((finger, i) => {
    fingers[finger] = prog(f, T.eraseFingers.at + i * T.eraseFingers.every, T.eraseFingers.dur);
  });
  return {
    smileCornerLeft: prog(f, T.eraseSmile.at, T.eraseSmile.dur),
    earRight: prog(f, T.eraseEar.at, T.eraseEar.dur),
    headOutlineSegments: seg,
    fingers,
    palm: prog(f, T.erasePalm.at, T.erasePalm.dur),
  };
};
const redrawnAt = (f: number): Redrawn => {
  const fingers: Redrawn["fingers"] = [0, 0, 0, 0, 0];
  T.redrawFingers.order.forEach((finger, i) => {
    fingers[finger] = prog(f, T.redrawFingers.at + i * T.redrawFingers.every, T.redrawFingers.dur);
  });
  return {
    smileCornerLeft: prog(f, T.redrawSmile.at, T.redrawSmile.dur),
    fingers,
    palm: prog(f, T.redrawPalm.at, T.redrawPalm.dur),
  };
};

/** Drawing at the desk: the pencil tip follows the doodle stroke being drawn. */
const drawing = (f: number, doodle: number, wobble = 1) => {
  const tip = add(doodleTip(doodle), [Math.cos(f * 1.3) * 1.2 * wobble, Math.sin(f * 1.55) * 1.2 * wobble]);
  const pencilAngle = DRAW_PENCIL + Math.sin(f * 0.9) * 5 * wobble;
  return { tip, pencilAngle, wrist: wristForTip(tip, DRAW_HAND, pencilAngle) };
};

export const direct = (frame: number): Shot => {
  const sc = sceneAt(frame);
  const f = sc.ones ? frame : frame - (frame % 2); // animate on twos unless the scene says ones

  const shot: Shot = {
    cam: CAM.wide,
    door: kf(f, [[T.doorOpen.at, 0], [T.doorOpen.at + T.doorOpen.dur, 1], [T.doorClose.at, 1], [T.doorClose.at + T.doorClose.dur, 0]]),
    floorShadow: kf(f, [[T.floorShadowIn.at, 0], [T.floorShadowIn.at + T.floorShadowIn.dur, 1], [T.shadowsOut.at, 1], [T.shadowsOut.at + T.shadowsOut.dur, 0]]),
    wallShadow: kf(f, [[T.wallShadowIn.at, 0], [T.wallShadowIn.at + T.wallShadowIn.dur, 1], [T.shadowsOut.at, 1], [T.shadowsOut.at + T.shadowsOut.dur, 0]]),
    seat: "desk",
    boy: {
      ...DESK,
      rightHand: [600, 356],
      leftHand: LEFT_REST_DESK,
      leftHandAngle: 12,
      erased: erasedAt(frame), // eraser sweeps and draw-ons always run on ones
      redrawn: redrawnAt(frame),
      lineWeight: kf(f, LINE_WEIGHT_KEYS),
    },
    paper: { doodle: 1, crumple: 0, ball: PAPER_CENTER },
    ball: null,
    pencil: null,
    parentHand: null,
  };
  const boy = shot.boy;
  const holdRight = (d: { tip: Pt; pencilAngle: number; wrist: Pt }) => {
    boy.rightHand = d.wrist;
    boy.rightHandAngle = DRAW_HAND;
    boy.rightGrip = 1;
    shot.pencil = { tip: d.tip, angle: d.pencilAngle, roll: 0.6, where: "hand" };
  };

  switch (sc.id) {
    case "S1": {
      const doodle = kf(f, [[0, 0.2], [48, 0.76]], linear);
      shot.paper!.doodle = doodle;
      holdRight(drawing(f, doodle));
      Object.assign(boy, { posture: 0.05, lean: 4 + 8 * doodle, mouth: "smile", pupilOffset: { x: 0.55, y: 0.75 }, headTilt: 6 });
      break;
    }
    case "S2": {
      const doodle = kf(f, [[48, 0.76], [64, 0.84]], linear);
      shot.paper!.doodle = doodle;
      holdRight(drawing(f, doodle, f < 64 ? 1 : 0));
      const look = kf(f, [[58, 0], [64, 1]]);
      Object.assign(boy, {
        posture: 0.05, lean: 4 + 8 * doodle, mouth: "smile",
        pupilOffset: { x: lerp(0.55, -1, look), y: lerp(0.75, -0.05, look) },
        headTilt: lerp(6, -3, look), browRaise: 2.5 * look, eyeSize: (6.5 + 0.8 * look) * 1.55,
      });
      break;
    }
    case "S3": {
      shot.cam = CAM.faceDesk;
      shot.paper!.doodle = 0.84;
      holdRight(drawing(64, 0.84, 0));
      const hit = T.eraseSmile.at;
      const after = f >= hit + T.eraseSmile.dur + 2;
      const touch = kf(f, [[T.touchMouth.at, 0], [T.touchMouth.at + T.touchMouth.dur, 1]]);
      const rigNow = boyRig({ ...DESK, posture: 0.05, lean: 10 });
      const mouthWorld = rigNow.headToWorld([MOUTH_AT[0] + 12, MOUTH_AT[1]]);
      const lookBack = f >= 112;
      Object.assign(boy, {
        posture: 0.05, lean: 10 - 3 * bump(f, hit, 8), headTilt: -3 - 5 * bump(f, hit, 8),
        mouth: after ? "o" : "smile",
        eyeSize: (f < hit ? 7.3 : 7.8) * 1.55, browRaise: f < hit ? 2.5 : 4.5, browAngle: f < hit ? 0 : 7,
        pupilOffset: f < hit + 6 ? { x: -1, y: 0 } : lookBack ? { x: -0.95, y: 0.1 } : { x: 0.35, y: 0.95 },
        leftHand: kfPt(touch, [[0, LEFT_REST_DESK[0], LEFT_REST_DESK[1]], [1, mouthWorld[0] + 3, mouthWorld[1] + 15]], linear),
        leftHandAngle: lerp(12, -100, touch), leftInFront: touch > 0, leftGrip: 0.25,
      });
      break;
    }
    case "S4": {
      const cut = Math.floor((f - sc.start) / T.montageCut);
      shot.cam = cut % 2 === 1 ? CAM.mediumDesk : CAM.wide;
      const posture = kf(f, MONTAGE_POSTURE, linear);
      const doodle = kf(f, [[120, 0.84], [168, 1]], linear);
      shot.paper!.doodle = doodle;
      const hits = [T.eraseEar.at, T.eraseHeadA.at, T.eraseHeadB.at, T.thinLines.at - 1];
      const flinch = Math.max(...hits.map((h) => bump(f, h - 1, 7)));
      holdRight(drawing(f, doodle, f < T.thinLines.at ? 1 - flinch : 0));
      Object.assign(boy, {
        posture: clamp(posture + 0.12 * flinch), lean: 12 - 4 * posture, headTilt: 4 + 9 * flinch,
        mouth: f < T.eraseHeadA.at ? "flat" : "sad",
        eyeSize: (6.5 + 1.4 * flinch - posture) * 1.55, browAngle: 4 + 12 * posture, browRaise: 2 * flinch,
        pupilOffset: flinch > 0.2 ? { x: -1, y: 0 } : { x: 0.55, y: 0.8 },
      });
      break;
    }
    case "S5": {
      const pan = kf(f, [[T.deskPan.at, 0], [T.deskPan.at + T.deskPan.dur, 1]]);
      shot.cam = { zoom: 2, x: lerp(CAM.desk.x, CAM.deskFloor.x, pan), y: lerp(CAM.desk.y, CAM.deskFloor.y, pan) };
      const inAt = T.parentHandIn.at, cr = T.crumple.at, out = T.parentHandOut.at;
      const hp = kfPt(f, [[inAt, 430, 150], [inAt + T.parentHandIn.dur, 608, 334], [out, 608, 334], [out + T.parentHandOut.dur, 380, 110]]);
      shot.parentHand = {
        x: hp[0], y: hp[1],
        close: kf(f, [[cr - 1, 0], [cr + T.crumple.dur, 1], [out + 2, 1], [out + T.parentHandOut.dur, 0.5]]),
      };
      shot.paper = {
        doodle: 1,
        crumple: prog(f, cr, T.crumple.dur),
        ball: kfPt(f, [[out, PAPER_CENTER[0], PAPER_CENTER[1]], [out + 6, BALL_REST[0], BALL_REST[1]]], easeOut),
      };
      const drop = T.pencilDrop;
      const flinch = kf(f, [[inAt + 6, 0], [inAt + 10, 1], [out + 2, 1], [out + 10, 0]]);
      const sag = kf(f, [[out + 2, 0], [out + 12, 1]]);
      const pulled: Pt = [592, 352];
      const held = drawing(168, 1, 0);
      const wrist = kfPt(f, [[inAt + 2, held.wrist[0], held.wrist[1]], [inAt + 8, pulled[0], pulled[1]], [out + 4, pulled[0], pulled[1]], [out + 12, 604, 376]]);
      Object.assign(boy, {
        posture: 0.8 - 0.25 * flinch - 0.3 * sag, lean: 9 - 16 * flinch - 12 * sag, headTilt: 4 - 14 * flinch + 16 * sag,
        mouth: flinch > 0.5 && sag < 0.5 ? "o" : "sad",
        eyeSize: (5.6 + 2.4 * flinch * (1 - sag)) * 1.55, browAngle: 12, browRaise: 4 * flinch * (1 - sag),
        pupilOffset: sag > 0.3 ? { x: 0.7, y: 0.9 } : flinch > 0 ? { x: 0.9, y: 0.5 } : { x: 0.55, y: 0.8 },
        rightHand: wrist, rightHandAngle: lerp(DRAW_HAND, -4, kf(f, [[drop, 0], [out + 12, 1]])), rightGrip: kf(f, [[drop - 1, 1], [drop + 2, 0]]),
        leftHand: kfPt(f, [[inAt + 4, LEFT_REST_DESK[0], LEFT_REST_DESK[1]], [inAt + 10, 584, 366], [out + 4, 584, 366], [out + 12, 548, 398]]),
      });
      // the pencil: held → dropped on the desk → off the front edge → rolls under the desk
      const fall = T.pencilFall, roll = T.pencilRollAway;
      if (f < drop) {
        shot.pencil = { tip: heldTip(wrist, DRAW_HAND, DRAW_PENCIL), angle: DRAW_PENCIL, roll: 0.6, where: "hand" };
      } else if (f < fall.at) {
        const k = prog(f, drop, 5);
        const from = heldTip(pulled, DRAW_HAND, DRAW_PENCIL);
        shot.pencil = { tip: [lerp(from[0], 590, k), lerp(from[1], 376, k * k)], angle: lerp(DRAW_PENCIL, -4, easeOut(k)), roll: f * 0.9, where: "hand" };
      } else if (f < roll.at) {
        const k = prog(f, fall.at, fall.dur);
        shot.pencil = { tip: [lerp(590, 628, k), lerp(376, FLOOR_PENCIL_Y, k * k)], angle: lerp(-4, 368, k), roll: f, where: "floor" };
      } else {
        const k = prog(f, roll.at, roll.dur);
        const x = lerp(628, 722, easeOut(k));
        shot.pencil = { tip: [x, FLOOR_PENCIL_Y], angle: 8 + 3 * Math.sin(x / 5), roll: x / 4, where: "floor" };
      }
      break;
    }
    case "S6": {
      shot.cam = CAM.hand;
      shot.paper = null;
      shot.ball = BALL_REST;
      const tremble: Pt = [srnd(31, frame) * 0.35, srnd(32, frame) * 0.35];
      Object.assign(boy, {
        posture: 0.5, lean: -3, headTilt: 20, mouth: "sad", eyeSize: (5.6) * 1.55, browAngle: 14, pupilOffset: { x: 0.6, y: 0.9 },
        rightHand: add([604, 376], tremble), rightHandAngle: -4 + srnd(33, frame) * 1.2, rightGrip: 0,
        leftHand: [548, 398],
      });
      break;
    }
    case "S7":
    case "S8": {
      shot.seat = "bed";
      shot.paper = null;
      shot.ball = BALL_REST;
      const s8 = sc.id === "S8";
      if (s8) shot.cam = CAM.mediumBed;
      const lift = s8 ? kf(f, [[T.liftHead.at, 0], [T.liftHead.at + T.liftHead.dur, 1]]) : 0;
      const breath = s8 ? kf(f, [[T.exhale.at, 0], [T.exhale.at + 7, 1], [T.exhale.at + T.exhale.dur, 0]]) : 0;
      Object.assign(boy, {
        ...BED,
        posture: lerp(1, 0.3, lift), lean: lerp(12, 2, lift), breath, headTilt: lerp(6, -4, lift),
        mouth: lift > 0.6 ? "flat" : "sad",
        eyeSize: lerp(5.4, 6.6, lift) * 1.55, browAngle: lerp(14, 0, lift),
        pupilOffset: lift > 0.3 ? { x: -0.95, y: -0.1 } : { x: 0.2, y: 1 },
        rightHand: [BED.x + 36 - 4 * lift, BED.y - 10 - 2 * breath], rightHandAngle: 35,
        leftHand: [BED.x + 42 - 4 * lift, BED.y - 12 - 2 * breath], leftHandAngle: 30,
      });
      break;
    }
    case "S9": {
      shot.seat = "bed";
      shot.paper = null;
      shot.ball = BALL_REST;
      const medium = f >= T.floorCut;
      if (medium) shot.cam = CAM.floor;
      const ret = T.pencilReturn;
      const restTip: Pt = [471, FLOOR_PENCIL_Y];
      const seen = kf(f, [[ret.at + 4, 0], [ret.at + 10, 1]]);
      const reach = kf(f, [[T.reach.at, 0], [T.reach.at + T.reach.dur, 1], [T.grab + 1, 1], [372, 0.15]]);
      const grabbed = f >= T.grab;
      const handAngle = lerp(30, 84, reach);
      const grabWrist = wristForTip(restTip, 84, 0);
      const leftHand = kfPt(reach, [[0, BED.x + 42, BED.y - 12], [1, grabWrist[0], grabWrist[1]]], linear);
      Object.assign(boy, {
        ...BED,
        posture: 0.3 + 0.2 * reach, lean: 2 + 56 * reach, headTilt: 12 * seen - 10 * reach,
        mouth: "flat", eyeSize: (6.5) * 1.55, browAngle: 0, browRaise: 1.5 * seen,
        pupilOffset: { x: lerp(-0.6, 0.75, seen), y: lerp(0, 0.9, seen) },
        rightHand: [BED.x + 32 + 26 * reach, BED.y - 12 + 34 * reach], rightHandAngle: 35 + 40 * reach,
        leftHand, leftHandAngle: handAngle, leftInFront: medium, leftGrip: grabbed ? 1 : 0.2,
      });
      if (!grabbed) {
        const x = kf(f, [[ret.at, 722], [ret.at + ret.dur, restTip[0]]], easeOut);
        shot.pencil = { tip: [x, FLOOR_PENCIL_Y], angle: 3 * Math.sin(x / 5), roll: x / 4, where: "floor" };
      } else {
        const a = lerp(0, -70, prog(f, T.grab, 6));
        shot.pencil = { tip: heldTip(leftHand, handAngle, a), angle: a, roll: 0.6, where: "hand" };
      }
      break;
    }
    case "S10": {
      shot.seat = "bed";
      shot.paper = null;
      shot.ball = BALL_REST;
      const face = f >= T.faceCut;
      const posture = 0.25, lean = 5;
      if (!face) {
        shot.cam = CAM.handRedraw;
        shot.hideChair = true; // keep the close-up clean
        const wrist: Pt = [448, 390];
        const wAngle = -6;
        // the pencil tip follows whichever new line is being drawn (on ones, with the draw-on)
        const strokes: { pts: Pt[]; at: number; dur: number }[] = [
          { pts: freshPalm(), at: T.redrawPalm.at, dur: T.redrawPalm.dur },
          ...T.redrawFingers.order.map((finger, i) => ({ pts: freshFinger(finger), at: T.redrawFingers.at + i * T.redrawFingers.every, dur: T.redrawFingers.dur })),
        ];
        let cur = strokes[0];
        for (const s of strokes) if (frame >= s.at) cur = s;
        const done = frame >= cur.at + cur.dur + 1 && cur === strokes[strokes.length - 1];
        const local = pointAt(cur.pts, prog(frame, cur.at, cur.dur));
        const tip = add(handToWorld(wrist, wAngle, local), done ? [10, -4] : [0, 0]);
        const pAngle = -72;
        const hAngle = 105;
        Object.assign(boy, {
          ...BED, posture: 0.1, lean: 2, headTilt: 14, mouth: "flat", eyeSize: (6.5) * 1.55, browAngle: -2, pupilOffset: { x: 0.8, y: 0.8 },
          rightHand: wrist, rightHandAngle: wAngle,
          leftHand: wristForTip(tip, hAngle, pAngle), leftHandAngle: hAngle, leftInFront: false, leftGrip: 1,
        });
        shot.pencil = { tip, angle: pAngle, roll: 0.6, where: "hand" };
      } else {
        shot.cam = CAM.faceBed;
        const rs = T.redrawSmile;
        const rigNow = boyRig({ ...BED, posture, lean, headTilt: 0 });
        const start = rigNow.headToWorld(FRESH_CORNER[0]);
        const away: Pt = [start[0] + 16, start[1] + 26];
        const calm = f >= T.calmSmile;
        let tip: Pt;
        if (frame < rs.at) tip = kfPt(f, [[T.faceCut, away[0], away[1]], [rs.at, start[0], start[1]]]);
        else if (frame <= rs.at + rs.dur) tip = rigNow.headToWorld(pointAt(FRESH_CORNER, prog(frame, rs.at, rs.dur)));
        else {
          const end = rigNow.headToWorld(FRESH_CORNER[FRESH_CORNER.length - 1]);
          tip = kfPt(f, [[rs.at + rs.dur, end[0], end[1]], [rs.at + rs.dur + 8, away[0] + 6, away[1] + 34]]);
        }
        const pAngle = 62, hAngle = -122;
        Object.assign(boy, {
          ...BED, posture, lean, headTilt: 0, mouth: calm ? "calmSmile" : "flat",
          eyeSize: (calm ? 6.8 : 6.5) * 1.55, browAngle: -3, browRaise: calm ? 1 : 0,
          pupilOffset: calm ? { x: 0.45, y: 0.15 } : { x: 0.8, y: 0.85 },
          rightHand: [BED.x + 34, BED.y - 12], rightHandAngle: 30,
          leftHand: wristForTip(tip, hAngle, pAngle), leftHandAngle: hAngle, leftInFront: true, leftGrip: 1,
        });
        shot.pencil = { tip, angle: pAngle, roll: 0.6, where: "hand" };
      }
      break;
    }
    case "S11": {
      const doodle = kf(f, [[T.freshDoodle.at, 0], [T.freshDoodle.at + T.freshDoodle.dur, 0.1]], linear);
      shot.paper = { doodle, crumple: 0, ball: PAPER_CENTER };
      shot.ball = BALL_FLOOR;
      holdRight(drawing(f, doodle, f < T.freshDoodle.at + T.freshDoodle.dur ? 0.5 : 0));
      Object.assign(boy, { posture: 0.05, lean: 5, headTilt: 6, mouth: "calmSmile", eyeSize: (6.6) * 1.55, browAngle: -2, pupilOffset: { x: 0.55, y: 0.75 } });
      break;
    }
    default:
      break;
  }
  return shot;
};

export const END_CARD_START = SCENES[SCENES.length - 1].start;
