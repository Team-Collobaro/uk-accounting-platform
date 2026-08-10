'use client'

export function initAnimFactory() {
  if (typeof window === 'undefined') return;
  if ((window as any).AnimFactory) return;

  (window as any).AnimFactory = (function () {
    let audioCtx: AudioContext | null = null;
    let voicesLoaded = false;
    let ukVoice: SpeechSynthesisVoice | null = null;

    function getAudio() {
      if (!audioCtx) {
        try {
          audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
          return null;
        }
      }
      return audioCtx;
    }

    function pickUkVoice() {
      if (typeof speechSynthesis === 'undefined') return null;
      const v = speechSynthesis.getVoices();
      if (!v || !v.length) return null;
      const pn = [
        'Google UK English Female',
        'Microsoft Sonia Online (Natural) - English (United Kingdom)',
        'Microsoft Libby Online (Natural) - English (United Kingdom)',
        'Microsoft Hazel - English (Great Britain)',
        'Microsoft Susan - English (Great Britain)',
        'Kate', 'Serena', 'Stephanie', 'Fiona'
      ];
      for (let i = 0; i < pn.length; i++) {
        const x = v.find((z) => z.name === pn[i] || z.name.indexOf(pn[i]) !== -1);
        if (x) return x;
      }
      const u = v.find((z) => z.lang === 'en-GB' || z.lang === 'en_GB');
      if (u) return u;
      const f = v.find((z) => z.lang.indexOf('en') === 0 && z.name.toLowerCase().indexOf('female') !== -1);
      if (f) return f;
      return v.find((z) => z.lang.indexOf('en') === 0) || v[0];
    }

    function loadVoices(cb: (ok: boolean) => void) {
      if (typeof speechSynthesis === 'undefined') { cb(false); return; }
      let v = pickUkVoice();
      if (v) { ukVoice = v; voicesLoaded = true; cb(true); return; }
      let a = 0;
      const p = setInterval(function () {
        a++;
        const v = pickUkVoice();
        if (v) {
          ukVoice = v; voicesLoaded = true; clearInterval(p); cb(true);
        } else if (a >= 30) {
          clearInterval(p); cb(false);
        }
      }, 100);
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = function () {
          if (!voicesLoaded) {
            const v = pickUkVoice();
            if (v) { ukVoice = v; voicesLoaded = true; clearInterval(p); cb(true); }
          }
        };
      }
    }

    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.getVoices().length === 0 && speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = function () { ukVoice = pickUkVoice(); };
    } else if (typeof speechSynthesis !== 'undefined') {
      ukVoice = pickUkVoice();
    }

    function playTone(freqs: number | number[], duration: number, type: OscillatorType, volume: number, soundOn: boolean) {
      if (!soundOn) return;
      const ctx = getAudio();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      const freqsArr = Array.isArray(freqs) ? freqs : [freqs];
      freqsArr.forEach(function (f) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.value = f;
        o.type = type || 'sine';
        const v = volume || 0.06;
        g.gain.setValueAtTime(0, ctx.currentTime);
        g.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        o.start();
        o.stop(ctx.currentTime + duration);
      });
    }

    function playSweep(s: number, e: number, d: number, t: OscillatorType, v: number, soundOn: boolean) {
      if (!soundOn) return;
      const ctx = getAudio();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = t || 'sine';
      o.frequency.setValueAtTime(s, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(e, ctx.currentTime + d);
      const vv = v || 0.07;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(vv, ctx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d);
      o.start();
      o.stop(ctx.currentTime + d);
    }

    function playArp(freqs: number[], gap: number, duration: number, volume: number, soundOn: boolean) {
      if (!soundOn) return;
      freqs.forEach(function (f, i) {
        setTimeout(function () { playTone(f, duration, 'sine', volume, soundOn); }, i * gap);
      });
    }

    const presets: Record<string, (s: boolean) => void> = {
      open: function (s) { playTone([261.63, 329.63, 392.00], 0.7, 'sine', 0.06, s); },
      rise: function (s) { playArp([261.63, 329.63, 392.00, 523.25], 130, 0.45, 0.06, s); },
      fall: function (s) { playSweep(220, 80, 1.2, 'triangle', 0.08, s); setTimeout(function () { playTone(60, 0.4, 'sine', 0.10, s); }, 1200); },
      danger: function (s) { playSweep(180, 60, 1.4, 'sawtooth', 0.06, s); setTimeout(function () { playTone(80, 0.5, 'sine', 0.08, s); }, 1300); },
      discover: function (s) { playArp([392.00, 440.00, 493.88, 523.25], 100, 0.45, 0.06, s); },
      fixed: function (s) { playArp([261.63, 329.63, 392.00], 180, 0.4, 0.06, s); },
      triumph: function (s) { playArp([261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25], 120, 0.5, 0.06, s); setTimeout(function () { playTone(1046.50, 0.5, 'sine', 0.07, s); }, 1100); }
    };

    function speak(text: string, voiceOn: boolean) {
      if (!voiceOn || typeof speechSynthesis === 'undefined') return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (ukVoice) u.voice = ukVoice;
      u.lang = 'en-GB'; u.rate = 0.96; u.pitch = 1.0; u.volume = 1.0;
      speechSynthesis.speak(u);
    }

    function cancelSpeech() {
      if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    }

    function create(prefix: string, scenes: any[]) {
      let soundOn = false, voiceOn = false;
      const g = function (id: string) { return document.getElementById(id + '-' + prefix); };
      const svg = g('svg'), stage = g('stage'), anim = g('anim');
      const sceneBadge = g('scene-badge'), sceneTime = g('scene-time'), sceneTag = g('scene-tag');
      const voText = g('voiceover-text'), voTag = g('vo-tag'), counter = g('counter'), dotsC = g('dots');
      const prevBtn = g('prev') as HTMLButtonElement, nextBtn = g('next') as HTMLButtonElement, playBtn = g('play');
      const soundBtn = g('sound'), soundIcon = g('sound-icon'), soundLabel = g('sound-label');
      const voiceBtn = g('voice'), voiceIcon = g('voice-icon'), voiceLabel = g('voice-label'), voiceStatus = g('voice-status');
      const prog = g('prog');

      if (!svg || !playBtn) { console.warn('AnimFactory: missing elements for prefix', prefix); return; }

      // Clean up previous dots if running twice
      if (dotsC) dotsC.innerHTML = '';
      
      scenes.forEach(function (s, i) {
        const d = document.createElement('button');
        d.className = 'scene-dot';
        d.title = (i + 1) + '. ' + s.name;
        d.addEventListener('click', function () { jumpTo(i, true); });
        dotsC?.appendChild(d);
      });
      const dots = dotsC?.querySelectorAll('.scene-dot') || [];

      function applyTheme(s: any) {
        if(anim) {
          anim.style.setProperty('--scene-accent', s.accent);
          anim.style.setProperty('--scene-bg', s.bg);
          anim.style.borderColor = s.accent;
          anim.style.boxShadow = '0 0 60px ' + s.accent + '33, 0 20px 60px rgba(0,0,0,0.7)';
        }
        if(stage) stage.style.background = s.bg;
        if(sceneBadge) {
          sceneBadge.style.background = 'rgba(0,0,0,0.5)';
          sceneBadge.style.borderColor = s.accent;
          sceneBadge.style.color = s.accent;
        }
      }

      function hideAll() {
        scenes.forEach(function (s) {
          const els = svg?.querySelectorAll(s.sel);
          els?.forEach(function (e: any) {
            e.style.opacity = 0;
            e.style.transition = 'opacity 0.7s ease';
            e.classList.remove('scene-active');
          });
        });
      }

      function updateDots(i: number) {
        dots.forEach(function (d, idx) {
          d.classList.toggle('active', idx === i);
        });
      }

      let stepTimer: any = null, current = -1, isPlaying = false;
      const totalT = scenes.reduce(function (a, s) { return a + s.dur; }, 0);

      function fireCue(s: any) {
        if (!s.cue) return;
        if (typeof s.cue === 'function') s.cue();
        else if (presets[s.cue]) presets[s.cue](soundOn);
      }

      function showScene(i: number, autoPlayCue: boolean) {
        hideAll();
        if (i < 0 || i >= scenes.length) return;
        const s = scenes[i];
        svg?.querySelectorAll(s.sel).forEach(function (e: any) {
          e.style.opacity = 1;
          e.classList.add('scene-active');
        });
        applyTheme(s);
        if(sceneBadge) sceneBadge.innerHTML = 'SCENE ' + (i + 1) + ' &middot; ' + s.name;
        if(sceneTime) sceneTime.textContent = s.time;
        if(sceneTag) sceneTag.innerHTML = 'SCENE ' + (i + 1) + ' &middot; ' + s.name;
        if(voTag) voTag.innerHTML = '&#127908; SCENE ' + (i + 1);
        if(voText) voText.textContent = s.narration;
        if(counter) counter.textContent = 'SCENE ' + (i + 1) + ' OF ' + scenes.length + ' &middot; CLICK DOTS TO JUMP &middot; OR USE PREV / NEXT';
        updateDots(i);
        if(prevBtn) prevBtn.disabled = (i === 0);
        if(nextBtn) nextBtn.disabled = (i === scenes.length - 1);
        if (autoPlayCue) {
          fireCue(s);
          if (voiceOn && s.narration) speak(s.narration, voiceOn);
        }
      }

      function jumpTo(i: number, autoCue: boolean) {
        if (stepTimer) { clearInterval(stepTimer); stepTimer = null; }
        cancelSpeech();
        current = i;
        showScene(i, autoCue);
        const startEl = scenes.slice(0, i).reduce(function (a, s) { return a + s.dur; }, 0);
        if(prog) prog.style.width = (startEl / totalT * 100) + '%';
        if (isPlaying) startSceneTimer();
      }

      function startSceneTimer() {
        if (stepTimer) { clearInterval(stepTimer); stepTimer = null; }
        const startEl = scenes.slice(0, current).reduce(function (a, s) { return a + s.dur; }, 0);
        const start = Date.now();
        stepTimer = setInterval(function () {
          const t = Date.now() - start;
          if(prog) prog.style.width = ((startEl + t) / totalT * 100) + '%';
          if (t >= scenes[current].dur) {
            clearInterval(stepTimer);
            stepTimer = null;
            if (current < scenes.length - 1) {
              current++;
              showScene(current, true);
              startSceneTimer();
            } else {
              isPlaying = false;
              if(playBtn) playBtn.innerHTML = '&#9658; PLAY';
              if(prog) prog.style.width = '100%';
            }
          }
        }, 100);
      }

      function togglePlay() {
        if (isPlaying) {
          isPlaying = false;
          if (stepTimer) { clearInterval(stepTimer); stepTimer = null; }
          cancelSpeech();
          if(playBtn) playBtn.innerHTML = '&#9658; PLAY';
        } else {
          isPlaying = true;
          if(playBtn) playBtn.innerHTML = '&#10073;&#10073; PAUSE';
          if (current < 0) {
            current = 0;
            showScene(0, true);
          } else if (voiceOn && scenes[current].narration) {
            speak(scenes[current].narration, voiceOn);
          }
          startSceneTimer();
        }
      }

      function toggleSound() {
        soundOn = !soundOn;
        if (soundOn) {
          if(soundIcon) soundIcon.innerHTML = '&#128266;';
          if(soundLabel) soundLabel.textContent = 'Cues on';
          if(soundBtn) soundBtn.classList.add('toggle-on');
          getAudio();
        } else {
          if(soundIcon) soundIcon.innerHTML = '&#128263;';
          if(soundLabel) soundLabel.textContent = 'Cues off';
          if(soundBtn) soundBtn.classList.remove('toggle-on');
        }
      }

      function toggleVoice() {
        voiceOn = !voiceOn;
        if (voiceOn) {
          if(voiceIcon) voiceIcon.innerHTML = '&#127908;';
          if(voiceLabel) voiceLabel.textContent = 'Voice on';
          if(voiceBtn) voiceBtn.classList.add('toggle-on');
          if(voiceStatus) { voiceStatus.style.display = 'block'; voiceStatus.textContent = 'LOADING UK VOICE…'; }
          loadVoices(function (ok) {
            if (ok && ukVoice) {
              if(voiceStatus) voiceStatus.innerHTML = '&#127482;&#127463; VOICE: <strong>' + ukVoice.name + '</strong> (' + ukVoice.lang + ')';
              const u = new SpeechSynthesisUtterance('Voice ready.');
              if (ukVoice) u.voice = ukVoice;
              u.lang = 'en-GB'; u.rate = 0.96; u.volume = 0.9;
              speechSynthesis.speak(u);
            } else {
              if(voiceStatus) voiceStatus.innerHTML = '&#9888;&#65039; NO UK VOICE FOUND ON THIS DEVICE';
            }
          });
        } else {
          if(voiceIcon) voiceIcon.innerHTML = '&#127908;';
          if(voiceLabel) voiceLabel.textContent = 'Voice off';
          if(voiceBtn) voiceBtn.classList.remove('toggle-on');
          if(voiceStatus) voiceStatus.style.display = 'none';
          cancelSpeech();
        }
      }

      if(prevBtn) {
        prevBtn.replaceWith(prevBtn.cloneNode(true));
        g('prev')?.addEventListener('click', function () { if (current > 0) jumpTo(current - 1, true); });
      }
      if(nextBtn) {
        nextBtn.replaceWith(nextBtn.cloneNode(true));
        g('next')?.addEventListener('click', function () { if (current < scenes.length - 1) jumpTo(current + 1, true); else if (current === -1) jumpTo(0, true); });
      }
      if(playBtn) {
        playBtn.replaceWith(playBtn.cloneNode(true));
        g('play')?.addEventListener('click', togglePlay);
      }
      if(soundBtn) {
        soundBtn.replaceWith(soundBtn.cloneNode(true));
        g('sound')?.addEventListener('click', toggleSound);
      }
      if(voiceBtn) {
        voiceBtn.replaceWith(voiceBtn.cloneNode(true));
        g('voice')?.addEventListener('click', toggleVoice);
      }

      hideAll();
      current = 0;
      showScene(0, false);
    }

    return { create: create };
  })();
}
