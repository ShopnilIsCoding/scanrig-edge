import { ArrowUpRight, Clock3, Flame } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ExerciseCard({ exercise }) {
  return (
    <article className={`exercise-card accent-${exercise.accent}`}>
      <div className="exercise-visual">
        <span className="exercise-symbol">{exercise.icon}</span>
        <span className="scan-line" />
        <span className="difficulty-tag">{exercise.difficulty}</span>
      </div>
      <div className="exercise-card-body">
        <div className="eyebrow">{exercise.category}</div>
        <h3>{exercise.name}</h3>
        <p>{exercise.description}</p>
        <div className="exercise-meta">
          <span><Clock3 size={14} /> {exercise.duration}</span>
          <span><Flame size={14} /> {exercise.calories || 'Adaptive effort'}</span>
        </div>
        <Link className="card-link" to={`/exercises/${exercise.id}`}>View guide <ArrowUpRight size={16} /></Link>
      </div>
    </article>
  );
}
