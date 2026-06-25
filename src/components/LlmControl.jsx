import React, { useState, useEffect } from 'react';
import { Settings, Key, Cpu, CheckCircle, AlertTriangle } from 'lucide-react';
import './LlmControl.css';

const PROVIDER_MODELS = {
  gemini: [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro (Exp)' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro' }
  ],
  openai: [
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'o1-mini', name: 'o1 Mini' },
    { id: 'o1', name: 'o1' },
    { id: 'o3-mini', name: 'o3 Mini' },
    { id: 'gpt-5.5', name: 'GPT-5.5 Flagship' },
    { id: 'gpt-5.4-mini', name: 'GPT-5.4 Mini' }
  ],
  anthropic: [
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku' },
    { id: 'claude-3-opus', name: 'Claude 3 Opus' },
    { id: 'claude-4.8-opus', name: 'Claude 4.8 Opus' },
    { id: 'claude-4.6-sonnet', name: 'Claude 4.6 Sonnet' },
    { id: 'claude-4.5-haiku', name: 'Claude 4.5 Haiku' }
  ]
};

const LlmControl = ({
  aiProvider,
  setAiProvider,
  aiModel,
  setAiModel,
  openaiKey,
  setOpenaiKey,
  geminiKey,
  setGeminiKey,
  anthropicKey,
  setAnthropicKey,
  saveKeys,
  setSaveKeys
}) => {
  const [ollamaStatus, setOllamaStatus] = useState('PENDING');
  const [ollamaModels, setOllamaModels] = useState([]);
  const [isCustomOllama, setIsCustomOllama] = useState(false);

  useEffect(() => {
    if (aiProvider === 'ollama') {
      fetchOllamaModels();
    }
  }, [aiProvider]);

  // Sync isCustomOllama when models list loads
  useEffect(() => {
    if (aiProvider === 'ollama' && ollamaModels.length > 0) {
      const isModelPulled = ollamaModels.includes(aiModel);
      if (!isModelPulled) {
        setIsCustomOllama(true);
      }
    }
  }, [aiProvider, ollamaModels]);

  const fetchOllamaModels = async () => {
    try {
      const response = await fetch('/api/ollama/models');
      if (response.ok) {
        const data = await response.json();
        setOllamaStatus(data.status);
        const models = data.models || [];
        setOllamaModels(models);
      } else {
        setOllamaStatus('OFFLINE');
      }
    } catch (e) {
      setOllamaStatus('OFFLINE');
    }
  };

  const handleProviderChange = (provider) => {
    setAiProvider(provider);
    if (provider === 'gemini') {
      setAiModel('gemini-2.5-flash');
    } else if (provider === 'openai') {
      setAiModel('gpt-4o-mini');
    } else if (provider === 'anthropic') {
      setAiModel('claude-3-5-sonnet');
    } else if (provider === 'ollama') {
      // Keep model name intact if already set and we have no dynamic models fetched yet
      if (ollamaModels.length > 0) {
        if (!ollamaModels.includes(aiModel)) {
          setAiModel(ollamaModels[0]);
        }
      } else {
        setAiModel('gemma4:e4b');
      }
    }
  };

  const currentModels = PROVIDER_MODELS[aiProvider] || [];

  return (
    <div className="llm-control-container">
      <div className="llm-control-header">
        <Settings size={16} className="llm-header-icon" />
        <span className="llm-control-title">LLM Control Center</span>
      </div>

      <div className="llm-providers-grid">
        {[
          { id: 'ollama', label: 'Local (Ollama)' },
          { id: 'gemini', label: 'Gemini' },
          { id: 'openai', label: 'OpenAI' },
          { id: 'anthropic', label: 'Anthropic' }
        ].map((prov) => {
          const hasKeyOrOnline = 
            (prov.id === 'gemini' && geminiKey) || 
            (prov.id === 'openai' && openaiKey) || 
            (prov.id === 'anthropic' && anthropicKey) ||
            (prov.id === 'ollama' && ollamaStatus === 'ONLINE');
          return (
            <button
              key={prov.id}
              onClick={() => handleProviderChange(prov.id)}
              className={`llm-provider-btn ${aiProvider === prov.id ? 'active' : ''}`}
            >
              <div className="llm-provider-btn-content">
                <span>{prov.label}</span>
                {hasKeyOrOnline && (
                  <CheckCircle 
                    size={10} 
                    className={`llm-status-icon ${prov.id === 'ollama' ? 'ollama-online' : 'key-configured'}`} 
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {aiProvider !== 'ollama' ? (
        <div className="llm-key-section">
          <div className="llm-field-header">
            <Key size={12} className="llm-field-icon" />
            <label className="llm-field-label">API Key</label>
          </div>
          <input
            type="password"
            value={
              aiProvider === 'gemini' ? geminiKey :
              aiProvider === 'openai' ? openaiKey :
              anthropicKey
            }
            onChange={(e) => {
              const val = e.target.value;
              if (aiProvider === 'gemini') setGeminiKey(val);
              else if (aiProvider === 'openai') setOpenaiKey(val);
              else setAnthropicKey(val);
            }}
            placeholder={`Enter ${aiProvider.toUpperCase()} Key...`}
            className="llm-input llm-key-input"
          />
          <div className="llm-save-toggle">
            <input
              type="checkbox"
              id="save-keys-checkbox"
              checked={saveKeys}
              onChange={(e) => setSaveKeys(e.target.checked)}
              className="llm-checkbox"
            />
            <label htmlFor="save-keys-checkbox" className="llm-checkbox-label">
              Save key in browser
            </label>
          </div>
        </div>
      ) : null}

      <div className="llm-model-section">
        <div className="llm-field-header">
          <Cpu size={12} className="llm-field-icon" />
          <label className="llm-field-label">Model</label>
        </div>
        {aiProvider === 'ollama' ? (
          ollamaStatus === 'ONLINE' && ollamaModels.length > 0 ? (
            <div className="llm-ollama-status-block">
              <select
                value={isCustomOllama ? 'custom' : aiModel}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'custom') {
                    setIsCustomOllama(true);
                  } else {
                    setIsCustomOllama(false);
                    setAiModel(val);
                  }
                }}
                className="llm-select"
              >
                {ollamaModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
                <option value="custom">Custom Model...</option>
              </select>
              {isCustomOllama && (
                <input
                  type="text"
                  value={aiModel}
                  onChange={(e) => setAiModel(e.target.value)}
                  placeholder="Type model name (e.g. llama3)"
                  className="llm-input llm-text-input"
                  style={{ marginTop: '0.5rem' }}
                />
              )}
            </div>
          ) : (
            <div className="llm-ollama-status-block">
              {ollamaStatus === 'OFFLINE' ? (
                <div className="llm-alert-box warning">
                  <AlertTriangle size={12} className="alert-icon" />
                  <span>Ollama is offline. Make sure the desktop app is running.</span>
                </div>
              ) : ollamaStatus === 'PENDING' ? (
                <div className="llm-alert-box info">
                  <span>Checking Ollama status...</span>
                </div>
              ) : (
                <div className="llm-alert-box warning">
                  <AlertTriangle size={12} className="alert-icon" />
                  <span>No models pulled in Ollama. Pull one e.g. 'gemma4:e4b'.</span>
                </div>
              )}
              <input
                type="text"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="Type model name (e.g. gemma4:e4b)"
                className="llm-input llm-text-input"
              />
            </div>
          )
        ) : (
          <select
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="llm-select"
          >
            {currentModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
};

export default LlmControl;
