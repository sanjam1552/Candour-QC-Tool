/* ==========================================================================
   VISIQC API CONNECTION LAYER & RETRY MECHANISMS
   ========================================================================== */

(function () {
  // Establish namespace
  window.VisiQC = window.VisiQC || {};

  // --- RETRY HELPER FOR TRANSIENT API ERRORS ---
  const fetchWithRetry = async (url, options = {}, maxRetries = 3, initialDelay = 1000) => {
    let retries = 0;
    while (true) {
      try {
        const response = await fetch(url, options);
        if (response.ok) {
          return response;
        }
        
        const shouldRetry = response.status === 503 || response.status === 504 || response.status === 429;
        if (shouldRetry && retries < maxRetries) {
          retries++;
          const delay = initialDelay * Math.pow(2, retries - 1) * (0.8 + Math.random() * 0.4);
          console.warn(`API returned status ${response.status}. Retrying in ${Math.round(delay)}ms... (Attempt ${retries} of ${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        return response;
      } catch (error) {
        if (retries < maxRetries) {
          retries++;
          const delay = initialDelay * Math.pow(2, retries - 1) * (0.8 + Math.random() * 0.4);
          console.warn(`Network error: ${error.message}. Retrying in ${Math.round(delay)}ms... (Attempt ${retries} of ${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  };

  // --- PROMPT CONSTRUCTOR ---
  function buildInspectionPrompt(platform, client, project, customInstructions) {
    let platformSpecificInstructions = '';
    
    switch (platform) {
      case 'instagram_post':
        platformSpecificInstructions = `* TARGET PLATFORM: Instagram Square Post (1:1 aspect ratio). Check:
- Aspect ratio compliance.
- Elements close to borders (safe zone margin check for feed feeds).
- Font size accessibility: ensure text is large and clear enough for mobile scrolling.
- Visual hook: is there a central focal point that grabs attention instantly?`;
        break;
      case 'instagram_story':
        platformSpecificInstructions = `* TARGET PLATFORM: Instagram Story / Reel (9:16 aspect ratio). Check:
- Strict margin check: upper 15% and lower 15% safe zones must remain completely free of logo, CTA, critical text, or icons (as UI overlay elements from Instagram will hide them).
- High visual momentum: check layout balance.
- Contrast against standard UI overlays.`;
        break;
      case 'linkedin_creative':
        platformSpecificInstructions = `* TARGET PLATFORM: LinkedIn Corporate Post/Ad. Check:
- Professional tone check.
- Clean grid structure: LinkedIn users appreciate highly professional structural consistency.
- Typography check: check that there aren't too many bold colors or conflicting decorative weights.`;
        break;
      case 'youtube_thumbnail':
        platformSpecificInstructions = `* TARGET PLATFORM: YouTube Video Thumbnail (16:9). Check:
- Lower Right Safe Zone: YouTube places a timestamps duration badge in the bottom-right corner. Validate that no important visual elements, logos, faces, or copy reside there.
- Extreme readability: will this be readable at 150px width on a mobile screen?
- Extreme contrast & visual click-through hook.`;
        break;
      case 'banner_ad':
        platformSpecificInstructions = `* TARGET PLATFORM: Digital Banner Ad. Check:
- Clear CTA presence: a button structure must be immediately obvious.
- Immediate readability under 2 seconds.
- Strong text-to-background contrast.
- Visual weight: ensure layout does not feel cramped or cluttered.`;
        break;
      case 'ui_screen':
        platformSpecificInstructions = `* TARGET PLATFORM: UI/UX App/Web Interface. Check:
- Interaction hierarchy: check button sizes, input margins.
- Visual tension and spacing inconsistencies (broken padding, misaligned elements).
- Color contrast: strict check of WCAG accessibility limits.
- Icon styles: check that icons belong to the same visual family (e.g. outline vs solid, matching stroke weights).`;
        break;
      case 'presentation_slide':
        platformSpecificInstructions = `* TARGET PLATFORM: Slide Deck / Presentation (16:9). Check:
- Margins: check for text bleeding close to the slide edge.
- Visual breathing room: slides should be at least 40% negative/empty space. Check for heavy paragraphs or visual clutter.
- Reading flow hierarchy: is the focal order header -> body -> details?`;
        break;
      case 'packaging':
        platformSpecificInstructions = `* TARGET PLATFORM: Product Packaging Design. Check:
- Margin buffers for folding.
- Legibility: critical specifications (ingredients, barcode areas, logos) must have extreme definition.
- Brand hierarchy visibility.`;
        break;
      case 'print_poster':
        platformSpecificInstructions = `* TARGET PLATFORM: Print Poster / Magazine Ad. Check:
- Margin buffers and cropping zones.
- Grid structures: do headings align with paragraph blocks?
- Reading distance readability.`;
        break;
      default:
        platformSpecificInstructions = `* TARGET PLATFORM: General Visual Creative. Check standard layout principles.`;
        break;
    }

    // Process Client Guidelines
    let clientGuidelinesText = '';
    if (client && client.id !== 'default_client') {
      clientGuidelinesText = `
* MANDATORY CLIENT BRAND BOOK COMPLIANCE (CRITICAL):
You must strictly audit the creative against these Client rules. Highlight any violations under section "5. Branding Consistency":
- Client Name: "${client.name}"
- General Guidelines: "${client.guidelines || 'None'}"`;

      if (client.colors && client.colors.length > 0) {
        const colorsList = client.colors.map(c => `- ${c.hex} (${c.name})`).join('\n');
        clientGuidelinesText += `\n- Brand Color Scheme (Confirm colors align with these values):\n${colorsList}`;
      }
      if (client.fonts && client.fonts.length > 0) {
        const fontsList = client.fonts.map(f => `- ${f.family} (Usage: ${f.usage})`).join('\n');
        clientGuidelinesText += `\n- Brand Fonts (Verify text uses these families or pairings):\n${fontsList}`;
      }
      if (client.logoRules) {
        clientGuidelinesText += `\n- Logo Rules: "${client.logoRules}"`;
      }
      if (client.ctaRules) {
        clientGuidelinesText += `\n- CTA Directives: "${client.ctaRules}"`;
      }
    }

    // Process Project Design Thinking
    let projectDirectivesText = '';
    if (project && project.id !== 'default_project') {
      projectDirectivesText = `
* PROJECT SCOPE & DESIGN THINKING CORE DIRECTIVES:
Verify if the design matches the conceptual inspiration, mood boards, or reading flows outlined below. Flag misalignment in section "7. Composition & Visual Hierarchy":
- Project Name: "${project.name}"
- Project Goal/Description: "${project.description || 'None'}"`;

      if (project.references && project.references.length > 0) {
        const refsList = project.references.map(r => `- Focus Idea: "${r.title}". Context: "${r.note}"`).join('\n');
        projectDirectivesText += `\n- Design Thinking Inspirations:\n${refsList}`;
      }
    }

    let globalInstructionsText = '';
    if (customInstructions) {
      globalInstructionsText = `
* ADDITIONAL CONSTRAINTS:
"${customInstructions}"`;
    }

    return `You are a world-class Creative Director, Senior Art Director, Brand Strategist, UX Reviewer, and Quality Control Specialist.
Analyze the attached visual creative asset carefully. Act as an "AI Pre-QC Layer" before client review. Be sharp, constructive, and highly technical. Avoid generic praise or polite boilerplate text like "looks good overall". Focus entirely on production-level polish and catching errors.

Identify alignment issues (visual weight, off-center details), spacing inconsistencies, typography issues (font pairings, readability, leading, kerning), color/contrast mismatches, platform specifications (margins, dimensions, safe zones), composition layout flow, copy spelling/grammar/punctuation/capitalization, and CTA clarity.

CRITICAL OCR & TEXT VERIFICATION WARNING:
Multimodal vision models sometimes hallucinate character-level spacing differences or minor case sensitivity errors in small footer elements (such as phone numbers, URLs, or addresses).
- DO NOT flag spacing errors (such as "extra space in phone numbers") or character-case discrepancies in small footer print unless you are 100% certain and the error is glaringly obvious.
- If you notice a phone number like "(972) 665-3888", do not flag it as having an "extra space" compared to "(972) 665-3888" unless it's genuinely broken.
- Avoid false-positive reports about small contact info.

${platformSpecificInstructions}
${clientGuidelinesText}
${projectDirectivesText}
${globalInstructionsText}

---

OUTPUT INSTRUCTIONS:
You must structure your response EXACTLY as the 5 categories below. Do not deviate from this format. Prefix each section exactly as shown. For bullet points, start them with a dash (-). If a section has absolutely no issues, write "No issues detected" or "None".

### 1. Critical Violations
(absolute must-fixes: spelling typos, wrong dimensions/formats, safe zone violations, broken elements, logo violations)

### 2. Visual Design & Spacing
(layout balance, spacing and alignment, optical off-center details, typography sizing/pairing, colors, contrast, composition flow)

### 3. Copy & Messaging
(copy checks, tone target review, tagline grammar/punctuation, CTA messaging clarity)

### 4. Suggested Action Plan
(concrete, prioritized step-by-step checklist of what the designer should do to fix the issues identified)

### 5. Overall QC Score
Provide a final readiness rating as a single fraction out of 10 (e.g. 7.5/10). Write nothing else in this section.`;
  }

  function buildTextInspectionPrompt(text, toneDesc, client, project, customInstructions) {
    let brandInstructions = '';
    if (client && client.id !== 'default_client') {
      brandInstructions = `
* MANDATORY CLIENT BRAND GUIDELINES:
Align the rewritten copy with these client guidelines strictly:
- Client Name: "${client.name}"
- General Guidelines: "${client.guidelines || 'None'}"`;

      if (client.ctaRules) {
        brandInstructions += `\n- CTA Messaging Directives: "${client.ctaRules}"`;
      }
    }

    let projectInstructions = '';
    if (project && project.id !== 'default_project') {
      projectInstructions = `
* PROJECT FOCUS CONTEXT:
Keep in mind the messaging objectives of this project:
- Project Goal: "${project.description || 'None'}"`;
    }
    
    let globalInstructionsText = '';
    if (customInstructions) {
      globalInstructionsText = `
* ADDITIONAL BRAND CONSTRAINTS:
"${customInstructions}"`;
    }
    
    return `You are an expert copywriter, proofreader, editor, and brand strategist.
Analyze the following source text carefully. Audit it for punctuation, grammar errors, spelling typos, inconsistent capitalization, clunky phrasing, and readability.

---
* SOURCE TEXT TO ANALYZE:
"${text}"
---

Then, rewrite it to align with the target tone below.

* TARGET TONE DIRECTIVE:
${toneDesc}
${brandInstructions}
${projectInstructions}
${globalInstructionsText}

---

OUTPUT INSTRUCTIONS:
You must structure your response EXACTLY as the 3 categories below. Do not deviate from this format. Prefix each section exactly as shown. For list items under section 2 and 3, use standard bullet points (start with a dash -).

### 1. Polished Copy
(Provide ONLY the final rewritten, polished version of the text. Do not put it in quotes, do not add headers, do not add intro/outro commentary, do not add explanations. This block will be copied directly by the user).

### 3. Grammar & Punctuation Changes
(Provide a brief bulleted list of specific corrections made. E.g., fixed spelling of X, added comma after Y, resolved run-on sentence. If no corrections were needed, write "None").

### 4. Tone, Pacing & Hook Critique
(Provide brief bulleted critique points explaining why the rewritten copy engages the reader better, how it improves visual pacing, and why it matches the requested tone).`;
  }

  function buildB2BResearchPrompt(topic, industry) {
    const industryContext = industry ? ` within the "${industry}" industry` : '';
    return `You are a world-class Marketing Strategist, Copywriter, Social Media Analyst, and Industry Trends Researcher.
Perform a deep-dive cross-channel market trend and content analysis on the topic: "${topic}"${industryContext}.
Use live Google Search grounding data to examine current discussions, trending topics, hashtags, post styles, copy formats, and traction-gaining formats from the current week/days. Do not output vague fads; provide real, actionable marketing value.

You must analyze this topic for four distinct communication channels:
1. LinkedIn (Professional thought leadership and B2B growth)
2. Meta (Facebook/Instagram - visual storytelling, video hooks, community ads)
3. X (Twitter - real-time news, threads, viral industry hooks)
4. Print Ads (Physical trade publications, billboards, magazines - static visual hierarchy and offline CTAs)

You must structure your response EXACTLY as the sections below, using the specific markdown markers [LINKEDIN_TRACTION], [LINKEDIN_FORMULAS], [LINKEDIN_KEYWORDS], [LINKEDIN_PLAN], [META_TRACTION], [META_FORMULAS], [META_KEYWORDS], [META_PLAN], [X_TRACTION], [X_FORMULAS], [X_KEYWORDS], [X_PLAN], [PRINT_TRACTION], [PRINT_FORMULAS], [PRINT_KEYWORDS], and [PRINT_PLAN]. Do not deviate from this format or wrap them in code blocks.

--- LINKEDIN ---
[LINKEDIN_TRACTION]
Provide a bulleted list (using "- ") of the most discussed and high-traction sub-topics, announcements, or trends related to "${topic}" on LinkedIn during the current week/days. For each point, provide a bold heading and a 1-2 sentence explanation of why it is gaining traction.

[LINKEDIN_FORMULAS]
Describe 2 specific post angles or structures currently driving high engagement (likes, comments) on LinkedIn for this topic. For each formula, specify:
1. The Core Angle
2. Hook Example (a strong opening line)
3. Text Blueprint (brief template outline of the middle and CTA)

[LINKEDIN_KEYWORDS]
Provide a bulleted list of 5-8 highly relevant keywords and hashtags currently trending on LinkedIn for "${topic}". Write them as a comma-separated list of hashtags or keywords. E.g., #IndianRailways, Modernization, #B2BLogistics, Infrastructure.

[LINKEDIN_PLAN]
Provide a bulleted list (using "- ") of 3 concrete B2B content strategy recommendations for LinkedIn this week.

--- META ---
[META_TRACTION]
Provide a bulleted list (using "- ") of high-traction visual styles, video styles, and topics related to "${topic}" currently trending on Facebook/Instagram.

[META_FORMULAS]
Describe 2 specific ad/post angles or video hook formulas driving high engagement on Facebook/Instagram. For each formula, specify:
1. The Core Angle (e.g. visual demonstration, UGC-style review)
2. Hook Example
3. Copy/Visual Blueprint (middle details and visual script outline)

[META_KEYWORDS]
Provide a bulleted list of 5-8 highly relevant keywords, hashtags, or interest targets currently trending on Meta for this topic. Write them as a comma-separated list.

[META_PLAN]
Provide a bulleted list (using "- ") of 3 concrete Facebook/Instagram ad/content strategy recommendations for this topic.

--- X (TWITTER) ---
[X_TRACTION]
Provide a bulleted list (using "- ") of high-traction real-time discussions, news updates, or debates related to "${topic}" currently trending on X.

[X_FORMULAS]
Describe 2 specific X tweet/thread angles or viral hooks driving high engagement. For each formula, specify:
1. The Core Angle (e.g. controversial opinion, data-backed thread)
2. Hook Example (the opening tweet/hook)
3. Text Blueprint (outline of subsequent thread points/tweets)

[X_KEYWORDS]
Provide a bulleted list of 5-8 highly relevant hashtags, keywords, or accounts currently trending on X for "${topic}". Write them as a comma-separated list.

[X_PLAN]
Provide a bulleted list (using "- ") of 3 concrete X-specific engagement/content strategy recommendations for this topic.

--- PRINT ADS ---
[PRINT_TRACTION]
Provide a bulleted list (using "- ") of successful themes, visual concepts, or print formats currently used in trade publications, billboards, or print ads for "${topic}".

[PRINT_FORMULAS]
Describe 2 print copy and layout concepts that stand out. For each, specify:
1. Visual Focal Point & Imagery Concept
2. Main Headline Hook (strong copy headline)
3. Body Copy & Offline CTA Blueprint

[PRINT_KEYWORDS]
Provide a bulleted list of 5-8 key themes, copy phrases, or visual design keywords crucial for print advertising on this topic. Write them as a comma-separated list.

[PRINT_PLAN]
Provide a bulleted list (using "- ") of 3 concrete print campaign strategy recommendations (e.g., target publications, visual layout advice, offline tracking).`;
  }

  // --- ACCESSORS ---
  window.VisiQC.Api = {
    fetchWithRetry,
    buildInspectionPrompt,
    buildTextInspectionPrompt,
    buildB2BResearchPrompt
  };

})();
