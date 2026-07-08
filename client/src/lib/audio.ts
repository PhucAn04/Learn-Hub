export const playClickSound = () => {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sine';
    // Playful pitch sweep pop sound for children interface
    osc.frequency.setValueAtTime(350, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(700, ctx.currentTime + 0.08);
    
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) {
    console.error('Audio play failed', e);
  }
};

export const playSuccessSound = () => {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Play a happy ascending arpeggio (C5 -> E5 -> G5 -> C6)
    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playNote(523.25, now, 0.15);         // C5
    playNote(659.25, now + 0.1, 0.15);   // E5
    playNote(783.99, now + 0.2, 0.15);   // G5
    playNote(1046.50, now + 0.3, 0.3);   // C6
  } catch (e) {
    console.error('Audio play failed', e);
  }
};

export const speakEnglish = (text: string) => {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  
  const voices = window.speechSynthesis.getVoices();
  const enVoice = voices.find(voice => voice.lang.includes('en'));
  if (enVoice) {
    utterance.voice = enVoice;
  }
  
  utterance.rate = 0.9;
  utterance.pitch = 1.1;
  
  window.speechSynthesis.speak(utterance);
};
