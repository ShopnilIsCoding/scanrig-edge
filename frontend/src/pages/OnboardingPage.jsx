import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Dumbbell, Goal, Ruler, Scale, Timer, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Trainer3DStage from '../components/Trainer3DStage';
import { useTrainerAssetBundle } from '../components/AnimatedMixamoTrainer';
import { useApp } from '../context/AppContext';

const steps = [
  { key: 'gender', title: 'Choose your trainer profile', text: 'Your trainer follows the profile you select. You can change it later from account settings.', icon: UserRound },
  { key: 'dateOfBirth', title: 'When were you born?', text: 'We use age to choose a suitable starting level.', icon: CalendarDays },
  { key: 'height', title: 'What is your height?', text: 'Set your height so the plan can use a better starting profile.', icon: Ruler },
  { key: 'weight', title: 'What is your weight?', text: 'Add your current body weight. You can update it later from your profile.', icon: Scale },
  { key: 'goal', title: 'What do you want to improve?', text: 'Your main goal helps shape the first weekly training plan.', icon: Goal },
  { key: 'level', title: 'What is your current level?', text: 'Choose an honest starting point. Difficulty can increase over time.', icon: Dumbbell },
  { key: 'days', title: 'Which days work for you?', text: 'Choose at least two days for your first weekly training schedule.', icon: Timer },
  { key: 'complete', title: 'Your starting plan is ready.', text: 'Profile calibration is complete. Your first workout schedule is unlocked.', icon: Check },
];

const goals = ['General fitness', 'Build strength', 'Improve endurance', 'Weight management'];
const levels = ['Beginner', 'Intermediate', 'Advanced'];
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];


function TrainerAssetBoot({ state }) {
  const progress = state.progress || 0;
  const completed = state.completed || 0;
  const total = state.total || 13;
  const failed = state.status === 'error';

  return (
    <div className="min-h-[calc(100vh-76px)] px-[max(20px,calc((100vw-1240px)/2))] py-10 max-[760px]:px-3 max-[760px]:py-6">
      <div className="relative grid min-h-[700px] place-items-center overflow-hidden rounded-[28px] border border-white/10 bg-[#071014] px-6 text-center shadow-[0_35px_100px_rgba(0,0,0,.38)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(77,232,209,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(77,232,209,.04)_1px,transparent_1px)] bg-[size:34px_34px]" />
        <div className="relative z-10 w-full max-w-[520px]">
          <div className="relative mx-auto h-44 w-44">
            <motion.div
              className="absolute inset-0 rounded-full border border-[#4de8d1]/25 shadow-[0_0_55px_rgba(77,232,209,.12)]"
              animate={{ rotate: 360 }}
              transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute inset-[18%] rounded-full border border-[#ff8a3d]/20"
              animate={{ rotate: -360, scale: [0.96, 1.04, 0.96] }}
              transition={{ rotate: { duration: 6, repeat: Infinity, ease: 'linear' }, scale: { duration: 1.8, repeat: Infinity } }}
            />
            <motion.div
              className="absolute left-1/2 top-[29%] h-10 w-10 -translate-x-1/2 rounded-full border border-[#4de8d1]/35 bg-[#4de8d1]/5"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div
              className="absolute left-1/2 top-[48%] h-16 w-14 -translate-x-1/2 rounded-[28px] border border-[#4de8d1]/30 bg-[#4de8d1]/5"
              animate={{ opacity: [0.24, 0.55, 0.24] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          </div>

          <div className="mt-6 font-mono text-[10px] font-bold tracking-[.2em] text-[#4de8d1]">
            {failed ? 'COACH WARM-UP PAUSED' : 'WARMING UP YOUR COACHES'}
          </div>
          <h1 className="mt-3 text-[clamp(1.8rem,4vw,3rem)] font-black tracking-[-.04em] text-white">
            {failed ? 'Your virtual coach needs another warm-up.' : 'Getting your trainers ready for a smooth first session.'}
          </h1>
          <p className="mx-auto mt-3 max-w-[450px] text-sm leading-7 text-white/45">
            {failed
              ? 'Try again and we will prepare the coach before you continue.'
              : 'We are warming up movement, balance, and coaching animations so your trainer is ready before the profile setup begins.'}
          </p>

          {!failed && (
            <>
              <div className="mt-8 h-2 overflow-hidden rounded-full border border-white/8 bg-black/35">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#4de8d1] via-[#b4ff3d] to-[#ff8a3d]"
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.25 }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between font-mono text-[9px] tracking-[.12em] text-white/35">
                <span>{completed} / {total} WARM-UP STEPS</span>
                <span className="text-[#b4ff3d]">{progress}%</span>
              </div>
            </>
          )}

          {failed && (
            <button type="button" className="button mt-7" onClick={() => window.location.reload()}>
              Warm up again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function calculateAge(value) {
  if (!value) return null;
  const birth = new Date(value);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age;
}

export default function OnboardingPage() {
  const trainerAssets = useTrainerAssetBundle();
  const navigate = useNavigate();
  const { profile, setProfile, currentUser } = useApp();
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState(() => ({ ...profile, gender: 'male' }));
  const step = steps[stepIndex];
  const StepIcon = step.icon;
  const progress = ((stepIndex + 1) / steps.length) * 100;
  const age = useMemo(() => calculateAge(form.dateOfBirth), [form.dateOfBirth]);
  const bmi = Number(form.height) > 0 && Number(form.weight) > 0 ? Number(form.weight) / ((Number(form.height) / 100) ** 2) : null;

  if (trainerAssets.status !== 'ready') {
    return <TrainerAssetBoot state={trainerAssets} />;
  }

  const canContinue = () => {
    if (step.key === 'gender') return form.gender === 'male' || form.gender === 'female';
    if (step.key === 'dateOfBirth') return Boolean(form.dateOfBirth);
    if (step.key === 'height') return Number(form.height) >= 100;
    if (step.key === 'weight') return Number(form.weight) >= 30;
    if (step.key === 'goal') return Boolean(form.goal);
    if (step.key === 'level') return Boolean(form.level);
    if (step.key === 'days') return form.days?.length >= 2;
    return true;
  };

  const toggleDay = (day) => {
    setForm((current) => ({
      ...current,
      days: current.days?.includes(day)
        ? current.days.filter((item) => item !== day)
        : [...(current.days || []), day],
    }));
  };

  const moveToStep = (nextIndex) => {
    if (nextIndex < 0 || nextIndex >= steps.length || nextIndex === stepIndex) return;
    setStepIndex(nextIndex);
  };

  const next = () => {
    if (stepIndex === steps.length - 1) {
      setProfile({ ...form, age, onboardingComplete: true, name: currentUser?.name || form.name || '' });
      navigate('/dashboard');
      return;
    }
    moveToStep(stepIndex + 1);
  };

  const back = () => moveToStep(stepIndex - 1);

  return (
    <div className="min-h-[calc(100vh-76px)] px-[max(20px,calc((100vw-1240px)/2))] py-10 max-[760px]:px-3 max-[760px]:py-6">
      <div className="mb-4 flex items-center justify-between font-mono text-[10px] font-semibold tracking-[.14em] text-white/45">
        <span>INTERACTIVE PROFILE LAB</span>
        <span>{String(stepIndex + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')}</span>
      </div>

      <div className="mb-6 h-[3px] overflow-hidden rounded-full bg-white/8">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#4de8d1] via-[#b4ff3d] to-[#ff8a3d]"
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 150, damping: 24 }}
        />
      </div>

      <div className="grid min-h-[700px] grid-cols-[1.18fr_.82fr] overflow-hidden rounded-[28px] border border-white/10 bg-[#10171c] shadow-[0_35px_100px_rgba(0,0,0,.38)] max-[1050px]:grid-cols-1">
        <section className="relative border-r border-white/8 max-[1050px]:border-b max-[1050px]:border-r-0">
          <Trainer3DStage
            stepKey={step.key}
            form={form}
            age={age}
            stepIndex={stepIndex}
            totalSteps={steps.length}
          />
        </section>

        <section className="flex min-h-[700px] flex-col justify-between bg-[linear-gradient(155deg,#141c21,#0d1216)] px-[clamp(24px,4vw,54px)] py-[clamp(30px,5vw,56px)] max-[1050px]:min-h-[560px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: 24, filter: 'blur(5px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: -18, filter: 'blur(4px)' }}
              transition={{ duration: 0.28 }}
            >
              <div className="mb-6 flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#4de8d1]/20 bg-[#4de8d1]/8 text-[#4de8d1]">
                  <StepIcon size={20} />
                </div>
                <div>
                  <div className="font-mono text-[9px] font-semibold tracking-[.14em] text-white/30">CALIBRATION STAGE</div>
                  <div className="mt-1 font-mono text-xs font-bold text-[#ff8a3d]">{String(stepIndex + 1).padStart(2, '0')}</div>
                </div>
              </div>

              <h1 className="m-0 max-w-[520px] text-[clamp(2rem,4vw,3.35rem)] font-bold leading-[1.02] tracking-[-.045em] text-white">{step.title}</h1>
              <p className="mt-4 max-w-[520px] text-sm leading-7 text-white/50">{step.text}</p>

              <div className="onboarding-input-area">
                {step.key === 'gender' && (
                  <div className="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, gender: 'male' })}
                      className={`group rounded-[22px] border p-5 text-left transition-all duration-300 ${form.gender === 'male' ? 'border-[#4de8d1]/70 bg-[#4de8d1]/10 shadow-[0_0_38px_rgba(77,232,209,.12)]' : 'border-white/10 bg-white/[.025] hover:border-white/20 hover:bg-white/[.045]'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#4de8d1]/10 text-[#4de8d1]"><UserRound size={23} /></div>
                        <span className={`grid h-7 w-7 place-items-center rounded-full border ${form.gender === 'male' ? 'border-[#4de8d1] bg-[#4de8d1] text-[#071014]' : 'border-white/15 text-transparent'}`}><Check size={16} /></span>
                      </div>
                      <div className="mt-5 font-mono text-[9px] tracking-[.14em] text-white/35">MALE TRAINER</div>
                      <div className="mt-1 text-2xl font-black tracking-[-.03em] text-white">James</div>
                      <div className="mt-2 text-xs leading-5 text-white/45">Your male virtual coach for guided workouts.</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setForm({ ...form, gender: 'female' })}
                      className={`group rounded-[22px] border p-5 text-left transition-all duration-300 ${form.gender === 'female' ? 'border-[#ff8a3d]/70 bg-[#ff8a3d]/10 shadow-[0_0_38px_rgba(255,138,61,.12)]' : 'border-white/10 bg-white/[.025] hover:border-white/20 hover:bg-white/[.045]'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ff8a3d]/10 text-[#ff8a3d]"><UserRound size={23} /></div>
                        <span className={`grid h-7 w-7 place-items-center rounded-full border ${form.gender === 'female' ? 'border-[#ff8a3d] bg-[#ff8a3d] text-[#071014]' : 'border-white/15 text-transparent'}`}><Check size={16} /></span>
                      </div>
                      <div className="mt-5 font-mono text-[9px] tracking-[.14em] text-white/35">FEMALE TRAINER</div>
                      <div className="mt-1 text-2xl font-black tracking-[-.03em] text-white">Jody</div>
                      <div className="mt-2 text-xs leading-5 text-white/45">Your female virtual coach for guided workouts.</div>
                    </button>
                  </div>
                )}

                {step.key === 'dateOfBirth' && (
                  <>
                    <label className="field-label">Date of birth</label>
                    <input className="large-input" type="date" value={form.dateOfBirth || ''} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} />
                    {age !== null && <div className="input-summary"><UserRound size={17} /> Coach calculated your age: <strong>{age}</strong></div>}
                  </>
                )}

                {step.key === 'height' && (
                  <>
                    <div className="measurement-control"><input type="number" min="100" max="230" value={form.height || ''} onChange={(event) => setForm({ ...form, height: Number(event.target.value) })} /><span>cm</span></div>
                    <input className="measurement-slider" type="range" min="100" max="220" value={form.height || 170} onChange={(event) => setForm({ ...form, height: Number(event.target.value) })} />
                  </>
                )}

                {step.key === 'weight' && (
                  <>
                    <div className="measurement-control"><input type="number" min="30" max="250" value={form.weight || ''} onChange={(event) => setForm({ ...form, weight: Number(event.target.value) })} /><span>kg</span></div>
                    <input className="measurement-slider" type="range" min="30" max="180" value={form.weight || 68} onChange={(event) => setForm({ ...form, weight: Number(event.target.value) })} />
                  </>
                )}

                {step.key === 'goal' && (
                  <div className="option-grid">
                    {goals.map((goal) => (
                      <button type="button" className={form.goal === goal ? 'selected' : ''} onClick={() => setForm({ ...form, goal })} key={goal}>{goal}<Check size={17} /></button>
                    ))}
                  </div>
                )}

                {step.key === 'level' && (
                  <div className="level-options">
                    {levels.map((level, index) => (
                      <button type="button" className={form.level === level ? 'selected' : ''} onClick={() => setForm({ ...form, level })} key={level}>
                        <span>0{index + 1}</span><strong>{level}</strong><small>{index === 0 ? 'New or returning' : index === 1 ? 'Training each week' : 'Consistent experience'}</small>
                      </button>
                    ))}
                  </div>
                )}

                {step.key === 'days' && (
                  <div className="day-options">
                    {days.map((day) => (
                      <button type="button" className={form.days?.includes(day) ? 'selected' : ''} onClick={() => toggleDay(day)} key={day}><span>{day.slice(0, 3)}</span><Check /></button>
                    ))}
                  </div>
                )}

                {step.key === 'complete' && (
                  <div className="plan-preview">
                    <div><small>TRAINER</small><strong>{form.gender === 'female' ? 'Jody' : 'James'}</strong></div>
                    <div><small>GOAL</small><strong>{form.goal}</strong></div>
                    <div><small>LEVEL</small><strong>{form.level}</strong></div>
                    <div><small>TRAINING DAYS</small><strong>{form.days?.length} days per week</strong></div>
                    <div><small>SESSION TARGET</small><strong>{form.sessionLength || 30} minutes</strong></div>
                    <div><small>STARTING PROFILE</small><strong>{bmi ? `BMI ${bmi.toFixed(1)}` : 'Ready'}</strong></div>
                    <div className="plan-preview-note"><small>COACH STARTING NOTE</small><strong>{form.level === 'Beginner' ? 'Start with camera-friendly movements and controlled rep targets. The plan will adapt after your first form scores.' : 'Start with moderate volume and use the live form score to decide when to increase difficulty.'}</strong></div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/8 pt-6">
            <button className="button button-secondary" disabled={stepIndex === 0} onClick={back}><ArrowLeft size={18} /> Back</button>
            <button className="button" disabled={!canContinue()} onClick={next}>{step.key === 'complete' ? 'Open my plan' : 'Continue'} <ArrowRight size={18} /></button>
          </div>
        </section>
      </div>
    </div>
  );
}
