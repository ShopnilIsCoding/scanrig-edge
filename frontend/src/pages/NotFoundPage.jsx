import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return <div className="not-found"><strong>404</strong><h1>This training zone does not exist.</h1><p>Return to the main application and choose another route.</p><Link className="button" to="/"><ArrowLeft /> Back home</Link></div>;
}
