import { useId } from 'react';
import { motion } from 'motion/react';

const ACTIONS = {
  idle: {
    bodyY: [0, -2, 0], bodyRotate: [0, -0.5, 0, 0.5, 0],
    leftArm: [2, -2, 2], rightArm: [-2, 2, -2], leftForearm: [0, 2, 0], rightForearm: [0, -2, 0],
    leftLeg: [0, 1, 0], rightLeg: [0, -1, 0], leftCalf: [0, -1, 0], rightCalf: [0, 1, 0],
    duration: 2.6,
  },
  talk: {
    bodyY: [0, -2, 0], bodyRotate: [0, -0.4, 0, 0.4, 0],
    leftArm: [3, -3, 3], rightArm: [-3, 3, -3], leftForearm: [0, -8, 0], rightForearm: [0, 8, 0],
    leftLeg: [0, 0.5, 0], rightLeg: [0, -0.5, 0], leftCalf: [0, 0, 0], rightCalf: [0, 0, 0],
    duration: 1.7,
  },
  walk: {
    bodyY: [0, -5, 0], bodyRotate: [0, 1, -1, 0],
    leftArm: [10, -10, 10], rightArm: [-10, 10, -10], leftForearm: [-5, 5, -5], rightForearm: [5, -5, 5],
    leftLeg: [-8, 8, -8], rightLeg: [8, -8, 8], leftCalf: [8, 0, 8], rightCalf: [0, 8, 0],
    duration: 0.72,
  },
  weigh: {
    bodyY: [0, -1, 0], bodyRotate: [0, 0, 0],
    leftArm: [2, -2, 2], rightArm: [-2, 2, -2], leftForearm: [0, 0, 0], rightForearm: [0, 0, 0],
    leftLeg: [0, 0, 0], rightLeg: [0, 0, 0], leftCalf: [0, 0, 0], rightCalf: [0, 0, 0],
    duration: 1.7,
  },
  measure: {
    bodyY: [0, -1, 0], bodyRotate: [0, -0.4, 0],
    leftArm: [-3, -6, -3], rightArm: [-68, -72, -68], leftForearm: [0, 0, 0], rightForearm: [-8, -12, -8],
    leftLeg: [0, 0, 0], rightLeg: [0, 0, 0], leftCalf: [0, 0, 0], rightCalf: [0, 0, 0],
    duration: 1.9,
  },
  think: {
    bodyY: [0, -1, 0], bodyRotate: [0, -1, 0],
    leftArm: [2, 0, 2], rightArm: [-25, -28, -25], leftForearm: [0, 0, 0], rightForearm: [-78, -82, -78],
    leftLeg: [0, 0, 0], rightLeg: [0, 0, 0], leftCalf: [0, 0, 0], rightCalf: [0, 0, 0],
    duration: 2.2,
  },
  celebrate: {
    bodyY: [0, -10, 0], bodyRotate: [0, -2, 2, 0],
    leftArm: [-58, -66, -58], rightArm: [58, 66, 58], leftForearm: [-16, -8, -16], rightForearm: [16, 8, 16],
    leftLeg: [-3, 3, -3], rightLeg: [3, -3, 3], leftCalf: [0, 0, 0], rightCalf: [0, 0, 0],
    duration: 0.95,
  },
  squat: {
    bodyY: [0, 23, 0], bodyRotate: [0, 0, 0],
    leftArm: [-34, -36, -34], rightArm: [34, 36, 34], leftForearm: [8, 10, 8], rightForearm: [-8, -10, -8],
    leftLeg: [-14, -21, -14], rightLeg: [14, 21, 14], leftCalf: [18, 28, 18], rightCalf: [-18, -28, -18],
    duration: 1.8,
  },
};

const jointStyle = (origin) => ({ transformBox: 'view-box', transformOrigin: origin });

export default function TrainerAvatar({ action = 'idle', compact = false, className = '' }) {
  const rawId = useId();
  const id = rawId.replace(/:/g, '');
  const pose = ACTIONS[action] || ACTIONS.idle;
  const isTalking = action === 'talk';
  const isWalking = action === 'walk';
  const isCelebrating = action === 'celebrate';

  const loop = { duration: pose.duration, repeat: Infinity, ease: 'easeInOut' };

  return (
    <div className={`trainer-shell trainer-shell-v3 ${compact ? 'trainer-shell-compact' : ''} ${className}`.trim()} aria-label="Animated ScanRig coach">
      <motion.div
        className="trainer-avatar trainer-avatar-v3"
        animate={{ y: pose.bodyY, rotate: pose.bodyRotate }}
        transition={loop}
      >
        <svg viewBox="0 0 270 370" role="img" aria-label="Animated cartoon fitness coach">
          <defs>
            <linearGradient id={`shirt-${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ff7c32" />
              <stop offset="1" stopColor="#ffad68" />
            </linearGradient>
            <linearGradient id={`shorts-${id}`} x1="0" x2="1">
              <stop offset="0" stopColor="#202a31" />
              <stop offset="1" stopColor="#35434d" />
            </linearGradient>
            <linearGradient id={`skin-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f6c29b" />
              <stop offset="1" stopColor="#e8a97d" />
            </linearGradient>
            <filter id={`core-glow-${id}`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <motion.ellipse
            cx="135" cy="348" rx="76" ry="12" fill="rgba(0,0,0,.42)"
            animate={{ scaleX: isWalking ? [1, .9, 1] : isCelebrating ? [1, .78, 1] : [1, .96, 1] }}
            transition={{ duration: isWalking ? .72 : 2.3, repeat: Infinity, ease: 'easeInOut' }}
            style={jointStyle('135px 348px')}
          />

          {/* Back leg: upper leg and calf rotate from real hip/knee joints. */}
          <motion.g animate={{ rotate: pose.rightLeg }} transition={loop} style={jointStyle('155px 238px')}>
            <path d="M155 238 C164 254 170 271 171 289" fill="none" stroke={`url(#shorts-${id})`} strokeWidth="31" strokeLinecap="round" />
            <circle cx="171" cy="289" r="15" fill="#35434d" />
            <motion.g animate={{ rotate: pose.rightCalf }} transition={loop} style={jointStyle('171px 289px')}>
              <path d="M171 289 C174 307 177 321 184 334" fill="none" stroke="#3a4853" strokeWidth="25" strokeLinecap="round" />
              <path d="M174 338 H211" fill="none" stroke="#eef2f4" strokeWidth="15" strokeLinecap="round" />
              <path d="M176 334 H208" fill="none" stroke="#4de8d1" strokeWidth="3.5" strokeLinecap="round" />
            </motion.g>
          </motion.g>

          {/* Back arm. */}
          <motion.g animate={{ rotate: pose.rightArm }} transition={loop} style={jointStyle('188px 145px')}>
            <path d="M188 145 C205 161 211 179 211 197" fill="none" stroke={`url(#skin-${id})`} strokeWidth="23" strokeLinecap="round" />
            <circle cx="211" cy="197" r="11.5" fill="#e9ac80" />
            <motion.g animate={{ rotate: pose.rightForearm }} transition={loop} style={jointStyle('211px 197px')}>
              <path d="M211 197 C211 214 207 225 201 239" fill="none" stroke={`url(#skin-${id})`} strokeWidth="20" strokeLinecap="round" />
              <circle cx="201" cy="241" r="10.5" fill="#e9ac80" />
            </motion.g>
          </motion.g>

          {/* Torso and shorts create a stable body anchor. */}
          <path d="M86 137 C91 113 108 101 135 101 C162 101 179 113 184 137 L195 229 H75 Z" fill={`url(#shirt-${id})`} />
          <path d="M96 146 C117 158 153 158 174 146" fill="none" stroke="rgba(255,255,255,.25)" strokeWidth="3.2" strokeLinecap="round" />
          <path d="M100 132 H170 L161 174 H109 Z" fill="#11171b" opacity=".88" />
          <motion.rect
            x="127" y="141" width="16" height="22" rx="3" fill="#b4ff3d" filter={`url(#core-glow-${id})`}
            animate={{ opacity: [1, .45, 1] }} transition={{ duration: 1.45, repeat: Infinity }}
          />
          <path d="M78 226 H192 L177 264 H93 Z" fill={`url(#shorts-${id})`} />
          <path d="M135 229 V259" stroke="#11181d" strokeWidth="5" strokeLinecap="round" />

          {/* Front leg. */}
          <motion.g animate={{ rotate: pose.leftLeg }} transition={loop} style={jointStyle('115px 238px')}>
            <path d="M115 238 C106 254 100 271 99 289" fill="none" stroke={`url(#shorts-${id})`} strokeWidth="31" strokeLinecap="round" />
            <circle cx="99" cy="289" r="15" fill="#34414b" />
            <motion.g animate={{ rotate: pose.leftCalf }} transition={loop} style={jointStyle('99px 289px')}>
              <path d="M99 289 C96 307 93 321 86 334" fill="none" stroke="#3a4853" strokeWidth="25" strokeLinecap="round" />
              <path d="M59 338 H96" fill="none" stroke="#eef2f4" strokeWidth="15" strokeLinecap="round" />
              <path d="M62 334 H94" fill="none" stroke="#4de8d1" strokeWidth="3.5" strokeLinecap="round" />
            </motion.g>
          </motion.g>

          {/* Front arm. */}
          <motion.g animate={{ rotate: pose.leftArm }} transition={loop} style={jointStyle('82px 145px')}>
            <path d="M82 145 C65 161 59 179 59 197" fill="none" stroke={`url(#skin-${id})`} strokeWidth="23" strokeLinecap="round" />
            <circle cx="59" cy="197" r="11.5" fill="#efb58a" />
            <motion.g animate={{ rotate: pose.leftForearm }} transition={loop} style={jointStyle('59px 197px')}>
              <path d="M59 197 C59 214 63 225 69 239" fill="none" stroke={`url(#skin-${id})`} strokeWidth="20" strokeLinecap="round" />
              <circle cx="69" cy="241" r="10.5" fill="#efb58a" />
            </motion.g>
          </motion.g>

          {/* Neck sits behind the head but in front of the shirt. */}
          <path d="M119 104 V122 C119 129 126 134 135 134 C144 134 151 129 151 122 V104 Z" fill="#e7a77d" />

          {/* Head is drawn last so it can never fall behind the neck or collar. */}
          <motion.g
            animate={{ rotate: action === 'think' ? [0, -4, -4, 0] : action === 'measure' ? [0, 2, 0] : [0, .7, 0, -.7, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            style={jointStyle('135px 84px')}
          >
            <ellipse cx="135" cy="75" rx="47" ry="51" fill={`url(#skin-${id})`} />
            <path d="M88 72 C89 34 109 18 137 18 C170 18 185 42 181 76 C168 58 152 50 132 47 C119 58 104 66 88 72 Z" fill="#202a31" />
            <path d="M96 53 C108 28 145 21 169 42" fill="none" stroke="#35434d" strokeWidth="8" strokeLinecap="round" />
            <motion.g animate={{ scaleY: [1, 1, .12, 1, 1] }} transition={{ duration: 4.1, repeat: Infinity, times: [0, .43, .46, .49, 1] }} style={jointStyle('135px 78px')}>
              <circle cx="119" cy="76" r="4" fill="#172026" />
              <circle cx="151" cy="76" r="4" fill="#172026" />
            </motion.g>
            <path d="M110 67 C115 64 121 64 126 67 M144 67 C149 64 155 64 160 67" stroke="#714a3b" strokeWidth="3" fill="none" strokeLinecap="round" />
            <path d="M135 78 L131 89 L138 89" stroke="#c28161" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <motion.path
              d={isTalking ? 'M119 100 Q135 115 151 100 Q135 123 119 100 Z' : 'M120 101 Q135 110 150 101'}
              stroke="#8e4d39" strokeWidth="3" fill={isTalking ? '#5a2424' : 'none'} strokeLinecap="round"
              animate={isTalking ? { scaleY: [1, .52, 1, .7, 1] } : {}}
              transition={{ duration: .56, repeat: Infinity }} style={jointStyle('135px 105px')}
            />
          </motion.g>
        </svg>
      </motion.div>
    </div>
  );
}
