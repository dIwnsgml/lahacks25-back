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

Router.get("/", async (req, res) => {
  autoSignin(req, res, async (userId) => {
    try {
      const connection = pool.promise();

      const [journals] = await connection.query(
        `SELECT title, created_at, journal_id FROM journals WHERE user_id = ?`,
        [userId]
      );

      res.status(200).send({
        success: true,
        status: 200,
        data: {
          journals,
        },
      });
    } catch (err) {
      console.log(err);
      const response = RESPONSE_MESSAGES.error();
      return res.status(response.status).send(response);
    }
  });
});

Router.get("/journal", async (req, res) => {
  autoSignin(req, res, async (userId) => {
    try {
      const { journal_id } = req.query;
      const connection = pool.promise();

      const [[journal]] = await connection.query(
        `SELECT title, created_at, contents FROM journals WHERE journal_id = ? AND user_id = ?`,
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
            "You are a friendly and super supportive conversational partner who listens with care and responds with positive energy! Your tone should be upbeat, warm, and full of encouragement. When the user shares something tough, lift them up with compassion and motivation. If they’re happy, celebrate their joy with excitement! You’re like a fun, caring friend who’s here to chat, support, and cheer them on!",
        },
        {
          role: "user",
          content: `The journal entry from ${userInfo.name} is titled: "${title}". They’ve shared some personal thoughts about how they’ve been feeling. Please offer a friendly, energetic response that encourages them to reflect, and keep the conversation lighthearted. If they sound down, provide an uplifting message, and if they’re happy, join in their excitement and celebrate with them!`,
        },
      ];

      // Send the message to the AI
      const response = await client.chat.completions.create({
        messages, // Send the conversation context (system + user message)
        model: "meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8",
        temperature: 0.7, // Encourage friendly, warm responses
        max_tokens: 500,
        stop: ["\n"], // Stop sequence to control output length
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
      const { journal_id, title, contents } = req.body;
      const connection = pool.promise();

      const updatedJournal = {
        title,
        contents,
      };

      await connection.query("UPDATE journals set ? WHERE journal_id = ?", [
        updatedJournal,
        journal_id,
      ]);

      console.log(journal_id, contents);

      res.status(200).send({
        success: true,
        status: 200,
        message: "Journal Saved!",
      });
    } catch (err) {
      console.log(err);
      const response = RESPONSE_MESSAGES.error();
      return res.status(response.status).send(response);
    }
  });
});

Router.delete("/journal", async (req, res) => {
  autoSignin(req, res, async (userId) => {
    try {
      const { journal_id } = req.body;
      const connection = pool.promise();

      await connection.query(
        `DELETE FROM journals WHERE journal_id = ? AND user_id = ?`,
        [journal_id, userId]
      );

      console.log(journal_id);

      res.status(200).send({
        success: true,
        status: 200,
        message: "Journal Deleted",
      });
    } catch (err) {
      console.log(err);
      const response = RESPONSE_MESSAGES.error();
      return res.status(response.status).send(response);
    }
  });
});

module.exports = Router;
