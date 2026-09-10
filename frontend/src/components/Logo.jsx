import { Activity } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Logo({ compact = false }) {
  return (
    <Link className="brand" to="/" aria-label="ScanRig AI home">
      <span className="brand-mark"><Activity size={18} strokeWidth={2.4} /></span>
      {!compact && (
        <span>
          <strong>SCANRIG <em>AI</em></strong>
          <small>vision home trainer</small>
        </span>
      )}
    </Link>
  );
}
