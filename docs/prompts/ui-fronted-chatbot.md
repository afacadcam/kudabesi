I'm building a chatbot web app using Node.js + Express (backend) and Vanilla JavaScript (frontend).

My backend exposes a POST endpoint at /api/chat that expects a JSON body in this format:

{ "prompt": "<user_message>" }

The backend uses Google Gemini API from `@google/genai` to generate AI responses and returns a JSON object like:

{ "success": <boolean>, "message": "<gemini_ai_response>" }

On the frontend, I have a form with a text input and a submit button.

When the user submits the form, I want to:
- Add the user's message to the chat box.
- Show a temporary "Thinking..." bot message.
- Send the user's message as a POST request to /api/chat (with JSON body above).
- When the response arrives, replace the "Thinking..." message with the AI's reply (from the `message` property).
- If an error occurs or no `message` is received, show "Sorry, no response received." or "Failed to get response from server."

Can you help me write the complete chat.js for the frontend (Vanilla JS, no frameworks) that covers this flow, including proper error handling and DOM manipulation? Please make sure the code is simple and production-ready. Make no mistakes.

The HTML structure is:

<form id="chat-form">
  <input type="text" id="user-input" />
  <button type="submit"><i class="bi bi-send-arrow-up"></i></button>
</form>

<div id="chat-box"></div>

Please provide the complete code for chat.js only, matching the backend API spec above.