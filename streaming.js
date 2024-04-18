import { BedrockRuntimeClient, InvokeModelCommand, InvokeModelWithResponseStreamCommand } from "@aws-sdk/client-bedrock-runtime";

// Amazon Bedrock credentials - replace with your own
const AWS_ACCESS_KEY_ID = "<YOUR_ACCESS_KEY_ID>";
const AWS_SECRET_ACCESS_KEY = "<YOUR_SECRET_ACCESS_KEY>";
const AWS_SESSION_TOKEN = "<YOUR_SESSION_TOKEN>";

const config = {
  region: "us-east-1",
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    sessionToken: AWS_SESSION_TOKEN,
  },
};
const client = new BedrockRuntimeClient(config);

const ai_request = (request, respondWith) => {
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
    { text: 'Do not include html\`\`\` at the start or \`\`\` at the end.' },
    { text: 'No explanation or boilterplate, just give the HTML response.' }
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
    modelId: "anthropic.claude-3-haiku-20240307-v1:0"
  };

  console.log(system);
  console.log(messages);
    
  // Bedrock doesn't support cancelling a response mid-stream, so there is no use for the signal callback.
  respondWith.stream(async (_signal, streamMessage) => {
    const command = new InvokeModelWithResponseStreamCommand(input);
    const response = await client.send(command);
    for await (const item of response.body) {
      const chunk = JSON.parse(new TextDecoder().decode(item.chunk.bytes));
      const chunk_type = chunk.type;

      switch (chunk_type) {
        case "message_start":
          break;
        case "content_block_start":
          break;
        case "content_block_delta":
          const message = chunk.delta.text;
          streamMessage(message);
          break;
        case "content_block_stop":
          break;
        case "message_delta":
          break;
        case "message_stop":
          break;
        default:
          return Promise.reject("Stream error");
      }
    }
  });
};

tinymce.init({
  selector: 'textarea#streaming',
  plugins: 'ai code help',
  toolbar: 'aidialog aishortcuts code help',
  ai_request
});