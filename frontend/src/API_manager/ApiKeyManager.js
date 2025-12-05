import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import LLMDetailsTable from "./LLMDetailsTable";
import "./ApiKeyManager.css";

// Provider categories and labels (matching LLM_DETAILS table structure)
const providersByCategory = {
  "TEXT-TO-TEXT": [
    { value: "GROQ", label: "Groq", description: "Fastest inference speeds available", tier: "Freemium", speed: "Ultra Fast", type: "TEXT-TO-TEXT" },
    { value: "OPENROUTER", label: "OpenRouter", description: "Aggregates multiple providers", tier: "Freemium", speed: "Variable", type: "TEXT-TO-TEXT" },
    { value: "HUGGINGFACE", label: "Hugging Face", description: "Open source models", tier: "Free", speed: "Variable", type: "TEXT-TO-TEXT" },
    { value: "DEEPSEEK", label: "DeepSeek", description: "Strong coding and math", tier: "Freemium", speed: "Fast", type: "TEXT-TO-TEXT" },
    { value: "MISTRAL", label: "Mistral AI", description: "High quality open weights", tier: "Freemium", speed: "Fast", type: "TEXT-TO-TEXT" },
    { value: "GPT2", label: "GPT-2", description: "Classic language model", tier: "Free", speed: "Fast", type: "TEXT-TO-TEXT" },
    { value: "LLAMA3.2", label: "Llama 3.2", description: "Meta's latest model", tier: "Free", speed: "Fast", type: "TEXT-TO-TEXT" },
    { value: "TOGETHER", label: "Together AI", description: "Multiple open models", tier: "Freemium", speed: "Fast", type: "TEXT-TO-TEXT" },
    { value: "CLAUDE", label: "Anthropic Claude", description: "Helpful, harmless, honest AI", tier: "Premium", speed: "Fast", type: "TEXT-TO-TEXT" },
    { value: "OPENAI_GPT4", label: "OpenAI GPT-4", description: "Most capable language model", tier: "Premium", speed: "Medium", type: "TEXT-TO-TEXT" },
    { value: "GEMINI", label: "Google Gemini", description: "Google's multimodal AI", tier: "Freemium", speed: "Fast", type: "TEXT-TO-TEXT" },
    { value: "OLLAMA", label: "Ollama", description: "Run models locally", tier: "Free", speed: "Variable", type: "TEXT-TO-TEXT" },
    { value: "COHERE", label: "Cohere", description: "Enterprise AI platform", tier: "Premium", speed: "Fast", type: "TEXT-TO-TEXT" },
    { value: "TOGETHER_AI", label: "Together AI Platform", description: "Inference platform", tier: "Premium", speed: "Fast", type: "TEXT-TO-TEXT" },
    { value: "REPLICATE", label: "Replicate", description: "Run ML models in the cloud", tier: "Pay-per-use", speed: "Variable", type: "TEXT-TO-TEXT" }
  ],
  "TEXT-TO-IMAGE": [
    { value: "HUGGINGFACE-TEXTTOIMAGE", label: "Hugging Face T2I", description: "Open source image generation", tier: "Free", speed: "Medium", type: "TEXT-TO-IMAGE" },
    { value: "GEMINI-2.0-FLASH-EXP-TEXTTOIMAGE", label: "Gemini 2.0 Flash", description: "Google's image model", tier: "Premium", speed: "Fast", type: "TEXT-TO-IMAGE" },
    { value: "OPENAI_DALLE3", label: "DALL-E 3", description: "Best for photorealistic & detailed art", tier: "Premium", speed: "Slow", type: "TEXT-TO-IMAGE" },
    { value: "MIDJOURNEY", label: "Midjourney", description: "Best for artistic & creative generations", tier: "Premium", speed: "Medium", type: "TEXT-TO-IMAGE" },
    { value: "ADOBE_FIREFLY", label: "Adobe Firefly", description: "Best for design & marketing", tier: "Premium", speed: "Medium", type: "TEXT-TO-IMAGE" },
    { value: "STABILITY_AI", label: "Stability AI", description: "Versatile, all styles", tier: "Premium", speed: "Fast", type: "TEXT-TO-IMAGE" },
    { value: "LEONARDO_AI", label: "Leonardo AI", description: "Professional generations", tier: "Freemium", speed: "Fast", type: "TEXT-TO-IMAGE" },
    { value: "FLUX_AI", label: "Flux AI", description: "Free tier, 50 daily credits", tier: "Free", speed: "Fast", type: "TEXT-TO-IMAGE" },
    { value: "IDEOGRAM", label: "Ideogram", description: "Best for text in images", tier: "Free", speed: "Medium", type: "TEXT-TO-IMAGE" },
    { value: "STABLE_DIFFUSION", label: "Stable Diffusion", description: "Open source image generation", tier: "Free", speed: "Fast", type: "TEXT-TO-IMAGE" },
    { value: "DREAMSTUDIO", label: "DreamStudio", description: "Stability AI's web platform", tier: "Premium", speed: "Fast", type: "TEXT-TO-IMAGE" },
    { value: "RUNWAY_ML", label: "Runway ML", description: "Creative AI platform", tier: "Premium", speed: "Medium", type: "TEXT-TO-IMAGE" },
    { value: "TOGETHER_STABLE_DIFFUSION", label: "Together Stable Diffusion", description: "Hosted Stable Diffusion", tier: "Pay-per-use", speed: "Fast", type: "TEXT-TO-IMAGE" },
    { value: "KANDINSKY", label: "Kandinsky", description: "Sber AI image generator", tier: "Free", speed: "Medium", type: "TEXT-TO-IMAGE" }
  ],
  "IMAGE-TO-TEXT": [
    { value: "OPENAI_GPT4V", label: "OpenAI GPT-4V", description: "Best overall vision model", tier: "Premium", speed: "Medium", type: "IMAGE-TO-TEXT" },
    { value: "GEMINI_PRO_VISION", label: "Google Gemini Pro Vision", description: "Google's multimodal model", tier: "Premium", speed: "Fast", type: "IMAGE-TO-TEXT" },
    { value: "CLAUDE_3_OPUS", label: "Anthropic Claude 3 Opus", description: "High-accuracy vision model", tier: "Premium", speed: "Medium", type: "IMAGE-TO-TEXT" },
    { value: "LLAVA_13B", label: "LLaVA-13B", description: "Open-source vision model", tier: "Free", speed: "Slow", type: "IMAGE-TO-TEXT" },
    { value: "MINIGPT4", label: "MiniGPT-4", description: "Lightweight vision model", tier: "Free", speed: "Medium", type: "IMAGE-TO-TEXT" },
    { value: "INSTRUCTBLIP", label: "InstructBLIP", description: "Instruction-tuned vision model", tier: "Free", speed: "Fast", type: "IMAGE-TO-TEXT" },
    { value: "PHI3_VISION", label: "Phi-3 Vision", description: "Microsoft's small vision model", tier: "Freemium", speed: "Fast", type: "IMAGE-TO-TEXT" }
  ],
  "TEXT-TO-MUSIC": [
    { value: "SUNO_AI", label: "Suno AI", description: "Best AI song generator with lyrics", tier: "Freemium", speed: "Medium", type: "TEXT-TO-MUSIC" },
    { value: "UDIO", label: "Udio", description: "High-quality music generation", tier: "Premium", speed: "Medium", type: "TEXT-TO-MUSIC" },
    { value: "MUSICGEN_META", label: "MusicGen (Meta)", description: "Open-source music generation", tier: "Free", speed: "Fast", type: "TEXT-TO-MUSIC" },
    { value: "AIVA", label: "AIVA", description: "AI composer for classical music", tier: "Freemium", speed: "Medium", type: "TEXT-TO-MUSIC" },
    { value: "MUBERT", label: "Mubert AI", description: "Royalty-free background music", tier: "Freemium", speed: "Fast", type: "TEXT-TO-MUSIC" },
    { value: "SOUNDRAW", label: "Soundraw", description: "Customizable music tracks", tier: "Premium", speed: "Fast", type: "TEXT-TO-MUSIC" }
  ],
  "TEXT-TO-SPEECH": [
    { value: "PLAYHT", label: "PlayHT", description: "High-quality text-to-speech", tier: "Freemium", speed: "Fast", type: "TEXT-TO-SPEECH" },
    { value: "AMAZON_POLLY", label: "Amazon Polly", description: "AWS text-to-speech service", tier: "Pay-per-use", speed: "Fast", type: "TEXT-TO-SPEECH" },
    { value: "GOOGLE_TTS", label: "Google TTS", description: "Google's text-to-speech", tier: "Freemium", speed: "Fast", type: "TEXT-TO-SPEECH" },
    { value: "IBM_WATSON", label: "IBM Watson TTS", description: "Enterprise-grade TTS", tier: "Premium", speed: "Medium", type: "TEXT-TO-SPEECH" },
    { value: "MURF_AI", label: "Murf AI", description: "Professional voice overs", tier: "Freemium", speed: "Fast", type: "TEXT-TO-SPEECH" },
    { value: "WELLSAID", label: "Wellsaid Labs", description: "Professional voice synthesis", tier: "Premium", speed: "Medium", type: "TEXT-TO-SPEECH" }
  ],
  "TEXT-TO-VIDEO": [
    { value: "RUNWAY_GEN4", label: "Runway Gen-4", description: "Best overall video generator", tier: "Premium", speed: "Medium", type: "TEXT-TO-VIDEO" },
    { value: "OPENAI_SORA", label: "OpenAI Sora", description: "Complex scene generation", tier: "Premium", speed: "Slow", type: "TEXT-TO-VIDEO" },
    { value: "GOOGLE_VEO2", label: "Google Veo 2", description: "Google's video AI model", tier: "Premium", speed: "Medium", type: "TEXT-TO-VIDEO" },
    { value: "PIKA_2_2", label: "Pika 2.2", description: "User-friendly video generation", tier: "Freemium", speed: "Fast", type: "TEXT-TO-VIDEO" },
    { value: "KLING_AI_2", label: "Kling AI 2.0", description: "High-quality video synthesis", tier: "Freemium", speed: "Medium", type: "TEXT-TO-VIDEO" },
    { value: "HAILUO_AI", label: "Hailuo AI", description: "Best free video generator", tier: "Free", speed: "Fast", type: "TEXT-TO-VIDEO" },
    { value: "WAN2_2", label: "Alibaba Wan2.2", description: "Open-source video generation", tier: "Free", speed: "Fast", type: "TEXT-TO-VIDEO" }
  ]
};

// note: ancillary label/icon maps removed to satisfy no-unused-vars

const STORAGE_KEYS = {
  USER_ID: 'llm_user_id',
  FIRM_ID: 'llm_firm_id',
  ACTIVE_PROVIDER: 'llm_active_provider'
};

// Map UI category names to DB enum values for LLM_DETAILS table
const CATEGORY_DB_MAP = {
  LANGUAGE_TEXT: 'TEXT-TO-TEXT',
  IMAGE_GENERATION: 'TEXT-TO-IMAGE', 
  CAPTION_GENERATION: 'IMAGE-TO-TEXT',
  MUSIC_GENERATION: 'TEXT-TO-MUSIC',
  VOICE_SYNTHESIS: 'TEXT-TO-SPEECH',
  VIDEO_GENERATION: 'TEXT-TO-VIDEO'
};

const ApiKeyManager = ({
  onProviderSelect, 
  onClose, 
  currentUserId, 
  currentFirmId,
  apiBaseUrl = "http://localhost:8000" 
}) => {
  const HARD_USER_ID = 1481;
  const HARD_FIRM_ID = 2;
  // State is now hardcoded to HARD_USER_ID and HARD_FIRM_ID

  const [apiKey, setApiKey] = useState("");
  const [userId, setUserId] = useState(HARD_USER_ID);
  const [firmId, setFirmId] = useState(HARD_FIRM_ID);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [llmProvider, setLlmProvider] = useState("");
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [llmDetails, setLlmDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Persist userId and firmId to localStorage when they change
  // IDs are hardcoded; no persistence needed

  // Update local state when props change (only if not already set from localStorage)
  // Ignore incoming props for IDs; always use hardcoded values
  useEffect(() => {
    setUserId(HARD_USER_ID);
    setFirmId(HARD_FIRM_ID);
  }, []);

  const fetchLLMDetails = useCallback(async () => {
    if (!HARD_USER_ID || !HARD_FIRM_ID) {
      setError("User ID and Firm ID are required.");
      return;
    }
    
    // Clear any previous errors and messages
    setError(null);
    setMessage(null);
    
    try {
      setLoading(true);
      setError(null);
      
      console.log(`📡 Fetching LLM details for User: ${userId}, Firm: ${firmId}`);
      const response = await axios.get(`${apiBaseUrl}/llm-details`, {
        params: { userid: HARD_USER_ID, firmid: HARD_FIRM_ID },
        timeout: 10000
      });
      
      setLlmDetails(response.data || []);
      console.log(`✅ Found ${response.data?.length || 0} LLM provider records`);
      
    } catch (err) {
      console.error("❌ Error fetching LLM details:", err);
      
      let errorMessage = "Failed to fetch provider data.";
      if (err.code === 'ECONNABORTED') {
        errorMessage = "Request timed out. Please check your connection.";
      } else if (err.response?.status === 404) {
        errorMessage = "API endpoint not found. Please check server configuration.";
      } else if (err.response?.status >= 500) {
        errorMessage = "Server error. Please try again later.";
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [userId, firmId, apiBaseUrl]);

  useEffect(() => {
    fetchLLMDetails();
  }, [fetchLLMDetails]);

  const handleActivate = (provider, contextUserId, contextFirmId) => {
    const effectiveUserId = HARD_USER_ID;
    const effectiveFirmId = HARD_FIRM_ID;
    
    console.log(`🔧 Activating provider: ${provider} for User: ${effectiveUserId}, Firm: ${effectiveFirmId}`);
    
    if (onProviderSelect) {
      onProviderSelect(provider, effectiveUserId, effectiveFirmId);
    }
    
    setMessage(`✅ Provider ${provider} activated successfully for User ${effectiveUserId}, Firm ${effectiveFirmId}!`);
    setTimeout(() => setMessage(null), 4000);
  };

  // note: removed unused validateInputs to satisfy no-unused-vars

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!apiKey || !selectedCategory || !llmProvider) {
      setError("All fields are required.");
      return;
    }
    
    // Validate the provider is valid for the selected category
    const selectedProvider = providersByCategory[selectedCategory]?.find(p => p.value === llmProvider);
    if (!selectedProvider) {
      setError("Invalid provider selected for this category.");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    setMessage(null);
    
    // Store the active provider for this user/firm
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PROVIDER, JSON.stringify({
      userId: HARD_USER_ID,
      firmId: HARD_FIRM_ID,
      provider: llmProvider,
      category: selectedCategory,
      timestamp: new Date().toISOString()
    }));

    try {
      console.log(`📝 Submitting API key for Category: ${selectedCategory}, Provider: ${llmProvider}, User: ${HARD_USER_ID}, Firm: ${HARD_FIRM_ID}`);
      
      const response = await axios.post(`${apiBaseUrl}/add-api-key`, {
        USERID: HARD_USER_ID,
        FIRMID: HARD_FIRM_ID,
        LLM_PROVIDER_TYPE: CATEGORY_DB_MAP[selectedCategory] || selectedCategory,
        LLM_PROVIDER: llmProvider,
        API_KEY: apiKey.trim(),
      }, {
        timeout: 15000
      });

      console.log("✅ API Key submission successful:", response.data);
      
      setMessage("✅ API Key added and activated successfully!");
      setError(null);
      setApiKey("");
      setLlmProvider("");

      // Refresh the table and activate the provider
      await fetchLLMDetails();
      handleActivate(llmProvider, userId, firmId);

      setTimeout(() => setMessage(null), 4000);
      
    } catch (err) {
      console.error("❌ Error adding API key:", err);
      
      let errorMessage = "Failed to add API Key.";
      if (err.code === 'ECONNABORTED') {
        errorMessage = "Request timed out. Please try again.";
      } else if (err.response?.status === 400) {
        errorMessage = err.response.data?.message || "Invalid input data.";
      } else if (err.response?.status === 500) {
        errorMessage = "Server error. Please try again later.";
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      }
      
      setError(errorMessage);
      setMessage(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Firm/User IDs are fixed; no input handlers needed

  const clearError = () => setError(null);
  const clearMessage = () => setMessage(null);

  return (
    <div className="apikey-modal-overlay">
      <div className="apikey-modal-container">
        <div className="apikey-modal-header">
          <h2>🔧 AI Provider Configuration</h2>
          <button 
            className="apikey-modal-close" 
            onClick={onClose}
            aria-label="Close modal"
            disabled={isSubmitting}
          >
            ×
          </button>
        </div>

        {/* Status Messages */}
        {error && (
          <div style={{
            background: '#fef2f2',
            color: '#991b1b',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '1px solid #fecaca',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>❌ {error}</span>
            <button 
              onClick={clearError}
              style={{
                background: 'none',
                border: 'none',
                color: '#991b1b',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0 4px'
              }}
            >
              ×
            </button>
          </div>
        )}
        
        {message && (
          <div style={{
            background: '#f0fdf4',
            color: '#166534',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            border: '1px solid #bbf7d0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{message}</span>
            <button 
              onClick={clearMessage}
              style={{
                background: 'none',
                border: 'none',
                color: '#166534',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0 4px'
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Add API Key Form */}
        <form className="apikey-form" onSubmit={handleSubmit}>

          <div>
            <label htmlFor="category">
              Category <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              id="category"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              required
              disabled={isSubmitting}
              style={{
                padding: '12px 16px',
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '14px',
                width: '100%',
                marginBottom: '16px',
                backgroundColor: 'white'
              }}
            >
              <option value="">Select a category</option>
              <option value="TEXT-TO-IMAGE">🖼️ Image Generation</option>
              <option value="IMAGE-TO-TEXT">📝 Caption Generation</option>
              <option value="TEXT-TO-TEXT">💬 Language & Text</option>
              <option value="TEXT-TO-MUSIC">🎵 Music Generation</option>
              <option value="TEXT-TO-SPEECH">🎤 Voice & Speech</option>
              <option value="TEXT-TO-VIDEO">🎬 Video Generation</option>
            </select>

            <label htmlFor="llmProvider">
              LLM Provider <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              id="llmProvider"
              value={llmProvider}
              onChange={(e) => setLlmProvider(e.target.value)}
              required
              disabled={isSubmitting || !selectedCategory}
              style={{
                padding: '12px 16px',
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '14px',
                width: '100%',
                backgroundColor: 'white'
              }}
            >
              <option value="">Select LLM Provider</option>
              {selectedCategory && providersByCategory[selectedCategory]
                .filter(provider => {
                  // Filter by type based on category
                  if (selectedCategory === 'TEXT-TO-IMAGE') {
                    return provider.type === 'TEXT-TO-IMAGE';
                  } else if (selectedCategory === 'IMAGE-TO-TEXT') {
                    return provider.type === 'IMAGE-TO-TEXT';
                  } else if (selectedCategory === 'TEXT-TO-TEXT') {
                    return provider.type === 'TEXT-TO-TEXT';
                  } else if (selectedCategory === 'TEXT-TO-MUSIC') {
                    return provider.type === 'TEXT-TO-MUSIC';
                  } else if (selectedCategory === 'TEXT-TO-SPEECH') {
                    return provider.type === 'TEXT-TO-SPEECH';
                  } else if (selectedCategory === 'TEXT-TO-VIDEO') {
                    return provider.type === 'TEXT-TO-VIDEO';
                  }
                  return true;
                })
                .sort((a, b) => {
                  // First sort by tier (Premium > Freemium > Free)
                  const tierOrder = { 'Premium': 0, 'Freemium': 1, 'Free': 2, 'Pay-per-use': 0.5 };
                  const tierCompare = tierOrder[a.tier] - tierOrder[b.tier];
                  
                  // If same tier, sort by speed (Fast > Medium > Slow)
                  if (tierCompare === 0) {
                    const speedOrder = { 'Ultra Fast': 0, 'Fast': 1, 'Medium': 2, 'Slow': 3, 'Variable': 4 };
                    return speedOrder[a.speed] - speedOrder[b.speed];
                  }
                  
                  return tierCompare;
                })
                .map((provider) => {
                  // Add emoji and styling based on tier
                  const tierEmoji = {
                    'Premium': '⭐',
                    'Freemium': '🆓',
                    'Free': '🎯',
                    'Pay-per-use': '💳'
                  }[provider.tier] || '';
                  
                  const speedEmoji = {
                    'Ultra Fast': '⚡',
                    'Fast': '🚀',
                    'Medium': '🐢',
                    'Slow': '🐌',
                    'Variable': '🔄'
                  }[provider.speed] || '';
                  
                  return (
                    <option 
                      key={provider.value} 
                      value={provider.value}
                      title={`${provider.specialties} | ${provider.tier} | ${provider.speed}`}
                      style={{
                        fontWeight: provider.tier === 'Premium' ? '600' : 'normal',
                        color: provider.tier === 'Free' ? '#4b5563' : '#111827',
                        padding: '8px 12px',
                        borderBottom: '1px solid #f3f4f6'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ marginRight: '8px' }}>{tierEmoji}</span>
                          <strong>{provider.label}</strong>
                        </div>
                        <span style={{ fontSize: '0.9em', opacity: 0.8 }}>{speedEmoji}</span>
                      </div>
                      <div style={{ fontSize: '0.85em', margin: '4px 0', color: '#4b5563' }}>
                        {provider.description}
                      </div>
                      <div style={{ fontSize: '0.8em', color: '#6b7280', fontStyle: 'italic' }}>
                        Best for: {provider.specialties}
                      </div>
                    </option>
                  );
                })}
            </select>
          </div>

          <div>
            <label htmlFor="apiKey">
              API Key <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="apiKey"
              type="password"
              placeholder="Enter your API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              disabled={isSubmitting}
              style={{
                padding: '12px 16px',
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '14px',
                width: '100%'
              }}
            />
            <small style={{ color: '#6b7280', fontSize: '12px', display: 'block', marginTop: '4px' }}>
              Your API key will be encrypted and stored securely
            </small>
          </div>

          <button 
            type="submit" 
            className="submit-button"
            disabled={isSubmitting || loading}
            style={{
              opacity: (isSubmitting || loading) ? 0.6 : 1,
              cursor: (isSubmitting || loading) ? 'not-allowed' : 'pointer'
            }}
          >
            {isSubmitting ? (
              <>
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid #ffffff40',
                  borderTop: '2px solid #ffffff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  marginRight: '8px'
                }}></div>
                Adding API Key...
              </>
            ) : (
              "💾 Add/Update API Key"
            )}
          </button>
        </form>

        {/* Current Context Display */}
        <div style={{
          marginTop: '20px',
          padding: '15px',
          background: '#f0f9ff',
          borderRadius: '8px',
          fontSize: '14px',
          border: '1px solid #bae6fd'
        }}>
          <strong>🏢 Current Context:</strong> User ID: <code>{userId}</code>, Firm ID: <code>{firmId}</code>
          <br />
          <small style={{ color: '#0369a1', marginTop: '5px', display: 'block' }}>
            All providers will be managed for this User/Firm combination
          </small>
        </div>

        {/* LLM Details Table */}
        <div style={{ marginTop: '30px' }}>
          <h3 style={{ marginBottom: '15px', color: '#374151' }}>📋 Configured Providers</h3>
          
          {loading && !llmDetails.length ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6b7280' }}>
              <div style={{
                width: '32px',
                height: '32px',
                border: '3px solid #e5e7eb',
                borderTop: '3px solid #3b82f6',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 15px'
              }}></div>
              <div style={{ fontWeight: '600', marginBottom: '5px' }}>Loading providers...</div>
              <div style={{ fontSize: '13px' }}>Fetching data for User {userId}, Firm {firmId}</div>
            </div>
          ) : (
            <LLMDetailsTable
              onActivate={handleActivate}
              fetchLLMDetails={fetchLLMDetails}
              llmDetails={llmDetails}
              userId={userId}
              firmId={firmId}
            />
          )}
        </div>

        {/* Instructions */}
        <div style={{
          marginTop: '25px',
          padding: '20px',
          background: '#f9fafb',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#374151',
          border: '1px solid #e5e7eb'
        }}>
          <strong>💡 Instructions:</strong>
          <ul style={{ margin: '10px 0 0 0', paddingLeft: '20px', lineHeight: '1.6' }}>
            <li><strong>⚠️ Required:</strong> You must configure at least one TEXT-TO-TEXT provider for AI summaries to work</li>
            <li>Select your preferred AI provider and enter your API key</li>
            <li>Only one provider can be active at a time per User/Firm combination</li>
            <li>The system will use your active provider for generating business reports</li>
            <li>No fallback keys - you must provide valid API keys for the system to function</li>
            <li>Different User/Firm combinations can have different active providers</li>
          </ul>
        </div>

        {/* Animation styles */}
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default ApiKeyManager;
