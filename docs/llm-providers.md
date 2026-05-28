# Multi-LLM Provider Support

Chat Buddy now supports multiple LLM providers! You can choose from OpenAI, Grok, or Gemini depending on your preferences and needs.

## Supported Providers

### 1. **OpenAI** (Default)
- **Models**: gpt-3.5-turbo (default), gpt-4, etc.
- **Pros**: Fast, reliable, widely used
- **API Key Format**: Starts with `sk-`
- **Sign Up**: https://platform.openai.com/

### 2. **Grok** (by xAI)
- **Models**: grok-3 (default)
- **Pros**: Fast, edgy, creative responses
- **API Key Format**: Valid xAI API key
- **Sign Up**: https://console.x.ai/

### 3. **Gemini** (by Google)
- **Models**: gemini-2.0-flash (default), gemini-2.0-pro, etc.
- **Pros**: Advanced, multimodal, powerful
- **API Key Format**: Valid Google API key
- **Sign Up**: https://makersuite.google.com/app/apikey

## How to Set Up

### During Initial Setup (`npm run init`)

When you run the setup wizard, you'll be prompted to select your preferred LLM provider:

```
🔑 Step 3: LLM Provider Selection
Choose your AI model provider:
1) OpenAI (gpt-3.5-turbo) - Fast & Reliable
2) Grok (Grok-2 by xAI) - Fast & Edgy
3) Gemini (Google Gemini) - Advanced & Multimodal

➤ Select LLM provider (1/2/3): 2
Selected: Grok - Grok-2 by xAI (Fast & Edgy)

🔐 Step 4: API Key Setup
➤ Enter your Grok API key: [paste your key here]
```

### Via Environment Variables

You can also set the LLM provider via `.env` file:

```env
LLM_PROVIDER=grok
LLM_API_KEY=your_grok_api_key_here
LLM_MODEL=grok-3
```

Supported `LLM_PROVIDER` values:
- `openai`
- `grok`
- `gemini`

## Getting API Keys

### OpenAI
1. Go to https://platform.openai.com/
2. Sign up or log in
3. Navigate to **API Keys** section
4. Create a new API key
5. Copy the key (starts with `sk-`)

### Grok (xAI)
1. Go to https://console.x.ai/
2. Sign up with your X account
3. Create a new API key in the console
4. Copy the key

### Gemini (Google)
1. Go to https://makersuite.google.com/app/apikey
2. Click on **"Create API Key"**
3. Select or create a Google Cloud project
4. Copy the API key

## Switching Providers

### Option 1: Re-run Setup
```bash
npm run init
```
This will overwrite your existing configuration with a new provider selection.

### Option 2: Update .env
```env
LLM_PROVIDER=gemini
LLM_API_KEY=your_new_api_key
LLM_MODEL=gemini-2.0-flash
```

## Custom Models

If you want to use a specific model version instead of the defaults, you can:

### During Setup
When prompted for the API key, you can manually set the model via `.env`:

```env
LLM_PROVIDER=openai
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4
```

### Available Models by Provider

**OpenAI**:
- `gpt-3.5-turbo`
- `gpt-4`
- `gpt-4-turbo`

**Grok**:
- `grok-3`
- `grok-2`

**Gemini**:
- `gemini-2.0-flash` (fastest)
- `gemini-2.0-flash-exp`
- `gemini-2.0-pro`
- `gemini-1.5-flash`
- `gemini-1.5-pro`

## Cost Comparison (Approximate)

| Provider | Model | Input | Output | Notes |
|----------|-------|-------|--------|-------|
| **OpenAI** | gpt-3.5-turbo | $0.50/M | $1.50/M | Most affordable |
| **OpenAI** | gpt-4 | $30/M | $60/M | Most capable |
| **Grok** | grok-3 | ~$5/M | ~$15/M | Early access pricing |
| **Gemini** | Flash | $0.075/M | $0.30/M | Very affordable |
| **Gemini** | Pro | $1.50/M | $6/M | More powerful |

## Troubleshooting

### "Invalid API Key"
- Ensure your API key is correct and hasn't expired
- Check that you're using the right provider's key (e.g., xAI key for Grok)

### "API Rate Limit Exceeded"
- Wait a few minutes before making new requests
- Consider upgrading your API plan

### "Configuration Error"
- Run `npm run init` to reconfigure
- Ensure `.env` variables are properly set if using environment variables

## Performance Tips

1. **Use faster models for quick responses**:
   - OpenAI: `gpt-3.5-turbo`
   - Gemini: `gemini-2.0-flash`
   - Grok: `grok-3`

2. **Use more capable models for complex tasks**:
   - OpenAI: `gpt-4`
   - Gemini: `gemini-2.0-pro`

3. **Monitor API usage**:
   - OpenAI: Check usage at https://platform.openai.com/usage/overview
   - Google: Check quotas in Google Cloud Console
   - xAI: Check usage in xAI console

## Notes

- The bot automatically handles provider-specific configurations
- Your API keys are encrypted locally (AES-256) and never shared
- You can switch providers anytime by re-running `npm run init` or updating `.env`
- The @openai/agents SDK currently handles OpenAI natively; Grok and Gemini use compatible interfaces
