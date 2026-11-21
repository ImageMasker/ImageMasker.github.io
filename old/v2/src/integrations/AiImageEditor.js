const AI_STUDIO_MODELS = [
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Gemini 3.1 Flash Image Preview',
  },
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Gemini 3 Pro Image Preview',
  },
];

const FAL_MODELS = [
  {
    id: 'fal-ai/nano-banana-2/edit',
    label: 'Nano Banana 2 Edit',
    buildInput: ({ prompt, imageDataUrl }) => ({
      prompt,
      image_urls: [imageDataUrl],
      num_images: 1,
      aspect_ratio: 'auto',
      output_format: 'png',
      limit_generations: true,
    }),
  },
  {
    id: 'fal-ai/flux-pro/kontext',
    label: 'FLUX.1 Kontext Pro',
    buildInput: ({ prompt, imageDataUrl }) => ({
      prompt,
      image_url: imageDataUrl,
      output_format: 'png',
    }),
  },
  {
    id: 'fal-ai/flux-pro/kontext/max',
    label: 'FLUX.1 Kontext Max',
    buildInput: ({ prompt, imageDataUrl }) => ({
      prompt,
      image_url: imageDataUrl,
      output_format: 'png',
    }),
  },
];

const SERVICE_DEFINITIONS = {
  aiStudio: {
    id: 'aiStudio',
    label: 'AI Studio (Google)',
    tokenLabel: 'API key',
    tokenPlaceholder: 'Google AI Studio API key',
    customUrlLabel: 'API URL',
    customUrlPlaceholder: '',
    showCustomUrl: false,
  },
  nanoGpt: {
    id: 'nanoGpt',
    label: 'Nano-GPT',
    tokenLabel: 'API key',
    tokenPlaceholder: 'NanoGPT API key',
    customUrlLabel: 'API URL',
    customUrlPlaceholder: '',
    showCustomUrl: false,
  },
  fal: {
    id: 'fal',
    label: 'fal.ai',
    tokenLabel: 'API key',
    tokenPlaceholder: 'fal API key',
    customUrlLabel: 'API URL',
    customUrlPlaceholder: '',
    showCustomUrl: false,
  },
  comfyUi: {
    id: 'comfyUi',
    label: 'Custom ComfyUI API',
    tokenLabel: 'API key',
    tokenPlaceholder: 'Optional ComfyUI API key',
    customUrlLabel: 'API URL',
    customUrlPlaceholder: 'https://127.0.0.1:8188',
    showCustomUrl: true,
  },
};

export class AiImageEditor {
  getServiceDefinition(serviceId) {
    return SERVICE_DEFINITIONS[serviceId] ?? SERVICE_DEFINITIONS.aiStudio;
  }

  async listModels({ serviceId, token = '', customUrl = '' } = {}) {
    if (serviceId === 'aiStudio') {
      return AI_STUDIO_MODELS;
    }

    if (serviceId === 'nanoGpt') {
      return this.fetchNanoGptModels();
    }

    if (serviceId === 'fal') {
      return FAL_MODELS.map((model) => ({
        id: model.id,
        label: model.label,
      }));
    }

    if (serviceId === 'comfyUi') {
      return this.fetchComfyUiModels({
        token,
        customUrl,
      });
    }

    return [];
  }

  async editImage({
    serviceId,
    modelId,
    prompt,
    token = '',
    customUrl = '',
    imageDataUrl,
    mimeType = 'image/png',
  } = {}) {
    if (!prompt?.trim()) {
      throw new Error('Enter an edit prompt first.');
    }

    if (!imageDataUrl) {
      throw new Error('There is no image data to send to the AI service.');
    }

    if (serviceId === 'aiStudio') {
      return this.editWithAiStudio({
        modelId,
        prompt,
        token,
        imageDataUrl,
        mimeType,
      });
    }

    if (serviceId === 'nanoGpt') {
      return this.editWithNanoGpt({
        modelId,
        prompt,
        token,
        imageDataUrl,
      });
    }

    if (serviceId === 'fal') {
      return this.editWithFal({
        modelId,
        prompt,
        token,
        imageDataUrl,
      });
    }

    if (serviceId === 'comfyUi') {
      return this.editWithComfyUi({
        modelId,
        prompt,
        token,
        customUrl,
        imageDataUrl,
      });
    }

    throw new Error('Unsupported AI editing service.');
  }

  async editWithAiStudio({ modelId, prompt, token, imageDataUrl, mimeType }) {
    if (!token.trim()) {
      throw new Error('A Google AI Studio API key is required.');
    }

    const body = {
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: this.extractBase64Payload(imageDataUrl),
              },
            },
          ],
        },
      ],
    };
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': token.trim(),
        },
        body: JSON.stringify(body),
      }
    );
    const payload = await this.readJsonResponse(response);

    if (!response.ok) {
      throw new Error(this.extractErrorMessage(payload, 'Google AI Studio request failed.'));
    }

    const parts = payload?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) => part?.inlineData?.data || part?.inline_data?.data);
    const blob = imagePart?.inlineData ?? imagePart?.inline_data;

    if (!blob?.data) {
      throw new Error('Google AI Studio returned no edited image.');
    }

    return {
      imageDataUrl: `data:${blob.mimeType ?? blob.mime_type ?? 'image/png'};base64,${blob.data}`,
      persistentUrl: '',
    };
  }

  async editWithNanoGpt({ modelId, prompt, token, imageDataUrl }) {
    if (!token.trim()) {
      throw new Error('A NanoGPT API key is required.');
    }

    const response = await fetch('https://nano-gpt.com/api/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        prompt,
        n: 1,
        response_format: 'url',
        imageDataUrl,
      }),
    });
    const payload = await this.readJsonResponse(response);

    if (!response.ok) {
      throw new Error(this.extractErrorMessage(payload, 'NanoGPT request failed.'));
    }

    const item = payload?.data?.[0] ?? null;

    if (item?.url) {
      return {
        imageUrl: item.url,
        persistentUrl: '',
      };
    }

    if (item?.b64_json) {
      return {
        imageDataUrl: `data:image/png;base64,${item.b64_json}`,
        persistentUrl: '',
      };
    }

    throw new Error('NanoGPT returned no edited image.');
  }

  async editWithFal({ modelId, prompt, token, imageDataUrl }) {
    if (!token.trim()) {
      throw new Error('A fal API key is required.');
    }

    const definition = FAL_MODELS.find((entry) => entry.id === modelId);

    if (!definition) {
      throw new Error('Select a supported fal image-edit model.');
    }

    const response = await fetch(`https://fal.run/${definition.id}`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${token.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(definition.buildInput({
        prompt,
        imageDataUrl,
      })),
    });
    const payload = await this.readJsonResponse(response);

    if (!response.ok) {
      throw new Error(this.extractErrorMessage(payload, 'fal request failed.'));
    }

    const image = payload?.images?.[0] ?? payload?.image ?? null;

    if (!image?.url) {
      throw new Error('fal returned no edited image.');
    }

    return {
      imageUrl: image.url,
      persistentUrl: '',
    };
  }

  async editWithComfyUi({ modelId, prompt, token, customUrl, imageDataUrl }) {
    if (!customUrl.trim()) {
      throw new Error('Enter a ComfyUI API URL first.');
    }

    if (!modelId) {
      throw new Error('Select a ComfyUI checkpoint first.');
    }

    const imageBlob = await fetch(imageDataUrl).then((response) => response.blob());
    const uploadName = `imagemasker-${Date.now()}.png`;
    const uploadData = new FormData();

    uploadData.append('image', new File([imageBlob], uploadName, { type: imageBlob.type || 'image/png' }));
    uploadData.append('type', 'input');
    uploadData.append('overwrite', 'true');

    const uploadResponse = await this.requestComfy(customUrl, ['upload/image', 'api/upload/image'], {
      method: 'POST',
      headers: this.buildComfyHeaders(token),
      body: uploadData,
    });
    const uploadPayload = await this.readJsonResponse(uploadResponse);

    if (!uploadResponse.ok) {
      throw new Error(this.extractErrorMessage(uploadPayload, 'ComfyUI upload failed.'));
    }

    const uploadedFilename =
      uploadPayload?.name ??
      uploadPayload?.filename ??
      uploadPayload?.files?.[0]?.name ??
      uploadPayload?.files?.[0]?.filename ??
      uploadName;
    const workflow = this.buildComfyWorkflow({
      checkpointName: modelId,
      prompt,
      imageFilename: uploadedFilename,
    });
    const submitResponse = await this.requestComfy(customUrl, ['prompt', 'api/prompt'], {
      method: 'POST',
      headers: {
        ...this.buildComfyHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: workflow,
        client_id: `imagemasker-${Date.now()}`,
      }),
    });
    const submitPayload = await this.readJsonResponse(submitResponse);

    if (!submitResponse.ok) {
      throw new Error(this.extractErrorMessage(submitPayload, 'ComfyUI prompt submission failed.'));
    }

    const promptId = submitPayload?.prompt_id ?? submitPayload?.promptId;

    if (!promptId) {
      throw new Error('ComfyUI did not return a prompt id.');
    }

    const history = await this.pollComfyHistory(customUrl, token, promptId);
    const outputImage = this.extractComfyOutputImage(history);

    if (!outputImage?.filename) {
      throw new Error('ComfyUI completed, but no output image was found.');
    }

    const query = new URLSearchParams({
      filename: outputImage.filename,
    });

    if (outputImage.subfolder) {
      query.set('subfolder', outputImage.subfolder);
    }

    if (outputImage.type) {
      query.set('type', outputImage.type);
    }

    const imageResponse = await this.requestComfy(customUrl, [
      `view?${query.toString()}`,
      `api/view?${query.toString()}`,
    ], {
      method: 'GET',
      headers: this.buildComfyHeaders(token),
    });

    if (!imageResponse.ok) {
      const payload = await this.readUnknownResponse(imageResponse);
      throw new Error(this.extractErrorMessage(payload, 'ComfyUI image download failed.'));
    }

    return {
      imageBlob: await imageResponse.blob(),
      persistentUrl: '',
    };
  }

  async fetchNanoGptModels() {
    const response = await fetch('https://nano-gpt.com/api/v1/image-models?detailed=true');
    const payload = await this.readJsonResponse(response);

    if (!response.ok) {
      throw new Error(this.extractErrorMessage(payload, 'Could not load NanoGPT models.'));
    }

    const models = Array.isArray(payload?.data) ? payload.data : [];

    return models
      .filter((model) => this.nanoGptSupportsImageEditing(model))
      .map((model) => ({
        id: model.id,
        label: model.name ? `${model.name} (${model.id})` : model.id,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  nanoGptSupportsImageEditing(model) {
    const capabilities = model?.capabilities ?? {};
    const architecture = model?.architecture ?? {};
    const modalities = (Array.isArray(architecture?.input_modalities) ? architecture.input_modalities : [])
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const parameters = Object.keys(model?.supported_parameters ?? {});

    return Boolean(
      capabilities?.image_to_image ||
      capabilities?.img2img ||
      parameters.includes('imageDataUrl') ||
      parameters.includes('imageDataUrls') ||
      modalities.includes('image')
    );
  }

  async fetchComfyUiModels({ token = '', customUrl = '' } = {}) {
    if (!customUrl.trim()) {
      return [];
    }

    const response = await this.requestComfy(customUrl, ['object_info', 'api/object_info'], {
      method: 'GET',
      headers: this.buildComfyHeaders(token),
    });
    const payload = await this.readJsonResponse(response);

    if (!response.ok) {
      throw new Error(this.extractErrorMessage(payload, 'Could not load ComfyUI models.'));
    }

    const checkpointNode =
      payload?.CheckpointLoaderSimple ??
      payload?.CheckpointLoader ??
      null;
    const checkpointNames =
      checkpointNode?.input?.required?.ckpt_name?.[0] ??
      checkpointNode?.input?.optional?.ckpt_name?.[0] ??
      [];

    if (!Array.isArray(checkpointNames) || checkpointNames.length === 0) {
      return [];
    }

    return checkpointNames.map((name) => ({
      id: name,
      label: name,
    }));
  }

  buildComfyWorkflow({ checkpointName, prompt, imageFilename }) {
    return {
      '1': {
        class_type: 'CheckpointLoaderSimple',
        inputs: {
          ckpt_name: checkpointName,
        },
      },
      '2': {
        class_type: 'LoadImage',
        inputs: {
          image: imageFilename,
          upload: 'image',
        },
      },
      '3': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: prompt,
          clip: ['1', 1],
        },
      },
      '4': {
        class_type: 'CLIPTextEncode',
        inputs: {
          text: '',
          clip: ['1', 1],
        },
      },
      '5': {
        class_type: 'VAEEncode',
        inputs: {
          pixels: ['2', 0],
          vae: ['1', 2],
        },
      },
      '6': {
        class_type: 'KSampler',
        inputs: {
          seed: Math.floor(Math.random() * 2147483647),
          steps: 24,
          cfg: 7,
          sampler_name: 'euler',
          scheduler: 'normal',
          denoise: 0.82,
          model: ['1', 0],
          positive: ['3', 0],
          negative: ['4', 0],
          latent_image: ['5', 0],
        },
      },
      '7': {
        class_type: 'VAEDecode',
        inputs: {
          samples: ['6', 0],
          vae: ['1', 2],
        },
      },
      '8': {
        class_type: 'SaveImage',
        inputs: {
          filename_prefix: 'imagemasker_ai',
          images: ['7', 0],
        },
      },
    };
  }

  async pollComfyHistory(customUrl, token, promptId) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < 180000) {
      const response = await this.requestComfy(customUrl, [
        `history/${encodeURIComponent(promptId)}`,
        `api/history/${encodeURIComponent(promptId)}`,
      ], {
        method: 'GET',
        headers: this.buildComfyHeaders(token),
      });

      if (response.ok) {
        const payload = await this.readJsonResponse(response);
        const entry = payload?.[promptId] ?? payload;

        if (entry?.status?.status_str === 'error') {
          throw new Error(entry?.status?.messages?.[0]?.[1]?.message ?? 'ComfyUI reported an execution error.');
        }

        if (entry?.outputs) {
          return entry;
        }
      }

      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }

    throw new Error('Timed out while waiting for ComfyUI to finish.');
  }

  extractComfyOutputImage(historyEntry) {
    const outputs = historyEntry?.outputs ?? {};

    for (const nodeOutput of Object.values(outputs)) {
      const image = nodeOutput?.images?.[0];

      if (image?.filename) {
        return image;
      }
    }

    return null;
  }

  buildComfyHeaders(token = '') {
    const trimmedToken = token.trim();

    if (!trimmedToken) {
      return {};
    }

    return {
      Authorization: `Bearer ${trimmedToken}`,
      'X-API-Key': trimmedToken,
    };
  }

  async requestComfy(baseUrl, pathCandidates, options) {
    const attempts = [];

    for (const path of pathCandidates) {
      const url = this.buildComfyUrl(baseUrl, path);

      try {
        const response = await fetch(url, options);

        if (response.ok || response.status !== 404) {
          return response;
        }

        attempts.push(new Error(`404 for ${url}`));
      } catch (error) {
        attempts.push(error);
      }
    }

    throw attempts[attempts.length - 1] ?? new Error('ComfyUI request failed.');
  }

  buildComfyUrl(baseUrl, path) {
    const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
    const normalizedPath = String(path).replace(/^\/+/, '');

    if (normalizedBase.endsWith('/api') && normalizedPath.startsWith('api/')) {
      return `${normalizedBase}/${normalizedPath.slice(4)}`;
    }

    return `${normalizedBase}/${normalizedPath}`;
  }

  extractBase64Payload(dataUrl) {
    return String(dataUrl).split(',', 2)[1] ?? '';
  }

  async readJsonResponse(response) {
    const text = await response.text();

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return {
        error: {
          message: text,
        },
      };
    }
  }

  async readUnknownResponse(response) {
    const contentType = response.headers.get('content-type') ?? '';

    if (contentType.includes('application/json')) {
      return this.readJsonResponse(response);
    }

    const text = await response.text();
    return {
      error: {
        message: text,
      },
    };
  }

  extractErrorMessage(payload, fallback = 'Request failed.') {
    return (
      payload?.error?.message ??
      payload?.detail ??
      payload?.message ??
      payload?.status ??
      fallback
    );
  }
}
