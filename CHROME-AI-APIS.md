# Chrome Built-in AI APIs — Research Findings

> Chrome 138+ ships real on-device AI. Here's what's available and how we use it.

---

## API Status Summary

| API | Chrome Version | Status | Free? |
|-----|----------------|--------|-------|
| **Prompt API** (navigator.ai.gemini) | Chrome 138 (Ext), Chrome 148 (Web) | Stable | ✅ Yes |
| **Translator API** (Translator) | Chrome 138 | Stable | ✅ Yes |
| **Language Detector API** (LanguageDetector) | Chrome 138 | Stable | ✅ Yes |
| **Summarizer API** (Summarizer) | Chrome 138 | Stable | ✅ Yes |
| **Writer API** (Writer) | Chrome 138+ | Developer Trial | TBD |
| **Rewriter API** (Rewriter) | Chrome 138+ | Developer Trial | TBD |
| **Proofreader API** (Proofreader) | Chrome 138+ | Developer Trial | TBD |

**Key insight**: The workhorse APIs (Translator, LanguageDetector, Summarizer) are all **stable in Chrome 138** and **free**. The writing assistance APIs (Writer, Rewriter, Proofreader) are still in developer trials.

---

## Prompt API (navigator.ai.gemini) — What We Already Use ✅

**Status**: Stable in Chrome 148+ (web), Chrome 138+ (extensions)

**API surface**:
```javascript
// Availability check
const { state } = await navigator.ai.gemini.availability();
// state: 'available' | 'downloading' | 'updating' | 'no-model' | 'unsupported'

// Create session
const session = await navigator.ai.gemini.create({ systemPrompt });

// Run inference
const result = await session.prompt("your query here");
const result = await session.prompt({ media: [imageBlob], text: "describe this" });
```

**Hardware requirements**:
- Windows 10+, macOS 13+, Linux, ChromeOS
- 22GB storage available
- 4GB VRAM GPU OR 16GB RAM (CPU fallback)

**We're using this already** in all 3 demos. It's the right call.

---

## Summarizer API — Stable in Chrome 138 ✅

**What it does**: Condenses long-form content into summaries, headlines, or key points.

**API**:
```javascript
const summarizer = await ai.summarizer.create({
  type: 'key-points',   // 'executive' | 'teaser' | 'key-points'
  length: 'medium',      // 'short' | 'medium' | 'long'
});

const summary = await summarizer.summarize(longText);
// Returns: { summary: string }
```

**Use cases for our fleet**:
- Summarize captain deliberation output for the "while you were away" briefing
- Summarize PLATO tile history for Casey when he returns from being dark
- Generate one-line summaries for the Murmur insights feed

**Why it matters**: The briefing tile's `answer` field is currently hand-written by the system. With Summarizer, we can auto-generate summaries of the captain's reasoning for briefings.

---

## Translator API — Stable in Chrome 138 ✅

**What it does**: On-device translation of text.

**API**:
```javascript
const translator = await ai.translator.create({
  sourceLanguage: 'en',
  targetLanguage: 'es',
});

const result = await translator.translate("Hello, world.");
```

**Use cases for our fleet**:
- PLATO tile translation: fleet is multilingual, agents in different languages
- Casey's Telegram messages could be auto-translated if he switches languages
- Fleet docs in multiple languages

**Limitation**: You need to specify source AND target language. Use LanguageDetector first.

---

## Language Detector API — Stable in Chrome 138 ✅

**What it does**: Detects the language of input text.

**API**:
```javascript
const detector = await ai.languageDetector.create();

const result = await detector.detect("Bonjour, monde.");
// Returns: { detectedLanguage: 'fr', confidence: 0.97 }
```

**Use cases for our fleet**:
- Detect Casey's language from Telegram messages → respond in same language
- Detect language of incoming PLATO tiles → route to appropriate specialist
- Multi-language support for the fleet docs

**Combined with Translator**:
```javascript
const [detection] = await detector.detect(userText);
const translator = await ai.translator.create({
  sourceLanguage: detection.detectedLanguage,
  targetLanguage: 'en',
});
const translated = await translator.translate(userText);
```

---

## Writer API + Rewriter API — Developer Trial ⚠️

**Status**: Both in origin trial (not yet stable)

**Writer API**:
```javascript
const writer = await ai.writer.create({
  sharedContext: 'User is a fisherman managing a fleet of boats.',
});

const result = await writer.write({
  task: 'Write a briefing for the captain about trust convergence.',
});
// Returns: { content: string }
```

**Rewriter API**:
```javascript
const rewriter = await ai.rewriter.create({
  sharedContext: 'User is a fisherman managing a fleet of boats.',
});

const result = await rewriter.rewrite("The fleet is rigid.", {
  tone: 'formal',       // 'ashy' | 'casual' | 'formal' | 'long' | 'short'
  format: 'plain-text', // 'plain-text' | 'markdown'
});
```

**Use cases for our fleet**:
- **fleet-murmur**: Use Writer API to produce polished insights instead of raw rule-based output
- **fleet-spread**: Use Rewriter API to rewrite captain deliberation in Casey's preferred tone
- **Ambient briefings**: Use Writer API to generate "while you were away" briefings

**When to use**: Not yet. Track [chromestatus.com](https://chromestatus.com/feature/4712595362414592) for stable release. Could be 3-6 months.

---

## Proofreader API — Developer Trial ⚠️

**What it does**: Grammar, spelling, style corrections.

```javascript
const proofreader = await ai.proofreader.create();

const result = await proofreader.proofread("Their going to the dock tommorow.");
// Returns: { content: 'They're going to the dock tomorrow.', corrections: [...] }
```

**Use cases for our fleet**: Polish murmur insights before submitting to PLATO quality gate.

---

## How We Use These — Implementation Priority

### Priority 1: Stable APIs, Use Now ✅

| API | Demo | Implementation |
|-----|------|----------------|
| **Prompt API** | All 3 demos | ✅ Already in use |
| **Summarizer API** | fleet-spread, ambient loop | Auto-summarize captain deliberations for briefings |
| **Translator API** | PLATO client | Multi-language tile support |
| **Language Detector** | All | Detect Casey's language, route responses |

### Priority 2: Track and Plan For ⚠️

| API | Watch for | Use case |
|-----|-----------|----------|
| **Writer API** | Stable release | Generate polished Murmur insights |
| **Rewriter API** | Stable release | Rewrite captain output in Casey's tone |
| **Proofreader API** | Stable release | Pre-quality-gate polishing |

### Code Example: Summarizer for Captain Briefing
```javascript
// In ambient loop or fleet-spread
async function summarizeDeliberation(deliberationSteps: string[]): Promise<string> {
  if (!navigator.ai?.summarizer) return deliberationSteps.join('\n');
  
  const summarizer = await navigator.ai.summarizer.create({
    type: 'key-points',
    length: 'short',
  });
  
  const fullText = deliberationSteps.map(s => s.text).join('. ');
  const { summary } = await summarizer.summarize(fullText);
  return summary;
}
```

### Code Example: Language Detection + Translation
```javascript
async function ensureEnglish(text: string): Promise<string> {
  const detector = await navigator.ai.languageDetector.create();
  const [result] = await detector.detect(text);
  
  if (result.detectedLanguage === 'en') return text;
  
  const translator = await navigator.ai.translator.create({
    sourceLanguage: result.detectedLanguage,
    targetLanguage: 'en',
  });
  
  const { output } = await translator.translate(text);
  return output;
}
```

---

## Hardware Reality Check

All these APIs run **on-device** with Gemini Nano:
- **No API costs** — free for users
- **No network latency** — local inference
- **Privacy-preserving** — data never leaves the device
- **Hardware varies**: most capable machines will use GPU, older machines use CPU

**Our fleet demos** work on any Chrome 148+ machine. Users with older hardware get the cloud fallback. The API gracefully degrades:
```javascript
if (navigator.ai?.gemini) {
  const { state } = await navigator.ai.gemini.availability();
  // state === 'available' → use local
  // state === 'no-model' → use cloud fallback
}
```

---

## Chrome Version Planning

| Chrome Version | What We Can Use |
|----------------|-----------------|
| Chrome 138 | Prompt API (Ext), Summarizer, Translator, LanguageDetector |
| Chrome 140+ | Prompt API (web), all stable above |
| Chrome 148+ | Prompt API stable web everywhere |

**Our demos should target Chrome 148+** for the Prompt API. But the Summarizer/Translator/LanguageDetector are in Chrome 138 — so we can use those in the PLATO web app upgrade even without the Prompt API.

---

## Sources

- [Chrome Built-in AI APIs](https://developer.chrome.com/docs/ai/built-in-apis) (official docs)
- [Prompt API Explainer](https://github.com/webmachinelearning/prompt-api)
- [Writing Assistance APIs](https://github.com/explainers-by-googlers/writing-assistance-apis/)
- [Translator + Language Detector on MDN](https://developer.mozilla.org/docs/Web/API/Translator_and_Language_Detector_APIs)
- [Summarizer API on MDN](https://developer.mozilla.org/docs/Web/API/Summarizer/)