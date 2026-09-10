import { RotateCcw, UserRoundCheck } from 'lucide-react';
import TrainerShowcase3D from './TrainerShowcase3D';

const PROCEDURAL_SUPPORTED = new Set(['jumping-jack','squat','shoulder-press','high-knees','lunge','push-up','crunch','plank']);

export default function ExerciseCoach3D({ exercise, gender = 'male', compact = false }) {
  if (!exercise) return null;
  const useRealCurlClip = exercise.id === 'biceps-curl' || exercise.trackerTemplate === 'biceps-curl';
  const demoId = exercise.trackerTemplate && exercise.trackerTemplate !== 'classifier-only' ? exercise.trackerTemplate : exercise.id;
  const proceduralExercise = PROCEDURAL_SUPPORTED.has(demoId) ? demoId : '';
  const trainer = gender === 'female' ? 'Jody' : 'James';
  return (
    <section className={`exercise-coach-3d ${compact ? 'compact' : ''}`}>
      <div className="exercise-coach-3d-head">
        <span><UserRoundCheck size={16} /> Watch {trainer}</span>
        <small><RotateCcw size={13} /> repeating demo</small>
      </div>
      <div className="exercise-coach-3d-stage">
        <TrainerShowcase3D
          gender={gender === 'female' ? 'female' : 'male'}
          animation={useRealCurlClip ? 'bicepCurl' : 'defaultIdle'}
          proceduralExercise={useRealCurlClip ? '' : proceduralExercise}
          className="exercise-demo-trainer"
        />
      </div>
      <div className="exercise-coach-3d-copy">
        <strong>{exercise.name}</strong>
        <span>{useRealCurlClip || proceduralExercise ? 'Follow the motion, then use your camera for live form feedback.' : 'Follow the written and video guide for this custom exercise.'}</span>
      </div>
    </section>
  );
}
