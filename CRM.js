(function(){
  // ===== Config / estado =====
  var APP = (window.apex && apex.env ? apex.env.APP_ID : '&APP_ID.');
  var KEY_ENABLED = 'apex_tts_enabled_' + APP;
  
  var state = { enabled:true, voice:null, rate:1, pitch:1 }; 

  // --- Configuración de SpeechRecognition ---
  window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var recognition = null;
  var isListening = false; 
  
  if (window.SpeechRecognition) {
      recognition = new SpeechRecognition();
      recognition.lang = 'es-ES';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
  } else {
      console.warn('SpeechRecognition (dictado) no es soportado por este navegador.');
  }
  // --- FIN Configuración ---

  function save(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function load(k,d){ try{ var v=localStorage.getItem(k); return (v===null?d:v); }catch(e){return d;} }

  // ===== Voz (TTS) =====
  function pickVoice(){
    var voices = window.speechSynthesis.getVoices();
    state.voice =
      voices.find(v => /es-ES/i.test(v.lang)) ||
      voices.find(v => /Español.*España/i.test(v.name)) ||
      voices.find(v => /^es-/i.test(v.lang)) ||
      voices[0];
  }
  window.speechSynthesis.onvoiceschanged = pickVoice; pickVoice();

  function speak(text){
    if(!state.enabled || !text) return;
    try{
      if (!state.voice) pickVoice(); 
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      if(state.voice) u.voice = state.voice;
      u.lang = 'es-ES';
      u.rate = state.rate; u.pitch = state.pitch;
      window.speechSynthesis.speak(u);
    }catch(e){}
  }
  
  function speakPageIntro(text){
    if(!state.enabled || !text) return;
    setTimeout(function() {
        speak(text);
    }, 1000); 
  }

  // ===== Utilidades UI/APEX =====
  function setButtonLabel(){
    var t = document.querySelector('#a11y-tts-toggle');
    var r = document.querySelector('#a11y-tts-readfield');
    var d = document.querySelector('#a11y-tts-dictate'); 

    if(t){
      var base = state.enabled ? 'Desactivar voz' : 'Activar voz';
      t.textContent = base + ' (Doble Shift)';
      t.setAttribute('type','button');
      t.setAttribute('aria-pressed', state.enabled ? 'true' : 'false');
      t.setAttribute('aria-keyshortcuts', 'Shift Shift');
      t.title = 'Atajo: Doble Shift';
    }
    if(r){
      r.textContent = 'Leer campo (Alt)';
      r.setAttribute('type','button');
      r.setAttribute('aria-keyshortcuts', 'Alt');
      r.title = 'Atajo: Alt';
    }
    
    if(d){
      d.textContent = 'Dictar (Mantener F2)';
      d.setAttribute('type','button');
      d.setAttribute('aria-keyshortcuts', 'F2');
      d.title = 'Mantenga F2 presionado para hablar';
      if (!recognition) d.style.display = 'none';
    }
  }

  // (Funciones labelFor, isEditable, isSensitive, getValue, getSelectedText - Sin cambios)
  function labelFor(el){
    if (el.matches('button, [role="button"], a, [class*="t-Button"]')) {
      let t = (el.innerText || '').trim();
      if (!t) {
        const spanLbl = el.querySelector('.t-Button-label');
        if (spanLbl) t = (spanLbl.innerText || '').trim();
      }
      if (!t) t = el.getAttribute('aria-label') || el.title || el.getAttribute('data-label') || '';
      return t || 'Botón';
    }
    let t = '';
    if (el.id) {
      const byFor = document.querySelector('label[for="'+el.id+'"]');
      if (byFor) t = (byFor.innerText || '').trim();
    }
    if (!t) t = el.getAttribute('aria-label') || el.title || el.placeholder || '';
    if (!t) {
      const cont = el.closest('.t-Form-fieldContainer, .t-Form-itemWrapper, .t-Form-fieldContainer--floatingLabel');
      if (cont) {
        const cLbl = cont.querySelector('.t-Form-label, label');
        if (cLbl) t = (cLbl.innerText || '').trim();
      }
    }
    return t || (el.type || el.tagName || 'control').toString().toLowerCase();
  }
  function isEditable(el){
    if(!el) return false;
    if(el.closest && el.closest('[contenteditable="false"]')) return false;
    var tag = (el.tagName||'').toLowerCase();
    var type = (el.type||'').toLowerCase();
    if(tag==='textarea') return true;
    if(tag==='input' && ['text','search','email','url','tel','number','password','date','datetime-local','time'].includes(type)) return true;
    if(el.isContentEditable) return true;
    return false;
  }
  function isSensitive(el){ return (el && (el.type||'').toLowerCase()==='password'); }
  function getValue(el){
    if (el && el.value != null) return el.value;
    if (el && el.isContentEditable) return el.innerText || '';
    return '';
  }
  function getSelectedText(el){
    if (el && typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
      var s = el.selectionStart, e = el.selectionEnd;
      if (e> s) return (el.value || '').slice(s,e);
      return '';
    }
    var sel = window.getSelection && window.getSelection();
    if (sel && sel.rangeCount) return (sel.toString() || '').trim();
    return '';
  }

  // (Funciones onFocus, speakMap, diffSpeak, readCurrentField - Sin cambios)
  function onFocus(e){
    var el = e.target;
    if(!(el instanceof HTMLElement)) return;
    var name = labelFor(el);
    var msg  = name;
    if (isEditable(el) && !isSensitive(el)) {
      var val = getValue(el);
      if (val) msg += '. Contenido: ' + val;
    }
    if (el.required) msg += '. obligatorio';
    if (el.getAttribute && el.getAttribute('aria-invalid') === 'true') msg += '. con error';
    speak(msg);
  }
  var speakMap = {
    ' ': 'espacio', '.': 'punto', ',': 'coma', ';': 'punto y coma', ':': 'dos puntos',
    '-': 'guion', '_': 'guion bajo', '/': 'barra', '\\': 'barra invertida',
    '@': 'arroba', '#': 'numeral', '$': 'signo de dólar', '%': 'por ciento',
    '&': 'ampersand', '*': 'asterisco', '+': 'más', '=': 'igual',
    '"': 'comillas', '\'': 'comilla', '¿': 'apertura de pregunta',
    '?': 'pregunta', '¡': 'apertura de exclamación', '!': 'exclamación',
    '(': 'paréntesis', ')': 'paréntesis', '[': 'corchete', ']': 'corchete',
    '{': 'llave', '}': 'llave'
  };
  var lastValue = new WeakMap();
  function diffSpeak(prev, curr){
    if(prev===curr) return;
    if(curr.length+1===prev.length && prev.startsWith(curr)){ speak('borrar'); return; }
    if(curr.length===prev.length+1 && curr.startsWith(prev)){
      var ch = curr.slice(-1);
      speak(speakMap[ch] || ch);
      return;
    }
  }
  function readCurrentField(){
    var el = document.activeElement;
    if(!isEditable(el)) { speak('No hay un campo editable seleccionado.'); return; }
    if(isSensitive(el)) { speak('Campo protegido.'); return; }
    var sel = getSelectedText(el);
    if (sel) { speak('Seleccionado: ' + sel); return; }
    var val = getValue(el);
    speak(val ? ('Contenido: ' + val) : 'Campo vacío.');
  }

  // --- MANEJADORES DE DICTADO ---
  if (recognition) {
    
    // --- ¡AQUÍ ESTÁ EL PARCHE PARA RUT! ---
    recognition.onresult = (event) => {
        var transcript = event.results[0][0].transcript;
        transcript = transcript.trim();
        
        // Parche para el punto de Edge
        if (transcript.endsWith('.')) {
          transcript = transcript.substring(0, transcript.length - 1);
        }

        // --- INICIO DEL NUEVO PARCHE (RUT/NÚMEROS) ---
        // 1. Crea una versión sin espacios
        var transcript_no_spaces = transcript.replace(/\s/g, '');
        
        // 2. Comprueba si la versión sin espacios es un número puro
        //    (Regex: /^[0-9]+$/ significa "solo dígitos de principio a fin")
        if (/^[0-9]+$/.test(transcript_no_spaces)) {
            // Si el texto dictado eran solo números y espacios (ej: "20961 436"),
            // usamos la versión SIN espacios (ej: "20961436").
            transcript = transcript_no_spaces;
        }
        // Si eran letras (ej: "Juan Pérez") o mixto (ej: "Calle Falsa 123"),
        // este 'if' no se cumple y se usa el 'transcript' original.
        // --- FIN DEL NUEVO PARCHE ---

        var el = document.activeElement;
        
        if (isEditable(el) && !isSensitive(el)) {
            var start = el.selectionStart;
            var end = el.selectionEnd;
            var text = el.value || '';
            el.value = text.substring(0, start) + transcript + text.substring(end);
            el.selectionStart = el.selectionEnd = start + transcript.length;
            el.focus();
            speak(transcript);
        }
    };
    // --- FIN DE LA SECCIÓN MODIFICADA ---

    recognition.onerror = (event) => {
        if (event.error === 'no-speech') {
            speak('No se detectó voz.');
        } else if (event.error === 'not-allowed') {
            speak('Permiso de micrófono denegado.');
            var d_btn = document.querySelector('#a11y-tts-dictate');
            if (d_btn) d_btn.disabled = true;
        } else {
            console.error('Error de reconocimiento:', event.error);
            speak('Error de dictado.');
        }
        isListening = false;
    };
    
    recognition.onend = () => {
        isListening = false;
    };
  }
  // --- FIN MANEJADORES DICTADO ---


  // (Funciones enable, disable, toggle - Sin cambios)
  function enable(){ 
    state.enabled = true; 
    save(KEY_ENABLED,'1'); 
    setButtonLabel(); 
    speak('Voz activada.'); 
  }
  function disable(){ 
    state.enabled = false; 
    save(KEY_ENABLED,'0'); 
    setButtonLabel(); 
    window.speechSynthesis.cancel(); 
    var u = new SpeechSynthesisUtterance('Modo de navegación normal.');
    if(state.voice) u.voice = state.voice; u.lang = 'es-ES';
    window.speechSynthesis.speak(u);
  }
  function toggle(){ state.enabled ? disable() : enable(); }

  // ===== Listeners base =====
  document.addEventListener('focusin', onFocus, true); 
  document.addEventListener('input', function(e){
    if(!state.enabled) return;
    var el = e.target;
    if(!isEditable(el) || isSensitive(el)) return;
    var prev = lastValue.get(el) || '';
    var curr = getValue(el);
    lastValue.set(el, curr);
    diffSpeak(prev, curr); 
  }, true);

  // (Listener 'click' - Sin cambios)
  document.addEventListener('click', function(ev){
    var b1 = ev.target.closest('#a11y-tts-toggle');
    if(b1){ ev.preventDefault(); ev.stopPropagation(); toggle(); return; }
    var b2 = ev.target.closest('#a11y-tts-readfield'); 
    if(b2){ ev.preventDefault(); ev.stopPropagation(); readCurrentField(); return; }
  }, true);

  // ===== Listener de Atajos y TRAMPA DE FOCO =====
  var lastShiftTime = 0;
  
  // (Listener 'keydown' - Sin cambios)
  document.addEventListener('keydown', function(ev){
    if (!state.enabled) return;
    var k = (ev.key || '').toLowerCase();

    if (k === 'escape') {
      ev.preventDefault();
      ev.stopPropagation();
      disable(); 
      return;
    }
    if (k === 'alt' && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) {
      ev.preventDefault(); ev.stopPropagation();
      readCurrentField();
      return;
    }
    if (k === 'f2') {
        ev.preventDefault();
        ev.stopPropagation();
        if (isListening || !recognition) return; 
        var el = document.activeElement;
        if (!isEditable(el) || isSensitive(el)) {
            speak('No hay un campo para dictar.');
            return;
        }
        try {
            recognition.start();
            isListening = true;
            speak('Escuchando...');
        } catch(e) {
            console.error(e);
            isListening = false;
        }
        return;
    }
    if (k === 'tab') {
      var selector = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
      var focusables = Array.from(document.querySelectorAll(selector)).filter(
        el => el.offsetParent !== null 
      );
      if (focusables.length === 0) return; 
      var firstFocusable = focusables[0];
      var lastFocusable = focusables[focusables.length - 1];
      var currentFocus = document.activeElement;
      if (ev.shiftKey) { 
        if (currentFocus === firstFocusable) {
          ev.preventDefault();
          lastFocusable.focus();
        }
      } else { 
        if (currentFocus === lastFocusable) {
          ev.preventDefault();
          firstFocusable.focus();
        }
      }
    } 
  }, true); 

  // (Listener 'keyup' - Sin cambios)
  document.addEventListener('keyup', function(ev){
    var k = (ev.key || '').toLowerCase();
    
    if (k === 'f2') {
        ev.preventDefault();
        ev.stopPropagation();
        if (isListening && recognition) {
            recognition.stop();
            isListening = false;
        }
        return;
    }
    if (k !== 'shift') return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    
    var now = Date.now();
    if (now - lastShiftTime < 600) { 
      ev.preventDefault(); ev.stopPropagation();
      toggle(); 
      lastShiftTime = 0;
    } else {
      lastShiftTime = now;
    }
  }, true);

  // (Inicialización - Sin cambios)
  document.addEventListener('apexready', function(){
    var stored = load(KEY_ENABLED, '1'); 
    state.enabled = stored === '1';
    if (stored === null) { 
      save(KEY_ENABLED, '1'); 
    }
    setButtonLabel();
  });
  if (document.readyState !== 'loading') setButtonLabel();
  else document.addEventListener('DOMContentLoaded', setButtonLabel);
  document.addEventListener('click', function once(){
    var want = load(KEY_ENABLED,'1')==='1';
    if(want && !state.enabled){ enable(); } 
    document.removeEventListener('click', once, false);
  }, false);

  // (Exponer (debug) - Sin cambios)
  window.A11Y_TTS = { 
    enable, 
    disable, 
    speak, 
    toggle, 
    readCurrentField,
    speakPageIntro
  };
})();
