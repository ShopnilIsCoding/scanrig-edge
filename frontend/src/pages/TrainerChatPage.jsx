import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarDays, Mic, MicOff, Send, Sparkles, Volume2, VolumeX, Dumbbell, BatteryCharging, Flame } from 'lucide-react';
import TrainerShowcase3D from '../components/TrainerShowcase3D';
import { askTrainer, getTrainerContext } from '../services/api';
import { useApp } from '../context/AppContext';

function pickVoice(coachName) {
  const voices = window.speechSynthesis?.getVoices?.() || [];
  const english = voices.filter((voice) => /^en[-_]/i.test(voice.lang || ''));
  const pattern = coachName === 'Jody' ? /(jenny|aria|samantha|zira|female|susan|victoria|karen)/i : /(guy|david|mark|daniel|male|alex|george)/i;
  return english.find((voice) => pattern.test(voice.name)) || english[0] || voices[0];
}

export default function TrainerChatPage() {
  const { profile, currentUser } = useApp();
  const [context, setContext] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(() => localStorage.getItem('scanrig:trainer-voice-replies') !== 'off');
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef(null);
  const bottomRef = useRef(null);
  const coachName = context?.coachName || (profile?.gender === 'female' ? 'Jody' : 'James');
  const gender = coachName === 'Jody' ? 'female' : 'male';
  const firstName = String(context?.userName || currentUser?.name || 'athlete').split(/\s+/)[0];

  useEffect(() => {
    let live = true;
    getTrainerContext().then((data) => {
      if (!live) return;
      setContext(data.context);
      const today = data.context?.todaySession;
      const readiness = data.context?.readiness?.score;
      const latestForm = data.context?.latestWorkout?.formScore;
      const introBits = [
        `Hi ${String(data.context?.userName || 'athlete').split(/\s+/)[0]}. I’m ${data.context?.coachName || 'your trainer'}.`,
        today ? `Today is ${today.focus}.` : 'You do not have a workout scheduled today.',
        readiness ? `Your check-in score is ${readiness}/100.` : 'You have not done today’s quick check-in yet.',
        latestForm ? `Your latest recorded form score was ${latestForm}%.` : '',
        'What would you like help with—today’s workout, form, recovery, or your weekly plan?',
      ].filter(Boolean);
      setMessages([{ role: 'assistant', text: introBits.join(' ') }]);
    }).catch(() => setMessages([{ role: 'assistant', text: 'I could not load your training history yet, but you can still try again in a moment.' }])).finally(()=>live&&setLoading(false));
    return () => { live = false; recognitionRef.current?.abort?.(); window.speechSynthesis?.cancel?.(); };
  }, []);

  useEffect(() => { localStorage.setItem('scanrig:trainer-voice-replies', voiceReplies ? 'on' : 'off'); }, [voiceReplies]);
  useEffect(() => { bottomRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }); }, [messages, sending]);

  const todayLine = useMemo(() => {
    const s = context?.todaySession;
    if (!s) return 'Recovery / no planned session';
    return `${s.focus} · ${s.exercises?.length || 0} exercises · ${s.sessionLength || context?.profile?.sessionLengthMinutes || 30} min`;
  }, [context]);

  const briefing = useMemo(() => {
    if (!context) return '';
    const parts = [`Hi ${firstName}. I’m ${coachName}.`];
    if (context.todaySession) parts.push(`Today is ${context.todaySession.focus}.`);
    else parts.push('You do not have a workout scheduled today.');
    if (context.readiness?.score) parts.push(`Your check-in score is ${context.readiness.score} out of 100.`);
    if (context.latestWorkout?.formScore) parts.push(`Your latest form score was ${context.latestWorkout.formScore} percent.`);
    parts.push('Ask me anything about your training, form, recovery, or weekly plan.');
    return parts.join(' ');
  }, [context, firstName, coachName]);

  const speak = (text) => {
    if (!voiceReplies || !text || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(coachName); if (voice) utterance.voice = voice;
    utterance.rate = 1.0; utterance.pitch = coachName === 'Jody' ? 1.02 : .98;
    utterance.onstart = () => setSpeaking(true); utterance.onend = () => setSpeaking(false); utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const sendMessage = async (raw = input) => {
    const text = String(raw || '').trim(); if (!text || sending) return;
    const history = messages.slice(-8).map((item) => ({ role: item.role, text: item.text }));
    setMessages((items) => [...items, { role: 'user', text }]); setInput(''); setSending(true);
    try {
      const data = await askTrainer(text, history);
      setContext(data.context || context);
      setMessages((items) => [...items, { role: 'assistant', text: data.reply, source: data.source }]);
      speak(data.reply);
    } catch (error) {
      setMessages((items) => [...items, { role: 'assistant', text: error?.response?.data?.message || 'I could not reply right now. Please try again.' }]);
    } finally { setSending(false); }
  };

  const toggleMic = () => {
    if (listening) { recognitionRef.current?.stop?.(); setListening(false); return; }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setMessages((items)=>[...items,{role:'assistant',text:'Voice input is not available in this browser. You can type your question instead.'}]); return; }
    window.speechSynthesis?.cancel?.(); setSpeaking(false);
    const rec = new Recognition(); rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false;
    rec.onresult = (event) => {
      const transcript = Array.from(event.results).map((result)=>result[0]?.transcript || '').join(' ').trim();
      setInput(transcript);
      if (event.results[event.results.length - 1]?.isFinal && transcript) window.setTimeout(()=>sendMessage(transcript), 180);
    };
    rec.onend = () => setListening(false); rec.onerror = () => setListening(false);
    recognitionRef.current = rec; setListening(true); rec.start();
  };

  return (
    <div className="app-page section-shell trainer-chat-page">
      <section className="trainer-chat-hero">
        <div className="trainer-chat-model">
          <TrainerShowcase3D gender={gender} animation={speaking ? 'talking' : 'defaultIdle'} />
          <div className={`trainer-presence ${speaking ? 'speaking' : ''}`}><i /> {speaking ? `${coachName} is speaking` : `${coachName} is ready`}</div>
        </div>
        <div className="trainer-chat-intro">
          <span className="eyebrow">TALK TO YOUR TRAINER</span>
          <h1>Ask {coachName} about <em>your</em> training.</h1>
          <p>{coachName} can see your ScanRig profile, today’s plan, how you feel today, and recorded workout results. Ask about exercise form, recovery, calories, progress, or what is planned this week.</p>
          <div className="trainer-context-row">
            <div><CalendarDays /><span><small>TODAY</small><strong>{todayLine}</strong></span></div>
            <div><BatteryCharging /><span><small>HOW YOU FEEL</small><strong>{context?.readiness?.score ? `${context.readiness.score}/100` : 'Check-in not done'}</strong></span></div>
            <div><Dumbbell /><span><small>LATEST FORM</small><strong>{context?.latestWorkout?.formScore ? `${context.latestWorkout.formScore}%` : 'No session yet'}</strong></span></div>
            <div><Flame /><span><small>TODAY'S CALORIE TARGET</small><strong>{context?.caloriePlan?.todayTarget ? `~${context.caloriePlan.todayTarget} kcal` : 'Plan not set'}</strong></span></div>
          </div>
          <div className="trainer-voice-actions">
            <button className="button button-small" onClick={() => speak(briefing)} disabled={!briefing || speaking}><Volume2 size={16} /> Hear my briefing</button>
          </div>
          <small className="trainer-scope-note"><Sparkles /> Fitness-focused only · answers use your ScanRig plan and recorded workout data.</small>
        </div>
      </section>

      <section className="trainer-chat-shell">
        <div className="trainer-chat-messages">
          {loading && <div className="trainer-thinking">Preparing {coachName}…</div>}
          {messages.map((message,index)=><div key={index} className={`trainer-message ${message.role}`}><span>{message.role === 'assistant' ? coachName : 'You'}</span><p>{message.text}</p></div>)}
          {sending && <div className="trainer-thinking"><i /><i /><i /> {coachName} is thinking</div>}
          <div ref={bottomRef} />
        </div>
        <div className="trainer-quick-prompts">
          {['What is my workout today?', 'How was my latest form?', 'How many calories are planned today?', 'Should I take more rest today?', 'What should I focus on this week?'].map((prompt)=><button key={prompt} onClick={()=>sendMessage(prompt)}>{prompt}<ArrowRight size={14}/></button>)}
        </div>
        <div className="trainer-chat-compose">
          <button className={listening ? 'active mic' : 'mic'} onClick={toggleMic} title="Ask with your microphone">{listening ? <MicOff /> : <Mic />}</button>
          <input value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();}}} placeholder={`Ask ${coachName} about your training…`} />
          <button className="voice-reply-toggle" onClick={()=>{setVoiceReplies((v)=>!v); if(voiceReplies){window.speechSynthesis?.cancel?.();setSpeaking(false);}}} title="Voice replies">{voiceReplies ? <Volume2 /> : <VolumeX />}</button>
          <button className="send" onClick={()=>sendMessage()} disabled={!input.trim() || sending}><Send /></button>
        </div>
        <p className="trainer-chat-disclaimer">For exercise guidance only. Stop a movement that causes sharp or worrying pain and seek appropriate professional help when needed.</p>
      </section>
    </div>
  );
}
