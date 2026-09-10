import { useMemo, useState } from 'react';
import { Filter, Search } from 'lucide-react';
import ExerciseCard from '../components/ExerciseCard';
import { exercises } from '../data/exercises';
import { useApp } from '../context/AppContext';

export default function ExerciseLibraryPage() {
  const { customExercises } = useApp();
  const catalog = useMemo(() => [...exercises, ...(customExercises || [])], [customExercises]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(catalog.map((item) => item.category).filter(Boolean)))], [catalog]);
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => catalog.filter((exercise) => {
    const matchesCategory = category === 'All' || exercise.category === category;
    const matchesQuery = `${exercise.name} ${exercise.target} ${exercise.category}`.toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  }), [catalog, category, query]);

  return (
    <div className="app-page section-shell library-page">
      <header className="page-header split-header">
        <div><span className="eyebrow">MOVEMENT DATABASE</span><h1>Exercise library</h1><p>Learn the target muscles, setup, movement steps and common errors before starting the camera.</p></div>
        <div className="search-box"><Search /><input placeholder="Search exercises" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
      </header>
      <div className="filter-row"><span><Filter size={16} /> Filter</span>{categories.map((item) => <button className={category === item ? 'active' : ''} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>
      <div className="exercise-grid">{filtered.map((exercise) => <ExerciseCard exercise={exercise} key={exercise.id} />)}</div>
      {!filtered.length && <div className="empty-state"><Search size={32} /><h2>No exercises found</h2><p>Try another search term or category.</p></div>}
    </div>
  );
}
