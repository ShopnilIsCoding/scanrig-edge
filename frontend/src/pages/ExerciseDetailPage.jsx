import { ArrowLeft, Camera, CheckCircle2, Clock3, Dumbbell, Flame, PlayCircle, TriangleAlert } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { exercises } from '../data/exercises';
import { getExerciseVideo, youtubeEmbedUrl } from '../data/exerciseVideos';
import { useApp } from '../context/AppContext';

export default function ExerciseDetailPage() {
  const { exerciseId } = useParams();
  const { customExercises, profile } = useApp();
  const exercise = [...exercises, ...(customExercises || [])].find((item) => item.id === exerciseId);
  if (!exercise) return <div className="app-page section-shell"><div className="empty-state"><h1>Exercise not found</h1><Link className="button" to="/exercises">Return to library</Link></div></div>;
  const videoUrl = youtubeEmbedUrl(getExerciseVideo(exercise));

  return (
    <div className="app-page section-shell detail-page stage24-detail-page">
      <Link className="back-link" to="/exercises"><ArrowLeft size={17} /> Exercise library</Link>
      <div className="detail-hero">
        <div className="detail-movement-guide"><span className={`exercise-symbol accent-${exercise.accent || 'cyan'}`}>{exercise.icon || '◆'}</span><div><small>QUICK GUIDE</small><strong>{exercise.name}</strong><p>{exercise.instructions?.[0] || 'Move slowly and follow the written steps below.'}</p></div></div>
        <div className="detail-copy">
          <span className="eyebrow">{exercise.category} · {exercise.difficulty}{exercise.isCustom ? ' · NEW EXERCISE' : ''}</span>
          <h1>{exercise.name}</h1><p>{exercise.description}</p>
          <div className="detail-meta"><span><Clock3 /> {exercise.duration}</span><span><Flame /> {exercise.calories || 'Effort varies by session'}</span><span><Dumbbell /> {exercise.equipment}</span></div>
          <Link className="button button-large" to={`/workout?exercise=${exercise.id}`}><Camera size={19} /> Start with camera</Link>
        </div>
      </div>

      <div className="detail-grid">
        <section className="panel"><span className="eyebrow">HOW TO DO IT</span><h2>Movement steps</h2><ol className="instruction-list">{(exercise.instructions || []).map((item, index) => <li key={item}><span>{index + 1}</span><p>{item}</p></li>)}</ol></section>
        <section className="panel muscle-panel"><span className="eyebrow">WHAT IT TRAINS</span><h2>Muscles used</h2><div className="muscle-group"><small>PRIMARY</small>{(exercise.primaryMuscles || []).map((item) => <span className="muscle-tag primary" key={item}>{item}</span>)}</div><div className="muscle-group"><small>SECONDARY</small>{(exercise.secondaryMuscles || []).map((item) => <span className="muscle-tag" key={item}>{item}</span>)}</div><div className="body-map"><i className="head" /><i className="torso" /><i className="arm left" /><i className="arm right" /><i className="leg left" /><i className="leg right" /></div></section>
        <section className="panel mistakes-panel"><span className="eyebrow">FORM TIPS</span><h2>Watch out for</h2>{(exercise.commonMistakes || []).map((item) => <div key={item}><TriangleAlert /><span>{item}</span></div>)}{!(exercise.commonMistakes || []).length && <div><CheckCircle2 /><span>Move slowly and follow the written steps or video guide.</span></div>}</section>
        <section className={`panel video-panel stage24-video-panel ${videoUrl ? 'has-video' : ''}`}>
          {videoUrl ? <div className="exercise-youtube-wrap"><iframe src={videoUrl} title={`${exercise.name} YouTube guide`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div> : <div className="exercise-video-empty"><PlayCircle size={44} /><span className="eyebrow">OPTIONAL VIDEO GUIDE</span><h2>Video guide coming soon</h2><p>You can still follow the step-by-step movement guide above.</p></div>}
        </section>
      </div>
    </div>
  );
}
