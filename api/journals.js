const express = require("express");
const Router = express.Router();
const { autoSignin } = require("./auth");
const pool = require("../model/pool");
const RESPONSE_MESSAGES = require("../utils/responses");
const { generateRandomId } = require("../utils/tools");
const { mainIo } = require("../sockets/io");
const Together = require("together-ai");

const client = new Together({
  apiKey: process.env.AI_API_KEY,
});

const aiId = process.env.AI_ID;

Router.get("/journal", async (req, res) => {
  autoSignin(req, res, async (userId) => {
    try {
      const { journal_id } = req.query;
      const connection = pool.promise();

      const [[journal]] = await connection.query(
        `SELECT title, created_at FROM journals WHERE journal_id = ? AND user_id = ?`,
        [journal_id, userId]
      );

      res.status(200).send({
        success: true,
        status: 200,
        data: {
          journal,
        },
      });
    } catch (err) {
      console.log(err);
      const response = RESPONSE_MESSAGES.error();
      return res.status(response.status).send(response);
    }
  });
});

Router.put("/journal", async (req, res) => {
  autoSignin(req, res, async (userId) => {
    try {
      const { title } = req.body;
      const connection = pool.promise();
      const userInfo = await connection.query(
        `SELECT name FROM users WHERE user_id = ?`,
        [userId]
      );

      if (!userInfo) return;

      const journal_id = generateRandomId();

      const created_at = Math.floor(new Date().getTime() / 1000);

      const journal = {
        user_id: userId,
        journal_id,
        title,
        created_at,
      };

      await connection.query(`INSERT INTO journals SET ?`, journal);

      res.status(200).send({
        success: true,
        status: 200,
        data: {
          journal,
        },
      });

      const messages = [
        {
          role: "system",
          content:
            "You are a compassionate and empathetic therapist, trained to provide thoughtful, supportive, and reflective responses. Your tone should be gentle, non-judgmental, and insightful, helping the user reflect on their emotions and thought patterns. Your responses should encourage reflection and provide insightful questions to help the user explore their thoughts and feelings further.",
        },
        {
          role: "user",
          content: `The journal entry from ${userInfo.name} is titled: "${title}". Please offer compassionate feedback and help ${userInfo.name} explore their feelings on this topic. Encourage reflection and provide insightful questions to prompt deeper thinking.`,
        },
      ];

      // Send the message to the AI
      const response = await client.chat.completions.create({
        messages, // Send the conversation context (system + user message)
        model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
        temperature: 0.7,
        max_tokens: 500,
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
      mainIo.to(userId).emit("journal:chat", aiMsg);
    } catch (err) {
      console.log(err);
      const response = RESPONSE_MESSAGES.error();
      return res.status(response.status).send(response);
    }
  });
});

Router.patch("/journal", async (req, res) => {
  autoSignin(req, res, async (userId) => {
    try {
      const { journal_id } = req.query;
      const connection = pool.promise();

      const [[journal]] = await connection.query(
        `SELECT title, created_at FROM journals WHERE journal_id = ? AND user_id = ?`,
        [journal_id, userId]
      );

      res.status(200).send({
        success: true,
        status: 200,
        data: {
          journal,
        },
      });
    } catch (err) {
      console.log(err);
      const response = RESPONSE_MESSAGES.error();
      return res.status(response.status).send(response);
    }
  });
});

module.exports = Router;
