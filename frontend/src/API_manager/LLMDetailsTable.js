// components/LLMDetailsTable.js
import React, { useState, useMemo } from "react";
import axios from "axios";

// Map of provider types to their display names
const providerTypeLabels = {
  "TEXT-TO-IMAGE": "🖼️ Image Gen",
  "IMAGE-TO-TEXT": "📝 Caption Gen",
  "TEXT-TO-TEXT": "💬 Language",
  "TEXT-TO-MUSIC": "🎵 Music",
  "TEXT-TO-SPEECH": "🔊 Voice",
  "TEXT-TO-VIDEO": "🎬 Video"
};

// Color mapping for provider types
const typeColors = {
  "TEXT-TO-IMAGE": '#8b5cf6',
  "IMAGE-TO-TEXT": '#3b82f6',
  "TEXT-TO-TEXT": '#10b981',
  "TEXT-TO-MUSIC": '#f59e0b',
  "TEXT-TO-SPEECH": '#ef4444',
  "TEXT-TO-VIDEO": '#8b5cf6'
};

// Provider icons mapping
const providerIcons = {
  // Image Generation
  'OPENAI_DALLE3': '🎨', 'MIDJOURNEY': '🌌', 'ADOBE_FIREFLY': '🔥',
  'STABILITY_AI': '🌊', 'LEONARDO_AI': '🦁', 'FLUX_AI': '⚡',
  'IDEOGRAM': '✏️', 'STABLE_DIFFUSION': '🎭', 'DREAMSTUDIO': '🌠',
  'RUNWAY_ML': '🎥', 'TOGETHER_STABLE_DIFFUSION': '🤝', 'KANDINSKY': '🖌️',
  
  // Caption Generation
  'OPENAI_GPT4V': '👁️', 'CLAUDE_VISION': '🔍', 'GEMINI_VISION': '🔮',
  'QWEN_VL': '👁️', 'COGVLM': '🤖', 'PALIGEMMA': '🦜',
  'LLAVA': '🦉', 'MINIGPT4': '📱', 'INSTRUCTBLIP': '📝', 'PHI3_VISION': 'φ',
  'GEMINI_PRO_VISION': '👁️', 'CLAUDE_3_OPUS': '🤖', 'LLAVA_13B': '🦉',
  
  // Language & Text
  'PLAYHT': '🎙️', 'GROQ': '⚡', 'OPENROUTER': '🔄', 'CLAUDE': '🤖',
  'OPENAI_GPT4': '🧠', 'GEMINI': '✨', 'GEMINI_PRO': '✨', 'GEMINI_FLASH': '⚡',
  'MISTRAL': '🌪️', 'DEEPSEEK': '🔍', 'OLLAMA': '🦙', 'COHERE': '🔤',
  'TOGETHER_AI': '🔄', 'REPLICATE': '🔄',
  
  // Music Generation
  'SUNO_AI': '🎵', 'UDIO': '🎼', 'MUSICGEN_META': '🎹',
  'AIVA': '🎻', 'MUBERT': '🎧', 'SOUNDRAW': '🎶',
  
  // Video Generation
  'RUNWAY_GEN4': '🎬', 'OPENAI_SORA': '🎥', 'GOOGLE_VEO2': '📹',
  'PIKA_2_2': '📽️', 'KLING_AI_2': '🎞️', 'HAILUO_AI': '📺', 'WAN2_2': '📼'
};

// Map DB codes to UI categories (module scope so hooks don't depend on it)
const TYPE_CODE_TO_UI = {
  // Standardized type mappings - match database enum values
  'TEXT-TO-TEXT': 'TEXT-TO-TEXT',
  'TEXT-TO-IMAGE': 'TEXT-TO-IMAGE',
  'IMAGE-TO-TEXT': 'IMAGE-TO-TEXT',
  'TEXT-TO-MUSIC': 'TEXT-TO-MUSIC',
  'TEXT-TO-SPEECH': 'TEXT-TO-SPEECH',
  'TEXT-TO-VIDEO': 'TEXT-TO-VIDEO'
};

const LLMDetailsTable = ({ 
  onActivate, 
  fetchLLMDetails, 
  llmDetails = [], 
  userId = "", 
  firmId = "",
  categoryLabels = {},
  apiBaseUrl = "http://localhost:8000"
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [processingId, setProcessingId] = useState(null);

  const toggleStatus = async (id, provider, providerType, currentStatus) => {
    setLoading(true);
    setProcessingId(id);
    setError("");
    
    try {
      console.log(`🔄 Toggling status for ID: ${id}, Provider: ${provider} (${providerType}), User: ${userId}, Firm: ${firmId}`);
      
      const action = currentStatus === 'ACTIVE' ? 'DEACTIVATE' : 'ACTIVATE';
      const response = await axios.post(`${apiBaseUrl}/toggle-llm-status`, {
        id,
        userid: parseInt(userId),
        firmid: parseInt(firmId),
        provider_type: providerType,
        action
      });

      if (response.data.success) {
        console.log(`✅ Status toggled successfully to: ${response.data.newStatus}`);
        await fetchLLMDetails(); // Refresh the table
        
        // If provider was activated, notify parent with user context and type
        if (response.data.newStatus === 'ACTIVE') {
          onActivate(provider, providerType, userId, firmId);
        }
        
        // Show success message
        setError("");
      } else {
        throw new Error(response.data.error || 'Failed to update status');
      }
    } catch (err) {
      console.error("❌ Error toggling status:", err);
      
      // Handle different types of errors
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("Response data:", err.response.data);
        console.error("Response status:", err.response.status);
        console.error("Response headers:", err.response.headers);
        
        setError(`Error: ${err.response.data?.error || err.response.statusText || 'Unknown error'}`);
      } else if (err.request) {
        // The request was made but no response was received
        console.error("No response received:", err.request);
        setError("No response from server. Please check your connection.");
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Error:', err.message);
        setError(`Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
      setProcessingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid Date';
    }
  };

  const maskApiKey = (apiKey) => {
    if (!apiKey) return 'N/A';
    if (apiKey.length <= 8) return '*'.repeat(apiKey.length);
    return apiKey.substring(0, 4) + '*'.repeat(Math.max(0, apiKey.length - 8)) + apiKey.substring(apiKey.length - 4);
  };

  // Get provider type display name with fallback
  const getProviderTypeLabel = (rawType) => {
    const uiType = TYPE_CODE_TO_UI[rawType] || rawType;
    return providerTypeLabels[uiType] || uiType || 'Unknown';
  };

  // Get provider icon with fallback
  const getProviderIcon = (provider) => {
    return providerIcons[provider] || '🔧';
  };

  // Group providers by type (normalize DB codes to UI categories for display)
  const groupedProviders = useMemo(() => {
    const groups = {};
    
    llmDetails.forEach(item => {
      const rawType = item.LLM_PROVIDER_TYPE || 'UNKNOWN';
      const uiType = TYPE_CODE_TO_UI[rawType] || rawType;
      if (!groups[uiType]) {
        groups[uiType] = [];
      }
      groups[uiType].push(item);
    });
    
    // Sort groups by type
    return Object.entries(groups)
      .sort(([typeA], [typeB]) => {
        const order = ['TEXT-TO-TEXT', 'TEXT-TO-IMAGE', 'IMAGE-TO-TEXT', 'TEXT-TO-MUSIC', 'TEXT-TO-SPEECH', 'TEXT-TO-VIDEO'];
        return order.indexOf(typeA) - order.indexOf(typeB);
      });
  }, [llmDetails]);

  if (error) {
    return (
      <div style={{
        background: '#fee',
        color: '#c33',
        padding: '15px',
        borderRadius: '8px',
        textAlign: 'center',
        border: '1px solid #fcc',
        marginBottom: '20px'
      }}>
        ❌ {error}
        <button
          onClick={() => setError("")}
          style={{
            marginLeft: '10px',
            background: 'none',
            border: 'none',
            color: '#c33',
            cursor: 'pointer',
            fontSize: '16px'
          }}
        >
          ×
        </button>
      </div>
    );
  }

  const tableHeaderStyle = {
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: '600',
    fontSize: '14px',
    color: '#374151',
    borderBottom: '2px solid #e5e7eb',
    background: '#f9fafb'
  };

  const tableCellStyle = {
    padding: '12px 16px',
    fontSize: '14px',
    color: '#374151',
    borderBottom: '1px solid #e5e7eb'
  };

  // Status badge component
  const StatusBadge = ({ status }) => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: status === 'ACTIVE' ? '#d1fae5' : '#f3f4f6',
      color: status === 'ACTIVE' ? '#065f46' : '#4b5563',
      border: `1px solid ${status === 'ACTIVE' ? '#a7f3d0' : '#e5e7eb'}`
    }}>
      {status === 'ACTIVE' ? '✅ Active' : '❌ Inactive'}
    </span>
  );

  // Type badge component
  const TypeBadge = ({ type }) => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 8px',
      borderRadius: '6px',
      fontSize: '12px',
      fontWeight: '600',
      backgroundColor: `${typeColors[type] || '#e5e7eb'}20`,
      color: typeColors[type] || '#4b5563',
      border: `1px solid ${typeColors[type] || '#e5e7eb'}`,
      whiteSpace: 'nowrap'
    }}>
      {getProviderTypeLabel(type)}
    </span>
  );

  // Provider cell component
  const ProviderCell = ({ provider }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{
        fontSize: '18px',
        width: '24px',
        textAlign: 'center'
      }}>
        {getProviderIcon(provider)}
      </span>
      <span style={{ fontWeight: '500' }}>{provider}</span>
    </div>
  );

  return (
    <div>
      {/* User Context Display */}
      <div style={{
        marginBottom: '15px',
        padding: '10px 15px',
        background: '#f0f9ff',
        borderRadius: '6px',
        fontSize: '13px',
        color: '#0369a1',
        border: '1px solid #bae6fd',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span>🔍</span>
        <span><strong>Viewing providers for:</strong> User ID: <code>{userId || 'Not set'}</code>, Firm ID: <code>{firmId || 'Not set'}</code></span>
      </div>

      {groupedProviders.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          background: '#f9fafb',
          borderRadius: '8px',
          border: '1px dashed #e5e7eb',
          color: '#6b7280'
        }}>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>📭</div>
          <h3 style={{ marginBottom: '8px', color: '#374151' }}>No API Keys Found</h3>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Add an API key to get started with {!userId || !firmId ? 'your selected User/Firm' : 'this account'}.
          </p>
        </div>
      ) : (
        groupedProviders.map(([type, providers]) => (
          <div key={type} style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              marginBottom: '12px',
              paddingBottom: '8px',
              borderBottom: `2px solid ${typeColors[type] || '#e5e7eb'}`
            }}>
              <h3 style={{
                margin: 0,
                fontSize: '15px',
                fontWeight: '600',
                color: typeColors[type] || '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <TypeBadge type={type} />
                <span>{categoryLabels[type] || getProviderTypeLabel(type)}</span>
              </h3>
              <span style={{
                marginLeft: '8px',
                fontSize: '12px',
                color: '#6b7280',
                backgroundColor: '#f3f4f6',
                padding: '2px 8px',
                borderRadius: '10px'
              }}>
                {providers.length} {providers.length === 1 ? 'provider' : 'providers'}
              </span>
            </div>
            
            {/* Table Container */}
            <div style={{ 
              overflowX: 'auto',
              borderRadius: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: '1px solid #e5e7eb',
              marginBottom: '24px'
            }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                background: 'white',
                fontSize: '14px'
              }}>
                <thead>
                  <tr>
                    <th style={{ ...tableHeaderStyle, width: '30%' }}>Provider</th>
                    <th style={{ ...tableHeaderStyle, width: '20%' }}>Type</th>
                    <th style={{ ...tableHeaderStyle, width: '15%' }}>API Key</th>
                    <th style={{ ...tableHeaderStyle, width: '15%' }}>Updated</th>
                    <th style={{ ...tableHeaderStyle, width: '10%' }}>Status</th>
                    <th style={{ ...tableHeaderStyle, width: '10%' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((item) => {
                    const isActive = item.STATUS === 'ACTIVE';
                    const isProcessing = processingId === item.ID;
                    const providerType = item.LLM_PROVIDER_TYPE || type;
                    
                    return (
                      <tr 
                        key={item.ID}
                        style={{
                          backgroundColor: isActive ? '#f8fafc' : 'transparent',
                          transition: 'background-color 0.2s',
                          borderBottom: '1px solid #f1f5f9',
                          ':last-child': {
                            borderBottom: 'none'
                          },
                          ':hover': {
                            backgroundColor: isActive ? '#f0fdf9' : '#f8fafc'
                          }
                        }}
                      >
                        <td style={tableCellStyle}>
                          <ProviderCell provider={item.LLM_PROVIDER} />
                        </td>
                        <td style={tableCellStyle}>
                          <TypeBadge type={providerType} />
                        </td>
                        <td style={tableCellStyle}>
                          <div style={{
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            color: '#6b7280',
                            wordBreak: 'break-all',
                            backgroundColor: '#f8fafc',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid #e2e8f0'
                          }}>
                            {maskApiKey(item.API_KEY)}
                          </div>
                        </td>
                        <td style={tableCellStyle}>
                          <div style={{
                            fontSize: '12px',
                            color: '#64748b',
                            whiteSpace: 'nowrap'
                          }}>
                            {formatDate(item.UPD_DTM || item.INSRT_DTM)}
                          </div>
                        </td>
                        <td style={tableCellStyle}>
                          <StatusBadge status={item.STATUS} />
                        </td>
                        <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                          <button
                            onClick={() => toggleStatus(item.ID, item.LLM_PROVIDER, providerType, item.STATUS)}
                            disabled={loading}
                            style={{
                              padding: '6px 12px',
                              borderRadius: '6px',
                              border: 'none',
                              backgroundColor: isActive ? '#f1f5f9' : '#3b82f6',
                              color: isActive ? '#64748b' : 'white',
                              fontWeight: '500',
                              fontSize: '13px',
                              cursor: loading ? 'not-allowed' : 'pointer',
                              opacity: (loading && processingId === item.ID) ? 0.7 : 1,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              transition: 'all 0.2s',
                              minWidth: '90px',
                              justifyContent: 'center',
                              ':hover': !loading ? {
                                backgroundColor: isActive ? '#e2e8f0' : '#2563eb',
                              } : {},
                              ':disabled': {
                                opacity: 0.6,
                                cursor: 'not-allowed'
                              }
                            }}
                          >
                            {isProcessing ? (
                              <>
                                <div style={{
                                  width: '12px',
                                  height: '12px',
                                  border: '2px solid #ffffff40',
                                  borderTop: '2px solid #ffffff',
                                  borderRadius: '50%',
                                  animation: 'spin 1s linear infinite',
                                  marginRight: '4px'
                                }}></div>
                                {isActive ? 'Deactivating' : 'Activating'}
                              </>
                            ) : isActive ? (
                              'Deactivate'
                            ) : (
                              'Activate'
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default LLMDetailsTable;
