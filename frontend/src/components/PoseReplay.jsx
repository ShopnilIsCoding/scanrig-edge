import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, ShieldCheck } from 'lucide-react';

const J = { NOSE:0, LSH:11, RSH:12, LEL:13, REL:14, LWR:15, RWR:16, LHIP:23, RHIP:24, LKNE:25, RKNE:26, LANK:27, RANK:28 };
const LINKS = [[J.LSH,J.RSH],[J.LSH,J.LEL],[J.LEL,J.LWR],[J.RSH,J.REL],[J.REL,J.RWR],[J.LSH,J.LHIP],[J.RSH,J.RHIP],[J.LHIP,J.RHIP],[J.LHIP,J.LKNE],[J.LKNE,J.LANK],[J.RHIP,J.RKNE],[J.RKNE,J.RANK]];

function unpack(frame) {
  if (!frame?.landmarks) return [];
  return frame.landmarks.map((point) => ({ x: point[0], y: point[1], visibility: point[2] }));
}
function visible(point) { return point && (point.visibility ?? 1) >= .18; }

function drawUser(ctx, landmarks, x0, y0, width, height) {
  const indices = [J.NOSE,J.LSH,J.RSH,J.LEL,J.REL,J.LWR,J.RWR,J.LHIP,J.RHIP,J.LKNE,J.RKNE,J.LANK,J.RANK];
  const pts = indices.map((index) => landmarks[index]).filter(visible);
  if (!pts.length) return;
  const minX = Math.min(...pts.map((p) => p.x)); const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y)); const maxY = Math.max(...pts.map((p) => p.y));
  const rangeX = Math.max(.18, maxX - minX); const rangeY = Math.max(.3, maxY - minY);
  const map = (point) => ({ x: x0 + ((point.x - minX) / rangeX) * width, y: y0 + ((point.y - minY) / rangeY) * height });
  ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(77,232,209,.95)';
  LINKS.forEach(([a,b]) => { if (!visible(landmarks[a]) || !visible(landmarks[b])) return; const pa=map(landmarks[a]); const pb=map(landmarks[b]); ctx.beginPath(); ctx.moveTo(pa.x,pa.y); ctx.lineTo(pb.x,pb.y); ctx.stroke(); });
  indices.forEach((index) => { if (!visible(landmarks[index])) return; const p=map(landmarks[index]); ctx.fillStyle = index === J.NOSE ? '#b4ff3d' : '#ff8a3d'; ctx.beginPath(); ctx.arc(p.x,p.y,index===J.NOSE?5:6,0,Math.PI*2); ctx.fill(); });
}

export default function PoseReplay({ clip = [], exerciseName = 'Exercise', title = 'Movement replay' }) {
  const canvasRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [frameIndex, setFrameIndex] = useState(0);
  const frames = useMemo(() => clip.filter((item) => item?.landmarks?.length), [clip]);

  useEffect(() => { setFrameIndex(0); setPlaying(Boolean(frames.length)); }, [frames]);
  useEffect(() => {
    if (!playing || frames.length < 2) return undefined;
    const timer = window.setInterval(() => setFrameIndex((value) => (value + 1) % frames.length), 100);
    return () => window.clearInterval(timer);
  }, [playing, frames.length]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx=canvas.getContext('2d'); const dpr=Math.min(2,window.devicePixelRatio||1);
    const rect=canvas.getBoundingClientRect(); canvas.width=Math.max(1,rect.width*dpr); canvas.height=Math.max(1,rect.height*dpr); ctx.setTransform(dpr,0,0,dpr,0,0);
    const w=rect.width,h=rect.height; ctx.clearRect(0,0,w,h); ctx.fillStyle='rgba(4,10,12,.96)';ctx.fillRect(0,0,w,h);
    ctx.font='700 11px system-ui';ctx.fillStyle='rgba(255,255,255,.55)';ctx.fillText('YOUR MOVEMENT',18,24);
    const frame=frames[frameIndex]; if(frame) drawUser(ctx,unpack(frame),Math.max(24,w*.14),42,Math.min(w*.72,w-48),h-66);
  }, [frames, frameIndex]);

  if (!frames.length) return <div className="pose-replay-empty">No pose-only replay was captured for this segment.</div>;
  return (
    <section className="pose-replay-card">
      <div className="pose-replay-heading"><div><small>{title.toUpperCase()}</small><strong>{exerciseName}</strong></div><span><ShieldCheck size={14}/> Pose only · no video saved</span></div>
      <canvas ref={canvasRef} className="pose-replay-canvas" />
      <div className="pose-replay-controls">
        <button onClick={()=>setPlaying((value)=>!value)}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?'Pause':'Play'}</button>
        <button onClick={()=>{setFrameIndex(0);setPlaying(true);}}><RotateCcw size={16}/> Replay</button>
        <span>{Math.min(frameIndex+1,frames.length)} / {frames.length} frames</span>
      </div>
    </section>
  );
}
