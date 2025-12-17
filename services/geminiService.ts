// Client-side service that calls the backend API
// This protects the API Key and ensures it works in the browser without exposing env vars.

export const chatWithEkki = async (
  message: string, 
  history: {role: 'user' | 'model', parts: {text: string}[]}[],
  ownerId: string
): Promise<string> => {
  
  if (!ownerId) {
    return "Error: You must be logged in to chat.";
  }

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ownerId
      },
      body: JSON.stringify({ message, history })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Chat API Error", data);
      if (data.error && data.error.includes("API_KEY")) {
        return "System Error: API_KEY is missing in Vercel Environment Settings. Please add it and Redeploy.";
      }
      return `Error: ${data.error || 'Failed to connect to AI'}`;
    }

    return data.text || "No response text received.";
  } catch (error) {
    console.error("Network Error:", error);
    return "Network Error: Could not reach the backend.";
  }
};