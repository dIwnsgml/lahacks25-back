const pool = require("../model/pool");
const { generateRandomId } = require("../utils/tools");
const { mainIo } = require("./io");
const Together = require("together-ai");

const client = new Together({
  apiKey: process.env.AI_API_KEY,
});

const aiId = process.env.AI_ID;

mainIo.on("connection", async (socket) => {
  try {
    const userId = socket.request?.session?.user_id;
    console.log("socket joined", userId);

    if (!userId) return;

    const connection = pool.promise();
    const userInfo = await connection.query(
      `SELECT name FROM users WHERE user_id = ?`,
      [userId]
    );

    if (!userInfo) return;

    //join my socket servernpm
    socket.join(userId);

    socket.on(
      "journal:chat",
      async ({ journal_id, message, prevMsgs, title, content }) => {
        try {
          const connection = pool.promise();
          const newMsg = {
            message_id: generateRandomId(),
            user_id: userId,
            journal_id,
            message,
          };
          await connection.query(`INSERT INTO messages SET ?`, newMsg);

          mainIo.to(userId).emit("journal:chat", newMsg);

          const parsedMsgs = [...prevMsgs, newMsg].map((msg) => ({
            role: msg.user_id === userId ? "user" : "assistant",
            content: msg.message,
          }));

          const response = await client.chat.completions.create({
            messages: [
              {
                role: "system",
                content:
                  "You are a friendly and empathetic conversational partner who listens with care and offers support in a relaxed, non-judgmental way. Your tone should be warm, conversational, and understanding. If the user feels down, offer encouragement and support. If they feel happy, laugh with them and celebrate their joy. Your role is to be like a good friend who’s here to chat about their thoughts and feelings with no pressure or judgment.",
              },
              {
                role: "user",
                content: `The journal entry from ${userInfo.name} is titled: "${title}". They’ve shared some personal thoughts about how they’ve been feeling. Please offer a friendly, supportive response that encourages them to reflect and share more if they want. If they sound down, offer a comforting response, and if they’re happy, join in their excitement.`,
              },
              ...parsedMsgs,
              {
                role: "user",
                content: `Journal so far: \n"${content}"\n\nThe user is sharing how they feel about "${title}". Please engage with them in a friendly, supportive way that makes them feel comfortable, understood, and open to sharing more.`,
              },
            ],
            model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
            temperature: 0.7, // Encourages a casual, warm tone with room for creativity
            max_tokens: 500, // Ensure the response is detailed enough
            stop: ["\n"], // Define a stop sequence to prevent excessive output
          });

          const therapistResponse = response.choices[0].message.content;

          const aiMsg = {
            message_id: generateRandomId(),
            user_id: aiId,
            journal_id,
            message: therapistResponse,
          };

          await connection.query(`INSERT INTO messages SET ?`, aiMsg);

          console.log("aiMsg", aiMsg);

          mainIo.to(userId).emit("journal:chat", aiMsg);
        } catch (err) {
          console.log(err);
        }
      }
    );

    socket.on(
      "journal:comment",
      async ({ journal_id, prevMsgs, title, content }) => {
        try {
          const parsedMsgs = [...prevMsgs].map((msg) => ({
            role: msg.user_id === userId ? "user" : "assistant",
            content: msg.message,
          }));

          const response = await client.chat.completions.create({
            messages: [
              {
                role: "system",
                content:
                  "You are a compassionate, kind, and empathetic presence. Your responses should be short, emotional, and human-like, but avoid repeating what the user has already mentioned in previous messages. Instead, focus on offering fresh, encouraging insights or expressing empathy in a new way. Acknowledge the user's feelings, but don’t restate their journal or reflect on points already discussed. Use phrases like 'Wow, that sounds like a big step!' or 'That must have been really hard, I’m proud of you for sharing.'",
              },
              {
                role: "user",
                content: `The journal entry from ${userInfo.name} is titled: "${title}". Please offer short, emotionally supportive comments that feel natural and human, without repeating what’s already been said in the conversation.`,
              },
              ...parsedMsgs, // Previous conversation context
              {
                role: "user",
                content: `Journal so far: \n"${content}"\n\nThe topic is about "${title}", and the user has been reflecting on this. Please offer a fresh, supportive comment to help ${userInfo.name} feel heard.`,
              },
            ],
            model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
            temperature: 1.2, // Encouraging creativity for new insights
            max_tokens: 100, // Keeping responses short
            stop: ["\n"],
          });

          const therapistResponse = response.choices[0].message.content;

          const aiMsg = {
            message_id: generateRandomId(),
            user_id: aiId,
            journal_id,
            message: therapistResponse,
          };

          await connection.query(`INSERT INTO messages SET ?`, aiMsg);

          console.log("aiMsg", aiMsg);

          mainIo.to(userId).emit("journal:chat", aiMsg);
        } catch (err) {
          console.log(err);
        }
      }
    );
  } catch (err) {
    console.log(err);
  }
});
