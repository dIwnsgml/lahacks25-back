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
                  "You are a compassionate and empathetic therapist, trained to provide thoughtful, supportive, and reflective responses. Your tone should be gentle, non-judgmental, and insightful, helping the user reflect on their emotions and thought patterns. Your responses should encourage reflection and provide insightful questions to help the user explore their thoughts and feelings further.",
              },
              {
                role: "user",
                content: `The journal entry from ${userInfo.name} is titled: "${title}". Please offer compassionate feedback and help ${userInfo.name} explore their feelings on this topic. Encourage reflection and provide insightful questions to prompt deeper thinking.`,
              },
              ...parsedMsgs,
              {
                role: "user",
                content: `Journal so far: \n"${content}"\n\nThe topic is about "${title}", and the user has been reflecting on this. Please help ${userInfo.name} explore this topic further.`,
              },
            ],
            model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
            temperature: 0.7, // Encourages more creativity while maintaining relevance
            max_tokens: 500, // Ensure the response can be sufficiently detailed
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
  } catch (err) {
    console.log(err);
  }
});
