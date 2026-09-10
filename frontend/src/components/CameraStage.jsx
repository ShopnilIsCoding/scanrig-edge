import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Maximize2, ScanLine, ShieldCheck, Smartphone, SlidersHorizontal } from 'lucide-react';

const L = {
  NOSE: 0, LEYE: 2, REYE: 5, LEAR: 7, REAR: 8, MOUTH_L: 9, MOUTH_R: 10,
  LSH: 11, RSH: 12, LEL: 13, REL: 14, LWR: 15, RWR: 16,
  LHIP: 23, RHIP: 24, LKNE: 25, RKNE: 26, LANK: 27, RANK: 28,
};

const CONNECTIONS = [
  [L.LEAR, L.LEYE], [L.LEYE, L.NOSE], [L.NOSE, L.REYE], [L.REYE, L.REAR], [L.MOUTH_L, L.MOUTH_R],
  [L.LSH, L.RSH], [L.LSH, L.LEL], [L.LEL, L.LWR], [L.RSH, L.REL], [L.REL, L.RWR],
  [L.LSH, L.LHIP], [L.RSH, L.RHIP], [L.LHIP, L.RHIP],
  [L.LHIP, L.LKNE], [L.LKNE, L.LANK], [L.RHIP, L.RKNE], [L.RKNE, L.RANK],
];

const HEAT_LANDMARKS = [L.LWR, L.RWR, L.LEL, L.REL, L.LSH, L.RSH, L.LHIP, L.RHIP, L.LKNE, L.RKNE, L.LANK, L.RANK];
const RESOLUTIONS = {
  // A 4:3 request can reveal more vertical sensor area on webcams that expose it.
  // Cameras that only support 16:9 will simply return their closest supported mode.
  '720p': { width: 960, height: 720 },
  '1080p': { width: 1440, height: 1080 },
};

function isVisible(lm, index, threshold = .22) {
  const point = lm[index];
  return Boolean(point) && (point.visibility ?? point.presence ?? 1) >= threshold;
}

function pointAngle(a, b, c) {
  if (!a || !b || !c) return null;
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const magnitude = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y) + 1e-6;
  const cosine = Math.max(-1, Math.min(1, (v1.x * v2.x + v1.y * v2.y) / magnitude));
  return Math.acos(cosine) * 180 / Math.PI;
}

function angleIfVisible(lm, a, b, c) {
  return isVisible(lm, a) && isVisible(lm, b) && isVisible(lm, c) ? pointAngle(lm[a], lm[b], lm[c]) : null;
}

function availableAverageAngle(lm, triplets) {
  const values = triplets.map(([a, b, c]) => angleIfVisible(lm, a, b, c)).filter(Number.isFinite);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function distance(a, b) {
  if (!a || !b) return null;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a, b) {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function targetScore(value, target, tolerance, floor = 42) {
  if (!Number.isFinite(value)) return floor;
  return clamp(100 - (Math.abs(value - target) / Math.max(tolerance, 1e-6)) * 45, floor, 99);
}

function nearestTargetScore(value, targets, tolerance, floor = 42) {
  return Math.max(...targets.map((target) => targetScore(value, target, tolerance, floor)));
}

function weightedScore(parts, floor = 38) {
  const valid = parts.filter(([value]) => Number.isFinite(value));
  if (!valid.length) return floor;
  const weight = valid.reduce((sum, [, w]) => sum + w, 0) || 1;
  return clamp(valid.reduce((sum, [value, w]) => sum + value * w, 0) / weight, floor, 99);
}

function symmetryScore(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 88;
  return clamp(100 - Math.abs(a - b) * 1.7, 48, 99);
}

function torsoScore(shoulderMid, hipMid, shoulderWidth) {
  if (!shoulderMid || !hipMid || !shoulderWidth) return 88;
  return clamp(100 - Math.abs(shoulderMid.x - hipMid.x) / shoulderWidth * 145, 45, 99);
}

function missingEvaluation(feedback, trackingMode = 'Adjust position') {
  return {
    trackable: false,
    stateA: false,
    stateB: false,
    metric: 0,
    metricLabel: 'CAMERA POSITION',
    formScore: 0,
    feedback,
    trackingMode,
    classifierSafe: false,
    compactMode: false,
  };
}

function poseEvaluation(lm, exerciseId) {
  const shouldersVisible = isVisible(lm, L.LSH) && isVisible(lm, L.RSH);
  const hipsVisible = isVisible(lm, L.LHIP) && isVisible(lm, L.RHIP);
  const kneesVisible = isVisible(lm, L.LKNE) && isVisible(lm, L.RKNE);
  const anklesVisible = isVisible(lm, L.LANK) && isVisible(lm, L.RANK);
  const wristsVisible = isVisible(lm, L.LWR) && isVisible(lm, L.RWR);
  const elbowsVisible = isVisible(lm, L.LEL) && isVisible(lm, L.REL);
  const shoulderWidth = shouldersVisible ? distance(lm[L.LSH], lm[L.RSH]) : null;
  const shoulderMid = shoulderWidth ? midpoint(lm[L.LSH], lm[L.RSH]) : null;
  const hipMid = hipsVisible ? midpoint(lm[L.LHIP], lm[L.RHIP]) : null;
  const nose = isVisible(lm, L.NOSE, .12) ? lm[L.NOSE] : null;

  const leftElbow = angleIfVisible(lm, L.LSH, L.LEL, L.LWR);
  const rightElbow = angleIfVisible(lm, L.RSH, L.REL, L.RWR);
  const elbow = [leftElbow, rightElbow].filter(Number.isFinite);
  const avgElbow = elbow.length ? elbow.reduce((a, b) => a + b, 0) / elbow.length : null;
  const leftKnee = angleIfVisible(lm, L.LHIP, L.LKNE, L.LANK);
  const rightKnee = angleIfVisible(lm, L.RHIP, L.RKNE, L.RANK);
  const knees = [leftKnee, rightKnee].filter(Number.isFinite);
  const avgKnee = knees.length ? knees.reduce((a, b) => a + b, 0) / knees.length : null;
  const hip = availableAverageAngle(lm, [[L.LSH, L.LHIP, L.LKNE], [L.RSH, L.RHIP, L.RKNE]]);
  const torsoDx = shoulderMid && hipMid ? Math.abs(shoulderMid.x - hipMid.x) : null;
  const torsoDy = shoulderMid && hipMid ? Math.abs(shoulderMid.y - hipMid.y) : null;
  const torsoHorizontal = torsoDx != null && torsoDy != null ? torsoDx / (torsoDx + torsoDy + 1e-6) : null;
  const floorLikeTorso = torsoHorizontal != null && torsoHorizontal > .52;
  const uprightTorso = torsoHorizontal == null || torsoHorizontal < .43;
  const bodyLineWithAnkles = availableAverageAngle(lm, [[L.LSH, L.LHIP, L.LANK], [L.RSH, L.RHIP, L.RANK]]);
  const bodyLineWithKnees = availableAverageAngle(lm, [[L.LSH, L.LHIP, L.LKNE], [L.RSH, L.RHIP, L.RKNE]]);
  const bodyLine = bodyLineWithAnkles ?? bodyLineWithKnees;
  const uprightQuality = torsoScore(shoulderMid, hipMid, shoulderWidth);

  if (exerciseId === 'push-up') {
    if (avgElbow == null || !hipsVisible) return missingEvaluation('Turn side-on and keep one shoulder, elbow, wrist and your hips in view.', 'Set up side-on');
    if (!floorLikeTorso) return missingEvaluation('Move side-on and get your body nearly horizontal before push-ups start counting.', 'Get into push-up position');
    const lineScore = bodyLine == null ? 76 : targetScore(bodyLine, 174, 34, 42);
    const armScore = nearestTargetScore(avgElbow, [166, 92], 54, 48);
    const score = weightedScore([[lineScore, .62], [armScore, .38]], 45);
    return {
      trackable: true,
      stateA: avgElbow > 145,
      stateB: avgElbow < 126,
      metric: avgElbow,
      metricLabel: 'Elbow bend',
      formScore: Math.round(score),
      feedback: avgElbow < 126 ? 'Good depth. Press back up without dropping your hips.' : bodyLine != null && bodyLine < 148 ? 'Bring your hips into line with your shoulders.' : 'Lower your chest with control.',
      trackingMode: bodyLineWithAnkles ? 'Body in view' : 'Upper body in view',
      classifierSafe: true,
    };
  }

  if (exerciseId === 'squat') {
    if (avgKnee == null) return missingEvaluation('Keep your hips, knees and at least one ankle in view.', 'Show your lower body');
    if (!uprightTorso) return missingEvaluation('Stand upright and face the camera before squat counting starts.', 'Stand tall');
    const depthScore = nearestTargetScore(avgKnee, [170, 105], 58, 40);
    const balanceScore = symmetryScore(leftKnee, rightKnee);
    const score = weightedScore([[depthScore, .52], [balanceScore, .22], [uprightQuality, .26]], 40);
    return {
      trackable: true,
      stateA: avgKnee > 150,
      stateB: avgKnee < 126,
      metric: avgKnee,
      metricLabel: 'Knee bend',
      formScore: Math.round(score),
      feedback: avgKnee < 126 ? 'Good depth. Drive through your whole foot and stand tall.' : avgKnee < 143 ? 'Keep your chest tall and lower a little more.' : 'Sit your hips back and keep your knees following your feet.',
      trackingMode: anklesVisible ? 'Lower body ready' : 'Lower body partial',
      classifierSafe: true,
    };
  }

  if (exerciseId === 'lunge') {
    if (!knees.length) return missingEvaluation('Keep one hip, knee and ankle clearly in view.', 'Show your working leg');
    const activeKnee = Math.min(...knees);
    const depthScore = nearestTargetScore(activeKnee, [168, 100], 56, 42);
    const score = weightedScore([[depthScore, .66], [uprightQuality, .34]], 42);
    return {
      trackable: true,
      stateA: activeKnee > 146,
      stateB: activeKnee < 126,
      metric: activeKnee,
      metricLabel: 'Front knee',
      formScore: Math.round(score),
      feedback: activeKnee < 126 ? 'Good depth. Push through the front foot to return.' : 'Take a stable step and lower with your chest tall.',
      trackingMode: 'Working leg ready',
      classifierSafe: true,
    };
  }

  if (exerciseId === 'jumping-jack') {
    if (!shouldersVisible || !shoulderWidth || !shoulderMid || !elbowsVisible) {
      return missingEvaluation('Keep your shoulders and elbows in view. Your hands may go above the top edge.', 'Compact jumping-jack view');
    }
    const elbowMidY = (lm[L.LEL].y + lm[L.REL].y) / 2;
    const elbowSpread = distance(lm[L.LEL], lm[L.REL]) / shoulderWidth;
    const wristMidY = wristsVisible ? (lm[L.LWR].y + lm[L.RWR].y) / 2 : null;
    const wristSpread = wristsVisible ? distance(lm[L.LWR], lm[L.RWR]) / shoulderWidth : null;
    const headReference = nose?.y ?? shoulderMid.y - shoulderWidth * .75;
    const wristOpen = wristsVisible && wristMidY < headReference + .055 && wristSpread > 1.30;
    // Laptop cameras often clip the hands above the frame. Elbows are a reliable
    // compact-view cue for the same overhead arm phase, so counting can continue.
    const elbowOpen = elbowMidY < shoulderMid.y - shoulderWidth * .18 && elbowSpread > 1.25;
    const open = wristOpen || elbowOpen;
    const wristClosed = wristsVisible && wristMidY > shoulderMid.y + .10;
    const elbowClosed = elbowMidY > shoulderMid.y + shoulderWidth * .10 && elbowSpread < 1.45;
    const closed = wristClosed || elbowClosed;
    const compactMode = !wristsVisible || (wristsVisible && ((lm[L.LWR].y < .035) || (lm[L.RWR].y < .035)));
    const armHeight = clamp((shoulderMid.y - elbowMidY) / shoulderWidth, -.5, 1.2);
    const phaseScore = Math.max(targetScore(armHeight, -.28, .72, 42), targetScore(armHeight, .58, .68, 42));
    const spreadScore = Math.max(targetScore(elbowSpread, 1.02, .9, 44), targetScore(elbowSpread, 2.15, 1.05, 44));
    const ankleSpread = anklesVisible ? distance(lm[L.LANK], lm[L.RANK]) / shoulderWidth : null;
    const legScore = ankleSpread == null ? 82 : Math.max(targetScore(ankleSpread, .82, .75, 48), targetScore(ankleSpread, 2.0, 1.0, 48));
    const visibilityPenalty = compactMode ? 5 : 0;
    const score = clamp(weightedScore([[phaseScore, .45], [spreadScore, .35], [legScore, .20]], 42) - visibilityPenalty, 38, compactMode ? 94 : 99);
    return {
      trackable: true,
      stateA: closed,
      stateB: open,
      metric: elbowSpread,
      metricLabel: compactMode ? 'Arm opening' : 'Arm / leg opening',
      formScore: Math.round(score),
      feedback: open ? 'Great opening. Bring your arms back to your sides.' : closed ? 'Open your arms high. Your hands can leave the top of the frame.' : 'Finish the full arm cycle and keep a steady rhythm.',
      trackingMode: compactMode ? 'Compact camera mode' : anklesVisible ? 'Full body ready' : 'Upper body ready',
      classifierSafe: !compactMode,
      compactMode,
    };
  }

  if (exerciseId === 'shoulder-press') {
    if (avgElbow == null || !shoulderMid) return missingEvaluation('Keep your shoulders, elbows and at least one wrist in view.', 'Show your upper body');
    const visibleWristYs = [L.LWR, L.RWR].filter((idx) => isVisible(lm, idx)).map((idx) => lm[idx].y);
    const wristMidY = visibleWristYs.length ? visibleWristYs.reduce((a,b)=>a+b,0)/visibleWristYs.length : null;
    const headReference = nose?.y ?? shoulderMid.y - shoulderWidth * .7;
    const down = avgElbow < 130 && (wristMidY == null || wristMidY > headReference + .015);
    const up = avgElbow > 148 && (wristMidY == null || wristMidY < headReference + .06);
    const extensionScore = nearestTargetScore(avgElbow, [112, 170], 55, 42);
    const evenScore = symmetryScore(leftElbow, rightElbow);
    const score = weightedScore([[extensionScore, .55], [evenScore, .25], [uprightQuality, .20]], 42);
    return {
      trackable: true,
      stateA: down,
      stateB: up,
      metric: avgElbow,
      metricLabel: 'Press angle',
      formScore: Math.round(score),
      feedback: up ? 'Good extension. Lower the weights to shoulder level.' : down ? 'Brace your middle and press straight overhead.' : 'Keep the wrists above the elbows and move both arms together.',
      trackingMode: 'Upper body ready',
      classifierSafe: wristsVisible,
    };
  }

  if (exerciseId === 'biceps-curl') {
    if (avgElbow == null) return missingEvaluation('Keep one shoulder, elbow and wrist in view.', 'Show your working arm');
    if (!uprightTorso) return missingEvaluation('Stand tall with your upper arm close to your side.', 'Stand tall');
    const curlScore = nearestTargetScore(avgElbow, [166, 66], 60, 38);
    const evenScore = symmetryScore(leftElbow, rightElbow);
    const score = weightedScore([[curlScore, .58], [uprightQuality, .27], [evenScore, .15]], 38);
    return {
      trackable: true,
      stateA: avgElbow > 150,
      stateB: avgElbow < 88,
      metric: avgElbow,
      metricLabel: 'Curl angle',
      formScore: Math.round(score),
      feedback: avgElbow < 96 ? 'Good curl. Lower slowly without swinging.' : avgElbow > 145 ? 'Curl the weight toward your shoulder.' : 'Keep your upper arm quiet beside your ribs.',
      trackingMode: 'Upper body ready',
      classifierSafe: true,
    };
  }

  if (exerciseId === 'high-knees') {
    if (!hipsVisible || !kneesVisible || !shoulderWidth) return missingEvaluation('Keep both hips and knees in view. Your feet can stay outside the frame.', 'Mid body ready');
    if (!uprightTorso) return missingEvaluation('Stand tall before high-knee counting starts.', 'Stand tall');
    const leftHeight = (lm[L.LKNE].y - lm[L.LHIP].y) / shoulderWidth;
    const rightHeight = (lm[L.RKNE].y - lm[L.RHIP].y) / shoulderWidth;
    const raised = Math.min(leftHeight, rightHeight);
    const lowered = Math.max(leftHeight, rightHeight);
    const liftScore = Math.max(targetScore(raised, .12, .55, 42), targetScore(lowered, .62, .55, 42));
    const score = weightedScore([[liftScore, .7], [uprightQuality, .3]], 42);
    return {
      trackable: true,
      stateA: leftHeight > .48 && rightHeight > .48,
      stateB: raised < .34,
      metric: raised,
      metricLabel: 'Knee height',
      formScore: Math.round(score),
      feedback: raised < .34 ? 'Nice knee drive. Return and switch sides.' : 'Drive one knee toward hip height and stay tall.',
      trackingMode: 'Mid body ready',
      classifierSafe: true,
    };
  }

  if (exerciseId === 'crunch') {
    if (hip == null || !shouldersVisible || !hipsVisible) return missingEvaluation('Show your shoulders, hips and one knee from the side.', 'Set up on the mat');
    if (!floorLikeTorso) return missingEvaluation('Lie side-on on the mat. Standing bends will not count as crunches.', 'Get into crunch position');
    if (avgKnee != null && avgKnee >= 150) return missingEvaluation('Bend your knees and keep your feet planted.', 'Bend your knees');
    const curlScore = nearestTargetScore(hip, [154, 108], 54, 44);
    const score = weightedScore([[curlScore, .76], [avgKnee == null ? 86 : targetScore(avgKnee, 105, 65, 48), .24]], 42);
    return {
      trackable: true,
      stateA: hip > 142,
      stateB: hip < 118,
      metric: hip,
      metricLabel: 'Crunch angle',
      formScore: Math.round(score),
      feedback: hip < 118 ? 'Good curl. Lower your shoulders slowly.' : 'Brace your stomach and lift only your shoulders.',
      trackingMode: 'Side view ready',
      classifierSafe: true,
    };
  }

  if (exerciseId !== 'plank') {
    if (!shouldersVisible || !hipsVisible) return missingEvaluation('Keep the main working joints in view while the coach watches the movement.', 'Move into view');
    return {
      trackable: true,
      stateA: false,
      stateB: false,
      metric: 0,
      metricLabel: 'Movement',
      formScore: Math.round(weightedScore([[uprightQuality, .7], [88, .3]], 50)),
      feedback: 'Keep the full movement clear and controlled.',
      trackingMode: 'Movement visible',
      classifierSafe: true,
    };
  }

  if (bodyLine == null) return missingEvaluation('Keep shoulders, hips and knees in view. Ankles are optional.', 'Show your body line');
  const goodPlank = bodyLine > 154;
  return {
    trackable: true,
    holdGood: goodPlank,
    metric: bodyLine,
    metricLabel: 'Body line',
    formScore: Math.round(targetScore(bodyLine, 175, 38, 38)),
    feedback: goodPlank ? 'Strong line. Keep breathing.' : bodyLine < 142 ? 'Bring your hips up and brace your stomach.' : 'Keep shoulders, hips and knees in one line.',
    trackingMode: bodyLineWithAnkles ? 'Body line ready' : 'Torso ready',
    classifierSafe: true,
  };
}

function buildRegionScores(lm, exerciseId, overall = 0) {
  const shouldersVisible = isVisible(lm, L.LSH) && isVisible(lm, L.RSH);
  const hipsVisible = isVisible(lm, L.LHIP) && isVisible(lm, L.RHIP);
  const shoulderWidth = shouldersVisible ? distance(lm[L.LSH], lm[L.RSH]) : null;
  const shoulderMid = shouldersVisible ? midpoint(lm[L.LSH], lm[L.RSH]) : null;
  const hipMid = hipsVisible ? midpoint(lm[L.LHIP], lm[L.RHIP]) : null;
  const leftKnee = angleIfVisible(lm, L.LHIP, L.LKNE, L.LANK);
  const rightKnee = angleIfVisible(lm, L.RHIP, L.RKNE, L.RANK);
  const bodyLine = availableAverageAngle(lm, [[L.LSH, L.LHIP, L.LANK], [L.RSH, L.RHIP, L.RANK]])
    ?? availableAverageAngle(lm, [[L.LSH, L.LHIP, L.LKNE], [L.RSH, L.RHIP, L.RKNE]]);
  const levelScore = (a, b, scale) => {
    if (!a || !b || !scale) return null;
    return clamp(100 - (Math.abs(a.y - b.y) / scale) * 160, 35, 99);
  };
  const blend = (local) => Number.isFinite(local) ? Math.round(clamp(local * .68 + Number(overall || local) * .32, 30, 99)) : null;
  const shoulderLocal = shouldersVisible ? levelScore(lm[L.LSH], lm[L.RSH], shoulderWidth) : null;
  const hipLocal = hipsVisible && shoulderWidth ? levelScore(lm[L.LHIP], lm[L.RHIP], shoulderWidth) : null;
  const kneeLocal = Number.isFinite(leftKnee) && Number.isFinite(rightKnee)
    ? symmetryScore(leftKnee, rightKnee)
    : Number.isFinite(leftKnee) || Number.isFinite(rightKnee) ? Number(overall || 70) : null;
  const backLocal = ['push-up', 'plank', 'crunch'].includes(exerciseId) && Number.isFinite(bodyLine)
    ? targetScore(bodyLine, exerciseId === 'crunch' ? 135 : 174, exerciseId === 'crunch' ? 58 : 38, 35)
    : torsoScore(shoulderMid, hipMid, shoulderWidth);
  return { shoulder: blend(shoulderLocal), hip: blend(hipLocal), knee: blend(kneeLocal), back: blend(backLocal) };
}

function drawPose(ctx, landmarks, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowBlur = 12;
  ctx.shadowColor = 'rgba(77,232,209,.65)';
  ctx.strokeStyle = 'rgba(77,232,209,.92)';
  ctx.lineWidth = 4;
  CONNECTIONS.forEach(([start, end]) => {
    if (!isVisible(landmarks, start, .18) || !isVisible(landmarks, end, .18)) return;
    const a = landmarks[start]; const b = landmarks[end];
    ctx.beginPath(); ctx.moveTo(a.x * width, a.y * height); ctx.lineTo(b.x * width, b.y * height); ctx.stroke();
  });
  ctx.shadowBlur = 16;
  ctx.shadowColor = 'rgba(255,138,61,.8)';
  HEAT_LANDMARKS.concat([L.NOSE, L.LEYE, L.REYE, L.MOUTH_L, L.MOUTH_R]).forEach((index) => {
    if (!isVisible(landmarks, index, .18)) return;
    const point = landmarks[index];
    ctx.beginPath(); ctx.fillStyle = index <= 10 ? '#b4ff3d' : '#ff8a3d'; ctx.arc(point.x * width, point.y * height, index <= 10 ? 3.5 : 5.5, 0, Math.PI * 2); ctx.fill();
  });
  ctx.shadowBlur = 0;
}

function drawAlignmentGuides(ctx, lm, width, height, exerciseId, evaluation) {
  const good = Number(evaluation?.formScore || 0) >= 85;
  ctx.save();
  ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.setLineDash([9, 7]);
  ctx.strokeStyle = good ? 'rgba(180,255,61,.78)' : 'rgba(255,167,76,.82)';
  const sh = isVisible(lm,L.LSH)&&isVisible(lm,L.RSH)?midpoint(lm[L.LSH],lm[L.RSH]):null;
  const hp = isVisible(lm,L.LHIP)&&isVisible(lm,L.RHIP)?midpoint(lm[L.LHIP],lm[L.RHIP]):null;
  const ak = isVisible(lm,L.LANK)&&isVisible(lm,L.RANK)?midpoint(lm[L.LANK],lm[L.RANK]):null;
  if (['squat','lunge','biceps-curl','shoulder-press','high-knees','jumping-jack'].includes(exerciseId) && sh && hp) {
    const cx=((sh.x+hp.x)/2)*width; ctx.beginPath(); ctx.moveTo(cx,Math.max(0,(sh.y-.18)*height)); ctx.lineTo(cx,Math.min(height,(hp.y+.48)*height)); ctx.stroke();
  }
  if (exerciseId==='high-knees' && hp) { ctx.beginPath();ctx.moveTo(Math.max(0,(hp.x-.32)*width),hp.y*height);ctx.lineTo(Math.min(width,(hp.x+.32)*width),hp.y*height);ctx.stroke(); }
  if (['shoulder-press','jumping-jack'].includes(exerciseId) && sh) { const y=Math.max(16,(sh.y-.22)*height);ctx.beginPath();ctx.moveTo(Math.max(0,(sh.x-.38)*width),y);ctx.lineTo(Math.min(width,(sh.x+.38)*width),y);ctx.stroke(); }
  if (exerciseId==='biceps-curl') [L.LEL,L.REL].forEach((idx)=>{if(!isVisible(lm,idx))return;const p=lm[idx];ctx.beginPath();ctx.arc(p.x*width,p.y*height,18,0,Math.PI*2);ctx.stroke();});
  if (['push-up','plank'].includes(exerciseId) && sh && hp) { const end=ak||hp;ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(sh.x*width,sh.y*height);ctx.lineTo(end.x*width,end.y*height);ctx.stroke(); }
  if (exerciseId==='squat' && isVisible(lm,L.LKNE)&&isVisible(lm,L.RKNE)) { const y=(lm[L.LKNE].y+lm[L.RKNE].y)/2*height;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(width,y);ctx.stroke(); }
  ctx.restore();
}

function updateHeatmap(ctx, landmarks, width, height) {
  ctx.clearRect(0, 0, width, height);
  HEAT_LANDMARKS.forEach((index) => {
    if (!isVisible(landmarks, index, .18)) return;
    const p = landmarks[index]; const x = p.x * width; const y = p.y * height;
    const gradient = ctx.createRadialGradient(x, y, 1, x, y, 16);
    gradient.addColorStop(0, 'rgba(255,138,61,.8)'); gradient.addColorStop(.45, 'rgba(180,255,61,.3)'); gradient.addColorStop(1, 'rgba(77,232,209,0)');
    ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
  });
}

export default function CameraStage({
  exerciseId = 'squat', paused = false, onRep, onTrackingData, onCameraState, onLandmarks, onPoseFrame,
  engineLabel = '', startRequest = 0, showStartPrompt = true, alignmentEnabled = true, showSkeleton = true, coachName = 'James',
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const heatmapRef = useRef(null);
  const stageRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const animationRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);
  const phaseRef = useRef('waiting');
  const stableFramesRef = useRef({ a: 0, b: 0 });
  const lastCountAtRef = useRef(0);
  const lastHoldTickRef = useRef(0);
  const lastUiUpdateRef = useRef(0);
  const lastPoseFrameRef = useRef(0);
  const lastFpsMarkRef = useRef(performance.now());
  const fpsFramesRef = useRef(0);
  const smoothedScoreRef = useRef(0);
  const repScoreBufferRef = useRef([]);
  const cameraEvaluationRef = useRef({ classifierSafe: true, compactMode: false });
  const callbacksRef = useRef({ onRep, onTrackingData, onLandmarks, onPoseFrame });
  const pausedRef = useRef(paused);
  const exerciseRef = useRef(exerciseId);
  const settingsRef = useRef({ deviceId: '', quality: '720p' });

  const [status, setStatus] = useState('Camera is off');
  const [active, setActive] = useState(false);
  const [modelState, setModelState] = useState('not loaded');
  const [landmarksFound, setLandmarksFound] = useState(false);
  const [lockMode, setLockMode] = useState('Move into view');
  const [secureContextIssue, setSecureContextIssue] = useState(false);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState('');
  const [quality, setQuality] = useState('720p');
  const [mirror, setMirror] = useState(true);
  const [fps, setFps] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [zoomRange, setZoomRange] = useState(null);
  const [zoom, setZoom] = useState(null);

  useEffect(() => { callbacksRef.current = { onRep, onTrackingData, onLandmarks, onPoseFrame }; }, [onRep, onTrackingData, onLandmarks, onPoseFrame]);
  useEffect(() => { pausedRef.current = paused; }, [paused]);
  useEffect(() => { settingsRef.current = { deviceId, quality }; }, [deviceId, quality]);
  useEffect(() => {
    exerciseRef.current = exerciseId;
    phaseRef.current = 'waiting'; stableFramesRef.current = { a: 0, b: 0 }; lastCountAtRef.current = 0; lastHoldTickRef.current = 0; smoothedScoreRef.current = 0; repScoreBufferRef.current = [];
  }, [exerciseId]);

  useEffect(() => {
    onCameraState?.({
      active, modelState, bodyVisible: landmarksFound, trackingMode: lockMode, status, fps,
      classifierSafe: cameraEvaluationRef.current.classifierSafe !== false,
      compactMode: Boolean(cameraEvaluationRef.current.compactMode),
      mirror, quality, deviceId,
    });
  }, [active, modelState, landmarksFound, lockMode, status, fps, mirror, quality, deviceId, onCameraState]);

  const stopStreamOnly = () => {
    cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const stopCamera = () => {
    stopStreamOnly();
    canvasRef.current?.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    setActive(false); setLandmarksFound(false); setLockMode('Move into view'); setStatus('Camera is off'); setFps(0); setZoomRange(null); setZoom(null);
  };

  const publishTracking = (evaluation, now) => {
    if (now - lastUiUpdateRef.current < 90) return;
    lastUiUpdateRef.current = now;
    callbacksRef.current.onTrackingData?.(evaluation);
  };

  const runDetection = () => {
    const video = videoRef.current; const canvas = canvasRef.current; const heatmap = heatmapRef.current; const landmarker = landmarkerRef.current;
    if (!video || !canvas || !landmarker || !streamRef.current) return;
    if (video.currentTime !== lastVideoTimeRef.current && video.readyState >= 2) {
      lastVideoTimeRef.current = video.currentTime;
      const now = performance.now();
      fpsFramesRef.current += 1;
      if (now - lastFpsMarkRef.current >= 1000) {
        setFps(Math.round(fpsFramesRef.current * 1000 / (now - lastFpsMarkRef.current)));
        fpsFramesRef.current = 0; lastFpsMarkRef.current = now;
      }
      const result = landmarker.detectForVideo(video, now);
      const ctx = canvas.getContext('2d'); canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720;
      if (result.landmarks?.length) {
        const lm = result.landmarks[0]; callbacksRef.current.onLandmarks?.(lm, now);
        if (showSkeleton) drawPose(ctx, lm, canvas.width, canvas.height); else ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (heatmap) { if (!heatmap.width) heatmap.width = 220; if (!heatmap.height) heatmap.height = 125; updateHeatmap(heatmap.getContext('2d'), lm, heatmap.width, heatmap.height); }
        const rawEvaluation = poseEvaluation(lm, exerciseRef.current);
        const previous = smoothedScoreRef.current;
        const smoothed = rawEvaluation.formScore > 0 ? (previous ? previous * .58 + rawEvaluation.formScore * .42 : rawEvaluation.formScore) : 0;
        smoothedScoreRef.current = smoothed;
        const finalScore = smoothed ? Math.round(smoothed) : 0;
        const evaluation = { ...rawEvaluation, formScore: finalScore, regionScores: buildRegionScores(lm, exerciseRef.current, finalScore) };
        cameraEvaluationRef.current = evaluation;
        if (alignmentEnabled) drawAlignmentGuides(ctx, lm, canvas.width, canvas.height, exerciseRef.current, evaluation);
        if (now - lastPoseFrameRef.current >= 95) {
          lastPoseFrameRef.current = now;
          callbacksRef.current.onPoseFrame?.({ timestamp: now, exerciseId: exerciseRef.current, evaluation: { formScore: evaluation.formScore || 0, feedback: evaluation.feedback || '', metric: evaluation.metric || 0, metricLabel: evaluation.metricLabel || '' }, landmarks: lm.map((point) => [Number(point.x || 0), Number(point.y || 0), Number(point.visibility ?? point.presence ?? 1)]) });
        }
        setLandmarksFound(evaluation.trackable); setLockMode(evaluation.trackingMode || 'Move into view'); publishTracking(evaluation, now);
        if (!evaluation.trackable) { phaseRef.current = 'waiting'; stableFramesRef.current = { a: 0, b: 0 }; repScoreBufferRef.current = []; }
        if (evaluation.trackable && !pausedRef.current) {
          if (exerciseRef.current === 'plank') {
            if (evaluation.holdGood && now - lastHoldTickRef.current >= 1000) { lastHoldTickRef.current = now; callbacksRef.current.onRep?.({ type: 'hold', evaluation }); }
          } else {
            stableFramesRef.current.a = evaluation.stateA ? stableFramesRef.current.a + 1 : 0;
            stableFramesRef.current.b = evaluation.stateB ? stableFramesRef.current.b + 1 : 0;
            const stableNeed = ['jumping-jack', 'high-knees'].includes(exerciseRef.current) ? 2 : exerciseRef.current === 'crunch' ? 4 : 3;
            const stateAStable = stableFramesRef.current.a >= stableNeed; const stateBStable = stableFramesRef.current.b >= stableNeed;
            if (stateAStable && phaseRef.current === 'waiting') {
              phaseRef.current = 'ready';
              repScoreBufferRef.current = finalScore > 0 ? [finalScore] : [];
            }
            if ((phaseRef.current === 'ready' || phaseRef.current === 'contracted') && finalScore > 0) {
              repScoreBufferRef.current = [...repScoreBufferRef.current.slice(-89), finalScore];
            }
            if (stateBStable && phaseRef.current === 'ready') phaseRef.current = 'contracted';
            if (stateAStable && phaseRef.current === 'contracted' && now - lastCountAtRef.current > 520) {
              const scores = repScoreBufferRef.current.filter((value) => Number.isFinite(value) && value > 0);
              const sorted = [...scores].sort((a,b)=>a-b);
              const mean = scores.length ? scores.reduce((a,b)=>a+b,0) / scores.length : finalScore;
              const lowerQuartile = sorted.length ? sorted[Math.floor((sorted.length - 1) * .25)] : finalScore;
              const cycleScore = Math.round(Math.max(30, Math.min(99, mean * .78 + lowerQuartile * .22)));
              phaseRef.current = 'ready'; stableFramesRef.current = { a: 0, b: 0 }; lastCountAtRef.current = now;
              repScoreBufferRef.current = finalScore > 0 ? [finalScore] : [];
              callbacksRef.current.onRep?.({ type: 'rep', evaluation: { ...evaluation, formScore: cycleScore } });
            }
          }
        }
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height); setLandmarksFound(false); setLockMode('Move into view'); cameraEvaluationRef.current = { classifierSafe: false, compactMode: false };
        publishTracking({ formScore: 0, feedback: 'Move your working joints into the camera view.', metric: 0, metricLabel: 'Camera', trackingMode: 'Move into view', classifierSafe: false }, performance.now());
      }
    }
    animationRef.current = requestAnimationFrame(runDetection);
  };

  const loadModel = async () => {
    if (landmarkerRef.current) return landmarkerRef.current;
    setModelState('loading'); setStatus('Preparing movement tracking…');
    const visionModule = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/+esm');
    const vision = await visionModule.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm');
    const commonOptions = { runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: .36, minPosePresenceConfidence: .36, minTrackingConfidence: .36 };
    const modelAssetPath = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
    try { landmarkerRef.current = await visionModule.PoseLandmarker.createFromOptions(vision, { ...commonOptions, baseOptions: { modelAssetPath, delegate: 'GPU' } }); }
    catch (gpuError) { console.warn('GPU pose delegate unavailable; using CPU.', gpuError); landmarkerRef.current = await visionModule.PoseLandmarker.createFromOptions(vision, { ...commonOptions, baseOptions: { modelAssetPath, delegate: 'CPU' } }); }
    setModelState('ready'); return landmarkerRef.current;
  };

  const refreshDevices = async () => {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((item) => item.kind === 'videoinput'));
    } catch { setDevices([]); }
  };

  const startCamera = async (override = {}) => {
    if (!window.isSecureContext) { setSecureContextIssue(true); setStatus('Camera access on another device needs HTTPS'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setStatus('Camera is not supported in this browser'); return; }
    try {
      setSecureContextIssue(false); setStatus('Opening camera…'); await loadModel(); stopStreamOnly();
      const nextDeviceId = override.deviceId ?? settingsRef.current.deviceId;
      const nextQuality = override.quality ?? settingsRef.current.quality;
      const resolution = RESOLUTIONS[nextQuality] || RESOLUTIONS['720p'];
      const videoConstraints = {
        width: { ideal: resolution.width }, height: { ideal: resolution.height }, frameRate: { ideal: 30, max: 30 },
        aspectRatio: { ideal: 4 / 3 }, resizeMode: { ideal: 'none' },
        ...(nextDeviceId ? { deviceId: { exact: nextDeviceId } } : { facingMode: { ideal: 'user' } }),
      };
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
      streamRef.current = stream; videoRef.current.srcObject = stream; await videoRef.current.play();
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings?.() || {};
      if (!nextDeviceId && settings.deviceId) setDeviceId(settings.deviceId);
      const caps = track?.getCapabilities?.() || {};
      if (caps.zoom && Number.isFinite(caps.zoom.min) && Number.isFinite(caps.zoom.max)) {
        const min = Number(caps.zoom.min); const max = Number(caps.zoom.max); const step = Number(caps.zoom.step || .1);
        setZoomRange({ min, max, step }); setZoom(min);
        try { await track.applyConstraints({ advanced: [{ zoom: min }] }); } catch { /* camera may report but reject zoom */ }
      } else { setZoomRange(null); setZoom(null); }
      await refreshDevices();
      setActive(true); setStatus('Camera ready'); lastFpsMarkRef.current = performance.now(); fpsFramesRef.current = 0;
      animationRef.current = requestAnimationFrame(runDetection);
    } catch (error) {
      console.error(error); setModelState('error');
      if (error?.name === 'NotAllowedError') setStatus('Camera permission was denied');
      else if (error?.name === 'NotFoundError' || error?.name === 'OverconstrainedError') setStatus('That camera setting is not available. Try another camera or 720p.');
      else setStatus('Could not open the camera');
    }
  };

  const changeDevice = async (next) => { setDeviceId(next); settingsRef.current.deviceId = next; if (active) await startCamera({ deviceId: next }); };
  const changeQuality = async (next) => { setQuality(next); settingsRef.current.quality = next; if (active) await startCamera({ quality: next }); };
  const changeZoom = async (next) => {
    const value = Number(next); setZoom(value); const track = streamRef.current?.getVideoTracks?.()[0]; if (!track) return;
    try { await track.applyConstraints({ advanced: [{ zoom: value }] }); } catch { /* unsupported on some browsers */ }
  };

  useEffect(() => { if (!startRequest || active || modelState === 'loading') return; startCamera(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [startRequest]);
  const openFullscreen = () => { if (!document.fullscreenElement) stageRef.current?.requestFullscreen?.(); else document.exitFullscreen?.(); };
  useEffect(() => () => { stopCamera(); landmarkerRef.current?.close?.(); }, []);

  return (
    <section className={`camera-stage camera-stage-v4 ${mirror ? 'mirrored' : 'not-mirrored'}`} ref={stageRef}>
      <video ref={videoRef} muted playsInline className={active ? 'visible' : ''} />
      <canvas ref={canvasRef} className={`pose-overlay ${showSkeleton ? '' : 'skeleton-hidden'}`} />
      <div className="camera-grid" /><div className="camera-corners"><i /><i /><i /><i /></div><div className="camera-sweep" />
      <div className="camera-ai-label"><ScanLine /> FORM TRACKER · {(engineLabel || exerciseId).replaceAll('-', ' ').toUpperCase()}</div>
      {active && <div className={`body-lock-badge ${landmarksFound ? 'locked' : ''}`}><i />{landmarksFound ? lockMode : 'Move into view'}</div>}
      {active && cameraEvaluationRef.current.compactMode && <div className="compact-camera-badge">Compact camera mode · hands may leave the top edge</div>}

      {active && (
        <div className="movement-heatmap-panel">
          <div><span>MOVEMENT MAP</span><i className={landmarksFound ? 'active' : ''} /></div>
          <canvas ref={heatmapRef} />
          <small>Shows the joints being followed</small>
        </div>
      )}

      {active && (
        <div className={`camera-settings-panel ${showSettings ? 'open' : ''}`}>
          <button className="camera-settings-toggle" onClick={() => setShowSettings((v) => !v)}><SlidersHorizontal size={15} /> Camera</button>
          {showSettings && <div className="camera-settings-popover">
            <label><span>Camera</span><select value={deviceId} onChange={(e) => changeDevice(e.target.value)}>{devices.length ? devices.map((device, index)=><option key={device.deviceId || index} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>) : <option value="">Default camera</option>}</select></label>
            <label><span>Quality</span><select value={quality} onChange={(e) => changeQuality(e.target.value)}><option value="720p">720p · wider body view</option><option value="1080p">1080p · sharper</option></select></label>
            <button onClick={() => setMirror((value) => !value)}>Mirror preview: {mirror ? 'On' : 'Off'}</button>
            {zoomRange ? <label><span>Camera zoom · {Number(zoom || zoomRange.min).toFixed(1)}×</span><input type="range" min={zoomRange.min} max={zoomRange.max} step={zoomRange.step} value={zoom ?? zoomRange.min} onChange={(e)=>changeZoom(e.target.value)} /><small>Move left for the widest view your camera supports.</small></label> : <small className="camera-no-zoom">This camera does not expose zoom controls. Step farther back or choose a wider/external camera if needed.</small>}
            <div className="camera-fps-line"><span>Live speed</span><strong>{fps || '—'} FPS</strong></div>
          </div>}
        </div>
      )}

      {!active && showStartPrompt && (
        <div className="camera-empty">
          <span className="camera-icon"><Camera size={32} /></span><h3>Place the working joints in view</h3>
          <p>For jumping jacks, ScanRig can use a compact view when your hands go above a laptop camera. Give your elbows and shoulders as much room as possible.</p>
          <button className="button" onClick={() => startCamera()} disabled={modelState === 'loading'}><Camera size={18} /> {modelState === 'loading' ? 'Preparing camera…' : 'Start camera'}</button>
          {secureContextIssue && <div className="secure-camera-warning"><Smartphone size={18} /><div><strong>Phone access needs HTTPS</strong><span>Open a deployed HTTPS version on the phone to use its own camera.</span></div></div>}
        </div>
      )}
      {!active && !showStartPrompt && <div className="camera-passive-state"><span className="camera-icon"><Camera size={30} /></span><h3>{modelState === 'loading' ? 'Preparing your camera…' : 'Camera check is waiting'}</h3><p>Tap Camera in the workout check. Your preview appears here after permission is granted.</p></div>}

      <div className="camera-status-row">
        <span className={`live-status ${active ? 'online' : ''}`}><i /> {paused && active ? 'Tracking paused' : status}</span>
        <span><ShieldCheck size={15} /> Stays in this browser</span>
        {active && <span>{fps || '—'} FPS</span>}
        <button className="icon-button" onClick={openFullscreen} aria-label="Fullscreen preview"><Maximize2 size={17} /></button>
        {active && showStartPrompt && <button className="icon-button danger" onClick={stopCamera} aria-label="Stop camera"><CameraOff size={17} /></button>}
      </div>
    </section>
  );
}
