// endpoint for ai_request
import { BedrockRuntimeClient, InvokeModelCommand, } from "@aws-sdk/client-bedrock-runtime";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const SESSION_TOKEN = process.env.AWS_SESSION_TOKEN;

const AWS_REGION = "us-east-1";
const MODEL_ID = "anthropic.claude-3-haiku-20240307-v1:0";

const ai_request_string = async (request) => {
  const config = {
    region: AWS_REGION,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
      sessionToken: SESSION_TOKEN,
    },
   };
  const client = new BedrockRuntimeClient(config);

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1000,
    messages: [{
      role: "user",
      content: request.prompt
    }],
  };

  const input = {
    body: JSON.stringify(payload),
    contentType: "application/json",
    accept: "application/json",
    modelId: MODEL_ID,
  };

  try {
    const command = new InvokeModelCommand(input);
    const response = await client.send(command);
    const decodedResponseBody = new TextDecoder().decode(response.body);
    const responseBody = JSON.parse(decodedResponseBody);
    const output = responseBody.content[0].text;
    return output;
  } catch (error) {
    return error;
  }
};

const ai_request_streaming = (request, respondWith) => {
  respondWith.stream((signal, streamMessage) => {
    const config = {
      region: AWS_REGION,
     };
    const client = new BedrockRuntimeClient(config);

    // Adds each previous query and response as individual messages
    const conversation = request.thread.flatMap((event) => {
      if (event.response) {
        return [
          { role: 'user', content: event.request.query },
          { role: 'assistant', content: event.response.data }
        ];
      } else {
        return [];
      }
    });

    // System messages provided by the plugin to format the output as HTML content.
    const pluginSystemMessages = request.system.map((text) => ({
      text
    }));
  
    const systemMessages = [
      ...pluginSystemMessages,
      // Additional system messages to control the output of the AI
      { text: 'Remove lines with ``` from the response start and response end.' }
    ]

    const system = systemMessages.map((message) => message.text).join('\n');

    // Forms the new query sent to the API
    const text = request.context.length === 0 || conversation.length > 0
      ? request.query
      : `Question: ${request.query} Context: """${request.context}"""`;

    const messages = [
      ...conversation,
      {
        role: "user",
        content: text
      }
    ];

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: 1000,
    system,
    messages,
  };
  
  const input = {
    body: JSON.stringify(payload),
    contentType: "application/json",
    accept: "application/json",
    modelId: MODEL_ID,
  };
  const command = new InvokeModelWithResponseStreamCommand(input);
  // const response = await client.send(command);

    const onopen = async (response) => {
      if (response) {
        const contentType = response.headers.get('content-type');
        if (response.ok && contentType?.includes('text/event-stream')) {
          return;
        } else if (contentType?.includes('application/json')) {
          const data = await response.json();
          if (data.error) {
            throw new Error(`${data.error.type}: ${data.error.message}`);
          }
        }
      } else {
        throw new Error('Failed to communicate with the Amazon Bedrock API');
      }
    };

    // This function passes each new message into the plugin via the `streamMessage` callback.
    const onmessage = (ev) => {
      const data = ev.data;
      if (data !== '[DONE]') {
        const parsedData = JSON.parse(data);
    const message = parsedData?.candidates[0]?.content?.parts[0]?.text?.replace(/^```html\n/, "").replace(/\n```$/, "");
        if (message) {
          streamMessage(message);
        }
      }
    };

    const onerror = (error) => {
      // Stop operation and do not retry by the fetch-event-source
      throw error;
    };

    // Use microsoft's fetch-event-source library to work around the 2000 character limit
    // of the browser `EventSource` API, which requires query strings
    return fetchApi
    .then(fetchEventSource =>
      fetchEventSource(`https://generativelanguage.googleapis.com/v1beta/models/${model}:${generationMethod}?alt=sse&key=${API_KEY}`, {
        ...geminiOptions,
        openWhenHidden: true,
    onopen,
        onmessage,
        onerror
      })
    )
    .then(async (response) => {
      if (response && !response.ok) {
        const data = await response.json();
        if (data.error) {
          throw new Error(`${data.error.type}: ${data.error.message}`);
        }
      }
    })
    .catch(onerror);
  });
};

const app = express();
app.use(cors());
app.use(express.json());

app.post('/ai_request', async (req, res) => {
  const response = await ai_request_string(req.body);
  res.json(response);
});

app.get('/tinymce_api_key', async (req, res) => {
  const apiKey = process.env.TINYMCE_API_KEY;
  res.json({ apiKey });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});